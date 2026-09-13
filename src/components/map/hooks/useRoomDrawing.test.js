// @improved-by-ai
// @cleaned-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useRoomDrawing from './useRoomDrawing.js';
import * as mapRoomUtils from '../../../services/maps/mapRoomUtils.js';
import { TOOL_ROOM, TOOL_NONE } from '../../../config/mapConfig.js';

describe('useRoomDrawing', () => {
  let getGridFromEvent;
  let svgRef;

  beforeEach(() => {
    getGridFromEvent = vi.fn(() => ({ gridX: 5.5, gridY: 7.5 }));
    svgRef = { current: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() } };
  });

  const buildSetMapData = (initialWalls = new Set(), initialRooms = []) => {
    const walls = new Set(initialWalls);
    const rooms = [...initialRooms];
    const setMapData = vi.fn((fn) => {
      const result = typeof fn === 'function' ? fn({ walls: new Set(walls), rooms: [...rooms] }) : fn;
      if (typeof fn === 'function' && result) {
        walls.clear();
        result.walls.forEach((w) => walls.add(w));
        if (result.rooms) rooms.length = 0;
        if (Array.isArray(result.rooms)) result.rooms.forEach((r) => rooms.push(r));
      }
      return result;
    });
    return { setMapData, getWalls: () => new Set(walls), getRooms: () => [...rooms] };
  };

  const getHook = ({ isLocalhost = true, tool = TOOL_ROOM, gridSize = 40 } = {}) => {
    const { result } = renderHook(() =>
      useRoomDrawing({ isLocalhost, tool, gridSize, getGridFromEvent, svgRef })
    );
    return result;
  };

  describe('initial state', () => {
    it('should initialize with null roomDrawStart, roomDrawRect, and selectedRoom', () => {
      const result = getHook();
      expect(result.current.roomDrawStart).toBeNull();
      expect(result.current.roomDrawRect).toBeNull();
      expect(result.current.selectedRoom).toBeNull();
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
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });

    it('should clear selectedRoom when starting a new room', () => {
      const result = getHook();
      act(() => {
        result.current.setSelectedRoom({ id: 'existing' });
      });
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
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

    it('should not draw when not localhost or tool is not room', () => {
      const result = getHook({ isLocalhost: false, tool: TOOL_NONE });
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      expect(result.current.roomDrawStart).toBeNull();
      expect(result.current.roomDrawRect).toBeNull();
      expect(svgRef.current.setPointerCapture).not.toHaveBeenCalled();
    });

    it('should not draw when getGridFromEvent returns null', () => {
      getGridFromEvent.mockReturnValue(null);
      const result = getHook();
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      expect(result.current.roomDrawStart).toBeNull();
      expect(result.current.roomDrawRect).toBeNull();
    });

    it('should skip pointer capture when svgRef.current is null but still draw', () => {
      svgRef.current = null;
      const result = getHook();
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      expect(result.current.roomDrawStart).toEqual({ gridX: 5, gridY: 7 });
      expect(result.current.roomDrawRect).toEqual({ minX: 5, maxX: 5, minY: 7, maxY: 7 });
    });

    it('should floor grid coordinates to integers', () => {
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 5.9, gridY: 7.1 });
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      expect(result.current.roomDrawStart).toEqual({ gridX: 5, gridY: 7 });
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

    it('should not update roomDrawRect when no draw start', () => {
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 20, gridY: 20 });
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      expect(result.current.roomDrawRect).toBeNull();
    });

    it('should not update when getGridFromEvent returns null', () => {
      const result = getHook();
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      getGridFromEvent.mockReturnValue(null);
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      expect(result.current.roomDrawRect).toEqual({ minX: 5, maxX: 5, minY: 7, maxY: 7 });
    });

    it('should not update when not localhost or tool is not room', () => {
      const result = getHook({ isLocalhost: false, tool: TOOL_NONE });
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      getGridFromEvent.mockReturnValue({ gridX: 10.5, gridY: 12.5 });
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      expect(result.current.roomDrawRect).toBeNull();
    });

    it('should call preventDefault on the event', () => {
      const result = getHook();
      const mockEvent = { pointerId: 1, preventDefault: vi.fn() };
      act(() => {
        result.current.handleRoomPointerDown(mockEvent);
      });
      act(() => {
        result.current.handleRoomPointerMove(mockEvent);
      });
      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('handleRoomPointerUp', () => {
    it('should clear draw state and return when no drawStart', () => {
      const { setMapData } = buildSetMapData();
      const result = getHook();
      act(() => {
        result.current.handleRoomPointerUp({ pointerId: 1 }, 40, setMapData);
      });
      expect(result.current.roomDrawStart).toBeNull();
      expect(result.current.roomDrawRect).toBeNull();
      expect(setMapData).not.toHaveBeenCalled();
    });

    it('should reject rooms smaller than 3x3', () => {
      const { setMapData } = buildSetMapData();
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
      const buildRoomWallsSpy = vi.spyOn(mapRoomUtils, 'buildRoomWalls').mockReturnValue(new Set());
      const createRoomSpy = vi.spyOn(mapRoomUtils, 'createRoom').mockReturnValue({
        id: 'new-room',
        rect: { x: 5, y: 7, w: 5, h: 5 },
      });
      const { setMapData } = buildSetMapData();
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
      expect(buildRoomWallsSpy).toHaveBeenCalled();
      expect(createRoomSpy).toHaveBeenCalledWith(5, 7, 5, 5);
      buildRoomWallsSpy.mockRestore();
      createRoomSpy.mockRestore();
    });

    it('should release pointer capture on svg', () => {
      const buildRoomWallsSpy = vi.spyOn(mapRoomUtils, 'buildRoomWalls').mockReturnValue(new Set());
      const createRoomSpy = vi.spyOn(mapRoomUtils, 'createRoom').mockReturnValue({
        id: 'new-room',
        rect: { x: 5, y: 7, w: 5, h: 5 },
      });
      const { setMapData } = buildSetMapData();
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
      buildRoomWallsSpy.mockRestore();
      createRoomSpy.mockRestore();
    });

    it('should append new room to existing rooms array', () => {
      const buildRoomWallsSpy = vi.spyOn(mapRoomUtils, 'buildRoomWalls').mockReturnValue(new Set());
      const createRoomSpy = vi.spyOn(mapRoomUtils, 'createRoom').mockReturnValue({
        id: 'new-room',
        rect: { x: 5, y: 7, w: 5, h: 5 },
      });
      const { setMapData, getRooms } = buildSetMapData(
        new Set(),
        [{ id: 'existing', rect: { x: 0, y: 0, w: 3, h: 3 } }]
      );
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
      expect(getRooms().length).toBe(2);
      expect(getRooms()[1].rect.x).toBe(5);
      expect(getRooms()[1].rect.y).toBe(7);
      buildRoomWallsSpy.mockRestore();
      createRoomSpy.mockRestore();
    });

    it('should pass gridSize to buildRoomWalls', () => {
      const buildRoomWallsSpy = vi.spyOn(mapRoomUtils, 'buildRoomWalls').mockReturnValue(new Set());
      const createRoomSpy = vi.spyOn(mapRoomUtils, 'createRoom').mockReturnValue({
        id: 'new-room',
        rect: { x: 5, y: 7, w: 5, h: 5 },
      });
      const { setMapData } = buildSetMapData();
      const result = getHook({ gridSize: 64 });
      act(() => {
        result.current.handleRoomPointerDown({ pointerId: 1, preventDefault: vi.fn() });
      });
      getGridFromEvent.mockReturnValue({ gridX: 9.5, gridY: 11.5 });
      act(() => {
        result.current.handleRoomPointerMove({ pointerId: 1, preventDefault: vi.fn() });
      });
      act(() => {
        result.current.handleRoomPointerUp({ pointerId: 1 }, 64, setMapData);
      });
      expect(buildRoomWallsSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          walls: expect.any(Set),
          minX: 5,
          maxX: 9,
          minY: 7,
          maxY: 11,
          gridSize: 64,
        })
      );
      buildRoomWallsSpy.mockRestore();
      createRoomSpy.mockRestore();
    });

    it('should preserve existing walls when creating a room', () => {
      const existingWalls = new Set(['5,5', '6,5']);
      const buildRoomWallsSpy = vi.spyOn(mapRoomUtils, 'buildRoomWalls').mockReturnValue(existingWalls);
      const createRoomSpy = vi.spyOn(mapRoomUtils, 'createRoom').mockReturnValue({
        id: 'new-room',
        rect: { x: 5, y: 7, w: 5, h: 5 },
      });
      const { setMapData, getWalls } = buildSetMapData(existingWalls);
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
      expect(getWalls()).toEqual(existingWalls);
      buildRoomWallsSpy.mockRestore();
      createRoomSpy.mockRestore();
    });

    it('should skip pointer capture when svgRef.current is null', () => {
      const buildRoomWallsSpy = vi.spyOn(mapRoomUtils, 'buildRoomWalls').mockReturnValue(new Set());
      const createRoomSpy = vi.spyOn(mapRoomUtils, 'createRoom').mockReturnValue({
        id: 'new-room',
        rect: { x: 5, y: 7, w: 5, h: 5 },
      });
      const { setMapData } = buildSetMapData();
      svgRef.current = null;
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
      expect(result.current.roomDrawStart).toBeNull();
      expect(result.current.roomDrawRect).toBeNull();
      buildRoomWallsSpy.mockRestore();
      createRoomSpy.mockRestore();
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

    it('should select room when grid falls on right boundary', () => {
      const mapData = {
        rooms: [{ id: 'room1', rect: { x: 5, y: 5, w: 3, h: 3 } }],
      };
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 7.9, gridY: 5.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'none');
      });
      expect(result.current.selectedRoom.id).toBe('room1');
    });

    it('should not select room when grid is outside all rooms', () => {
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

    it('should not select a room when tool blocks selection', () => {
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

    it('should not select a room when mapData is null', () => {
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 2.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, null, 'select');
      });
      expect(result.current.selectedRoom).toBeNull();
    });

    it('should not select a room when mapData.rooms is empty', () => {
      const mapData = { rooms: [] };
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 2.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'select');
      });
      expect(result.current.selectedRoom).toBeNull();
    });

    it('should not select a room when not localhost', () => {
      const mapData = {
        rooms: [{ id: 'room1', rect: { x: 0, y: 0, w: 5, h: 5 } }],
      };
      const result = getHook({ isLocalhost: false });
      getGridFromEvent.mockReturnValue({ gridX: 2.5, gridY: 2.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'select');
      });
      expect(result.current.selectedRoom).toBeNull();
    });

    it('should not select when getGridFromEvent returns null', () => {
      const mapData = {
        rooms: [{ id: 'room1', rect: { x: 0, y: 0, w: 5, h: 5 } }],
      };
      const result = getHook();
      getGridFromEvent.mockReturnValue(null);
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'select');
      });
      expect(result.current.selectedRoom).toBeNull();
    });

    it('should select room when grid is at exact left/top boundary', () => {
      const mapData = {
        rooms: [{ id: 'room1', rect: { x: 5, y: 5, w: 3, h: 3 } }],
      };
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 5.1, gridY: 5.1 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'select');
      });
      expect(result.current.selectedRoom.id).toBe('room1');
    });

    it('should not select room when grid is at exact right/bottom boundary (exclusive)', () => {
      const mapData = {
        rooms: [{ id: 'room1', rect: { x: 5, y: 5, w: 3, h: 3 } }],
      };
      const result = getHook();
      getGridFromEvent.mockReturnValue({ gridX: 8.1, gridY: 5.5 });
      act(() => {
        result.current.handleRoomClick({ pointerId: 1, preventDefault: vi.fn() }, mapData, 'select');
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

    it('should allow setting to null', () => {
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
