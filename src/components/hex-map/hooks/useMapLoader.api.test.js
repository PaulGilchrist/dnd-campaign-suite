// @maintained-by-ai
/*
 * useMapLoader — API & persistence lane (post-load public surface).
 *
 * Owns here: every exposed setter updates its paired state slot; each change
 * persists to mapsService.saveMapData as one exact full snapshot envelope;
 * the mount-write census (one settling PUT for an unsettled doc, zero for a
 * settled one — backlog 2026-11-12 VX); setTravelStateRef publishes the ref +
 * bumps travelSaveVersion + persists travelState; a load resolving after
 * unmount never saves.
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
vi.mock('../../../config/outdoorConfig.js', () => ({
    DEFAULT_GRID_SIZE: 10,
    GRID_COLS_MULTIPLIER: 2,
    MIN_ZOOM: 2,
    DEFAULT_TERRAIN: 'plains',
    HEX_SIZE: 30,
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
    saveMapData: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/campaign/travelService.js', () => ({
    getDailyHexBudget: vi.fn(() => 4),
}));

import * as mapsService from '../../../services/maps/mapsService.js';
import { hexGridPixelBounds, clampHexPan, centerHexView, VIEW_RESET_ZOOM } from '../../../services/maps/hexViewMath.js';

const CAMPAIGN = 'test-campaign';
const MAP = 'test-map';

// Autosave coalescing window (1s) + margin — mirrors settleAutosave in the
// indoor map tests (PlacedItems.delete.test.jsx).
const settleAutosave = async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 1300)); });
};

const characters = [
    { name: 'Thorin' },
    { name: 'Gandalf' },
];

// View bytes the loader's settle-at-mount pass adopts for a stored (zoom, pan)
// (shared hexViewMath, mock-configured to HEX_SIZE 30 / multiplier 2) — the
// SAME computation HexMap's layout pass performs post-mount, so fixtures that
// store these bytes are fully settled and open with zero PUTs.
const settledPan = (gridSize, zoom, panX, panY) =>
    clampHexPan(hexGridPixelBounds(gridSize * 2, gridSize), gridSize, zoom, panX, panY);

// Factory so each render gets fresh objects (the hook stores these by reference).
// SETTLED document: every adoption default present, pan already at the view
// the mount pass would normalize it to, travelState the null the loader adopts
// for a trip-less file — the exact bytes a settling mount write leaves behind.
const PAN_12 = settledPan(12, 3, 40, 60);
const loadedMap = () => ({
    type: 'outdoor',
    displayName: 'Frostpeak Wilderness',
    terrain: { '1,1': 'hills' },
    rivers: [{ hexes: ['2,2'] }],
    roads: [],
    pois: [{ name: 'Watchtower' }],
    gridSize: 12,
    zoom: 3,
    panX: PAN_12.x,
    panY: PAN_12.y,
    marchingOrder: ['Gandalf', 'Thorin'],
    partyPosition: { q: 7, r: 3 },
    weather: 'fog',
    travelState: null,
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
    panX: PAN_12.x,
    panY: PAN_12.y,
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

        // Zero-edit open dirties nothing: the loaded snapshot seeds the
        // persistence baseline, so no write fires until a real mutation
        // (backlog 2026-10-26 write-amplification fix; the determinism of the
        // FIRST real write still rides the `loading`-state guard, #800).
        expect(mapsService.saveMapData).not.toHaveBeenCalled();

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

        await settleAutosave();
        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
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

        await settleAutosave();
        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
        expect(mapsService.saveMapData).toHaveBeenCalledWith(CAMPAIGN, MAP, savedSnapshot({
            travelState: { travelMode: 'active', destination: 'City A' },
        }));
    });

    // Improve 2026-10-26-D (file-lane half): a loaded trip is ADOPTED into the
    // save ref + baseline (normalized via buildTravelInit), so a quiet reload
    // mid-trip writes nothing, and the first unrelated edit CARRIES the trip
    // instead of clobbering travelState back to null.
    describe('live trip loaded from the file', () => {
        const midTripBytes = {
            travelMode: 'traveling',
            travelPace: 'normal',
            destination: { q: 14, r: 10 },
            path: [{ q: 18, r: 10 }, { q: 17, r: 10 }, { q: 16, r: 10 }],
            pathIndex: 2,
            accruedCost: 3,
            dailyBudget: 4,
            dayExhausted: true,
            forcedMarchHours: 1,
        };

        it('stays quiet on the resumed load, then carries the trip on the first real edit', async () => {
            const tripMap = { ...loadedMap(), travelState: midTripBytes };
            mapsService.loadMapData.mockResolvedValue(tripMap);
            const { result } = renderHook(() => useMapLoader(CAMPAIGN, MAP, characters));
            await waitFor(() => expect(result.current.loading).toBe(false));

            // Quiet resume: zero PUTs, ref adopts the normalized trip.
            expect(mapsService.saveMapData).not.toHaveBeenCalled();
            expect(result.current.travelStateRef.current).toEqual(midTripBytes);

            // An unrelated edit (weather roll) re-PUTs the SAME travelState.
            act(() => { result.current.setWeather('rain'); });
            await settleAutosave();
        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
            expect(mapsService.saveMapData).toHaveBeenCalledWith(CAMPAIGN, MAP, savedSnapshot({
                weather: 'rain',
                travelState: midTripBytes,
            }));
        });
    });

    // #800 determinism, inverted by the dirty gate (backlog 2026-10-26): zero
    // edits means zero writes — across repeated mounts a fresh load stays quiet.
    it('saves NOTHING on each of 5 zero-edit repeated mounts of an existing map', async () => {
        for (let i = 0; i < 5; i++) {
            mapsService.saveMapData.mockClear();
            const { unmount } = await renderLoadedHook();

            expect(mapsService.saveMapData.mock.calls, `mount ${i} save count`).toHaveLength(0);
            unmount();
        }
    });

    // A byte-identical envelope re-computation (SSE echo of this tab's own
    // write landing back in state) must not re-PUT.
    it('does not re-save when state churn produces a byte-identical envelope', async () => {
        const { result } = await renderLoadedHook();
        expect(mapsService.saveMapData).not.toHaveBeenCalled();

        act(() => { result.current.setTerrain({ '1,1': 'hills' }); });   // same value, new object
        act(() => { result.current.setPois([{ name: 'Watchtower' }]); }); // same value, new object
        act(() => { result.current.setZoom(3); });                        // same primitive

        await act(async () => {});
        expect(mapsService.saveMapData).not.toHaveBeenCalled();

        // A real deep change still lands exactly once.
        act(() => { result.current.setPois([{ name: 'Watchtower' }, { name: 'Camp' }]); });
        await settleAutosave();
        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
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
        const loadedMapB = () => {
            const pan = settledPan(14, 4, 7, 9);
            return {
                type: 'outdoor',
                displayName: 'The Marshlands',
                terrain: { '9,9': 'bog' },
                rivers: [],
                roads: [],
                pois: [{ name: 'Fen Shrine' }],
                gridSize: 14,
                zoom: 4,
                panX: pan.x,
                panY: pan.y,
                marchingOrder: ['Gandalf', 'Thorin'],
                partyPosition: { q: 5, r: 2 },
                weather: 'clear',
                travelState: null,
            };
        };

        const renderSwitchableHook = async () => {
            let resolveB = () => {};
            mapsService.loadMapData.mockImplementation((_campaign, name) =>
                (name === MAP ? Promise.resolve(loadedMap()) : new Promise(res => { resolveB = res; })));
            const utils = renderHook(
                ({ mapName }) => useMapLoader(CAMPAIGN, mapName, characters),
                { initialProps: { mapName: MAP } },
            );
            await waitFor(() => expect(utils.result.current.loading).toBe(false));
            expect(mapsService.saveMapData).not.toHaveBeenCalled(); // zero-edit mount is quiet
            // Delegate through a function: spread would snapshot the placeholder
            // before the map-b request assigns the real resolver.
            return { ...utils, resolveLoadB: (m) => resolveB(m) };
        };

        it('never writes map A bytes to map B URL, then reloads B and saves its edits under B', async () => {
            const { result, rerender, resolveLoadB } = await renderSwitchableHook();

            rerender({ mapName: 'map-b' });
            // Switch commit + pending-load renders: cross-map prevention holds —
            // no save may address map-b while A's bytes are still held.
            await act(async () => {});
            expect(mapsService.saveMapData).not.toHaveBeenCalled();

            await act(async () => { resolveLoadB(loadedMapB()); });
            await waitFor(() => expect(result.current.loading).toBe(false));

            // B's zero-edit load re-arms the guard but writes nothing; a real
            // edit lands under B exactly once with B's full envelope (#801).
            expect(mapsService.saveMapData).not.toHaveBeenCalled();
            expect(result.current.hexMapNameRef.current).toBe('map-b');
            act(() => { result.current.setTerrain({ '9,9': 'bog', '1,0': 'forest' }); });
            await settleAutosave();
        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
            expect(mapsService.saveMapData).toHaveBeenCalledWith(CAMPAIGN, 'map-b', {
                type: 'outdoor',
                displayName: 'The Marshlands',
                gridSize: 14,
                terrain: { '9,9': 'bog', '1,0': 'forest' },
                rivers: [],
                roads: [],
                pois: [{ name: 'Fen Shrine' }],
                zoom: 4,
                panX: settledPan(14, 4, 7, 9).x,
                panY: settledPan(14, 4, 7, 9).y,
                marchingOrder: ['Gandalf', 'Thorin'],
                partyPosition: { q: 5, r: 2 },
                weather: 'clear',
                travelState: null,
            });
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

    // Mount-write coalescing (backlog 2026-11-12 VX): a zero-edit open of an
    // UNSETTLED document (create-stamped bytes: no marchingOrder/roads/
    // rivers/weather/travelState, legacy zoom/pan) must flush AT MOST ONE
    // whole-document PUT for the whole mount — the baseline holds the stored
    // bytes, the flip-commit envelope the fully-settled ones, and the 1s
    // debounce folds every remaining mount leg into that same flush. The one
    // write carries the adopted defaults AND the view reset together, plus the
    // generation stamp verbatim.
    it('zero-edit open of an unsettled doc emits exactly ONE PUT with adopted defaults + view reset + stamp', async () => {
        mapsService.loadMapData.mockResolvedValue({
            type: 'outdoor',
            displayName: 'Raw Rock',
            terrain: { '1,1': 'hills' },
            pois: [],
            gridSize: 12,
            zoom: 1,          // below MIN_ZOOM → view leg must settle to the reset bytes
            panX: 0,
            panY: 0,          // old default pan → centerHexView reset
            partyPosition: { q: 12, r: 6 },
            seed: 7,
            generationOpts: { mode: 'terrain', gridSize: 12, seed: 7 },
            // NO rivers/roads/marchingOrder/weather/travelState keys at all.
        });
        const utils = renderHook(() => useMapLoader(CAMPAIGN, MAP, characters));
        await waitFor(() => expect(utils.result.current.loading).toBe(false));
        // The write is QUEUED, not immediate — nothing flushes pre-debounce.
        expect(mapsService.saveMapData).not.toHaveBeenCalled();

        await settleAutosave();
        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
        const body = mapsService.saveMapData.mock.calls[0][2];
        const centered = centerHexView(24, 12, VIEW_RESET_ZOOM);
        expect(body).toEqual({
            type: 'outdoor',
            displayName: 'Raw Rock',
            gridSize: 12,
            terrain: { '1,1': 'hills' },
            rivers: [],
            roads: [],
            pois: [],
            zoom: VIEW_RESET_ZOOM,
            panX: centered.x,
            panY: centered.y,
            marchingOrder: ['Thorin', 'Gandalf'],
            partyPosition: { q: 12, r: 6 },
            weather: null,
            travelState: null,
            seed: 7,
            generationOpts: { mode: 'terrain', gridSize: 12, seed: 7 },
        });

        // Post-flush byte-identical churn (echo lane re-emitting the same
        // values) adds no further writes.
        act(() => {
            utils.result.current.setTerrain({ '1,1': 'hills' });
            utils.result.current.setPois([]);
        });
        await settleAutosave();
        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
    });

    // Zero-write contract: a document whose adopted defaults + normalized view
    // are ALREADY on disk (exactly what the settling write above leaves behind)
    // compares byte-equal against the dirty baseline — a zero-edit open fires
    // ZERO PUTs.
    it('fully-settled doc open emits ZERO PUTs', async () => {
        const { result } = await renderLoadedHook();

        await settleAutosave();   // let any (forbidden) debounce flush land
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
        expect(result.current.hexMapNameRef.current).toBe(MAP);
    });

    // Generation-stamp carry (VG backlog 2026-11-12): the board must never strip
    // seed/generationOpts from the doc it re-saves — opening a generated map used
    // to clobber the stamp on the mount flush, silently killing the Maps-manager
    // Regenerate lane for that map (live-proved 2026-11-12).
    describe('generation-stamp carry', () => {
        it('carries seed + generationOpts verbatim into the save envelope', async () => {
            const stamp = { mode: 'terrain', gridSize: 30, seed: 7 };
            mapsService.loadMapData.mockResolvedValue({ ...loadedMap(), seed: 7, generationOpts: stamp });
            const utils = renderHook(() => useMapLoader(CAMPAIGN, MAP, characters));
            await waitFor(() => expect(utils.result.current.loading).toBe(false));
            // Zero-edit open stays clean: the stamp bytes ride the baseline too.
            expect(mapsService.saveMapData).not.toHaveBeenCalled();

            act(() => { utils.result.current.setWeather('rain'); });
            await settleAutosave();

            expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
            const body = mapsService.saveMapData.mock.calls[0][2];
            expect(body.seed).toBe(7);
            expect(body.generationOpts).toEqual(stamp);
            expect(body.weather).toBe('rain');
        });

        it('a legacy doc without a stamp never grows stamp keys', async () => {
            const { result } = await renderLoadedHook();
            act(() => { result.current.setWeather('rain'); });
            await settleAutosave();

            const body = mapsService.saveMapData.mock.calls[0][2];
            expect('seed' in body).toBe(false);
            expect('generationOpts' in body).toBe(false);
        });
    });
});
