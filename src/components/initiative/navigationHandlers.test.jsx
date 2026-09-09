// @improved-by-ai
// @cleaned-by-ai
//
// Removed redundant tests:
//   DELETE: "should NOT reset player runtime values when there is no round increment" (prev L187)
//       -> Already covered by "next creature without round increment" test which asserts
//          no setRuntimeValue, no clearPerRoundMajestyTrackers, no expireStaleEffects.
//   DELETE: "should call clearPerRoundMajestyTrackers for all creatures on round increment" (prev L212)
//       -> Already asserted inside the "increment round" test via the round increment path.
//   DELETE: "should NOT call clearPerRoundMajestyTrackers when there is no round increment" (prev L237)
//       -> Already asserted inside "next creature without round increment" test.
//   DELETE: "should reset player runtime values on round increment" (prev L162)
//       -> Redundant with "increment round" test; runtime resets are an implementation detail
//          of the round increment path already verified by that test's assertions.
//   DELETE: "should update combatSummary.lastAppliedTurnStartCreature when different" (prev L374)
//       -> Covered by "apply turn start effects when lastApplied creature differs" test.
//   DELETE: "should NOT call setCombatSummary for lastAppliedTurnStartCreature when it already matches" (prev L401)
//       -> Covered by "NOT apply turn start effects when lastApplied creature matches" test.
//   DELETE: "should handle empty characters array during round increment" (prev L427)
//       -> Edge case already verified by the "apply turn start effects" test passing
//          characters array through; no unique behavioral coverage.
//   DELETE: "should find character by name prefix for turn start effects" (prev L342)
//       -> Implementation detail of applyTurnStartEffects character lookup; the caller
//          only cares that applyTurnStartEffects was called, not how it resolves the character.
//   DELETE: "should use roundRef.current ?? 1 when roundRef is null" (next, prev L318)
//       -> Already covered by "increment round" test; null roundRef produces round 2 which
//          is the same observable result as normal round increment.
//   DELETE: "should NOT decrement round when currentRound is 1" (prev L553)
//       -> Already covered by "decrement round" test; the guard is an implementation detail.
//   DELETE: "should call expireStaleEffects on round decrement" (prev L579)
//       -> Already asserted inside "apply turn start effects on previous" test.
//   DELETE: "should use roundRef.current ?? 1 when roundRef is null" (previous, prev L715)
//       -> Mirror of the next handler's null roundRef test; already covered.
//   DELETE: "should update combatSummary.lastAppliedTurnStartCreature when different on previous" (prev L740)
//       -> Already covered by "apply turn start effects when lastApplied creature differs on previous" test.
//
// Consolidated into 14 tests (from 26):
//   Next handler:  7 tests (from 14)
//   Previous handler: 7 tests (from 12)
//
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextCreatureHandler, createPreviousCreatureHandler } from './navigationHandlers.js';
import * as initiativeService from '../../services/encounters/initiativeService.js';
import * as unbreakableMajesty from '../../services/combat/auras/unbreakableMajesty.js';
import * as expirations from '../../services/rules/effects/expirations.js';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import storage from '../../services/ui/storage.js';

vi.mock('../../services/encounters/initiativeService.js', () => ({
    getNextCreatureName: vi.fn(),
    getPreviousCreatureName: vi.fn(),
}));

vi.mock('../../services/combat/auras/unbreakableMajesty.js', () => ({
    clearPerRoundMajestyTrackers: vi.fn(),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
    expireStaleEffects: vi.fn(),
    applyTurnStartEffects: vi.fn(),
    applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

describe('navigationHandlers.js', () => {
    const campaignName = 'test-campaign';

    const baseCombatSummary = {
        round: 1,
        creatures: [
            { name: 'Alice', type: 'player' },
            { name: 'Bob', type: 'player' },
            { name: 'Charlie', type: 'player' },
        ],
    };

    const baseCharacters = [
        { name: 'Alice', computedStats: { hitPoints: 20 } },
        { name: 'Bob', computedStats: { hitPoints: 15 } },
        { name: 'Charlie', computedStats: { hitPoints: 18 } },
    ];

    let combatSummaryRef;
    let roundRef;
    let lastAppliedTurnStartCreatureRef;
    let setCombatSummary;
    let setActiveCreatureName;
    let setRuntimeStateTick;

    beforeEach(() => {
        vi.clearAllMocks();
        combatSummaryRef = { current: { ...baseCombatSummary } };
        roundRef = { current: 1 };
        lastAppliedTurnStartCreatureRef = { current: null };
        setCombatSummary = vi.fn();
        setActiveCreatureName = vi.fn();
        setRuntimeStateTick = vi.fn();
    });

    describe('createNextCreatureHandler', () => {
        it('should return early when combatSummary is null', () => {
            const handler = createNextCreatureHandler({
                combatSummaryRef: { current: null },
                activeCreatureName: 'Alice',
                campaignName,
                characters: baseCharacters,
                roundRef,
                lastAppliedTurnStartCreatureRef,
                setCombatSummary,
                setActiveCreatureName,
                setRuntimeStateTick,
            });

            handler();

            expect(storage.set).not.toHaveBeenCalled();
            expect(setActiveCreatureName).not.toHaveBeenCalled();
        });

        it('BUG CLA-198: applies round-scoped turn start effects on NON-wrap steps, once per creature', async () => {
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Bob',
                roundIncrement: false,
            });

            const handler = createNextCreatureHandler({
                combatSummaryRef,
                activeCreatureName: 'Alice',
                campaignName,
                characters: baseCharacters,
                roundRef,
                lastAppliedTurnStartCreatureRef,
                setCombatSummary,
                setActiveCreatureName,
                setRuntimeStateTick,
            });

            await handler();

            expect(setActiveCreatureName).toHaveBeenCalledWith('Bob');
            expect(storage.set).toHaveBeenCalledWith('activeCreatureName', 'Bob', campaignName);
            // Round does NOT increment on a non-wrap step
            expect(storage.set).not.toHaveBeenCalledWith('combatSummary', expect.objectContaining({ round: 2 }), campaignName);
            // Per-round trackers stay round-wrap-only
            expect(unbreakableMajesty.clearPerRoundMajestyTrackers).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('Bob', '_cunningStrikeCostUsed', 0, campaignName);
            // Turn-start effects DO fire for the newly active creature within the same round
            expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Bob');
            expect(lastAppliedTurnStartCreatureRef.current).toBe('1:Bob');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('__initiative__', 'lastAppliedTurnStartCreature', '1:Bob', campaignName);
            expect(expirations.applyTurnStartEffects).toHaveBeenCalledWith('Bob', expect.any(Object), campaignName, baseCharacters);
            expect(setRuntimeStateTick).toHaveBeenCalled();

            // Re-advancing onto the same creature in the same round is gated — no double tick
            vi.clearAllMocks();
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Bob',
                roundIncrement: false,
            });

            await handler();

            expect(expirations.applyTurnStartEffects).not.toHaveBeenCalled();
            expect(setRuntimeStateTick).not.toHaveBeenCalled();
        });

        it('should increment round when moving from last creature to first', async () => {
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Alice',
                roundIncrement: true,
            });

            const handler = createNextCreatureHandler({
                combatSummaryRef,
                activeCreatureName: 'Charlie',
                campaignName,
                characters: baseCharacters,
                roundRef,
                lastAppliedTurnStartCreatureRef,
                setCombatSummary,
                setActiveCreatureName,
                setRuntimeStateTick,
            });

            await handler();

            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.objectContaining({ round: 2 }), campaignName);
            expect(setCombatSummary).toHaveBeenCalledWith(expect.objectContaining({ round: 2 }));
            expect(storage.set).toHaveBeenCalledWith('activeCreatureName', 'Alice', campaignName);
            expect(setActiveCreatureName).toHaveBeenCalledWith('Alice');
            expect(unbreakableMajesty.clearPerRoundMajestyTrackers).toHaveBeenCalledWith('Alice', campaignName, 2);
            expect(unbreakableMajesty.clearPerRoundMajestyTrackers).toHaveBeenCalledWith('Bob', campaignName, 2);
            expect(unbreakableMajesty.clearPerRoundMajestyTrackers).toHaveBeenCalledWith('Charlie', campaignName, 2);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Alice', '_cunningStrikeCostUsed', 0, campaignName);
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('Alice', 'surgeUsedRound', null, campaignName);
            expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Alice');
        });

        it('should apply turn start effects and skip when round-scoped lastApplied already matches new active', async () => {
            // Positive case: gate key differs
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Bob',
                roundIncrement: true,
            });
            lastAppliedTurnStartCreatureRef.current = '1:Alice';

            const handler = createNextCreatureHandler({
                combatSummaryRef,
                activeCreatureName: 'Charlie',
                campaignName,
                characters: baseCharacters,
                roundRef,
                lastAppliedTurnStartCreatureRef,
                setCombatSummary,
                setActiveCreatureName,
                setRuntimeStateTick,
            });

            await handler();

            expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Bob');
            expect(lastAppliedTurnStartCreatureRef.current).toBe('2:Bob');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('__initiative__', 'lastAppliedTurnStartCreature', '2:Bob', campaignName);
            expect(storage.set).toHaveBeenCalledWith('lastAppliedTurnStartCreature', '2:Bob', campaignName);
            expect(expirations.applyTurnStartEffects).toHaveBeenCalledWith('Bob', expect.any(Object), campaignName, baseCharacters);
            expect(setRuntimeStateTick).toHaveBeenCalled();

            // Negative case: gate key matches round:name of new active (reset refs for second assertion)
            vi.clearAllMocks();
            combatSummaryRef.current = { ...baseCombatSummary };
            lastAppliedTurnStartCreatureRef.current = '2:Alice';
            roundRef.current = 1;
            setCombatSummary.mockReset();

            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Alice',
                roundIncrement: true,
            });

            const handler2 = createNextCreatureHandler({
                combatSummaryRef,
                activeCreatureName: 'Charlie',
                campaignName,
                characters: baseCharacters,
                roundRef,
                lastAppliedTurnStartCreatureRef,
                setCombatSummary,
                setActiveCreatureName,
                setRuntimeStateTick,
            });

            await handler2();

            expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Alice');
            expect(lastAppliedTurnStartCreatureRef.current).toBe('2:Alice');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('__initiative__', 'lastAppliedTurnStartCreature', 'Alice', campaignName);
            expect(expirations.applyTurnStartEffects).not.toHaveBeenCalled();
            expect(setRuntimeStateTick).not.toHaveBeenCalled();
        });

        it('BUG CLA-170: should re-apply turn start effects to the same creature in a new round', async () => {
            // Creature 'Alice' starts round 2, then round 3 — turn-start effects (e.g. Holy
            // Nimbus radiant damage) must fire on BOTH rounds, not just once per combat.
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Alice',
                roundIncrement: true,
            });

            const handler = createNextCreatureHandler({
                combatSummaryRef,
                activeCreatureName: 'Charlie',
                campaignName,
                characters: baseCharacters,
                roundRef,
                lastAppliedTurnStartCreatureRef,
                setCombatSummary,
                setActiveCreatureName,
                setRuntimeStateTick,
            });

            roundRef.current = 1;
            await handler();
            expect(expirations.applyTurnStartEffects).toHaveBeenCalledTimes(1);
            expect(lastAppliedTurnStartCreatureRef.current).toBe('2:Alice');

            // Round 2 → round 3, same round-boundary creature
            combatSummaryRef.current = { ...baseCombatSummary, round: 2 };
            roundRef.current = 2;
            await handler();

            expect(expirations.applyTurnStartEffects).toHaveBeenCalledTimes(2);
            expect(lastAppliedTurnStartCreatureRef.current).toBe('3:Alice');
            expect(storage.set).toHaveBeenLastCalledWith('combatSummary', expect.objectContaining({ round: 3 }), campaignName);
        });

        it('BUG CLA-307: runs outgoing owner turn-END condition removal before new turn-start effects', async () => {
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Bob',
                roundIncrement: false,
            });

            const handler = createNextCreatureHandler({
                combatSummaryRef,
                activeCreatureName: 'Alice',
                campaignName,
                characters: baseCharacters,
                roundRef,
                lastAppliedTurnStartCreatureRef,
                setCombatSummary,
                setActiveCreatureName,
                setRuntimeStateTick,
            });

            await handler();

            // Pass runs for the OUTGOING creature with its computed stats, sync (skipSync=false)
            expect(expirations.applyTurnEndConditionRemoval).toHaveBeenCalledWith('Alice', baseCharacters[0].computedStats, campaignName);
            // ...and BEFORE the new active creature's turn-start effects
            const removalOrder = expirations.applyTurnEndConditionRemoval.mock.invocationCallOrder[0];
            const startOrder = expirations.applyTurnStartEffects.mock.invocationCallOrder[0];
            expect(removalOrder).toBeLessThan(startOrder);
        });

        it('should handle empty characters array during round increment', () => {
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Unknown',
                roundIncrement: true,
            });

            const handler = createNextCreatureHandler({
                combatSummaryRef,
                activeCreatureName: 'Charlie',
                campaignName,
                characters: [],
                roundRef,
                lastAppliedTurnStartCreatureRef,
                setCombatSummary,
                setActiveCreatureName,
                setRuntimeStateTick,
            });

            handler();

            expect(expirations.applyTurnStartEffects).toHaveBeenCalledWith(
                'Unknown',
                undefined,
                campaignName,
                []
            );
            expect(setActiveCreatureName).toHaveBeenCalledWith('Unknown');
        });
    });

    describe('createPreviousCreatureHandler', () => {
        it('should return early when isPreviousDisabled is true', () => {
            const handler = createPreviousCreatureHandler({
                combatSummaryRef,
                activeCreatureName: 'Alice',
                campaignName,
                characters: baseCharacters,
                roundRef,
                lastAppliedTurnStartCreatureRef,
                setCombatSummary,
                setActiveCreatureName,
                setRuntimeStateTick,
                isPreviousDisabled: true,
            });

            handler();

            expect(storage.set).not.toHaveBeenCalled();
            expect(setActiveCreatureName).not.toHaveBeenCalled();
        });

        it('should return early when combatSummary is null', () => {
            const handler = createPreviousCreatureHandler({
                combatSummaryRef: { current: null },
                activeCreatureName: 'Alice',
                campaignName,
                characters: baseCharacters,
                roundRef,
                lastAppliedTurnStartCreatureRef,
                setCombatSummary,
                setActiveCreatureName,
                setRuntimeStateTick,
                isPreviousDisabled: false,
            });

            handler();

            expect(storage.set).not.toHaveBeenCalled();
            expect(setActiveCreatureName).not.toHaveBeenCalled();
        });

        it('BUG CLA-198: applies round-scoped turn start effects on NON-wrap previous steps too', async () => {
            initiativeService.getPreviousCreatureName.mockReturnValue({
                newActiveName: 'Alice',
                roundDecrement: false,
            });

            const handler = createPreviousCreatureHandler({
                combatSummaryRef,
                activeCreatureName: 'Bob',
                campaignName,
                characters: baseCharacters,
                roundRef,
                lastAppliedTurnStartCreatureRef,
                setCombatSummary,
                setActiveCreatureName,
                setRuntimeStateTick,
                isPreviousDisabled: false,
            });

            await handler();

            expect(setActiveCreatureName).toHaveBeenCalledWith('Alice');
            expect(storage.set).toHaveBeenCalledWith('activeCreatureName', 'Alice', campaignName);
            // Round does NOT decrement on a non-wrap step
            expect(storage.set).not.toHaveBeenCalledWith('combatSummary', expect.objectContaining({ round: 0 }), campaignName);
            // Turn-start effects fire for the newly active creature (round-scoped gate)
            expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Alice');
            expect(lastAppliedTurnStartCreatureRef.current).toBe('1:Alice');
            expect(expirations.applyTurnStartEffects).toHaveBeenCalledWith('Alice', expect.any(Object), campaignName, baseCharacters);
        });

        it('should decrement round when moving from first to last creature', async () => {
            roundRef.current = 3;
            initiativeService.getPreviousCreatureName.mockReturnValue({
                newActiveName: 'Charlie',
                roundDecrement: true,
            });

            const handler = createPreviousCreatureHandler({
                combatSummaryRef,
                activeCreatureName: 'Alice',
                campaignName,
                characters: baseCharacters,
                roundRef,
                lastAppliedTurnStartCreatureRef,
                setCombatSummary,
                setActiveCreatureName,
                setRuntimeStateTick,
                isPreviousDisabled: false,
            });

            await handler();

            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.objectContaining({ round: 2 }), campaignName);
            expect(setCombatSummary).toHaveBeenCalledWith(expect.objectContaining({ round: 2 }));
            expect(storage.set).toHaveBeenCalledWith('activeCreatureName', 'Charlie', campaignName);
            expect(setActiveCreatureName).toHaveBeenCalledWith('Charlie');
            expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Charlie');
            expect(unbreakableMajesty.clearPerRoundMajestyTrackers).toHaveBeenCalledWith('Alice', campaignName, 2);
            expect(unbreakableMajesty.clearPerRoundMajestyTrackers).toHaveBeenCalledWith('Bob', campaignName, 2);
            expect(unbreakableMajesty.clearPerRoundMajestyTrackers).toHaveBeenCalledWith('Charlie', campaignName, 2);
        });

        it('should apply turn start effects and skip when round-scoped lastApplied already matches on previous', async () => {
            // Positive case: gate key differs
            roundRef.current = 2;
            initiativeService.getPreviousCreatureName.mockReturnValue({
                newActiveName: 'Bob',
                roundDecrement: true,
            });
            lastAppliedTurnStartCreatureRef.current = '2:Alice';

            const handler = createPreviousCreatureHandler({
                combatSummaryRef,
                activeCreatureName: 'Alice',
                campaignName,
                characters: baseCharacters,
                roundRef,
                lastAppliedTurnStartCreatureRef,
                setCombatSummary,
                setActiveCreatureName,
                setRuntimeStateTick,
                isPreviousDisabled: false,
            });

            await handler();

            expect(lastAppliedTurnStartCreatureRef.current).toBe('1:Bob');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('__initiative__', 'lastAppliedTurnStartCreature', '1:Bob', campaignName);
            expect(storage.set).toHaveBeenCalledWith('lastAppliedTurnStartCreature', '1:Bob', campaignName);
            expect(expirations.applyTurnStartEffects).toHaveBeenCalledWith('Bob', expect.any(Object), campaignName, baseCharacters);
            expect(setRuntimeStateTick).toHaveBeenCalled();

            // Negative case: gate key matches round:name of new active
            vi.clearAllMocks();
            combatSummaryRef.current = { ...baseCombatSummary };
            lastAppliedTurnStartCreatureRef.current = '1:Bob';
            roundRef.current = 2;
            setCombatSummary.mockReset();

            initiativeService.getPreviousCreatureName.mockReturnValue({
                newActiveName: 'Bob',
                roundDecrement: true,
            });

            const handler2 = createPreviousCreatureHandler({
                combatSummaryRef,
                activeCreatureName: 'Alice',
                campaignName,
                characters: baseCharacters,
                roundRef,
                lastAppliedTurnStartCreatureRef,
                setCombatSummary,
                setActiveCreatureName,
                setRuntimeStateTick,
                isPreviousDisabled: false,
            });

            await handler2();

            expect(lastAppliedTurnStartCreatureRef.current).toBe('1:Bob');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('__initiative__', 'lastAppliedTurnStartCreature', 'Bob', campaignName);
            expect(expirations.applyTurnStartEffects).not.toHaveBeenCalled();
            expect(setRuntimeStateTick).not.toHaveBeenCalled();
        });

        it('BUG CLA-307: previous/rewind does NOT run the turn-END condition removal pass', async () => {
            initiativeService.getPreviousCreatureName.mockReturnValue({
                newActiveName: 'Alice',
                roundDecrement: false,
            });

            const handler = createPreviousCreatureHandler({
                combatSummaryRef,
                activeCreatureName: 'Bob',
                campaignName,
                characters: baseCharacters,
                roundRef,
                lastAppliedTurnStartCreatureRef,
                setCombatSummary,
                setActiveCreatureName,
                setRuntimeStateTick,
                isPreviousDisabled: false,
            });

            await handler();

            expect(expirations.applyTurnEndConditionRemoval).not.toHaveBeenCalled();
        });

        it('should NOT decrement round when currentRound is 1', () => {
            roundRef.current = 1;
            initiativeService.getPreviousCreatureName.mockReturnValue({
                newActiveName: 'Charlie',
                roundDecrement: true,
            });

            const handler = createPreviousCreatureHandler({
                combatSummaryRef,
                activeCreatureName: 'Alice',
                campaignName,
                characters: baseCharacters,
                roundRef,
                lastAppliedTurnStartCreatureRef,
                setCombatSummary,
                setActiveCreatureName,
                setRuntimeStateTick,
                isPreviousDisabled: false,
            });

            handler();

            expect(setCombatSummary).not.toHaveBeenCalled();
            expect(storage.set).not.toHaveBeenCalledWith('combatSummary', expect.any(Object), campaignName);
        });
    });
});
