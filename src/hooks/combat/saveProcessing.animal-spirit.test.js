// @maintained-by-ai: 2026-10-14
// MA-0275 Animal Lord Animal Spirit variant trio (monsters.json row: DC 20
// Dex, 4d10+6 Radiant half-on-success, "Failure or Success: one of the
// following"). The GM-chosen variant rides the save context from the
// chip-click chooser and lands on EITHER outcome — the save gates only the
// damage. Fortify (Forager): THP on the LORD via tempHpService replace-if-
// larger (default 20, the number no longer rides the context — the semantic
// is covered by the MA-0875 inline twin). Marked as Prey (Hunter): te on
// the LORD with vexTarget + rounds:2 clock. Pesky Swarm (Sage): te on the
// target + rounds:2 clock. Variantless rows are byte-inert. Consumer folds
// live in conditionEffects.animal-spirit.test.js; row parsing in
// MonsterCardHelpers.animal-spirit.test.js.
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

const rollExpression = vi.fn(() => ({ total: 30, rolls: [5, 5, 5, 5, 4, 6], modifier: 0 }));
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
    loadCombatSummary: async () => ({ creatures: [], activeCreatureName: 'Animal Lord 1' }),
    getCurrentCombatRound: () => 1,
    getCombatSummary: () => null,
}));

const applyDamageToTarget = vi.fn(async (_cs, _target, finalDamage) => ({ finalDamage, newHp: 224 - finalDamage }));
vi.mock('../../services/rules/combat/applyDamage.js', () => ({
    normalizeSaveType: (t) => String(t || '').toUpperCase(),
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
import monstersData from '../../../public/data/monsters.json';

const campaignName = 'test-campaign';
const LORD = 'Animal Lord 1';
const TARGET = 'ElderPaladin';

const SPIRIT_ROW = monstersData.find(m => m.name === 'Animal Lord').actions.find(a => a.name === 'Animal Spirit');

const spiritContext = {
    saveDc: SPIRIT_ROW.save_dc,
    saveType: SPIRIT_ROW.save_type,
    attackerName: LORD,
    actionName: 'Animal Spirit',
    dcSuccess: 'half',
    autoDamageFormula: '4d10+6',
    autoDamageDamageType: 'Radiant',
    saveConditions: [],
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

function resetState() {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
}

beforeEach(resetState);

describe('MA-0275 Animal Spirit variant grants (either-outcome, save gates damage only)', () => {
    it('fortify (Forager): 20 THP on the LORD replace-if-larger with grant log on BOTH outcomes', async () => {
        // Failed save: full damage + THP lands.
        await resolveSave({ ...spiritContext, animalSpiritVariant: 'fortify' }, false, 8);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(30);
        expect(runtimeStore[`${LORD}.tempHp`]).toBe(20);
        const failGrant = addEntryLogs.find(e => e.automationType === 'animal_spirit_fortify_granted');
        expect(failGrant).toBeTruthy();
        expect(failGrant.characterName).toBe(LORD);
        expect(failGrant.description).toMatch(/failed/i);
        expect(failGrant.description).toMatch(/gains 20 Temporary Hit Points/i);

        // Successful save: half damage, clause still lands (Failure or Success).
        resetState();
        runtimeStore[`${LORD}.tempHp`] = 10; // smaller standing pool is replaced (replace-if-larger up)
        await resolveSave({ ...spiritContext, animalSpiritVariant: 'fortify' }, true, 24);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(15);
        expect(runtimeStore[`${LORD}.tempHp`]).toBe(20);
        expect(addEntryLogs.some(e => e.automationType === 'animal_spirit_fortify_granted' && /succeeded/i.test(e.description))).toBe(true);
    });

    it('marked_as_prey (Hunter): te on the LORD with vexTarget, until_start_of_attacker_next_turn + rounds:2 clock + grant log', async () => {
        await resolveSave({ ...spiritContext, animalSpiritVariant: 'marked_as_prey' }, false, 8);

        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toHaveLength(1);
        expect(tes[0]).toMatchObject({
            target: LORD,
            effect: 'marked_as_prey',
            source: LORD,
            duration: 'until_start_of_attacker_next_turn',
            vexTarget: TARGET,
        });

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration.mock.calls[0][0]).toMatchObject({
            attackerName: LORD,
            targetName: LORD,
            campaignName,
            rounds: 2,
            effects: [{ type: 'remove_target_effect', effectKey: 'marked_as_prey', source: LORD, target: LORD }],
        });

        const grant = addEntryLogs.find(e => e.automationType === 'marked_as_prey_granted');
        expect(grant).toBeTruthy();
        expect(grant.description).toMatch(/Advantage on attack rolls against ElderPaladin/i);
    });

    it('pesky_swarm (Sage): te on the TARGET, until_end_of_next_turn + rounds:2 clock + grant log (either-outcome)', async () => {
        await resolveSave({ ...spiritContext, animalSpiritVariant: 'pesky_swarm' }, true, 24);

        const tes = runtimeStore['campaign.targetEffects'] || [];
        expect(tes).toHaveLength(1);
        expect(tes[0]).toMatchObject({
            target: TARGET,
            effect: 'pesky_swarm',
            source: LORD,
            duration: 'until_end_of_next_turn',
        });

        expect(addExpiration).toHaveBeenCalledTimes(1);
        expect(addExpiration.mock.calls[0][0]).toMatchObject({
            attackerName: LORD,
            targetName: TARGET,
            rounds: 2,
            effects: [{ type: 'remove_target_effect', effectKey: 'pesky_swarm', source: LORD, target: TARGET }],
        });

        const grant = addEntryLogs.find(e => e.automationType === 'pesky_swarm_granted');
        expect(grant).toBeTruthy();
        expect(grant.description).toMatch(/Disadvantage on attack rolls and ability checks until the end of/i);
    });

    it('no variant armed (declined / other rows): byte-inert — zero variant state, no variant logs', async () => {
        await resolveSave({ ...spiritContext }, false, 8);

        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(runtimeStore[`${LORD}.tempHp`]).toBeUndefined();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => /fortify_granted|marked_as_prey_granted|pesky_swarm_granted/.test(e.automationType || ''))).toBe(false);
    });
});
