// @maintained-by-ai
// CLA-405 fleetStep lane (attack-row owner): pins WHEN the attack-row lane
// invokes grantFleetStep (useCharActionsAttackHandlers.js BA block) and the
// byte-exact consumer args — row-type gating plus the refusal paths upstream
// of the BA branch. Service internals (eligibility, Step-of-the-Wind trigger
// exclusion, once-per-round pending latch, consume/refusal logs) are owned by
// fleetStepService.test.js; the feature-row automation lane by
// useCharActionsAutomation.fleetStep.test.js; the _attackActionTakenRound /
// _bonusActionAttackRound stamp writes by .cla143-stamp.test.js (no store
// writes re-pinned here); dispatch, chooser and roll paths by .test.js.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';

// Mock hygiene: the useRuntimeState automock is transitively live — the
// deliberately UNMOCKED lineOfSightGate and coverService import it, and the
// automock keeps their store reads inert (enforcement fast-path stays off).
vi.mock('../../hooks/runtime/useRuntimeState.js');
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(() => 'Disciplined_Monk'),
    getCurrentCombatRound: vi.fn(() => 3),
    getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve(undefined)),
}));
vi.mock('../../services/combat/assertCanAct.js', () => ({
    assertCanAct: vi.fn(() => ({ allowed: true })),
}));
vi.mock('../../services/rules/features/friendsService.js', () => ({
    endFriendsOnHostileAction: vi.fn(),
}));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));
// The SUT collaborator: invocation + args are this lane's contract; the real
// grant internals are covered by fleetStepService.test.js.
vi.mock('../../services/rules/features/fleetStepService.js', () => ({
    grantFleetStep: vi.fn(() => Promise.resolve(true)),
}));
// buffToggle / expirations / oncePerTurn mocks purged: those collaborators run
// only in the confirm lane (-2.test.js / .brutalGate.test.js), never on
// handleAttackClick, and their real modules load harmlessly against the same
// useRuntimeState automock above. brutalStrikeSelection mock purged too: the
// real function is pure and empty-passives-safe (passives: [] → no chooser).

import { grantFleetStep } from '../../services/rules/features/fleetStepService.js';
import { assertCanAct } from '../../services/combat/assertCanAct.js';

const campaignName = 'test-campaign';
const playerName = 'Disciplined_Monk';

/** Runtime-store read stub; key-based so tests never hand-roll a switch. */
function makeRuntimeStore(overrides = {}) {
    const store = {
        activeCreatureName: playerName,
        activeBuffs: [],
        targetEffects: [],
        '_recklessAttack_offeredThisTurn': null,
        '_BrutalStrike_usedRound': null,
        ...overrides,
    };
    return vi.fn((_charKey, key) => store[key]);
}

function createDeps(overrides = {}) {
    return {
        cannotAct: false,
        buildCtx: vi.fn(() => Promise.resolve({})),
        rollAttack: vi.fn(),
        exhaustionPenalty: 0,
        playerName,
        campaignName,
        setModalState: vi.fn(),
        specialActions: [],
        passives: [],
        playerStats: { name: playerName, level: 20, rules: '2024', class: { name: 'Monk' } },
        getRuntimeValue: makeRuntimeStore(),
        setRuntimeValue: vi.fn(),
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

/** Fresh row per test — never shared mutable state. */
function makeRow(overrides = {}) {
    return { name: 'Unarmed Strike', type: 'Bonus Action', hitBonus: 11, damage: '1d12+5', weaponType: 'unarmed', automation: { type: 'unarmed_strike' }, ...overrides };
}

describe('CLA-405 Fleet Step grant from the attack-row lane', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-arm the economy default so denial overrides can never leak.
        assertCanAct.mockReturnValue({ allowed: true });
    });

    it('grants once with byte-exact args on a Bonus Action attack row — and the grant never blocks the roll', async () => {
        const deps = createDeps();
        const row = makeRow();

        useCharActionsAttackHandlers(deps).handleAttackClick(row);

        expect(grantFleetStep).toHaveBeenCalledTimes(1);
        const [stats, campaign, triggerName, automation] = grantFleetStep.mock.calls[0];
        expect(stats).toBe(deps.playerStats);
        expect(campaign).toBe(campaignName);
        expect(triggerName).toBe('Unarmed Strike');
        expect(automation).toBe(row.automation);

        // fire-and-forget grant: the roll lane proceeds untouched
        await vi.waitFor(() => expect(deps.rollAttack).toHaveBeenCalledWith('Unarmed Strike', 11, {}));
    });

    it('does NOT grant on an Attack-action row (only Bonus Action rows resolve Fleet Step)', () => {
        const deps = createDeps();

        useCharActionsAttackHandlers(deps).handleAttackClick(makeRow({ name: 'Quarterstaff', type: 'Action', damage: '1d6+5', weaponType: 'melee' }));

        // Positive leg: this file's first test proves the identical wiring
        // grants on a BA row; buildCtx running here proves the click reached
        // the branch region, so the absence is real row-type gating.
        expect(deps.buildCtx).toHaveBeenCalled();
        expect(grantFleetStep).not.toHaveBeenCalled();
    });

    it.each([
        ['the cannotAct flag blocks the attacker', (deps) => { deps.cannotAct = true; }],
        ['the action economy denies the click', () => { assertCanAct.mockReturnValue({ allowed: false }); }],
    ])('never grants when the Bonus Action click is refused — %s', (_label, armRefusal) => {
        const deps = createDeps();
        armRefusal(deps);

        useCharActionsAttackHandlers(deps).handleAttackClick(makeRow());

        expect(grantFleetStep).not.toHaveBeenCalled();
        expect(deps.rollAttack).not.toHaveBeenCalled();
    });
});
