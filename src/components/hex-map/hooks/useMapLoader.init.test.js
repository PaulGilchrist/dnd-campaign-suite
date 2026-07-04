// @improved-by-ai @cleaned-by-ai
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
        mapsService.loadMapData.mockResolvedValue(null);
        hexKey.mockImplementation((q, r) => `${q},${r}`);
    });

    const characters = [
        { name: 'Thorin' },
        { name: 'Gandalf' },
    ];

    it('returns loading true and mapData null before async load completes', () => {
        const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
        expect(result.current.loading).toBe(true);
        expect(result.current.mapData).toBeNull();
        expect(result.current.travelInit).toBeNull();
        expect(result.current.marchingOrder).toEqual([]);
        expect(result.current.partyPosition).toBeNull();
    });

    it('returns default values before async load completes', () => {
        const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
        expect(result.current.gridSize).toBe(10);
        expect(result.current.terrain).toEqual({});
        expect(result.current.rivers).toEqual([]);
        expect(result.current.roads).toEqual([]);
        expect(result.current.pois).toEqual([]);
        expect(result.current.zoom).toBe(2);
        expect(result.current.panX).toBe(0);
        expect(result.current.panY).toBe(0);
        expect(result.current.travelSaveVersion).toBe(0);
    });
});
