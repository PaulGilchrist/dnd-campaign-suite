// WM-008: round-wrap resets the campaign-level _Vex_appliedTarget auto-apply latch so a
// master who granted Vex to a target last round can re-grant it this round. Non-wrap
// steps must NOT reset it (one grant per round).
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

describe('WM-008 round-wrap clears _Vex_appliedTarget latch', () => {
    const campaignName = 'test-campaign';
    let combatSummaryRef, roundRef, lastAppliedTurnStartCreatureRef;

    const baseCombatSummary = { round: 1, creatures: [{ name: 'Alice', type: 'player' }] };

    beforeEach(() => {
        vi.clearAllMocks();
        combatSummaryRef = { current: { ...baseCombatSummary } };
        roundRef = { current: 1 };
        lastAppliedTurnStartCreatureRef = { current: null };
    });

    function makeHandler() {
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

    it('resets the latch on round-wrap', async () => {
        initiativeService.getNextCreatureName.mockReturnValue({ newActiveName: 'Alice', roundIncrement: true });
        await makeHandler()();
        expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('campaign', '_Vex_appliedTarget', null, campaignName);
    });

    it('does NOT reset the latch on a non-wrap step', async () => {
        initiativeService.getNextCreatureName.mockReturnValue({ newActiveName: 'Alice', roundIncrement: false });
        await makeHandler()();
        expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('campaign', '_Vex_appliedTarget', null, campaignName);
    });
});
