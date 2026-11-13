// @maintained-by-ai
/*
 * useMapLoader — existing-map load lane (applyExistingMap path).
 *
 * Owns here: when loadMapData resolves with a map, the hook requests it once
 * with campaign + map name, and the FULL post-load state equals the loaded
 * payload (one exact full toEqual, #786) with the VIEW pre-settled: the loader
 * now applies the old-default centering / clamp normalization itself (shared
 * hexViewMath, backlog 2026-11-12 VX) so HexMap's post-flip layout pass can no
 * longer re-dirty the baseline. Missing optional fields
 * land on the REAL config defaults (#800 pattern: config is un-mocked);
 * zoom clamps up to MIN_ZOOM; the needsResetViewRef old-default quirk and
 * blank-displayName fallback behave as documented; the loaded flag flips as
 * part of the applied-state assertion.
 *
 * Lane map (do NOT duplicate across these files):
 * - post-load setters + envelope persistence        -> useMapLoader.api.test.js
 * - pre-load defaults + :189 pending-save guard     -> useMapLoader.init.test.js
 * - create-new-map bytes (miss / load reject :178)  -> useMapLoader.createNew.test.js
 * - travelInit derivation from loaded travelState     -> useMapLoader.travelState.test.js
 *
 * Honest scoping notes (known source bugs, not masked here): fixtures use a
 * constant mapName, so the #801 re-arm/re-claim seams are exercised by the
 * in-place switch arms of useMapLoader.api.test.js, not here, and the :178
 * silent catch is not surfaced by this lane's resolving-load fixtures.
 * The former :188-210 mount-save race is FIXED in the source (#800): the
 * persistence guard is now the `loading` state, whose flip commit is what
 * deterministically flushes this lane's loaded snapshot exactly once.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { cloneDeep } from 'lodash';
import useMapLoader from './useMapLoader.js';
import { DEFAULT_GRID_SIZE, GRID_COLS_MULTIPLIER, MIN_ZOOM } from '../../../config/outdoorConfig.js';
import { hexGridPixelBounds, clampHexPan, centerHexView, VIEW_RESET_ZOOM } from '../../../services/maps/hexViewMath.js';

// Fake only the transport seam (#791). Config, hexKey, and travelService run
// real; travelService's getDailyHexBudget executes for inactive fixtures but
// its result never surfaces here (travelInit derivation is the travelState
// lane's contract), so no numeric fixture drift is possible.
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

// Real-config grid center for maps with no saved partyPosition.
const CENTER_POS = {
    q: Math.floor((DEFAULT_GRID_SIZE * GRID_COLS_MULTIPLIER) / 2),
    r: Math.floor(DEFAULT_GRID_SIZE / 2),
};

// View bytes the loader pre-applies at mount (backlog 2026-11-12 VX): the
// old-default (0,0) pan settles to the shared centerHexView reset, everything
// else to the clamp — bit-identical to what HexMap's post-flip layout pass
// computes, so the view leg no longer re-dirties the baseline one commit late.
const settledView = (gridSize, zoom, panX, panY) => {
    const z = Math.max(MIN_ZOOM, zoom);
    const p = clampHexPan(hexGridPixelBounds(gridSize * GRID_COLS_MULTIPLIER, gridSize), gridSize, z, panX, panY);
    return { zoom: z, panX: p.x, panY: p.y };
};
const centeredView = (gridSize) => {
    const p = centerHexView(gridSize * GRID_COLS_MULTIPLIER, gridSize, VIEW_RESET_ZOOM);
    return { zoom: VIEW_RESET_ZOOM, panX: p.x, panY: p.y };
};

// Renders the hook against a map whose load resolves and waits for the load
// to finish with waitFor (no fixed timers, #783) so post-load state is
// observed deterministically. The expectation is deep-cloned BEFORE render so
// assertions cannot be satisfied by the hook mutating the very object it
// stores in state (#710).
const renderLoadedMap = async (loaded, chars = characters) => {
    const expected = cloneDeep(loaded);
    mapsService.loadMapData.mockResolvedValue(loaded);
    const utils = renderHook(() => useMapLoader(CAMPAIGN, MAP, chars));
    await waitFor(() => expect(utils.result.current.loading).toBe(false));
    return { ...utils, expected };
};

// The full public state surface the load owns, captured as one object for a
// single exact full toEqual of the applied state.
const appliedState = (result) => ({
    loading: result.loading,
    mapData: result.mapData,
    gridSize: result.gridSize,
    terrain: result.terrain,
    rivers: result.rivers,
    roads: result.roads,
    pois: result.pois,
    zoom: result.zoom,
    panX: result.panX,
    panY: result.panY,
    marchingOrder: result.marchingOrder,
    partyPosition: result.partyPosition,
    weather: result.weather,
});

describe('useMapLoader - load existing map data', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('requests the existing map once with campaign and map name, even across re-renders', async () => {
        const { rerender } = await renderLoadedMap({});

        rerender();

        expect(mapsService.loadMapData).toHaveBeenCalledTimes(1);
        expect(mapsService.loadMapData).toHaveBeenCalledWith(CAMPAIGN, MAP);
    });

    it('applies the loaded bytes verbatim — full post-load state equals the loaded payload', async () => {
        const { result, expected } = await renderLoadedMap({
            type: 'cave',
            displayName: 'Frostpeak Wilderness',
            terrain: { '1,1': 'hills', '2,3': 'forest' },
            rivers: [{ hexes: ['2,2'] }],
            roads: [{ hexes: ['3,3'] }],
            pois: [{ name: 'Watchtower' }],
            gridSize: 12,
            zoom: 5,
            panX: 100,
            panY: 200,
            marchingOrder: ['Alaric', 'Serena'],
            partyPosition: { q: 7, r: 4 },
            weather: 'stormy',
            travelState: {},
        });

        expect(appliedState(result.current)).toEqual({
            loading: false,
            mapData: expected,
            gridSize: 12,
            terrain: { '1,1': 'hills', '2,3': 'forest' },
            rivers: [{ hexes: ['2,2'] }],
            roads: [{ hexes: ['3,3'] }],
            pois: [{ name: 'Watchtower' }],
            // Every field lands verbatim EXCEPT the view, which the loader
            // pre-settles (clamp pass) to what HexMap's layout pass would
            // have normalized to one commit later.
            ...settledView(12, 5, 100, 200),
            marchingOrder: ['Alaric', 'Serena'],
            partyPosition: { q: 7, r: 4 },
            weather: 'stormy',
        });
        expect(result.current.hexMapDisplayNameRef.current).toBe('Frostpeak Wilderness');
        // A saved non-(0, 0) pan is restored, so no view reset is requested.
        expect(result.current.needsResetViewRef.current).toBe(false);
    });

    it('clamps a saved zoom below MIN_ZOOM up to MIN_ZOOM', async () => {
        const { result } = await renderLoadedMap({ zoom: MIN_ZOOM - 1 });

        expect(result.current.zoom).toBe(MIN_ZOOM);
    });

    describe('view reset flag (normalizeExistingView)', () => {
        it.each([
            { label: 'the old default pan (0, 0)', loaded: { panX: 0, panY: 0 }, expectedView: centeredView(DEFAULT_GRID_SIZE), expectedReset: true },
            { label: 'a saved single-axis pan', loaded: { panX: 0, panY: 75 }, expectedView: settledView(DEFAULT_GRID_SIZE, MIN_ZOOM, 0, 75), expectedReset: false },
            // Current behavior: missing pan bytes are NOT (0, 0), so they are
            // treated as a saved view (only an explicit (0, 0) requests a
            // reset) — but the saved view is still CLAMPED into coverage at
            // mount (backlog 2026-11-12 VX: the loader pre-applies what the
            // HexMap layout pass used to normalize post-flip).
            { label: 'missing pan fields', loaded: {}, expectedView: settledView(DEFAULT_GRID_SIZE, MIN_ZOOM, 0, 0), expectedReset: false },
        ])('view $expectedView for $label requests a view reset: $expectedReset',
            async ({ loaded, expectedView, expectedReset }) => {
                const { result } = await renderLoadedMap(loaded);

                expect({ zoom: result.current.zoom, panX: result.current.panX, panY: result.current.panY }).toEqual(expectedView);
                expect(result.current.needsResetViewRef.current).toBe(expectedReset);
            });
    });

    it('falls back to the map name for a blank displayName', async () => {
        const { result } = await renderLoadedMap({ displayName: '' });

        expect(result.current.hexMapDisplayNameRef.current).toBe(MAP);
    });

    describe('map with every optional field missing', () => {
        it('applies the real-config default state and rebuilds the party from characters', async () => {
            const { result } = await renderLoadedMap({});

            expect(appliedState(result.current)).toEqual({
                loading: false,
                mapData: { type: 'outdoor' },
                gridSize: DEFAULT_GRID_SIZE,
                terrain: {},
                rivers: [],
                roads: [],
                pois: [],
                ...settledView(DEFAULT_GRID_SIZE, MIN_ZOOM, 0, 0),
                marchingOrder: ['Thorin', 'Gandalf'],
                partyPosition: CENTER_POS,
                weather: null,
            });
            expect(result.current.hexMapDisplayNameRef.current).toBe(MAP);
            // Missing pan bytes are not explicit (0, 0) — documented current
            // behavior: no view reset is requested.
            expect(result.current.needsResetViewRef.current).toBe(false);
        });

        it('leaves marchingOrder empty without characters, still centering partyPosition', async () => {
            const { result } = await renderLoadedMap({}, []);

            expect(result.current.marchingOrder).toEqual([]);
            // Existing-map path centers partyPosition from the grid even with
            // no party (the create path's null is owned by the createNew lane).
            expect(result.current.partyPosition).toEqual(CENTER_POS);
        });
    });
});
