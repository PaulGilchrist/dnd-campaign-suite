import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSseEventHandler } from './sseHandlers.js';
import * as combatData from '../../services/encounters/combatData.js';
import * as expirations from '../../services/rules/effects/expirations.js';
import * as runtimeState from '../../hooks/runtime/useRuntimeState.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(),
}));
vi.mock('../../services/encounters/combatData.js', () => ({
    getActiveCreatureName: vi.fn(() => null),
    getCombatSummary: vi.fn(() => null),
    setCombatSummaryCache: vi.fn(),
}));
vi.mock('../../services/rules/effects/expirations.js', () => ({
    expireStaleEffects: vi.fn(),
    applyTurnStartEffects: vi.fn(),
    applyTurnEndConditionRemoval: vi.fn(() => Promise.resolve()),
}));

describe('createSseEventHandler', () => {
    let handler;
    let refs;
    let mocks;

    const campaignName = 'test-campaign';
    const characters = [
        { name: 'Alice', computedStats: { hitPoints: 20 } },
        { name: 'Bob', computedStats: { hitPoints: 15 } },
    ];

    beforeEach(() => {
        vi.clearAllMocks();

        refs = {
            combatSummaryRef: { current: { round: 1, creatures: [{ name: 'Alice', type: 'player' }] } },
            activeCreatureNameRef: { current: 'Alice' },
            lastAppliedTurnStartCreatureRef: { current: null },
        };

        mocks = {
            setCombatSummary: vi.fn(),
            setCombatSummaryG: vi.fn(),
            setActiveCreatureNameG: vi.fn(),
            setRuntimeStateTick: vi.fn(),
            handleOverlayEvent: vi.fn(),
        };

        handler = createSseEventHandler({
            campaignName,
            characters,
            combatSummaryRef: refs.combatSummaryRef,
            activeCreatureNameRef: refs.activeCreatureNameRef,
            lastAppliedTurnStartCreatureRef: refs.lastAppliedTurnStartCreatureRef,
            setCombatSummary: mocks.setCombatSummary,
            setCombatSummaryG: mocks.setCombatSummaryG,
            setActiveCreatureNameG: mocks.setActiveCreatureNameG,
            setRuntimeStateTick: mocks.setRuntimeStateTick,
            handleOverlayEvent: mocks.handleOverlayEvent,
        });
    });

    // ---- Early returns / routing ----

    describe('early returns', () => {
        it('should return early when event.key or event.data is nullish', () => {
            handler({ key: null, data: null });
            expect(mocks.setCombatSummary).not.toHaveBeenCalled();
            handler({ key: undefined, data: null });
            expect(mocks.setCombatSummary).not.toHaveBeenCalled();
        });

        it('should delegate spell-overlay events to handleOverlayEvent and return', () => {
            const overlayEvent = { key: 'spell-overlay-test-campaign', data: { action: 'clear' } };
            handler(overlayEvent);
            expect(mocks.handleOverlayEvent).toHaveBeenCalledWith(overlayEvent);
        });

        it('should ignore non-matching campaign prefix', () => {
            handler({ key: 'change-other-campaign-combatSummary', data: { creatures: [] } });
            expect(mocks.setCombatSummary).not.toHaveBeenCalled();
        });
    });

    // ---- combatSummary handling ----

    describe('combatSummary dataKey', () => {
        const baseCombatSummary = { round: 2, creatures: [{ name: 'Alice', type: 'player' }] };

        it('should skip when event.data has no creatures or creatures is undefined', () => {
            handler({ key: 'change-test-campaign-combatSummary', data: { round: 2 } });
            expect(mocks.setCombatSummaryG).not.toHaveBeenCalled();
            handler({ key: 'change-test-campaign-combatSummary', data: { round: 2, creatures: undefined } });
            expect(mocks.setCombatSummaryG).not.toHaveBeenCalled();
        });

        it('should process event.data with empty creatures array', () => {
            handler({ key: 'change-test-campaign-combatSummary', data: { round: 2, creatures: [] } });
            expect(mocks.setCombatSummaryG).toHaveBeenCalled();
        });

        it('should process a valid combatSummary event', () => {
            handler({ key: 'change-test-campaign-combatSummary', data: baseCombatSummary });
            expect(mocks.setCombatSummaryG).toHaveBeenCalledWith(
                expect.objectContaining({ round: 2, creatures: [{ name: 'Alice', type: 'player' }] }),
            );
        });

        it('should fill in activeCreatureName from getActiveCreatureName when missing', () => {
            combatData.getActiveCreatureName.mockReturnValue('Bob');
            const data = { round: 2, creatures: [{ name: 'Alice', type: 'player' }] };
            handler({ key: 'change-test-campaign-combatSummary', data });
            expect(mocks.setCombatSummaryG).toHaveBeenCalledWith(
                expect.objectContaining({ activeCreatureName: 'Bob' }),
            );
        });

        it('should not override existing activeCreatureName from event data', () => {
            const data = { round: 2, creatures: [{ name: 'Alice', type: 'player' }], activeCreatureName: 'Alice' };
            handler({ key: 'change-test-campaign-combatSummary', data });
            expect(mocks.setCombatSummaryG).toHaveBeenCalledWith(
                expect.objectContaining({ activeCreatureName: 'Alice' }),
            );
            expect(combatData.getActiveCreatureName).not.toHaveBeenCalled();
        });

        it('should skip when merged.round < prevRound (round regression)', () => {
            refs.combatSummaryRef.current = { round: 5, creatures: [] };
            handler({ key: 'change-test-campaign-combatSummary', data: { round: 3, creatures: [] } });
            expect(mocks.setCombatSummaryG).not.toHaveBeenCalled();
        });

        it('should use combatSummaryRef.current.round default of 1 when ref is nullish', () => {
            refs.combatSummaryRef.current = undefined;
            handler({ key: 'change-test-campaign-combatSummary', data: { round: 0, creatures: [] } });
            expect(mocks.setCombatSummaryG).not.toHaveBeenCalled();
            refs.combatSummaryRef.current = null;
            handler({ key: 'change-test-campaign-combatSummary', data: { round: 0, creatures: [] } });
            expect(mocks.setCombatSummaryG).not.toHaveBeenCalled();
        });
    });

    // ---- lastAttack dataKey ----

    describe('lastAttack dataKey', () => {
        it('should process lastAttack events without side effects', () => {
            handler({ key: 'change-test-campaign-lastAttack', data: { attackerName: 'Goblin' } });
            expect(mocks.setCombatSummary).not.toHaveBeenCalled();
            expect(mocks.setRuntimeStateTick).not.toHaveBeenCalled();
        });
    });

    // ---- activeCreatureName dataKey ----

    describe('activeCreatureName dataKey', () => {
        beforeEach(() => {
            refs.combatSummaryRef.current = { round: 1, creatures: [{ name: 'Alice', type: 'player' }], activeCreatureName: 'Alice' };
        });

        it('should update refs and state when active creature changes', () => {
            handler({ key: 'change-test-campaign-activeCreatureName', data: 'Bob' });
            expect(refs.activeCreatureNameRef.current).toBe('Bob');
            expect(mocks.setActiveCreatureNameG).toHaveBeenCalledWith('Bob');
        });

        it('should call expireStaleEffects with campaign name and new active creature', () => {
            handler({ key: 'change-test-campaign-activeCreatureName', data: 'Bob' });
            expect(expirations.expireStaleEffects).toHaveBeenCalledWith(
                campaignName, 'Bob',
            );
        });

        it('should update combatSummary cache', () => {
            handler({ key: 'change-test-campaign-activeCreatureName', data: 'Bob' });
            expect(combatData.setCombatSummaryCache).toHaveBeenCalled();
        });

        it('should apply turn-start effects when creature actually changes', async () => {
            refs.lastAppliedTurnStartCreatureRef.current = null;
            await handler({ key: 'change-test-campaign-activeCreatureName', data: 'Bob' });
            expect(expirations.applyTurnStartEffects).toHaveBeenCalled();
            expect(mocks.setRuntimeStateTick).toHaveBeenCalled();
        });

        it('should NOT apply turn-start effects when prevActive === event.data', () => {
            handler({ key: 'change-test-campaign-activeCreatureName', data: 'Alice' });
            expect(expirations.applyTurnStartEffects).not.toHaveBeenCalled();
        });

        it('should NOT apply turn-start effects when round-scoped lastApplied matches', () => {
            refs.lastAppliedTurnStartCreatureRef.current = '1:Bob';
            handler({ key: 'change-test-campaign-activeCreatureName', data: 'Bob' });
            expect(expirations.applyTurnStartEffects).not.toHaveBeenCalled();
        });

        it('BUG CLA-170: should re-apply turn-start effects to the same creature in a new round', async () => {
            refs.lastAppliedTurnStartCreatureRef.current = '1:Bob';
            refs.activeCreatureNameRef.current = 'Alice';
            refs.combatSummaryRef.current = { round: 2, creatures: [{ name: 'Bob', type: 'npc' }] };
            await handler({ key: 'change-test-campaign-activeCreatureName', data: 'Bob' });
            expect(expirations.applyTurnStartEffects).toHaveBeenCalledWith('Bob', expect.any(Object), campaignName, characters);
            expect(refs.lastAppliedTurnStartCreatureRef.current).toBe('2:Bob');
        });

        it('should update lastAppliedTurnStartCreature in runtime store with round-scoped key when applying', () => {
            refs.lastAppliedTurnStartCreatureRef.current = null;
            handler({ key: 'change-test-campaign-activeCreatureName', data: 'Bob' });
            expect(runtimeState.setRuntimeValue).toHaveBeenCalledWith(
                '__initiative__', 'lastAppliedTurnStartCreature', '1:Bob', campaignName,
            );
        });

        it('should update combatSummary.lastAppliedTurnStartCreature when different', () => {
            refs.lastAppliedTurnStartCreatureRef.current = null;
            refs.combatSummaryRef.current = { round: 1, creatures: [], lastAppliedTurnStartCreature: 'Alice' };
            handler({ key: 'change-test-campaign-activeCreatureName', data: 'Bob' });
            expect(mocks.setCombatSummary).toHaveBeenCalled();
        });

        it('should NOT update combatSummary when lastApplied already equals round-scoped key', () => {
            refs.lastAppliedTurnStartCreatureRef.current = '1:Bob';
            refs.combatSummaryRef.current = { round: 1, creatures: [], lastAppliedTurnStartCreature: '1:Bob' };
            handler({ key: 'change-test-campaign-activeCreatureName', data: 'Bob' });
            expect(mocks.setCombatSummary).not.toHaveBeenCalled();
        });

        it('should pass undefined computedStats when character not found', () => {
            refs.lastAppliedTurnStartCreatureRef.current = null;
            refs.combatSummaryRef.current = { round: 1, creatures: [] };
            handler({ key: 'change-test-campaign-activeCreatureName', data: 'Unknown' });
            expect(expirations.applyTurnStartEffects).toHaveBeenCalledWith(
                'Unknown', undefined, campaignName, characters,
            );
        });

        it('BUG CLA-307: runs outgoing owner turn-END condition removal with skipSync on echo', async () => {
            refs.activeCreatureNameRef.current = 'Alice';
            await handler({ key: 'change-test-campaign-activeCreatureName', data: 'Bob' });
            expect(expirations.applyTurnEndConditionRemoval).toHaveBeenCalledWith(
                'Alice', { hitPoints: 20 }, campaignName, true,
            );
        });

        it('BUG CLA-307: does NOT run turn-END removal when prevActive === newActive (no dupes)', async () => {
            refs.activeCreatureNameRef.current = 'Alice';
            await handler({ key: 'change-test-campaign-activeCreatureName', data: 'Alice' });
            expect(expirations.applyTurnEndConditionRemoval).not.toHaveBeenCalled();
        });

        it('should get combatSummary from getCombatSummary when ref is null', () => {
            refs.combatSummaryRef.current = null;
            combatData.getCombatSummary.mockReturnValue({
                round: 1, creatures: [], activeCreatureName: 'Bob',
            });
            handler({ key: 'change-test-campaign-activeCreatureName', data: 'Bob' });
            expect(combatData.getCombatSummary).toHaveBeenCalledWith(campaignName);
        });

        it('should handle null combatSummary by still updating state and calling side effects', () => {
            refs.combatSummaryRef.current = null;
            combatData.getCombatSummary.mockReturnValue(null);
            handler({ key: 'change-test-campaign-activeCreatureName', data: 'Bob' });
            expect(mocks.setActiveCreatureNameG).toHaveBeenCalledWith('Bob');
            expect(expirations.expireStaleEffects).toHaveBeenCalledWith(campaignName, 'Bob');
            expect(combatData.setCombatSummaryCache).not.toHaveBeenCalled();
        });

        it('should call applyTurnStartEffects even when cs is null', () => {
            refs.lastAppliedTurnStartCreatureRef.current = null;
            refs.combatSummaryRef.current = null;
            combatData.getCombatSummary.mockReturnValue(null);
            handler({ key: 'change-test-campaign-activeCreatureName', data: 'Bob' });
            expect(expirations.applyTurnStartEffects).toHaveBeenCalled();
        });
    });

    // ---- Character-level dataKey changes ----

    describe('character-level dataKey changes', () => {
        it('should trigger re-render tick for unknown dataKeys', () => {
            handler({ key: 'change-test-campaign-someCharacterKey', data: { foo: 'bar' } });
            expect(mocks.setRuntimeStateTick).toHaveBeenCalled();
        });

        it('should NOT trigger tick for excluded dataKeys (log, spell-overlay)', () => {
            handler({ key: 'change-test-campaign-log', data: [] });
            expect(mocks.setRuntimeStateTick).not.toHaveBeenCalled();
            handler({ key: 'change-test-campaign-spell-overlay', data: {} });
            expect(mocks.setRuntimeStateTick).not.toHaveBeenCalled();
        });
    });
});
