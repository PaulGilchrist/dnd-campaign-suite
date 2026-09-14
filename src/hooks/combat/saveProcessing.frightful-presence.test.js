import { describe, it, expect, vi, beforeEach } from 'vitest';

// MA-0048: Adult Blue Dracolich Frightful Presence — damageless save row.
// Fail: MA-0017 seam applies Frightened + repeat-save marker armed.
// Success: MA-0030 seam grants frightful_presence_immunity te (24h = 14400
// rounds, CLA-334 minutes×10). Mirrors the chilling-gaze-immunity harness.

const runtimeStore = {};
const addEntryLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
    rollExpression: vi.fn(),
}));

let pendingSaveResolve = null;
vi.mock('../../services/automation/common/savePrompt.js', () => ({
    createSaveListener: () => {
        const promise = new Promise((resolve) => { pendingSaveResolve = resolve; });
        return { promise };
    },
}));

vi.mock('../../services/ui/logService.js', () => ({
    addEntry: (campaignName, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Adult Blue Dracolich 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 224 }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toUpperCase(),
    computeDamageAfterSave: (raw, success, dcSuccess) => (!success ? raw : dcSuccess === 'half' ? Math.floor(raw / 2) : 0),
    computeDamageAfterEvasion: (total, saveSuccess, dcSuccess, evasionActive) =>
        (evasionActive && dcSuccess === 'half') ? (saveSuccess ? 0 : Math.floor(total / 2))
            : (!saveSuccess ? total : dcSuccess === 'half' ? Math.floor(total / 2) : 0),
    applyDamageToTarget: (...args) => applyDamageToTarget(...args),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: () => false,
    playerIsImmuneToCondition: () => false,
}));

const addExpiration = vi.fn();
vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: (...args) => addExpiration(...args),
}));

import { processSaveRoll } from './saveProcessing.js';

const campaignName = 'test-campaign';
const DRACOLICH = 'Adult Blue Dracolich 1';
const TARGET = 'ElderPaladin';

const fpContext = {
    saveDc: 18,
    saveType: 'Wisdom',
    attackerName: DRACOLICH,
    actionName: 'Frightful Presence',
    dcSuccess: 'none',
    autoDamageFormula: null,
    saveConditions: ['frightened'],
    successImmunity: { effect: 'frightful_presence_immunity', duration: '24_hours', duration_minutes: 1440 },
    repeatSave: { condition: 'frightened', save_type: 'Wisdom', duration_minutes: 1 },
};

async function resolveSave(context, success, roll) {
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'player' },
        characterName: TARGET,
        campaignName,
        context,
        logEntry: vi.fn(),
        setPopupHtml: vi.fn(),
    });
    pendingSaveResolve({ success, roll, total: roll, saveBonus: 10, rawRolls: [], mode: 'normal' });
    await promise;
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
});

describe('MA-0048 FP damageless save — application + immunity + repeat-save arm', () => {
    it('failed save: Frightened applied + logged (MA-0017 seam), repeat-save marker te + merged 10-round clock armed, zero damage', async () => {
        await resolveSave({ ...fpContext }, false, 4);

        expect(applyDamageToTarget).not.toHaveBeenCalled();
        expect(runtimeStore[`${TARGET}.activeConditions`]).toContain('frightened');
        expect(addEntryLogs.some(e => e.type === 'condition' && e.action === 'applied' && e.condition === 'Frightened')).toBe(true);

        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toEqual([expect.objectContaining({
            target: TARGET, effect: 'frightful_presence', source: DRACOLICH, dc: 18, condition: 'frightened',
        })]);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        const xp = addExpiration.mock.calls[0][0];
        expect(xp.rounds).toBe(10);
        expect(xp.effects.map(e => e.type)).toEqual(expect.arrayContaining(['remove_target_effect', 'condition', 'frightful_presence_immunity_grant']));
        expect(addEntryLogs.some(e => e.automationType === 'frightful_presence_tracked')).toBe(true);
    });

    it('successful save: zero damage, frightful_presence_immunity te sourced from dracolich, 14400-round expiry (24h), NO repeat-save arm', async () => {
        await resolveSave({ ...fpContext }, true, 12);

        expect(runtimeStore[`${TARGET}.activeConditions`]).toBeUndefined();
        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toEqual([expect.objectContaining({
            target: TARGET, effect: 'frightful_presence_immunity', source: DRACOLICH, duration: '24_hours', rounds: 14400,
        })]);
        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration.mock.calls[0][0].rounds).toBe(14400);
        expect(addEntryLogs.some(e => e.automationType === 'frightful_presence_immunity_granted')).toBe(true);
        expect(addEntryLogs.some(e => e.automationType === 'frightful_presence_tracked')).toBe(false);
    });
});
