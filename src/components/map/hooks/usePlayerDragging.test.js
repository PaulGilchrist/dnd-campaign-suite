// @improved-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import usePlayerDragging from './usePlayerDragging.js';
import { CELL_SIZE } from '../../../config/mapConfig.js';
import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';

describe('usePlayerDragging', () => {
  let svgRef;
  let mapData;
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
      x: 0, y: 0,
      matrixTransform: () => ({ x: 60, y: 80 }),
    }),
    getScreenCTM: () => ({ inverse: () => ({ x: 1, y: 1 }) }),
    ...overrides,
  });

  const createSvgMockWithTransform = (transformFn, overrides = {}) => ({
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    createSVGPoint: () => ({
      x: 0, y: 0,
      matrixTransform: transformFn,
    }),
    getScreenCTM: () => ({ inverse: () => ({ x: 1, y: 1 }) }),
    ...overrides,
  });

  const defaultParams = () => ({
    svgRef,
    mapData,
    gridSize,
    setMapData,
    gridCenterX,
    gridCenterY,
    rulerMode: false,
    spellMode: false,
    campaignName,
  });

  beforeEach(() => {
    svgRef = { current: null };
    mapData = {
      players: [
        { id: 'p1', name: 'Player1', gridX: 1, gridY: 2 },
        { id: 'p2', name: 'Player2', gridX: 5, gridY: 5 },
        { id: 'p3', name: 'Player3', gridX: 10, gridY: 10 },
      ],
    };
    setMapData = vi.fn((fn) => {
      if (typeof fn === 'function') {
        const prev = mapData;
        const result = fn(prev);
        return result;
      }
      return fn;
    });
    gridCenterX = (x) => x * CELL_SIZE + CELL_SIZE / 2;
    gridCenterY = (y) => y * CELL_SIZE + CELL_SIZE / 2;
    setRuntimeValueSpy = vi.spyOn(runtimeState, 'setRuntimeValue').mockReturnValue(undefined);
  });

  const getHook = (overrides = {}) => {
    const { result } = renderHook(() =>
      usePlayerDragging({ ...defaultParams(), ...overrides })
    );
    return result;
  };

  const setupDrag = (playerId, svgOverrides = {}) => {
    const mockEvent = {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
      stopPropagation: vi.fn(),
      preventDefault: vi.fn(),
    };
    svgRef.current = defaultSvgMock(svgOverrides);
    const result = getHook();
    act(() => {
      result.current.handlePointerDown(mockEvent, playerId);
    });
    return { result };
  };

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
      const mockEvent = { stopPropagation: vi.fn(), preventDefault: vi.fn() };
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
    it('should stop propagation and prevent default', () => {
      const mockEvent = {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      };
      svgRef.current = defaultSvgMock();

      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should return early if svgRef is null', () => {
      const mockEvent = {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      };
      svgRef.current = null;

      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });

      expect(result.current.dragging).toBeNull();
    });

    it('should return early if ctm is null', () => {
      const mockEvent = {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      };
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

    it('should return early if player not found', () => {
      const mockEvent = {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      };
      svgRef.current = defaultSvgMock();

      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'nonexistent');
      });

      expect(result.current.dragging).toBeNull();
    });

    it('should set dragging state with correct properties', () => {
      const mockEvent = {
        pointerId: 42,
        clientX: 100,
        clientY: 100,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      };
      svgRef.current = defaultSvgMock();

      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });

      expect(result.current.dragging).toBeDefined();
      expect(result.current.dragging.playerId).toBe('p1');
      expect(result.current.dragging.pointerId).toBe(42);
      expect(typeof result.current.dragging.offsetX).toBe('number');
      expect(typeof result.current.dragging.offsetY).toBe('number');
    });

    it('should capture pointer on svg', () => {
      const mockEvent = {
        pointerId: 42,
        clientX: 100,
        clientY: 100,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      };
      const setPointerCapture = vi.fn();
      svgRef.current = {
        ...defaultSvgMock(),
        setPointerCapture,
      };

      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });

      expect(setPointerCapture).toHaveBeenCalledWith(42);
    });
  });

  describe('handlePointerMove', () => {
    it('should return early if not dragging', () => {
      const mockEvent = { preventDefault: vi.fn() };
      const result = getHook();
      act(() => {
        result.current.handlePointerMove(mockEvent);
      });
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should return early if svgRef is null while dragging', () => {
      const { result } = setupDrag('p1');
      setMapData.mockClear();
      svgRef.current = null;

      const moveEvent = { preventDefault: vi.fn(), clientX: 100, clientY: 100 };
      act(() => {
        result.current.handlePointerMove(moveEvent);
      });

      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should update player grid position during drag', () => {
      const { result } = setupDrag('p1');

      const moveEvent = { preventDefault: vi.fn(), clientX: 250, clientY: 250 };
      act(() => {
        result.current.handlePointerMove(moveEvent);
      });

      expect(setMapData).toHaveBeenCalled();
    });

    it('should clamp grid position to map bounds', () => {
      const { result } = setupDrag('p1');

      const moveEvent = { preventDefault: vi.fn(), clientX: -100, clientY: -100 };
      svgRef.current = createSvgMockWithTransform(() => ({ x: -100, y: -100 }));
      act(() => {
        result.current.handlePointerMove(moveEvent);
      });

      expect(setMapData).toHaveBeenCalled();
      const callArg = setMapData.mock.calls[0][0];
      const updated = callArg(mapData);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(0);
      expect(player.gridY).toBe(0);
    });

    it('should clamp grid position to max bounds during drag', () => {
      const { result } = setupDrag('p1');

      svgRef.current = createSvgMockWithTransform(() => ({ x: 99999, y: 99999 }));
      const moveEvent = { preventDefault: vi.fn(), clientX: 99999, clientY: 99999 };
      act(() => {
        result.current.handlePointerMove(moveEvent);
      });

      expect(setMapData).toHaveBeenCalled();
      const callArg = setMapData.mock.calls[0][0];
      const updated = callArg(mapData);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(gridSize - 1);
      expect(player.gridY).toBe(gridSize - 1);
    });

    it('should not update if player not found during move', () => {
      const { result } = setupDrag('p1');
      mapData.players = mapData.players.filter((p) => p.id !== 'p1');
      setMapData.mockClear();

      const moveEvent = { preventDefault: vi.fn(), clientX: 100, clientY: 100 };
      act(() => {
        result.current.handlePointerMove(moveEvent);
      });

      expect(setMapData).not.toHaveBeenCalled();
    });
  });

  describe('handlePointerUp', () => {
    it('should return early if not dragging', () => {
      const mockEvent = { preventDefault: vi.fn(), pointerId: 1, clientX: 0, clientY: 0 };
      const result = getHook();
      act(() => {
        result.current.handlePointerUp(mockEvent);
      });
      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should release pointer capture on svg', () => {
      const releasePointerCapture = vi.fn();
      const { result } = setupDrag('p1', { releasePointerCapture });

      const upEvent = { preventDefault: vi.fn(), pointerId: 1, clientX: 60, clientY: 80 };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });

      expect(releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('should set dragging to null after pointer up', () => {
      const mockEvent = {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      };
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });

      const upEvent = { preventDefault: vi.fn(), pointerId: 1, clientX: 60, clientY: 80 };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });

      expect(result.current.dragging).toBeNull();
    });

    it('should update player position on pointer up', () => {
      const mockEvent = {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      };
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });

      svgRef.current = createSvgMockWithTransform(() => ({ x: 120, y: 160 }));
      const upEvent = { preventDefault: vi.fn(), pointerId: 1, clientX: 120, clientY: 160 };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });

      expect(setMapData).toHaveBeenCalled();
    });

    it('should clamp final position to grid bounds', () => {
      const { result } = setupDrag('p1');

      svgRef.current = createSvgMockWithTransform(() => ({ x: -100, y: -100 }));
      const upEvent = { preventDefault: vi.fn(), pointerId: 1, clientX: -100, clientY: -100 };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });

      expect(setMapData).toHaveBeenCalled();
      const callArg = setMapData.mock.calls[0][0];
      const updated = callArg(mapData);
      const player = updated.players.find((p) => p.id === 'p1');
      expect(player.gridX).toBe(0);
      expect(player.gridY).toBe(0);
    });

    it('should handle null ctm by setting dragging to null', () => {
      const { result } = setupDrag('p1', { getScreenCTM: () => null });

      const upEvent = { preventDefault: vi.fn(), pointerId: 1, clientX: 60, clientY: 80 };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });

      expect(result.current.dragging).toBeNull();
    });

    it('should handle missing player by setting dragging to null', () => {
      const { result } = setupDrag('p1');
      mapData.players = [];

      const upEvent = { preventDefault: vi.fn(), pointerId: 1, clientX: 60, clientY: 80 };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });

      expect(result.current.dragging).toBeNull();
    });

    it('should find nearest unoccupied square when target is occupied', () => {
      mapData = {
        players: [
          { id: 'p1', name: 'Player1', gridX: 0, gridY: 0 },
          { id: 'p2', name: 'Player2', gridX: 1, gridY: 2 },
        ],
      };

      const mockEvent = {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      };
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });

      // Move to (1,2) which is occupied by p2
      svgRef.current = createSvgMockWithTransform(() => ({ x: 60, y: 120 }));
      const upEvent = { preventDefault: vi.fn(), pointerId: 1, clientX: 60, clientY: 120 };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });

      expect(setMapData).toHaveBeenCalled();
      const callArg = setMapData.mock.calls[0][0];
      const updated = callArg(mapData);
      const player = updated.players.find((p) => p.id === 'p1');
      // Should be placed in nearest unoccupied square, not (1,2)
      expect(player.gridX).not.toBe(1);
      expect(player.gridY).not.toBe(2);
    });

    it('should use BFS to find nearest unoccupied square when surrounded', () => {
      mapData = {
        players: [
          { id: 'p1', name: 'Player1', gridX: 5, gridY: 5 },
          { id: 'p2', name: 'Player2', gridX: 5, gridY: 6 },
          { id: 'p3', name: 'Player3', gridX: 6, gridY: 5 },
          { id: 'p4', name: 'Player4', gridX: 4, gridY: 5 },
          { id: 'p5', name: 'Player5', gridX: 5, gridY: 4 },
        ],
      };

      const mockEvent = {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      };
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });

      // Move to grid (5,5) surrounded by occupied squares
      svgRef.current = createSvgMockWithTransform(() => ({ x: 220, y: 220 }));
      const upEvent = { preventDefault: vi.fn(), pointerId: 1, clientX: 220, clientY: 220 };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });

      expect(setMapData).toHaveBeenCalled();
      const callArg = setMapData.mock.calls[0][0];
      const updated = callArg(mapData);
      const player = updated.players.find((p) => p.id === 'p1');
      // Should find a free square via BFS, not stay at (5,5)
      expect(player.gridX).not.toBe(5);
      expect(player.gridY).not.toBe(5);
    });

    it('should call setRuntimeValue when player moves', () => {
      const mockEvent = {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      };
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });

      // Move to different position
      svgRef.current = createSvgMockWithTransform(() => ({ x: 120, y: 160 }));
      const upEvent = { preventDefault: vi.fn(), pointerId: 1, clientX: 120, clientY: 160 };
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

    it('should not call setRuntimeValue when player does not move', () => {
      const mockEvent = {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      };
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });

      // Move back to same position
      svgRef.current = createSvgMockWithTransform(() => ({ x: 60, y: 80 }));
      const upEvent = { preventDefault: vi.fn(), pointerId: 1, clientX: 60, clientY: 80 };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });

      expect(setRuntimeValueSpy).not.toHaveBeenCalled();
    });

    it('should not call setRuntimeValue when campaignName is not provided', () => {
      svgRef.current = defaultSvgMock();
      const mockEvent = {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      };
      const result = getHook({ campaignName: null });
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });

      const upEvent = { preventDefault: vi.fn(), pointerId: 1, clientX: 120, clientY: 160 };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });

      expect(setRuntimeValueSpy).not.toHaveBeenCalled();
    });

    it('should use player.id when player.name is missing', () => {
      mapData = {
        players: [
          { id: 'p1', gridX: 0, gridY: 0 },
        ],
      };

      const mockEvent = {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      };
      svgRef.current = defaultSvgMock();
      const result = getHook();
      act(() => {
        result.current.handlePointerDown(mockEvent, 'p1');
      });

      // Move to different position
      svgRef.current = createSvgMockWithTransform(() => ({ x: 120, y: 160 }));
      const upEvent = { preventDefault: vi.fn(), pointerId: 1, clientX: 120, clientY: 160 };
      act(() => {
        result.current.handlePointerUp(upEvent);
      });

      expect(setRuntimeValueSpy).toHaveBeenCalledWith(
        'p1',
        'steadyAimMovedThisTurn',
        true,
        campaignName
      );
    });
  });

  describe('handlePointerLeave', () => {
    it('should return early if not dragging', () => {
      const mockEvent = { pointerId: 1 };
      const result = getHook();
      act(() => {
        result.current.handlePointerLeave(mockEvent);
      });
      expect(result.current.dragging).toBeNull();
    });

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
      const mockEvent = {
        pointerId: 1,
        clientX: 100,
        clientY: 100,
        stopPropagation: vi.fn(),
        preventDefault: vi.fn(),
      };
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

    it('should handle null svgRef gracefully', () => {
      const { result } = setupDrag('p1');
      svgRef.current = null;

      const leaveEvent = { pointerId: 1 };
      act(() => {
        result.current.handlePointerLeave(leaveEvent);
      });

      expect(result.current.dragging).toBeNull();
    });
  });
});