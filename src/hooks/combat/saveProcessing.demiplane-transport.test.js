// MA-0104: Adult Gold Dragon Banish authored failed-save demiplane-transport
// grant — distinct te `banished_demiplane` on the target (not the PC spell
// `banishment`, whose concentration/permanent semantics would misfire its
// consumers), rounds:2 clock (MA-0073 shape) + granted log with honest
// reappearance advisory.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const runtimeStore = {};
const addEntryLogs = [];

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: (name, key) => runtimeStore[`${name}.${key}`],
    setRuntimeValue: (name, key, value) => { runtimeStore[`${name}.${key}`] = value; return Promise.resolve(); },
}));

vi.mock('../../services/ui/utils.js', () => ({
    default: { guid: () => 'id-' + Math.random().toString(36).slice(2) },
}));

const rollExpression = vi.fn(() => ({ total: 9, rolls: [5, 1, 3], modifier: 0 }));
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
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Adult Gold Dragon 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 100 - finalDamage }));
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
const DRAGON = 'Adult Gold Dragon 1';
const TARGET = 'ElderPaladin';

// MA-0104 Adult Gold Dragon Banish (monsters.json legendary row shape).
const banishContext = {
    saveDc: 21,
    saveType: 'Charisma',
    attackerName: DRAGON,
    actionName: 'Banish',
    dcSuccess: 'none',
    autoDamageFormula: '3d6',
    autoDamageDamageType: 'Force',
    saveConditions: ['incapacitated'],
    demiplaneTransport: { effect: 'banished_demiplane' },
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

describe('MA-0104 Banish failed-save banished_demiplane te', () => {
    it('failed save: banished_demiplane te on target sourced from dragon, until_start_of_attacker_next_turn, rounds:2 clock + granted log', async () => {
        await resolveSave({ ...banishContext }, false, 8);

        expect(applyDamageToTarget.mock.calls[0][2]).toBe(9);

        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toHaveLength(1);
        expect(tes[0]).toMatchObject({
            target: TARGET,
            effect: 'banished_demiplane',
            source: DRAGON,
            duration: 'until_start_of_attacker_next_turn',
            actionName: 'Banish',
        });

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration.mock.calls[0][0]).toMatchObject({
            attackerName: DRAGON,
            targetName: TARGET,
            campaignName,
            rounds: 2,
            effects: [{ type: 'remove_target_effect', effectKey: 'banished_demiplane', source: DRAGON, target: TARGET }],
        });

        const grant = addEntryLogs.find(e => e.automationType === 'banished_demiplane_granted');
        expect(grant).toBeTruthy();
        expect(grant.characterName).toBe(TARGET);
        expect(grant.sourceName).toBe(DRAGON);
        expect(grant.description).toMatch(/transported to a harmless demiplane \(Incapacitated\) until the start of/i);
        expect(grant.description).toMatch(/reappears in an unoccupied space.*120 feet/i);
        expect(grant.description).toMatch(/GM-enforced/);
    });

    it('successful save: no te, no expiry, no grant log, no damage (dc_success none) — honest success is inert', async () => {
        await resolveSave({ ...banishContext }, true, 24);

        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => e.automationType === 'banished_demiplane_granted')).toBe(false);
        if (applyDamageToTarget.mock.calls.length > 0) {
            expect(applyDamageToTarget.mock.calls[0][2]).toBe(0);
        }
    });

    it('rows without the clause are byte-inert: no te even on a failed save', async () => {
        const claw = { ...banishContext, actionName: 'Claw', demiplaneTransport: null };
        await resolveSave(claw, false, 3);

        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(addExpiration).not.toHaveBeenCalled();
    });

    it('does not reuse the PC spell te key: grant never writes banishment', async () => {
        await resolveSave({ ...banishContext }, false, 4);
        expect((runtimeStore['campaign.targetEffects'] || []).every(te => te.effect !== 'banishment')).toBe(true);
    });
});
