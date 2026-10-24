// @maintained-by-ai
// MA-1966 infra lane: the persisted combatSummary.activeCreatureName MIRROR must move on
// EVERY tracker step (Next and Previous). Pre-fix, createNextCreatureHandler persisted a
// cloneDeep of the summary whose activeCreatureName never moved (only the top-level storage
// key did), freezing the boundary stamp legendaryExpendGate reads via getCombatContext.
// This lane asserts the exact persisted payload bytes — including the cache copy adopted
// from turn-start effects, which must be re-stamped before the POST.
//
// Seam distinctness (cite, don't clone):
//   - navigationHandlers.test.jsx    → round increments, turn-start gate, round-wrap
//                                        housekeeping (clearPerRoundMajestyTrackers, gate keys,
//                                        CLA-198/170/307), null-summary/disabled early returns.
//   - navigationHandlers.wm008-vex-latch.test.js → campaign _Vex_appliedTarget at round wrap.
//   - navigationHandlers.mn013-parry-latch.test.js → _Parry_usedRound round-wrap re-arm.
//   - initiative-init-rolled-handler.test.jsx (#864) → round-flag clears at the
//                                        initiative-rolled seam (different trigger).
// Old → new map:
//   "mid-round step advances the persisted stamp"          → strengthened to exact payload
//   "round-wrap step stamps round AND the wrap creature"   → strengthened to exact payload
//   "stamp survives the turn-start cache-copy adoption"    → strengthened to exact payload
//   "consecutive steps keep the stamp fresh"               → REDUNDANT: two independent
//                                        mid-round steps, each a repeat of test 1 through a
//                                        fresh handler instance with no shared state.
//   "guards: round-wrap housekeeping...keep firing"        → REDUNDANT: every assertion is
//                                        owned by navigationHandlers.test.jsx (majesty :191,
//                                        gate key :211, turn-start :163) — different seam.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNextCreatureHandler, createPreviousCreatureHandler } from './navigationHandlers.js';
import * as initiativeService from '../../services/encounters/initiativeService.js';
import { getCombatSummary } from '../../services/encounters/combatData.js';
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
    // L5-001: navigationHandlers reads enforcement via getRuntimeValue; null ⇒ off (legacy behavior).
    getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
    getCombatSummary: vi.fn(() => null),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: {
        get: vi.fn(),
        set: vi.fn(),
        getProperty: vi.fn(),
        setProperty: vi.fn(),
    },
}));

describe('navigationHandlers active-creature boundary stamp (MA-1966 infra)', () => {
    const campaignName = 'test-campaign';

    // cs carries a BAKED activeCreatureName — pre-fix every persist re-baked it stale.
    const baseCombatSummary = {
        round: 1,
        activeCreatureName: 'Alice',
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

    const nextArgs = (activeCreatureName) => ({
        combatSummaryRef,
        activeCreatureName,
        campaignName,
        characters: baseCharacters,
        roundRef,
        lastAppliedTurnStartCreatureRef,
        setCombatSummary,
        setActiveCreatureName,
        setRuntimeStateTick,
    });

    beforeEach(() => {
        vi.clearAllMocks();
        getCombatSummary.mockReturnValue(null);
        combatSummaryRef = { current: { ...baseCombatSummary } };
        roundRef = { current: 1 };
        lastAppliedTurnStartCreatureRef = { current: null };
        setCombatSummary = vi.fn();
        setActiveCreatureName = vi.fn();
        setRuntimeStateTick = vi.fn();
    });

    describe('createNextCreatureHandler', () => {
        it('mid-round step persists the exact summary with the LIVE stamp (not the baked one)', async () => {
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Bob',
                roundIncrement: false,
            });

            await createNextCreatureHandler(nextArgs('Alice'))();

            // The full persisted payload, byte-exact: cloned cs would have re-baked
            // activeCreatureName 'Alice' — the gate must see 'Bob' round 1.
            const persisted = {
                round: 1,
                activeCreatureName: 'Bob',
                lastAppliedTurnStartCreature: '1:Bob',
                creatures: [
                    { name: 'Alice', type: 'player' },
                    { name: 'Bob', type: 'player' },
                    { name: 'Charlie', type: 'player' },
                ],
            };
            expect(storage.set).toHaveBeenCalledWith('combatSummary', persisted, campaignName);
            expect(setCombatSummary).toHaveBeenCalledWith(persisted);
        });

        it('round-wrap step persists round 2 AND the wrap creature on the stamp', async () => {
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Alice',
                roundIncrement: true,
            });

            await createNextCreatureHandler(nextArgs('Charlie'))();

            const persisted = {
                round: 2,
                activeCreatureName: 'Alice',
                lastAppliedTurnStartCreature: '2:Alice',
                creatures: [
                    { name: 'Alice', type: 'player' },
                    { name: 'Bob', type: 'player' },
                    { name: 'Charlie', type: 'player' },
                ],
            };
            expect(storage.set).toHaveBeenCalledWith('combatSummary', persisted, campaignName);
            expect(setCombatSummary).toHaveBeenCalledWith(persisted);
        });

        it('stamp survives cache-copy adoption — a stale getCombatSummary mirror is re-stamped before persist', async () => {
            initiativeService.getNextCreatureName.mockReturnValue({
                newActiveName: 'Bob',
                roundIncrement: false,
            });
            // applyTurnStartGate adopts getCombatSummary(campaignName) when non-null;
            // pre-fix the adopted copy's baked boundary shipped straight to the POST.
            getCombatSummary.mockReturnValue({
                round: 1,
                activeCreatureName: 'StaleCopyCreature',
                creatures: [
                    { name: 'Alice', type: 'player' },
                    { name: 'Bob', type: 'player' },
                    { name: 'Charlie', type: 'player' },
                ],
            });

            await createNextCreatureHandler(nextArgs('Alice'))();

            // Exact payload: the adopted copy verbatim EXCEPT the re-stamped boundary.
            expect(storage.set).toHaveBeenCalledWith('combatSummary', {
                round: 1,
                activeCreatureName: 'Bob',
                creatures: [
                    { name: 'Alice', type: 'player' },
                    { name: 'Bob', type: 'player' },
                    { name: 'Charlie', type: 'player' },
                ],
            }, campaignName);
            expect(setCombatSummary).toHaveBeenCalledWith({
                round: 1,
                activeCreatureName: 'Bob',
                creatures: [
                    { name: 'Alice', type: 'player' },
                    { name: 'Bob', type: 'player' },
                    { name: 'Charlie', type: 'player' },
                ],
            });
        });
    });

    describe('createPreviousCreatureHandler', () => {
        it('rewind step persists the exact summary with the rewound stamp', async () => {
            initiativeService.getPreviousCreatureName.mockReturnValue({
                newActiveName: 'Alice',
                roundDecrement: false,
            });

            await createPreviousCreatureHandler({
                ...nextArgs('Bob'),
                isPreviousDisabled: false,
            })();

            const persisted = {
                round: 1,
                activeCreatureName: 'Alice',
                lastAppliedTurnStartCreature: '1:Alice',
                creatures: [
                    { name: 'Alice', type: 'player' },
                    { name: 'Bob', type: 'player' },
                    { name: 'Charlie', type: 'player' },
                ],
            };
            expect(storage.set).toHaveBeenCalledWith('combatSummary', persisted, campaignName);
            expect(setCombatSummary).toHaveBeenCalledWith(persisted);
        });

        it('rewind across round wrap persists decremented round + rewound stamp', async () => {
            roundRef.current = 2;
            combatSummaryRef.current = { ...baseCombatSummary, round: 2 };
            initiativeService.getPreviousCreatureName.mockReturnValue({
                newActiveName: 'Charlie',
                roundDecrement: true,
            });

            await createPreviousCreatureHandler({
                ...nextArgs('Alice'),
                isPreviousDisabled: false,
            })();

            const persisted = {
                round: 1,
                activeCreatureName: 'Charlie',
                lastAppliedTurnStartCreature: '1:Charlie',
                creatures: [
                    { name: 'Alice', type: 'player' },
                    { name: 'Bob', type: 'player' },
                    { name: 'Charlie', type: 'player' },
                ],
            };
            expect(storage.set).toHaveBeenCalledWith('combatSummary', persisted, campaignName);
            expect(setCombatSummary).toHaveBeenCalledWith(persisted);
        });
    });
});
