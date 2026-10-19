// @maintained-by-ai
/*
 * useMapLoader — create-new-map lane (createAndSaveNewMap path).
 *
 * Owns here: when loadMapData misses or rejects, the hook builds a fresh
 * outdoor map from the REAL config defaults (DEFAULT_GRID_SIZE,
 * GRID_COLS_MULTIPLIER, MIN_ZOOM, DEFAULT_TERRAIN — not fixture-pinned
 * numbers) and saves the exact create payload; exposed state matches that
 * payload byte-for-byte; a rejected initial save logs the exact console
 * bytes and leaves the fresh map intact.
 *
 * Lane map (do NOT duplicate across these files):
 * - post-load setters + envelope persistence        -> useMapLoader.api.test.js
 * - mount/load args + loaded-field application      -> useMapLoader.loadExisting.test.js
 * - pre-load defaults and ref seeding               -> useMapLoader.init.test.js
 * - travelInit derivation from loaded travelState   -> useMapLoader.travelState.test.js
 *
 * Honest scoping notes (known source bugs, not masked here): all fixtures
 * use a constant mapName, so this lane cannot exercise the never-updated
 * hexMapNameRef (:210) or the never-reset isInitialized (:161) on a
 * mapName change; the load-reject fall-through below rides the silent
 * catch at :178 and asserts the intended fall-through outcome only.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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

// calls[0] is always the exact direct create-save fired inside
// createAndSaveNewMap. The persistence-effect envelope (adds displayName/
// rivers/weather/pan/travelState slots around the same fresh state) may
// also flush at mount — the source's await seam between the setters and
// hasLoaded.current makes that effect-flush scheduling-dependent — so a
// second save is allowed but pinned exactly when present, never beyond.
const expectFreshCreateSave = (chars = characters) => {
    const calls = mapsService.saveMapData.mock.calls;
    expect(calls.length).toBeLessThanOrEqual(2);
    expect(calls[0]).toEqual([CAMPAIGN, MAP, freshPayload(chars)]);
    if (calls.length === 2) {
        expect(calls[1]).toEqual([CAMPAIGN, MAP, {
            ...freshPayload(chars),
            displayName: MAP,
            rivers: [],
            panX: 0,
            panY: 0,
            weather: null,
            travelState: null,
        }]);
    }
};

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

        // Direct create-save (+ optional exact mount envelope) once each.
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

    it('falls through to fresh-map creation when the load rejects', async () => {
        mapsService.loadMapData.mockRejectedValue(new Error('Network error'));

        const { result } = renderNewMap();
        await waitForLoad(result);

        expectFreshCreateSave();
        expect(result.current.marchingOrder).toEqual(['Thorin', 'Gandalf']);
        expect(result.current.needsResetViewRef.current).toBe(true);
    });

    it('logs and keeps the fresh map when the initial save rejects', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mapsService.saveMapData.mockRejectedValueOnce(new Error('Save failed'));

        const { result } = renderNewMap();
        await waitForLoad(result);

        expect(errorSpy).toHaveBeenCalledTimes(1);
        expect(errorSpy).toHaveBeenCalledWith('Failed to save initial hex map data:', expect.any(Error));
        expectFreshCreateSave();
        expect(result.current.mapData).toEqual(freshPayload());
        expect(result.current.marchingOrder).toEqual(['Thorin', 'Gandalf']);
        expect(result.current.loading).toBe(false);
    });
});
