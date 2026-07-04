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

const characters = [
    { name: 'Thorin' },
    { name: 'Gandalf' },
];

describe('useMapLoader - API surface', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hexKey.mockImplementation((q, r) => `${q},${r}`);
    });

    describe('setTravelStateRef', () => {
        it('updates travelSaveVersion and travelStateRef when called', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            const initialVersion = result.current.travelSaveVersion;

            act(() => {
                result.current.setTravelStateRef({ travelMode: 'active' });
            });

            expect(result.current.travelSaveVersion).toBe(initialVersion + 1);
            expect(result.current.travelStateRef.current).toEqual({ travelMode: 'active' });
        });
    });

    describe('refs', () => {
        it('returns refs with .current property', async () => {
            mapsService.loadMapData.mockResolvedValue(null);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.needsResetViewRef).toHaveProperty('current');
            expect(result.current.hexMapNameRef).toHaveProperty('current');
            expect(result.current.hexMapDisplayNameRef).toHaveProperty('current');
            expect(result.current.travelStateRef).toHaveProperty('current');
        });
    });

    describe('loading state', () => {
        it('starts as true and transitions to false after data loads', async () => {
            mapsService.loadMapData.mockResolvedValue(baseMapData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            expect(result.current.loading).toBe(true);

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.loading).toBe(false);
        });
    });

    describe('mapData', () => {
        it('is populated from loadMapData result', async () => {
            const loadedData = {
                ...baseMapData,
                terrain: { '0,0': 'mountain' },
                displayName: 'Test Map',
            };
            mapsService.loadMapData.mockResolvedValue(loadedData);

            const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));

            await new Promise(r => setTimeout(r, 50));

            expect(result.current.mapData).toEqual(loadedData);
        });
    });
});
