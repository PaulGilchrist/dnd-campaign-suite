// MN-013: _Parry_usedRound is registered in the PLAYER_ROUND_LATCH_KEYS family —
// the Parry reaction round latch re-arms at the round wrap (start of the holder's
// next turn), mirroring the _Riposte_usedRound registration. Non-wrap steps must
// NOT clear it (one Reaction per round).
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
}));
vi.mock('../../services/ui/storage.js', () => ({
    default: { get: vi.fn(), set: vi.fn(), getProperty: vi.fn(), setProperty: vi.fn() },
}));

describe('MN-013 round-wrap re-arms the _Parry_usedRound reaction latch', () => {
    const campaignName = 'test-campaign';
    let combatSummaryRef, roundRef, lastAppliedTurnStartCreatureRef;

    const baseCombatSummary = { round: 1, creatures: [{ name: 'EvasiveFighter', type: 'player' }] };

    beforeEach(() => {
        vi.clearAllMocks();
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

    it('clears _Parry_usedRound on round-wrap (re-arm)', async () => {
        initiativeService.getNextCreatureName.mockReturnValue({ newActiveName: 'EvasiveFighter', roundIncrement: true });
        await makeHandler()();
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('EvasiveFighter', '_Parry_usedRound', null, campaignName);
    });

    it('does NOT clear the latch on a non-wrap step', async () => {
        initiativeService.getNextCreatureName.mockReturnValue({ newActiveName: 'AasimarTest', roundIncrement: false });
        await makeHandler()();
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('EvasiveFighter', '_Parry_usedRound', null, campaignName);
    });
});
