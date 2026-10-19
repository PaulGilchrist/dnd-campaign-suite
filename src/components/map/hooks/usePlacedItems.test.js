// @maintained-by-ai
// Lane: usePlacedItems — the hook's own mutation semantics at the setter SEAM (setPlacedItems/
//   setSelectedItem owned by the PlacedItems component; no persistence here — no network, no timers).
//   Render/visibility split (not duplicated here): PlacedItems.test.jsx, PlacedItems-fog.test.jsx and
//   the -localhost-rendering pair own exact rendering; ItemContextMenu.test.jsx owns click→handler
//   wiring with mocked handlers.
// old->new map (19->6): census kept as "interface" (full census, not exists);
//   toggle 2+3+4 -> "toggles visibility"; delete 6+7+9 -> "deletes exact survivors";
//   rotate 10+11+12+13 -> "rotates +90 wrapping"; door 15+16+19 -> "door open/close";
//   toggle 5 + delete 8 + rotate 14 + door 17+18 -> "inert for unknown/non-door ids" (one sweep,
//   pinning item reference identity and the delete/door unconditional selection-clear).
//   Not pinned: toggling an item with missing `visible` flips it to true — `!undefined` JS-spec
//   quirk, same precedent as the useMapDrops lane's removed quirk pins.
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import usePlacedItems from './usePlacedItems.js';

describe('usePlacedItems', () => {
  // Honest stateful harness (#906): the setter applies updaters to live state, so every
  // assertion observes the exact resulting array literal — no mock-call archaeology.
  // item4 intentionally has no rotation: pins the rotate default (0 -> 90).
  let placedItems;
  let setPlacedItems;
  let setSelectedItem;

  beforeEach(() => {
    placedItems = [
      { id: 'item1', visible: true, rotation: 0, gridX: 1, gridY: 1 },
      { id: 'item2', visible: false, rotation: 90, gridX: 2, gridY: 2 },
      { id: 'item3', type: 'door', open: false, rotation: 0, gridX: 3, gridY: 3 },
      { id: 'item4', visible: true, gridX: 4, gridY: 4 },
    ];
    setSelectedItem = vi.fn();
    setPlacedItems = vi.fn((fn) => {
      placedItems = fn(placedItems);
      return placedItems;
    });
  });

  const getHook = () => renderHook(() => usePlacedItems(setPlacedItems, setSelectedItem)).result;

  it('returns exactly the four mutation handlers', () => {
    expect(Object.keys(getHook().current)).toEqual([
      'handleToggleItemVisibility',
      'handleDeleteItem',
      'handleToggleDoor',
      'handleRotate',
    ]);
  });

  it('toggles visibility both directions with one write per call and other items byte-identical', () => {
    const result = getHook();
    act(() => result.current.handleToggleItemVisibility('item1'));
    expect(placedItems).toEqual([
      { id: 'item1', visible: false, rotation: 0, gridX: 1, gridY: 1 },
      { id: 'item2', visible: false, rotation: 90, gridX: 2, gridY: 2 },
      { id: 'item3', type: 'door', open: false, rotation: 0, gridX: 3, gridY: 3 },
      { id: 'item4', visible: true, gridX: 4, gridY: 4 },
    ]);
    act(() => result.current.handleToggleItemVisibility('item2'));
    expect(placedItems).toEqual([
      { id: 'item1', visible: false, rotation: 0, gridX: 1, gridY: 1 },
      { id: 'item2', visible: true, rotation: 90, gridX: 2, gridY: 2 },
      { id: 'item3', type: 'door', open: false, rotation: 0, gridX: 3, gridY: 3 },
      { id: 'item4', visible: true, gridX: 4, gridY: 4 },
    ]);
    expect(setPlacedItems).toHaveBeenCalledTimes(2);
    // Visibility toggle is selection-preserving (contrast with delete/door below).
    expect(setSelectedItem).not.toHaveBeenCalled();
  });

  it('deletes exact survivors, always clears selection, and empties to an exact empty array', () => {
    const result = getHook();
    act(() => result.current.handleDeleteItem('item1'));
    expect(placedItems).toEqual([
      { id: 'item2', visible: false, rotation: 90, gridX: 2, gridY: 2 },
      { id: 'item3', type: 'door', open: false, rotation: 0, gridX: 3, gridY: 3 },
      { id: 'item4', visible: true, gridX: 4, gridY: 4 },
    ]);
    expect(setSelectedItem).toHaveBeenCalledWith(null);
    act(() => {
      result.current.handleDeleteItem('item2');
      result.current.handleDeleteItem('item3');
      result.current.handleDeleteItem('item4');
    });
    expect(placedItems).toEqual([]);
    expect(setPlacedItems).toHaveBeenCalledTimes(4);
  });

  it('rotates +90, defaults missing rotation to 0, wraps 270 to 0, others untouched', () => {
    const result = getHook();
    act(() => {
      result.current.handleRotate('item1');
      result.current.handleRotate('item4'); // no rotation property -> 0 + 90
    });
    expect(placedItems).toEqual([
      { id: 'item1', visible: true, rotation: 90, gridX: 1, gridY: 1 },
      { id: 'item2', visible: false, rotation: 90, gridX: 2, gridY: 2 },
      { id: 'item3', type: 'door', open: false, rotation: 0, gridX: 3, gridY: 3 },
      { id: 'item4', visible: true, rotation: 90, gridX: 4, gridY: 4 },
    ]);
    const spins = [0, 0, 0].map(() => {
      act(() => result.current.handleRotate('item1'));
      return placedItems[0].rotation;
    });
    expect(spins).toEqual([180, 270, 0]);
    expect(setSelectedItem).not.toHaveBeenCalled();
  });

  it('flips a door open then closed, others byte-identical, clearing selection each time', () => {
    const result = getHook();
    act(() => result.current.handleToggleDoor('item3'));
    expect(placedItems).toEqual([
      { id: 'item1', visible: true, rotation: 0, gridX: 1, gridY: 1 },
      { id: 'item2', visible: false, rotation: 90, gridX: 2, gridY: 2 },
      { id: 'item3', type: 'door', open: true, rotation: 0, gridX: 3, gridY: 3 },
      { id: 'item4', visible: true, gridX: 4, gridY: 4 },
    ]);
    act(() => result.current.handleToggleDoor('item3'));
    expect(placedItems[2].open).toBe(false);
    expect(setPlacedItems).toHaveBeenCalledTimes(2);
    expect(setSelectedItem).toHaveBeenCalledTimes(2);
    expect(setSelectedItem).toHaveBeenCalledWith(null);
  });

  it('is inert for unknown ids and non-door ids but delete and door-toggle still clear selection', () => {
    const result = getHook();
    const refs = [...placedItems];
    act(() => {
      result.current.handleToggleItemVisibility('nonexistent');
      result.current.handleRotate('nonexistent');
      result.current.handleDeleteItem('nonexistent');
      result.current.handleToggleDoor('nonexistent');
      result.current.handleToggleDoor('item1'); // id matches but type is not door
    });
    // Every survivor keeps reference identity — nothing was rewritten, only re-mapped.
    placedItems.forEach((item, i) => expect(item).toBe(refs[i]));
    expect(placedItems[0].open).toBeUndefined();
    // Honest behavior: the unconditional setSelectedItem(null) in delete/toggleDoor fires
    // even when nothing was found or toggled — 3 calls total (delete + both door attempts),
    // never from visibility/rotate.
    expect(setSelectedItem).toHaveBeenCalledTimes(3);
    expect(setSelectedItem).toHaveBeenCalledWith(null);
    expect(setPlacedItems).toHaveBeenCalledTimes(5);
  });
});
