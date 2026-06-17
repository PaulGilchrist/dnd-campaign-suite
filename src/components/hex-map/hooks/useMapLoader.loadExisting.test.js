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

describe('useMapLoader - load existing map data', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hexKey.mockImplementation((q, r) => `${q},${r}`);
    });

    const characters = [
        { name: 'Thorin' },
        { name: 'Gandalf' },
    ];

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

            expect(result.current.partyPosition).toEqual({ q: 10, r: 5 });
        });
    });
});
