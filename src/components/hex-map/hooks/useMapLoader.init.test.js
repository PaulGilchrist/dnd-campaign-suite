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

const characters = [
    { name: 'Thorin' },
    { name: 'Gandalf' },
];

// Renders the hook with a loadMapData promise that never resolves, so the
// pre-load state is observable deterministically instead of racing timers.
const renderWithPendingLoad = (campaign = 'test-campaign', map = 'test-map', chars = characters) => {
    mapsService.loadMapData.mockReturnValue(new Promise(() => {}));
    return renderHook(() => useMapLoader(campaign, map, chars));
};

describe('useMapLoader - initial state before load completes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('stays in loading state with no map data while the load is pending', () => {
        const { result } = renderWithPendingLoad();

        expect(result.current.loading).toBe(true);
        expect(result.current.mapData).toBeNull();
    });

    it('does not persist anything while the load is pending', () => {
        renderWithPendingLoad();

        expect(mapsService.saveMapData).not.toHaveBeenCalled();
    });

    it('exposes default map configuration before the load completes', () => {
        const { result } = renderWithPendingLoad();

        expect(result.current.gridSize).toBe(10);
        expect(result.current.zoom).toBe(2);
        expect(result.current.panX).toBe(0);
        expect(result.current.panY).toBe(0);
        expect(result.current.terrain).toEqual({});
        expect(result.current.rivers).toEqual([]);
        expect(result.current.roads).toEqual([]);
        expect(result.current.pois).toEqual([]);
    });

    it('exposes default party, travel, and weather state before the load completes', () => {
        const { result } = renderWithPendingLoad();

        expect(result.current.marchingOrder).toEqual([]);
        expect(result.current.partyPosition).toBeNull();
        expect(result.current.weather).toBeNull();
        expect(result.current.travelInit).toBeNull();
        expect(result.current.travelSaveVersion).toBe(0);
    });

    it('seeds refs from the given props before the load completes', () => {
        const { result } = renderWithPendingLoad('my-campaign', 'my-map');

        expect(result.current.hexMapNameRef.current).toBe('my-map');
        expect(result.current.hexMapDisplayNameRef.current).toBe('my-map');
        expect(result.current.needsResetViewRef.current).toBe(false);
        expect(result.current.travelStateRef.current).toBeNull();
    });
});
