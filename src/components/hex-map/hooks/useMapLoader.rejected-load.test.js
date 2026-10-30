// @maintained-by-ai
/**
 * Regression lock for backlog map-fresh-fallback-silent (hex producer lane):
 * a named outdoor map whose load THROWS (404 "Map not found", abort, corrupt
 * JSON) fell through to createAndSaveNewMap, which POSTed immediately —
 * resurrecting the corrupt/dead file on a ZERO-edit open, with only a
 * console.error as the trace.
 *
 * Locked here (mirrors the indoor useMapLoader.rejected-load.test.js):
 *   1. rejected load ⇒ fresh editor renders, the user-facing
 *      `Could not load "<map>"` notice fires, and NOTHING is written across
 *      the debounce window and unmount — including the needsResetViewRef
 *      zoom/pan centering pass, which is view-only drift and gets ADOPTED
 *      into the dirty baseline instead of PUT;
 *   2. the first REAL edit (terrain) persists exactly once to the same map
 *      name — user intent re-creates the document on purpose;
 *   3. the falsy-resolve "no document yet" create lane still direct-saves
 *      once and stays SILENT (no notice);
 *   4. a successful load stays silent and writes nothing (byte-identical
 *      zero-edit open, criteria 5 + 6).
 *
 * Console loudness is kept pinned (no-silent-fallback law fix#337S #798).
 * Harness mirrors useMapLoader.createNew.test.js (fake timers, spies on the
 * mapsService transport seam).
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useMapLoader from './useMapLoader.js';
import * as mapsService from '../../../services/maps/mapsService.js';
import { buildMapLoadRejectedNotice } from '../../../services/maps/mapLoadNotice.js';
import { hexKey } from '../../../services/maps/hexMapUtils.js';

// Fake only the transport seam — config, hexKey, travelService and the
// notice builder run real.
vi.mock('../../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
    saveMapData: vi.fn(() => Promise.resolve()),
}));

const CAMPAIGN = 'test-campaign';
const MAP = 'qa-hex-dead';
const CHARACTERS = [{ name: 'Thorin' }];

describe('hex useMapLoader — rejected-load fallback (notice + zero-PUT gate)', () => {
    let noticeSpy;
    let consoleErrorSpy;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        noticeSpy = vi.fn();
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mapsService.saveMapData.mockResolvedValue({});
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    const renderLoader = () =>
        renderHook(() => useMapLoader(CAMPAIGN, MAP, CHARACTERS, noticeSpy));

    const settleLoad = async () => {
        await act(async () => {});
    };

    it('rejected load: renders the fresh editor, fires the named notice, and writes NOTHING', async () => {
        mapsService.loadMapData.mockRejectedValue(new Error('Map not found'));

        const { result, unmount } = renderLoader();
        await settleLoad();

        // Fresh editor renders: outdoor-shaped blank document, view reset armed.
        expect(result.current.loading).toBe(false);
        expect(result.current.mapData.type).toBe('outdoor');
        expect(result.current.needsResetViewRef.current).toBe(true);

        // Loud console honesty is kept (fix#337S #798)…
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Failed to load hex map data (falling through to fresh map):',
            expect.any(Error),
        );
        // …and the user now sees it too (backlog map-fresh-fallback-silent).
        expect(noticeSpy).toHaveBeenCalledTimes(1);
        expect(noticeSpy).toHaveBeenCalledWith(buildMapLoadRejectedNotice(MAP));
        expect(noticeSpy.mock.calls[0][0]).toContain('Could not load');
        expect(noticeSpy.mock.calls[0][0]).toContain(MAP);

        // The createAndSaveNewMap POST that resurrected the dead file is GONE
        // — zero writes across the debounce window and unmount.
        await act(async () => { vi.advanceTimersByTime(5000); });
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
        unmount(); // unmount flush must find nothing pending under the dead name
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
    });

    it('view-normalize centering after the fallback is adopted, never PUT', async () => {
        mapsService.loadMapData.mockRejectedValue(new Error('Map not found'));

        const { result } = renderLoader();
        await settleLoad();

        // HexMap's needsResetViewRef layout effect rewrites zoom/pan one
        // commit after the loading flip. That drift is normalization, not
        // intent — the baseline adopts it and the document still writes
        // nothing (a PUT here would resurrect the corrupt file).
        act(() => {
            result.current.setZoom(2);
            result.current.setPanX(753.4);
            result.current.setPanY(-120.7);
        });
        await act(async () => { vi.advanceTimersByTime(5000); });
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
        expect(noticeSpy).toHaveBeenCalledTimes(1);
    });

    it('the first REAL edit after the fallback persists exactly once to the same map name', async () => {
        mapsService.loadMapData.mockRejectedValue(new Error('Map not found'));

        const { result } = renderLoader();
        await settleLoad();
        await act(async () => { vi.advanceTimersByTime(2000); });
        expect(mapsService.saveMapData).not.toHaveBeenCalled();

        // A real terrain stroke (user intent) re-creates the document through
        // the normal debounced full-envelope lane.
        act(() => {
            result.current.setTerrain(prev => ({ ...prev, [hexKey(1, 1)]: 'forest' }));
        });
        expect(mapsService.saveMapData).not.toHaveBeenCalled(); // debounced, not immediate

        await act(async () => { vi.advanceTimersByTime(1500); });
        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
        expect(mapsService.saveMapData).toHaveBeenCalledWith(CAMPAIGN, MAP, expect.objectContaining({
            type: 'outdoor',
            displayName: MAP,
            terrain: expect.objectContaining({ [hexKey(1, 1)]: 'forest' }),
        }));
    });

    it('falsy-resolve create lane still direct-saves once and stays silent (no notice)', async () => {
        mapsService.loadMapData.mockResolvedValue(null);

        const { result } = renderLoader();
        await settleLoad();

        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
        expect(mapsService.saveMapData).toHaveBeenCalledWith(CAMPAIGN, MAP, expect.objectContaining({
            type: 'outdoor',
        }));
        expect(noticeSpy).not.toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
        expect(result.current.loading).toBe(false);
    });

    it('successful load: no notice, no writes, console stays clean', async () => {
        mapsService.loadMapData.mockResolvedValue({
            type: 'outdoor',
            displayName: 'Good Map',
            terrain: { [hexKey(0, 0)]: 'hills' },
            rivers: [],
            roads: [],
            pois: [],
            gridSize: 10,
            zoom: 2,
            panX: 0,
            panY: 0,
        });

        const { result } = renderLoader();
        await settleLoad();
        await act(async () => { vi.advanceTimersByTime(5000); });

        expect(noticeSpy).not.toHaveBeenCalled();
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
        expect(result.current.mapData.displayName).toBe('Good Map');
    });
});
