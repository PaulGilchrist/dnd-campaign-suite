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

describe('useMapLoader - API surface', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hexKey.mockImplementation((q, r) => `${q},${r}`);
    });

    const characters = [
        { name: 'Thorin' },
        { name: 'Gandalf' },
    ];

    describe('setTravelStateRef', () => {
        it('is a function', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setTravelStateRef).toBe('function');
        });

        it('updates travelSaveVersion when called', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            const initialVersion = result.current.travelSaveVersion;

            act(() => {
                result.current.setTravelStateRef({ travelMode: 'active' });
            });

            expect(result.current.travelSaveVersion).toBe(initialVersion + 1);
        });

        it('updates travelStateRef.current when called', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

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
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setGridSize).toBe('function');
        });

        it('returns setTerrain as a function', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setTerrain).toBe('function');
        });

        it('returns setRivers as a function', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setRivers).toBe('function');
        });

        it('returns setRoads as a function', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setRoads).toBe('function');
        });

        it('returns setPois as a function', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setPois).toBe('function');
        });

        it('returns setMarchingOrder as a function', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setMarchingOrder).toBe('function');
        });

        it('returns setPartyPosition as a function', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setPartyPosition).toBe('function');
        });

        it('returns setWeather as a function', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setWeather).toBe('function');
        });

        it('returns setTravelInit as a function', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setTravelInit).toBe('function');
        });

        it('returns setZoom as a function', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setZoom).toBe('function');
        });

        it('returns setPanX as a function', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setPanX).toBe('function');
        });

        it('returns setPanY as a function', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(typeof result.current.setPanY).toBe('function');
        });

        it('returns setMapData as a function', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

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
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.travelStateRef).toHaveProperty('current');
        });
    });

    describe('returned object shape', () => {
        it('returns all expected keys', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

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
});
