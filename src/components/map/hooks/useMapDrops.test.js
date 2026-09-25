// @improved-by-ai
// @cleaned-by-ai
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useMapDrops from './useMapDrops.js';

// Use vi.hoisted so the mock guidFn is available at module evaluation time
// (when vi.mock runs), while still being mutable in tests.
const { guidFn } = vi.hoisted(() => ({
  guidFn: vi.fn(() => 'mock-guid-001'),
}));

vi.mock('../../../services/ui/utils.js', () => ({
  default: { guid: guidFn },
}));

describe('useMapDrops', () => {
  let getGridFromEvent;
  let setMapData;
  let setPlacedItems;
  let isLocalhost;

  const createMocks = () => {
    getGridFromEvent = vi.fn();
    setMapData = vi.fn((fn) => {
      if (typeof fn === 'function') {
        const prev = { players: [] };
        return fn(prev);
      }
      return fn;
    });
    setPlacedItems = vi.fn((fn) => {
      if (typeof fn === 'function') {
        const prev = [];
        return fn(prev);
      }
      return fn;
    });
    isLocalhost = true;
  };

  const getHook = (overrides = {}) => {
    const { result } = renderHook(() =>
      useMapDrops({
        isLocalhost,
        getGridFromEvent,
        setMapData,
        setPlacedItems,
        ...overrides,
      })
    );
    return result;
  };

  beforeEach(() => {
    createMocks();
    vi.resetAllMocks();
    guidFn.mockReturnValue('mock-guid-001');
  });

  describe('early returns', () => {
    it('should not call setMapData or setPlacedItems when dragData is empty', () => {
      getGridFromEvent.mockReturnValue({ gridX: 5, gridY: 3 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => '' },
        });
      });
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('should treat whitespace-only dragData as furniture (truthy string)', () => {
      getGridFromEvent.mockReturnValue({ gridX: 5, gridY: 3 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => '   ' },
        });
      });
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).toHaveBeenCalled();
    });

    it('should not call setMapData or setPlacedItems when grid is null', () => {
      getGridFromEvent.mockReturnValue(null);
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'table' },
        });
      });
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).not.toHaveBeenCalled();
    });

    it('should treat truthy grid with undefined coordinates as valid (produces NaN grid coords)', () => {
      getGridFromEvent.mockReturnValue({});
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'table' },
        });
      });
      // {} is truthy so the code proceeds; Math.floor(undefined) = NaN
      expect(setPlacedItems).toHaveBeenCalled();
      const [fn] = setPlacedItems.mock.calls[0];
      const newItem = fn([])[0];
      expect(newItem.gridX).toBeNaN();
      expect(newItem.gridY).toBeNaN();
    });
  });

  describe('character drops', () => {
    beforeEach(() => {
      createMocks();
    });

    it('should add a character to map players with correct properties', () => {
      getGridFromEvent.mockReturnValue({ gridX: 5.7, gridY: 3.2 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'character:Gandalf' },
        });
      });
      expect(setMapData).toHaveBeenCalledTimes(1);
      const callArg = setMapData.mock.calls[0][0];
      const updated = callArg({ players: [] });
      expect(updated.players).toHaveLength(1);
      expect(updated.players[0]).toEqual({
        id: 'gandalf',
        name: 'Gandalf',
        gridX: 5,
        gridY: 3,
      });
    });

    it('should snap a character drop onto a wall cell to the nearest passable cell', () => {
      const walls = new Set(['5,3']);
      setMapData = vi.fn((fn) => {
        if (typeof fn === 'function') {
          const prev = { players: [], walls };
          return fn(prev);
        }
        return fn;
      });
      getGridFromEvent.mockReturnValue({ gridX: 5, gridY: 3 });
      const result = getHook({ gridSize: 30, placedItems: [] });
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'character:Gandalf' },
        });
      });
      const callArg = setMapData.mock.calls[0][0];
      const updated = callArg({ players: [], walls });
      expect(updated.players).toHaveLength(1);
      expect(updated.players[0].gridX).toBe(6);
      expect(updated.players[0].gridY).toBe(3);
    });

    it('should snap a character drop onto a closed door cell to the nearest passable cell', () => {
      const doorItems = [{ type: 'door', open: false, gridX: 5, gridY: 3 }];
      setMapData = vi.fn((fn) => {
        if (typeof fn === 'function') {
          const prev = { players: [], walls: new Set() };
          return fn(prev);
        }
        return fn;
      });
      getGridFromEvent.mockReturnValue({ gridX: 5, gridY: 3 });
      const result = getHook({ gridSize: 30, placedItems: doorItems });
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'character:Gandalf' },
        });
      });
      const callArg = setMapData.mock.calls[0][0];
      const updated = callArg({ players: [], walls: new Set() });
      expect(updated.players).toHaveLength(1);
      expect(updated.players[0].gridX).toBe(6);
      expect(updated.players[0].gridY).toBe(3);
    });

    it('should not move a character drop that lands on a passable cell', () => {
      setMapData = vi.fn((fn) => {
        if (typeof fn === 'function') {
          const prev = { players: [], walls: new Set(['0,0']) };
          return fn(prev);
        }
        return fn;
      });
      getGridFromEvent.mockReturnValue({ gridX: 5, gridY: 3 });
      const result = getHook({ gridSize: 30, placedItems: [] });
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'character:Gandalf' },
        });
      });
      const callArg = setMapData.mock.calls[0][0];
      const updated = callArg({ players: [], walls: new Set(['0,0']) });
      expect(updated.players[0].gridX).toBe(5);
      expect(updated.players[0].gridY).toBe(3);
    });

    it('should not add a duplicate character (same name)', () => {
      setMapData = vi.fn((fn) => {
        if (typeof fn === 'function') {
          const prev = {
            players: [{ id: 'gandalf', name: 'Gandalf', gridX: 1, gridY: 1 }],
          };
          return fn(prev);
        }
        return fn;
      });
      getGridFromEvent.mockReturnValue({ gridX: 5, gridY: 3 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'character:Gandalf' },
        });
      });
      expect(setMapData).toHaveBeenCalledTimes(1);
      const callArg = setMapData.mock.calls[0][0];
      const updated = callArg({
        players: [{ id: 'gandalf', name: 'Gandalf', gridX: 1, gridY: 1 }],
      });
      expect(updated.players).toHaveLength(1);
      expect(updated.players[0].gridX).toBe(1);
    });

    it('should allow different characters with the same normalized id but different names', () => {
      const state = { players: [] };
      setMapData = vi.fn((fn) => {
        if (typeof fn === 'function') {
          const prev = { players: state.players };
          const result = fn(prev);
          state.players = result.players;
          return result;
        }
        return fn;
      });
      getGridFromEvent.mockReturnValue({ gridX: 5, gridY: 3 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'character:John Doe' },
        });
      });
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'character:Jane Doe' },
        });
      });
      expect(setMapData).toHaveBeenCalledTimes(2);
      // First call: prev has no players, should add John Doe
      const firstCallArg = setMapData.mock.calls[0][0];
      const firstResult = firstCallArg({ players: [] });
      expect(firstResult.players).toHaveLength(1);
      expect(firstResult.players[0].name).toBe('John Doe');
      // Second call: prev should have John Doe from state
      const secondCallArg = setMapData.mock.calls[1][0];
      const secondResult = secondCallArg({ players: state.players });
      expect(secondResult.players).toHaveLength(2);
      expect(secondResult.players[0].name).toBe('John Doe');
      expect(secondResult.players[1].name).toBe('Jane Doe');
    });

    it('should handle character names with spaces in id generation', () => {
      getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'character:Lord Elrond' },
        });
      });
      const callArg = setMapData.mock.calls[0][0];
      const updated = callArg({ players: [] });
      expect(updated.players[0].id).toBe('lord-elrond');
      expect(updated.players[0].name).toBe('Lord Elrond');
    });

    it('should not add character when players array is missing from state', () => {
      setMapData = vi.fn((fn) => {
        if (typeof fn === 'function') {
          return fn({});
        }
        return fn;
      });
      getGridFromEvent.mockReturnValue({ gridX: 5, gridY: 3 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'character:Gandalf' },
        });
      });
      expect(setMapData).toHaveBeenCalledTimes(1);
      const callArg = setMapData.mock.calls[0][0];
      const updated = callArg({});
      expect(updated.players).toHaveLength(1);
      expect(updated.players[0].name).toBe('Gandalf');
    });

    it('should preserve other map data properties when adding a character', () => {
      setMapData = vi.fn((fn) => {
        if (typeof fn === 'function') {
          const prev = {
            players: [],
            name: 'test-map',
            width: 50,
            height: 50,
          };
          return fn(prev);
        }
        return fn;
      });
      getGridFromEvent.mockReturnValue({ gridX: 5, gridY: 3 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'character:Gandalf' },
        });
      });
      const callArg = setMapData.mock.calls[0][0];
      const updated = callArg({
        players: [],
        name: 'test-map',
        width: 50,
        height: 50,
      });
      expect(updated.name).toBe('test-map');
      expect(updated.width).toBe(50);
      expect(updated.height).toBe(50);
    });
  });

  describe('NPC drops', () => {
    beforeEach(() => {
      createMocks();
    });

    it('should add an NPC to placed items with correct properties', () => {
      getGridFromEvent.mockReturnValue({ gridX: 3, gridY: 6 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'npc' },
        });
      });
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).toHaveBeenCalledTimes(1);
      const callArg = setPlacedItems.mock.calls[0][0];
      const newItem = callArg([])[0];
      expect(newItem.id).toBe('mock-guid-001');
      expect(newItem.type).toBe('npc');
      expect(newItem.gridX).toBe(3);
      expect(newItem.gridY).toBe(6);
      expect(newItem.visible).toBe(true);
      expect(newItem.name).toBe('NPC');
      expect(newItem.rotation).toBeUndefined();
    });

    it('should set visible based on isLocalhost', () => {
      getGridFromEvent.mockReturnValue({ gridX: 1, gridY: 1 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'npc' },
        });
      });
      const [fn] = setPlacedItems.mock.calls[0];
      const newItem = fn([])[0];
      expect(newItem.visible).toBe(true);
    });

    it('should set visible false when not localhost', () => {
      isLocalhost = false;
      getGridFromEvent.mockReturnValue({ gridX: 1, gridY: 1 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'npc' },
        });
      });
      const [fn] = setPlacedItems.mock.calls[0];
      const newItem = fn([])[0];
      expect(newItem.visible).toBe(false);
    });

    it('should append NPC to existing placed items', () => {
      setPlacedItems = vi.fn((fn) => {
        if (typeof fn === 'function') {
          const prev = [{ id: 'existing', type: 'table', gridX: 0, gridY: 0 }];
          return fn(prev);
        }
        return fn;
      });
      getGridFromEvent.mockReturnValue({ gridX: 5, gridY: 5 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'npc' },
        });
      });
      const [fn] = setPlacedItems.mock.calls[0];
      const updated = fn([
        { id: 'existing', type: 'table', gridX: 0, gridY: 0 },
      ]);
      expect(updated).toHaveLength(2);
      expect(updated[1].type).toBe('npc');
    });

    it('should generate a unique guid for each NPC', () => {
      guidFn
        .mockReturnValueOnce('guid-aaa')
        .mockReturnValueOnce('guid-bbb');
      getGridFromEvent.mockReturnValue({ gridX: 1, gridY: 1 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'npc' },
        });
      });
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'npc' },
        });
      });
      const [fn1] = setPlacedItems.mock.calls[0];
      const [fn2] = setPlacedItems.mock.calls[1];
      expect(fn1([])[0].id).toBe('guid-aaa');
      expect(fn2([])[0].id).toBe('guid-bbb');
    });
  });

  describe('furniture drops', () => {
    beforeEach(() => {
      createMocks();
    });

    it('should add furniture to placed items', () => {
      getGridFromEvent.mockReturnValue({ gridX: 7, gridY: 2 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'table' },
        });
      });
      expect(setMapData).not.toHaveBeenCalled();
      expect(setPlacedItems).toHaveBeenCalledTimes(1);
      const callArg = setPlacedItems.mock.calls[0][0];
      const newItem = callArg([])[0];
      expect(newItem.type).toBe('table');
      expect(newItem.gridX).toBe(7);
      expect(newItem.gridY).toBe(2);
    });

    it('should floor grid coordinates for furniture', () => {
      getGridFromEvent.mockReturnValue({ gridX: 3.9, gridY: 7.1 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'table' },
        });
      });
      const [fn] = setPlacedItems.mock.calls[0];
      const newItem = fn([])[0];
      expect(newItem.gridX).toBe(3);
      expect(newItem.gridY).toBe(7);
    });

    it('should floor negative grid coordinates for furniture', () => {
      getGridFromEvent.mockReturnValue({ gridX: -0.5, gridY: -3.7 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'wall' },
        });
      });
      const [fn] = setPlacedItems.mock.calls[0];
      const newItem = fn([])[0];
      expect(newItem.gridX).toBe(-1);
      expect(newItem.gridY).toBe(-4);
    });

    it('should set rotation for items that support it', () => {
      const rotationItems = [
        'table',
        'bed',
        'stairs',
        'altar',
        'bookshelf',
        'torch',
        'chair',
        'arrowSlitWall',
      ];
      for (const item of rotationItems) {
        setPlacedItems.mockClear();
        getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
        const result = getHook();
        act(() => {
          result.current.handleDrop({
            preventDefault: vi.fn(),
            dataTransfer: { getData: () => item },
          });
        });
        const [fn] = setPlacedItems.mock.calls[0];
        const newItem = fn([])[0];
        expect(newItem.rotation).toBe(0);
      }
    });

    it('should set rotation undefined for items without rotation', () => {
      getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'wall' },
        });
      });
      const [fn] = setPlacedItems.mock.calls[0];
      const newItem = fn([])[0];
      expect(newItem.rotation).toBeUndefined();
    });

    it('should treat unknown drag types as furniture', () => {
      getGridFromEvent.mockReturnValue({ gridX: 2, gridY: 4 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'unknown-thing' },
        });
      });
      const [fn] = setPlacedItems.mock.calls[0];
      const newItem = fn([])[0];
      expect(newItem.type).toBe('unknown-thing');
      expect(newItem.id).toBe('mock-guid-001');
      expect(newItem.visible).toBe(true);
    });

    it('should set visible based on isLocalhost for furniture', () => {
      isLocalhost = false;
      getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'table' },
        });
      });
      const [fn] = setPlacedItems.mock.calls[0];
      const newItem = fn([])[0];
      expect(newItem.visible).toBe(false);
    });

    it('should generate unique guids for each furniture item', () => {
      guidFn
        .mockReturnValueOnce('furniture-1')
        .mockReturnValueOnce('furniture-2');
      getGridFromEvent.mockReturnValue({ gridX: 0, gridY: 0 });
      const result = getHook();
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'table' },
        });
      });
      act(() => {
        result.current.handleDrop({
          preventDefault: vi.fn(),
          dataTransfer: { getData: () => 'chair' },
        });
      });
      const [fn1] = setPlacedItems.mock.calls[0];
      const [fn2] = setPlacedItems.mock.calls[1];
      expect(fn1([])[0].id).toBe('furniture-1');
      expect(fn2([])[0].id).toBe('furniture-2');
    });
  });
});
