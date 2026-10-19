// @maintained-by-ai
// Lane: useSelectMove — GM select+move over walls/placedItems (Map.jsx, select tool).
// Interaction-tools matrix: ruler owns measurement (see useRuler.test.js — this hook only
// guards tool !== TOOL_SELECT and skips); token-drag commits live in #905 (items) and
// usePlayerDragging (players); THIS lane owns marquee select + rigid multi-select moves
// (#786/#744 exact position write once; invalid/clamped-to-zero targets ⇒ zero writes).
// Contract rows:
//   guards → non-localhost and non-select tools inert across ALL handlers (no capture, no reads, no writes)
//   down   → marquee-start bytes / move-start on wall|item|in-bounds press; capture BEFORE grid guard
//   move   → marquee rect bytes normalised both directions; ± group offset; refs synced; idle moves inert
//   up     → marquee commit (exact membership, bounds set, transient cleared, map untouched) OR
//            rigid move commit exact-once; zero-offset drop = reset without writes; capture always released
//   budget → L5-002 enforcement on: clamp to MIN remaining across selected players (Math.min + block +
//            charge wiring owned here; clamp math owned by movementBudget.test.js); steadyAim stamp
//            per moved player; onTokenMoveLanded exact args (defender internals owned by opportunityTrigger.test.js)
// Old→new map: localhost-guards×3 + ruler-guards×2 → "guards" rows; down empty→D1;
// down wall/item/in-bounds×3 → D2; down stale-bounds → D3; down no-svg + null-grid → D4;
// move fwd + backwards → M1; move offset → M2 (±); move idle + null-grid → M3;
// up release + null-svg + idle + zero-offset×4 → U1; up walls + items + empty-rect + clear×4 → U2;
// up wall-move → U3 (exact set); up item-move (title claimed steadyAim but never asserted) → U4 (+stamps+OA);
// up nothing → U1; NEW: B1 budget clamp+charge, B2 exhausted ⇒ zero-write.
// Mocks: runtime store mocked (setRuntimeValue recorder; getRuntimeValue default null ⇒ every
// commit row also proves the enforcement-absent passthrough implicitly — L1–4 guarantee).
// opportunityTrigger mocked (#905 convention, zero network, pins args). movementBudget /
// turnState / chargeEconomy run REAL (pure math, runtime reads land on the mock).
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useSelectMove from './useSelectMove.js';
import { TOOL_SELECT } from '../../../config/mapConfig.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

const mocks = vi.hoisted(() => ({
  onTokenMoveLanded: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
  getRuntimeValue: vi.fn(() => null),
}));

vi.mock('../../../services/combat/opportunityTrigger.js', () => mocks);

describe('useSelectMove', () => {
  const mockSvgRef = { current: null };
  const mockGetGridFromEvent = vi.fn();
  const campaignName = 'test-campaign';

  const createMockEvent = (pointerId = 1) => ({
    preventDefault: vi.fn(),
    pointerId,
  });

  const createSvgWithPointerCapture = () => {
    mockSvgRef.current = {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    };
  };

  const baseArgs = (overrides = {}) => ({
    isLocalhost: true,
    tool: TOOL_SELECT,
    getGridFromEvent: mockGetGridFromEvent,
    svgRef: mockSvgRef,
    campaignName,
    ...overrides,
  });

  // L5-002 fixture: enforcement ON for movement budget only (opportunityAttacks
  // stays unset so the mocked OA lane is never even asked to do work).
  const enforcementOn = (turnState) => {
    runtimeState.getRuntimeValue.mockImplementation((_domain, key) => {
      if (key === 'enforcement') return { mode: 'on', movementBudget: true };
      if (key === 'turnState') return turnState;
      return null;
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks keeps implementations; restore the enforcement-absent default explicitly.
    runtimeState.getRuntimeValue.mockImplementation(() => null);
    mocks.onTokenMoveLanded.mockImplementation(() => Promise.resolve());
    mockGetGridFromEvent.mockReturnValue(null);
    mockSvgRef.current = null;
  });

  describe('guards', () => {
    it('is inert for non-localhost clients across every handler', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove({ ...baseArgs(), isLocalhost: false }));
      const event = createMockEvent();
      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();

      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
        result.current.handleSelectPointerMove(event);
        result.current.handleSelectPointerUp(event, [], null, setMapData, setPlacedItems);
      });

      expect(mockGetGridFromEvent).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(mockSvgRef.current.setPointerCapture).not.toHaveBeenCalled();
      expect(mockSvgRef.current.releasePointerCapture).not.toHaveBeenCalled();
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
      expect(result.current.selectStart.current).toBeNull();
      expect(result.current.moveStartGrid.current).toBeNull();
    });

    it('skips interaction while another tool (e.g. ruler) owns the pointer', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove({ ...baseArgs(), tool: 'ruler' }));
      const event = createMockEvent();
      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();

      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
        result.current.handleSelectPointerMove(event);
        result.current.handleSelectPointerUp(event, [], null, setMapData, setPlacedItems);
      });

      expect(mockGetGridFromEvent).not.toHaveBeenCalled();
      expect(mockSvgRef.current.setPointerCapture).not.toHaveBeenCalled();
      expect(setMapData).not.toHaveBeenCalled();
      expect(result.current.selectStart.current).toBeNull();
      expect(result.current.moveStartGrid.current).toBeNull();
    });
  });

  describe('handleSelectPointerDown', () => {
    it('starts a marquee selection on empty canvas and resets prior selection/move state', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const event = createMockEvent();

      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockSvgRef.current.setPointerCapture).toHaveBeenCalledWith(1);
      expect(result.current.selectStart.current).toEqual({ gridX: 5, gridY: 3 });
      expect(result.current.selectionRect).toEqual({ minX: 5, maxX: 5, minY: 3, maxY: 3 });
      expect(result.current.selectedWalls.size).toBe(0);
      expect(result.current.selectedItems.size).toBe(0);
      expect(result.current.moveOffset).toBeNull();
      expect(result.current.moveStartGrid.current).toBeNull();
      expect(result.current.selectionBoundsRef.current).toBeNull();
    });

    it('begins a group move when pressing a selected wall, a selected item, or empty bounds with a selection live', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      createSvgWithPointerCapture();

      // selected wall directly under the press
      let { result } = renderHook(() => useSelectMove(baseArgs()));
      act(() => {
        result.current.selectedWallsRef.current.add('5,3');
      });
      act(() => {
        result.current.handleSelectPointerDown(createMockEvent(), [], null);
      });
      expect(result.current.moveStartGrid.current).toEqual({ gridX: 5, gridY: 3 });
      expect(result.current.moveOffset).toEqual({ dx: 0, dy: 0 });
      expect(result.current.selectStart.current).toBeNull();

      // selected item directly under the press
      ({ result } = renderHook(() => useSelectMove(baseArgs())));
      act(() => {
        result.current.selectedItemsRef.current.add('item1');
        result.current.placedItemsRef.current = [{ id: 'item1', gridX: 5, gridY: 3 }];
      });
      act(() => {
        result.current.handleSelectPointerDown(createMockEvent(), [], null);
      });
      expect(result.current.moveStartGrid.current).toEqual({ gridX: 5, gridY: 3 });
      expect(result.current.moveOffset).toEqual({ dx: 0, dy: 0 });
      expect(result.current.selectStart.current).toBeNull();

      // empty cell inside selection bounds — dragging there still moves the group
      ({ result } = renderHook(() => useSelectMove(baseArgs())));
      act(() => {
        result.current.selectedWallsRef.current.add('1,1');
        result.current.selectionBoundsRef.current = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
      });
      act(() => {
        result.current.handleSelectPointerDown(createMockEvent(), [], null);
      });
      expect(result.current.moveStartGrid.current).toEqual({ gridX: 5, gridY: 3 });
      expect(result.current.selectStart.current).toBeNull();
    });

    it('restarts a fresh selection when pressing inside stale bounds with nothing selected', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));

      act(() => {
        result.current.selectionBoundsRef.current = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
      });
      act(() => {
        result.current.handleSelectPointerDown(createMockEvent(), [], null);
      });

      expect(result.current.selectStart.current).toEqual({ gridX: 5, gridY: 3 });
      expect(result.current.moveStartGrid.current).toBeNull();
      expect(result.current.selectionBoundsRef.current).toBeNull();
    });

    it('degrades gracefully without an SVG and without a grid', () => {
      // no SVG: selection still starts, nothing tries to capture
      mockGetGridFromEvent.mockReturnValue({ gridX: 5.2, gridY: 3.8 });
      mockSvgRef.current = null;
      let { result } = renderHook(() => useSelectMove(baseArgs()));
      act(() => {
        result.current.handleSelectPointerDown(createMockEvent(), [], null);
      });
      expect(result.current.selectStart.current).toEqual({ gridX: 5, gridY: 3 });

      // unresolvable grid: pointer is captured/prevented, but no half-started selection
      createSvgWithPointerCapture();
      mockGetGridFromEvent.mockReturnValue(null);
      ({ result } = renderHook(() => useSelectMove(baseArgs())));
      const event = createMockEvent();
      act(() => {
        result.current.handleSelectPointerDown(event, [], null);
      });
      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockSvgRef.current.setPointerCapture).toHaveBeenCalledWith(1);
      expect(result.current.selectStart.current).toBeNull();
      expect(result.current.moveStartGrid.current).toBeNull();
    });
  });

  describe('handleSelectPointerMove', () => {
    it('grows the marquee rect forward and normalises backwards drags (state + ref synced)', () => {
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      act(() => {
        result.current.selectStart.current = { gridX: 5, gridY: 3 };
      });

      mockGetGridFromEvent.mockReturnValue({ gridX: 8.7, gridY: 6.1 });
      const fwd = createMockEvent();
      act(() => {
        result.current.handleSelectPointerMove(fwd);
      });
      expect(fwd.preventDefault).toHaveBeenCalled();
      expect(result.current.selectionRect).toEqual({ minX: 5, maxX: 8, minY: 3, maxY: 6 });
      expect(result.current.selectionRectRef.current).toEqual({ minX: 5, maxX: 8, minY: 3, maxY: 6 });

      // back past the start: rect is re-spanned from start↔current, min/max flipped
      mockGetGridFromEvent.mockReturnValue({ gridX: 2.1, gridY: 1.9 });
      act(() => {
        result.current.handleSelectPointerMove(createMockEvent());
      });
      expect(result.current.selectionRect).toEqual({ minX: 2, maxX: 5, minY: 1, maxY: 3 });
      expect(result.current.selectionRectRef.current).toEqual({ minX: 2, maxX: 5, minY: 1, maxY: 3 });
    });

    it('tracks the group-move offset through positive and negative drags', () => {
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      act(() => {
        result.current.moveStartGrid.current = { gridX: 5, gridY: 3 };
      });

      mockGetGridFromEvent.mockReturnValue({ gridX: 8.7, gridY: 6.1 });
      const event = createMockEvent();
      act(() => {
        result.current.handleSelectPointerMove(event);
      });
      expect(event.preventDefault).toHaveBeenCalled();
      expect(result.current.moveOffset).toEqual({ dx: 3, dy: 3 });
      expect(result.current.moveOffsetRef.current).toEqual({ dx: 3, dy: 3 });

      mockGetGridFromEvent.mockReturnValue({ gridX: 2.1, gridY: 1.9 });
      act(() => {
        result.current.handleSelectPointerMove(createMockEvent());
      });
      expect(result.current.moveOffset).toEqual({ dx: -3, dy: -2 });
    });

    it('stays inert on stray moves and freezes the rect when the grid goes null', () => {
      mockGetGridFromEvent.mockReturnValue({ gridX: 8.7, gridY: 6.1 });
      const { result } = renderHook(() => useSelectMove(baseArgs()));

      const stray = createMockEvent();
      act(() => {
        result.current.handleSelectPointerMove(stray);
      });
      expect(result.current.selectionRect).toBeNull();
      expect(result.current.moveOffset).toBeNull();
      expect(stray.preventDefault).not.toHaveBeenCalled();

      act(() => {
        result.current.selectStart.current = { gridX: 5, gridY: 3 };
        result.current.handleSelectPointerMove(createMockEvent());
      });
      expect(result.current.selectionRect).toEqual({ minX: 5, maxX: 8, minY: 3, maxY: 6 });

      mockGetGridFromEvent.mockReturnValue(null);
      act(() => {
        result.current.handleSelectPointerMove(createMockEvent());
      });
      expect(result.current.selectionRect).toEqual({ minX: 5, maxX: 8, minY: 3, maxY: 6 });
      expect(result.current.moveOffset).toBeNull();
    });
  });

  describe('handleSelectPointerUp', () => {
    it('releases the capture, and every no-op up writes nothing yet always resets move state', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();

      // idle up (nothing selected, nothing moving)
      act(() => {
        result.current.handleSelectPointerUp(createMockEvent(), [], null, setMapData, setPlacedItems);
      });
      expect(mockSvgRef.current.releasePointerCapture).toHaveBeenCalledWith(1);
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();

      // group dropped with a zero offset: reset without touching the map
      act(() => {
        result.current.moveStartGrid.current = { gridX: 2, gridY: 2 };
        result.current.moveOffsetRef.current = { dx: 0, dy: 0 };
      });
      act(() => {
        result.current.handleSelectPointerUp(createMockEvent(), [], null, setMapData, setPlacedItems);
      });
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
      expect(result.current.moveStartGrid.current).toBeNull();
      expect(result.current.moveOffset).toBeNull();

      // missing SVG must not throw on up
      mockSvgRef.current = null;
      act(() => {
        result.current.handleSelectPointerUp(createMockEvent(), [], null, setMapData, setPlacedItems);
      });
      expect(setMapData).not.toHaveBeenCalled();
    });

    it('commits a marquee selection of exactly the walls/items inside the rect, leaving the map untouched', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      act(() => {
        result.current.selectStart.current = { gridX: 2, gridY: 2 };
        result.current.selectionRectRef.current = { minX: 2, maxX: 4, minY: 2, maxY: 4 };
        result.current.mapDataRef.current = { walls: new Set(['2,2', '3,3', '4,4', '5,5']) };
        result.current.placedItemsRef.current = [
          { id: 'item1', gridX: 2, gridY: 2 },
          { id: 'item2', gridX: 3, gridY: 3 },
          { id: 'item3', gridX: 5, gridY: 5 },
        ];
      });

      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();
      act(() => {
        result.current.handleSelectPointerUp(createMockEvent(), [], null, setMapData, setPlacedItems);
      });

      expect(result.current.selectedWalls).toEqual(new Set(['2,2', '3,3', '4,4']));
      expect(result.current.selectedItems).toEqual(new Set(['item1', 'item2']));
      expect(result.current.selectionBoundsRef.current).toEqual({ minX: 2, maxX: 4, minY: 2, maxY: 4 });
      expect(result.current.selectStart.current).toBeNull();
      expect(result.current.selectionRect).toBeNull();
      expect(result.current.selectionRectRef.current).toBeNull();
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('commits a wall-group move exactly once: shifted set, shifted bounds, move state reset', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      act(() => {
        result.current.moveStartGrid.current = { gridX: 2, gridY: 2 };
        result.current.moveOffsetRef.current = { dx: 1, dy: 2 };
        result.current.selectedWallsRef.current = new Set(['2,2', '3,3']);
        result.current.selectionBoundsRef.current = { minX: 2, maxX: 3, minY: 2, maxY: 3 };
      });

      let mapDataState = { walls: new Set(['2,2', '3,3', '5,5']) };
      const setMapData = vi.fn((fn) => {
        mapDataState = fn(mapDataState);
        return mapDataState;
      });
      act(() => {
        result.current.handleSelectPointerUp(createMockEvent(), [], mapDataState, setMapData, vi.fn());
      });

      expect(setMapData).toHaveBeenCalledTimes(1);
      // (2,2)->(3,4), (3,3)->(4,5); unselected (5,5) outside dstBounds survives — fully exact
      expect(mapDataState.walls).toEqual(new Set(['3,4', '4,5', '5,5']));
      expect(result.current.selectionBoundsRef.current).toEqual({ minX: 3, maxX: 4, minY: 4, maxY: 5 });
      expect(result.current.moveStartGrid.current).toBeNull();
      expect(result.current.moveOffset).toBeNull();
      expect(result.current.moveOffsetRef.current).toBeNull();
    });

    it('commits an item-group move: exact positions, steadyAim stamp for the moved player only, OA scan once', () => {
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));
      const placedItems = [
        { id: 'item1', name: 'CharA', type: 'player', gridX: 2, gridY: 2 },
        { id: 'item2', name: 'CharB', type: 'monster', gridX: 3, gridY: 3 },
        { id: 'item3', name: 'CharC', type: 'player', gridX: 5, gridY: 5 },
      ];
      act(() => {
        result.current.placedItemsRef.current = placedItems;
        result.current.selectedItemsRef.current = new Set(['item1']);
        result.current.moveStartGrid.current = { gridX: 2, gridY: 2 };
        result.current.moveOffsetRef.current = { dx: 1, dy: 1 };
        result.current.selectionBoundsRef.current = { minX: 2, maxX: 2, minY: 2, maxY: 2 };
      });

      let placedItemsState = placedItems;
      const setPlacedItems = vi.fn((fn) => {
        placedItemsState = fn(placedItemsState);
        return placedItemsState;
      });
      act(() => {
        result.current.handleSelectPointerUp(createMockEvent(), placedItemsState, null, vi.fn(), setPlacedItems);
      });

      expect(placedItemsState[0]).toEqual(expect.objectContaining({ name: 'CharA', gridX: 3, gridY: 3 }));
      expect(placedItemsState[1]).toEqual(expect.objectContaining({ name: 'CharB', gridX: 3, gridY: 3 }));
      expect(placedItemsState[2]).toEqual(expect.objectContaining({ name: 'CharC', gridX: 5, gridY: 5 }));

      const aimStamps = runtimeState.setRuntimeValue.mock.calls
        .filter((c) => c[1] === 'steadyAimMovedThisTurn');
      expect(aimStamps).toEqual([['CharA', 'steadyAimMovedThisTurn', true, campaignName]]);

      expect(mocks.onTokenMoveLanded).toHaveBeenCalledTimes(1); // selected token only
      expect(mocks.onTokenMoveLanded).toHaveBeenCalledWith(expect.objectContaining({
        campaignName,
        moverName: 'CharA',
        moverIsPlayer: true,
        fromCell: { gridX: 2, gridY: 2 },
        toCell: { gridX: 3, gridY: 3 },
      }));
    });
  });

  describe('L5-002 movement-budget enforcement', () => {
    it('clamps a group move to the tightest selected-player budget and charges each mover once', () => {
      // CharA has 5 ft left (1 cell), CharB 30 ft — group may shift only 1 cell of the 3 requested.
      enforcementOn({ CharA: { movementUsedFeet: 25 } });
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));

      let placedItemsState = [
        { id: 'item1', name: 'CharA', type: 'player', gridX: 2, gridY: 2 },
        { id: 'item2', name: 'CharB', type: 'player', gridX: 3, gridY: 2 },
      ];
      act(() => {
        result.current.placedItemsRef.current = placedItemsState;
        result.current.selectedItemsRef.current = new Set(['item1', 'item2']);
        result.current.mapDataRef.current = { walls: new Set(['2,2', '9,9']) };
        result.current.selectedWallsRef.current = new Set(['2,2']);
        result.current.selectionBoundsRef.current = { minX: 2, maxX: 3, minY: 2, maxY: 2 };
        result.current.moveStartGrid.current = { gridX: 2, gridY: 2 };
        result.current.moveOffsetRef.current = { dx: 3, dy: 0 };
      });

      let mapDataState = { walls: new Set(['2,2', '9,9']) };
      const setMapData = vi.fn((fn) => {
        mapDataState = fn(mapDataState);
        return mapDataState;
      });
      const setPlacedItems = vi.fn((fn) => {
        placedItemsState = fn(placedItemsState);
        return placedItemsState;
      });
      act(() => {
        result.current.handleSelectPointerUp(createMockEvent(), placedItemsState, mapDataState, setMapData, setPlacedItems);
      });

      expect(setMapData).toHaveBeenCalledTimes(1);
      expect(mapDataState.walls).toEqual(new Set(['3,2', '9,9'])); // clamped to 1 cell, not 3
      expect(placedItemsState[0]).toEqual(expect.objectContaining({ name: 'CharA', gridX: 3, gridY: 2 }));
      expect(placedItemsState[1]).toEqual(expect.objectContaining({ name: 'CharB', gridX: 4, gridY: 2 }));
      expect(result.current.selectionBoundsRef.current).toEqual({ minX: 3, maxX: 4, minY: 2, maxY: 2 });

      const turnStateWrites = runtimeState.setRuntimeValue.mock.calls
        .filter((c) => c[0] === 'campaign' && c[1] === 'turnState' && c[3] === campaignName);
      expect(turnStateWrites).toHaveLength(2); // one clamped charge per moved player
      expect(turnStateWrites[0][2].CharA.movementUsedFeet).toBe(30); // 25 + 5
      expect(turnStateWrites[1][2].CharB.movementUsedFeet).toBe(5); // 0 + 5
    });

    it('writes nothing when the clamped offset collapses to zero (budget exhausted)', () => {
      enforcementOn({ CharA: { movementUsedFeet: 30 }, CharB: { movementUsedFeet: 10 } });
      createSvgWithPointerCapture();
      const { result } = renderHook(() => useSelectMove(baseArgs()));

      act(() => {
        result.current.placedItemsRef.current = [
          { id: 'item1', name: 'CharA', type: 'player', gridX: 2, gridY: 2 },
          { id: 'item2', name: 'CharB', type: 'player', gridX: 3, gridY: 2 },
        ];
        result.current.selectedItemsRef.current = new Set(['item1', 'item2']);
        result.current.selectedWallsRef.current = new Set(['2,2']);
        result.current.selectionBoundsRef.current = { minX: 2, maxX: 3, minY: 2, maxY: 2 };
        result.current.moveStartGrid.current = { gridX: 2, gridY: 2 };
        result.current.moveOffsetRef.current = { dx: 3, dy: 0 };
      });

      const setMapData = vi.fn();
      const setPlacedItems = vi.fn();
      act(() => {
        result.current.handleSelectPointerUp(createMockEvent(), [], null, setMapData, setPlacedItems);
      });

      expect(setMapData).not.toHaveBeenCalled(); // group stays put
      expect(setPlacedItems).not.toHaveBeenCalled();
      expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled(); // no charge, no steadyAim stamp
      expect(mocks.onTokenMoveLanded).not.toHaveBeenCalled();
      expect(result.current.selectionBoundsRef.current).toEqual({ minX: 2, maxX: 3, minY: 2, maxY: 2 });
      expect(result.current.moveStartGrid.current).toBeNull(); // move state resets regardless
      expect(result.current.moveOffset).toBeNull();
    });
  });
});
