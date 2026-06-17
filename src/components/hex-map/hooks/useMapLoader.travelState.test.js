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

describe('useMapLoader - travel state', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hexKey.mockImplementation((q, r) => `${q},${r}`);
    });

    const characters = [
        { name: 'Thorin' },
        { name: 'Gandalf' },
    ];

    describe('travel state handling', () => {
        it('loads travelState from existing map data', async () => {
            mapsService.loadMapData.mockResolvedValue({
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

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.travelInit).not.toBeNull();
            expect(result.current.travelInit.travelMode).toBe('active');
            expect(result.current.travelInit.travelPace).toBe('fast');
            expect(result.current.travelInit.forcedMarchHours).toBe(2);
            expect(result.current.travelInit.accruedCost).toBe(10);
            expect(result.current.travelInit.dailyBudget).toBe(6);
            expect(result.current.travelInit.destination).toBe('City A');
            expect(result.current.travelInit.path).toEqual([{ q: 0, r: 0 }]);
            expect(result.current.travelInit.pathIndex).toBe(0);
        });

        it('does not set travelInit when travelMode is inactive and destination is null', async () => {
            mapsService.loadMapData.mockResolvedValue({
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
                travelState: {
                    travelMode: 'inactive',
                    travelPace: 'normal',
                    destination: null,
                    path: [],
                },
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.travelInit).toBeNull();
        });

        it('sets travelInit when destination exists even if travelMode is inactive', async () => {
            mapsService.loadMapData.mockResolvedValue({
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
                travelState: {
                    travelMode: 'inactive',
                    travelPace: 'normal',
                    destination: 'Distant City',
                    path: [],
                },
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.travelInit).not.toBeNull();
            expect(result.current.travelInit.destination).toBe('Distant City');
        });

        it('uses getDailyHexBudget when dailyBudget is not provided in travelState', async () => {
            mapsService.loadMapData.mockResolvedValue({
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
                travelState: {
                    travelMode: 'active',
                    travelPace: 'slow',
                    destination: 'City',
                },
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(getDailyHexBudget).toHaveBeenCalledWith('slow');
            expect(result.current.travelInit.dailyBudget).toBe(2);
        });

        it('defaults travelMode to inactive when not provided', async () => {
            mapsService.loadMapData.mockResolvedValue({
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
                travelState: {
                    travelPace: 'normal',
                },
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.travelInit).toBeNull();
        });

        it('defaults travelPace to normal when not provided', async () => {
            mapsService.loadMapData.mockResolvedValue({
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
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                },
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.travelInit.travelPace).toBe('normal');
        });

        it('defaults path to empty array when not provided', async () => {
            mapsService.loadMapData.mockResolvedValue({
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
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                },
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.travelInit.path).toEqual([]);
        });

        it('defaults pathIndex to 0 when not provided', async () => {
            mapsService.loadMapData.mockResolvedValue({
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
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                },
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.travelInit.pathIndex).toBe(0);
        });

        it('defaults forcedMarchHours to 0 when not provided', async () => {
            mapsService.loadMapData.mockResolvedValue({
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
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                },
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.travelInit.forcedMarchHours).toBe(0);
        });

        it('defaults accruedCost to 0 when not provided', async () => {
            mapsService.loadMapData.mockResolvedValue({
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
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                },
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.travelInit.accruedCost).toBe(0);
        });
    });

    describe('travelState handling edge cases', () => {
        it('handles missing travelState as empty object', async () => {
            mapsService.loadMapData.mockResolvedValue({
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
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.travelInit).toBeNull();
        });

        it('handles travelState with non-number forcedMarchHours by defaulting to 0', async () => {
            mapsService.loadMapData.mockResolvedValue({
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
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                    forcedMarchHours: 'not a number',
                },
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.travelInit.forcedMarchHours).toBe(0);
        });

        it('handles travelState with non-number accruedCost by defaulting to 0', async () => {
            mapsService.loadMapData.mockResolvedValue({
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
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                    accruedCost: 'not a number',
                },
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.travelInit.accruedCost).toBe(0);
        });

        it('handles travelState with non-number dailyBudget by calling getDailyHexBudget', async () => {
            mapsService.loadMapData.mockResolvedValue({
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
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                    dailyBudget: 'not a number',
                    travelPace: 'fast',
                },
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(getDailyHexBudget).toHaveBeenCalledWith('fast');
            expect(result.current.travelInit.dailyBudget).toBe(6);
        });

        it('handles travelState with non-number pathIndex by defaulting to 0', async () => {
            mapsService.loadMapData.mockResolvedValue({
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
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                    pathIndex: 'not a number',
                },
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.travelInit.pathIndex).toBe(0);
        });

        it('handles travelState with non-array path by defaulting to empty array', async () => {
            mapsService.loadMapData.mockResolvedValue({
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
                travelState: {
                    travelMode: 'active',
                    destination: 'City',
                    path: 'not an array',
                },
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.travelInit.path).toEqual([]);
        });
    });
});
