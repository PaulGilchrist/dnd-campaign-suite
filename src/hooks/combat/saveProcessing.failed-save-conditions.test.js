import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const conditionLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

const rollExpression = vi.fn(() => ({ total: 17, rolls: [5, 6, 6], modifier: 0 }));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: (...args) => rollExpression(...args),
}));

let pendingSaveResolve = null;
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => {
        const promise = new Promise((resolve) => { pendingSaveResolve = resolve; });
        return { promise };
    },
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { conditionLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Aboleth' }),
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 24 }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toLowerCase(),
    computeDamageAfterEvasion: (total, saveSuccess) => (saveSuccess ? Math.floor(total / 2) : total),
    applyDamageToTarget: (...args) => applyDamageToTarget(...args),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: () => false,
    playerIsImmuneToCondition: () => false,
}));

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';
const domContext = {
    saveDc: 16,
    saveType: 'WIS',
    attackerName: 'Aboleth',
    actionName: 'Dominate Mind (2/Day)',
    dcSuccess: 'half',
    autoDamageFormula: null,
    saveConditions: ['charmed'],
};

const gmLog = [];
const logEntry = (e) => gmLog.push(e);

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    conditionLogs.length = 0;
    gmLog.length = 0;
});

describe('MA-0017 failed-save conditions without damage formula', () => {
    it('player path: failed save applies charmed condition + condition-applied log, no damage', async () => {
        const promise = processSaveRoll({
            rollType: 'save',
            target: { name: 'AberrantSorcerer', type: 'player' },
            characterName: 'AberrantSorcerer',
            campaignName,
            context: { ...domContext },
            logEntry,
            setPopupHtml: vi.fn(),
        });
        pendingSaveResolve({ success: false, roll: 4, total: 4, saveBonus: 0, rawRolls: [], mode: 'normal' });
        await promise;

        expect(runtimeStore['AberrantSorcerer.activeConditions']).toEqual(['charmed']);
        expect(conditionLogs).toHaveLength(1);
        expect(conditionLogs[0]).toMatchObject({ type: 'condition', action: 'applied', characterName: 'AberrantSorcerer', condition: 'Charmed', sourceName: 'Aboleth' });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(gmLog.some(e => e.rollType === 'save-damage')).toBe(false);
        expect(gmLog.some(e => e.rollType === 'save' && e.saveResult === 'failure')).toBe(true);
    });

    it('player path: successful save applies no condition and logs success only', async () => {
        const promise = processSaveRoll({
            rollType: 'save',
            target: { name: 'AberrantSorcerer', type: 'player' },
            characterName: 'AberrantSorcerer',
            campaignName,
            context: { ...domContext },
            logEntry,
            setPopupHtml: vi.fn(),
        });
        pendingSaveResolve({ success: true, roll: 18, total: 18, saveBonus: 0, rawRolls: [], mode: 'normal' });
        await promise;

        expect(runtimeStore['AberrantSorcerer.activeConditions']).toBeUndefined();
        expect(conditionLogs).toHaveLength(0);
        expect(gmLog.some(e => e.rollType === 'save' && e.saveResult === 'success')).toBe(true);
    });

    it('npc path: failed save with no damage formula applies condition + log', async () => {
        await processSaveRoll({
            rollType: 'save',
            target: { name: 'Goblin', type: 'npc' },
            characterName: 'Goblin',
            campaignName,
            context: { ...domContext, effectiveD20: 4, effectiveBonus: 0 },
            bonus: 0,
            r1: 4,
            r2: null,
            logEntry,
            setPopupHtml: vi.fn(),
        });

        expect(runtimeStore['Goblin.activeConditions']).toEqual(['charmed']);
        expect(conditionLogs).toHaveLength(1);
        expect(conditionLogs[0]).toMatchObject({ type: 'condition', action: 'applied', characterName: 'Goblin', condition: 'Charmed', sourceName: 'Aboleth' });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('existing damage+condition rows unchanged: condition applied exactly once alongside damage', async () => {
        const promise = processSaveRoll({
            rollType: 'save',
            target: { name: 'AberrantSorcerer', type: 'player' },
            characterName: 'AberrantSorcerer',
            campaignName,
            context: { ...domContext, autoDamageFormula: '3d6', autoDamageDamageType: 'Psychic' },
            logEntry,
            setPopupHtml: vi.fn(),
        });
        pendingSaveResolve({ success: false, roll: 4, total: 4, saveBonus: 0, rawRolls: [], mode: 'normal' });
        await promise;

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(runtimeStore['AberrantSorcerer.activeConditions']).toEqual(['charmed']);
        expect(conditionLogs.filter(e => e.type === 'condition' && e.action === 'applied')).toHaveLength(1);
        expect(gmLog.some(e => e.rollType === 'save-damage')).toBe(true);
    });
});

// MA-0020: 2/Day spend lands at prompt-confirm (applySaveOutcome) + duration
// note rides activeConditionMeta with a CLA-325 advisory log.
const MA2020_CONTEXT = {
    ...domContext,
    monsterAbilityUse: { useKey: 'Dominate Mind', maxUses: 2, actionName: 'Dominate Mind (2/Day)' },
    conditionDurationNote: 'until the aboleth dies or is on a different plane of existence from the target (GM-enforced)',
};

describe('MA-0020 Dominate Mind 2/Day spend at prompt-confirm', () => {
    async function resolveFailedSave(context) {
        const promise = processSaveRoll({
            rollType: 'save',
            target: { name: 'AberrantSorcerer', type: 'player' },
            characterName: 'AberrantSorcerer',
            campaignName,
            context,
            logEntry,
            setPopupHtml: vi.fn(),
        });
        pendingSaveResolve({ success: false, roll: 4, total: 4, saveBonus: 0, rawRolls: [], mode: 'normal' });
        await promise;
    }

    it('first confirmed failed save spends 1/2, counter + ability_use log, charmed still applied', async () => {
        await resolveFailedSave({ ...MA2020_CONTEXT });

        expect(runtimeStore['Aboleth.monsterSpellUses']).toEqual({ 'Dominate Mind': 1 });
        const spend = conditionLogs.find(e => e.type === 'ability_use');
        expect(spend).toBeTruthy();
        expect(spend.characterName).toBe('Aboleth');
        expect(spend.description).toMatch(/1 use spent, 1 left today/);
        expect(runtimeStore['AberrantSorcerer.activeConditions']).toEqual(['charmed']);
        expect(conditionLogs.some(e => e.type === 'condition' && e.action === 'applied')).toBe(true);
    });

    it('second use reaches max 2 with 0 left today', async () => {
        runtimeStore['Aboleth.monsterSpellUses'] = { 'Dominate Mind': 1 };
        await resolveFailedSave({ ...MA2020_CONTEXT });

        expect(runtimeStore['Aboleth.monsterSpellUses']).toEqual({ 'Dominate Mind': 2 });
        expect(conditionLogs.find(e => e.type === 'ability_use').description).toMatch(/0 left today/);
    });

    it('guard: save already resolved at max — counter unchanged, refusal logged, charmed still applied', async () => {
        runtimeStore['Aboleth.monsterSpellUses'] = { 'Dominate Mind': 2 };
        await resolveFailedSave({ ...MA2020_CONTEXT });

        expect(runtimeStore['Aboleth.monsterSpellUses']).toEqual({ 'Dominate Mind': 2 });
        expect(conditionLogs.some(e => e.automationType === 'dominate_mind_refused')).toBe(true);
        expect(conditionLogs.some(e => e.type === 'ability_use')).toBe(false);
        expect(runtimeStore['AberrantSorcerer.activeConditions']).toEqual(['charmed']);
    });

    it('condition meta carries the until-clause durationNote + CLA-325 advisory log', async () => {
        await resolveFailedSave({ ...MA2020_CONTEXT });

        expect(runtimeStore['AberrantSorcerer.activeConditionMeta'].charmed).toMatchObject({
            source: 'Aboleth',
            durationNote: 'until the aboleth dies or is on a different plane of existence from the target (GM-enforced)',
        });
        const advisory = conditionLogs.find(e => e.automationType === 'condition_clauses_advisory');
        expect(advisory).toBeTruthy();
        expect(advisory.characterName).toBe('AberrantSorcerer');
        expect(advisory.description).toMatch(/until the aboleth dies/);
        expect(advisory.description).toMatch(/GM-enforced \(no control subsystem\)/);
    });

    it('successful save still spends the use (ability was used)', async () => {
        const promise = processSaveRoll({
            rollType: 'save',
            target: { name: 'AberrantSorcerer', type: 'player' },
            characterName: 'AberrantSorcerer',
            campaignName,
            context: { ...MA2020_CONTEXT },
            logEntry,
            setPopupHtml: vi.fn(),
        });
        pendingSaveResolve({ success: true, roll: 18, total: 18, saveBonus: 0, rawRolls: [], mode: 'normal' });
        await promise;

        expect(runtimeStore['Aboleth.monsterSpellUses']).toEqual({ 'Dominate Mind': 1 });
        expect(runtimeStore['AberrantSorcerer.activeConditions']).toBeUndefined();
    });

    it('rows without monsterAbilityUse spend nothing (no counter written)', async () => {
        await resolveFailedSave({ ...domContext });

        expect(runtimeStore['Aboleth.monsterSpellUses']).toBeUndefined();
        expect(conditionLogs.some(e => e.type === 'ability_use')).toBe(false);
    });
});
