// @maintained-by-ai
import { render, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import Map3D from './Map3D.jsx';

// Dev-only automation handle lane (backlog 2026-11-10 HD): Map3D.jsx exposes
// globalThis.__map3d whose `census` getter delegates to Map3DScene.getCensus
// ON READ (live scene, never a mount snapshot), gated behind import.meta.env.DEV
// so production builds attach nothing. Scene is mocked with a getCensus stub —
// census CONTENT is owned by ./map3dScene.census.test.js; this file owns the
// handle's attach/read/detach lifecycle and the DEV guard branch. three.js is
// never loaded here.

const getCensusMock = vi.fn();
let initDeferred;

vi.mock('./map3dScene.js', () => ({
    Map3DScene: class {
        init() {
            return initDeferred.promise;
        }
        buildMap() {}
        setToggles() {}
        updateSpellOverlays() {}
        topDown() {}
        dispose() {}
        getCensus() {
            return getCensusMock();
        }
    },
}));

const map3dProps = (overrides = {}) => ({
    campaignName: 'test-campaign',
    mapData: { displayName: 'Census Map', gridSize: 10, walls: new Set(), players: [], bgFill: '#1a1a1a' },
    placedItems: [],
    characters: [],
    isLocalhost: true,
    fog: new Set(),
    npcImages: {},
    overlays: [],
    onExit: vi.fn(),
    ...overrides,
});

const deferred = () => {
    let resolve;
    const promise = new Promise((res) => { resolve = res; });
    return { promise, resolve };
};

const mountReady = async () => {
    const view = render(<Map3D {...map3dProps()} />);
    await act(async () => {
        initDeferred.resolve();
    });
    return view;
};

describe('Map3D dev census handle (globalThis.__map3d)', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        delete globalThis.__map3d;
    });

    beforeEach(() => {
        vi.clearAllMocks();
        initDeferred = deferred();
    });

    it('attaches only once the scene is ready and the census delegates to the scene', async () => {
        render(<Map3D {...map3dProps()} />);
        expect(globalThis.__map3d).toBeUndefined(); // init still pending

        await mountReady();
        expect(globalThis.__map3d).toBeTruthy();
        getCensusMock.mockReturnValue({ players: 2, items: { barrel: 2 } });
        expect(globalThis.__map3d.census).toEqual({ players: 2, items: { barrel: 2 } });
        expect(getCensusMock).toHaveBeenCalledTimes(1);
    });

    it('is LIVE: reads after a scene-side change return fresh counts with no remount', async () => {
        await mountReady();
        getCensusMock.mockReturnValue({ overlays: 0 });
        expect(globalThis.__map3d.census.overlays).toBe(0);
        // Server-side overlay add adopted by the mounted scene (SSE patch
        // lane): the next read reflects it — no rerender, no remount.
        getCensusMock.mockReturnValue({ overlays: 1 });
        expect(globalThis.__map3d.census.overlays).toBe(1);
        expect(getCensusMock).toHaveBeenCalledTimes(2);
    });

    it('detaches the handle on unmount (no stale scene left reachable)', async () => {
        const { unmount } = await mountReady();
        expect(globalThis.__map3d).toBeTruthy();
        unmount();
        expect(globalThis.__map3d).toBeUndefined();
    });

    it('production builds (DEV=false) never expose the handle', async () => {
        vi.stubEnv('DEV', false); // pins the import.meta.env.DEV guard branch
        expect(import.meta.env.DEV).toBe(false);
        await mountReady();
        expect(globalThis.__map3d).toBeUndefined();
    });
});
