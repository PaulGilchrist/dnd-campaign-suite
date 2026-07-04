// @improved-by-ai @cleaned-by-ai
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
        travelState: {},
    };

    const createMapData = (overrides = {}) => ({ ...baseMapData, ...overrides });

    describe('loads existing map fields', () => {
        it('calls loadMapData with campaign and map name', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData());

            renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await act(async () => {
                await Promise.resolve();
            });

            await new Promise(r => setTimeout(r, 50));

            expect(mapsService.loadMapData).toHaveBeenCalledWith('test-campaign', 'test-map');
        });

        it.each`
            field          | existingValue
            ${'terrain'}   | ${{ '0,0': 'forest' }}
            ${'rivers'}    | $[{ hexes: ['0,0'] }]
            ${'roads'}     | $[{ hexes: ['0,0'] }]
            ${'pois'}      | $[{ name: 'Camp' }]
        `('sets $field from existing map data', async ({ field, existingValue }) => {
            mapsService.loadMapData.mockResolvedValue(createMapData({ [field]: existingValue }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current[field]).toEqual(existingValue);
        });

        it('sets weather, gridSize, zoom, panX, panY from existing data', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                weather: 'stormy',
                gridSize: 20,
                zoom: 5,
                panX: 100,
                panY: 200,
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.weather).toBe('stormy');
            expect(result.current.gridSize).toBe(20);
            expect(result.current.zoom).toBe(5);
            expect(result.current.panX).toBe(100);
            expect(result.current.panY).toBe(200);
        });

        it('clamps zoom to MIN_ZOOM', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({ zoom: 1 }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.zoom).toBe(2);
        });

        it('sets marchingOrder and partyPosition from existing data', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({
                marchingOrder: ['Alaric', 'Serena'],
                partyPosition: { q: 10, r: 5 },
            }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.marchingOrder).toEqual(['Alaric', 'Serena']);
            expect(result.current.partyPosition).toEqual({ q: 10, r: 5 });
        });

        it('sets mapData to existing data', async () => {
            const existingData = { terrain: {}, type: 'outdoor' };
            mapsService.loadMapData.mockResolvedValue(existingData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.mapData).toBe(existingData);
        });

        it('sets loading to false after loading', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData());

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.loading).toBe(false);
        });
    });

    describe('existing map type', () => {
        it('preserves existing type or defaults to outdoor', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({ type: 'outdoor' }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.mapData.type).toBe('outdoor');
        });
    });

    describe('existing map displayName', () => {
        it('sets hexMapDisplayNameRef from existing displayName or mapName', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({ displayName: 'My Custom Map' }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.hexMapDisplayNameRef.current).toBe('My Custom Map');
        });

        it('falls back to mapName when no displayName', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData());

            const { result } = renderHook(() => useMapLoader('test-campaign', 'my-map-name', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.hexMapDisplayNameRef.current).toBe('my-map-name');
        });
    });

    describe('existing map pan view', () => {
        it('sets needsResetViewRef based on pan values', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData({ panX: 50, panY: 75 }));

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.needsResetViewRef.current).toBe(false);
        });

        it('sets needsResetViewRef true when pan is default (0, 0)', async () => {
            mapsService.loadMapData.mockResolvedValue(createMapData());

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.needsResetViewRef.current).toBe(true);
        });
    });

    describe('existing map with missing optional fields', () => {
        it.each`
            field             | missingKey    | expectedValue
            ${'terrain'}      | ${'terrain'}  | ${({})}
            ${'rivers'}       | ${'rivers'}   | ${([])}
            ${'roads'}        | ${'roads'}    | ${([])}
            ${'pois'}         | ${'pois'}     | ${([])}
            ${'gridSize'}     | ${'gridSize'} | ${10}
            ${'zoom'}         | ${'zoom'}     | ${2}
            ${'panX'}         | ${'panX'}     | ${0}
            ${'panY'}         | ${'panY'}     | ${0}
        `('handles missing $field ($missingKey) using fallback value', async ({ missingKey, expectedValue }) => {
            const dataWithoutKey = { ...baseMapData };
            delete dataWithoutKey[missingKey];
            mapsService.loadMapData.mockResolvedValue(dataWithoutKey);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current[missingKey]).toEqual(expectedValue);
        });

        it('rebuilds marchingOrder from characters when missing', async () => {
            const dataWithoutKey = { ...baseMapData };
            delete dataWithoutKey.marchingOrder;
            mapsService.loadMapData.mockResolvedValue(dataWithoutKey);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.marchingOrder).toEqual(['Thorin', 'Gandalf']);
        });

        it('computes partyPosition from grid center when missing', async () => {
            const dataWithoutKey = { ...baseMapData };
            delete dataWithoutKey.partyPosition;
            mapsService.loadMapData.mockResolvedValue(dataWithoutKey);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.partyPosition).toEqual({ q: 10, r: 5 });
        });
    });
});
