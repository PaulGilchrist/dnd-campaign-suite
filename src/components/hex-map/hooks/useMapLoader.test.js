import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
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

describe('useMapLoader', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hexKey.mockImplementation((q, r) => `${q},${r}`);
    });

    const characters = [
        { name: 'Thorin' },
        { name: 'Gandalf' },
    ];

    describe('initial state', () => {
        it('returns loading as true initially', () => {
            mapsService.loadMapData.mockResolvedValue(null);
            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            expect(result.current.loading).toBe(true);
        });

        it('returns mapData as null initially', () => {
            mapsService.loadMapData.mockResolvedValue(null);
            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            expect(result.current.mapData).toBeNull();
        });

        it('returns gridSize as 10 initially', () => {
            mapsService.loadMapData.mockResolvedValue(null);
            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            expect(result.current.gridSize).toBe(10);
        });

        it('returns terrain as empty object initially', () => {
            mapsService.loadMapData.mockResolvedValue(null);
            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            expect(result.current.terrain).toEqual({});
        });

        it('returns rivers as empty array initially', () => {
            mapsService.loadMapData.mockResolvedValue(null);
            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            expect(result.current.rivers).toEqual([]);
        });

        it('returns roads as empty array initially', () => {
            mapsService.loadMapData.mockResolvedValue(null);
            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            expect(result.current.roads).toEqual([]);
        });

        it('returns pois as empty array initially', () => {
            mapsService.loadMapData.mockResolvedValue(null);
            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            expect(result.current.pois).toEqual([]);
        });

        it('returns marchingOrder as empty array initially', () => {
            mapsService.loadMapData.mockResolvedValue(null);
            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            expect(result.current.marchingOrder).toEqual([]);
        });

        it('returns partyPosition as null initially', () => {
            mapsService.loadMapData.mockResolvedValue(null);
            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            expect(result.current.partyPosition).toBeNull();
        });

        it('returns weather as null initially', () => {
            mapsService.loadMapData.mockResolvedValue(null);
            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            expect(result.current.weather).toBeNull();
        });

        it('returns travelInit as null initially', () => {
            mapsService.loadMapData.mockResolvedValue(null);
            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            expect(result.current.travelInit).toBeNull();
        });

        it('returns zoom as 2 initially', () => {
            mapsService.loadMapData.mockResolvedValue(null);
            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            expect(result.current.zoom).toBe(2);
        });

        it('returns panX as 0 initially', () => {
            mapsService.loadMapData.mockResolvedValue(null);
            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            expect(result.current.panX).toBe(0);
        });

        it('returns panY as 0 initially', () => {
            mapsService.loadMapData.mockResolvedValue(null);
            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
            expect(result.current.panY).toBe(0);
        });
    });

    describe('load existing map data', () => {
        it('loads existing terrain from map data', async () => {
            const existingTerrain = { '0,0': 'forest', '1,0': 'hills' };
            mapsService.loadMapData.mockResolvedValue({
                terrain: existingTerrain,
                rivers: [],
                roads: [],
                pois: [],
                gridSize: 15,
                zoom: 4,
                panX: 100,
                panY: 50,
                marchingOrder: [],
                partyPosition: null,
                weather: 'sunny',
                travelState: { travelMode: 'inactive', travelPace: 'normal' },
            });

            renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await act(async () => {
                await Promise.resolve();
            });

            // Need to wait for the async loadMap to complete
            await new Promise(r => setTimeout(r, 50));

            expect(mapsService.loadMapData).toHaveBeenCalledWith('test-campaign', 'test-map');
        });

        it('sets terrain from existing map data', async () => {
            const existingTerrain = { '0,0': 'forest' };
            mapsService.loadMapData.mockResolvedValue({
                terrain: existingTerrain,
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.terrain).toEqual(existingTerrain);
        });

        it('sets rivers from existing map data', async () => {
            const existingRivers = [{ hexes: ['0,0', '1,0'] }];
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                rivers: existingRivers,
                roads: [],
                pois: [],
                gridSize: 10,
                zoom: 2,
                panX: 0,
                panY: 0,
                marchingOrder: [],
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.rivers).toEqual(existingRivers);
        });

        it('sets roads from existing map data', async () => {
            const existingRoads = [{ hexes: ['0,0', '1,0'] }];
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                rivers: [],
                roads: existingRoads,
                pois: [],
                gridSize: 10,
                zoom: 2,
                panX: 0,
                panY: 0,
                marchingOrder: [],
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.roads).toEqual(existingRoads);
        });

        it('sets pois from existing map data', async () => {
            const existingPois = [{ name: 'Camp', q: 5, r: 5 }];
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                rivers: [],
                roads: [],
                pois: existingPois,
                gridSize: 10,
                zoom: 2,
                panX: 0,
                panY: 0,
                marchingOrder: [],
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.pois).toEqual(existingPois);
        });

        it('sets weather from existing map data', async () => {
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
                weather: 'stormy',
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.weather).toBe('stormy');
        });

        it('uses existing gridSize from map data', async () => {
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                rivers: [],
                roads: [],
                pois: [],
                gridSize: 20,
                zoom: 2,
                panX: 0,
                panY: 0,
                marchingOrder: [],
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.gridSize).toBe(20);
        });

        it('sets zoom from existing map data, clamped to MIN_ZOOM', async () => {
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                rivers: [],
                roads: [],
                pois: [],
                gridSize: 10,
                zoom: 1,
                panX: 0,
                panY: 0,
                marchingOrder: [],
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.zoom).toBe(2);
        });

        it('sets zoom from existing map data when above MIN_ZOOM', async () => {
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                rivers: [],
                roads: [],
                pois: [],
                gridSize: 10,
                zoom: 5,
                panX: 0,
                panY: 0,
                marchingOrder: [],
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.zoom).toBe(5);
        });

        it('sets panX and panY from existing map data when not default', async () => {
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                rivers: [],
                roads: [],
                pois: [],
                gridSize: 10,
                zoom: 2,
                panX: 100,
                panY: 200,
                marchingOrder: [],
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.panX).toBe(100);
            expect(result.current.panY).toBe(200);
        });

        it('resets panX and panY to 0 when they are the old default (0, 0)', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.panX).toBe(0);
            expect(result.current.panY).toBe(0);
        });

        it('sets marchingOrder from existing map data', async () => {
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                rivers: [],
                roads: [],
                pois: [],
                gridSize: 10,
                zoom: 2,
                panX: 0,
                panY: 0,
                marchingOrder: ['Alaric', 'Serena'],
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.marchingOrder).toEqual(['Alaric', 'Serena']);
        });

        it('sets partyPosition from existing map data', async () => {
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
                partyPosition: { q: 10, r: 5 },
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.partyPosition).toEqual({ q: 10, r: 5 });
        });

        it('sets mapData to existing data', async () => {
            const existingData = { terrain: {}, type: 'outdoor' };
            mapsService.loadMapData.mockResolvedValue(existingData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.mapData).toBe(existingData);
        });

        it('sets loading to false after loading existing map', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.loading).toBe(false);
        });
    });

    describe('creating new map when no existing data', () => {
        it('creates initial terrain grid when no existing map', async () => {
            mapsService.loadMapData.mockResolvedValue(null);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.loading).toBe(false);
            expect(result.current.mapData).not.toBeNull();
            expect(result.current.mapData.type).toBe('outdoor');
            expect(result.current.mapData.gridSize).toBe(10);
            expect(result.current.mapData.zoom).toBe(2);
        });

        it('creates initial marchingOrder from characters', async () => {
            mapsService.loadMapData.mockResolvedValue(null);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.marchingOrder).toEqual(['Thorin', 'Gandalf']);
        });

        it('creates initial marchingOrder from characters when no characters', async () => {
            mapsService.loadMapData.mockResolvedValue(null);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', []));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.marchingOrder).toEqual([]);
        });

        it('creates initial partyPosition centered when characters exist', async () => {
            mapsService.loadMapData.mockResolvedValue(null);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            // gridSize=10, GRID_COLS_MULTIPLIER=2, so newCols=20, newRows=10
            expect(result.current.partyPosition).toEqual({ q: 10, r: 5 });
        });

        it('creates initial partyPosition as null when no characters', async () => {
            mapsService.loadMapData.mockResolvedValue(null);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', []));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.partyPosition).toBeNull();
        });

        it('saves initial map data', async () => {
            mapsService.loadMapData.mockResolvedValue(null);

            renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(mapsService.saveMapData).toHaveBeenCalledWith('test-campaign', 'test-map', expect.objectContaining({
                type: 'outdoor',
                gridSize: 10,
            }));
        });
    });

    describe('error handling when loading existing map', () => {
        it('falls through to new map creation on load error', async () => {
            mapsService.loadMapData.mockRejectedValue(new Error('Network error'));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.loading).toBe(false);
            expect(result.current.mapData).not.toBeNull();
            expect(result.current.mapData.type).toBe('outdoor');
        });

        it('creates correct initial terrain grid size on fallback', async () => {
            mapsService.loadMapData.mockRejectedValue(new Error('Network error'));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            // gridSize=10, GRID_COLS_MULTIPLIER=2, so 20 cols x 10 rows
            const expectedKeyCount = 20 * 10;
            expect(Object.keys(result.current.terrain).length).toBe(expectedKeyCount);
        });
    });

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

    describe('setTravelStateRef', () => {
        it('is a function', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setTravelStateRef).toBe('function');
        });

        it('updates travelSaveVersion when called', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            const initialVersion = result.current.travelSaveVersion;

            act(() => {
                result.current.setTravelStateRef({ travelMode: 'active' });
            });

            expect(result.current.travelSaveVersion).toBe(initialVersion + 1);
        });

        it('updates travelStateRef.current when called', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            act(() => {
                result.current.setTravelStateRef({ travelMode: 'active', travelPace: 'fast' });
            });

            expect(result.current.travelStateRef.current).toEqual({ travelMode: 'active', travelPace: 'fast' });
        });
    });

    describe('setters', () => {
        it('returns setGridSize as a function', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setGridSize).toBe('function');
        });

        it('returns setTerrain as a function', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setTerrain).toBe('function');
        });

        it('returns setRivers as a function', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setRivers).toBe('function');
        });

        it('returns setRoads as a function', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setRoads).toBe('function');
        });

        it('returns setPois as a function', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setPois).toBe('function');
        });

        it('returns setMarchingOrder as a function', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setMarchingOrder).toBe('function');
        });

        it('returns setPartyPosition as a function', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setPartyPosition).toBe('function');
        });

        it('returns setWeather as a function', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setWeather).toBe('function');
        });

        it('returns setTravelInit as a function', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setTravelInit).toBe('function');
        });

        it('returns setZoom as a function', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setZoom).toBe('function');
        });

        it('returns setPanX as a function', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setPanX).toBe('function');
        });

        it('returns setPanY as a function', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setPanY).toBe('function');
        });

        it('returns setMapData as a function', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setMapData).toBe('function');
        });
    });

    describe('refs', () => {
        it('returns needsResetViewRef as a ref', async () => {
            mapsService.loadMapData.mockResolvedValue(null);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.needsResetViewRef).toHaveProperty('current');
        });

        it('returns hexMapNameRef as a ref', async () => {
            mapsService.loadMapData.mockResolvedValue(null);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.hexMapNameRef).toHaveProperty('current');
        });

        it('returns hexMapDisplayNameRef as a ref', async () => {
            mapsService.loadMapData.mockResolvedValue(null);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.hexMapDisplayNameRef).toHaveProperty('current');
        });

        it('returns travelStateRef as a ref', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.travelStateRef).toHaveProperty('current');
        });
    });

    describe('returned object shape', () => {
        it('returns all expected keys', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            const keys = Object.keys(result.current);
            const expectedKeys = [
                'loading', 'mapData', 'setMapData',
                'gridSize', 'setGridSize',
                'terrain', 'setTerrain',
                'rivers', 'setRivers',
                'roads', 'setRoads',
                'pois', 'setPois',
                'marchingOrder', 'setMarchingOrder',
                'partyPosition', 'setPartyPosition',
                'weather', 'setWeather',
                'travelInit', 'setTravelInit',
                'travelSaveVersion',
                'travelStateRef', 'setTravelStateRef',
                'zoom', 'setZoom',
                'panX', 'setPanX',
                'panY', 'setPanY',
                'needsResetViewRef',
                'hexMapNameRef',
                'hexMapDisplayNameRef',
            ];

            for (const key of expectedKeys) {
                expect(keys).toContain(key);
            }
        });
    });

    describe('existing map with type field', () => {
        it('preserves existing type field', async () => {
            mapsService.loadMapData.mockResolvedValue({
                type: 'outdoor',
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.mapData.type).toBe('outdoor');
        });

        it('sets type to outdoor when not present in existing data', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.mapData.type).toBe('outdoor');
        });
    });

    describe('existing map displayName', () => {
        it('sets hexMapDisplayNameRef from existing displayName', async () => {
            mapsService.loadMapData.mockResolvedValue({
                displayName: 'My Custom Map',
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.hexMapDisplayNameRef.current).toBe('My Custom Map');
        });

        it('sets hexMapDisplayNameRef to mapName when no displayName', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'my-map-name', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.hexMapDisplayNameRef.current).toBe('my-map-name');
        });
    });

    describe('existing map with non-default pan values', () => {
        it('does not set needsResetViewRef when pan is non-default', async () => {
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                rivers: [],
                roads: [],
                pois: [],
                gridSize: 10,
                zoom: 2,
                panX: 50,
                panY: 75,
                marchingOrder: [],
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.needsResetViewRef.current).toBe(false);
        });

        it('sets needsResetViewRef when pan is default (0, 0)', async () => {
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.needsResetViewRef.current).toBe(true);
        });
    });

    describe('existing map with missing optional fields', () => {
        it('handles missing terrain as empty object', async () => {
            mapsService.loadMapData.mockResolvedValue({
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
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.terrain).toEqual({});
        });

        it('handles missing rivers as empty array', async () => {
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                roads: [],
                pois: [],
                gridSize: 10,
                zoom: 2,
                panX: 0,
                panY: 0,
                marchingOrder: [],
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.rivers).toEqual([]);
        });

        it('handles missing roads as empty array', async () => {
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                rivers: [],
                pois: [],
                gridSize: 10,
                zoom: 2,
                panX: 0,
                panY: 0,
                marchingOrder: [],
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.roads).toEqual([]);
        });

        it('handles missing pois as empty array', async () => {
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                rivers: [],
                roads: [],
                gridSize: 10,
                zoom: 2,
                panX: 0,
                panY: 0,
                marchingOrder: [],
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.pois).toEqual([]);
        });

        it('handles missing gridSize using DEFAULT_GRID_SIZE', async () => {
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                rivers: [],
                roads: [],
                pois: [],
                zoom: 2,
                panX: 0,
                panY: 0,
                marchingOrder: [],
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.gridSize).toBe(10);
        });

        it('handles missing zoom using MIN_ZOOM', async () => {
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                rivers: [],
                roads: [],
                pois: [],
                gridSize: 10,
                panX: 0,
                panY: 0,
                marchingOrder: [],
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.zoom).toBe(2);
        });

        it('handles missing panX using 0', async () => {
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                rivers: [],
                roads: [],
                pois: [],
                gridSize: 10,
                zoom: 2,
                panY: 0,
                marchingOrder: [],
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.panX).toBe(0);
        });

        it('handles missing panY using 0', async () => {
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                rivers: [],
                roads: [],
                pois: [],
                gridSize: 10,
                zoom: 2,
                panX: 0,
                marchingOrder: [],
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.panY).toBe(0);
        });

        it('handles missing marchingOrder from characters', async () => {
            mapsService.loadMapData.mockResolvedValue({
                terrain: {},
                rivers: [],
                roads: [],
                pois: [],
                gridSize: 10,
                zoom: 2,
                panX: 0,
                panY: 0,
                partyPosition: null,
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.marchingOrder).toEqual(['Thorin', 'Gandalf']);
        });

        it('handles missing partyPosition by computing center', async () => {
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
                weather: null,
                travelState: {},
            });

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            // gridSize=10, GRID_COLS_MULTIPLIER=2, newCols=20, newRows=10
            expect(result.current.partyPosition).toEqual({ q: 10, r: 5 });
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

    describe('initial terrain grid generation', () => {
        it('generates terrain grid with correct key format', async () => {
            mapsService.loadMapData.mockResolvedValue(null);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            const keys = Object.keys(result.current.terrain);
            expect(keys.length).toBe(200); // 20 cols * 10 rows
            expect(keys[0]).toBe('0,0');
            expect(keys[keys.length - 1]).toBe('19,9');
        });

        it('sets all terrain hexes to DEFAULT_TERRAIN', async () => {
            mapsService.loadMapData.mockResolvedValue(null);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            const values = Object.values(result.current.terrain);
            expect(values.every(v => v === 'plains')).toBe(true);
        });
    });
});
