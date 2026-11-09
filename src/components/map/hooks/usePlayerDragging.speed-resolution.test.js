// @maintained-by-ai
// Lane: usePlayerDragging — movement-budget SPEED SOURCE
// (bug-movement-budget-caps-all-movers-at-30).
//
// Regression pin: the budget resolved speed from `player.speedFeet` on the map
// token, but tokens only ever carry {id,name,gridX,gridY} — NO producer stamps
// speedFeet — so the ternary always fell to DEFAULT_SPEED_FEET and every mover
// faster than 30 ft (Speedy feat, mounts, 40-ft monsters) had legal movement
// refused/clamped while the Initiative header strip beside the board honestly
// showed the real sheet speed. The fix threads the campaign `characters` lane
// (Map.jsx already owns it) into the hook; resolveSpeedFeet reads
// token speedFeet → computedStats.speed → authored speed → 30 default.
//
// Do NOT duplicate: usePlayerDragging.movement-budget.test.js — the 30-ft
// clamp/persistence-race mechanics (this file only changes the CEILING source);
// usePlayerDragging.test.js — enforcement-absent passthrough.
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

describe('usePlayerDragging — budget ceiling resolves real sheet speed', () => {
    // Stateful harness mirrored from usePlayerDragging.movement-budget.test.js:
    // setMapData behaves like React setState; svg CTM is the identity
    // passthrough (client px == svg px), so cell = floor(px / CELL_SIZE).
    let svgRef;
    let mapDataHolder;
    let setMapData;

    const gridSize = 30;
    const campaignName = 'test-campaign';
    const gridCenterX = (v) => v * CELL_SIZE + CELL_SIZE / 2;
    const gridCenterY = (v) => v * CELL_SIZE + CELL_SIZE / 2;

    // p1 starts (1,2). Sheet truth: EvasiveFighter is 40 ft
    // (Speedy +10 derived into computedStats.speed — the number the header
    // strip already shows); Player2 has only an authored `speed`.
    const characters = [
        { name: 'Player1', computedStats: { speed: 40 } },
        { name: 'Player2', speed: 35 },
    ];

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
                characters,
                setPopupHtml: () => {},
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

    // A 40-ft mover affords 8 cells from (1,2): (9,2) is the 40 ft edge,
    // (10,2) costs 45 ⇒ over. Pre-fix these were the 30-ft faces (7,2)/(8,2).
    it('press pins the ghost to the SHEET budget: 40 ft reaches (9,2), not (10,2)', () => {
        enforce({ Player1: { movementUsedFeet: 0 } });
        const { result } = press();
        const region = result.current.dragging.budgetReachable;
        expect(region.has('9,2')).toBe(true);  // 40 ft — exact fit lands
        expect(region.has('10,2')).toBe(false); // 45 ft — over budget
    });

    it('a 40 ft drop lands RAW: no snap, no denied row, exactly 40 ft billed', () => {
        enforce({ Player1: { movementUsedFeet: 0 } });
        const helpers = press();
        dropAt(helpers, 380, 80); // (9,2) — 8 cells = 40 ft, legal for a 40 ft mover
        expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 9, gridY: 2 });
        expect(mocks.addEntry).not.toHaveBeenCalled();
        expect(campaignStore().get('turnState').Player1.movementUsedFeet).toBe(40);
        expect(helpers.result.current.snapToast).toBeNull();
    });

    it('movement that was FULL-BLOCKED at 30 used is now legal at 40 speed: 10 ft lands raw', () => {
        enforce({ Player1: { movementUsedFeet: 30 } }); // 10 ft remaining on a 40 ft sheet
        const helpers = press();
        expect(helpers.result.current.dragging.budgetReachable.has('3,2')).toBe(true);
        expect(helpers.result.current.dragging.budgetReachable.has('4,2')).toBe(false);

        moveTo(helpers, 140, 80); // (3,2) — 10 ft, affordable — pre-fix rejected as over-budget
        expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 3, gridY: 2 });
        dropAt(helpers, 140, 80);
        expect(cellOf(mapDataHolder.current, 'p1')).toEqual({ gridX: 3, gridY: 2 });
        expect(mocks.addEntry).not.toHaveBeenCalled();
        expect(helpers.result.current.snapToast).toBeNull();
        expect(campaignStore().get('turnState').Player1.movementUsedFeet).toBe(40);
    });

    it('authored `speed` (no computedStats) also feeds the ceiling — Player2: 35 ft', () => {
        enforce({ Player2: { movementUsedFeet: 0 } });
        const helpers = press('p2', { x: 220, y: 220 }); // p2 starts (5,5): center 220
        const region = helpers.result.current.dragging.budgetReachable;
        expect(region.has('12,5')).toBe(true);  // 7 cells = 35 ft — exact fit lands
        expect(region.has('13,5')).toBe(false); // 8 cells = 40 ft — over a 35 ft sheet
    });

    it('unknown mover (no characters match) keeps the honest 30 ft default clamp', () => {
        enforce({ Player3: { movementUsedFeet: 0 } });
        const helpers = press('p3', { x: 420, y: 420 }); // p3 starts (10,10): center 420
        // 35 ft drop at (17,10) — unknown mover ⇒ ceiling 30 ⇒ snaps to the
        // 30 ft edge (16,10) with the unchanged denied row + bill.
        dropAt(helpers, 700, 420);
        expect(cellOf(mapDataHolder.current, 'p3')).toEqual({ gridX: 16, gridY: 10 });
        expect(mocks.addEntry).toHaveBeenCalledTimes(1);
        expect(campaignStore().get('turnState').Player3.movementUsedFeet).toBe(30);
    });

    it('an explicit token speedFeet still wins over the sheet (mount-merged tokens)', () => {
        mapDataHolder.current = {
            ...mapDataHolder.current,
            players: [playerBytes('p1', 'Player1', 1, 2, { speedFeet: 50 }), ...mapDataHolder.current.players.slice(1)],
        };
        enforce({ Player1: { movementUsedFeet: 0 } });
        const helpers = press();
        // 50 ft budget ⇒ the 40 ft drop at (9,2) fits with room to spare.
        expect(helpers.result.current.dragging.budgetReachable.has('11,2')).toBe(true); // 50 ft
        dropAt(helpers, 380, 80);
        expect(mocks.addEntry).not.toHaveBeenCalled();
        expect(campaignStore().get('turnState').Player1.movementUsedFeet).toBe(40);
    });
});
