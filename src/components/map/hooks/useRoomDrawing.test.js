import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useRoomDrawing from './useRoomDrawing.js';
import * as mapRoomUtils from '../../../services/maps/mapRoomUtils.js';

describe('useRoomDrawing', () => {
  let getGridFromEvent;
  let svgRef;

  beforeEach(() => {
    getGridFromEvent = vi.fn(() => ({ gridX: 5.5, gridY: 7.5 }));
    svgRef = { current: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() } };
  });

  const getHook = (overrides = {}) => {
    const { result } = renderHook(() =>
      useRoomDrawing({
        isLocalhost: true,
        tool: 'room',
        getGridFromEvent,
        svgRef,
        ...overrides,
      })
    );
    return result;
  };

  describe('initial state', () => {
    it('should initialize with null roomDrawStart', () => {
      const result = getHook();
      expect(result.current.roomDrawStart).toBeNull();
    });

    it('should initialize with null roomDrawRect', () => {
      const result = getHook();
      expect(result.current.roomDrawRect).toBeNull();
    });

    it('should initialize with null selectedRoom', () => {
      const result = getHook();
      expect(result.current.selectedRoom).toBeNull();
    });

    it('should return all handler functions', () => {
      const result = getHook();
      expect(typeof result.current.handleRoomPointerDown).toBe('function');
      expect(typeof result.current.handleRoomPointerMove).toBe('function');
      expect(typeof result.current.handleRoomPointerUp).toBe('function');
      expect(typeof result.current.handleRoomClick).toBe('function');
      expect(typeof result.current.setSelectedRoom).toBe('function');
    });
  });

  describe('handleRoomPointerDown', () => {
    it('should set roomDrawStart and roomDrawRect when conditions are met', () => {
      const result = getHook();
      const mockEvent = { pointerId: 1, preventDefault: vi.fn() };
      act(() => {
        result.current.handleRoomPointerDown(mockEvent);
      });
      expect(result.current.roomDrawStart).toEqual({ gridX: 5, gridY: 7 });
      expect(result.current.roomDrawRect).toEqual({ minX: 5, maxX: 5, minY: 7, maxY: 7 });
    });

    it('should set selectedRoom to null when starting a new room', () => {
      const result = getHook();
      act(() => {
        result.current.setSelectedRoom({ id: 'existing' });
      });
      const mockEvent = { pointerId: 1, preventDefault: vi.fn() };
      act(() => {
        result.current.handleRoomPointerDown(mockEvent);
      });
      expect(result.current.selectedRoom).toBeNull();
    });

    it('should capture pointer on svg', () => {
      const result = getHook();
      const mockEvent = { pointerId: 42, preventDefault: vi.fn() };
      act(() => {
        result.current.handleRoomPointerDown(mockEvent);
      });
      expect(svgRef.current.setPointerCapture).toHaveBeenCalledWith(42);
    });

    it('should not start drawing when not localhost', () => {
      const result = getHook({ isLocalhost: false });
      const mockEvent = { pointerId: 1, preventDefault: vi.fn() };
      act(() => {
        result.current.handleRoomPointerDown(mockEvent);
      });
      expect(result.current.roomDrawStart).toBeNull();
      expect(result.current.roomDrawRect).toBeNull();
    });

    it('should not start drawing when tool is not room', () => {
      const result = getHook({ tool: 'paint' });
      const mockEvent = { pointerId: 1, preventDefault: vi.fn() };
      act(() => {
        result.current.handleRoomPointerDown(mockEvent);
      });
      expect(result.current.roomDrawStart).toBeNull();
      expect(result.current.roomDrawRect).toBeNull();
    });

    it('should prevent default on the event', () => {
      const result = getHook();
      const mockEvent = { pointerId: 1, preventDefault: vi.fn() };
      act(() => {
        result.current.handleRoomPointerDown(mockEvent);
      });
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should return early when getGridFromEvent returns null', () => {
      getGridFromEvent.mockReturnValue(null);
      const result = getHook();
      const mockEvent = { pointerId: 1, preventDefault: vi.fn() };
      act(() => {
        result.current.handleRoomPointerDown(mockEvent);
      });
      expect(result.current.roomDrawStart).toBeNull();
      expect(result.current.roomDrawRect).toBeNull();
    });

    it('should not capture pointer when svgRef is null', () => {
      const nullSvgRef = { current: null };
      const result = getHook({ svgRef: nullSvgRef });
      const mockEvent = { pointerId: 1, preventDefault: vi.fn() };
      act(() => {
        result.current.handleRoomPointerDown(mockEvent);
      });
      expect(result.current.roomDrawStart).toEqual({ gridX: 5, gridY: 7 });
      expect(result.current.roomDrawRect).toEqual({ minX: 5, maxX: 5, minY: 7, maxY: 7 });
    });
  });

  describe('handleRoomPointerMove', () => {
    it('should update roomDrawRect when drawing', () => {
      const result = getHook();
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      getGridFromEvent.mockReturnValue({ gridX: 10.5, gridY: 12.5 });
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      expect(result.current.roomDrawRect).toEqual({
        minX: 5,
        maxX: 10,
        minY: 7,
        maxY: 12,
      });
    });

    it('should handle reverse direction drawing', () => {
      const result = getHook();
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      getGridFromEvent.mockReturnValue({ gridX: 3.5, gridY: 4.5 });
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      expect(result.current.roomDrawRect).toEqual({
        minX: 3,
        maxX: 5,
        minY: 4,
        maxY: 7,
      });
    });

    it('should not update when no draw start', () => {
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 20, gridY: 20 });
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      expect(result.current.roomDrawRect).toBeNull();
    });

    it('should not update when not localhost', () => {
      const result = getHook({ isLocalhost: false });
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      expect(result.current.roomDrawRect).toBeNull();
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      expect(result.current.roomDrawRect).toBeNull();
    });

    it('should not update when tool is not room', () => {
      const result = getHook({ tool: 'paint' });
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      expect(result.current.roomDrawRect).toBeNull();
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      expect(result.current.roomDrawRect).toBeNull();
    });

    it('should prevent default on the event', () => {
      const result = getHook();
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      const mockEvent = { pointerId: 1, preventDefault: vi.fn() };
      act(() => {
        result.current.handleRoomPointerMove(mockEvent);
      });
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should return early when getGridFromEvent returns null', () => {
      const result = getHook();
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      getGridFromEvent.mockReturnValue(null);
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      expect(result.current.roomDrawRect).toEqual({
        minX: 5,
        maxX: 5,
        minY: 7,
        maxY: 7,
      });
    });
  });

  describe('handleRoomPointerUp', () => {
    it('should clear draw state and return when no drawStart', () => {
      const setMapData = vi.fn();
      const result = getHook();
      act(() => {
        result.current.handleRoomPointerUp({ pointerId: 1 }, 40, setMapData);
      });
      expect(result.current.roomDrawStart).toBeNull();
      expect(result.current.roomDrawRect).toBeNull();
      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should reject rooms smaller than 3x3', () => {
      const setMapData = vi.fn();
      const result = getHook();
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      getGridFromEvent.mockReturnValue({ gridX: 6.5, gridY: 7.5 });
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      act(() => {
        result.current.handleRoomPointerUp({ pointerId: 1 }, 40, setMapData);
      });
      expect(setMapData).not.toHaveBeenCalled();
      expect(result.current.roomDrawStart).toBeNull();
      expect(result.current.roomDrawRect).toBeNull();
    });

    it('should create a room when size is sufficient', () => {
      const setMapData = vi.fn((fn) => {
        const prev = { walls: new Set(), rooms: [] };
        return fn(prev);
      });
      const result = getHook();
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      getGridFromEvent.mockReturnValue({ gridX: 9.5, gridY: 11.5 });
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      act(() => {
        result.current.handleRoomPointerUp({ pointerId: 1 }, 40, setMapData);
      });
      expect(setMapData).toHaveBeenCalled();
      expect(result.current.roomDrawStart).toBeNull();
      expect(result.current.roomDrawRect).toBeNull();
    });

    it('should release pointer capture on svg', () => {
      const setMapData = vi.fn((fn) => {
        const prev = { walls: new Set(), rooms: [] };
        return fn(prev);
      });
      const result = getHook();
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 42, preventDefault: vi.fn() });
      });
      getGridFromEvent.mockReturnValue({ gridX: 9.5, gridY: 11.5 });
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 42, preventDefault: vi.fn() });
      });
      act(() => {
        result.current.handleRoomPointerUp({ pointerId: 42 }, 40, setMapData);
      });
      expect(svgRef.current.releasePointerCapture).toHaveBeenCalledWith(42);
    });

    it('should not create room when not localhost', () => {
      const setMapData = vi.fn((fn) => {
        const prev = { walls: new Set(), rooms: [] };
        return fn(prev);
      });
      const result = getHook({ isLocalhost: false });
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      getGridFromEvent.mockReturnValue({ gridX: 9.5, gridY: 11.5 });
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      act(() => {
        result.current.handleRoomPointerUp({ pointerId: 1 }, 40, setMapData);
      });
      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should not create room when tool is not room', () => {
      const setMapData = vi.fn((fn) => {
        const prev = { walls: new Set(), rooms: [] };
        return fn(prev);
      });
      const result = getHook({ tool: 'paint' });
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      getGridFromEvent.mockReturnValue({ gridX: 9.5, gridY: 11.5 });
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      act(() => {
        result.current.handleRoomPointerUp({ pointerId: 1 }, 40, setMapData);
      });
      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should not release pointer when svgRef is null', () => {
      const nullSvgRef = { current: null };
      const setMapData = vi.fn((fn) => {
        const prev = { walls: new Set(), rooms: [] };
        return fn(prev);
      });
      const result = getHook({ svgRef: nullSvgRef });
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      getGridFromEvent.mockReturnValue({ gridX: 9.5, gridY: 11.5 });
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      act(() => {
        result.current.handleRoomPointerUp({ pointerId: 1 }, 40, setMapData);
      });
      expect(setMapData).toHaveBeenCalled();
    });

    it('should call buildRoomWalls and createRoom with correct params', () => {
      const buildRoomWallsSpy = vi.spyOn(mapRoomUtils, 'buildRoomWalls');
      const createRoomSpy = vi.spyOn(mapRoomUtils, 'createRoom');
      const setMapData = vi.fn((fn) => {
        const prev = { walls: new Set(), rooms: [] };
        return fn(prev);
      });
      const result = getHook();
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      getGridFromEvent.mockReturnValue({ gridX: 9.5, gridY: 11.5 });
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      act(() => {
        result.current.handleRoomPointerUp({ pointerId: 1 }, 40, setMapData);
      });
      expect(buildRoomWallsSpy).toHaveBeenCalled();
      expect(createRoomSpy).toHaveBeenCalledWith(5, 7, 5, 5);
      buildRoomWallsSpy.mockRestore();
      createRoomSpy.mockRestore();
    });

    it('should append new room to existing rooms array', () => {
      const setMapData = vi.fn((fn) => {
        const prev = {
          walls: new Set(),
          rooms: [{ id: 'existing', rect: { x: 0, y: 0, w: 3, h: 3 } }],
        };
        return fn(prev);
      });
      const result = getHook();
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      getGridFromEvent.mockReturnValue({ gridX: 9.5, gridY: 11.5 });
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      act(() => {
        result.current.handleRoomPointerUp({ pointerId: 1 }, 40, setMapData);
      });
      const updateFn = setMapData.mock.calls[0][0];
      const resultData = updateFn({
        walls: new Set(),
        rooms: [{ id: 'existing', rect: { x: 0, y: 0, w: 3, h: 3 } }],
      });
      expect(resultData.rooms.length).toBe(2);
      expect(resultData.rooms[1].rect.x).toBe(5);
      expect(resultData.rooms[1].rect.y).toBe(7);
    });
  });

  describe('handleRoomClick', () => {
    it('should select the smallest room containing the clicked grid cell', () => {
      const mapData = {
        rooms: [
          { id: 'big', rect: { x: 0, y: 0, w: 10, h: 10 } },
          { id: 'small', rect: { x: 2, y: 2, w: 3, h: 3 } },
        ],
      };
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 3.5, gridY: 3.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'none');
      });
      expect(result.current.selectedRoom).toEqual({
        id: 'small',
        rect: { x: 2, y: 2, w: 3, h: 3 },
      });
    });

    it('should not select any room when tool is not none or select', () => {
      const mapData = {
        rooms: [{ id: 'room1', rect: { x: 0, y: 0, w: 5, h: 5 } }],
      };
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 2.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'paint');
      });
      expect(result.current.selectedRoom).toBeNull();
    });

    it('should not select any room when not localhost', () => {
      const mapData = {
        rooms: [{ id: 'room1', rect: { x: 0, y: 0, w: 5, h: 5 } }],
      };
      const result = getHook({ isLocalhost: false });
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 2.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'none');
      });
      expect(result.current.selectedRoom).toBeNull();
    });

    it('should return early when no rooms exist', () => {
      const mapData = { rooms: [] };
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 2.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'none');
      });
      expect(result.current.selectedRoom).toBeNull();
    });

    it('should return early when mapData is null', () => {
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 2.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, null, 'none');
      });
      expect(result.current.selectedRoom).toBeNull();
    });

    it('should return early when getGridFromEvent returns null', () => {
      const mapData = {
        rooms: [{ id: 'room1', rect: { x: 0, y: 0, w: 5, h: 5 } }],
      };
      const result = getHook();
      getGridFromEvent.mockReturnValue(null);
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'none');
      });
      expect(result.current.selectedRoom).toBeNull();
    });

    it('should select the larger room when clicked cell is in both', () => {
      const mapData = {
        rooms: [
          { id: 'big', rect: { x: 0, y: 0, w: 10, h: 10 } },
          { id: 'small', rect: { x: 2, y: 2, w: 3, h: 3 } },
        ],
      };
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 1.5, gridY: 1.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'none');
      });
      expect(result.current.selectedRoom).toEqual({
        id: 'big',
        rect: { x: 0, y: 0, w: 10, h: 10 },
      });
    });

    it('should not select any room when clicked cell is outside all rooms', () => {
      const mapData = {
        rooms: [{ id: 'room1', rect: { x: 0, y: 0, w: 5, h: 5 } }],
      };
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 10.5, gridY: 10.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'none');
      });
      expect(result.current.selectedRoom).toBeNull();
    });

    it('should handle room with exact grid boundary (gx >= r.x && gx < r.x + r.w)', () => {
      const mapData = {
        rooms: [{ id: 'room1', rect: { x: 5, y: 5, w: 3, h: 3 } }],
      };
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 7.5, gridY: 5.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'none');
      });
      expect(result.current.selectedRoom).toEqual({
        id: 'room1',
        rect: { x: 5, y: 5, w: 3, h: 3 },
      });
    });

    it('should not select room at edge boundary (gx == r.x + r.w is outside)', () => {
      const mapData = {
        rooms: [{ id: 'room1', rect: { x: 5, y: 5, w: 3, h: 3 } }],
      };
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 8.5, gridY: 5.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'none');
      });
      expect(result.current.selectedRoom).toBeNull();
    });

    it('should replace previously selected room', () => {
      const mapData = {
        rooms: [
          { id: 'room1', rect: { x: 0, y: 0, w: 5, h: 5 } },
          { id: 'room2', rect: { x: 10, y: 10, w: 5, h: 5 } },
        ],
      };
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 2.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'none');
      });
      expect(result.current.selectedRoom.id).toBe('room1');
      getGridFromEvent.mockReturnValue({ gridX: 12.5, gridY: 12.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'none');
      });
      expect(result.current.selectedRoom.id).toBe('room2');
    });

    it('should prefer smaller room when cell is in nested rooms', () => {
      const mapData = {
        rooms: [
          { id: 'outer', rect: { x: 0, y: 0, w: 10, h: 10 } },
          { id: 'inner', rect: { x: 3, y: 3, w: 4, h: 4 } },
          { id: 'tiny', rect: { x: 4, y: 4, w: 2, h: 2 } },
        ],
      };
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 4.5, gridY: 4.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'none');
      });
      expect(result.current.selectedRoom.id).toBe('tiny');
    });
  });

  describe('setSelectedRoom', () => {
    it('should update selectedRoom state', () => {
      const result = getHook();
      act(() => {
        result.current.setSelectedRoom({ id: 'test', rect: { x: 0, y: 0, w: 3, h: 3 } });
      });
      expect(result.current.selectedRoom).toEqual({
        id: 'test',
        rect: { x: 0, y: 0, w: 3, h: 3 },
      });
    });

    it('should clear selectedRoom when set to null', () => {
      const result = getHook();
      act(() => {
        result.current.setSelectedRoom({ id: 'test' });
      });
      act(() => {
        result.current.setSelectedRoom(null);
      });
      expect(result.current.selectedRoom).toBeNull();
    });
  });
});
