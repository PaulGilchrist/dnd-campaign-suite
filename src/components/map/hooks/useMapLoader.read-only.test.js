// @maintained-by-ai
/**
 * Regression lock for bug-player-clients-clobber-fog-reset: a read-only
 * (network) client that mounts <Map> must issue ZERO map-document writes.
 * Live 2026-10-24 a LAN player tab PUT /maps/test-map seconds after a GM fog
 * reset, re-persisting its own stale fully-revealed copy and silently undoing
 * the GM edit. The whole-document save lanes (initial-create, autosave debounce,
 * and the flushSave chokepoint every pointer-up/unmount routes through) are now
 * gated on `isLocalhost`; only the GM (localhost) authors the map document.
 * Players still RECEIVE every change via SSE (useSSESync) — untouched here.
 *
 * Mirror of useMapLoader.test.js harness (fake timers, real gridSize state,
 * spy on mapsService) so the assertions see only write traffic.
 */
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useMapLoader from './useMapLoader.js';
import * as mapsService from '../../../services/maps/mapsService.js';
import { DEFAULT_GRID_SIZE } from '../../../config/mapConfig.js';

const CAMPAIGN = 'test-campaign';
const MAP = 'test-map';
const CHARACTERS = [{ name: 'Thorin', class: 'Fighter' }];

describe('useMapLoader — read-only client (non-localhost)', () => {
  let loadMapDataSpy;
  let saveMapDataSpy;

  beforeEach(() => {
    vi.useFakeTimers();
    loadMapDataSpy = vi.spyOn(mapsService, 'loadMapData').mockResolvedValue({
      players: [{ name: 'Thorin' }],
      walls: ['10,5'],
      placedItems: [],
      gridSize: 20,
      revealed: [],
    });
    saveMapDataSpy = vi.spyOn(mapsService, 'saveMapData').mockResolvedValue({});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const renderReadOnlyLoader = () =>
    renderHook((props) => {
      const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
      return {
        ...useMapLoader({ ...props, gridSize, setGridSize }),
        gridSize,
      };
    }, { initialProps: { campaignName: CAMPAIGN, characters: CHARACTERS, mapName: MAP, isLocalhost: false } });

  it('still loads the map for a read-only client', async () => {
    const { result } = renderReadOnlyLoader();
    await act(async () => {});

    expect(loadMapDataSpy).toHaveBeenCalledWith(CAMPAIGN, MAP);
    expect(result.current.mapData.walls).toEqual(new Set(['10,5']));
    expect(result.current.mapData.revealed).toEqual([]);
  });

  it('issues NO map-document save on mount, on debounce, or on manual flush', async () => {
    const { result } = renderReadOnlyLoader();
    await act(async () => {});

    act(() => result.current.flushSave());
    await act(async () => { vi.advanceTimersByTime(5000); });

    expect(saveMapDataSpy).not.toHaveBeenCalled();
  });

  it('issues NO save when edits (revealed merge, walls, token drag shapes) flow through setMapData', async () => {
    const { result } = renderReadOnlyLoader();
    await act(async () => {});

    // The exact clobber vector: player-side exploration-memory merge.
    act(() => result.current.setMapData((prev) => ({ ...prev, revealed: ['0,0', '1,1', '2,2'] })));
    act(() => result.current.setMapData((prev) => ({ ...prev, walls: new Set([...prev.walls, '5,5']) })));
    await act(async () => { vi.advanceTimersByTime(5000); });
    act(() => result.current.flushSave());

    expect(saveMapDataSpy).not.toHaveBeenCalled();
  });

  it('issues NO save on unmount', async () => {
    const { result, unmount } = renderReadOnlyLoader();
    await act(async () => {});

    act(() => result.current.setMapData((prev) => ({ ...prev, revealed: ['9,9'] })));
    unmount();

    expect(saveMapDataSpy).not.toHaveBeenCalled();
  });

  it('issues NO save on initial-create fallback when the map document is missing', async () => {
    loadMapDataSpy.mockResolvedValue(null);

    const { result } = renderReadOnlyLoader();
    await act(async () => {});
    await act(async () => { vi.advanceTimersByTime(5000); });
    act(() => result.current.flushSave());

    // Blank grid is rendered locally, but the player never creates the document.
    expect(result.current.mapData.walls).toEqual(new Set());
    expect(saveMapDataSpy).not.toHaveBeenCalled();
  });

  it('GM (localhost) still persists edits — the gate is role-scoped, not a save kill', async () => {
    const { result } = renderHook((props) => {
      const [gridSize, setGridSize] = useState(DEFAULT_GRID_SIZE);
      return useMapLoader({ ...props, gridSize, setGridSize });
    }, { initialProps: { campaignName: CAMPAIGN, characters: CHARACTERS, mapName: MAP, isLocalhost: true } });
    await act(async () => {});

    act(() => result.current.setMapData((prev) => ({ ...prev, revealed: ['1,1'] })));
    await act(async () => { vi.advanceTimersByTime(1000); });

    expect(saveMapDataSpy).toHaveBeenCalledTimes(1);
    expect(saveMapDataSpy.mock.calls[0][2].revealed).toEqual(['1,1']);
  });
});
