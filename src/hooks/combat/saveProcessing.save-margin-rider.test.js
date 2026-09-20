// MA-0639: Drow Hand Crossbow fail-by-5 unconscious margin rider — the
// save chip (riderOnly composite fork, MA-0560) rides applyDamagelessSaveConditions;
// the structured context.saveMargin (parseSaveMarginClause) grants UNCONSCIOUS
// alongside the base Poisoned ONLY when (saveDc − saveTotal) >= fails_by.
// ONE merged rounds:600 clock (CLA-334 hours×600, "unconscious while
// poisoned" 1 hour). Byte-inert for rows without the key.
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

const rollExpression = vi.fn(() => ({ total: 5, rolls: [5], modifier: 0 }));
vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: (...args) => rollExpression(...args),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => ({ promise: new Promise(() => {}) }),
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { conditionLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Drow 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 11 - finalDamage }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toLowerCase(),
    computeDamageAfterEvasion: (total, saveSuccess) => (saveSuccess ? Math.floor(total / 2) : total),
    applyDamageToTarget: (...args) => applyDamageToTarget(...args),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: vi.fn(() => false),
    playerIsImmuneToCondition: vi.fn(() => false),
}));

const addExpiration = vi.fn();
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: (...args) => addExpiration(...args),
}));

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';
const DROW = 'Drow 1';
const TARGET = 'Bandit 1';

// MA-0639 Drow Hand Crossbow save-chip context (riderOnly composite fork:
// saveDamageFormula null → damageless save leg).
const drowContext = (saveMargin) => ({
    saveDc: 13,
    saveType: 'CON',
    attackerName: DROW,
    actionName: 'Hand Crossbow',
    dcSuccess: null,
    autoDamageFormula: null,
    saveConditions: ['poisoned'],
    saveMargin: saveMargin === undefined ? { failsBy: 5, also: 'unconscious' } : saveMargin,
});

async function resolveNpcSave(total) {
    await processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'npc' },
        characterName: TARGET,
        campaignName,
        context: { ...drowContext(), effectiveD20: total, effectiveBonus: 0 },
        bonus: 0,
        r1: total,
        r2: null,
        logEntry: vi.fn(),
        setPopupHtml: vi.fn(),
    });
}

const appliedLogs = () => conditionLogs.filter(e => e.type === 'condition' && e.action === 'applied');

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    conditionLogs.length = 0;
});

describe('MA-0639 fail-by-5 unconscious margin rider', () => {
    it('fail by >= 5 (nat 2, total 3 vs DC 13): poisoned AND unconscious granted', async () => {
        await resolveNpcSave(3);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned', 'unconscious']);
        expect(runtimeStore[`${TARGET}.activeConditionMeta`].unconscious).toMatchObject({ source: DROW });
        const conds = appliedLogs().map(e => e.condition);
        expect(conds).toContain('Poisoned');
        expect(conds).toContain('Unconscious');
        const uncons = appliedLogs().find(e => e.condition === 'Unconscious');
        expect(uncons.sourceName).toBe(DROW);
        expect(uncons.sourceAbility).toBe('Hand Crossbow');
        expect(uncons.description).toMatch(/failed the save by 10/);
        expect(applyDamageToTarget).not.toHaveBeenCalled();
    });

    it('fail by exactly 5 (total 8 vs DC 13): rider lands at the boundary', async () => {
        await resolveNpcSave(8);
        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned', 'unconscious']);
    });

    it('fail by < 5 (total 9 vs DC 13): poisoned only, no unconscious', async () => {
        await resolveNpcSave(9);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned']);
        expect(appliedLogs().map(e => e.condition)).toEqual(['Poisoned']);
    });

    it('successful save (total 13 vs DC 13): nothing granted', async () => {
        await resolveNpcSave(13);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toBeUndefined();
        expect(appliedLogs()).toHaveLength(0);
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('ONE merged addExpiration clock: rounds:600, both condition legs (§37/§5)', async () => {
        await resolveNpcSave(3);

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration).toHaveBeenCalledWith(expect.objectContaining({
            attackerName: DROW,
            targetName: TARGET,
            campaignName,
            rounds: 600,
            effects: [
                { type: 'condition', condition: 'poisoned' },
                { type: 'condition', condition: 'unconscious' },
            ],
        }));
    });

    it('byte-inert without the structured key: poisoned grant + no clock (legacy row)', async () => {
        await processSaveRoll({
            rollType: 'save',
            target: { name: TARGET, type: 'npc' },
            characterName: TARGET,
            campaignName,
            context: { ...drowContext(null), effectiveD20: 3, effectiveBonus: 0 },
            bonus: 0,
            r1: 3,
            r2: null,
            logEntry: vi.fn(),
            setPopupHtml: vi.fn(),
        });

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['poisoned']);
        expect(appliedLogs().map(e => e.condition)).toEqual(['Poisoned']);
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('immunity to the base condition blocks the rider too (unconscious WHILE poisoned)', async () => {
        const automationService = await import('../../services/combat/automation/automationService.js');
        automationService.playerIsImmuneToCondition.mockImplementationOnce(() => true);
        await processSaveRoll({
            rollType: 'save',
            target: { name: TARGET, type: 'npc' },
            characterName: TARGET,
            campaignName,
            context: { ...drowContext(), effectiveD20: 3, effectiveBonus: 0, _characters: [{ name: TARGET }] },
            bonus: 0,
            r1: 3,
            r2: null,
            logEntry: vi.fn(),
            setPopupHtml: vi.fn(),
        });

        expect(runtimeStore[`${TARGET}.activeConditions`]).toBeUndefined();
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('no double-grant when unconscious already present: condition unchanged, still one clock', async () => {
        runtimeStore[`${TARGET}.activeConditions`] = ['unconscious'];
        await resolveNpcSave(3);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['unconscious', 'poisoned']);
        expect(addExpiration).toHaveBeenCalledTimes(1);
    });
});
