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

    it('returns loading as true initially', () => {
        const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
        expect(result.current.loading).toBe(true);
    });

    it('returns mapData as null initially', () => {
        const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
        expect(result.current.mapData).toBeNull();
    });

    it.each([
        ['gridSize', 10],
        ['terrain', {}],
        ['rivers', []],
        ['roads', []],
        ['pois', []],
        ['marchingOrder', []],
        ['partyPosition', null],
        ['weather', null],
        ['travelInit', null],
        ['travelSaveVersion', 0],
        ['zoom', 2],
        ['panX', 0],
        ['panY', 0],
    ])('returns %s as %o initially', (field, expectedValue) => {
        const { result } = renderHook(() => useMapLoader('test-campaign', 'test-map', characters));
        expect(result.current[field]).toEqual(expectedValue);
    });
});
