// MA-0367 (block-save leg): processSaveRoll failed save arms the Infernal
// Wound te + ONE rounds:10 clock via infernalWoundService; dc_success "full"
// keeps the auto-damage unhalved on BOTH outcomes; success grants ZERO wound;
// an already-wounded target is RAW-skipped (no second wound / no clock refresh).
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const addEntryLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`] ?? null,
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
    getAllStoreKeys: () => Object.keys(runtimeStore).map(k => k.split('.')[0]),
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2), getName: (n) => n },
}));

const rollExpression = vi.fn(() => ({ total: 7, rolls: [4, 3], modifier: 0 }));
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
    addEntry: (_c, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [] }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
    setCombatSummaryCache: vi.fn(),
}));

const applyDamageToTarget = vi.fn(async (_cs, _t, dmg) => ({ finalDamage: dmg, newHp: 30 - dmg }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toUpperCase(),
    // byte mirror of the REAL edited semantics (MA-0367 adds the 'full' arm)
    computeDamageAfterSave: (raw, success, dcSuccess) => (!success ? raw : dcSuccess === 'half' ? Math.floor(raw / 2) : dcSuccess === 'full' ? raw : 0),
    computeDamageAfterEvasion: (total, success, dcSuccess, evasionActive) =>
        (evasionActive && dcSuccess === 'half') ? (success ? 0 : Math.floor(total / 2))
            : (!success ? total : dcSuccess === 'half' ? Math.floor(total / 2) : dcSuccess === 'full' ? total : 0),
    applyDamageToTarget: (...args) => applyDamageToTarget(...args),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', () => ({
    isCircleOfPowerActive: () => false,
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasIgnoreResistance: () => false,
    playerIsImmuneToCondition: () => false,
}));

vi.mock('../../services/ui/storage.js', () => ({ default: { set: vi.fn(), get: vi.fn() } }));

vi.mock('../../services/rules/effects/expirationQueue.js', () => ({
    addExpiration: ({ attackerName, targetName, effects, rounds }) => {
        const storeKey = `${attackerName}.pendingExpirations`;
        const list = runtimeStore[storeKey] || [];
        runtimeStore[storeKey] = [...list, { target: targetName, effects, appliedRound: 1, expiryRounds: rounds }];
    },
}));

import { processSaveRoll } from './saveProcessing.js';

const CAMPAIGN = 'test-campaign';
const DEVIL = 'Bearded Devil 1';
const TARGET = 'AberrantSorcerer';

const glaiveContext = {
    saveDc: 12,
    saveType: 'Constitution',
    attackerName: DEVIL,
    actionName: 'Infernal Glaive',
    dcSuccess: 'full',
    autoDamageFormula: '1d10 + 3',
    autoDamageDamageType: 'Slashing',
    saveConditions: [],
    infernalWound: { effect: 'infernal_wound', bleedDie: '1d10', expiresMinutes: 1, medicineDc: 12 },
};

async function resolveSave(context, success, roll) {
    const promise = processSaveRoll({
        rollType: 'save',
        target: { name: TARGET, type: 'player' },
        characterName: TARGET,
        campaignName: CAMPAIGN,
        context,
        logEntry: vi.fn(),
        setPopupHtml: vi.fn(),
    });
    pendingSaveResolve({ success, roll, total: roll, saveBonus: 0, rawRolls: [], mode: 'normal' });
    await promise;
}

function woundTe() {
    return (runtimeStore['campaign.targetEffects'] || []).find(te => te.effect === 'infernal_wound' && te.target === TARGET);
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
});

describe('MA-0367 block-save Infernal Wound grant', () => {
    it('failed save: FULL unhalved auto-damage + infernal_wound te + rounds:10 clock + grant log', async () => {
        await resolveSave({ ...glaiveContext }, false, 4);

        expect(applyDamageToTarget.mock.calls[0][2]).toBe(7);

        const te = woundTe();
        expect(te).toMatchObject({ target: TARGET, effect: 'infernal_wound', source: DEVIL, bleedDie: '1d10', duration: 'until_1_minute' });

        const clocks = runtimeStore[`${DEVIL}.pendingExpirations`] || [];
        expect(clocks).toHaveLength(1);
        expect(clocks[0].expiryRounds).toBe(10);
        expect(clocks[0].effects[0]).toMatchObject({ type: 'remove_target_effect', effectKey: 'infernal_wound' });

        expect(addEntryLogs.some(e => e.automationType === 'infernal_wound_granted')).toBe(true);
    });

    it('successful save: FULL unhalved damage, ZERO wound / clock / grant (save gates only the wound)', async () => {
        await resolveSave({ ...glaiveContext }, true, 20);

        expect(applyDamageToTarget.mock.calls[0][2]).toBe(7);
        expect(woundTe()).toBeFalsy();
        expect(runtimeStore[`${DEVIL}.pendingExpirations`] || []).toHaveLength(0);
        expect(addEntryLogs.some(e => e.automationType === 'infernal_wound_granted')).toBe(false);
    });

    it('already-wounded target on a failed save: RAW skips a second wound, no clock refresh', async () => {
        await resolveSave({ ...glaiveContext }, false, 4);
        addEntryLogs.length = 0;
        await resolveSave({ ...glaiveContext }, false, 3);

        expect((runtimeStore['campaign.targetEffects'] || []).filter(te => te.effect === 'infernal_wound' && te.target === TARGET)).toHaveLength(1);
        expect(runtimeStore[`${DEVIL}.pendingExpirations`] || []).toHaveLength(1);
        expect(addEntryLogs.some(e => e.automationType === 'infernal_wound_refused')).toBe(true);
    });
});
