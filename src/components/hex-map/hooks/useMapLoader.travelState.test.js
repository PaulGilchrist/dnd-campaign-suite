// @maintained-by-ai
/*
 * useMapLoader — travelInit derivation lane.
 *
 * Owns here: the loaded map's travelState block → travelInit exact shape —
 * verbatim restore, fresh defaults, the inactive/destination gate, junk/null
 * field coercion, and dailyBudget resolution (explicit wins, zero preserved,
 * junk/missing recomputed from pace × persisted-weather budgetMod).
 *
 * Lane map (do NOT duplicate across these files):
 * - mount/load args + loaded-field application  -> useMapLoader.loadExisting.test.js
 * - pre-load defaults and ref seeding           -> useMapLoader.init.test.js
 * - create-new-map bytes (miss / load reject)   -> useMapLoader.createNew.test.js
 * - setTravelInit / setTravelStateRef + persistence -> useMapLoader.api.test.js
 *
 * Fake only the transport seam (#791). Config, hexKey, and travelService run
 * real (#800/#802), so the budget bytes surfaced by this lane are pinned to
 * actual rules once: slow 2, normal 4, fast 5. Passthrough vs recomputation is
 * proven by value (12 ≠ fast-derived 5; 0 ≠ 5), so no call-count assertions
 * on the real service are needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useMapLoader from './useMapLoader.js';

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

const createMapData = (overrides = {}) => ({
    terrain: {},
    rivers: [],
    roads: [],
    pois: [],
    gridSize: 10,
    zoom: 2,
    panX: 0,
    panY: 0,
    marchingOrder: [],
    partyPosition: null,
    weather: null,
    ...overrides,
});

// Renders the hook against a map whose load resolves and waits for the load
// to finish with waitFor (no fixed timers, #783), so the post-load state is
// observed deterministically.
const renderLoadedMap = async (mapDataOverrides) => {
    mapsService.loadMapData.mockResolvedValue(createMapData(mapDataOverrides));
    const { result } = renderHook(() => useMapLoader(CAMPAIGN, MAP, characters));
    await waitFor(() => expect(result.current.loading).toBe(false));
    return result;
};

describe('useMapLoader - travel state', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('restores a full travel block verbatim, keeping an explicit numeric dailyBudget over pace derivation', async () => {
        const result = await renderLoadedMap({
            travelState: {
                travelMode: 'active',
                travelPace: 'fast',
                forcedMarchHours: 2,
                accruedCost: 10,
                dailyBudget: 12,
                destination: 'City A',
                path: [{ q: 0, r: 0 }],
                pathIndex: 3,
                dayExhausted: true,
            },
        });

        // dailyBudget 12 ≠ the fast-derived 5, proving the explicit value wins.
        expect(result.current.travelInit).toEqual({
            travelMode: 'active',
            travelPace: 'fast',
            forcedMarchHours: 2,
            accruedCost: 10,
            dailyBudget: 12,
            destination: 'City A',
            path: [{ q: 0, r: 0 }],
            pathIndex: 3,
            dayExhausted: true,
        });
    });

    it('derives fresh defaults from a destination-only travel block', async () => {
        const result = await renderLoadedMap({
            travelState: { destination: 'City' },
        });

        // Pins normal-pace budget 4 from the real travelService.
        expect(result.current.travelInit).toEqual({
            travelMode: 'inactive',
            travelPace: 'normal',
            forcedMarchHours: 0,
            accruedCost: 0,
            dailyBudget: 4,
            destination: 'City',
            path: [],
            pathIndex: 0,
            dayExhausted: false,
        });
    });

    it.each([
        ['absent', {}],
        ['empty', { travelState: {} }],
        ['inactive without a destination', { travelState: { travelMode: 'inactive', destination: null } }],
    ])('keeps travelInit null when travelState is %s', async (_label, overrides) => {
        const result = await renderLoadedMap(overrides);

        expect(result.current.travelInit).toBeNull();
    });

    it.each([
        ['active without a destination', { travelMode: 'active' }, {
            travelMode: 'active',
            travelPace: 'normal',
            forcedMarchHours: 0,
            accruedCost: 0,
            dailyBudget: 4,
            destination: null,
            path: [],
            pathIndex: 0,
            dayExhausted: false,
        }],
        ['inactive with a destination', { travelMode: 'inactive', destination: 'Distant City' }, {
            travelMode: 'inactive',
            travelPace: 'normal',
            forcedMarchHours: 0,
            accruedCost: 0,
            dailyBudget: 4,
            destination: 'Distant City',
            path: [],
            pathIndex: 0,
            dayExhausted: false,
        }],
    ])('surfaces an exact travelInit when the trip is %s', async (_label, travelState, expected) => {
        const result = await renderLoadedMap({ travelState });

        expect(result.current.travelInit).toEqual(expected);
    });

    it('coerces null and junk travel fields to defaults, recomputing a junk dailyBudget from the preserved pace', async () => {
        const result = await renderLoadedMap({
            travelState: {
                travelMode: 'active',
                travelPace: 'fast',
                forcedMarchHours: null,
                accruedCost: 'not a number',
                dailyBudget: 'not a number',
                destination: '',
                path: 'not an array',
                pathIndex: null,
            },
        });

        // A truthy-but-invalid pace is preserved and drives the recompute
        // (real fast budget is 5); everything invalid falls back to defaults.
        expect(result.current.travelInit).toEqual({
            travelMode: 'active',
            travelPace: 'fast',
            forcedMarchHours: 0,
            accruedCost: 0,
            dailyBudget: 5,
            destination: null,
            path: [],
            pathIndex: 0,
            dayExhausted: false,
        });
    });

    it.each([
        ['keeps an explicit zero dailyBudget instead of recomputing it', { travelPace: 'fast', dailyBudget: 0 }, 0],
        ['derives a missing dailyBudget from the pace', { travelPace: 'slow' }, 2],
    ])('%s', async (_label, travelState, expectedBudget) => {
        const result = await renderLoadedMap({
            travelState: { travelMode: 'active', destination: 'City', ...travelState },
        });

        // Zero survives the typeof guard (fast-derived would be 5).
        expect(result.current.travelInit.dailyBudget).toBe(expectedBudget);
    });

    // Budget-at-mount weather seed (improve 2026-10-26-E): a legacy file
    // trip missing a numeric dailyBudget re-derives from pace AND the
    // persisted weather's budgetMod, so adoption never stamps the un-modded
    // base. An explicit numeric budget still wins untouched.
    it('derives a missing dailyBudget weather-modded from the persisted file weather', async () => {
        const result = await renderLoadedMap({
            weather: { condition: 'storm', label: 'Storm', budgetMod: 0.75 },
            travelState: { travelMode: 'active', destination: 'City', travelPace: 'normal' },
        });

        // floor(4 × 0.75) = 3, not the un-modded 4 (run-E one-frame-off fix).
        expect(result.current.travelInit.dailyBudget).toBe(3);
    });

    it('keeps an explicit dailyBudget even when the file weather mod would change it', async () => {
        const result = await renderLoadedMap({
            weather: { condition: 'storm', label: 'Storm', budgetMod: 0.75 },
            travelState: { travelMode: 'active', destination: 'City', dailyBudget: 12 },
        });

        // The stamped day survives (resume authority), weather never re-derives.
        expect(result.current.travelInit.dailyBudget).toBe(12);
    });
});
