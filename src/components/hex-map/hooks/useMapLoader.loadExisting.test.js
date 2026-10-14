import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useMapLoader from './useMapLoader.js';

vi.mock('../../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
    saveMapData: vi.fn(() => Promise.resolve()),
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

// Renders the hook against an existing map and waits for the load to finish
// with waitFor (no fixed timers), so post-load state is observed
// deterministically. `mapData` is the exact object loadMapData resolves with,
// so tests can delete keys without defaults being re-introduced.
const renderLoadedMap = async (mapData = createMapData(), chars = characters) => {
    mapsService.loadMapData.mockResolvedValue(mapData);
    const utils = renderHook(() => useMapLoader(CAMPAIGN, MAP, chars));
    await waitFor(() => expect(utils.result.current.loading).toBe(false));
    return utils;
};

describe('useMapLoader - load existing map data', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('requests the existing map with the campaign and map name', async () => {
        await renderLoadedMap();

        expect(mapsService.loadMapData).toHaveBeenCalledWith(CAMPAIGN, MAP);
    });

    it('loads the map only once even when the hook re-renders with the same props', async () => {
        const { rerender } = await renderLoadedMap();

        rerender();

        expect(mapsService.loadMapData).toHaveBeenCalledTimes(1);
    });

    describe('loads existing map fields', () => {
        it.each`
            field          | existingValue
            ${'terrain'}   | ${{ '0,0': 'forest' }}
            ${'rivers'}    | $[{ hexes: ['0,0'] }]
            ${'roads'}     | $[{ hexes: ['0,0'] }]
            ${'pois'}      | $[{ name: 'Camp' }]
        `('sets $field from existing map data', async ({ field, existingValue }) => {
            const { result } = await renderLoadedMap(createMapData({ [field]: existingValue }));

            expect(result.current[field]).toEqual(existingValue);
        });

        it('sets weather, gridSize, zoom, panX, and panY from existing data', async () => {
            const { result } = await renderLoadedMap(createMapData({
                weather: 'stormy',
                gridSize: 20,
                zoom: 5,
                panX: 100,
                panY: 200,
            }));

            expect(result.current.weather).toBe('stormy');
            expect(result.current.gridSize).toBe(20);
            expect(result.current.zoom).toBe(5);
            expect(result.current.panX).toBe(100);
            expect(result.current.panY).toBe(200);
        });

        it.each([0, 1])('clamps a saved zoom of %d up to MIN_ZOOM', async (savedZoom) => {
            const { result } = await renderLoadedMap(createMapData({ zoom: savedZoom }));

            expect(result.current.zoom).toBe(2);
        });

        it('sets marchingOrder and partyPosition from existing data', async () => {
            const { result } = await renderLoadedMap(createMapData({
                marchingOrder: ['Alaric', 'Serena'],
                partyPosition: { q: 10, r: 5 },
            }));

            expect(result.current.marchingOrder).toEqual(['Alaric', 'Serena']);
            expect(result.current.partyPosition).toEqual({ q: 10, r: 5 });
        });

        it('exposes the loaded map data via mapData', async () => {
            const loaded = createMapData({ type: 'cave', weather: 'fog' });
            const { result } = await renderLoadedMap(loaded);

            expect(result.current.mapData).toEqual(loaded);
        });
    });

    describe('existing map type', () => {
        it('defaults a missing type to outdoor', async () => {
            const { result } = await renderLoadedMap(createMapData({ type: undefined }));

            expect(result.current.mapData.type).toBe('outdoor');
        });
    });

    describe('existing map display name', () => {
        it.each([
            { label: 'custom display name', displayName: 'My Custom Map', expected: 'My Custom Map' },
            { label: 'empty display name', displayName: '', expected: MAP },
            { label: 'missing display name', displayName: undefined, expected: MAP },
        ])('uses a $label for hexMapDisplayNameRef, falling back to the map name when blank',
            async ({ displayName, expected }) => {
                const { result } = await renderLoadedMap(createMapData({ displayName }));

                expect(result.current.hexMapDisplayNameRef.current).toBe(expected);
            });
    });

    describe('existing map pan view', () => {
        it.each([
            { label: 'a saved pan view on both axes', overrides: { panX: 50, panY: 75 }, expected: false },
            { label: 'a saved pan view on a single axis', overrides: { panX: 0, panY: 75 }, expected: false },
            { label: 'the default pan view (0, 0)', overrides: {}, expected: true },
            // Current behavior: missing pan fields are treated as a saved view
            // (only an explicit (0, 0) pan requests a view reset).
            { label: 'missing pan fields', overrides: { panX: undefined, panY: undefined }, expected: false },
        ])('sets needsResetViewRef to $expected for $label', async ({ overrides, expected }) => {
            const { result } = await renderLoadedMap(createMapData(overrides));

            expect(result.current.needsResetViewRef.current).toBe(expected);
        });
    });

    describe('existing map with missing optional fields', () => {
        it.each`
            field           | expectedValue
            ${'terrain'}    | ${{}}
            ${'rivers'}     | ${[]}
            ${'roads'}      | ${[]}
            ${'pois'}       | ${[]}
            ${'gridSize'}   | ${10}
            ${'zoom'}       | ${2}
            ${'panX'}       | ${0}
            ${'panY'}       | ${0}
            ${'weather'}    | ${null}
        `('applies the fallback value when $field is missing from existing data',
            async ({ field, expectedValue }) => {
                const data = createMapData();
                delete data[field];
                const { result } = await renderLoadedMap(data);

                expect(result.current[field]).toEqual(expectedValue);
            });

        it('rebuilds marchingOrder from characters when it is missing', async () => {
            const data = createMapData();
            delete data.marchingOrder;
            const { result } = await renderLoadedMap(data);

            expect(result.current.marchingOrder).toEqual(['Thorin', 'Gandalf']);
        });

        it('leaves marchingOrder empty when it is missing and there are no characters', async () => {
            const data = createMapData();
            delete data.marchingOrder;
            const { result } = await renderLoadedMap(data, []);

            expect(result.current.marchingOrder).toEqual([]);
        });

        it('computes partyPosition from the grid center when it is missing', async () => {
            const data = createMapData();
            delete data.partyPosition;
            const { result } = await renderLoadedMap(data);

            expect(result.current.partyPosition).toEqual({ q: 10, r: 5 });
        });
    });
});
