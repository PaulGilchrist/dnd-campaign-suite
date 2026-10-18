// @maintained-by-ai
// CLA-405 feature-row automation lane: the Fleet Step seam in handleAutomationAction is
// ONLY lane-unique behavior — (1) a resolved Bonus Action row (casting_time
// "1 bonus action" OR action:'bonus_action') calls grantFleetStep with byte-exact
// (playerStats, campaignName, row.name, auto) and the real service stamps the round
// latch, (2) non-BA rows, CLA-143 refusals, and no-result rows never arm a grant
// (positive leg proves the path ran; absence is then real gating).
// Owned elsewhere: Step-of-the-Wind exclusion / eligibility / latch internals →
// fleetStepService.test.js; attack-row grant → useCharActionsAttackHandlers.fleetStep.test.js;
// after_attack_action read-gate popup/log → useCharActionsAutomation.cla143-gate.test.js;
// FP-cost lanes + after_casting_action_spell refusals → useCharActionsAutomation.test.js;
// granted-row render/consume click → CharBonusActions.fleet-step.test.jsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAutomation from './useCharActionsAutomation.js';

// Seam isolation — 1:1 with useCharActionsAutomation.js direct imports, so unrelated
// outbound lanes (divine intervention, spell cast, telepathy) stay inert. The real
// fleetStepService and assertCanAct/chargeEconomy economy wrappers stay live: the
// economy fast-path is a single null enforcement read, and the grant stamp under test
// runs through the real service onto the mocked runtime/log surface below.
vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
    onSpellSelected: vi.fn(),
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
// Only getCurrentCombatRound is imported by this lane's live graph (the hook's
// CLA-143 gate + the real fleetStepService); buffHandler is mocked so the
// expireStaleEffects subtree that needs loadCombatSummary never executes.
vi.mock('../../services/encounters/combatData.js', () => ({
    getCurrentCombatRound: vi.fn(() => 3),
}));
// getStore is a module-level import of the live assertCanAct; the enforcement-off
// fast path never calls it, but the honest factory supplies every imported key.
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(() => Promise.resolve()),
    getStore: vi.fn(() => null),
}));
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
}));
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

// Every row resolves through executeHandler with this popup result unless a test
// overrides it — dispatching it is the positive leg proving the lane was traversed.
const EXECUTE_RESULT = { type: 'popup', payload: { description: 'ok' } };

const patientDefenseRow = {
    name: 'Patient Defense',
    automation: { type: 'patient_defense', cost: { resource: 'focus_points', amount: 1 }, trigger: 'after_attack_action', casting_time: '1 bonus action' },
};
// ER dash shape pins the second OR-leg: bonus_action with NO casting_time.
const erDashRow = {
    name: 'Dash (Expeditious Retreat)',
    automation: { type: 'expeditious_retreat_dash', action: 'bonus_action' },
};
const secondWindRow = {
    name: 'Second Wind',
    automation: { type: 'temp_buff', effect: 'second_wind', casting_time: '1 action' },
};

// Fresh fixture per mount; key-based store stub. focusPoints is never read on these
// rows (patient_defense/step_of_the_wind types skip the pre-spend, CLA-247/CLA-333).
function createHarness(overrides = {}) {
    const { armedRound = 3, executeResult = EXECUTE_RESULT } = overrides;
    const getRuntimeValue = vi.fn((charKey, key) => {
        if (key === 'activeBuffs') return [];
        if (key === '_attackActionTakenRound') return armedRound;
        return undefined;
    });
    const hooks = {
        cannotAct: false,
        playerStats: monkStats,
        campaignName,
        mapName: 'test-map',
        characters: [],
        getRuntimeValue,
        setRuntimeValue: vi.fn(() => Promise.resolve()),
        setPopupHtml: vi.fn(),
        setModalState: vi.fn(),
        modalState: {},
        rollDamage: vi.fn(),
        rollAttack: vi.fn(),
        executeHandler: vi.fn(() => Promise.resolve(executeResult)),
        addEntry: vi.fn(() => Promise.resolve()),
        onBuffsChange: vi.fn(),
    };
    return { hooks };
}

describe('CLA-405 Fleet Step grant — feature-row automation lane', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        { row: patientDefenseRow, branch: 'casting_time "1 bonus action"' },
        { row: erDashRow, branch: "action:'bonus_action' with no casting_time" },
    ])('arms Fleet Step with byte-exact args after a resolved $branch feature row', async ({ row }) => {
        const { hooks } = createHarness();
        await useCharActionsAutomation(hooks).handleAutomationAction(row);

        // Positive leg: the row dispatched (handler ran, popup surfaced).
        expect(hooks.executeHandler).toHaveBeenCalledWith(row, monkStats, campaignName, 'test-map', []);
        expect(hooks.setPopupHtml).toHaveBeenCalledWith(EXECUTE_RESULT.payload);
        // The lane hands the grant to the real service verbatim...
        expect(grantFleetStep).toHaveBeenCalledTimes(1);
        expect(grantFleetStep).toHaveBeenCalledWith(monkStats, campaignName, row.name, row.automation);
        // ...and the service stamps the round latch (round 3 mirrors the
        // getCurrentCombatRound mock) — the lane's only store write.
        await vi.waitFor(() => expect(runtimeSet).toHaveBeenCalledTimes(1));
        expect(runtimeSet).toHaveBeenCalledWith('Disciplined_Monk', FLEET_STEP_GRANT_KEY, 3, campaignName);
    });

    it('does NOT arm for a non-Bonus Action row — dispatched first, then absence', async () => {
        const { hooks } = createHarness();
        await useCharActionsAutomation(hooks).handleAutomationAction(secondWindRow);

        // Positive leg: the 1-action row fully resolved past the dispatch seam,
        // so it genuinely reached the bonus-action guard and was skipped there.
        expect(hooks.executeHandler).toHaveBeenCalledTimes(1);
        expect(hooks.setPopupHtml).toHaveBeenCalledWith(EXECUTE_RESULT.payload);
        expect(grantFleetStep).not.toHaveBeenCalled();
        expect(runtimeSet).not.toHaveBeenCalled();
    });

    it('a CLA-143 refused row (no Attack action this round) never arms — zero spend, zero grant', async () => {
        const { hooks } = createHarness({ armedRound: 2 });
        await useCharActionsAutomation(hooks).handleAutomationAction(patientDefenseRow);

        // Positive legs: the refusal genuinely fired (popup + refusal log) and
        // execution never started — the grant line is unreachable by contract.
        expect(hooks.setPopupHtml).toHaveBeenCalledWith('<b>Patient Defense</b><br/>You must take the Attack action first.');
        expect(hooks.addEntry).toHaveBeenCalledTimes(1);
        expect(hooks.executeHandler).not.toHaveBeenCalled();
        expect(grantFleetStep).not.toHaveBeenCalled();
        expect(runtimeSet).not.toHaveBeenCalled();
    });

    it('does NOT arm when the handler produced no result', async () => {
        const { hooks } = createHarness({ executeResult: null });
        await useCharActionsAutomation(hooks).handleAutomationAction(patientDefenseRow);

        // Positive leg: the row reached the !result guard — nothing dispatched.
        expect(hooks.executeHandler).toHaveBeenCalledTimes(1);
        expect(hooks.setPopupHtml).not.toHaveBeenCalled();
        expect(grantFleetStep).not.toHaveBeenCalled();
        expect(runtimeSet).not.toHaveBeenCalled();
    });
});
