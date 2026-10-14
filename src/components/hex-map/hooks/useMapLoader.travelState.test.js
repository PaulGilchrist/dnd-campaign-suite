import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useMapLoader from './useMapLoader.js';

vi.mock('../../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
    saveMapData: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/maps/hexMapUtils.js', () => ({
    hexKey: vi.fn((q, r) => `${q},${r}`),
}));

vi.mock('../../../services/campaign/travelService.js', () => ({
    getDailyHexBudget: vi.fn((paceId) => {
        const budgets = { slow: 2, normal: 4, fast: 6 };
        return budgets[paceId] ?? 4;
    }),
}));

vi.mock('../../../config/outdoorConfig.js', () => ({
    DEFAULT_GRID_SIZE: 10,
    GRID_COLS_MULTIPLIER: 2,
    MIN_ZOOM: 2,
    DEFAULT_TERRAIN: 'plains',
}));

import * as mapsService from '../../../services/maps/mapsService.js';
import { getDailyHexBudget } from '../../../services/campaign/travelService.js';

const CAMPAIGN = 'test-campaign';
const MAP = 'test-map';

const characters = [
    { name: 'Thorin' },
    { name: 'Gandalf' },
];

const baseMapData = {
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
};

const createMapData = (overrides = {}) => ({ ...baseMapData, ...overrides });

// Renders the hook against a map whose load resolves and waits for the load to
// finish with waitFor (no fixed timers), so the post-load state is observed
// deterministically.
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

    describe('travelInit from existing map data', () => {
        it('loads a full active travel state into travelInit', async () => {
            const result = await renderLoadedMap({
                travelState: {
                    travelMode: 'active',
                    travelPace: 'fast',
                    forcedMarchHours: 2,
                    accruedCost: 10,
                    dailyBudget: 6,
                    destination: 'City A',
                    path: [{ q: 0, r: 0 }],
                    pathIndex: 0,
                },
            });

            expect(result.current.travelInit).toEqual({
                travelMode: 'active',
                travelPace: 'fast',
                forcedMarchHours: 2,
                accruedCost: 10,
                dailyBudget: 6,
                destination: 'City A',
                path: [{ q: 0, r: 0 }],
                pathIndex: 0,
            });
        });

        it('keeps travelInit null for an inactive trip without a destination', async () => {
            const result = await renderLoadedMap({
                travelState: { travelMode: 'inactive', destination: null },
            });

            expect(result.current.travelInit).toBeNull();
        });

        it('sets travelInit from a destination even when travelMode is inactive', async () => {
            const result = await renderLoadedMap({
                travelState: { travelMode: 'inactive', destination: 'Distant City' },
            });

            expect(result.current.travelInit).toMatchObject({
                travelMode: 'inactive',
                destination: 'Distant City',
            });
        });

        it.each([
            ['missing', {}],
            ['empty', { travelState: {} }],
        ])('keeps travelInit null when travelState is $label', async (_label, overrides) => {
            const result = await renderLoadedMap(overrides);

            expect(result.current.travelInit).toBeNull();
        });

        it('sets travelInit for an active trip even when no destination is set', async () => {
            const result = await renderLoadedMap({
                travelState: { travelMode: 'active' },
            });

            expect(result.current.travelInit).toMatchObject({
                travelMode: 'active',
                destination: null,
            });
        });

        it('applies defaults for every missing travel field', async () => {
            const result = await renderLoadedMap({
                travelState: { destination: 'City' },
            });

            expect(result.current.travelInit).toEqual({
                travelMode: 'inactive',
                travelPace: 'normal',
                forcedMarchHours: 0,
                accruedCost: 0,
                dailyBudget: 4,
                destination: 'City',
                path: [],
                pathIndex: 0,
            });
        });

        it('falls back to defaults for empty-string and null travel fields', async () => {
            const result = await renderLoadedMap({
                travelState: {
                    travelMode: 'active',
                    travelPace: '',
                    forcedMarchHours: null,
                    accruedCost: null,
                    dailyBudget: null,
                    destination: '',
                    path: null,
                    pathIndex: null,
                },
            });

            expect(result.current.travelInit).toEqual({
                travelMode: 'active',
                travelPace: 'normal',
                forcedMarchHours: 0,
                accruedCost: 0,
                dailyBudget: 4,
                destination: null,
                path: [],
                pathIndex: 0,
            });
        });
    });

    describe('dailyBudget resolution', () => {
        it('uses an explicit numeric dailyBudget without consulting getDailyHexBudget', async () => {
            const result = await renderLoadedMap({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                    dailyBudget: 12,
                },
            });

            expect(getDailyHexBudget).not.toHaveBeenCalled();
            expect(result.current.travelInit.dailyBudget).toBe(12);
        });

        it('computes dailyBudget from travelPace when it is missing', async () => {
            const result = await renderLoadedMap({
                travelState: {
                    travelMode: 'active',
                    travelPace: 'slow',
                    destination: 'City',
                },
            });

            expect(getDailyHexBudget).toHaveBeenCalledWith('slow');
            expect(result.current.travelInit.dailyBudget).toBe(2);
        });

        it('calls getDailyHexBudget with normal when travelPace is missing', async () => {
            const result = await renderLoadedMap({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                },
            });

            expect(getDailyHexBudget).toHaveBeenCalledWith('normal');
            expect(result.current.travelInit.dailyBudget).toBe(4);
        });

        it('recomputes dailyBudget when it is not a number', async () => {
            const result = await renderLoadedMap({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                    dailyBudget: 'not a number',
                    travelPace: 'fast',
                },
            });

            expect(getDailyHexBudget).toHaveBeenCalledWith('fast');
            expect(result.current.travelInit.dailyBudget).toBe(6);
        });

        it('keeps a zero dailyBudget instead of recomputing it', async () => {
            const result = await renderLoadedMap({
                travelState: {
                    travelMode: 'active',
                    travelPace: 'fast',
                    destination: 'City',
                    dailyBudget: 0,
                },
            });

            expect(getDailyHexBudget).not.toHaveBeenCalled();
            expect(result.current.travelInit.dailyBudget).toBe(0);
        });
    });

    describe('type coercion', () => {
        it('coerces non-numeric forcedMarchHours, accruedCost, and pathIndex to 0', async () => {
            const result = await renderLoadedMap({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                    forcedMarchHours: 'not a number',
                    accruedCost: 'not a number',
                    pathIndex: 'not a number',
                },
            });

            expect(result.current.travelInit.forcedMarchHours).toBe(0);
            expect(result.current.travelInit.accruedCost).toBe(0);
            expect(result.current.travelInit.pathIndex).toBe(0);
        });

        it('preserves valid numeric values', async () => {
            const result = await renderLoadedMap({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                    forcedMarchHours: 3,
                    accruedCost: 15,
                    pathIndex: 2,
                },
            });

            expect(result.current.travelInit.forcedMarchHours).toBe(3);
            expect(result.current.travelInit.accruedCost).toBe(15);
            expect(result.current.travelInit.pathIndex).toBe(2);
        });

        it('coerces a non-array path to an empty array', async () => {
            const result = await renderLoadedMap({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                    path: 'not an array',
                },
            });

            expect(result.current.travelInit.path).toEqual([]);
        });
    });
});
