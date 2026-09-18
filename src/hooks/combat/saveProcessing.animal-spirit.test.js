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
const LORD = 'Animal Lord 1';
const TARGET = 'ElderPaladin';

// MA-0275 Animal Lord Animal Spirit (monsters.json row shape).
const spiritContext = {
    saveDc: 20,
    saveType: 'Dexterity',
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

beforeEach(() => {
    vi.clearAllMocks();
    for (const k of Object.keys(runtimeStore)) delete runtimeStore[k];
    addEntryLogs.length = 0;
});

describe('MA-0275 Animal Spirit variant grants', () => {
    it('fortify failed save: lord tempHp set to 20 (replace-if-larger) + grant log', async () => {
        await resolveSave({ ...spiritContext, animalSpiritVariant: 'fortify', animalSpiritFortifyHp: 20 }, false, 8);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(30);
        expect(runtimeStore[`${LORD}.tempHp`]).toBe(20);
        const grant = addEntryLogs.find(e => e.automationType === 'animal_spirit_fortify_granted');
        expect(grant).toBeTruthy();
        expect(grant.characterName).toBe(LORD);
        expect(grant.description).toMatch(/gains 20 Temporary Hit Points/i);
    });

    it('fortify successful save: THP still lands (either-outcome clause)', async () => {
        await resolveSave({ ...spiritContext, animalSpiritVariant: 'fortify', animalSpiritFortifyHp: 20 }, true, 24);
        expect(applyDamageToTarget.mock.calls[0][2]).toBe(15);
        expect(runtimeStore[`${LORD}.tempHp`]).toBe(20);
        expect(addEntryLogs.some(e => e.automationType === 'animal_spirit_fortify_granted')).toBe(true);
    });

    it('fortify never stacks: smaller amount does not replace larger existing THP', async () => {
        runtimeStore[`${LORD}.tempHp`] = 50;
        await resolveSave({ ...spiritContext, animalSpiritVariant: 'fortify', animalSpiritFortifyHp: 20 }, false, 8);
        expect(runtimeStore[`${LORD}.tempHp`]).toBe(50);
    });

    it('marked_as_prey failed save: te on the LORD with vexTarget + rounds:2 clock + grant log', async () => {
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

    it('pesky_swarm successful save: te on the TARGET + rounds:2 clock + grant log (either-outcome)', async () => {
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

    it('no variant armed (declined / other rows): zero variant state, no variant logs', async () => {
        await resolveSave({ ...spiritContext }, false, 8);
        expect((runtimeStore['campaign.targetEffects'] || []).length).toBe(0);
        expect(runtimeStore[`${LORD}.tempHp`]).toBeUndefined();
        expect(addExpiration).not.toHaveBeenCalled();
        expect(addEntryLogs.some(e => /fortify_granted|marked_as_prey_granted|pesky_swarm_granted/.test(e.automationType || ''))).toBe(false);
    });
});
