// @maintained-by-ai 2026-11-26
import { describe, it, expect, vi, beforeEach } from 'vitest';
import monsters from '../../../public/data/monsters.json';
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';

const runtimeStore = {};
const addEntryLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

const rollExpression = vi.fn(() => ({ total: 24, rolls: [1, 6, 5, 6, 3, 3], modifier: 0 }));
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
    addEntry: (campaignName, entry) => { addEntryLogs.push(entry); return Promise.resolve(); },
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Abominable Yeti 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

// Mirror of the REAL pure resolvers (applyDamage.js computeDamageAfterSave/
// computeDamageAfterEvasion, incl. MA-0367 dc_success:'full'); the generic
// half/none arithmetic is owned verbatim by applyDamage.helpers.test.js —
// this seam only pins dispatch (what saveProcessing forwards).
const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 60 - finalDamage }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toUpperCase(),
    computeDamageAfterSave: (raw, success, dcSuccess) => (!success ? raw : dcSuccess === 'half' ? Math.floor(raw / 2) : dcSuccess === 'full' ? raw : 0),
    computeDamageAfterEvasion: (total, saveSuccess, dcSuccess, evasionActive) =>
        (evasionActive && dcSuccess === 'half') ? (saveSuccess ? 0 : Math.floor(total / 2))
            : (!saveSuccess ? total : dcSuccess === 'half' ? Math.floor(total / 2) : dcSuccess === 'full' ? total : 0),
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
const YETI = 'Abominable Yeti 1';
const TARGET = 'AberrantSorcerer';

// fix#1362 disk-is-authority applied to fixtures (pass #509 rec): this lane used to
// HAND-MIRROR the Abominable Yeti Chilling Gaze row (DC 18 CON, dc_success:none,
// 6d6 Cold, Paralyzed on fail, 1h gaze_immunity on success) — a hand-typed duplicate
// goes stale silently when disk edits; this read-only IMPORT cannot. Every forwarded
// field now derives from the real row bytes, keyed exactly as the production
// transport stamps them (MonsterCardModal.jsx buildAbilitySaveRollContext: saveDc +
// saveType full word, autoDamage fields via resolveSaveLegDamageFields, saveConditions
// save_effect-scoped via extractConditionsFromSaveEffect, successImmunity verbatim
// `action?.success_immunity || null` passthrough). The mapping lines are this
// lane's consumer seam.
const gazeRow = monsters.find((m) => m.name === 'Abominable Yeti').actions.find((a) => a.name === 'Chilling Gaze');
const gazeContext = {
    saveDc: gazeRow.save_dc,
    saveType: gazeRow.save_type,
    attackerName: YETI,
    actionName: gazeRow.name,
    dcSuccess: gazeRow.dc_success,
    autoDamageFormula: gazeRow.damage_dice_primary,
    autoDamageDamageType: gazeRow.damage_type_primary,
    saveConditions: extractConditionsFromSaveEffect(gazeRow.save_effect),
    successImmunity: gazeRow.success_immunity,
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
    pendingSaveResolve({ success, roll, total: roll, saveBonus: 0, rawRolls: [], mode: 'normal' });
    await promise;
}

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
});

// No-clause rows (e.g. Cold Breath) granting nothing on success is parse-owned:
// MonsterCardHelpers.gaze-immunity.test.js null arms make grantSuccessImmunity's
// early return the only possible outcome — no need to re-pin it at this seam.
describe('MA-0030 Chilling Gaze dc_success:none + 1h gaze immunity', () => {
    it('successful save: ZERO damage, gaze_immunity te sourced from yeti, 600-round expiry clock, granted log', async () => {
        await resolveSave({ ...gazeContext }, true, 24);

        expect(applyDamageToTarget).toHaveBeenCalledTimes(1);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(0);

        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toHaveLength(1);
        expect(tes[0]).toMatchObject({ target: TARGET, effect: 'gaze_immunity', source: YETI, duration: '1_hour', rounds: 600 });

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration.mock.calls[0][0]).toMatchObject({
            attackerName: YETI,
            targetName: TARGET,
            campaignName,
            rounds: 600,
            effects: [{ type: 'remove_target_effect', effectKey: 'gaze_immunity', source: YETI, target: TARGET }],
        });

        expect(addEntryLogs.some(e => e.automationType === 'gaze_immunity_granted')).toBe(true);
        expect(runtimeStore[`${TARGET}.activeConditions`]).toBeUndefined();
    });

    it('gaze fail pays FULL damage + Paralyzed with no immunity grant (success-gate: the clause never fires on a failed save)', async () => {
        await resolveSave({ ...gazeContext }, false, 11);

        expect(applyDamageToTarget.mock.calls[0][2]).toBe(24);
        expect(runtimeStore[`${TARGET}.activeConditions`]).toEqual(['paralyzed']);
        expect(addExpiration).not.toHaveBeenCalled();
        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(addEntryLogs.some(e => e.automationType === 'gaze_immunity_granted')).toBe(false);
    });
});
