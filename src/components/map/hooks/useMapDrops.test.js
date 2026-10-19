// @maintained-by-ai
// Lane: useMapDrops — EXTERNAL drop-target contract (side-panel palette → map SVG, Map.jsx onDrop).
//   Drag/drop split (do not duplicate here): useItemDragging.test.js owns placedItems pointer-drag
//   (#905, onTokenMoveLanded commit); usePlayerDragging.test.js owns mapData.players pointer-drag;
//   Map-tool-handlers.test.jsx owns the DOM onDrop→handleDrop wiring. This hook receives text/plain
//   payloads only — no file/upload transport lives here (no FileReader/fetch in src/components/map).
// old->new map (21->9): early-returns 1+3 → "inert drops"; character 5+11+13 → "exact payload";
//   character 6+7+8 → "obstacle snap"; character 9 → "duplicate names"; character 10+12 → removed
//   (mis-titled / malformed-state quirk pins); npc 14 → "NPC payload"; npc 15+18+furniture 18 →
//   "visible gate"; furniture 19+20+23 → "furniture payload"; furniture 21+22 → "rotation whitelist";
//   npc 18+furniture 24 → "fresh guid". Removed quirk pins: whitespace-drop furniture, NaN-grid
//   placement, negative-coord Math.floor (JS spec, not this hook).
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useMapDrops from './useMapDrops.js';

// vi.hoisted so the guid fake exists when vi.mock evaluates, and stays mutable per-test.
const { guidFn } = vi.hoisted(() => ({
  guidFn: vi.fn(() => 'mock-guid-001'),
}));

vi.mock('../../../services/ui/utils.js', () => ({
  default: { guid: guidFn },
}));

describe('useMapDrops', () => {
  // Honest stateful harness: the setters behave like real updaters (apply fn to live state),
  // so assertions observe resulting state bytes instead of digging through mock calls.
  let mapData;
  let placedItems;
  let getGridFromEvent;
  let setMapData;
  let setPlacedItems;
  let isLocalhost;

  beforeEach(() => {
    mapData = { name: 'test-map', players: [], walls: new Set() };
    placedItems = [];
    getGridFromEvent = vi.fn();
    setMapData = vi.fn((fn) => {
      mapData = fn(mapData);
      return mapData;
    });
    setPlacedItems = vi.fn((fn) => {
      placedItems = fn(placedItems);
      return placedItems;
    });
    isLocalhost = true;
    guidFn.mockReturnValue('mock-guid-001');
  });

  const getHook = (overrides = {}) => {
    const { result } = renderHook(() =>
      useMapDrops({
        isLocalhost,
        getGridFromEvent,
        setMapData,
        setPlacedItems,
        placedItems,
        gridSize: 30,
        ...overrides,
      })
    );
    return result;
  };

  const dropAt = (result, payload, grid = { gridX: 5, gridY: 3 }) => {
    getGridFromEvent.mockReturnValue(grid);
    const event = { preventDefault: vi.fn(), dataTransfer: { getData: () => payload } };
    act(() => result.current.handleDrop(event));
    return event;
  };

  it('always calls preventDefault but places nothing for empty payloads or off-grid drops', () => {
    const result = getHook();
    // Empty payload: inert beyond preventDefault.
    const empty = dropAt(result, '');
    // Grid null (drop outside the map / no cell): inert beyond preventDefault.
    const offGrid = dropAt(result, 'table', null);
    expect(empty.preventDefault).toHaveBeenCalledTimes(1);
    expect(offGrid.preventDefault).toHaveBeenCalledTimes(1);
    expect(setMapData).not.toHaveBeenCalled();
    expect(setPlacedItems).not.toHaveBeenCalled();
    expect(mapData.players).toHaveLength(0);
    expect(placedItems).toHaveLength(0);
  });

  it('drops a character at the floored cell with the exact payload and preserves other map data', () => {
    mapData.walls = new Set(['0,0']);
    const result = getHook();
    dropAt(result, 'character:Lord Elrond', { gridX: 7.9, gridY: 2.1 });
    expect(setMapData).toHaveBeenCalledTimes(1);
    expect(setPlacedItems).not.toHaveBeenCalled();
    expect(mapData.players).toEqual([
      { id: 'lord-elrond', name: 'Lord Elrond', gridX: 7, gridY: 2 },
    ]);
    expect(mapData.name).toBe('test-map');
  });

  it('snaps character drops on walls and closed doors to the nearest passable cell, passable cells unchanged', () => {
    mapData.walls = new Set(['5,3']);
    placedItems = [{ type: 'door', open: false, gridX: 7, gridY: 7 }];
    const result = getHook();
    dropAt(result, 'character:A', { gridX: 5, gridY: 3 }); // wall cell
    dropAt(result, 'character:B', { gridX: 7, gridY: 7 }); // closed-door cell
    dropAt(result, 'character:C', { gridX: 5, gridY: 4 }); // passable cell
    expect(mapData.players).toEqual([
      { id: 'a', name: 'A', gridX: 6, gridY: 3 },
      { id: 'b', name: 'B', gridX: 8, gridY: 7 },
      { id: 'c', name: 'C', gridX: 5, gridY: 4 },
    ]);
  });

  it('rejects a duplicate character name and leaves the existing player untouched', () => {
    mapData.players = [{ id: 'gandalf', name: 'Gandalf', gridX: 1, gridY: 1 }];
    const result = getHook();
    dropAt(result, 'character:Gandalf', { gridX: 5, gridY: 3 });
    expect(mapData.players).toEqual([
      { id: 'gandalf', name: 'Gandalf', gridX: 1, gridY: 1 },
    ]);
  });

  it('drops an NPC with the exact payload, appended to existing placed items', () => {
    placedItems = [{ id: 'existing', type: 'table', gridX: 0, gridY: 0 }];
    const result = getHook();
    dropAt(result, 'npc', { gridX: 3, gridY: 6 });
    expect(setMapData).not.toHaveBeenCalled();
    expect(setPlacedItems).toHaveBeenCalledTimes(1);
    expect(placedItems).toHaveLength(2);
    expect(placedItems[1]).toEqual({
      id: 'mock-guid-001',
      type: 'npc',
      gridX: 3,
      gridY: 6,
      visible: true,
      name: 'NPC',
    });
  });

  it('places NPC and furniture drops hidden for non-localhost clients', () => {
    isLocalhost = false;
    const result = getHook();
    dropAt(result, 'npc', { gridX: 1, gridY: 1 });
    dropAt(result, 'table', { gridX: 2, gridY: 2 });
    expect(placedItems).toHaveLength(2);
    expect(placedItems.map((i) => i.visible)).toEqual([false, false]);
  });

  it('drops furniture at floored cells with the exact payload and treats unknown types as furniture', () => {
    const result = getHook();
    dropAt(result, 'table', { gridX: 7.4, gridY: 2.9 });
    expect(placedItems[0]).toEqual({
      id: 'mock-guid-001',
      type: 'table',
      gridX: 7,
      gridY: 2,
      visible: true,
      rotation: 0,
    });
    dropAt(result, 'unknown-thing', { gridX: 2, gridY: 4 });
    expect(placedItems[1].type).toBe('unknown-thing');
    expect(placedItems[1].gridX).toBe(2);
    expect(placedItems[1].visible).toBe(true);
  });

  it('gives rotation 0 to the rotatable palette types and leaves the rest unrotated', () => {
    const rotatable = ['table', 'bed', 'stairs', 'altar', 'bookshelf', 'torch', 'chair', 'arrowSlitWall'];
    const result = getHook();
    for (const type of rotatable) {
      dropAt(result, type);
    }
    dropAt(result, 'wall');
    expect(placedItems.map((i) => i.rotation)).toEqual([...rotatable.map(() => 0), undefined]);
  });

  it('assigns a fresh guid to every dropped item', () => {
    guidFn.mockReturnValueOnce('guid-a').mockReturnValueOnce('guid-b');
    const result = getHook();
    dropAt(result, 'npc');
    dropAt(result, 'chair');
    expect(placedItems.map((i) => i.id)).toEqual(['guid-a', 'guid-b']);
  });
});
