// @improved-by-ai
// @cleaned-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import usePlayerDragging from './usePlayerDragging.js';
import { CELL_SIZE } from '../../../config/mapConfig.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

describe('usePlayerDragging', () => {
  // Shared mutable containers so useCallback closures always see current values.
  // The hook's useCallback captures mapData/svgRef by reference at render time.
  // By using objects whose .current properties are reassigned, the closures
  // see updates because they reference the object, not the primitive value.
  let svgRef;
  let mapDataHolder;
  let setMapData;
  let gridCenterX;
  let gridCenterY;
  let setRuntimeValueSpy;

  const gridSize = 30;
  const campaignName = 'test-campaign';

  const defaultSvgMock = (overrides = {}) => ({
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    createSVGPoint: () => ({
      x: 0,
      y: 0,
      matrixTransform: () => ({ x: 60, y: 80 }),
    }),
    getScreenCTM: () => ({ inverse: () => ({ x: 1, y: 1 }) }),
    ...overrides,
  });

  const createSvgMockWithTransform = (transformFn, overrides = {}) => ({
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    createSVGPoint: () => ({
      x: 0,
      y: 0,
      matrixTransform: transformFn,
    }),
    getScreenCTM: () => ({ inverse: () => ({ x: 1, y: 1 }) }),
    ...overrides,
  });

  const createMockEvent = (overrides = {}) => ({
    pointerId: 1,
    clientX: 100,
    clientY: 100,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
    ...overrides,
  });

  const getHook = (overrides = {}) => {
    const { result } = renderHook(() =>
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
    return result;
  };

  const setupDrag = (playerId, svgOverrides = {}, hookOverrides = {}, dragEventOverrides = {}) => {
    const mockEvent = createMockEvent(dragEventOverrides);
    svgRef.current = defaultSvgMock(svgOverrides);
    const result = getHook(hookOverrides);
    act(() => {
      result.current.handlePointerDown(mockEvent, playerId);
    });
    return { result };
  };

  beforeEach(() => {
    svgRef = { current: null };
    mapDataHolder = {
      current: {
        players: [
          { id: 'p1', name: 'Player1', gridX: 1, gridY: 2 },
          { id: 'p2', name: 'Player2', gridX: 5, gridY: 5 },
          { id: 'p3', name: 'Player3', gridX: 10, gridY: 10 },
        ],
      },
    };

    // setMapData updates mapDataHolder.current so the hook sees new data on next render.
    // The mock returns a NEW object each time (like React setState), which triggers
    // the useCallback dependency to update on the next render.
    setMapData = vi.fn((fn) => {
      if (typeof fn === 'function') {
        const result = fn(mapDataHolder.current);
        mapDataHolder.current = result;
        return result;
      }
      mapDataHolder.current = fn;
      return fn;
    });

    gridCenterX = (x) => x * CELL_SIZE + CELL_SIZE / 2;
    gridCenterY = (y) => y * CELL_SIZE + CELL_SIZE / 2;
    setRuntimeValueSpy = vi
      .spyOn(runtimeState, 'setRuntimeValue')
      .mockReturnValue(undefined);
  });

  describe('initial state', () => {
    it('should return dragging as null initially', () => {
      const result = getHook();
      expect(result.current.dragging).toBeNull();
    });

    it('should return all handler functions', () => {
      const result = getHook();
      expect(typeof result.current.handlePointerDown).toBe('function');
      expect(typeof result.current.handlePointerMove).toBe('function');
      expect(typeof result.current.handlePointerUp).toBe('function');
      expect(typeof result.current.handlePointerLeave).toBe('function');
    });
  });

  describe('mode guards (rulerMode and spellMode)', () => {
    it.each([
      ['rulerMode', { rulerMode: true }],
      ['spellMode', { spellMode: true }],
    ])('should not start drag when %s is enabled', (_, overrides) => {
      const mockEvent = createMockEvent();
      const result = getHook(overrides);
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });
      expect(mockEvent.stopPropagation).not.toHaveBeenCalled();
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(result.current.dragging).toBeNull();
    });
  });

  describe('handlePointerDown', () => {
    it('should call stopPropagation and preventDefault on the event', () => {
      const mockEvent = createMockEvent();
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });
      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should capture pointer on svg', () => {
      const setPointerCapture = vi.fn();
      svgRef.current = defaultSvgMock({ setPointerCapture });
      const mockEvent = createMockEvent({ pointerId: 42 });
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });
      expect(setPointerCapture).toHaveBeenCalledWith(42);
    });

    it('should set dragging state with correct properties', () => {
      svgRef.current = defaultSvgMock();
      const mockEvent = createMockEvent({ pointerId: 42 });
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });
      const dragging = result.current.dragging;
      expect(dragging).not.toBeNull();
      expect(dragging.playerId).toBe('p1');
      expect(dragging.pointerId).toBe(42);
      expect(typeof dragging.offsetX).toBe('number');
      expect(typeof dragging.offsetY).toBe('number');
    });

    it('should return early when svgRef is null', () => {
      const mockEvent = createMockEvent();
      svgRef.current = null;
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });
      expect(result.current.dragging).toBeNull();
    });

    it('should return early when ctm is null', () => {
      const mockEvent = createMockEvent();
      svgRef.current = {
        setPointerCapture: vi.fn(),
        createSVGPoint: () => ({ x: 0, y: 0 }),
        getScreenCTM: () => null,
      };
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });
      expect(result.current.dragging).toBeNull();
    });

    it('should return early when player is not found', () => {
      const mockEvent = createMockEvent();
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'nonexistent');
      });
      expect(result.current.dragging).toBeNull();
    });
  });

  describe('handlePointerMove', () => {
    it('should do nothing when not dragging', () => {
      const result = getHook();
      act(() => {
        result.current.handlePointerMove({ preventDefault: vi.fn() });
      });
      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should update player grid position during drag', () => {
      const { result } = setupDrag('p1');
      // Move to SVG coordinates (150, 150) → grid cell (3, 3)
      svgRef.current = createSvgMockWithTransform(() => ({ x: 150, y: 150 }));
      act(() => {
        result.current.handlePointerMove({
          preventDefault: vi.fn(),
          clientX: 150,
          clientY: 150,
        });
      });
      expect(setMapData).toHaveBeenCalled();
      const updated = setMapData.mock.calls[0][0](mapDataHolder.current);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(3);
      expect(player.gridY).toBe(4);
    });

    it('should clamp grid position to minimum bounds (0, 0)', () => {
      const { result } = setupDrag('p1');
      svgRef.current = createSvgMockWithTransform(() => ({ x: -100, y: -100 }));
      act(() => {
        result.current.handlePointerMove({
          preventDefault: vi.fn(),
          clientX: -100,
          clientY: -100,
        });
      });
      expect(setMapData).toHaveBeenCalled();
      const updated = setMapData.mock.calls[0][0](mapDataHolder.current);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(0);
      expect(player.gridY).toBe(0);
    });

    it('should clamp grid position to maximum bounds (gridSize - 1)', () => {
      const { result } = setupDrag('p1');
      svgRef.current = createSvgMockWithTransform(() => ({
        x: 99999,
        y: 99999,
      }));
      act(() => {
        result.current.handlePointerMove({
          preventDefault: vi.fn(),
          clientX: 99999,
          clientY: 99999,
        });
      });
      expect(setMapData).toHaveBeenCalled();
      const updated = setMapData.mock.calls[0][0](mapDataHolder.current);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(gridSize - 1);
      expect(player.gridY).toBe(gridSize - 1);
    });

    it('should do nothing when svgRef is null', () => {
      const { result } = setupDrag('p1');
      svgRef.current = null;
      act(() => {
        result.current.handlePointerMove({
          preventDefault: vi.fn(),
          clientX: 150,
          clientY: 150,
        });
      });
      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should do nothing when ctm is null', () => {
      const { result } = setupDrag('p1');
      svgRef.current = {
        createSVGPoint: () => ({ x: 0, y: 0 }),
        getScreenCTM: () => null,
      };
      act(() => {
        result.current.handlePointerMove({
          preventDefault: vi.fn(),
          clientX: 150,
          clientY: 150,
        });
      });
      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should do nothing when dragged player is not found', () => {
      mapDataHolder.current = { players: [] };
      const mockEvent = createMockEvent();
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });
      act(() => {
        result.current.handlePointerMove({
          preventDefault: vi.fn(),
          clientX: 150,
          clientY: 150,
        });
      });
      expect(setMapData).not.toHaveBeenCalled();
    });
  });

  describe('handlePointerUp', () => {
    it('should do nothing when not dragging', () => {
      const result = getHook();
      act(() => {
        result.current.handlePointerUp({
          preventDefault: vi.fn(),
          pointerId: 1,
          clientX: 0,
          clientY: 0,
        });
      });
      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should release pointer capture on svg', () => {
      const releasePointerCapture = vi.fn();
      const { result } = setupDrag('p1', { releasePointerCapture });
      const upEvent = {
        preventDefault: vi.fn(),
        pointerId: 1,
        clientX: 60,
        clientY: 80,
      };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });
      expect(releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('should set dragging to null after pointer up', () => {
      const mockEvent = createMockEvent();
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });
      const upEvent = {
        preventDefault: vi.fn(),
        pointerId: 1,
        clientX: 60,
        clientY: 80,
      };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });
      expect(result.current.dragging).toBeNull();
    });

    it('should update player position on pointer up', () => {
      const mockEvent = createMockEvent();
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });
      svgRef.current = createSvgMockWithTransform(() => ({
        x: 120,
        y: 160,
      }));
      const upEvent = {
        preventDefault: vi.fn(),
        pointerId: 1,
        clientX: 120,
        clientY: 160,
      };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });
      expect(setMapData).toHaveBeenCalled();
      const updated = setMapData.mock.calls[0][0](mapDataHolder.current);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(3);
      expect(player.gridY).toBe(4);
    });

    it('should clamp final position to minimum grid bounds', () => {
      const { result } = setupDrag('p1');
      svgRef.current = createSvgMockWithTransform(() => ({
        x: -100,
        y: -100,
      }));
      const upEvent = {
        preventDefault: vi.fn(),
        pointerId: 1,
        clientX: -100,
        clientY: -100,
      };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });
      expect(setMapData).toHaveBeenCalled();
      const updated = setMapData.mock.calls[0][0](mapDataHolder.current);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(0);
      expect(player.gridY).toBe(0);
    });

    it('should clamp final position to maximum grid bounds', () => {
      const { result } = setupDrag('p1');
      svgRef.current = createSvgMockWithTransform(() => ({
        x: 99999,
        y: 99999,
      }));
      const upEvent = {
        preventDefault: vi.fn(),
        pointerId: 1,
        clientX: 99999,
        clientY: 99999,
      };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });
      expect(setMapData).toHaveBeenCalled();
      const updated = setMapData.mock.calls[0][0](mapDataHolder.current);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(gridSize - 1);
      expect(player.gridY).toBe(gridSize - 1);
    });

    it('should do nothing when ctm is null (clears dragging)', () => {
      const mockEvent = createMockEvent();
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });
      svgRef.current = {
        createSVGPoint: () => ({ x: 0, y: 0 }),
        getScreenCTM: () => null,
      };
      const upEvent = {
        preventDefault: vi.fn(),
        pointerId: 1,
        clientX: 0,
        clientY: 0,
      };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });
      expect(result.current.dragging).toBeNull();
      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should not call setRuntimeValue when player stays in same position', () => {
      setRuntimeValueSpy.mockClear();
      const mockEvent = createMockEvent();
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });
      // Move to same position as default transform (60, 80) which is p1's start
      const upEvent = {
        preventDefault: vi.fn(),
        pointerId: 1,
        clientX: 60,
        clientY: 80,
      };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });
      expect(setRuntimeValueSpy).not.toHaveBeenCalled();
    });

    it('should call setRuntimeValue when player moves to a different position', () => {
      const mockEvent = createMockEvent();
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });
      svgRef.current = createSvgMockWithTransform(() => ({
        x: 120,
        y: 160,
      }));
      const upEvent = {
        preventDefault: vi.fn(),
        pointerId: 1,
        clientX: 120,
        clientY: 160,
      };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });
      expect(setRuntimeValueSpy).toHaveBeenCalledWith(
        'Player1',
        'steadyAimMovedThisTurn',
        true,
        campaignName
      );
    });

    it('should use player.id when player.name is missing', () => {
      mapDataHolder.current = {
        players: [{ id: 'orphan-token', gridX: 0, gridY: 0 }],
      };
      const mockEvent = createMockEvent();
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'orphan-token');
      });
      svgRef.current = createSvgMockWithTransform(() => ({
        x: 120,
        y: 160,
      }));
      const upEvent = {
        preventDefault: vi.fn(),
        pointerId: 1,
        clientX: 120,
        clientY: 160,
      };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });
      expect(setRuntimeValueSpy).toHaveBeenCalledWith(
        'orphan-token',
        'steadyAimMovedThisTurn',
        true,
        campaignName
      );
    });

    it('should find nearest unoccupied square when target is occupied', () => {
      mapDataHolder.current = {
        players: [
          { id: 'p1', name: 'Player1', gridX: 5, gridY: 5 },
          { id: 'p2', name: 'Player2', gridX: 5, gridY: 6 },
          { id: 'p3', name: 'Player3', gridX: 6, gridY: 5 },
          { id: 'p4', name: 'Player4', gridX: 4, gridY: 5 },
          { id: 'p5', name: 'Player5', gridX: 5, gridY: 4 },
        ],
      };
      const mockEvent = createMockEvent();
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });
      // Target (5,5) is p1's own position, excluded from occupiedSquares, so p1 stays
      svgRef.current = createSvgMockWithTransform(() => ({
        x: 60,
        y: 80,
      }));
      const upEvent = {
        preventDefault: vi.fn(),
        pointerId: 1,
        clientX: 60,
        clientY: 80,
      };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });
      expect(setMapData).toHaveBeenCalled();
      const updated = setMapData.mock.calls[0][0](mapDataHolder.current);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(5);
      expect(player.gridY).toBe(5);
    });

    it('should move to free square via BFS when target is occupied', () => {
      mapDataHolder.current = {
        players: [
          { id: 'p1', name: 'Player1', gridX: 0, gridY: 0 },
          { id: 'p2', name: 'Player2', gridX: 1, gridY: 0 },
          { id: 'p3', name: 'Player3', gridX: 0, gridY: 1 },
          { id: 'p4', name: 'Player4', gridX: 1, gridY: 1 },
        ],
      };
      const mockEvent = createMockEvent();
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });
      // Target (1,2) is free, so p1 moves there directly
      svgRef.current = createSvgMockWithTransform(() => ({
        x: 100,
        y: 160,
      }));
      const upEvent = {
        preventDefault: vi.fn(),
        pointerId: 1,
        clientX: 100,
        clientY: 160,
      };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });
      expect(setMapData).toHaveBeenCalled();
      const updated = setMapData.mock.calls[0][0](mapDataHolder.current);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(1);
      expect(player.gridY).toBe(2);
    });
  });

  describe('movement constraints (walls, closed doors, reachability)', () => {
    const fullWallX = (x) => {
      const wall = new Set();
      for (let y = 0; y < gridSize; y++) wall.add(`${x},${y}`);
      return wall;
    };

    it('should not move the player onto a wall cell during drag', () => {
      const { result } = setupDrag('p1', {}, { walls: fullWallX(3) });
      // p1 is at (1,2); pointer at (260,100) → target cell (6,3) across the wall
      svgRef.current = createSvgMockWithTransform(() => ({ x: 260, y: 100 }));
      act(() => {
        result.current.handlePointerMove({ preventDefault: vi.fn(), clientX: 260, clientY: 100 });
      });
      expect(setMapData).not.toHaveBeenCalled();
      expect(result.current.dragging.invalid).toBe(true);
    });

    it('should clear the invalid flag when the pointer returns to a walkable cell', () => {
      const { result } = setupDrag('p1', {}, { walls: fullWallX(3) });
      svgRef.current = createSvgMockWithTransform(() => ({ x: 260, y: 100 }));
      act(() => {
        result.current.handlePointerMove({ preventDefault: vi.fn(), clientX: 260, clientY: 100 });
      });
      expect(result.current.dragging.invalid).toBe(true);
      // pointer at (100,100) → target cell (2,3), still on the walkable side
      svgRef.current = createSvgMockWithTransform(() => ({ x: 100, y: 100 }));
      act(() => {
        result.current.handlePointerMove({ preventDefault: vi.fn(), clientX: 100, clientY: 100 });
      });
      expect(setMapData).toHaveBeenCalledTimes(1);
      const updated = setMapData.mock.calls[0][0](mapDataHolder.current);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(2);
      expect(player.gridY).toBe(3);
      expect(result.current.dragging.invalid).toBe(false);
    });

    it('should block movement through a closed door in a wall line', () => {
      const wall = new Set();
      for (let y = 0; y < gridSize; y++) {
        if (y !== 2) wall.add(`3,${y}`);
      }
      const { result } = setupDrag('p1', {}, {
        walls: wall,
        placedItems: [{ type: 'door', open: false, gridX: 3, gridY: 2 }],
      });
      // pointer at (220,80) → target cell (5,2), across the closed door
      svgRef.current = createSvgMockWithTransform(() => ({ x: 220, y: 80 }));
      act(() => {
        result.current.handlePointerMove({ preventDefault: vi.fn(), clientX: 220, clientY: 80 });
      });
      expect(setMapData).not.toHaveBeenCalled();
      expect(result.current.dragging.invalid).toBe(true);
    });

    it('should allow movement through an open door in a wall line', () => {
      const wall = new Set();
      for (let y = 0; y < gridSize; y++) {
        if (y !== 2) wall.add(`3,${y}`);
      }
      const { result } = setupDrag('p1', {}, {
        walls: wall,
        placedItems: [{ type: 'door', open: true, gridX: 3, gridY: 2 }],
      });
      svgRef.current = createSvgMockWithTransform(() => ({ x: 220, y: 80 }));
      act(() => {
        result.current.handlePointerMove({ preventDefault: vi.fn(), clientX: 220, clientY: 80 });
      });
      expect(setMapData).toHaveBeenCalledTimes(1);
      const updated = setMapData.mock.calls[0][0](mapDataHolder.current);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(5);
      expect(player.gridY).toBe(2);
    });

    it('should let the GM move the token freely while Shift is held', () => {
      const { result } = setupDrag('p1', {}, { isLocalhost: true, walls: fullWallX(3) }, { shiftKey: true });
      svgRef.current = createSvgMockWithTransform(() => ({ x: 260, y: 100 }));
      act(() => {
        result.current.handlePointerMove({ preventDefault: vi.fn(), clientX: 260, clientY: 100 });
      });
      expect(setMapData).toHaveBeenCalledTimes(1);
      const updated = setMapData.mock.calls[0][0](mapDataHolder.current);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(6);
      expect(player.gridY).toBe(3);
      expect(result.current.dragging.invalid).toBeFalsy();
    });

    it('should let the GM drop on a wall cell while Shift is held', () => {
      const { result } = setupDrag('p1', {}, { isLocalhost: true, walls: fullWallX(3) }, { shiftKey: true });
      svgRef.current = createSvgMockWithTransform(() => ({ x: 220, y: 80 }));
      const upEvent = { preventDefault: vi.fn(), pointerId: 1, clientX: 220, clientY: 80 };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });
      expect(setMapData).toHaveBeenCalledTimes(1);
      const updated = setMapData.mock.calls[0][0](mapDataHolder.current);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(5);
      expect(player.gridY).toBe(2);
    });

    it('should not grant the Shift bypass to non-GM clients', () => {
      const { result } = setupDrag('p1', {}, { isLocalhost: false, walls: fullWallX(3) }, { shiftKey: true });
      svgRef.current = createSvgMockWithTransform(() => ({ x: 260, y: 100 }));
      act(() => {
        result.current.handlePointerMove({ preventDefault: vi.fn(), clientX: 260, clientY: 100 });
      });
      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should snap a drop beyond a wall to the nearest reachable cell', () => {
      const { result } = setupDrag('p1', {}, { walls: fullWallX(3) });
      // Drop target (5,2) is across the wall; nearest reachable cell is (2,2)
      svgRef.current = createSvgMockWithTransform(() => ({ x: 220, y: 80 }));
      const upEvent = { preventDefault: vi.fn(), pointerId: 1, clientX: 220, clientY: 80 };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });
      expect(setMapData).toHaveBeenCalledTimes(1);
      const updated = setMapData.mock.calls[0][0](mapDataHolder.current);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(2);
      expect(player.gridY).toBe(2);
    });

    it('should keep a player pinned when its own cell is blocked (legacy data)', () => {
      mapDataHolder.current = {
        players: [{ id: 'p1', name: 'Player1', gridX: 5, gridY: 5 }],
      };
      const { result } = setupDrag('p1', {}, { walls: new Set(['5,5']) });
      // Drop far away; the only reachable cell is the start cell itself
      svgRef.current = createSvgMockWithTransform(() => ({ x: 500, y: 500 }));
      const upEvent = { preventDefault: vi.fn(), pointerId: 1, clientX: 500, clientY: 500 };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });
      expect(setMapData).toHaveBeenCalledTimes(1);
      const updated = setMapData.mock.calls[0][0](mapDataHolder.current);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(5);
      expect(player.gridY).toBe(5);
    });
  });

  describe('handlePointerLeave', () => {
    it('should release pointer capture when dragging', () => {
      const releasePointerCapture = vi.fn();
      const { result } = setupDrag('p1', { releasePointerCapture });
      const leaveEvent = { pointerId: 1 };
      act(() => {
        result.current.handlePointerLeave(leaveEvent);
      });
      expect(releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('should set dragging to null on pointer leave', () => {
      const mockEvent = createMockEvent();
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });
      const leaveEvent = { pointerId: 1 };
      act(() => {
        result.current.handlePointerLeave(leaveEvent);
      });
      expect(result.current.dragging).toBeNull();
    });

    it('should do nothing when not dragging', () => {
      const result = getHook();
      act(() => {
        result.current.handlePointerLeave({ pointerId: 1 });
      });
      expect(result.current.dragging).toBeNull();
    });

    it('should not release pointer capture when svgRef is null', () => {
      const { result } = setupDrag('p1');
      svgRef.current = null;
      act(() => {
        result.current.handlePointerLeave({ pointerId: 1 });
      });
      expect(result.current.dragging).toBeNull();
    });
  });
});
