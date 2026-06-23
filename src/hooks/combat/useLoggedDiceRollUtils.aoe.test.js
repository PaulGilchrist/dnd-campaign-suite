import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(),
}));

vi.mock('../runtime/useRuntimeState.js', () => ({
    getRuntimeValue: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
    sendSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
    hasMinDamage: vi.fn(),
}));

import { loadMapData } from '../../services/maps/mapsService.js';
import { readAoeContext } from './useLoggedDiceRollUtils.js';

describe('readAoeContext', () => {
    const origFetch = globalThis.fetch;

    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
        loadMapData.mockResolvedValue(null);
    });

    afterAll(() => {
        globalThis.fetch = origFetch;
        vi.unstubAllGlobals();
    });

    it('returns null when campaignName is falsy', async () => {
        expect(await readAoeContext(null, 'overlay-1')).toBe(null);
    });

    it('returns null when overlayId is falsy', async () => {
        expect(await readAoeContext('test-campaign', null)).toBe(null);
    });

    it('returns null when overlay fetch response is not ok', async () => {
        globalThis.fetch.mockResolvedValueOnce({ ok: false });
        const result = await readAoeContext('test-campaign', 'overlay-1');
        expect(result).toBe(null);
    });

    it('returns null when response JSON has no overlays', async () => {
        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({}),
        });
        const result = await readAoeContext('test-campaign', 'overlay-1');
        expect(result).toBe(null);
    });

    it('returns null when overlay is not found in overlays array', async () => {
        globalThis.fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ overlays: [{ id: 'other-id' }] }),
        });
        const result = await readAoeContext('test-campaign', 'overlay-1');
        expect(result).toBe(null);
    });

    it('returns null when active map fetch fails', async () => {
        globalThis.fetch
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: [{ id: 'overlay-1' }] }),
            })
            .mockResolvedValueOnce({ ok: false });
        const result = await readAoeContext('test-campaign', 'overlay-1');
        expect(result).toBe(null);
    });

    it('returns null when activeMapName is missing from response', async () => {
        globalThis.fetch
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: [{ id: 'overlay-1' }] }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({}),
            });
        const result = await readAoeContext('test-campaign', 'overlay-1');
        expect(result).toBe(null);
    });

    it('returns null when loadMapData returns null', async () => {
        loadMapData.mockResolvedValue(null);
        globalThis.fetch
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: [{ id: 'overlay-1' }] }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ activeMapName: 'map1' }),
            });
        const result = await readAoeContext('test-campaign', 'overlay-1');
        expect(result).toBe(null);
    });

    it('returns context object when all fetches succeed', async () => {
        const mapData = { players: ['Player1'], placedItems: ['Orc'] };
        loadMapData.mockResolvedValue(mapData);
        globalThis.fetch
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: [{ id: 'overlay-1', type: 'cone' }] }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ activeMapName: 'dungeon-1' }),
            });
        const result = await readAoeContext('test-campaign', 'overlay-1');
        expect(result).toEqual({
            overlay: { id: 'overlay-1', type: 'cone' },
            players: ['Player1'],
            npcs: ['Orc'],
        });
    });

    it('returns empty arrays for players/npcs when mapData lacks them', async () => {
        loadMapData.mockResolvedValue({});
        globalThis.fetch
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: [{ id: 'overlay-1' }] }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ activeMapName: 'map1' }),
            });
        const result = await readAoeContext('test-campaign', 'overlay-1');
        expect(result).toEqual({
            overlay: { id: 'overlay-1' },
            players: [],
            npcs: [],
        });
    });

    it('returns null on fetch error in overlay request', async () => {
        globalThis.fetch.mockRejectedValueOnce(new Error('network error'));
        const result = await readAoeContext('test-campaign', 'overlay-1');
        expect(result).toBe(null);
    });

    it('returns null on fetch error in active map request', async () => {
        globalThis.fetch
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: [{ id: 'overlay-1' }] }),
            })
            .mockRejectedValueOnce(new Error('network error'));
        const result = await readAoeContext('test-campaign', 'overlay-1');
        expect(result).toBe(null);
    });

    it('returns null on loadMapData error', async () => {
        globalThis.fetch
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: [{ id: 'overlay-1' }] }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ activeMapName: 'map1' }),
            });
        loadMapData.mockRejectedValueOnce(new Error('load failed'));
        const result = await readAoeContext('test-campaign', 'overlay-1');
        expect(result).toBe(null);
    });

    it('encodes campaign name in spell-overlay URL', async () => {
        globalThis.fetch.mockResolvedValueOnce({ ok: false });
        await readAoeContext('my test campaign', 'overlay-1');
        expect(globalThis.fetch).toHaveBeenCalledWith(
            '/spell-overlay?campaign=my%20test%20campaign'
        );
    });

    it('encodes campaign name in active-map URL', async () => {
        globalThis.fetch
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: [{ id: 'overlay-1' }] }),
            })
            .mockResolvedValueOnce({ ok: false });
        await readAoeContext('my test campaign', 'overlay-1');
        expect(globalThis.fetch).toHaveBeenLastCalledWith(
            '/api/campaigns/my%20test%20campaign/active-map'
        );
    });
});
