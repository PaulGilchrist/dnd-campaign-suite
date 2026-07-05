// @cleaned-by-ai
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
    it('should initialize with null roomDrawStart, roomDrawRect, and selectedRoom', () => {
      const result = getHook();
      expect(result.current.roomDrawStart).toBeNull();
      expect(result.current.roomDrawRect).toBeNull();
      expect(result.current.selectedRoom).toBeNull();
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
  });

  describe('handleRoomPointerMove', () => {
    it('should update roomDrawRect when drawing forward', () => {
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
      expect(resultData.rooms.length).toBeGreaterThan(1);
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

    it('should prefer smallest room when cell is in nested rooms', () => {
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

    it('should handle room with exact grid boundary', () => {
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
  });
});
