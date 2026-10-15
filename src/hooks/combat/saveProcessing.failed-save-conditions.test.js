// @maintained-by-ai: 2026-10-14
// AUTHORITATIVE generic failed/success save-condition contract for
// saveProcessing: MA-0017 damageless condition grants (player + npc lanes,
// success face, damage+condition rows applied-once) and MA-0020 N/Day spend
// at prompt-confirm. Specialized siblings (aura-of-courage, chilling-gaze,
// damageless-spell-hold-person, eye-rays, consumeMemories, frightful-presence)
// defer these basic legs here — add only monster-specific clauses there.
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
// Mirrors monsters.json Aboleth "Dominate Mind (2/Day)": WIS save DC 16,
// Failure: Charmed, no damage formula.
const domContext = {
    saveDc: 16,
    saveType: 'WIS',
    attackerName: 'Aboleth',
    actionName: 'Dominate Mind (2/Day)',
    dcSuccess: 'half',
    autoDamageFormula: null,
    saveConditions: ['charmed'],
};

const FAIL = { success: false, roll: 4, total: 4, saveBonus: 0, rawRolls: [], mode: 'normal' };
const PASS = { success: true, roll: 18, total: 18, saveBonus: 0, rawRolls: [], mode: 'normal' };

const gmLog = [];
const logEntry = (e) => gmLog.push(e);

// Drive the player prompt lane: processPlayerSave creates the save listener
// synchronously, so pendingSaveResolve is assigned before this returns.
function runPlayerSave(context, saveResult) {
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: 'AberrantSorcerer', type: 'player' },
        characterName: 'AberrantSorcerer',
        campaignName,
        context,
        logEntry,
        setPopupHtml: vi.fn(),
    });
    pendingSaveResolve(saveResult);
    return promise;
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    conditionLogs.length = 0;
    gmLog.length = 0;
});

describe('MA-0017 failed-save conditions without damage formula', () => {
    it('player failed save: charmed applied + condition-applied log, no damage rolled, no ability_use without monsterAbilityUse', async () => {
        await runPlayerSave({ ...domContext }, FAIL);

        expect(runtimeStore['AberrantSorcerer.activeConditions']).toEqual(['charmed']);
        expect(conditionLogs).toHaveLength(1);
        expect(conditionLogs[0]).toMatchObject({ type: 'condition', action: 'applied', characterName: 'AberrantSorcerer', condition: 'Charmed', sourceName: 'Aboleth' });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(gmLog.some(e => e.rollType === 'save' && e.saveResult === 'failure')).toBe(true);
        expect(runtimeStore['Aboleth.monsterSpellUses']).toBeUndefined();
        expect(conditionLogs.some(e => e.type === 'ability_use')).toBe(false);
    });

    it('player successful save: no condition, success log only', async () => {
        await runPlayerSave({ ...domContext }, PASS);

        expect(runtimeStore['AberrantSorcerer.activeConditions']).toBeUndefined();
        expect(conditionLogs).toHaveLength(0);
        expect(gmLog.some(e => e.rollType === 'save' && e.saveResult === 'success')).toBe(true);
    });

    it('npc failed save: condition + log applied, no damage rolled', async () => {
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
        await runPlayerSave({ ...domContext, autoDamageFormula: '3d6', autoDamageDamageType: 'Psychic' }, FAIL);

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(runtimeStore['AberrantSorcerer.activeConditions']).toEqual(['charmed']);
        expect(conditionLogs.filter(e => e.type === 'condition' && e.action === 'applied')).toHaveLength(1);
        expect(gmLog.some(e => e.rollType === 'save-damage')).toBe(true);
    });
});

// MA-0020: 2/Day spend lands at prompt-confirm (applySaveOutcome) on EITHER
// outcome; the duration note rides activeConditionMeta with a CLA-325 advisory log.
const MA2020_CONTEXT = {
    ...domContext,
    monsterAbilityUse: { useKey: 'Dominate Mind', maxUses: 2, actionName: 'Dominate Mind (2/Day)' },
    conditionDurationNote: 'until the aboleth dies or is on a different plane of existence from the target (GM-enforced)',
};

describe('MA-0020 Dominate Mind 2/Day spend at prompt-confirm', () => {
    it('failed save spends 1/2, applies charmed with durationNote meta + advisory log; successful save also spends, reaching max 2 "0 left today"', async () => {
        await runPlayerSave({ ...MA2020_CONTEXT }, FAIL);

        expect(runtimeStore['Aboleth.monsterSpellUses']).toEqual({ 'Dominate Mind': 1 });
        expect(runtimeStore['AberrantSorcerer.activeConditions']).toEqual(['charmed']);
        const spend = conditionLogs.find(e => e.type === 'ability_use');
        expect(spend).toMatchObject({ characterName: 'Aboleth' });
        expect(spend.description).toMatch(/1 use spent, 1 left today/);
        expect(runtimeStore['AberrantSorcerer.activeConditionMeta'].charmed).toMatchObject({
            source: 'Aboleth',
            durationNote: MA2020_CONTEXT.conditionDurationNote,
        });
        const advisory = conditionLogs.find(e => e.automationType === 'condition_clauses_advisory');
        expect(advisory).toMatchObject({ characterName: 'AberrantSorcerer' });
        expect(advisory.description).toMatch(/until the aboleth dies/);
        expect(advisory.description).toMatch(/GM-enforced \(no control subsystem\)/);

        // The ability was used even on a successful save — spend on both faces.
        await runPlayerSave({ ...MA2020_CONTEXT }, PASS);

        expect(runtimeStore['Aboleth.monsterSpellUses']).toEqual({ 'Dominate Mind': 2 });
        expect(conditionLogs.filter(e => e.type === 'ability_use')[1].description).toMatch(/0 left today/);
    });

    it('guard: save already resolved at max — counter unchanged, refusal logged, charmed still applied', async () => {
        runtimeStore['Aboleth.monsterSpellUses'] = { 'Dominate Mind': 2 };
        await runPlayerSave({ ...MA2020_CONTEXT }, FAIL);

        expect(runtimeStore['Aboleth.monsterSpellUses']).toEqual({ 'Dominate Mind': 2 });
        expect(conditionLogs.some(e => e.automationType === 'dominate_mind_refused')).toBe(true);
        expect(conditionLogs.some(e => e.type === 'ability_use')).toBe(false);
        expect(runtimeStore['AberrantSorcerer.activeConditions']).toEqual(['charmed']);
    });
});
