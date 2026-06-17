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

describe('useMapLoader - initial state', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hexKey.mockImplementation((q, r) => `${q},${r}`);
    });

    const characters = [
        { name: 'Thorin' },
        { name: 'Gandalf' },
    ];

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
