// @maintained-by-ai
// MN-013 lane: _Parry_usedRound reaction round latch (PLAYER_ROUND_LATCH_KEYS family).
// Owned here — ticket-distinct seams only, mapped from source bytes:
//   set:   executeActionManeuvers.js:658 stamps gate.currentRound (numeric)
//   clear: navigationHandlers.js:89 registers the key; :115 writes null at the wrap
//          for player creatures (:131); non-wrap never reaches clearPlayerRoundLatches.
// Cut with cites (covered elsewhere, do not re-test here):
//   generic stamp/wrap machinery → #866 (navigationHandlers.active-creature-stamp.test.jsx)
//   turn-start effects / majesty trackers / __initiative__ gate → base navigationHandlers.test.jsx :163/:191/:211
//   initiative-rolled clears → #864; _Vex_appliedTarget round latch → navigationHandlers.wm008-vex-latch.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextCreatureHandler } from './navigationHandlers.js';
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

describe('MN-013 _Parry_usedRound round-wrap re-arm (one Parry per round)', () => {
    const campaignName = 'test-campaign';
    let combatSummaryRef, roundRef, lastAppliedTurnStartCreatureRef;

    const baseCombatSummary = { round: 1, creatures: [{ name: 'EvasiveFighter', type: 'player' }] };

    const latchWrites = () => runtimeState.setRuntimeValue.mock.calls.filter(([, key]) => key === '_Parry_usedRound');

    beforeEach(() => {
        vi.clearAllMocks();
        // Fresh default each test: enforcement off, latch un-stamped (determinism #827).
        runtimeState.getRuntimeValue.mockImplementation(() => null);
        combatSummaryRef = { current: { ...baseCombatSummary } };
        roundRef = { current: 1 };
        lastAppliedTurnStartCreatureRef = { current: null };
    });

    function makeHandler() {
        return createNextCreatureHandler({
            combatSummaryRef,
            activeCreatureName: 'EvasiveFighter',
            campaignName,
            characters: [{ name: 'EvasiveFighter', computedStats: { hitPoints: 112 } }],
            roundRef,
            lastAppliedTurnStartCreatureRef,
            setCombatSummary: vi.fn(),
            setActiveCreatureName: vi.fn(),
            setRuntimeStateTick: vi.fn(),
        });
    }

    it('round-wrap: re-arms the stamped latch with exactly one null write', async () => {
        // Set byte from the parry trigger (numeric round stamp) — falsifiably
        // distinct from the clear byte null (#842).
        runtimeState.getRuntimeValue.mockImplementation((creature, key) =>
            key === '_Parry_usedRound' ? 1 : null);
        initiativeService.getNextCreatureName.mockReturnValue({ newActiveName: 'EvasiveFighter', roundIncrement: true });

        await makeHandler()();

        // Exact bytes + exact count (#786/#744): the latch is re-armed once, to null.
        expect(latchWrites()).toEqual([['EvasiveFighter', '_Parry_usedRound', null, campaignName]]);
    });

    it('non-wrap step: writes the latch key for no creature (latch persists to the wrap)', async () => {
        initiativeService.getNextCreatureName.mockReturnValue({ newActiveName: 'AasimarTest', roundIncrement: false });

        await makeHandler()();

        // Byte-level filter over ALL creatures: a stray clear aimed at the incoming
        // active creature fails here too, not just one aimed at the holder.
        expect(latchWrites()).toEqual([]);
    });
});
