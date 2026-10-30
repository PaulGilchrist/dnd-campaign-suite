// @maintained-by-ai
/*
 * useMapLoader — create-new-map lane (createAndSaveNewMap path).
 *
 * Owns here: when loadMapData MISSES (falsy resolve — the legitimate
 * "no document yet" lane), the hook builds a fresh outdoor map from the REAL
 * config defaults (DEFAULT_GRID_SIZE, GRID_COLS_MULTIPLIER, MIN_ZOOM,
 * DEFAULT_TERRAIN — not fixture-pinned numbers) and saves the exact create
 * payload; exposed state matches that payload byte-for-byte; a rejected
 * initial save logs the exact console bytes and leaves the fresh map intact.
 * A load that THROWS (404/abort/corrupt) no longer creates-and-saves — that
 * render-only fallback lane is owned by useMapLoader.rejected-load.test.js.
 *
 * Lane map (do NOT duplicate across these files):
 * - post-load setters + envelope persistence        -> useMapLoader.api.test.js
 * - mount/load args + loaded-field application      -> useMapLoader.loadExisting.test.js
 * - pre-load defaults and ref seeding               -> useMapLoader.init.test.js
 * - travelInit derivation from loaded travelState   -> useMapLoader.travelState.test.js
 *
 * Honest scoping notes (known source bugs, not masked here): all fixtures
 * use a constant mapName, so the #801 seams (hexMapNameRef was never
 * updated after `useRef(mapName)`, dead-closing saves on an in-place
 * change) are exercised by the in-place switch arms of
 * useMapLoader.api.test.js, not here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useMapLoader from './useMapLoader.js';
import { DEFAULT_GRID_SIZE, GRID_COLS_MULTIPLIER, MIN_ZOOM, DEFAULT_TERRAIN } from '../../../config/outdoorConfig.js';
import { hexKey } from '../../../services/maps/hexMapUtils.js';

// Fake only the transport seam — config, hexKey, and travelService run real
// (travelService is never invoked on the create path).
vi.mock('../../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
    saveMapData: vi.fn(() => Promise.resolve()),
}));

import * as mapsService from '../../../services/maps/mapsService.js';

const CAMPAIGN = 'test-campaign';
const MAP = 'test-map';

const characters = [
    { name: 'Thorin' },
    { name: 'Gandalf' },
];

const COLS = DEFAULT_GRID_SIZE * GRID_COLS_MULTIPLIER;
const ROWS = DEFAULT_GRID_SIZE;
const CENTER_POS = { q: Math.floor(COLS / 2), r: Math.floor(ROWS / 2) };

const fullPlainsTerrain = () => {
    const terrain = {};
    for (let r = 0; r < ROWS; r++) {
        for (let q = 0; q < COLS; q++) {
            terrain[hexKey(q, r)] = DEFAULT_TERRAIN;
        }
    }
    return terrain;
};

// The exact payload createAndSaveNewMap hands to saveMapData (and stores as
// mapData): full grid of plains, defaults derived from real config.
const freshPayload = (chars = characters) => ({
    type: 'outdoor',
    gridSize: DEFAULT_GRID_SIZE,
    terrain: fullPlainsTerrain(),
    pois: [],
    roads: [],
    zoom: MIN_ZOOM,
    marchingOrder: chars.map(c => c.name),
    partyPosition: chars.length > 0 ? CENTER_POS : null,
});

const renderNewMap = (chars = characters) =>
    renderHook(() => useMapLoader(CAMPAIGN, MAP, chars));

// The ONLY save a successful fresh create makes: the exact direct create-save
// fired inside createAndSaveNewMap. #800's second "mount envelope" write is
// gone — the post-create success seeds the persistence baseline with that
// envelope shape, so the loading-flip commit sees zero dirt and skips (dirty
// gate, backlog 2026-10-26). The envelope's extra normalized slots
// (displayName/rivers/pan/weather/travelState) ride along with the next edit.
const expectFreshCreateSave = (chars = characters) => {
    const calls = mapsService.saveMapData.mock.calls;
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual([CAMPAIGN, MAP, freshPayload(chars)]);
};

// Fresh envelope as the persistence effect writes it (mount snapshot of the
// fresh state), for standalone exact pins.
const freshEnvelope = (chars = characters) => ({
    ...freshPayload(chars),
    displayName: MAP,
    rivers: [],
    panX: 0,
    panY: 0,
    weather: null,
    travelState: null,
});

const waitForLoad = async (result) => {
    await waitFor(() => expect(result.current.loading).toBe(false));
};

describe('useMapLoader - creating new map', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mapsService.loadMapData.mockResolvedValue(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('builds and saves the exact fresh outdoor map from config defaults when no data exists', async () => {
        const { result } = renderNewMap();
        await waitForLoad(result);

        // Direct create-save then exact mount envelope — both, once each.
        expectFreshCreateSave();

        // Exposed state equals that payload exactly — full plains grid
        // (count, boundary keys, values), center party position, view reset.
        expect(result.current.mapData).toEqual(freshPayload());
        expect(result.current.terrain).toEqual(fullPlainsTerrain());
        expect(result.current.gridSize).toBe(DEFAULT_GRID_SIZE);
        expect(result.current.marchingOrder).toEqual(['Thorin', 'Gandalf']);
        expect(result.current.partyPosition).toEqual(CENTER_POS);
        expect(result.current.zoom).toBe(MIN_ZOOM);
        expect(result.current.panX).toBe(0);
        expect(result.current.panY).toBe(0);
        expect(result.current.needsResetViewRef.current).toBe(true);
        expect(result.current.rivers).toEqual([]);
        expect(result.current.weather).toBeNull();
    });

    it('leaves marchingOrder empty and partyPosition null when there are no characters', async () => {
        const { result } = renderNewMap([]);
        await waitForLoad(result);

        expectFreshCreateSave([]);
        expect(result.current.marchingOrder).toEqual([]);
        expect(result.current.partyPosition).toBeNull();
    });

    it('logs and keeps the fresh map when the initial save rejects — the flip pass retries the envelope', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mapsService.saveMapData.mockRejectedValueOnce(new Error('Save failed'));

        const { result } = renderNewMap();
        await waitForLoad(result);
        // Envelope retry rides the 1s coalescing autosave window (improve
        // 2026-10-26-D) — settle past it before counting calls.
        await act(async () => { await new Promise(resolve => setTimeout(resolve, 1300)); });

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith('Failed to save initial hex map data:', expect.any(Error));
        // Failed create leaves the baseline null, so the loading-flip
        // persistence pass PUTs the full envelope — no silent data loss.
        const calls = mapsService.saveMapData.mock.calls;
        expect(calls).toHaveLength(2);
        expect(calls[0]).toEqual([CAMPAIGN, MAP, freshPayload()]);
        expect(calls[1]).toEqual([CAMPAIGN, MAP, freshEnvelope()]);
        expect(result.current.mapData).toEqual(freshPayload());
        expect(result.current.marchingOrder).toEqual(['Thorin', 'Gandalf']);
        expect(result.current.loading).toBe(false);
    });

    // Dirty-gate determinism (backlog 2026-10-26, supersedes the #800 2-save
    // pin): repeated fresh mounts write the create payload EXACTLY once — the
    // old normalization envelope re-PUT is gated away.
    it('persists exactly one create-save on every one of 5 repeated mounts', async () => {
        for (let i = 0; i < 5; i++) {
            mapsService.saveMapData.mockClear();
            const { result, unmount } = renderNewMap();
            await waitForLoad(result);

            const calls = mapsService.saveMapData.mock.calls;
            expect(calls, `mount ${i} save count`).toHaveLength(1);
            expect(calls[0], `mount ${i} create payload`).toEqual([CAMPAIGN, MAP, freshPayload()]);
            unmount();
        }
    });

    // #800 deferred arm, re-pinned for the dirty gate: hold the create-save
    // open past the setter flush, then resolve it — the loading flip only
    // happens after the save settles, and its persistence pass finds the
    // seeded baseline equal to its envelope ⇒ still exactly ONE save.
    it('stays at one save when the create-save resolves after the setter flush', async () => {
        let resolveSave;
        mapsService.saveMapData.mockReturnValue(new Promise(resolve => { resolveSave = resolve; }));

        const { result } = renderNewMap();
        // Let the fresh-state setters commit while the create-save is pending.
        await act(async () => {});
        expect(mapsService.saveMapData.mock.calls).toHaveLength(1);

        await act(async () => { resolveSave(); });
        await waitForLoad(result);
        // Give the loading-flush's passive effect its run.
        await act(async () => {});

        const calls = mapsService.saveMapData.mock.calls;
        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual([CAMPAIGN, MAP, freshPayload()]);
    });
});
