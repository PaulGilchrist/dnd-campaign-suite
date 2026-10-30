// @maintained-by-ai
/**
 * Regression lock for bug-hex-poi-enter-deleted-map-phantom-resurrect (indoor
 * producer lane): a REJECTED load (deleted map, 404 "Map not found") fell
 * through to a fresh document AND immediately PUT it back — resurrecting the
 * deleted file as a nameless/typeless ghost `{players,walls,gridSize,
 * placedItems}` listed under its raw slug, with zero user feedback.
 *
 * Locked here:
 *   1. rejected load ⇒ the blank editor mounts, the user-facing
 *      `Could not load "<map>"` notice fires (backlog
 *      map-fresh-fallback-silent), and writes NOTHING across the debounce
 *      window, a manual flush, and unmount;
 *   2. the first REAL edit (explicit user intent) persists exactly once through
 *      the normal debounced lane — "must not auto-persist unless the user
 *      explicitly edits";
 *   3. the falsy-resolve create lane (legacy no-document answer) still direct-
 *      saves the exact empty payload EXACTLY once, SILENTLY (no notice; the
 *      baseline is seeded with the same builder as the persistence envelope);
 *   4. a successful load stays silent and writes nothing (zero-edit open).
 *
 * Mirror of useMapLoader.test.js harness (fake timers, real gridSize state,
 * spies on mapsService).
 */
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useMapLoader from './useMapLoader.js';
import * as mapsService from '../../../services/maps/mapsService.js';
import { buildMapLoadRejectedNotice } from '../../../services/maps/mapLoadNotice.js';
import { DEFAULT_GRID_SIZE } from '../../../config/mapConfig.js';

const CAMPAIGN = 'test-campaign';
const MAP = 'qa-room-runai';
const CHARACTERS = [{ name: 'Thorin', class: 'Fighter' }];

describe('useMapLoader — rejected-load phantom-resurrect guard', () => {
  let loadMapDataSpy;
  let saveMapDataSpy;
  let consoleErrorSpy;
  let noticeSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    loadMapDataSpy = vi.spyOn(mapsService, 'loadMapData').mockRejectedValue(new Error('Map not found'));
    saveMapDataSpy = vi.spyOn(mapsService, 'saveMapData').mockResolvedValue({});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    noticeSpy = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderLoader = (mapName = MAP) =>
    renderHook(
      (props) => {
        const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
        return {
          ...useMapLoader({ ...props, gridSize, setGridSize }),
          gridSize,
        };
      },
      { initialProps: { campaignName: CAMPAIGN, characters: CHARACTERS, mapName, onLoadRejected: noticeSpy } },
    );

  it('mounts the blank fallthrough, NOTICES the user, and NEVER re-creates the deleted document — zero writes on open, debounce, flush, and unmount', async () => {
    const { result, unmount } = renderLoader();
    await act(async () => {});

    // Loud console honesty is kept (fix#337S #798 no-silent-fallback law)…
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load map data (falling through to fresh map):',
      expect.any(Error),
    );
    // …and the rejected-load lane is now VISIBLE too (backlog
    // map-fresh-fallback-silent): named notice, fresh-copy explanation.
    expect(noticeSpy).toHaveBeenCalledTimes(1);
    expect(noticeSpy).toHaveBeenCalledWith(buildMapLoadRejectedNotice(MAP));
    expect(noticeSpy.mock.calls[0][0]).toContain('Could not load');
    expect(noticeSpy.mock.calls[0][0]).toContain(MAP);
    // …but the open-time create-save that resurrected the file is GONE.
    await act(async () => { vi.advanceTimersByTime(5000); });
    act(() => result.current.flushSave());
    expect(saveMapDataSpy).not.toHaveBeenCalled();

    unmount(); // unmount flush must find nothing pending under the dead name
    expect(saveMapDataSpy).not.toHaveBeenCalled();
  });

  it('persists exactly once when the user EXPLICITLY edits after a rejected load', async () => {
    const { result } = renderLoader();
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(saveMapDataSpy).not.toHaveBeenCalled();

    // A real stroke dirtying the blank document re-creates the file on purpose,
    // through the normal debounced full-snapshot lane.
    act(() => result.current.setMapData((prev) => ({ ...prev, walls: new Set(['3,4']) })));
    expect(saveMapDataSpy).not.toHaveBeenCalled(); // debounced, not immediate

    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
    expect(saveMapDataSpy).toHaveBeenCalledWith(CAMPAIGN, MAP, expect.objectContaining({
      walls: ['3,4'],
      players: [],
    }));
  });

  it('falsy-resolve create lane still direct-saves the exact empty payload exactly once, SILENTLY (no re-PUT twin, no notice)', async () => {
    loadMapDataSpy.mockResolvedValue(null);

    const { result } = renderLoader();
    await act(async () => {});

    expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
    expect(saveMapDataSpy).toHaveBeenCalledWith(CAMPAIGN, MAP, {
      players: [],
      walls: [],
      gridSize: DEFAULT_GRID_SIZE,
      placedItems: [],
    });
    // The "no document yet" create lane is legitimate — it stays invisible
    // (backlog map-fresh-fallback-silent distinguishes it from a REJECTED
    // load, which alone gets the notice).
    expect(noticeSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    // The baseline is seeded with the SAME builder the persistence effect uses
    // (walls normalized to an array), so the loading-flip pass compares clean
    // instead of re-PUTting a normalization twin.
    await act(async () => { vi.advanceTimersByTime(5000); });
    act(() => result.current.flushSave());
    expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
    expect(result.current.mapData.walls).toEqual(new Set());
  });

  it('successful load: no notice, no writes, console stays clean', async () => {
    loadMapDataSpy.mockResolvedValue({
      players: [{ name: 'Thorin', x: 1, y: 1 }],
      walls: ['2,3'],
      gridSize: DEFAULT_GRID_SIZE,
      placedItems: [],
    });

    const { result } = renderLoader();
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(5000); });
    act(() => result.current.flushSave());

    expect(noticeSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(saveMapDataSpy).not.toHaveBeenCalled();
    expect(result.current.mapData.walls).toEqual(new Set(['2,3']));
  });
});
