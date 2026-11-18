// @maintained-by-ai
// Regression wiring (bug-round-reuse-after-clear-drops-once-per-turn-riders):
// Initiative "Clear" is the board-wide new-combat seam (CLA-100) — the ONLY
// lane that resets combatSummary.round to 1 — so it must evict the closing
// board's once-per-turn latch stamps exactly where it already resets the Dread
// Ambush once-per-combat latch. This pins the seam call (closing roster,
// monsters INCLUDED: an EB re-join lands the same bare name and re-collides on
// its stale `_<Feat>_usedRound`); the eviction semantics live in
// oncePerTurn.clearCombatLatches.test.js. Declined/Closed faces stay inert.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createCreatureHandlers } from './createCreatureHandlers.js';
import { clearCombat } from '../../services/encounters/initiativeService.js';
import { clearCombatLatches } from '../../services/automation/common/oncePerTurn.js';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/ui/storage.js', () => ({ default: { get: vi.fn(), set: vi.fn(), patch: vi.fn() } }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn(async () => ({})) }));
vi.mock('../../services/ui/utils.js', () => ({ default: { getName: (n) => n, guid: () => 'guid' } }));
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    clearDeathSavePrompt: vi.fn(), sendDeathSavePrompt: vi.fn(),
}));
vi.mock('../../services/encounters/initiativeService.js', () => ({
    clearCombat: vi.fn(() => ({ round: 1, creatures: [{ name: 'Alice', type: 'player' }, { name: 'Bob', type: 'player' }] })),
    setInitiative: vi.fn(), renameNpc: vi.fn(), setTarget: vi.fn(),
    removeNpc: vi.fn(), addNpc: vi.fn(), mergeCombatSummaryWithCharacters: vi.fn(),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    loadCombatSummary: vi.fn(), setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../services/combat/sessionService.js', () => ({ setSessionPhase: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/items/autoRewardService.js', () => ({ autoAwardCombatRewards: vi.fn(() => Promise.resolve()) }));
vi.mock('../../services/combat/thiefsReflexesService.js', () => ({ maybeGrantThiefsReflexesSecondTurn: vi.fn() }));
vi.mock('../../services/combat/summons/summonedCreatureService.js', () => ({ vanishSummonAtZeroHp: vi.fn() }));
vi.mock('../../services/rules/features/hypnoticPatternService.js', () => ({ breakHypnoticPatternOnDamage: vi.fn() }));
vi.mock('../../services/rules/effects/zoneDurationClock.js', () => ({ sweepNewCombatClocks: vi.fn(() => Promise.resolve()) }));
// Seam spy — the eviction family itself is pinned in oncePerTurn.clearCombatLatches.test.js.
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({
    clearCombatLatches: vi.fn(() => 0),
}));

const campaignName = 'test-campaign';

function makeHandlers() {
    const combatSummary = {
        round: 4,
        creatures: [
            { name: 'Alice', type: 'player', currentHp: 20 },
            { name: 'Bob', type: 'player', currentHp: 15 },
            { name: 'Goblin', type: 'npc', currentHp: 0 },
        ],
    };
    const handlers = createCreatureHandlers({
        combatSummary,
        campaignName,
        campaignNpcs: [],
        setNpcImages: vi.fn(),
        overlays: [],
        setCombatSummary: vi.fn(),
        setActiveCreatureName: vi.fn(),
        characters: [{ name: 'Alice' }, { name: 'Bob' }],
        isLocalhost: true,
        requestClearConfirm: vi.fn(),
        showToast: vi.fn(),
    });
    return { handlers, combatSummary };
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe('confirmClear — new-combat latch eviction seam', () => {
    it('evicts the CLOSING roster\'s latches (players AND joined monsters) after the board wipe', () => {
        const { handlers } = makeHandlers();

        handlers.confirmClear();

        // CLA-100 order held: board wiped to round 1 first, then the old
        // combat's latches go — the closing roster (round 4, Goblin included),
        // never the re-baked players-only summary.
        expect(clearCombatLatches).toHaveBeenCalledTimes(1);
        expect(clearCombatLatches).toHaveBeenCalledWith(campaignName, ['Alice', 'Bob', 'Goblin']);
        expect(clearCombat).toHaveBeenCalledTimes(1);

        // ORDERING LAW (bug-clear-latch-eviction-resurrects-stamps): the latch
        // eviction is dispatched BEFORE the Dread Ambush nulls. Both lanes POST
        // whole-bucket snapshots; nulling latches first guarantees every later
        // body already carries the nulls, so no same-bucket arrival order can
        // resurrect a stamp.
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Alice', 'dreadAmbushSpeedActive', null, campaignName);
        const latchCallOrder = clearCombatLatches.mock.invocationCallOrder[0];
        const dreadCallOrder = Math.min(...runtimeState.setRuntimeValue.mock.calls
            .map((call, i) => call[1] === 'dreadAmbushSpeedActive' ? runtimeState.setRuntimeValue.mock.invocationCallOrder[i] : Infinity));
        expect(latchCallOrder).toBeLessThan(dreadCallOrder);
    });

    it('handleClear alone (prompt merely armed, never confirmed) evicts nothing', () => {
        const requestClearConfirm = vi.fn();
        const combatSummary = { round: 2, creatures: [{ name: 'Alice', type: 'player', currentHp: 20 }] };
        const handlers = createCreatureHandlers({
            combatSummary,
            campaignName,
            campaignNpcs: [],
            setNpcImages: vi.fn(),
            overlays: [],
            setCombatSummary: vi.fn(),
            setActiveCreatureName: vi.fn(),
            characters: [{ name: 'Alice' }],
            isLocalhost: true,
            requestClearConfirm,
            showToast: vi.fn(),
        });

        handlers.handleClear();

        expect(requestClearConfirm).toHaveBeenCalledWith(true);
        expect(clearCombatLatches).not.toHaveBeenCalled();
    });
});
