// @maintained-by-ai 2026-11-16
/*
 * useMapLoader — mount-fit stamp lane (fitVersion law, YG backlog 2026-11-16,
 * owner Option B: the STORED view is CANONICAL).
 *
 * Owns here the persistence half of the law:
 * - a doc stamped at HEX_FIT_VERSION mounts VERBATIM — heldFitVersion reports
 *   the stamp and a dwell across the debounce window fires ZERO writes;
 * - deliberate pan/zoom and party-travel writes CARRY fitVersion through the
 *   whole-doc envelope re-emit (the CARRIED_DOC_KEYS passthrough twin of the
 *   seed/generationOpts stamp law);
 * - a stamp-less/stale doc earns exactly one claim (HexMap's fit pass calls
 *   claimMountFitStamp the instant the fit lands) and the resulting flush
 *   persists view + restamped fitVersion together;
 * - without a claim nothing ever grows the stamp key (the stamp rides the
 *   fit, it is never inferred from view bytes).
 *
 * The fit-geometry half (fitHexView itself) is pinned in
 * src/services/maps/hexViewMath.test.js; the board-pass decision half —
 * stamped → no fit, unstamped/stale → fit + claim — lives in
 * HexMap.mount-fit.test.jsx. jsdom never fits against fake dimensions
 * (playbook §632), so this file pins the claim/envelope legs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import useMapLoader from './useMapLoader.js';
import { HEX_FIT_VERSION } from '../../../services/maps/hexViewMath.js';

// Fake only the transport seam and the numeric config fixtures (mirrors
// useMapLoader.api.test.js — hexViewMath reads HEX_SIZE, so any outdoorConfig
// mock on this chain MUST carry it); the hook's state/persistence logic runs
// for real.
vi.mock('../../../config/outdoorConfig.js', () => ({
    DEFAULT_GRID_SIZE: 10,
    GRID_COLS_MULTIPLIER: 2,
    MIN_ZOOM: 2,
    DEFAULT_TERRAIN: 'plains',
    HEX_SIZE: 30,
}));

vi.mock('../../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
    saveMapData: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/campaign/travelService.js', () => ({
    getDailyHexBudget: vi.fn(() => 4),
}));

import * as mapsService from '../../../services/maps/mapsService.js';
import { hexGridPixelBounds, clampHexPan } from '../../../services/maps/hexViewMath.js';

const CAMPAIGN = 'test-campaign';
const MAP = 'test-map';

// Autosave coalescing window (1s) + margin — mirrors useMapLoader.api.test.js.
const settleAutosave = async () => {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 1300)); });
};

const characters = [{ name: 'Thorin' }];

// Fully-settled view bytes for the fixture grid (pan exactly where the
// loader's settle-at-mount clamp puts it): a mount of this doc normalizes to
// itself, so any write observed below is earned by the STAMP or a real edit,
// never by view settling.
const SETTLED_PAN = clampHexPan(hexGridPixelBounds(24, 12), 12, 3, 40, 60);

const settledDoc = (stamps = {}) => ({
    type: 'outdoor',
    displayName: 'Frostpeak Wilderness',
    terrain: { '1,1': 'hills' },
    rivers: [],
    roads: [],
    pois: [],
    gridSize: 12,
    zoom: 3,
    panX: SETTLED_PAN.x,
    panY: SETTLED_PAN.y,
    marchingOrder: [],
    partyPosition: { q: 7, r: 3 },
    weather: null,
    travelState: null,
    ...stamps,
});

const renderLoadedMap = async (doc) => {
    mapsService.loadMapData.mockResolvedValue(doc);
    const utils = renderHook(() => useMapLoader(CAMPAIGN, MAP, characters));
    await waitFor(() => expect(utils.result.current.loading).toBe(false));
    return utils;
};

describe('useMapLoader - mount-fit stamp (fitVersion law)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('stamped settled doc: held stamp reports verbatim and the dwell writes NOTHING', async () => {
        const { result } = await renderLoadedMap(settledDoc({ fitVersion: HEX_FIT_VERSION }));

        expect(result.current.heldFitVersion).toBe(HEX_FIT_VERSION);
        await settleAutosave();   // outlast the persist debounce — no PUT may hide behind it
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
    });

    it('deliberate view edit on a stamped doc carries fitVersion through the envelope', async () => {
        const { result } = await renderLoadedMap(settledDoc({ fitVersion: HEX_FIT_VERSION }));

        act(() => { result.current.setPanX(SETTLED_PAN.x + 12); });
        await settleAutosave();

        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
        const body = mapsService.saveMapData.mock.calls[0][2];
        expect(body.panX).toBe(SETTLED_PAN.x + 12);
        expect(body.fitVersion).toBe(HEX_FIT_VERSION);
    });

    it('party-travel write on a stamped doc carries fitVersion through the whole-doc replace', async () => {
        const { result } = await renderLoadedMap(settledDoc({ fitVersion: HEX_FIT_VERSION }));

        act(() => {
            result.current.setTravelStateRef({ travelMode: 'planning', path: [{ q: 8, r: 4 }] });
        });
        await settleAutosave();

        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
        const body = mapsService.saveMapData.mock.calls[0][2];
        expect(body.travelState).toEqual({ travelMode: 'planning', path: [{ q: 8, r: 4 }] });
        expect(body.fitVersion).toBe(HEX_FIT_VERSION);
    });

    it('unstamped doc: the mount-fit claim stamps exactly once in ONE write', async () => {
        const { result } = await renderLoadedMap(settledDoc());

        expect(result.current.heldFitVersion).toBeNull();
        // jsdom never runs the board fit (fake dimensions); claimMountFitStamp is
        // the witness the HexMap view pass calls the moment a real fit lands
        // (HexMap.mount-fit.test.jsx pins the fit itself).
        act(() => { result.current.claimMountFitStamp(); });
        await settleAutosave();

        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
        const body = mapsService.saveMapData.mock.calls[0][2];
        expect(body.fitVersion).toBe(HEX_FIT_VERSION);
        expect(body.type).toBe('outdoor');          // full envelope, not a patch
        expect(body.panX).toBe(SETTLED_PAN.x);      // fitted/settled view rides the SAME write
    });

    it('stale-stamped doc: the refit claim restamps to the current version, stamp + generation keys coexist', async () => {
        const { result } = await renderLoadedMap(
            settledDoc({ fitVersion: 0, seed: 7, generationOpts: { mode: 'terrain' } }),
        );

        expect(result.current.heldFitVersion).toBe(0);
        act(() => { result.current.claimMountFitStamp(); });
        await settleAutosave();

        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
        const body = mapsService.saveMapData.mock.calls[0][2];
        expect(body.fitVersion).toBe(HEX_FIT_VERSION);
        expect(body.seed).toBe(7);
        expect(body.generationOpts).toEqual({ mode: 'terrain' });
    });

    it('no claim, no stamp: an unclaimed unstamped doc never grows the fitVersion key', async () => {
        const { result } = await renderLoadedMap(settledDoc());

        act(() => { result.current.setWeather('rain'); });
        await settleAutosave();

        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
        const body = mapsService.saveMapData.mock.calls[0][2];
        expect('fitVersion' in body).toBe(false);
    });

    it('an in-place map switch re-decides from the NEW doc (stale B stays armable, stamped A bytes never leak)', async () => {
        mapsService.loadMapData.mockImplementation((_c, name) =>
            Promise.resolve(name === MAP
                ? settledDoc({ fitVersion: HEX_FIT_VERSION })
                : settledDoc()));
        const utils = renderHook(({ mapName }) => useMapLoader(CAMPAIGN, mapName, characters),
            { initialProps: { mapName: MAP } });
        await waitFor(() => expect(utils.result.current.loading).toBe(false));
        expect(utils.result.current.heldFitVersion).toBe(HEX_FIT_VERSION);

        utils.rerender({ mapName: 'map-b' });
        await waitFor(() => expect(utils.result.current.loading).toBe(false));
        expect(utils.result.current.heldFitVersion).toBeNull();

        // A's stamp must not have leaked into B's carried copy: the claim now
        // stamps B with the CURRENT constant, and only B's URL is ever written.
        act(() => { utils.result.current.claimMountFitStamp(); });
        await settleAutosave();
        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
        expect(mapsService.saveMapData.mock.calls[0][1]).toBe('map-b');
        expect(mapsService.saveMapData.mock.calls[0][2].fitVersion).toBe(HEX_FIT_VERSION);
    });
});
