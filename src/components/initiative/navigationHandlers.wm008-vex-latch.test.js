// @maintained-by-ai
// WM-008 lane: campaign-scope '_Vex_appliedTarget' auto-apply latch at the ROUND-WRAP seam
// of navigationHandlers. #867 header: "wm008 owns _Vex_appliedTarget" — this file is the
// owner. Never mock the latch logic; only its collaborators (#791).
//
// Owned contract (source bytes: navigationHandlers.js:126, inside runRoundWrapHousekeeping):
//   next + roundIncrement:true            → exactly ONE null clear per wrap — master can
//                                           re-grant Vex this round; the one-per-round dedupe
//                                           itself lives on the consume side (below)
//   next + roundIncrement:false           → ZERO latch writes (grant persists to the wrap)
//   previous (rewind, even roundDecrement)→ ZERO latch writes — rewind is not a real wrap
//                                           seam (CLA-307 philosophy; the only authored clear is
//                                           the null byte at the forward wrap, #842-style
//                                           armed-vs-null falsifiability)
//
// Seam table vs siblings (distinct triggers — adjudicated, do NOT duplicate):
//   initiative-rolled clear (Initiative.jsx:504 — new-initiative event, different trigger)
//                                    → #864 initiative-init-rolled-handler.test.jsx
//   _Parry_usedRound wrap re-arm   → #867 navigationHandlers.mn013-parry-latch.test.js (exemplar)
//   combatSummary stamp bytes      → #866 navigationHandlers.active-creature-stamp.test.jsx
//   base dispatch / canonicals     → navigationHandlers.test.jsx (#868 map :158/:163/:191/:211)
//   latch SET + one-per-round consume → services/automation/contextBuilder-sync.wm008-vex-consume.test.js
//
// Turn-based mandate: the latch matures only at these initiative seams — no wall-clock here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextCreatureHandler, createPreviousCreatureHandler } from './navigationHandlers.js';
import * as initiativeService from '../../services/encounters/initiativeService.js';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../services/encounters/initiativeService.js', () => ({
    getNextCreatureName: vi.fn(),
    getPreviousCreatureName: vi.fn(),
}));
vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    clearPerRoundMajestyTrackers: vi.fn(),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
    expireStaleEffects: vi.fn(),
    applyTurnStartEffects: vi.fn(() => Promise.resolve()),
    applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()),
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    // L5-001: navigationHandlers reads enforcement via getRuntimeValue; null ⇒ off (legacy behavior).
    getRuntimeValue: vi.fn(() => null),
}));
vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));

describe('WM-008 round-wrap clears _Vex_appliedTarget latch', () => {
    const campaignName = 'test-campaign';
    let combatSummaryRef, roundRef, lastAppliedTurnStartCreatureRef;

    const baseCombatSummary = { round: 1, creatures: [{ name: 'Alice', type: 'player' }] };

    // Byte-filter over ALL store writes for this key — any stray write (any scope,
    // any value) fails the negatives, not just one aimed at the exact null byte.
    const latchWrites = () => runtimeState.setRuntimeValue.mock.calls.filter(([, key]) => key === '_Vex_appliedTarget');

    beforeEach(() => {
        vi.clearAllMocks();
        // Fresh default each test: enforcement off (determinism #827).
        runtimeState.getRuntimeValue.mockImplementation(() => null);
        combatSummaryRef = { current: { ...baseCombatSummary } };
        roundRef = { current: 1 };
        lastAppliedTurnStartCreatureRef = { current: null };
    });

    function makeNextHandler() {
        return createNextCreatureHandler({
            combatSummaryRef,
            activeCreatureName: 'Alice',
            campaignName,
            characters: [{ name: 'Alice', computedStats: { hitPoints: 20 } }],
            roundRef,
            lastAppliedTurnStartCreatureRef,
            setCombatSummary: vi.fn(),
            setActiveCreatureName: vi.fn(),
            setRuntimeStateTick: vi.fn(),
        });
    }

    function makePrevHandler() {
        return createPreviousCreatureHandler({
            combatSummaryRef,
            activeCreatureName: 'Alice',
            campaignName,
            characters: [{ name: 'Alice', computedStats: { hitPoints: 20 } }],
            roundRef,
            lastAppliedTurnStartCreatureRef,
            setCombatSummary: vi.fn(),
            setActiveCreatureName: vi.fn(),
            setRuntimeStateTick: vi.fn(),
            isPreviousDisabled: false,
        });
    }

    it('round-wrap: re-arms the latch with exactly one exact-byte null write', async () => {
        initiativeService.getNextCreatureName.mockReturnValue({ newActiveName: 'Alice', roundIncrement: true });

        await makeNextHandler()();

        // Exact bytes + exact count (#786/#744): one clear per wrap, to null, campaign-scoped.
        expect(latchWrites()).toEqual([['campaign', '_Vex_appliedTarget', null, campaignName]]);
    });

    it('non-wrap step: zero latch writes (one grant per round persists to the wrap)', async () => {
        initiativeService.getNextCreatureName.mockReturnValue({ newActiveName: 'Alice', roundIncrement: false });

        await makeNextHandler()();

        expect(latchWrites()).toEqual([]);
    });

    it('rewind across a round boundary: zero latch writes (rewind is not a wrap seam)', async () => {
        roundRef.current = 2;
        initiativeService.getPreviousCreatureName.mockReturnValue({ newActiveName: 'Alice', roundDecrement: true });

        await makePrevHandler()();

        expect(latchWrites()).toEqual([]);
    });
});
