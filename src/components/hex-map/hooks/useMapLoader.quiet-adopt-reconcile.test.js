// @maintained-by-ai
/*
 * useMapLoader — quiet-adopt stale-bytes window (backlog 2026-10-27-M).
 *
 * After a mid-plan reload loses the ~1s debounced map-file write-back, the
 * reopened editor adopts the STORE trip while the map FILE still describes
 * the PREVIOUS trip. 53066f5c9 reconciles via the publisher's settle publish,
 * but applyExistingMap used to seed the save ref + dirty baseline with the
 * FILE's stale bytes on adopt — so any document flush inside the ~1–2 s
 * reconcile window (loading-flip pass, view normalize, weather) re-published
 * the previous trip, and a file-adoption boot inside that window could still
 * resurrect the wrong trip.
 *
 * Pinned contract (reconcile-at-adopt):
 * - store declares a live trip DIVERGED from the file trip ⇒ the save ref
 *   already holds the STORE bytes the moment the document lands; the ONE
 *   autosave PUT that follows carries the reconciled bytes, and NO save call
 *   ever carries the stale file bytes;
 * - store trip == file trip (quiet resume) ⇒ ref/baseline deep-equal ⇒ zero
 *   saves (a2da687d7 zero-PUT contract intact);
 * - store silent (travel-mode absent) or CONFIRMED inactive with a live file
 *   trip ⇒ pure file adoption, ref takes the file bytes, zero saves;
 * - no file trip ⇒ nothing to reconcile: zero saves, ref untouched.
 *
 * Lane map: the hook-side premature-publish hold/settle reconciliation is
 * owned by useTravelManagement.quiet-adopt-reconcile.test.js; this file owns
 * the loader's adopt-time ref/baseline seeding and its PUT bytes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useMapLoader from './useMapLoader.js';

vi.mock('../../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
    saveMapData: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/campaign/travelService.js', () => ({
    getDailyHexBudget: vi.fn(() => 4),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => {
    const campaignStore = new Map();
    return {
        getRuntimeValue: vi.fn((characterKey, propertyName) =>
            characterKey === 'campaign' ? campaignStore.get(propertyName) ?? null : null),
        setRuntimeValue: vi.fn(),
        setRuntimeObject: vi.fn(),
        hasRuntimeValue: vi.fn((characterKey, propertyName) =>
            characterKey === 'campaign' && campaignStore.has(propertyName)),
        listeners: new Map(),
        __campaignStore: campaignStore,
    };
});

import * as mapsService from '../../../services/maps/mapsService.js';
import * as runtimeModule from '../../../hooks/runtime/useRuntimeState.js';

const campaignStore = runtimeModule.__campaignStore;

const CAMPAIGN = 'test-campaign';
const MAP = 'test-map';

// Autosave coalescing window (1s) + margin — mirrors useMapLoader.api.test.js.
const settleAutosave = async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 1300)); });
};

const characters = [{ name: 'Thorin' }];

const createMapData = (travelState) => ({
    type: 'outdoor',
    displayName: 'Frostpeak Wilderness',
    terrain: {},
    rivers: [],
    roads: [],
    pois: [],
    gridSize: 10,
    zoom: 3,
    panX: 40,
    panY: 60,
    marchingOrder: [],
    partyPosition: { q: 7, r: 3 },
    weather: null,
    travelState,
});

// The STALE trip still on disk (trip A — the plan whose debounced PUT was
// lost to the reload): traveling, destination (17,9), 5-hex path, pi 3.
const FILE_TRIP = {
    travelMode: 'traveling',
    travelPace: 'normal',
    destination: { q: 17, r: 9 },
    path: [{ q: 20, r: 10 }, { q: 19, r: 10 }, { q: 18, r: 10 }, { q: 17, r: 10 }, { q: 17, r: 9 }],
    pathIndex: 3,
    accruedCost: 2.25,
    dailyBudget: 4,
    dayExhausted: false,
    forcedMarchHours: 0,
};

// The LIVE store trip (change-data survives the reload): re-plan B —
// planning, destination (18,9), 4-hex path, pi 0.
const STORE_TRIP = {
    'travel-mode': 'planning',
    'travel-pace': 'normal',
    'travel-destination': { q: 18, r: 9 },
    'travel-path': [{ q: 20, r: 10 }, { q: 19, r: 10 }, { q: 18, r: 10 }, { q: 18, r: 9 }],
    'travel-pathIndex': 0,
    'travel-accruedCost': 2.25,
    'travel-dailyBudget': 4,
    'travel-dayExhausted': false,
    'travel-forcedMarchHours': 0,
};

// Normalized store trip in the publish-snapshot shape the ref/baseline hold.
const storeTripBytes = (overrides = {}) => ({
    travelMode: STORE_TRIP['travel-mode'],
    travelPace: STORE_TRIP['travel-pace'],
    destination: STORE_TRIP['travel-destination'],
    path: STORE_TRIP['travel-path'],
    pathIndex: STORE_TRIP['travel-pathIndex'],
    accruedCost: STORE_TRIP['travel-accruedCost'],
    dailyBudget: STORE_TRIP['travel-dailyBudget'],
    dayExhausted: STORE_TRIP['travel-dayExhausted'],
    forcedMarchHours: STORE_TRIP['travel-forcedMarchHours'],
    ...overrides,
});

const seedStore = (trip) => {
    Object.entries(trip).forEach(([k, v]) => campaignStore.set(k, v));
};

const renderLoadedMap = async (travelState) => {
    mapsService.loadMapData.mockResolvedValue(createMapData(travelState));
    const { result } = renderHook(() => useMapLoader(CAMPAIGN, MAP, characters));
    await waitFor(() => expect(result.current.loading).toBe(false));
    return result;
};

describe('useMapLoader — quiet-adopt reconcile-at-adopt (store trip vs stale file trip)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        campaignStore.clear();
    });

    it('seeds the save ref with the STORE trip when the loaded file trip diverges, and the only PUT carries the reconciled bytes', async () => {
        seedStore(STORE_TRIP);
        const result = await renderLoadedMap(FILE_TRIP);

        // Reconcile-at-adopt: the moment the document lands, the ref already
        // holds the store bytes — never the stale file bytes.
        expect(result.current.travelStateRef.current).toEqual(storeTripBytes());

        // The dirty-gate (baseline = disk bytes) flushes exactly ONE PUT,
        // already carrying the reconciled trip — no pre-reconcile window.
        await settleAutosave();
        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
        expect(mapsService.saveMapData).toHaveBeenCalledWith(
            CAMPAIGN, MAP, expect.objectContaining({ travelState: storeTripBytes() }));

        // Belt-and-braces: no save call ever carried the stale trip-A bytes.
        for (const call of mapsService.saveMapData.mock.calls) {
            expect(call[2].travelState).not.toEqual(FILE_TRIP);
        }
    });

    it('stays byte-silent when the file trip equals the store trip (quiet resume)', async () => {
        seedStore({
            'travel-mode': 'traveling',
            'travel-pace': 'normal',
            'travel-destination': FILE_TRIP.destination,
            'travel-path': FILE_TRIP.path,
            'travel-pathIndex': FILE_TRIP.pathIndex,
            'travel-accruedCost': FILE_TRIP.accruedCost,
            'travel-dailyBudget': FILE_TRIP.dailyBudget,
            'travel-dayExhausted': FILE_TRIP.dayExhausted,
            'travel-forcedMarchHours': FILE_TRIP.forcedMarchHours,
        });
        const result = await renderLoadedMap(FILE_TRIP);

        expect(result.current.travelStateRef.current).toEqual(FILE_TRIP);
        await settleAutosave();
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
    });

    it('adopts the file trip untouched when the store speaks no live trip (adoption lane)', async () => {
        // travel-mode key absent entirely — file is the resume source.
        const result = await renderLoadedMap(FILE_TRIP);

        expect(result.current.travelStateRef.current).toEqual(FILE_TRIP);
        expect(result.current.resumedTripRef.current).toBe(true);
        await settleAutosave();
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
    });

    it('adopts the file trip untouched over a CONFIRMED inactive store byte', async () => {
        seedStore({ 'travel-mode': 'inactive' });
        const result = await renderLoadedMap(FILE_TRIP);

        expect(result.current.travelStateRef.current).toEqual(FILE_TRIP);
        await settleAutosave();
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
    });

    it('writes nothing when the file carries no trip even with a live store trip', async () => {
        seedStore(STORE_TRIP);
        const result = await renderLoadedMap(null);

        // Nothing to reconcile: the trip-less baseline/ref pair stays quiet
        // (the trip reaches the file through the publisher's normal lane).
        expect(result.current.travelInit).toBeNull();
        await settleAutosave();
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
    });
});
