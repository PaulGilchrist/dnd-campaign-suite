// @maintained-by-ai
/**
 * Backlog 2026-11-13 CF: the indoor mount-time players-reconcile silently
 * EVICTED doc `players` whose names miss the campaign roster (hand-seeded or
 * renamed tokens vanished within ~2s via the reconciled-array autosave).
 *
 * Locked here (feedback added, behavior NOT changed):
 *   1. an eviction of N tokens fires the toast path with the count + reason
 *      ("Removed 1 token with no matching character", pluralized) AND a
 *      console.info listing the evicted names;
 *   2. the reconciled array still autosaves through the normal debounced
 *      whole-doc lane — the eviction itself is untouched;
 *   3. a clean open (players all in roster / doc has no players / empty
 *      characters list) stays SILENT: no toast, no eviction console.info.
 *
 * Mirror of useMapLoader.rejected-load.test.js harness (fake timers, real
 * gridSize state, spies on mapsService).
 */
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useMapLoader from './useMapLoader.js';
import * as mapsService from '../../../services/maps/mapsService.js';
import { DEFAULT_GRID_SIZE } from '../../../config/mapConfig.js';

const CAMPAIGN = 'test-campaign';
const MAP = 'qa-room-evict';
const CHARACTERS = [{ name: 'Thorin', class: 'Fighter' }, { name: 'Mira', class: 'Wizard' }];

describe('useMapLoader — token-eviction feedback (backlog 2026-11-13 CF)', () => {
  let loadMapDataSpy;
  let saveMapDataSpy;
  let consoleInfoSpy;
  let consoleErrorSpy;
  let evictToastSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    loadMapDataSpy = vi.spyOn(mapsService, 'loadMapData');
    saveMapDataSpy = vi.spyOn(mapsService, 'saveMapData').mockResolvedValue({});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    evictToastSpy = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderLoader = (characters = CHARACTERS) =>
    renderHook(
      (props) => {
        const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
        return {
          ...useMapLoader({ ...props, gridSize, setGridSize }),
          gridSize,
        };
      },
      {
        initialProps: {
          campaignName: CAMPAIGN, characters, mapName: MAP,
          onTokensEvicted: evictToastSpy,
        },
      },
    );

  const docWith = (players) => ({
    players,
    walls: [],
    gridSize: DEFAULT_GRID_SIZE,
    placedItems: [],
  });

  it('evicts 1 roster-less token: toast names the count + reason, console.info lists the names, reconciled array still autosaves', async () => {
    loadMapDataSpy.mockResolvedValue(docWith([
      { name: 'Thorin', x: 1, y: 1 },
      { name: 'ZZGhostToken', x: 2, y: 2 },
    ]));

    const { result } = renderLoader();
    await act(async () => {});

    expect(evictToastSpy).toHaveBeenCalledTimes(1);
    expect(evictToastSpy).toHaveBeenCalledWith('Removed 1 token with no matching character');
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy.mock.calls[0][0]).toContain('no matching character');
    expect(consoleInfoSpy.mock.calls[0][1]).toEqual(['ZZGhostToken']);

    // Eviction behavior unchanged: state reconciled, and the delta dirtying
    // the document still rides the debounced whole-doc PUT lane.
    expect(result.current.mapData.players).toEqual([{ name: 'Thorin', x: 1, y: 1 }]);
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
    expect(saveMapDataSpy).toHaveBeenCalledWith(CAMPAIGN, MAP, expect.objectContaining({
      players: [{ name: 'Thorin', x: 1, y: 1 }],
    }));
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it('evicts 2 tokens: toast pluralizes ("2 tokens") and console.info lists both names', async () => {
    loadMapDataSpy.mockResolvedValue(docWith([
      { name: 'ZZGhostToken', x: 2, y: 2 },
      { name: 'RenamedGuy', x: 3, y: 3 },
    ]));

    renderLoader();
    await act(async () => {});

    expect(evictToastSpy).toHaveBeenCalledTimes(1);
    expect(evictToastSpy).toHaveBeenCalledWith('Removed 2 tokens with no matching character');
    expect(consoleInfoSpy.mock.calls[0][1]).toEqual(['ZZGhostToken', 'RenamedGuy']);
  });

  it('clean open (all players in roster): NO toast, NO eviction console.info, NO write', async () => {
    loadMapDataSpy.mockResolvedValue(docWith([{ name: 'Mira', x: 4, y: 4 }]));

    renderLoader();
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(5000); });

    expect(evictToastSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
    expect(saveMapDataSpy).not.toHaveBeenCalled();
  });

  it('doc with no players: silent clean open', async () => {
    loadMapDataSpy.mockResolvedValue({ walls: [], gridSize: DEFAULT_GRID_SIZE, placedItems: [] });

    renderLoader();
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(5000); });

    expect(evictToastSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });

  it('empty characters list: reconcile skipped entirely — silent, no eviction', async () => {
    loadMapDataSpy.mockResolvedValue(docWith([{ name: 'ZZGhostToken', x: 2, y: 2 }]));

    renderLoader([]);
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(5000); });

    expect(evictToastSpy).not.toHaveBeenCalled();
    expect(consoleInfoSpy).not.toHaveBeenCalled();
  });
});
