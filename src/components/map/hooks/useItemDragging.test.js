// @maintained-by-ai
// Lane: useItemDragging — placedItems token drag contract (Map.jsx / PlacedItems.jsx).
//   down  → guard-then-capture (guards fully validate first; capture only when the
//           drag actually starts — #883) + drag-ghost state bytes (offset/start cell/mover identity)
//   move  → snapped clamped cell bytes via setPlacedItems + steadyAim runtime write
//   up    → release capture, clear state, onTokenMoveLanded commit exact args
//   leave → cancel: release + clear, ZERO commit writes
// Drag/drop split (do not duplicate here):
//   usePlayerDragging.test.js — mapData.players lane; useMapDrops.test.js — external drop-target lane;
//   usePlacedItems.test.js — placedItems CRUD consumer; opportunityTrigger.test.js — defender-detection
//   internals (we pin invocation args only; math owner for pixel→cell snap is THIS hook, so we feed
//   pointer coords and pin exact cell bytes, #807-style).
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useItemDragging from './useItemDragging.js';
import { CELL_SIZE } from '../../../config/mapConfig.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

const mocks = vi.hoisted(() => ({
  onTokenMoveLanded: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/combat/opportunityTrigger.js', () => mocks);

describe('useItemDragging', () => {
  // Shared mutable containers so useCallback closures see current values without
  // over-mocking: svgRef/itemsHolder are objects; closures read .current at call time.
  let svgRef;
  let itemsHolder;
  let setPlacedItems;
  let setRuntimeValueSpy;

  const gridSize = 30; // max clamped cell is 29
  const campaignName = 'test-campaign';
  const mapData = { name: 'test-map' };

  // Fixed transforms keep every geometry assertion deterministic.
  const svgMock = (overrides = {}) => ({
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    createSVGPoint: () => ({
      x: 0,
      y: 0,
      matrixTransform: () => ({ x: 100, y: 100 }),
    }),
    getScreenCTM: () => ({ inverse: () => ({}) }),
    ...overrides,
  });

  const svgMockAt = (x, y) =>
    svgMock({ createSVGPoint: () => ({ x: 0, y: 0, matrixTransform: () => ({ x, y }) }) });

  const mockEvent = (overrides = {}) => ({
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
    button: 0,
    clientX: 100,
    clientY: 100,
    pointerId: 1,
    ...overrides,
  });

  const getHook = ({ rulerMode = false, spellMode = false, campaign = campaignName } = {}) =>
    renderHook(() =>
      useItemDragging({
        svgRef,
        placedItems: itemsHolder.current,
        setPlacedItems,
        gridSize,
        gridCenterX: (x) => x * CELL_SIZE + CELL_SIZE / 2,
        gridCenterY: (y) => y * CELL_SIZE + CELL_SIZE / 2,
        rulerMode,
        spellMode,
        campaignName: campaign,
        mapData,
      })
    );

  // Begin a drag of `itemId` with the default svg (SVG point 100,100).
  const setupDrag = (itemId, hookOverrides = {}) => {
    svgRef.current = svgMock();
    const helpers = getHook(hookOverrides);
    const event = mockEvent();
    act(() => {
      helpers.result.current.handleItemPointerDown(event, itemId);
    });
    return { ...helpers, event };
  };

  const moveTokenTo = (result, x, y) => {
    svgRef.current = svgMockAt(x, y);
    act(() => {
      result.current.handleItemPointerMove(mockEvent({ clientX: x, clientY: y }));
    });
  };

  beforeEach(() => {
    svgRef = { current: null };
    itemsHolder = {
      current: [
        { id: 'item1', name: 'PlayerToken', type: 'player', gridX: 1, gridY: 1 },
        { id: 'item2', name: 'MonsterToken', type: 'monster', gridX: 2, gridY: 2 },
      ],
    };
    // Acts like React setState: applies the updater and stores the new array
    // so rerender()/later calls observe fresh data.
    setPlacedItems = vi.fn((fn) => {
      const next = typeof fn === 'function' ? fn(itemsHolder.current) : fn;
      itemsHolder.current = next;
      return next;
    });
    setRuntimeValueSpy = vi.spyOn(runtimeState, 'setRuntimeValue').mockReturnValue(undefined);
    setRuntimeValueSpy.mockClear();
    mocks.onTokenMoveLanded.mockClear();
  });

  it('exposes null drag state and the four pointer handlers initially', () => {
    const { result } = getHook();
    expect(result.current.itemDragging).toBeNull();
    expect(typeof result.current.handleItemPointerDown).toBe('function');
    expect(typeof result.current.handleItemPointerMove).toBe('function');
    expect(typeof result.current.handleItemPointerUp).toBe('function');
    expect(typeof result.current.handleItemPointerLeave).toBe('function');
  });

  describe('mode guards', () => {
    it.each([
      ['rulerMode', { rulerMode: true }],
      ['spellMode', { spellMode: true }],
    ])('leaves the event untouched and starts no drag when %s is enabled', (_, overrides) => {
      svgRef.current = svgMock();
      const event = mockEvent();
      const { result } = getHook(overrides);
      act(() => {
        result.current.handleItemPointerDown(event, 'item1');
      });
      expect(result.current.itemDragging).toBeNull();
      expect(event.stopPropagation).not.toHaveBeenCalled();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('handleItemPointerDown', () => {
    it('claims the pointer and opens drag state with exact offset and mover bytes', () => {
      const { result, event } = setupDrag('item1');
      expect(event.stopPropagation).toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
      expect(svgRef.current.setPointerCapture).toHaveBeenCalledWith(1);
      // SVG point (100,100) minus center of cell (1,1) = (60,60) with CELL_SIZE 40.
      expect(result.current.itemDragging).toEqual({
        itemId: 'item1',
        pointerId: 1,
        offsetX: 40,
        offsetY: 40,
        startGridX: 1,
        startGridY: 1,
        moverName: 'PlayerToken',
        moverIsPlayer: true,
      });
    });

    it('does not preventDefault or start a drag for non-left buttons', () => {
      svgRef.current = svgMock();
      const event = mockEvent({ button: 2 });
      const { result } = getHook();
      act(() => {
        result.current.handleItemPointerDown(event, 'item1');
      });
      expect(result.current.itemDragging).toBeNull();
      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it.each([
      ['svgRef is null', null, 'item1'],
      ['getScreenCTM returns null', svgMock({ getScreenCTM: () => null }), 'item1'],
      ['item id is unknown', svgMock(), 'nonexistent'],
    ])('starts no drag and writes nothing when %s', (_, svg, itemId) => {
      svgRef.current = svg;
      const event = mockEvent();
      const { result } = getHook();
      act(() => {
        result.current.handleItemPointerDown(event, itemId);
      });
      expect(result.current.itemDragging).toBeNull();
      expect(setPlacedItems).not.toHaveBeenCalled();
      expect(setRuntimeValueSpy).not.toHaveBeenCalled();
      // #883: a failed down must never touch the pointer — capture happens only
      // once the drag actually starts (svgRef-null row has no spy to read).
      if (svgRef.current) {
        expect(svgRef.current.setPointerCapture).not.toHaveBeenCalled();
      }
    });
  });

  describe('handleItemPointerMove', () => {
    it('snaps token to exact cell bytes and flags steady-aim for a moving player', () => {
      const { result } = setupDrag('item1');
      moveTokenTo(result, 150, 150);
      // 150 - offsetX(40) = 110 → floor(110 / 40) = 2
      expect(setPlacedItems).toHaveBeenCalledTimes(1);
      expect(itemsHolder.current).toEqual([
        { id: 'item1', name: 'PlayerToken', type: 'player', gridX: 2, gridY: 2 },
        { id: 'item2', name: 'MonsterToken', type: 'monster', gridX: 2, gridY: 2 },
      ]);
      expect(setRuntimeValueSpy).toHaveBeenCalledWith(
        'PlayerToken',
        'steadyAimMovedThisTurn',
        true,
        campaignName
      );
    });

    it.each([
      ['far off the top-left', -100, -100, 0, 0],
      ['far past the bottom-right', 99999, 99999, 29, 29],
    ])('clamps the snapped cell to exact bytes when dragged %s', (_, x, y, cellX, cellY) => {
      const { result } = setupDrag('item1');
      moveTokenTo(result, x, y);
      const moved = itemsHolder.current.find((i) => i.id === 'item1');
      expect({ gridX: moved.gridX, gridY: moved.gridY }).toEqual({ gridX: cellX, gridY: cellY });
    });

    it.each([
      ['no drag is active', false, () => {}],
      ['svgRef becomes null mid-drag', true, () => { svgRef.current = null; }],
      ['getScreenCTM returns null mid-drag', true, () => { svgRef.current = svgMock({ getScreenCTM: () => null }); }],
    ])('writes nothing during move when %s', (_, startDrag, mutate) => {
      const { result } = startDrag ? setupDrag('item1') : getHook();
      mutate();
      act(() => {
        result.current.handleItemPointerMove(mockEvent());
      });
      expect(setPlacedItems).not.toHaveBeenCalled();
      expect(setRuntimeValueSpy).not.toHaveBeenCalled();
    });

    it.each([
      ['player stays in the same cell', 'item1', campaignName, 100, 100],
      ['non-player token moves', 'item2', campaignName, 150, 150],
      ['campaign name is missing', 'item1', null, 150, 150],
    ])('does NOT flag steady-aim when %s', (_, itemId, campaign, x, y) => {
      const { result } = setupDrag(itemId, { campaign });
      moveTokenTo(result, x, y);
      expect(setRuntimeValueSpy).not.toHaveBeenCalled();
    });

    it('falls back to item.id for the steady-aim key when name is missing', () => {
      itemsHolder.current = [{ id: 'orphan-token', type: 'player', gridX: 1, gridY: 1 }];
      const { result } = setupDrag('orphan-token');
      moveTokenTo(result, 150, 150);
      expect(setRuntimeValueSpy).toHaveBeenCalledWith(
        'orphan-token',
        'steadyAimMovedThisTurn',
        true,
        campaignName
      );
    });
  });

  describe('handleItemPointerUp / handleItemPointerLeave', () => {
    it.each([
      ['up', (r) => r.current.handleItemPointerUp(mockEvent())],
      ['leave', (r) => r.current.handleItemPointerLeave({ pointerId: 1 })],
    ])('does nothing when %s fires without a drag', (_, handler) => {
      svgRef.current = svgMock();
      const { result } = getHook();
      act(() => {
        handler(result);
      });
      expect(result.current.itemDragging).toBeNull();
      expect(svgRef.current.releasePointerCapture).not.toHaveBeenCalled();
      expect(mocks.onTokenMoveLanded).not.toHaveBeenCalled();
    });

    it.each([
      ['up', (r) => r.current.handleItemPointerUp(mockEvent())],
      ['leave', (r) => r.current.handleItemPointerLeave({ pointerId: 1 })],
    ])('%s releases pointer capture and clears drag state', (_, handler) => {
      const { result } = setupDrag('item1');
      expect(result.current.itemDragging).not.toBeNull();
      act(() => {
        handler(result);
      });
      expect(result.current.itemDragging).toBeNull();
      expect(svgRef.current.releasePointerCapture).toHaveBeenCalledWith(1);
    });
  });

  // #883 capture discipline: setPointerCapture must run AFTER every down-guard
  // (useRuler.js is the house pattern), so itemDragging !== null strictly implies
  // captured, and failed starts strand nothing.
  describe('pointer capture discipline (#883)', () => {
    it.each([
      ['getScreenCTM returns null', () => svgMock({ getScreenCTM: () => null }), 'item1'],
      ['item id is unknown', () => svgMock(), 'nonexistent'],
    ])('failed down (%s): zero capture calls and terminals stay silent', (_, makeSvg, itemId) => {
      svgRef.current = makeSvg();
      const event = mockEvent();
      const { result } = getHook();
      act(() => {
        result.current.handleItemPointerDown(event, itemId);
      });
      expect(result.current.itemDragging).toBeNull();
      expect(svgRef.current.setPointerCapture).not.toHaveBeenCalled();
      expect(svgRef.current.releasePointerCapture).not.toHaveBeenCalled();
      // up/leave bail on null state — safe only because the failed down never captured.
      act(() => {
        result.current.handleItemPointerUp(mockEvent());
      });
      act(() => {
        result.current.handleItemPointerLeave({ pointerId: 1 });
      });
      expect(svgRef.current.releasePointerCapture).not.toHaveBeenCalled();
    });

    it('orders every down guard before the pointer capture (call-order ledger)', () => {
      const getScreenCTM = vi.fn(() => ({ inverse: () => ({}) }));
      svgRef.current = svgMock({ getScreenCTM });
      const event = mockEvent();
      const { result } = getHook();
      act(() => {
        result.current.handleItemPointerDown(event, 'item1');
      });
      expect(result.current.itemDragging).not.toBeNull();
      expect(svgRef.current.setPointerCapture).toHaveBeenCalledTimes(1);
      const captureOrder = svgRef.current.setPointerCapture.mock.invocationCallOrder[0];
      expect(event.stopPropagation.mock.invocationCallOrder[0]).toBeLessThan(captureOrder);
      expect(event.preventDefault.mock.invocationCallOrder[0]).toBeLessThan(captureOrder);
      expect(getScreenCTM.mock.invocationCallOrder[0]).toBeLessThan(captureOrder);
    });

    it('pairs capture and release exactly once per pointerId across up then leave', () => {
      const { result, event } = setupDrag('item1');
      expect(svgRef.current.setPointerCapture).toHaveBeenCalledTimes(1);
      expect(svgRef.current.releasePointerCapture).not.toHaveBeenCalled();
      act(() => {
        result.current.handleItemPointerUp(event);
      });
      expect(svgRef.current.releasePointerCapture).toHaveBeenCalledTimes(1);
      expect(svgRef.current.releasePointerCapture).toHaveBeenCalledWith(1);
      // Late leave after up must not double-release (state already cleared).
      act(() => {
        result.current.handleItemPointerLeave({ pointerId: 1 });
      });
      expect(svgRef.current.releasePointerCapture).toHaveBeenCalledTimes(1);
      expect(svgRef.current.setPointerCapture).toHaveBeenCalledTimes(1);
    });
  });

  // Synthetic/assistive pointerdown (evaluate-dispatched PointerEvents, some AT
  // input) has no active pointer, so setPointerCapture throws NotFoundError.
  // The down lane must swallow it and complete drag-start; the items lane keeps
  // working (capture loss only degrades event routing, #883 companion).
  describe('throwing setPointerCapture (synthetic pointer guard)', () => {
    const notFound = () => {
      const err = new Error('No active pointer with the given id is found.');
      err.name = 'NotFoundError';
      return err;
    };

    it('completes drag-start without throwing when capture fails', () => {
      const svg = svgMock();
      svg.setPointerCapture = vi.fn(() => {
        throw notFound();
      });
      svgRef.current = svg;
      const { result } = getHook();
      const event = mockEvent();
      expect(() => {
        act(() => {
          result.current.handleItemPointerDown(event, 'item1');
        });
      }).not.toThrow();
      expect(svg.setPointerCapture).toHaveBeenCalledTimes(1);
      expect(svg.setPointerCapture).toHaveBeenCalledWith(1);
      // Drag-start logic ran to completion: full ghost bytes, not a partial state.
      expect(result.current.itemDragging).toMatchObject({
        itemId: 'item1',
        pointerId: 1,
        offsetX: 40, // point 100 - center(1) 60
        offsetY: 40,
        startGridX: 1,
        startGridY: 1,
        moverName: 'PlayerToken',
        moverIsPlayer: true,
      });
    });

    it('the whole drag lane (down, move, commit) still runs when capture throws', () => {
      const svg = svgMock();
      svg.setPointerCapture = vi.fn(() => {
        throw notFound();
      });
      svgRef.current = svg;
      const { result, rerender } = getHook();
      act(() => {
        result.current.handleItemPointerDown(mockEvent(), 'item1');
      });
      expect(result.current.itemDragging).not.toBeNull();
      moveTokenTo(result, 150, 150); // cell (2,2)
      expect(itemsHolder.current[0]).toMatchObject({ gridX: 2, gridY: 2 });
      act(() => rerender());
      act(() => {
        result.current.handleItemPointerUp(mockEvent());
      });
      expect(result.current.itemDragging).toBeNull();
      expect(mocks.onTokenMoveLanded).toHaveBeenCalledTimes(1);
      expect(mocks.onTokenMoveLanded).toHaveBeenCalledWith(
        expect.objectContaining({ toCell: { gridX: 2, gridY: 2 } })
      );
    });
  });

  describe('opportunity-trigger commit (drop landed)', () => {
    it('calls onTokenMoveLanded exactly once with exact payload when dropped on a new cell', () => {
      const { result, rerender } = setupDrag('item1');
      moveTokenTo(result, 150, 150);
      // placedItems flows through props — rerender so the up handler sees the moved token.
      act(() => rerender());
      act(() => {
        result.current.handleItemPointerUp(mockEvent());
      });
      expect(mocks.onTokenMoveLanded).toHaveBeenCalledTimes(1);
      expect(mocks.onTokenMoveLanded).toHaveBeenCalledWith({
        campaignName,
        moverName: 'PlayerToken',
        moverIsPlayer: true,
        fromCell: { gridX: 1, gridY: 1 },
        toCell: { gridX: 2, gridY: 2 },
        mapData,
      });
    });

    it('does NOT commit when dropped on the same cell', () => {
      const { result, rerender } = setupDrag('item1');
      act(() => rerender());
      act(() => {
        result.current.handleItemPointerUp(mockEvent());
      });
      expect(mocks.onTokenMoveLanded).not.toHaveBeenCalled();
    });

    it('does NOT commit when the drag is cancelled via pointer leave', () => {
      const { result, rerender } = setupDrag('item1');
      moveTokenTo(result, 150, 150);
      act(() => rerender());
      act(() => {
        result.current.handleItemPointerLeave({ pointerId: 1 });
      });
      expect(mocks.onTokenMoveLanded).not.toHaveBeenCalled();
    });

    it('does NOT commit when campaignName is missing', () => {
      const { result, rerender } = setupDrag('item1', { campaign: null });
      moveTokenTo(result, 150, 150);
      act(() => rerender());
      act(() => {
        result.current.handleItemPointerUp(mockEvent());
      });
      expect(mocks.onTokenMoveLanded).not.toHaveBeenCalled();
    });
  });
});
