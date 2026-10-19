// @maintained-by-ai
/**
 * Lane: map loader — owns (campaign, map) → fetch exact-once (#786 transport bytes),
 * loaded-state adoption, save-post payload exactness, 1s autosave debounce flush
 * semantics (authored debounce timers = permitted save-debounce category; no
 * wall-clock GAME advancement; vi.useFakeTimers flushed deterministically),
 * error honesty (#819), and unmount/map-switch flush.
 *
 * Open source-bug pins (reported only, never fixed here — line refs are current
 * useMapLoader.js; prior-pass refs :161/:188-210/:178/:210 map to these seams):
 *   :37    loadedMapNameRef guard keyed on mapName only — campaignName/characters
 *          changes never reload → stale outdoor map (#799) ... pinned below
 *   :78-92 autosave effect re-saves a freshly loaded map with zero edits →
 *          mount-save scheduling race (#800) ... pinned below
 *   :60-62 silent catch — a failed GET falls through to overwriting the map
 *          with an empty one ... pinned below
 *   :50-57 reconciliation only ever runs at load time (stale-ref) ... pinned below
 *
 * Old→new: initialization(4)+empty-create→1; existing-data(6)→2+3;
 * reconciliation(6)→4+5+7; error-handling(2)→6; re-render(4)→7+8;
 * batched autosave(5)→2(pin)+8+9+10+11.
 */
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useMapLoader from './useMapLoader.js';
import * as mapsService from '../../../services/maps/mapsService.js';
import { DEFAULT_GRID_SIZE } from '../../../config/mapConfig.js';

const CAMPAIGN = 'test-campaign';
const MAP = 'dungeon-floor-1';
const CHARACTERS = [
  { name: 'Thorin', class: 'Fighter' },
  { name: 'Elaria', class: 'Wizard' },
];

describe('useMapLoader', () => {
  let loadMapDataSpy;
  let saveMapDataSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    loadMapDataSpy = vi.spyOn(mapsService, 'loadMapData').mockResolvedValue(null);
    saveMapDataSpy = vi.spyOn(mapsService, 'saveMapData').mockResolvedValue({});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Stateful harness: gridSize is real state so the payload reflects what the
  // hook actually told its owner, not a mock capture.
  const renderLoader = ({
    campaignName = CAMPAIGN,
    characters = CHARACTERS,
    mapName = MAP,
  } = {}) =>
    renderHook(
      (props) => {
        const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
        return {
          ...useMapLoader({ ...props, gridSize, setGridSize }),
          gridSize,
        };
      },
      { initialProps: { campaignName, characters, mapName } },
    );

  // Settle the mount load, flush its debounced mount re-save (see pin table),
  // then clear so later assertions see only stroke-driven traffic.
  const loadAndClearSaves = async ({ result }) => {
    await act(async () => {});
    act(() => result.current.flushSave());
    saveMapDataSpy.mockClear();
  };

  it('loads (campaign, map) exactly once on mount, gating loadInProgressRef, and saves an exact empty-map payload when none exists', async () => {
    let resolveLoad;
    loadMapDataSpy.mockImplementation(() => new Promise((r) => { resolveLoad = r; }));

    const { result } = renderLoader();

    expect(result.current.loadInProgressRef.current).toBe(true);
    expect(result.current.mapData).toBeNull();
    expect(loadMapDataSpy).toHaveBeenCalledWith(CAMPAIGN, MAP);

    await act(async () => { resolveLoad(null); });

    expect(loadMapDataSpy).toHaveBeenCalledTimes(1);
    expect(result.current.loadInProgressRef.current).toBe(false);
    expect(result.current.mapData).toEqual({ players: [], walls: new Set() });
    expect(saveMapDataSpy).toHaveBeenCalledWith(CAMPAIGN, MAP, {
      players: [],
      walls: [],
      gridSize: DEFAULT_GRID_SIZE,
      placedItems: [],
    });
  });

  it('adopts an existing map exactly and — FIXME(#800, useMapLoader.js:78-92) — re-saves it unchanged once the debounce elapses', async () => {
    const existing = {
      players: [{ name: 'Thorin' }],
      walls: ['1,1', '2,2'],
      placedItems: [{ id: 'a', gridX: 1, gridY: 2 }],
      gridSize: 50,
      revealed: ['3,3'],
    };
    loadMapDataSpy.mockResolvedValue(existing);

    const { result } = renderLoader();
    await act(async () => {});

    expect(result.current.mapData.walls).toBeInstanceOf(Set);
    expect(Array.from(result.current.mapData.walls)).toEqual(['1,1', '2,2']);
    expect(result.current.placedItems).toEqual(existing.placedItems);
    expect(result.current.gridSize).toBe(50);
    expect(saveMapDataSpy).not.toHaveBeenCalled();

    // Pin: a fresh load with ZERO edits schedules a full round-trip write.
    // Bug-pinned intentionally pending the #800 mount-save fix.
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
    expect(saveMapDataSpy).toHaveBeenCalledWith(CAMPAIGN, MAP, {
      players: [{ name: 'Thorin' }],
      walls: ['1,1', '2,2'],
      placedItems: [{ id: 'a', gridX: 1, gridY: 2 }],
      gridSize: 50,
      revealed: ['3,3'],
    });
  });

  it('defaults missing fields of an existing map (empty walls Set, revealed [], placedItems [], gridSize fallback)', async () => {
    loadMapDataSpy.mockResolvedValue({});

    const { result } = renderLoader();
    await act(async () => {});

    expect(result.current.mapData.walls).toEqual(new Set());
    expect(result.current.mapData.revealed).toEqual([]);
    expect(result.current.mapData.players).toBeUndefined();
    expect(result.current.placedItems).toEqual([]);
    expect(result.current.gridSize).toBe(DEFAULT_GRID_SIZE);
  });

  it('reconciles loaded players against the characters list, keeping survivors in order', async () => {
    loadMapDataSpy.mockResolvedValue({
      players: [{ name: 'Thorin' }, { name: 'Grimjaw' }, { name: 'Elaria' }],
      walls: [],
      placedItems: [],
      gridSize: 40,
    });

    const { result } = renderLoader();
    await act(async () => {});

    expect(result.current.mapData.players.map((p) => p.name)).toEqual(['Thorin', 'Elaria']);
  });

  it('does not reconcile players when characters is empty or absent, or after characters later change', async () => {
    const existing = {
      players: [{ name: 'Thorin' }, { name: 'Elaria' }],
      walls: [],
      placedItems: [],
      gridSize: 40,
    };
    loadMapDataSpy.mockResolvedValue(existing);

    // falsy-shortcut ([] / null) and truthy-empty are the guard's two shapes
    for (const characters of [CHARACTERS.slice(0, 0), null]) {
      const { result } = renderLoader({ characters });
      await act(async () => {});
      expect(result.current.mapData.players).toEqual(existing.players);
    }

    // FIXME(#799, useMapLoader.js:37): a later characters/campaign change
    // can never re-reconcile — the mapName-only guard returns before load.
    const { result, rerender } = renderLoader();
    await act(async () => {});
    const loadsBefore = loadMapDataSpy.mock.calls.length;
    rerender({ campaignName: 'other-campaign', characters: [{ name: 'Newbie' }], mapName: MAP });
    await act(async () => {});

    expect(loadMapDataSpy).toHaveBeenCalledTimes(loadsBefore);
    expect(loadMapDataSpy).toHaveBeenLastCalledWith(CAMPAIGN, MAP);
    expect(result.current.mapData.players).toEqual(existing.players);
  });

  it('falls through to an empty map and logs when load fails — FIXME(useMapLoader.js:60-62): silent catch overwrites on a transient GET failure', async () => {
    loadMapDataSpy.mockRejectedValue(new Error('Network error'));
    saveMapDataSpy.mockRejectedValue(new Error('Save failed'));

    const { result } = renderLoader();
    await act(async () => {});

    expect(result.current.loadInProgressRef.current).toBe(false);
    expect(result.current.mapData.players).toEqual([]);
    expect(result.current.mapData.walls).toEqual(new Set());
    expect(saveMapDataSpy).toHaveBeenCalledWith(CAMPAIGN, MAP, {
      players: [],
      walls: [],
      gridSize: DEFAULT_GRID_SIZE,
      placedItems: [],
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to save initial map data:',
      expect.any(Error),
    );
  });

  it('ignores campaignName and characters changes while mapName is unchanged — FIXME(#799, useMapLoader.js:37): guard never resets, outdoor map stays stale', async () => {
    loadMapDataSpy.mockResolvedValue({ players: [], walls: ['1,1'], placedItems: [], gridSize: 40 });

    const { result, rerender } = renderLoader();
    await act(async () => {});
    loadMapDataSpy.mockClear();

    rerender({ campaignName: 'other-campaign', characters: [{ name: 'Newbie' }], mapName: MAP });
    await act(async () => {});

    expect(loadMapDataSpy).not.toHaveBeenCalled();
    expect(result.current.mapData.walls).toEqual(new Set(['1,1']));
    // pending mount-save is flushed under the PREVIOUS campaign, never the new one
    expect(saveMapDataSpy).toHaveBeenCalledWith(CAMPAIGN, MAP, expect.any(Object));
  });

  it('flushes pending edits under the previous map name and loads the new map exactly once when mapName switches', async () => {
    const { result, rerender } = renderLoader();
    await loadAndClearSaves({ result });

    act(() => result.current.setMapData((prev) => ({ ...prev, walls: new Set(['9,9']) })));
    expect(saveMapDataSpy).not.toHaveBeenCalled();

    loadMapDataSpy.mockResolvedValue({ players: [], walls: ['2,2'], placedItems: [], gridSize: 40 });
    rerender({ campaignName: CAMPAIGN, characters: CHARACTERS, mapName: 'other-map' });
    await act(async () => {});

    expect(saveMapDataSpy).toHaveBeenCalledWith(CAMPAIGN, MAP, expect.objectContaining({ walls: ['9,9'] }));
    expect(loadMapDataSpy).toHaveBeenCalledWith(CAMPAIGN, 'other-map');
    expect(result.current.mapData.walls).toEqual(new Set(['2,2']));
  });

  it('coalesces painted and erased cells through a stroke into one exact save on manual flush', async () => {
    loadMapDataSpy.mockResolvedValue({ players: [], walls: ['5,0', '5,1', '5,2'], placedItems: [], gridSize: 40 });

    const { result } = renderLoader();
    await loadAndClearSaves({ result });

    act(() => result.current.setMapData((prev) => ({ ...prev, walls: new Set([...prev.walls, '7,0']) })));
    act(() => result.current.setMapData((prev) => {
      const walls = new Set(prev.walls);
      walls.delete('5,1');
      return { ...prev, walls };
    }));
    expect(saveMapDataSpy).not.toHaveBeenCalled();

    act(() => result.current.flushSave());
    expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
    expect(saveMapDataSpy.mock.calls[0][2].walls).toEqual(['5,0', '5,2', '7,0']);

    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(saveMapDataSpy).toHaveBeenCalledTimes(1); // flush consumed the pending save
  });

  it('autosaves exactly once when the 1s debounce elapses, containing every edit since the last flush', async () => {
    const { result } = renderLoader();
    await loadAndClearSaves({ result });

    act(() => result.current.setMapData((prev) => ({ ...prev, walls: new Set([...prev.walls, '5,0']) })));
    await act(async () => { vi.advanceTimersByTime(500); });
    act(() => result.current.setMapData((prev) => ({ ...prev, walls: new Set([...prev.walls, '5,1']) })));
    expect(saveMapDataSpy).not.toHaveBeenCalled();

    await act(async () => { vi.advanceTimersByTime(999); });
    expect(saveMapDataSpy).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
    expect(saveMapDataSpy.mock.calls[0][2].walls).toEqual(['5,0', '5,1']);
  });

  it('flushes pending edits on unmount so no stroke data is lost', async () => {
    const { result, unmount } = renderLoader();
    await loadAndClearSaves({ result });

    act(() => result.current.setMapData((prev) => ({ ...prev, walls: new Set([...prev.walls, '7,3']) })));
    expect(saveMapDataSpy).not.toHaveBeenCalled();

    unmount();
    expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
    expect(saveMapDataSpy.mock.calls[0][2].walls).toEqual(['7,3']);
  });
});
