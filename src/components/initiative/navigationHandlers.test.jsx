// @maintained-by-ai
//
// Base owner of navigationHandlers' dispatch contract: turn-step persistence, round-wrap vs
// non-wrap housekeeping, the round-scoped turn-start gate (CLA-198/CLA-170/CLA-307), and the
// early-return guards for the next/previous handler factories. Enforcement off (getRuntimeValue
// ⇒ null) ⇒ zero turnState writes (L5-001 legacy parity). Zero-network: every collaborator that
// would touch the wire is mocked; getCombatSummary is a pure in-memory cache read.
//
// Family map — cut with cites, do NOT re-test here:
//   byte-exact persisted combatSummary stamps  → navigationHandlers.active-creature-stamp.test.jsx (#866)
//   _Parry_usedRound round-wrap re-arm         → navigationHandlers.mn013-parry-latch.test.js (#867)
//   _Vex_appliedTarget round-wrap re-arm       → navigationHandlers.wm008-vex-latch.test.js (WM-008)
//   initiative-rolled round-flag clears        → initiative-init-rolled-handler.test.jsx (#864)
//   container DOM Prev/Next clicks             → Initiative container lane (#865)
//
// KEYDOWN ruling: the keydown listener attaches to window at Initiative.jsx:564 (container DOM
// layer). navigationHandlers.js exports pure handler factories with no DOM access, so keydown
// wiring can never be claimed in this factory-level file; container #865's forward-cite should
// be re-homed to initiative-callbacks.test.jsx, which already mounts Initiative and owns its
// window-event listeners (reported, not implemented — out of scope here).
//
// Cited-face map (canonical assertion bytes preserved byte-intact; old → new line):
//   :158 → 158  _cunningStrikeCostUsed NOT reset on non-wrap steps
//   :163 → 163  applyTurnStartEffects invocation seam
//   :203 → 191  clearPerRoundMajestyTrackers round-wrap seam
//   :235 → 211  __initiative__ lastAppliedTurnStartCreature gate-key persist
//
// Trims this pass (14 → 11): prev's separate gate-match test folded into the CLA-198 prev lane
// as a natural double-step dedupe (mirrors the next lane's re-advance guard); prev's
// standalone no-turn-end-pass test folded into CLA-198 prev (non-wrap) + round-decrement
// (wrap) lanes; prev's two early-return guards (disabled / null summary) merged into one test.
//
// #868 FLIP (round-1 rewind floor): the pinned "complete no-op" is now the lawful
// initiative_rewind_refused arm in navigationHandlers.js — refusal log exact-bytes + still
// zero state writes; legal steps additionally pinned refusal-log-free (addEntry not called).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextCreatureHandler, createPreviousCreatureHandler } from './navigationHandlers.js';
import * as initiativeService from '../../services/encounters/initiativeService.js';
import * as unbreakableMajesty from '../../services/combat/auras/unbreakableMajesty.js';
import * as expirations from '../../services/rules/effects/expirations.js';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';
import storage from '../../services/ui/storage.js';
import { addEntry } from '../../services/ui/logService.js';

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
    // L5-001: navigationHandlers reads enforcement via getRuntimeValue; null ⇒ off (legacy behavior).
    getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

// #868 FLIP: the round-1 rewind floor is no longer a silent no-op — navigationHandlers
// refuses it with one campaign-log entry (fix#79 refusal family). Zero-network maintained.
vi.mock('../../services/ui/logService.js', () => ({
    addEntry: vi.fn(() => Promise.resolve()),
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

    // Fresh fixture per step (#771); refs/setters flow through the closure so ref-seeded
    // scenarios stay explicit at the call site.
    const makeNext = (overrides = {}) => createNextCreatureHandler({
        combatSummaryRef,
        activeCreatureName: 'Alice',
        campaignName,
        characters: baseCharacters,
        roundRef,
        lastAppliedTurnStartCreatureRef,
        setCombatSummary,
        setActiveCreatureName,
        setRuntimeStateTick,
        ...overrides,
    });

    const makePrevious = (overrides = {}) => createPreviousCreatureHandler({
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
        ...overrides,
    });

    describe('createNextCreatureHandler', () => {
        it('should return early when combatSummary is null', () => {
            makeNext({ combatSummaryRef: { current: null } })();

            expect(storage.set).not.toHaveBeenCalled();
            expect(setActiveCreatureName).not.toHaveBeenCalled();
            expect(setCombatSummary).not.toHaveBeenCalled();
            expect(setRuntimeStateTick).not.toHaveBeenCalled();
        });

        it('BUG CLA-198: applies round-scoped turn start effects on NON-wrap steps, once per creature', async () => {
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Bob',
                roundIncrement: false,
            });

            await makeNext()();

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

            await makeNext()();

            expect(expirations.applyTurnStartEffects).not.toHaveBeenCalled();
            expect(setRuntimeStateTick).not.toHaveBeenCalled();
        });

        it('should increment round when moving from last creature to first', async () => {
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Alice',
                roundIncrement: true,
            });

            await makeNext({ activeCreatureName: 'Charlie' })();

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

            await makeNext({ activeCreatureName: 'Charlie' })();

            expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Bob');
            expect(lastAppliedTurnStartCreatureRef.current).toBe('2:Bob');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('__initiative__', 'lastAppliedTurnStartCreature', '2:Bob', campaignName);
            expect(storage.set).toHaveBeenCalledWith('lastAppliedTurnStartCreature', '2:Bob', campaignName);
            expect(expirations.applyTurnStartEffects).toHaveBeenCalledWith('Bob', expect.any(Object), campaignName, baseCharacters);
            expect(setRuntimeStateTick).toHaveBeenCalled();

            // Negative case: gate key matches round:name of new active
            vi.clearAllMocks();
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Alice',
                roundIncrement: true,
            });
            combatSummaryRef.current = { ...baseCombatSummary };
            lastAppliedTurnStartCreatureRef.current = '2:Alice';
            roundRef.current = 1;

            await makeNext({ activeCreatureName: 'Charlie' })();

            expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Alice');
            expect(lastAppliedTurnStartCreatureRef.current).toBe('2:Alice');
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('__initiative__', 'lastAppliedTurnStartCreature', '2:Alice', campaignName);
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

            const handler = makeNext({ activeCreatureName: 'Charlie' });

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

            await makeNext()();

            // Pass runs for the OUTGOING creature with its computed stats, sync (skipSync=false)
            expect(expirations.applyTurnEndConditionRemoval).toHaveBeenCalledWith('Alice', baseCharacters[0].computedStats, campaignName);
            // ...and BEFORE the new active creature's turn-start effects
            const removalOrder = expirations.applyTurnEndConditionRemoval.mock.invocationCallOrder[0];
            const startOrder = expirations.applyTurnStartEffects.mock.invocationCallOrder[0];
            expect(removalOrder).toBeLessThan(startOrder);
        });

        it('should still run turn start effects for a creature absent from the characters roster', async () => {
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Unknown',
                roundIncrement: true,
            });

            await makeNext({ activeCreatureName: 'Charlie', characters: [] })();

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
        it('should return early when disabled or combatSummary is null', () => {
            makePrevious({ isPreviousDisabled: true })();

            expect(storage.set).not.toHaveBeenCalled();
            expect(setActiveCreatureName).not.toHaveBeenCalled();
            // Disabled arm stays silent — the greyed button is the acknowledgment (no log spam).
            expect(addEntry).not.toHaveBeenCalled();

            vi.clearAllMocks();
            makePrevious({ combatSummaryRef: { current: null } })();

            expect(storage.set).not.toHaveBeenCalled();
            expect(setActiveCreatureName).not.toHaveBeenCalled();
            expect(setCombatSummary).not.toHaveBeenCalled();
            expect(initiativeService.getPreviousCreatureName).not.toHaveBeenCalled();
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('BUG CLA-198: applies round-scoped turn start effects on NON-wrap previous steps too, once per creature', async () => {
            initiativeService.getPreviousCreatureName.mockReturnValue({
                newActiveName: 'Alice',
                roundDecrement: false,
            });

            const handler = makePrevious({ activeCreatureName: 'Bob' });
            await handler();

            expect(setActiveCreatureName).toHaveBeenCalledWith('Alice');
            expect(storage.set).toHaveBeenCalledWith('activeCreatureName', 'Alice', campaignName);
            // Round does NOT decrement on a non-wrap step
            expect(storage.set).not.toHaveBeenCalledWith('combatSummary', expect.objectContaining({ round: 0 }), campaignName);
            // Turn-start effects fire for the newly active creature (round-scoped gate)
            expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Alice');
            expect(lastAppliedTurnStartCreatureRef.current).toBe('1:Alice');
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith('__initiative__', 'lastAppliedTurnStartCreature', '1:Alice', campaignName);
            expect(expirations.applyTurnStartEffects).toHaveBeenCalledWith('Alice', expect.any(Object), campaignName, baseCharacters);
            expect(setRuntimeStateTick).toHaveBeenCalled();
            // Previous-lane quirk: rewind re-arms majesty trackers on EVERY step,
            // unlike next where they are round-wrap-only (:203 canonical seam above).
            expect(unbreakableMajesty.clearPerRoundMajestyTrackers).toHaveBeenCalledWith('Alice', campaignName, 1);
            // BUG CLA-307: rewinding never runs the turn-END condition removal pass.
            expect(expirations.applyTurnEndConditionRemoval).not.toHaveBeenCalled();
            // Legal within-round back-step (creatures[index-1]) — no refusal feedback leaks.
            expect(addEntry).not.toHaveBeenCalled();

            // Re-stepping onto a creature whose gate key already matches is gated — no double tick
            vi.clearAllMocks();
            initiativeService.getPreviousCreatureName.mockReturnValue({
                newActiveName: 'Alice',
                roundDecrement: false,
            });

            await handler();

            expect(expirations.applyTurnStartEffects).not.toHaveBeenCalled();
            expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('__initiative__', 'lastAppliedTurnStartCreature', '1:Alice', campaignName);
            expect(lastAppliedTurnStartCreatureRef.current).toBe('1:Alice');
            expect(setRuntimeStateTick).not.toHaveBeenCalled();
        });

        it('should decrement round when moving from first to last creature', async () => {
            roundRef.current = 3;
            initiativeService.getPreviousCreatureName.mockReturnValue({
                newActiveName: 'Charlie',
                roundDecrement: true,
            });

            await makePrevious({ activeCreatureName: 'Alice' })();

            expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.objectContaining({ round: 2 }), campaignName);
            expect(setCombatSummary).toHaveBeenCalledWith(expect.objectContaining({ round: 2 }));
            expect(storage.set).toHaveBeenCalledWith('activeCreatureName', 'Charlie', campaignName);
            expect(setActiveCreatureName).toHaveBeenCalledWith('Charlie');
            expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Charlie');
            expect(unbreakableMajesty.clearPerRoundMajestyTrackers).toHaveBeenCalledWith('Alice', campaignName, 2);
            expect(unbreakableMajesty.clearPerRoundMajestyTrackers).toHaveBeenCalledWith('Bob', campaignName, 2);
            expect(unbreakableMajesty.clearPerRoundMajestyTrackers).toHaveBeenCalledWith('Charlie', campaignName, 2);
            // BUG CLA-307: a wrap rewind is still not a real turn end — no turn-END pass.
            expect(expirations.applyTurnEndConditionRemoval).not.toHaveBeenCalled();
            // Round 3 → 2 wrap is a LEGAL rewind — no refusal feedback on valid steps.
            expect(addEntry).not.toHaveBeenCalled();
        });

        it('#868 FLIP: refuses loudly at the round-1 floor — exact refusal log, still zero state writes', async () => {
            roundRef.current = 1;
            initiativeService.getPreviousCreatureName.mockReturnValue({
                newActiveName: 'Charlie',
                roundDecrement: true,
            });

            await makePrevious({ activeCreatureName: 'Alice' })();

            // No-silent-no-op law (fix#79 refusal family): the floor click acknowledges
            // itself with exactly ONE refused-log byte, <feature>_refused convention.
            expect(addEntry).toHaveBeenCalledTimes(1);
            expect(addEntry).toHaveBeenCalledWith(campaignName, {
                type: 'automation',
                automationType: 'initiative_rewind_refused',
                characterName: 'Alice',
                description: 'Initiative rewind refused — at_start_of_round_1: round 1 is the first round, there is no earlier turn to rewind to.',
            });
            // The refusal arm still writes NOTHING else — pointer, round, effects untouched
            // (there is no round-0 last creature to rewind onto; NO-CLOCK: no time moves).
            expect(storage.set).not.toHaveBeenCalled();
            expect(setCombatSummary).not.toHaveBeenCalled();
            expect(setActiveCreatureName).not.toHaveBeenCalled();
            expect(setRuntimeStateTick).not.toHaveBeenCalled();
            expect(expirations.expireStaleEffects).not.toHaveBeenCalled();
        });
    });
});
