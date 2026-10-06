// CLA-143: after_attack_action trigger gate — Flurry rows must refuse with ZERO
// Focus spend unless the Attack action was taken this round.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';

vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
    onSpellSelected: vi.fn(),
    handle: vi.fn(),
}));

vi.mock('../../services/rules/spells/spellCastService.js', () => ({
    executeSpellCast: vi.fn(),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
    getCombatContext: vi.fn(),
    getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
    getClassFeatures: vi.fn(),
}));

// No combat summary cached → getCurrentCombatRound returns round 1.
vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 1),
    getCombatSummary: vi.fn(),
    getActiveCreatureName: vi.fn(),
}));

const campaignName = 'test-campaign';

const flurryRow = {
    name: 'Heightened Flurry of Blows',
    automation: {
        type: 'bonus_attacks',
        attacks: 3,
        attackType: 'unarmed_strike',
        cost: { resource: 'focus_points', amount: 1 },
        trigger: 'after_attack_action',
        casting_time: '1 bonus action',
    },
};

const monkStats = {
    name: 'Disciplined_Monk',
    level: 20,
    rules: '2024',
    class: { name: 'Monk', class_levels: [{ level: 20, focus_points: 20 }] },
    abilities: [{ name: 'Wisdom', bonus: 5 }],
    specialActions: [],
};

function createHarness(overrides = {}) {
    const {
        armedRound = null,
        focusPoints = 20,
    } = overrides;
    const getRuntimeValue = vi.fn((charKey, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'focusPoints') return focusPoints;
        if (key === '_attackActionTakenRound') return armedRound;
        if (key === 'lastActionSpellCast') return null;
        return undefined;
    });
    const setRuntimeValue = vi.fn(() => Promise.resolve());
    const addEntry = vi.fn(() => Promise.resolve());
    const setPopupHtml = vi.fn();
    const executeHandler = vi.fn(() => Promise.resolve(null));
    const hooks = {
        cannotAct: false,
        playerStats: monkStats,
        campaignName,
        mapName: 'test-map',
        characters: [],
        getRuntimeValue,
        setRuntimeValue,
        setPopupHtml,
        setModalState: vi.fn(),
        modalState: {},
        rollDamage: vi.fn(),
        rollAttack: vi.fn(),
        executeHandler,
        addEntry,
        onBuffsChange: vi.fn(),
    };
    return { hooks, getRuntimeValue, setRuntimeValue, addEntry, setPopupHtml, executeHandler };
}

describe('CLA-143 after_attack_action gate', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('refuses Flurry with zero Focus spend and zero dispatch when no Attack action was taken', async () => {
        const { hooks, setRuntimeValue, addEntry, setPopupHtml, executeHandler } = createHarness({ armedRound: null });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);
        await handleAutomationAction(flurryRow);

        expect(setPopupHtml).toHaveBeenCalledWith('<b>Heightened Flurry of Blows</b><br/>You must take the Attack action first.');
        const refusals = addEntry.mock.calls.filter(c => c[1].automationType === 'heightened_flurry_of_blows_refused');
        expect(refusals.length).toBe(1);
        expect(refusals[0][1].description).toContain('no_attack_action_taken');
        const fpSpends = setRuntimeValue.mock.calls.filter(c => c[1] === 'focusPoints');
        expect(fpSpends.length).toBe(0);
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('refuses when the latch is armed on a previous round (round-wrap re-arm)', async () => {
        const { hooks, setRuntimeValue, executeHandler } = createHarness({ armedRound: 0 });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);
        await handleAutomationAction(flurryRow);
        expect(setRuntimeValue.mock.calls.filter(c => c[1] === 'focusPoints').length).toBe(0);
        expect(executeHandler).not.toHaveBeenCalled();
    });

    it('proceeds after the Attack action: gate passes, then Focus spends exactly 1, then dispatch', async () => {
        const { hooks, setRuntimeValue, executeHandler, addEntry } = createHarness({ armedRound: 1 });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);
        await handleAutomationAction(flurryRow);

        expect(executeHandler).toHaveBeenCalledTimes(1);
        const fpSpends = setRuntimeValue.mock.calls.filter(c => c[1] === 'focusPoints');
        expect(fpSpends.length).toBe(1);
        expect(fpSpends[0][2]).toBe(19);
        // No refusal logged when the gate is satisfied
        expect(addEntry.mock.calls.filter(c => /refused/.test(c[1].automationType || '')).length).toBe(0);
    });

    it('spends Focus AFTER the gate — refusal cannot burn Focus even at FP>0', async () => {
        const { hooks, setRuntimeValue } = createHarness({ armedRound: null, focusPoints: 5 });
        const { handleAutomationAction } = useCharActionsAutomation(hooks);
        await handleAutomationAction({ ...flurryRow, automation: { ...flurryRow.automation, attacks: 2 } });
        const order = setRuntimeValue.mock.calls.map(c => c[1]);
        expect(order).not.toContain('focusPoints');
    });

    it('after_casting_action_spell branch keeps its existing refusal wording and token', async () => {
        const { hooks, setRuntimeValue, addEntry, setPopupHtml, executeHandler } = createHarness();
        const spellTriggerRow = {
            name: 'Battle Magic',
            automation: { type: 'bonus_action_attack', trigger: 'after_casting_action_spell' },
        };
        hooks.playerStats = { ...monkStats, name: 'ValorPaladin' };
        const { handleAutomationAction } = useCharActionsAutomation(hooks);
        await handleAutomationAction(spellTriggerRow);

        expect(setPopupHtml).toHaveBeenCalledWith('<b>Battle Magic</b><br/>You must cast a spell with a casting time of an action first.');
        const refusals = addEntry.mock.calls.filter(c => c[1].automationType === 'battle_magic_refused');
        expect(refusals.length).toBe(1);
        expect(refusals[0][1].description).toBe('Battle Magic refused — no_action_spell_cast: You must cast a spell with a casting time of an action first.');
        expect(executeHandler).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
    });
});
