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

describe('useMapLoader - creating new map', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hexKey.mockImplementation((q, r) => `${q},${r}`);
    });

    const characters = [
        { name: 'Thorin' },
        { name: 'Gandalf' },
    ];

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

            const expectedKeyCount = 20 * 10;
            expect(Object.keys(result.current.terrain).length).toBe(expectedKeyCount);
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
