// @maintained-by-ai 2026-11-24
/**
 * Lane: map loader — pagehide keepalive flush (backlog 2026-11-24 QE).
 * Hard reload/tab-close mid-stroke (pointer DOWN, moves already in state) or
 * inside the 1s autosave debounce window used to silently drop the pending
 * document (witnessed: DOM 15 walls → reload → disk 12). The `pagehide`
 * listener must push the pending dirty doc through the unload-twin keepalive
 * PUT lane (saveMapDataKeepalive, mirrors soundOwner.js
 * releaseTvPresenceKeepalive), stay SILENT when nothing is dirty (zero extra
 * traffic on an idle mount + reload), and stay idempotent with the existing
 * pointer-up/debounce/unmount flushes (a doc already flushed must never
 * double-PUT on pagehide).
 *
 * Authored debounce timers = permitted save-debounce category (No-Game-Timers
 * allowlist); vi.useFakeTimers flushed deterministically like the sibling
 * useMapLoader.test.js. jsdom has no PageTransitionEvent, so the harness
 * dispatches a plain Event('pagehide') — the listener only cares about type.
 */
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useMapLoader from './useMapLoader.js';
import * as mapsService from '../../../services/maps/mapsService.js';
import { DEFAULT_GRID_SIZE } from '../../../config/mapConfig.js';

const CAMPAIGN = 'test-campaign';
const MAP = 'qa-flush-map';

const dispatchPageHide = () => {
  act(() => {
    window.dispatchEvent(new Event('pagehide'));
  });
};

describe('useMapLoader pagehide keepalive flush', () => {
  let saveMapDataSpy;
  let keepaliveSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(mapsService, 'loadMapData').mockResolvedValue({
      players: [],
      walls: ['1,1', '1,2', '1,3'],
      placedItems: [],
      gridSize: 40,
      revealed: [],
    });
    saveMapDataSpy = vi.spyOn(mapsService, 'saveMapData').mockResolvedValue({});
    keepaliveSpy = vi.spyOn(mapsService, 'saveMapDataKeepalive').mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderLoader = (props = {}) =>
    renderHook(
      () => {
        const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
        return {
          ...useMapLoader({
            campaignName: CAMPAIGN,
            characters: [],
            mapName: MAP,
            gridSize,
            setGridSize,
            isLocalhost: true,
            ...props,
          }),
          gridSize,
        };
      },
    );

  // Settle the mount load (dirty gate ⇒ zero writes on a clean open) without
  // leaving anything queued, so later assertions see only flush-driven calls.
  const loadQuiet = async () => {
    await act(async () => { vi.advanceTimersByTime(1500); });
    expect(saveMapDataSpy).not.toHaveBeenCalled();
    expect(keepaliveSpy).not.toHaveBeenCalled();
  };

  const paintStrokeCells = (result, cells) => {
    // Mirrors useWallDrawing mid-stroke commits: every pointermove appends a
    // wall cell to state; the autosave effect queues the dirty doc but the
    // 1s debounce has NOT fired yet.
    for (const cell of cells) {
      act(() => result.current.setMapData(prev => ({
        ...prev,
        walls: new Set([...prev.walls, cell]),
      })));
      act(() => { vi.advanceTimersByTime(120); });
    }
  };

  it('flushes the pending dirty doc through the keepalive lane when pagehide fires inside the debounce window (mid-stroke reload)', async () => {
    const { result } = renderLoader();
    await loadQuiet();

    paintStrokeCells(result, ['15,8', '15,9', '15,10']);
    // Still inside the debounce window: nothing has hit the normal PUT lane.
    expect(saveMapDataSpy).not.toHaveBeenCalled();

    dispatchPageHide();

    expect(keepaliveSpy).toHaveBeenCalledTimes(1);
    expect(keepaliveSpy).toHaveBeenCalledWith(CAMPAIGN, MAP, expect.objectContaining({
      walls: ['1,1', '1,2', '1,3', '15,8', '15,9', '15,10'],
      gridSize: 40,
    }));
    expect(saveMapDataSpy).not.toHaveBeenCalled();
  });

  it('is idempotent: consume + baseline move means a second pagehide (and the elapsed debounce) write nothing', async () => {
    const { result } = renderLoader();
    await loadQuiet();

    paintStrokeCells(result, ['4,4']);
    dispatchPageHide();
    expect(keepaliveSpy).toHaveBeenCalledTimes(1);

    // Same-event repeats (e.g. pagehide then a second unload signal) and the
    // debounce timer the flush cancelled must all stay silent.
    dispatchPageHide();
    await act(async () => { vi.advanceTimersByTime(3000); });
    expect(keepaliveSpy).toHaveBeenCalledTimes(1);
    expect(saveMapDataSpy).not.toHaveBeenCalled();
  });

  it('issues ZERO pagehide traffic when nothing is dirty (idle mount + reload network census)', async () => {
    renderLoader();
    await loadQuiet();

    dispatchPageHide();

    expect(keepaliveSpy).not.toHaveBeenCalled();
    expect(saveMapDataSpy).not.toHaveBeenCalled();
  });

  it('does not double-PUT after a pointer-up flush already consumed the pending doc', async () => {
    const { result } = renderLoader();
    await loadQuiet();

    paintStrokeCells(result, ['7,0', '7,1']);
    // Map.jsx handleToolPointerUp → flushSave() (normal lane).
    act(() => result.current.flushSave());
    expect(saveMapDataSpy).toHaveBeenCalledTimes(1);

    dispatchPageHide();
    expect(keepaliveSpy).not.toHaveBeenCalled();
  });

  it('does not double-PUT when the 1s debounce already flushed before the reload', async () => {
    const { result } = renderLoader();
    await loadQuiet();

    paintStrokeCells(result, ['9,9']);
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(saveMapDataSpy).toHaveBeenCalledTimes(1);

    dispatchPageHide();
    expect(keepaliveSpy).not.toHaveBeenCalled();
  });

  it('writes nothing on pagehide for read-only (non-localhost) clients', async () => {
    const { result } = renderLoader({ isLocalhost: false });
    await loadQuiet();

    // The autosave effect queues a pending doc even for visitors (flushSave
    // drops it); the pagehide lane must drop it too, never PUT.
    paintStrokeCells(result, ['2,2']);
    dispatchPageHide();

    expect(keepaliveSpy).not.toHaveBeenCalled();
    expect(saveMapDataSpy).not.toHaveBeenCalled();
  });

  it('unmounting removes the pagehide listener (no stale-hook flushes after navigation)', async () => {
    const { result, unmount } = renderLoader();
    await loadQuiet();

    paintStrokeCells(result, ['3,3']);
    unmount();
    // The unmount flush consumed the pending doc through the NORMAL lane.
    expect(saveMapDataSpy).toHaveBeenCalledTimes(1);

    dispatchPageHide();
    expect(keepaliveSpy).not.toHaveBeenCalled();
    expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
  });
});
