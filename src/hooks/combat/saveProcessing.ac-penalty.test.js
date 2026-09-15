// MA-0115: Adult Green Dragon Noxious Miasma failed-save AC-penalty clause
// — "the target takes a −2 penalty to AC until the end of its next turn".
// The single-target save seam arms context.acPenaltyClause (MA-0073 shape);
// a failed save grants the registry ac_penalty te (value 2, sourced from the
// dragon, until_end_of_next_turn + rounds:2 expiry clock) and logs the named
// clause. Successful saves grant nothing; clauseless rows are byte-inert.
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

const rollExpression = vi.fn(() => ({ total: 7, rolls: [2, 5], modifier: 0 }));
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
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Adult Green Dragon 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 224 - finalDamage }));
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
import { parseAcPenaltyClause } from '../../components/encounter/MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const campaignName = 'test-campaign';
const DRAGON = 'Adult Green Dragon 1';
const TARGET = 'AberrantSorcerer';

const MIASMA = monstersData.find(m => m.index === 'adult-green-dragon').legendary_actions.find(a => a.name === 'Noxious Miasma');

const miasmaContext = {
    saveDc: MIASMA.save_dc,
    saveType: 'Constitution',
    attackerName: DRAGON,
    actionName: 'Noxious Miasma',
    dcSuccess: 'none',
    autoDamageFormula: '2d6',
    autoDamageDamageType: 'Poison',
    saveConditions: [],
    acPenaltyClause: parseAcPenaltyClause(MIASMA.save_effect),
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

describe('MA-0115 Noxious Miasma failed-save ac_penalty te', () => {
    it('failed save: ac_penalty te value 2 on target sourced from dragon, until_end_of_next_turn, rounds:2 clock + granted log', async () => {
        await resolveSave({ ...miasmaContext }, false, 8);

        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toHaveLength(1);
        expect(tes[0]).toMatchObject({
            target: TARGET,
            effect: 'ac_penalty',
            source: DRAGON,
            duration: 'until_end_of_next_turn',
            value: 2,
            actionName: 'Noxious Miasma',
        });

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration.mock.calls[0][0]).toMatchObject({
            attackerName: DRAGON,
            targetName: TARGET,
            campaignName,
            rounds: 2,
            effects: [{ type: 'remove_target_effect', effectKey: 'ac_penalty', source: DRAGON, target: TARGET }],
        });

        const grant = addEntryLogs.find(e => e.automationType === 'ac_penalty_granted');
        expect(grant).toBeTruthy();
        expect(grant.characterName).toBe(TARGET);
        expect(grant.sourceName).toBe(DRAGON);
        expect(grant.description).toMatch(/\u22122 penalty to AC until the end of/i);
    });

    it('successful save: no te, no expiry, no grant log (clause is Failure-only)', async () => {
        await resolveSave({ ...miasmaContext }, true, 20);

        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => e.automationType === 'ac_penalty_granted')).toBe(false);
    });

    it('rows without the clause are byte-inert: no te even on a failed save', async () => {
        const claw = { ...miasmaContext, actionName: 'Claw', acPenaltyClause: null };
        await resolveSave(claw, false, 3);

        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(addExpiration).not.toHaveBeenCalled();
    });
});
