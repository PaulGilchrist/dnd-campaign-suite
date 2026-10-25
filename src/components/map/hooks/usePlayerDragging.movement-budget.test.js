// @maintained-by-ai
// Lane: usePlayerDragging — L5-002 movement-budget enforcement on the token-drag
// persistence race (bug-movement-budget-snap-logged-but-token-not-repositioned).
//
// Root cause pinned here: pointermove committed RAW over-budget ghost cells into
// live mapData; autosave/flush-on-up persisted the raw snapshot, and the save's
// own map-data SSE echo overwrote the clamped pointerUp commit — the clamp
// billed + logged a snap while the token stayed past budget on disk.
//
// The fix gates the LIVE ghost at press time (dragging.budgetReachable =
// reachableWithinBudget from the turn-start cell) so EVERY persistence lane only
// ever sees legal cells; resolveMovementBudgetDrop stays the drop-side
// billing/logging authority — snap still charged, snap still logged.
//
// Do NOT duplicate: movementBudget.test.js — clamp math (reachableWithinBudget
// rows added there); usePlayerDragging.test.js — enforcement-absent lane
// (byte-identical passthrough, re-asserted here for the L1–4 guarantee).
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import usePlayerDragging from './usePlayerDragging.js';
import { CELL_SIZE } from '../../../config/mapConfig.js';
import { clearRuntimeState, getStore } from '../../../hooks/runtime/useRuntimeState.js';

const mocks = vi.hoisted(() => ({
    onTokenMoveLanded: vi.fn(() => Promise.resolve()),
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/opportunityTrigger.js', () => mocks);
vi.mock('../../../services/ui/logService.js', () => ({ addEntry: mocks.addEntry }));

globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true }));

describe('usePlayerDragging — movement budget enforcement (L5-002)', () => {
    // Stateful harness (mirrors usePlayerDragging.test.js): setMapData behaves
    // like React setState so later calls observe fresh data; svg CTM is the
    // identity passthrough (client px == svg px).
    let svgRef;
    let mapDataHolder;
    let setMapData;

    const gridSize = 30;
    const campaignName = 'test-campaign';
    const gridCenterX = (v) => v * CELL_SIZE + CELL_SIZE / 2;
    const gridCenterY = (v) => v * CELL_SIZE + CELL_SIZE / 2;

    const svgAt = (x, y) => ({
        setPointerCapture: vi.fn(),
        releasePointerCapture: vi.fn(),
        createSVGPoint: () => ({ x: 0, y: 0, matrixTransform: () => ({ x, y }) }),
        getScreenCTM: () => ({ inverse: () => ({}) }),
    });

    const mockEvent = (overrides = {}) => ({
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
        pointerId: 1,
        clientX: 60,
        clientY: 80,
        ...overrides,
    });

    const playerBytes = (id, name, gridX, gridY, extra = {}) => ({ id, name, gridX, gridY, ...extra });
    const cellOf = (map, id) => {
        const p = map.players.find((c) => c.id === id);
        return { gridX: p.gridX, gridY: p.gridY };
    };

    const getHook = (overrides = {}) =>
        renderHook(() =>
            usePlayerDragging({
                svgRef,
                mapData: mapDataHolder.current,
                gridSize,
                setMapData,
                gridCenterX,
                gridCenterY,
                rulerMode: false,
                spellMode: false,
                campaignName,
                isLocalhost: false,
                walls: new Set(),
                placedItems: [],
                ...overrides,
            })
        );

    const press = (playerId = 'p1', { hook = {}, event = {}, x = 60, y = 80 } = {}) => {
        svgRef.current = svgAt(x, y);
        const helpers = getHook(hook);
        const ev = mockEvent({ clientX: x, clientY: y, ...event });
        act(() => {
            helpers.result.current.handlePointerDown(ev, playerId);
        });
        return { ...helpers, ev };
    };

    const moveTo = (helpers, x, y, event = {}) => {
        svgRef.current = svgAt(x, y);
        act(() => {
            helpers.result.current.handlePointerMove(mockEvent({ clientX: x, clientY: y, ...event }));
        });
        act(() => helpers.rerender());
    };

    const dropAt = (helpers, x, y, event = {}) => {
        svgRef.current = svgAt(x, y);
        act(() => {
            helpers.result.current.handlePointerUp(mockEvent({ clientX: x, clientY: y, ...event }));
        });
    };

    const campaignStore = () => getStore('campaign');

    beforeEach(() => {
        clearRuntimeState('campaign');
        vi.clearAllMocks();
        svgRef = { current: null };
        mapDataHolder = {
            current: {
                players: [
                    playerBytes('p1', 'Player1', 1, 2),
                    playerBytes('p2', 'Player2', 5, 5),
                    playerBytes('p3', 'Player3', 10, 10),
                ],
                terrain: {},
            },
        };
        setMapData = vi.fn((fn) => {
            const next = typeof fn === 'function' ? fn(mapDataHolder.current) : fn;
            mapDataHolder.current = next;
            return next;
        });
    });

    const enforce = (turnState) => {
        campaignStore().set('enforcement', { mode: 'on', movementBudget: true });
        campaignStore().set('turnState', turnState);
    };

    // p1 starts (1,2), speed 30 ft ⇒ cells within 6 steps affordable;
    // (7,2) is the 6-step budget edge, (8,2) costs 35 ⇒ over.
    describe('movementBudget ON + fresh budget: the live ghost is budget-pinned', () => {
        it('press snapshots the affordable region (30 ft from (1,2) ⇒ edge (7,2))', () => {
            enforce({ Player1: { movementUsedFeet: 0 } });
            const { result } = press();
            const region = result.current.dragging.budgetReachable;
            expect(region).toBeInstanceOf(Set);
            expect(region.has('7,2')).toBe(true);  // 30 ft — exact fit lands
            expect(region.has('8,2')).toBe(false); // 35 ft — over budget
            expect(region.has('1,2')).toBe(true);  // origin always qualifies
        });

        it('refuses mid-drag commits past the budget edge and lands the drop snapped — never raw', () => {
            enforce({ Player1: { movementUsedFeet: 0 } });
            const helpers = press();
            moveTo(helpers, 300, 80); // (7,2) edge — legal, commits
            expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 7, gridY: 2 });
            expect(helpers.result.current.dragging.invalid).toBeFalsy();

            moveTo(helpers, 340, 80); // (8,2) — over budget ⇒ rejected, stays pinned
            expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 7, gridY: 2 });
            expect(helpers.result.current.dragging.invalid).toBe(true);

            setMapData.mockClear();
            dropAt(helpers, 380, 80); // raw pointer release at (9,2) — 40 ft
            // No persistence lane ever sees the raw (9,2) cell — THE regression pin:
            expect(setMapData).toHaveBeenCalledTimes(1);
            expect(setMapData.mock.calls[0][0](mapDataHolder.current).players).toEqual([
                playerBytes('p1', 'Player1', 7, 2), // snapped, NOT raw (9,2)
                playerBytes('p2', 'Player2', 5, 5),
                playerBytes('p3', 'Player3', 10, 10),
            ]);
            expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 7, gridY: 2 });
            // Drop-side authority still bills + logs the snap:
            expect(campaignStore().get('turnState').Player1.movementUsedFeet).toBe(30);
            expect(mocks.addEntry).toHaveBeenCalledTimes(1);
            expect(mocks.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'enforcement_denied',
                creature: 'Player1',
                bucket: 'movement',
                source: 'map-drag',
                reason: 'Out of movement — snapped to the remaining budget (30 ft this move).',
            }));
            expect(mocks.onTokenMoveLanded).toHaveBeenCalledWith(
                expect.objectContaining({ toCell: { gridX: 7, gridY: 2 } }));
        });

        it('an exact-budget drop fits without a snap log and charges exactly', () => {
            enforce({ Player1: { movementUsedFeet: 0 } });
            const helpers = press();
            dropAt(helpers, 300, 80); // exactly 6 cells = 30 ft
            expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 7, gridY: 2 });
            expect(mocks.addEntry).not.toHaveBeenCalled();
            expect(campaignStore().get('turnState').Player1.movementUsedFeet).toBe(30);
        });
    });

    describe('movementBudget ON + exhausted budget: the token cannot leave its cell', () => {
        it('pins the token at the turn-start cell, snaps the drop back, logs (0 ft)', () => {
            enforce({ Player1: { movementUsedFeet: 30 } }); // 30 speed ⇒ 0 remaining
            const helpers = press();
            const region = helpers.result.current.dragging.budgetReachable;
            expect(region).toEqual(new Set(['1,2'])); // zero remaining ⇒ origin only, token cannot leave

            moveTo(helpers, 140, 80); // (3,2) — any move is over ⇒ rejected
            expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 1, gridY: 2 });
            expect(helpers.result.current.dragging.invalid).toBe(true);

            setMapData.mockClear();
            dropAt(helpers, 140, 80);
            expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 1, gridY: 2 }); // landed back on start
            expect(mocks.addEntry).toHaveBeenCalledTimes(1);
            expect(mocks.addEntry).toHaveBeenCalledWith(campaignName, expect.objectContaining({
                type: 'enforcement_denied',
                bucket: 'movement',
                reason: 'Out of movement — snapped to the remaining budget (0 ft this move).',
            }));
            // Zero move ⇒ zero charge, zero stamps, zero trigger:
            expect(campaignStore().get('turnState').Player1.movementUsedFeet).toBe(30);
            expect(mocks.onTokenMoveLanded).not.toHaveBeenCalled();
        });
    });

    describe('off-switches stay byte-identical (L1–4 guarantee)', () => {
        it('enforcement absent ⇒ raw over-budget cells commit freely, no bill, no log', () => {
            const helpers = press();
            expect(helpers.result.current.dragging.budgetReachable).toBeNull();
            moveTo(helpers, 340, 80);
            expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 8, gridY: 2 });
            dropAt(helpers, 380, 80);
            expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 9, gridY: 2 });
            expect(mocks.addEntry).not.toHaveBeenCalled();
            expect(campaignStore().get('turnState')).toBeUndefined();
        });

        it('movementBudget flag off ⇒ no pin even with enforcement on', () => {
            campaignStore().set('enforcement', { mode: 'on', movementBudget: false });
            campaignStore().set('turnState', { Player1: { movementUsedFeet: 30 } });
            const helpers = press();
            expect(helpers.result.current.dragging.budgetReachable).toBeNull();
            moveTo(helpers, 340, 80);
            expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 8, gridY: 2 });
        });

        it('GM Shift bypass teleports past the budget with zero enforcement traffic', () => {
            enforce({ Player1: { movementUsedFeet: 0 } });
            const helpers = press('p1', { hook: { isLocalhost: true }, event: { shiftKey: true } });
            expect(helpers.result.current.dragging.unconstrained).toBe(true);
            expect(helpers.result.current.dragging.budgetReachable).toBeNull();
            moveTo(helpers, 380, 80); // raw (9,2) — 40 ft, GM unconstrained
            expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 9, gridY: 2 });
            dropAt(helpers, 380, 80);
            expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 9, gridY: 2 });
            expect(mocks.addEntry).not.toHaveBeenCalled();
        });
    });
});
