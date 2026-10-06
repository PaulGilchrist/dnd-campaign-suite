// CLA-405: the feature-row automation lane arms Fleet Step only when a
// Bonus Action feature row RESOLVES (after executeHandler) — Step of the
// Wind rows and refused rows never grant.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';

vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
    onSpellSelected: vi.fn(),
    handle: vi.fn(),
}));
vi.mock('../../services/automation/handlers/buffs/buffHandler.js', () => ({
    confirmTelepathicSpeech: vi.fn(),
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
vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 3),
    getCombatSummary: vi.fn(),
    getActiveCreatureName: vi.fn(),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));
// Real grant logic (Step exclusion + eligibility live in the service) with
// the runtime/log surface mocked; wrap in a spy so the lane wiring is pinned.
vi.mock('../../services/rules/features/fleetStepService.js', async (importActual) => {
    const actual = await importActual();
    return { ...actual, grantFleetStep: vi.fn(actual.grantFleetStep) };
});

import { grantFleetStep, FLEET_STEP_GRANT_KEY } from '../../services/rules/features/fleetStepService.js';
import { setRuntimeValue as runtimeSet } from '../../hooks/runtime/useRuntimeState.js';

const campaignName = 'test-campaign';

const monkStats = {
    name: 'Disciplined_Monk',
    level: 20,
    rules: '2024',
    class: { name: 'Monk', major: { name: 'Warrior of the Open Hand', features: [{ name: 'Fleet Step', level: 11 }] }, class_levels: [{ level: 20, focus_points: 20 }] },
    abilities: [{ name: 'Wisdom', bonus: 5 }],
    specialActions: [],
};

const patientDefenseRow = {
    name: 'Patient Defense',
    automation: { type: 'patient_defense', cost: { resource: 'focus_points', amount: 1 }, trigger: 'after_attack_action', casting_time: '1 bonus action' },
};
const stepRow = {
    name: 'Step of the Wind',
    automation: { type: 'step_of_the_wind', cost: { resource: 'focus_points', amount: 1 }, trigger: 'after_attack_action', casting_time: '1 bonus action' },
};
const actionRow = {
    name: 'Second Wind',
    automation: { type: 'temp_buff', effect: 'second_wind', casting_time: '1 action' },
};

function createHarness(overrides = {}) {
    const { armedRound = 3, focusPoints = 20, executeResult = { type: 'popup', payload: { description: 'ok' } } } = overrides;
    const getRuntimeValue = vi.fn((charKey, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'focusPoints') return focusPoints;
        if (key === '_attackActionTakenRound') return armedRound;
        if (key === 'lastActionSpellCast') return null;
        return undefined;
    });
    const setRuntimeValue = vi.fn(() => Promise.resolve());
    const addEntry = vi.fn(() => Promise.resolve());
    const executeHandler = vi.fn(() => Promise.resolve(executeResult));
    const hooks = {
        cannotAct: false,
        playerStats: monkStats,
        campaignName,
        mapName: 'test-map',
        characters: [],
        getRuntimeValue,
        setRuntimeValue,
        setPopupHtml: vi.fn(),
        setModalState: vi.fn(),
        modalState: {},
        rollDamage: vi.fn(),
        rollAttack: vi.fn(),
        executeHandler,
        addEntry,
        onBuffsChange: vi.fn(),
    };
    return { hooks, setRuntimeValue, addEntry, executeHandler };
}

describe('CLA-405 Fleet Step grant from the feature automation lane', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const grantStamps = () => runtimeSet.mock.calls.filter(c => c[1] === FLEET_STEP_GRANT_KEY);

    it('grants after a resolved non-Step Bonus Action feature row (Patient Defense)', async () => {
        const { hooks } = createHarness();
        await useCharActionsAutomation(hooks).handleAutomationAction(patientDefenseRow);
        expect(grantFleetStep).toHaveBeenCalledTimes(1);
        expect(grantFleetStep.mock.calls[0][2]).toBe('Patient Defense');
        const stamps = await grantStamps();
        expect(stamps.length).toBe(1);
        expect(stamps[0][0]).toBe('Disciplined_Monk');
        expect(stamps[0][2]).toBe(3);
    });

    it('does NOT stamp a grant when Step of the Wind was the Bonus Action', async () => {
        const { hooks } = createHarness();
        await useCharActionsAutomation(hooks).handleAutomationAction(stepRow);
        expect(grantStamps().length).toBe(0);
    });

    it('does NOT grant when the Bonus Action was refused (no Attack action this round)', async () => {
        const { hooks } = createHarness({ armedRound: 2 });
        await useCharActionsAutomation(hooks).handleAutomationAction(patientDefenseRow);
        expect(grantFleetStep).not.toHaveBeenCalled();
    });

    it('does NOT grant when the handler produced no result', async () => {
        const { hooks } = createHarness({ executeResult: null });
        await useCharActionsAutomation(hooks).handleAutomationAction(patientDefenseRow);
        expect(grantFleetStep).not.toHaveBeenCalled();
    });

    it('does NOT grant for Action-casting-time feature rows', async () => {
        const { hooks } = createHarness();
        await useCharActionsAutomation(hooks).handleAutomationAction(actionRow);
        expect(grantFleetStep).not.toHaveBeenCalled();
    });

    it('grants when a bonus_action-flagged row resolves without casting_time (ER dash shape)', async () => {
        const { hooks } = createHarness();
        await useCharActionsAutomation(hooks).handleAutomationAction({
            name: 'Dash (Expeditious Retreat)',
            automation: { type: 'expeditious_retreat_dash', action: 'bonus_action' },
        });
        expect(grantFleetStep).toHaveBeenCalledTimes(1);
    });
});
