// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
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
import { hexKey } from '../../../services/maps/hexMapUtils.js';
import { getDailyHexBudget } from '../../../services/campaign/travelService.js';

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

const waitForLoad = async (result) => {
    await new Promise(r => setTimeout(r, 50));
    expect(result.current.loading).toBe(false);
};

describe('useMapLoader - travel state', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hexKey.mockImplementation((q, r) => `${q},${r}`);
    });

    describe('travelInit from existing map data', () => {
        it('loads full travelState from existing map data', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
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
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

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

        it('does not set travelInit when inactive with no destination', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                travelState: {
                    travelMode: 'inactive',
                    destination: null,
                },
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(result.current.travelInit).toBeNull();
        });

        it('sets travelInit when destination exists even if travelMode is inactive', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                travelState: {
                    travelMode: 'inactive',
                    destination: 'Distant City',
                },
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(result.current.travelInit).not.toBeNull();
            expect(result.current.travelInit.travelMode).toBe('inactive');
            expect(result.current.travelInit.destination).toBe('Distant City');
        });

        it('does not set travelInit when travelState is missing entirely', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData());

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(result.current.travelInit).toBeNull();
        });

        it('does not set travelInit when travelState is empty object', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({ travelState: {} }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(result.current.travelInit).toBeNull();
        });
    });

    describe('travelInit field defaults', () => {
        it('defaults travelMode to inactive when not provided', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                travelState: {
                    destination: 'City',
                },
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(result.current.travelInit.travelMode).toBe('inactive');
        });

        it('defaults travelPace to normal when not provided', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                },
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(result.current.travelInit.travelPace).toBe('normal');
        });

        it('defaults path to empty array when not provided', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                },
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(result.current.travelInit.path).toEqual([]);
        });

        it('defaults pathIndex to 0 when not provided', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                },
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(result.current.travelInit.pathIndex).toBe(0);
        });

        it('defaults forcedMarchHours to 0 when not provided', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                },
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(result.current.travelInit.forcedMarchHours).toBe(0);
        });

        it('defaults accruedCost to 0 when not provided', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                },
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(result.current.travelInit.accruedCost).toBe(0);
        });
    });

    describe('dailyBudget resolution', () => {
        it('uses explicit dailyBudget when provided as a number', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                    dailyBudget: 12,
                },
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(getDailyHexBudget).not.toHaveBeenCalled();
            expect(result.current.travelInit.dailyBudget).toBe(12);
        });

        it('calls getDailyHexBudget when dailyBudget is missing', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                travelState: {
                    travelMode: 'active',
                    travelPace: 'slow',
                    destination: 'City',
                },
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(getDailyHexBudget).toHaveBeenCalledWith('slow');
            expect(result.current.travelInit.dailyBudget).toBe(2);
        });

        it('calls getDailyHexBudget with normal when travelPace is missing', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                },
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(getDailyHexBudget).toHaveBeenCalledWith('normal');
            expect(result.current.travelInit.dailyBudget).toBe(4);
        });

        it('calls getDailyHexBudget when dailyBudget is not a number', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                    dailyBudget: 'not a number',
                    travelPace: 'fast',
                },
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(getDailyHexBudget).toHaveBeenCalledWith('fast');
            expect(result.current.travelInit.dailyBudget).toBe(6);
        });
    });

    describe('type coercion for numeric fields', () => {
        it.each`
            field             | badValue        | expected
            ${'forcedMarchHours'} | ${'not a number'} | ${0}
            ${'accruedCost'}      | ${'not a number'} | ${0}
            ${'pathIndex'}        | ${'not a number'} | ${0}
        `('defaults $field from $badValue to $expected', async ({ field, expected }) => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                    [field]: 'not a number',
                },
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(result.current.travelInit[field]).toBe(expected);
        });

        it('preserves valid numeric values', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                    forcedMarchHours: 3,
                    accruedCost: 15,
                    pathIndex: 2,
                },
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(result.current.travelInit.forcedMarchHours).toBe(3);
            expect(result.current.travelInit.accruedCost).toBe(15);
            expect(result.current.travelInit.pathIndex).toBe(2);
        });
    });

    describe('type coercion for array fields', () => {
        it.each`
            field    | badValue       | expected
            ${'path'}  | ${'not an array'} | ${[]}
            ${'path'}  | ${42}             | ${[]}
            ${'path'}  | ${null}           | ${[]}
        `('defaults path from $badValue to $expected', async ({ badValue, expected }) => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                    path: badValue,
                },
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            await waitForLoad(result);

            expect(result.current.travelInit.path).toEqual(expected);
        });
    });
});
