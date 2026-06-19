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

describe('useMapLoader - creating new map', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hexKey.mockImplementation((q, r) => `${q},${r}`);
    });

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

    describe('creating new map when no existing data', () => {
        it('creates initial terrain grid when no existing map', async () => {
            const { result } = renderAndLoad();
            await waitForMap(result);

            expect(result.current.mapData).not.toBeNull();
            expect(result.current.mapData.type).toBe('outdoor');
            expect(result.current.mapData.gridSize).toBe(10);
            expect(result.current.mapData.zoom).toBe(2);
        });

        it('creates initial marchingOrder from characters', async () => {
            const { result } = renderAndLoad();
            await waitForMap(result);

            expect(result.current.marchingOrder).toEqual(['Thorin', 'Gandalf']);
        });

        it('saves initial map data', async () => {
            renderAndLoad();
            await new Promise(r => setTimeout(r, 50));

            expect(mapsService.saveMapData).toHaveBeenCalledWith('test-campaign', 'test-map', expect.objectContaining({
                type: 'outdoor',
                gridSize: 10,
            }));
        });

        it.each`
            chars                                  | expectedPartyPos
            ${[{ name: 'Thorin' }, { name: 'Gandalf' }]} | ${{ q: 10, r: 5 }}
            ${[]}                                  | ${null}
        `('sets partyPosition to $expectedPartyPos when characters exist', async ({ chars, expectedPartyPos }) => {
            const { result } = renderAndLoad(chars);
            await waitForMap(result);

            expect(result.current.partyPosition).toEqual(expectedPartyPos);
        });

        it.each`
            chars                                  | expectedOrder
            ${[{ name: 'Thorin' }, { name: 'Gandalf' }]} | ${['Thorin', 'Gandalf']}
            ${[]}                                  | ${[]}
        `('sets marchingOrder to $expectedOrder when characters exist', async ({ chars, expectedOrder }) => {
            const { result } = renderAndLoad(chars);
            await waitForMap(result);

            expect(result.current.marchingOrder).toEqual(expectedOrder);
        });

        it('sets initial weather to null', async () => {
            const { result } = renderAndLoad();
            await waitForMap(result);

            expect(result.current.weather).toBeNull();
        });

        it('sets initial rivers, roads, and pois as empty arrays', async () => {
            const { result } = renderAndLoad();
            await waitForMap(result);

            expect(result.current.rivers).toEqual([]);
            expect(result.current.roads).toEqual([]);
            expect(result.current.pois).toEqual([]);
        });

        it('handles characters with different shapes', async () => {
            const variedCharacters = [
                { name: '', class: 'Fighter' },
                { name: 'A', level: 3, class: 'Wizard' },
            ];
            const { result } = renderAndLoad(variedCharacters);
            await waitForMap(result);

            expect(result.current.marchingOrder).toEqual(['', 'A']);
            expect(result.current.partyPosition).toEqual({ q: 10, r: 5 });
        });
    });

    describe('error handling when loading existing map', () => {
        it.each`
            errorFactory
            ${() => null}
            ${() => { throw new Error('Network error'); }}
        `('falls through to new map creation when load returns $errorFactory', async ({ errorFactory }) => {
            mapsService.loadMapData.mockReset();
            if (errorFactory.name === 'anonymous') {
                mapsService.loadMapData.mockResolvedValue(null);
            } else {
                mapsService.loadMapData.mockRejectedValue(new Error('Network error'));
            }

            const { result } = renderAndLoad();
            await waitForMap(result);

            expect(result.current.loading).toBe(false);
            expect(result.current.mapData).not.toBeNull();
            expect(result.current.mapData.type).toBe('outdoor');
            expect(result.current.mapData.gridSize).toBe(10);
            expect(result.current.mapData.zoom).toBe(2);
            expect(result.current.terrain).toBeDefined();
            expect(Object.keys(result.current.terrain).length).toBe(200);
            expect(result.current.marchingOrder).toEqual(['Thorin', 'Gandalf']);
            expect(result.current.partyPosition).toEqual({ q: 10, r: 5 });
            expect(result.current.rivers).toEqual([]);
            expect(result.current.roads).toEqual([]);
            expect(result.current.pois).toEqual([]);
            expect(result.current.weather).toBeNull();
        });
    });

    describe('initial terrain grid generation', () => {
        it('generates terrain grid with correct key format', async () => {
            const { result } = renderAndLoad();
            await waitForMap(result);

            const keys = Object.keys(result.current.terrain);
            expect(keys.length).toBe(200);
            expect(keys[0]).toBe('0,0');
            expect(keys[keys.length - 1]).toBe('19,9');
        });

        it('sets all terrain hexes to DEFAULT_TERRAIN', async () => {
            const { result } = renderAndLoad();
            await waitForMap(result);

            const values = Object.values(result.current.terrain);
            expect(values.every(v => v === 'plains')).toBe(true);
        });
    });
});
