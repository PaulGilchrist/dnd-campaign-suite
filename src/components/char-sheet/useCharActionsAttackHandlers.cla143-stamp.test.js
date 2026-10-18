// @maintained-by-ai
// CLA-143: the Attack-action row lane arms the round-keyed latch
// `_attackActionTakenRound` (holder + round) that gateTriggerRequirement
// (useCharActionsAutomation.js), the grappler step, and bonusActionAttackHandler
// enforce. This file pins ONLY the write seam (useCharActionsAttackHandlers.js):
// byte-exact store args and branch gating. The consume contract (same-round
// refuse / fresh-round allow) is owned by useCharActionsAutomation.cla143-gate,
// grappler, and bonusActionAttackHandler.ft102-turn-gate suites — not re-tested
// here. cannotAct refusals are covered more strictly by the dispatch lane in
// useCharActionsAttackHandlers.test.js ("refuses a blocked attacker with zero
// side effects" — no setRuntimeValue call at all).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useCharActionsAttackHandlers from './useCharActionsAttackHandlers.js';
import { getCurrentCombatRound } from '../../services/encounters/combatData.js';

// Mock hygiene: the useRuntimeState automock is transitively live — this hook
// never imports it directly, but the deliberately UNMOCKED assertCanAct,
// lineOfSightGate, coverService and fleetStepService all do, and the automock
// keeps their store reads/writes inert (enforcement fast-path stays off).
vi.mock('../../hooks/runtime/useRuntimeState.js');
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(() => 'Disciplined_Monk'),
    getCurrentCombatRound: vi.fn(() => 3),
    getCombatSummary: vi.fn(() => null),
}));
vi.mock('../../services/rules/features/friendsService.js', () => ({
    endFriendsOnHostileAction: vi.fn(),
}));
vi.mock('../../services/rules/features/invisibilityService.js', () => ({
    endInvisibilityOnHostileAction: vi.fn(),
}));
// buffToggle / expirations / oncePerTurn mocks purged: those collaborators run
// only in the confirm lane (-2.test.js / .brutalGate.test.js), never on
// handleAttackClick, and their real modules load harmlessly against the same
// useRuntimeState automock above.

const campaignName = 'test-campaign';
const playerName = 'Disciplined_Monk';

const RECKLESS_FEATURE = {
    name: 'Reckless Attack',
    effect: 'advantage_attacks_advantage_against',
    trigger: 'first_attack_of_turn',
};

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
        playerStats: { name: playerName, level: 20, class: { name: 'Monk' } },
        getRuntimeValue: makeRuntimeStore(),
        setRuntimeValue: vi.fn(),
        setPopupHtml: vi.fn(),
        ...overrides,
    };
}

/** Fresh attack row per test — never shared mutable state. */
function makeRow(overrides = {}) {
    return { name: 'Quarterstaff', type: 'Action', hitBonus: 11, damage: '1d6+5', weaponType: 'melee', ...overrides };
}

describe('CLA-143 _attackActionTakenRound stamp (write seam)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Re-arm the default round so per-test overrides can never leak.
        getCurrentCombatRound.mockReturnValue(3);
    });

    it('arms holder + current round, byte-exact and once, on an Attack-action row click', () => {
        const deps = createDeps();

        useCharActionsAttackHandlers(deps).handleAttackClick(makeRow());

        expect(getCurrentCombatRound).toHaveBeenCalledWith(campaignName);
        expect(deps.setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_attackActionTakenRound', 3, campaignName);
    });

    it('does NOT arm the latch on a Bonus Action row (Flurry cannot re-arm itself)', () => {
        const deps = createDeps();

        useCharActionsAttackHandlers(deps).handleAttackClick(makeRow({ name: 'Unarmed Strike', type: 'Bonus Action' }));

        // Positive leg: the click ran deep into the stamp region — its only
        // write is the FT-036 _bonusActionAttackRound BA press-stamp (write
        // pinned here; its grappler consumption is covered in grappler.test.js),
        // so the absence of an _attackActionTakenRound arm is real gating,
        // not an upstream short-circuit.
        expect(deps.setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_bonusActionAttackRound', 3, campaignName);
    });

    it('stamps the round before the Reckless chooser opens — the click already committed the Attack action', () => {
        // Prop-distinct round (8 vs the default 3): a stamp value of 8 is
        // attributable to the combatData read, not a hardcoded literal.
        getCurrentCombatRound.mockReturnValue(8);
        const deps = createDeps({ specialActions: [RECKLESS_FEATURE] });

        useCharActionsAttackHandlers(deps).handleAttackClick(makeRow());

        expect(deps.setModalState).toHaveBeenCalledTimes(1);
        expect(deps.buildCtx).not.toHaveBeenCalled(); // roll deferred to the chooser
        expect(deps.setRuntimeValue).toHaveBeenCalledTimes(1);
        expect(deps.setRuntimeValue).toHaveBeenCalledWith(playerName, '_attackActionTakenRound', 8, campaignName);
    });
});
