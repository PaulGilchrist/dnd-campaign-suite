import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
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

// Renders the hook against an already-loaded map and waits for the load to
// finish so tests exercise the post-load API deterministically (no raw timers).
const renderLoadedHook = async () => {
    mapsService.loadMapData.mockResolvedValue(baseMapData);
    const utils = renderHook(() => useMapLoader(CAMPAIGN, MAP, characters));
    await waitFor(() => expect(utils.result.current.loading).toBe(false));
    return utils;
};

describe('useMapLoader - API surface', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        hexKey.mockImplementation((q, r) => `${q},${r}`);
    });

    describe('setTravelStateRef', () => {
        it('updates travelStateRef and bumps travelSaveVersion', async () => {
            const { result } = await renderLoadedHook();

            const initialVersion = result.current.travelSaveVersion;

            act(() => {
                result.current.setTravelStateRef({ travelMode: 'active' });
            });

            expect(result.current.travelSaveVersion).toBe(initialVersion + 1);
            expect(result.current.travelStateRef.current).toEqual({ travelMode: 'active' });
        });

        it('persists the updated travel state via the save effect', async () => {
            const { result } = await renderLoadedHook();
            mapsService.saveMapData.mockClear();

            act(() => {
                result.current.setTravelStateRef({ travelMode: 'active', destination: 'City A' });
            });

            await waitFor(() => {
                expect(mapsService.saveMapData).toHaveBeenCalledWith(
                    CAMPAIGN,
                    MAP,
                    expect.objectContaining({ travelState: { travelMode: 'active', destination: 'City A' } })
                );
            });
        });
    });

    describe('state setters', () => {
        it.each([
            ['terrain', { '5,5': 'mountain' }],
            ['rivers', [{ hexes: ['0,0'] }]],
            ['roads', [{ hexes: ['1,1'] }]],
            ['pois', [{ name: 'Camp' }]],
            ['gridSize', 20],
            ['zoom', 5],
            ['panX', 100],
            ['panY', 50],
            ['marchingOrder', ['Thorin']],
            ['partyPosition', { q: 3, r: 4 }],
            ['weather', 'rain'],
            ['mapData', { type: 'outdoor' }],
            ['travelInit', { travelMode: 'active' }],
        ])('exposes a setter that updates $state', async (state, value) => {
            const { result } = await renderLoadedHook();

            act(() => {
                result.current[`set${state[0].toUpperCase()}${state.slice(1)}`](value);
            });

            expect(result.current[state]).toEqual(value);
        });

        it('persists setter-driven state changes via the save effect', async () => {
            const { result } = await renderLoadedHook();
            mapsService.saveMapData.mockClear();

            act(() => {
                result.current.setTerrain({ '3,4': 'forest' });
            });

            await waitFor(() => {
                expect(mapsService.saveMapData).toHaveBeenCalledWith(
                    CAMPAIGN,
                    MAP,
                    expect.objectContaining({ terrain: { '3,4': 'forest' } })
                );
            });
        });
    });
});
