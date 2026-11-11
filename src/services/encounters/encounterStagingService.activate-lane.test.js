// @maintained-by-ai
// Active-map single source of truth (backlog 2026-11-11 split-brain improve):
// the staging lane must END on the `/activate` lane — the same client path
// the Maps-manager Activate button rides — so the server-owned `activeMaps`
// (which renders the list's ACTIVE chip) and `__map__` (stampActiveMapContext)
// match the board the GM navigated to after an accepted COMBAT travel event.
// Non-combat accepts never reach this service at all (routing is pinned in
// components/hex-map/HexMap.additional.test.jsx), so they activate nothing.
//
// Create/reuse/cover semantics stay in encounterStagingService.test.js;
// this file owns ONLY the activate-lane leg.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as mapsService from '../maps/mapsService.js';
import {
    STAGING_MAP_NAME,
    STAGING_MAP_SLUG,
    stageEventEncounterMap,
} from './encounterStagingService.js';

vi.mock('../maps/mapsService.js', async () => {
    const actual = await vi.importActual('../maps/mapsService.js');
    return {
        ...actual,
        loadMaps: vi.fn(),
        createMap: vi.fn(),
        saveMapData: vi.fn(),
        activateMap: vi.fn(),
    };
});

const CN = 'test-campaign';
const BASELINE_MAPS = [{ name: 'Test Map', fileName: 'test-map.json', type: 'indoor' }];
const STAGING_ROW = { name: STAGING_MAP_NAME, fileName: `${STAGING_MAP_SLUG}.json`, type: 'indoor' };

// Shared call recorder: proves ordering (activate rides AFTER the
// authoritative PUT) across the individual vi.fn mocks.
let calls;
const track = () => {
    calls = [];
    mapsService.loadMaps.mockImplementation(async () => ({ maps: BASELINE_MAPS }));
    mapsService.createMap.mockImplementation(async () => { calls.push('create'); return {}; });
    mapsService.saveMapData.mockImplementation(async () => { calls.push('put'); return {}; });
    mapsService.activateMap.mockImplementation(async () => { calls.push('activate'); return {}; });
};

beforeEach(() => {
    vi.clearAllMocks();
    track();
});

describe('stageEventEncounterMap — activate lane (split-brain fix)', () => {
    it('first accept (create leg): activates the stage ONCE, after the PUT, by its canonical name', async () => {
        await stageEventEncounterMap({ campaignName: CN, rng: () => 0.5 });

        expect(mapsService.activateMap).toHaveBeenCalledTimes(1);
        expect(mapsService.activateMap).toHaveBeenCalledWith(CN, STAGING_MAP_NAME);
        expect(calls).toEqual(['create', 'put', 'activate']);
    });

    it('reuse accept: activates the stage ONCE, after the PUT, with no re-create', async () => {
        mapsService.loadMaps.mockImplementation(async () => ({ maps: [...BASELINE_MAPS, STAGING_ROW] }));

        await stageEventEncounterMap({ campaignName: CN, rng: () => 0.5 });

        expect(mapsService.createMap).not.toHaveBeenCalled();
        expect(mapsService.activateMap).toHaveBeenCalledTimes(1);
        expect(mapsService.activateMap).toHaveBeenCalledWith(CN, STAGING_MAP_NAME);
        expect(calls).toEqual(['put', 'activate']);
    });

    it('a FAILED activation rejects the staging (no silently-stale ACTIVE chip)', async () => {
        mapsService.activateMap.mockImplementation(async () => { throw new Error('activate 403'); });

        await expect(
            stageEventEncounterMap({ campaignName: CN, rng: () => 0.5 })
        ).rejects.toThrow('activate 403');
    });

    it('activation never fires before the document write lands', async () => {
        mapsService.saveMapData.mockImplementation(async () => {
            // At PUT-completion time activation must NOT have happened yet.
            expect(mapsService.activateMap).not.toHaveBeenCalled();
            calls.push('put');
            return {};
        });

        await stageEventEncounterMap({ campaignName: CN, rng: () => 0.5 });
        expect(mapsService.activateMap).toHaveBeenCalledTimes(1);
    });
});
