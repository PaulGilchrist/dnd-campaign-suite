import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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

const CAMPAIGN = 'test-campaign';
const MAP = 'test-map';

const characters = [
    { name: 'Thorin' },
    { name: 'Gandalf' },
];

const renderNewMap = (chars = characters) =>
    renderHook(() => useMapLoader(CAMPAIGN, MAP, chars));

const waitForLoad = async (result) => {
    await waitFor(() => expect(result.current.loading).toBe(false));
};

describe('useMapLoader - creating new map', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mapsService.loadMapData.mockResolvedValue(null);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('new map when no existing data', () => {
        it('creates a fully populated outdoor map with default values', async () => {
            const { result } = renderNewMap();
            await waitForLoad(result);

            expect(result.current.mapData.type).toBe('outdoor');
            expect(result.current.mapData.gridSize).toBe(10);
            expect(result.current.mapData.zoom).toBe(2);
            expect(result.current.marchingOrder).toEqual(['Thorin', 'Gandalf']);
            expect(result.current.partyPosition).toEqual({ q: 10, r: 5 });
            expect(result.current.rivers).toEqual([]);
            expect(result.current.roads).toEqual([]);
            expect(result.current.pois).toEqual([]);
            expect(result.current.weather).toBeNull();
        });

        it('initializes every hex in a 20×10 grid to plains with q,r keys', async () => {
            const { result } = renderNewMap();
            await waitForLoad(result);

            expect(Object.keys(result.current.terrain)).toHaveLength(200);
            expect(result.current.terrain['0,0']).toBe('plains');
            expect(result.current.terrain['19,9']).toBe('plains');
            expect(result.current.terrain).not.toHaveProperty('20,0');
            expect(result.current.terrain).not.toHaveProperty('0,10');
            expect(Object.values(result.current.terrain).every(v => v === 'plains')).toBe(true);
        });

        it('persists the new map via saveMapData', async () => {
            const { result } = renderNewMap();
            await waitForLoad(result);

            expect(mapsService.saveMapData).toHaveBeenCalledWith(
                CAMPAIGN,
                MAP,
                expect.objectContaining({
                    type: 'outdoor',
                    gridSize: 10,
                    zoom: 2,
                    terrain: expect.objectContaining({ '0,0': 'plains', '19,9': 'plains' }),
                    marchingOrder: ['Thorin', 'Gandalf'],
                    partyPosition: { q: 10, r: 5 },
                    pois: [],
                    roads: [],
                })
            );
        });

        it('requests a view reset and clears pan position for a new map', async () => {
            const { result } = renderNewMap();
            await waitForLoad(result);

            expect(result.current.needsResetViewRef.current).toBe(true);
            expect(result.current.panX).toBe(0);
            expect(result.current.panY).toBe(0);
        });

        it('creates empty marchingOrder and null partyPosition when no characters', async () => {
            const { result } = renderNewMap([]);
            await waitForLoad(result);

            expect(result.current.marchingOrder).toEqual([]);
            expect(result.current.partyPosition).toBeNull();
        });

        it('finishes loading and keeps the new map when the initial save fails', async () => {
            const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            mapsService.saveMapData.mockRejectedValue(new Error('Save failed'));

            const { result } = renderNewMap();
            await waitForLoad(result);

            expect(result.current.mapData.type).toBe('outdoor');
            expect(result.current.marchingOrder).toEqual(['Thorin', 'Gandalf']);
            expect(errorSpy).toHaveBeenCalledWith('Failed to save initial hex map data:', expect.any(Error));
        });
    });

    describe('load failure', () => {
        it('falls through to new map creation when load fails', async () => {
            mapsService.loadMapData.mockRejectedValue(new Error('Network error'));

            const { result } = renderNewMap();
            await waitForLoad(result);

            expect(result.current.mapData.type).toBe('outdoor');
            expect(result.current.marchingOrder).toEqual(['Thorin', 'Gandalf']);
            expect(mapsService.saveMapData).toHaveBeenCalled();
        });
    });
});
