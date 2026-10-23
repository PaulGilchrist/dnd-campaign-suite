// @maintained-by-ai
/*
 * useMapLoader — init lane (observable state before any load resolves).
 *
 * Owns here: while the initial load is pending the hook reports loading with
 * no map data and persists nothing (pins the :188 loading-state mount-save
 * guard), and ref state is seeded from the mount props before any load lands.
 *
 * Lane map (do NOT duplicate across these files):
 * - post-load setters + envelope persistence        -> useMapLoader.api.test.js
 * - mount/load args + loaded-field application      -> useMapLoader.loadExisting.test.js
 * - create-new-map bytes (real config defaults)     -> useMapLoader.createNew.test.js
 * - travelInit derivation from loaded travelState   -> useMapLoader.travelState.test.js
 *
 * Trimmed vs prior version: pre-load numeric/collection defaults
 * (gridSize/zoom/pan/terrain/rivers/roads/pois/marchingOrder/partyPosition/
 * weather/travelInit/travelSaveVersion) were raw useState literal
 * pass-throughs — gridSize/zoom pinned the fixture-mocked config numbers
 * (tautological) and the same defaults are proven end-to-end with real
 * config bytes in useMapLoader.createNew.test.js and applied-from-load in
 * useMapLoader.loadExisting.test.js. Removed: 4 default pass-through
 * assertions, 2 tests consolidated into 1.
 *
 * Honest scoping notes (known source bugs, not masked here): fixtures use a
 * constant mapName, so the #801 seams (load-effect re-arm on a name change,
 * hexMapNameRef re-claim at load completion) are exercised in the in-place
 * switch arms of useMapLoader.api.test.js, not here; a campaignName change
 * with an unchanged mapName still does not reload (production consumers
 * remount via key={mapName}, Map.jsx:354). The pending-load promise makes
 * the mount-save guard observable via the `loading` state, which this lane
 * pins (#800 fixed: the guard is the loading STATE in the persistence
 * effect's deps — the old hasLoaded ref flipped after an await seam and the
 * flush was scheduling-dependent).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import useMapLoader from './useMapLoader.js';

// Fake only the transport seam — config, hexKey, and travelService run real
// (none of them execute while the load is pending, so no fixture drift).
vi.mock('../../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
    saveMapData: vi.fn(() => Promise.resolve()),
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

    it('reports loading with no map data and persists nothing while the load is pending', () => {
        const { result } = renderWithPendingLoad();

        expect(result.current.loading).toBe(true);
        expect(result.current.mapData).toBeNull();
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
    });

    it('seeds refs from the given props before the load completes', () => {
        const { result } = renderWithPendingLoad('my-campaign', 'my-map');

        // #801: hexMapNameRef names the bytes HELD, not the mount prop — it
        // starts null (guard :201 closed) and is claimed by the load effect
        // only when that load's bytes land, so an in-place mapName change
        // can never stale-close the save guard.
        expect(result.current.hexMapNameRef.current).toBeNull();
        expect(result.current.hexMapDisplayNameRef.current).toBe('my-map');
        expect(result.current.needsResetViewRef.current).toBe(false);
        expect(result.current.travelStateRef.current).toBeNull();
    });
});
