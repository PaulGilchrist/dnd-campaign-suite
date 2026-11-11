// @maintained-by-ai
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HexMap3D from './HexMap3D.jsx';

// Dev-only automation handle lane for the OUTDOOR twin (backlog 2026-11-10 HD):
// HexMap3D.jsx exposes globalThis.__hexmap3d whose `census` getter delegates
// to Hex3DScene.getCensus ON READ (live scene, never a mount snapshot), gated
// behind import.meta.env.DEV. Mirrors ./Map3D/Map3D.dev-census.test.jsx; scene
// is mocked with a getCensus stub — census CONTENT is owned by
// ./hex3dScene.census.test.js. three.js is never loaded here.

const getCensusMock = vi.fn();
let initDeferred;

vi.mock('./hex3dScene.js', () => ({
    Hex3DScene: class {
        init() {
            return initDeferred.promise;
        }
        buildMap() {}
        setToggles() {}
        updateParty() {}
        updateTravelPath() {}
        setWeather() {}
        topDown() {}
        dispose() {}
        getCensus() {
            return getCensusMock();
        }
    },
}));

const hex3dProps = (overrides = {}) => ({
    displayName: 'Census Reach',
    hexCols: 8,
    hexRows: 6,
    terrain: {},
    rivers: [],
    roads: [],
    pois: [],
    partyPosition: null,
    travelPath: [],
    travelPathIndex: 0,
    weather: null,
    isLocalhost: true,
    onExit: vi.fn(),
    ...overrides,
});

const deferred = () => {
    let resolve;
    const promise = new Promise((res) => { resolve = res; });
    return { promise, resolve };
};

const mountReady = async () => {
    const view = render(<HexMap3D {...hex3dProps()} />);
    await act(async () => {
        initDeferred.resolve();
    });
    return view;
};

describe('HexMap3D dev census handle (globalThis.__hexmap3d)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        initDeferred = deferred();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        delete globalThis.__hexmap3d;
    });

    it('attaches only once the scene is ready and the census delegates to the scene', async () => {
        render(<HexMap3D {...hex3dProps()} />);
        expect(globalThis.__hexmap3d).toBeUndefined(); // init still pending

        await mountReady();
        expect(globalThis.__hexmap3d).toBeTruthy();
        getCensusMock.mockReturnValue({ hexes: 48, pois: { tower: 1 } });
        expect(globalThis.__hexmap3d.census).toEqual({ hexes: 48, pois: { tower: 1 } });
        expect(getCensusMock).toHaveBeenCalledTimes(1);
    });

    it('is LIVE: reads after a scene-side change return fresh counts with no remount', async () => {
        await mountReady();
        getCensusMock.mockReturnValue({ party: 0 });
        expect(globalThis.__hexmap3d.census.party).toBe(0);
        // Whole-doc partyPosition PUT adopted via the patch lane: the next
        // read reflects it — no rerender, no remount.
        getCensusMock.mockReturnValue({ party: 1 });
        expect(globalThis.__hexmap3d.census.party).toBe(1);
        expect(getCensusMock).toHaveBeenCalledTimes(2);
    });

    it('detaches the handle on unmount (no stale scene left reachable)', async () => {
        const { unmount } = await mountReady();
        expect(globalThis.__hexmap3d).toBeTruthy();
        unmount();
        expect(globalThis.__hexmap3d).toBeUndefined();
    });

    it('production builds (DEV=false) never expose the handle', async () => {
        vi.stubEnv('DEV', false); // pins the import.meta.env.DEV guard branch
        expect(import.meta.env.DEV).toBe(false);
        await mountReady();
        expect(globalThis.__hexmap3d).toBeUndefined();
    });
});
