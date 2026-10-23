// @maintained-by-ai
/*
 * useMapLoader — API & persistence lane (post-load public surface).
 *
 * Owns here: every exposed setter updates its paired state slot; each change
 * persists to mapsService.saveMapData as one exact full snapshot envelope;
 * setTravelStateRef publishes the ref + bumps travelSaveVersion + persists
 * travelState; a load resolving after unmount never saves.
 *
 * Lane map (do NOT duplicate across these files):
 * - mount/load args + loaded-field application -> useMapLoader.loadExisting.test.js
 * - pre-load defaults and ref seeding            -> useMapLoader.init.test.js
 * - create-new-map bytes (miss / load reject)    -> useMapLoader.createNew.test.js
 * - travelInit derivation from loaded travelState -> useMapLoader.travelState.test.js
 * Container tests (HexMap*.test.jsx) mock this hook wholesale, so the real
 * setter/ref/persistence contract is verified only in this file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useMapLoader from './useMapLoader.js';

// Fake only the transport seam and the numeric config fixtures (real
// DEFAULT_GRID_SIZE is 30 — fixtures pin 10-scale math); the hook's own
// state/reducer logic runs for real.
vi.mock('../../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
    saveMapData: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/campaign/travelService.js', () => ({
    getDailyHexBudget: vi.fn(() => 4),
}));

vi.mock('../../../config/outdoorConfig.js', () => ({
    DEFAULT_GRID_SIZE: 10,
    GRID_COLS_MULTIPLIER: 2,
    MIN_ZOOM: 2,
    DEFAULT_TERRAIN: 'plains',
}));

import * as mapsService from '../../../services/maps/mapsService.js';

const CAMPAIGN = 'test-campaign';
const MAP = 'test-map';

const characters = [
    { name: 'Thorin' },
    { name: 'Gandalf' },
];

// Factory so each render gets fresh objects (the hook stores these by reference).
const loadedMap = () => ({
    type: 'outdoor',
    displayName: 'Frostpeak Wilderness',
    terrain: { '1,1': 'hills' },
    rivers: [{ hexes: ['2,2'] }],
    roads: [],
    pois: [{ name: 'Watchtower' }],
    gridSize: 12,
    zoom: 3,
    panX: 40,
    panY: 60,
    marchingOrder: ['Gandalf', 'Thorin'],
    partyPosition: { q: 7, r: 3 },
    weather: 'fog',
    travelState: {},
});

// The exact envelope the save effect writes: every persisted slot of current
// state, keyed exactly as mapsService.saveMapData receives it.
const savedSnapshot = (overrides = {}) => ({
    type: 'outdoor',
    displayName: 'Frostpeak Wilderness',
    gridSize: 12,
    terrain: { '1,1': 'hills' },
    rivers: [{ hexes: ['2,2'] }],
    roads: [],
    pois: [{ name: 'Watchtower' }],
    zoom: 3,
    panX: 40,
    panY: 60,
    marchingOrder: ['Gandalf', 'Thorin'],
    partyPosition: { q: 7, r: 3 },
    weather: 'fog',
    travelState: null,
    ...overrides,
});

// Renders the hook against an already-loaded map and waits for the load to
// settle with waitFor (no raw timers), so tests exercise the post-load API.
const renderLoadedHook = async () => {
    mapsService.loadMapData.mockResolvedValue(loadedMap());
    const utils = renderHook(() => useMapLoader(CAMPAIGN, MAP, characters));
    await waitFor(() => expect(utils.result.current.loading).toBe(false));
    return utils;
};

describe('useMapLoader - API & persistence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('exposes setters whose changes persist to saveMapData as one exact full snapshot', async () => {
        const { result } = await renderLoadedHook();

        // Loading a map flushes the loaded state through the save envelope
        // exactly once — deterministic: the persistence effect's guard is the
        // `loading` STATE (in its deps), flipped in the same update batch as
        // the loaded state, so the flush cannot miss (#800).
        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
        expect(mapsService.saveMapData).toHaveBeenCalledWith(CAMPAIGN, MAP, savedSnapshot());
        mapsService.saveMapData.mockClear();

        act(() => {
            result.current.setMapData({ type: 'cave' });
            result.current.setGridSize(20);
            result.current.setTerrain({ '5,5': 'mountain' });
            result.current.setRivers([{ hexes: ['0,0'] }]);
            result.current.setRoads([{ hexes: ['1,1'] }]);
            result.current.setPois([{ name: 'Camp' }]);
            result.current.setMarchingOrder(['Thorin']);
            result.current.setPartyPosition({ q: 3, r: 4 });
            result.current.setWeather('rain');
            result.current.setTravelInit({ travelMode: 'active' });
            result.current.setZoom(5);
            result.current.setPanX(100);
            result.current.setPanY(50);
        });

        await waitFor(() => expect(mapsService.saveMapData).toHaveBeenCalledTimes(1));
        expect(mapsService.saveMapData).toHaveBeenCalledWith(CAMPAIGN, MAP, savedSnapshot({
            gridSize: 20,
            terrain: { '5,5': 'mountain' },
            rivers: [{ hexes: ['0,0'] }],
            roads: [{ hexes: ['1,1'] }],
            pois: [{ name: 'Camp' }],
            marchingOrder: ['Thorin'],
            partyPosition: { q: 3, r: 4 },
            weather: 'rain',
            zoom: 5,
            panX: 100,
            panY: 50,
        }));

        // Non-persisted slots stay readable through the same exposed API.
        expect(result.current.mapData).toEqual({ type: 'cave' });
        expect(result.current.travelInit).toEqual({ travelMode: 'active' });
    });

    it('setTravelStateRef publishes the ref, bumps travelSaveVersion, and persists travelState', async () => {
        const { result } = await renderLoadedHook();
        mapsService.saveMapData.mockClear();

        const initialVersion = result.current.travelSaveVersion;
        act(() => {
            result.current.setTravelStateRef({ travelMode: 'active', destination: 'City A' });
        });

        expect(result.current.travelSaveVersion).toBe(initialVersion + 1);
        expect(result.current.travelStateRef.current).toEqual({ travelMode: 'active', destination: 'City A' });

        await waitFor(() => expect(mapsService.saveMapData).toHaveBeenCalledTimes(1));
        expect(mapsService.saveMapData).toHaveBeenCalledWith(CAMPAIGN, MAP, savedSnapshot({
            travelState: { travelMode: 'active', destination: 'City A' },
        }));
    });

    // #800 RACE-DETERMINISTIC pin: every fresh mount of an existing map
    // flushes EXACTLY ONE save with the exact loaded snapshot — across
    // repeated mounts in this single invocation, no once-or-not-at-all.
    it('flushes exactly one loaded snapshot on each of 5 repeated mounts', async () => {
        for (let i = 0; i < 5; i++) {
            mapsService.saveMapData.mockClear();
            const { unmount } = await renderLoadedHook();

            const calls = mapsService.saveMapData.mock.calls;
            expect(calls, `mount ${i} save count`).toHaveLength(1);
            expect(calls[0], `mount ${i} loaded snapshot envelope`).toEqual([CAMPAIGN, MAP, savedSnapshot()]);
            unmount();
        }
    });

    // #801 IN-PLACE mapName switch lane: the persistence guard (:201) compares
    // live mapName against hexMapNameRef — the name whose bytes this instance
    // HOLDS. Pre-fix the ref was never written after `useRef(mapName)`, so an
    // in-place A→B switch opened guard-death: every later save was swallowed
    // silently (red capture below documented zero saves for B). Fix: the load
    // effect reloads on a name change and claims hexMapNameRef.current inside
    // applyExistingMap/createAndSaveNewMap BEFORE the loading-flip batch, so
    // (a) the switch commit still cannot write A's bytes to B's URL, and
    // (b) saves resume under B exactly once when B's bytes land (#800 flush
    // determinism preserved — the trigger remains the loading STATE).
    describe('in-place mapName switch (same hook instance, no remount)', () => {
        const loadedMapB = () => ({
            type: 'outdoor',
            displayName: 'The Marshlands',
            terrain: { '9,9': 'bog' },
            rivers: [],
            roads: [],
            pois: [{ name: 'Fen Shrine' }],
            gridSize: 14,
            zoom: 4,
            panX: 7,
            panY: 9,
            marchingOrder: ['Gandalf', 'Thorin'],
            partyPosition: { q: 5, r: 2 },
            weather: 'clear',
            travelState: {},
        });

        const renderSwitchableHook = async () => {
            let resolveB = () => {};
            mapsService.loadMapData.mockImplementation((_campaign, name) =>
                (name === MAP ? Promise.resolve(loadedMap()) : new Promise(res => { resolveB = res; })));
            const utils = renderHook(
                ({ mapName }) => useMapLoader(CAMPAIGN, mapName, characters),
                { initialProps: { mapName: MAP } },
            );
            await waitFor(() => expect(utils.result.current.loading).toBe(false));
            expect(mapsService.saveMapData).toHaveBeenCalledTimes(1); // mount flush of A
            mapsService.saveMapData.mockClear();
            // Delegate through a function: spread would snapshot the placeholder
            // before the map-b request assigns the real resolver.
            return { ...utils, resolveLoadB: (m) => resolveB(m) };
        };

        it('never writes map A bytes to map B URL, then reloads B and saves under B exactly once', async () => {
            const { result, rerender, resolveLoadB } = await renderSwitchableHook();

            rerender({ mapName: 'map-b' });
            // Switch commit + pending-load renders: cross-map prevention holds —
            // no save may address map-b while A's bytes are still held.
            await act(async () => {});
            expect(mapsService.saveMapData).not.toHaveBeenCalled();

            await act(async () => { resolveLoadB(loadedMapB()); });
            await waitFor(() => expect(result.current.loading).toBe(false));

            // Save guard reopened exactly once, addressed to B with B's bytes.
            expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
            expect(mapsService.saveMapData).toHaveBeenCalledWith(CAMPAIGN, 'map-b', {
                type: 'outdoor',
                displayName: 'The Marshlands',
                gridSize: 14,
                terrain: { '9,9': 'bog' },
                rivers: [],
                roads: [],
                pois: [{ name: 'Fen Shrine' }],
                zoom: 4,
                panX: 7,
                panY: 9,
                marchingOrder: ['Gandalf', 'Thorin'],
                partyPosition: { q: 5, r: 2 },
                weather: 'clear',
                travelState: null,
            });
            expect(result.current.hexMapNameRef.current).toBe('map-b');

            // Post-switch edits land under B too (no silent-save death).
            mapsService.saveMapData.mockClear();
            act(() => { result.current.setTerrain({ '9,9': 'bog', '1,0': 'forest' }); });
            await waitFor(() => expect(mapsService.saveMapData).toHaveBeenCalledTimes(1));
            expect(mapsService.saveMapData).toHaveBeenCalledWith(CAMPAIGN, 'map-b',
                expect.objectContaining({ terrain: { '9,9': 'bog', '1,0': 'forest' } }));
        });

        it('drops A edits attempted during B load instead of smuggling them into B', async () => {
            const { result, rerender } = await renderSwitchableHook();

            rerender({ mapName: 'map-b' });
            // A dirty A-state mutation mid-switch: guard must swallow nothing but
            // cross-map bytes — it blocks every save until B's bytes land.
            act(() => { result.current.setTerrain({ '1,1': 'blasted' }); });
            await act(async () => {});
            expect(mapsService.saveMapData).not.toHaveBeenCalledWith(CAMPAIGN, 'map-b', expect.anything());
            expect(mapsService.saveMapData).not.toHaveBeenCalledWith(CAMPAIGN, MAP, expect.anything());
        });
    });

    it('ignores a load that resolves after unmount and never saves', async () => {
        let resolveLoad;
        mapsService.loadMapData.mockReturnValue(new Promise(resolve => { resolveLoad = resolve; }));
        const { unmount } = renderHook(() => useMapLoader(CAMPAIGN, MAP, characters));

        unmount();
        await act(async () => {
            resolveLoad(loadedMap());
        });

        // A late-resolving load must not spill into a save after unmount. A throw
        // inside the load path would fall through to createAndSaveNewMap and save,
        // so zero save calls proves the quiet path held (act-clean, no crash).
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
    });
});
