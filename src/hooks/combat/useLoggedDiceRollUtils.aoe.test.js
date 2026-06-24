// @improved-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
    const mockOverlayData = {
        overlays: [{ id: 'overlay-1', type: 'cone' }],
    };
    const mockActiveMap = { activeMapName: 'dungeon-1' };
    const mockMapData = { players: ['Player1'], placedItems: ['Orc'] };

    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('early returns', () => {
        it('returns null when campaignName is null', async () => {
            await expect(readAoeContext(null, 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when campaignName is undefined', async () => {
            await expect(readAoeContext(undefined, 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when campaignName is empty string', async () => {
            await expect(readAoeContext('', 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when overlayId is null', async () => {
            await expect(readAoeContext('test-campaign', null)).resolves.toBeNull();
        });

        it('returns null when overlayId is undefined', async () => {
            await expect(readAoeContext('test-campaign', undefined)).resolves.toBeNull();
        });

        it('returns null when overlayId is empty string', async () => {
            await expect(readAoeContext('test-campaign', '')).resolves.toBeNull();
        });
    });

    describe('overlay fetch failures', () => {
        it('returns null when overlay response is not ok', async () => {
            globalThis.fetch.mockResolvedValueOnce({ ok: false });
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when overlay response is ok but json has no overlays key', async () => {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({}),
            });
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when overlays is undefined', async () => {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: undefined }),
            });
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when overlays is null', async () => {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: null }),
            });
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when overlays is a non-array value', async () => {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: 'not-an-array' }),
            });
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when overlays is an empty array', async () => {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: [] }),
            });
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when overlay id is not found in overlays array', async () => {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: [{ id: 'other-id' }] }),
            });
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when overlay fetch rejects', async () => {
            globalThis.fetch.mockRejectedValueOnce(new Error('network error'));
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when overlay json() rejects', async () => {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.reject(new Error('invalid json')),
            });
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });
    });

    describe('active map fetch failures', () => {
        function mockOverlaySuccess() {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: [{ id: 'overlay-1' }] }),
            });
        }

        it('returns null when active-map response is not ok', async () => {
            mockOverlaySuccess();
            globalThis.fetch.mockResolvedValueOnce({ ok: false });
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when active-map JSON has no activeMapName key', async () => {
            mockOverlaySuccess();
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({}),
            });
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when activeMapName is undefined', async () => {
            mockOverlaySuccess();
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ activeMapName: undefined }),
            });
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when activeMapName is null', async () => {
            mockOverlaySuccess();
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ activeMapName: null }),
            });
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when active-map json() rejects', async () => {
            mockOverlaySuccess();
            globalThis.fetch.mockRejectedValueOnce(new Error('invalid json'));
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when active-map fetch rejects', async () => {
            mockOverlaySuccess();
            globalThis.fetch.mockRejectedValueOnce(new Error('network error'));
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });
    });

    describe('map data loading failures', () => {
        function mockOverlayAndActiveMapSuccess() {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: [{ id: 'overlay-1' }] }),
            });
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ activeMapName: 'map1' }),
            });
        }

        it('returns null when loadMapData returns null', async () => {
            mockOverlayAndActiveMapSuccess();
            loadMapData.mockResolvedValue(null);
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });

        it('returns null when loadMapData rejects', async () => {
            mockOverlayAndActiveMapSuccess();
            loadMapData.mockRejectedValue(new Error('load failed'));
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });
    });

    describe('successful context resolution', () => {
        function mockAllSuccess(mapDataOverride) {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockOverlayData),
            });
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockActiveMap),
            });
            loadMapData.mockResolvedValue(mapDataOverride || mockMapData);
        }

        it('returns overlay, players and npcs when all fetches succeed', async () => {
            const mapData = { players: ['Player1'], placedItems: ['Orc'] };
            mockAllSuccess(mapData);
            const result = await readAoeContext('test-campaign', 'overlay-1');
            expect(result).toEqual({
                overlay: { id: 'overlay-1', type: 'cone' },
                players: ['Player1'],
                npcs: ['Orc'],
            });
        });

        it('returns empty arrays for players/npcs when mapData lacks them', async () => {
            mockAllSuccess({});
            const result = await readAoeContext('test-campaign', 'overlay-1');
            expect(result).toEqual({
                overlay: { id: 'overlay-1', type: 'cone' },
                players: [],
                npcs: [],
            });
        });

        it('returns empty array for players when mapData.players is null', async () => {
            mockAllSuccess({ players: null, placedItems: ['Enemy'] });
            const result = await readAoeContext('test-campaign', 'overlay-1');
            expect(result).toEqual({
                overlay: { id: 'overlay-1', type: 'cone' },
                players: [],
                npcs: ['Enemy'],
            });
        });

        it('returns empty array for npcs when mapData.placedItems is null', async () => {
            mockAllSuccess({ players: ['Hero'], placedItems: null });
            const result = await readAoeContext('test-campaign', 'overlay-1');
            expect(result).toEqual({
                overlay: { id: 'overlay-1', type: 'cone' },
                players: ['Hero'],
                npcs: [],
            });
        });

        it('returns the overlay object found by id from a list of overlays', async () => {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: [{ id: 'other' }, { id: 'overlay-1', shape: 'sphere' }] }),
            });
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ activeMapName: 'map1' }),
            });
            loadMapData.mockResolvedValue({ players: [], placedItems: [] });
            const result = await readAoeContext('test-campaign', 'overlay-1');
            expect(result.overlay).toMatchObject({ id: 'overlay-1', shape: 'sphere' });
        });

        it('returns null when the requested overlay id is not in the overlays list', async () => {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: [{ id: 'other-id' }, { id: 'different' }] }),
            });
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ activeMapName: 'map1' }),
            });
            loadMapData.mockResolvedValue({ players: [], placedItems: [] });
            await expect(readAoeContext('test-campaign', 'overlay-1')).resolves.toBeNull();
        });
    });

    describe('URL encoding', () => {
        it('encodes campaign name with spaces in spell-overlay URL', async () => {
            globalThis.fetch.mockResolvedValueOnce({ ok: false });
            await readAoeContext('my test campaign', 'overlay-1');
            expect(globalThis.fetch).toHaveBeenCalledWith(
                '/spell-overlay?campaign=my%20test%20campaign'
            );
        });

        it('encodes campaign name with spaces in active-map URL', async () => {
            globalThis.fetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ overlays: [{ id: 'overlay-1' }] }),
            });
            globalThis.fetch.mockResolvedValueOnce({ ok: false });
            await readAoeContext('my test campaign', 'overlay-1');
            expect(globalThis.fetch).toHaveBeenLastCalledWith(
                '/api/campaigns/my%20test%20campaign/active-map'
            );
        });

        it('encodes special characters in campaign name', async () => {
            globalThis.fetch.mockResolvedValueOnce({ ok: false });
            await readAoeContext('campaign&name=value', 'overlay-1');
            expect(globalThis.fetch).toHaveBeenCalledWith(
                '/spell-overlay?campaign=campaign%26name%3Dvalue'
            );
        });
    });

    describe('fetch call order', () => {
        it('calls fetch in the correct order: overlay, active-map, loadMapData', async () => {
            loadMapData.mockResolvedValue({ players: [], placedItems: [] });
            globalThis.fetch
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ overlays: [{ id: 'overlay-1' }] }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    json: () => Promise.resolve({ activeMapName: 'map1' }),
                });
            await readAoeContext('test-campaign', 'overlay-1');
            const calls = globalThis.fetch.mock.calls;
            expect(calls[0][0]).toContain('spell-overlay');
            expect(calls[1][0]).toContain('active-map');
        });
    });
});
