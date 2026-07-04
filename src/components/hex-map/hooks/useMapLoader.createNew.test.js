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

const characters = [
    { name: 'Thorin' },
    { name: 'Gandalf' },
];

const renderAndLoad = (chars = characters) => {
    mapsService.loadMapData.mockResolvedValue(null);
    return renderHook(() => useMapLoader('test-campaign', 'test-map', chars));
};

const waitForMap = async (result) => {
    await new Promise(r => setTimeout(r, 50));
    expect(result.current.loading).toBe(false);
};

describe('useMapLoader - creating new map', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hexKey.mockImplementation((q, r) => `${q},${r}`);
    });

    describe('new map when no existing data', () => {
        it('creates outdoor map with correct defaults', async () => {
            const { result } = renderAndLoad();
            await waitForMap(result);

            expect(result.current.mapData).not.toBeNull();
            expect(result.current.mapData.type).toBe('outdoor');
            expect(result.current.mapData.gridSize).toBe(10);
            expect(result.current.mapData.zoom).toBe(2);
            expect(result.current.terrain).toBeDefined();
            expect(Object.keys(result.current.terrain).length).toBe(200);
            expect(Object.values(result.current.terrain).every(v => v === 'plains')).toBe(true);
            expect(result.current.marchingOrder).toEqual(['Thorin', 'Gandalf']);
            expect(result.current.partyPosition).toEqual({ q: 10, r: 5 });
            expect(result.current.rivers).toEqual([]);
            expect(result.current.roads).toEqual([]);
            expect(result.current.pois).toEqual([]);
            expect(result.current.weather).toBeNull();
        });

        it('creates empty marchingOrder and null partyPosition when no characters', async () => {
            const { result } = renderAndLoad([]);
            await waitForMap(result);

            expect(result.current.marchingOrder).toEqual([]);
            expect(result.current.partyPosition).toBeNull();
        });

        it('falls through to new map creation when load fails', async () => {
            mapsService.loadMapData.mockRejectedValue(new Error('Network error'));

            const { result } = renderAndLoad();
            await waitForMap(result);

            expect(result.current.mapData).not.toBeNull();
            expect(result.current.mapData.type).toBe('outdoor');
            expect(result.current.marchingOrder).toEqual(['Thorin', 'Gandalf']);
        });
    });
});
