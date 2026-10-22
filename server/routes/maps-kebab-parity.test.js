// @maintained-by-ai
// maps-kebab-parity.test.js — cross-boundary drift alarm for the two toKebabCase
// copies (#1173): server/routes/maps.js vs src/services/maps/mapsService.js.
// The client comment claims the helpers "mirror" each other; historically the server
// copy lacked the trailing .json strip ('Cave.json' → client 'cave' vs server
// 'cavejson' — file saved as cavejson.json, unreachable via the client's /maps/cave
// key). There is no shared util home (grep: no kebab helper in server/utils/), so
// parity is pinned here: same inputs → same output BYTES, both functions imported live.
// The maps routes exercise the server copy end-to-end in maps.test.js; the client
// transport copy is owned by src/services/maps/mapsService.test.js (#1010).
import { describe, it, expect, vi } from 'vitest';
import { toKebabCase as serverToKebabCase } from './maps.js';
import { toKebabCase as clientToKebabCase } from '../../src/services/maps/mapsService.js';

// Route module imports fs/campaignPaths/changeData at load; stub them so importing
// maps.js for its pure helper touches no disk and starts no state (no server runs).
vi.mock('fs');
vi.mock('../utils/campaignPaths.js', () => ({
    campaignMapsDir: vi.fn(() => '/mock/campaigns/x/maps'),
    normalizeMapFile: vi.fn((name) => (name.endsWith('.json') ? name : `${name}.json`)),
}));
vi.mock('../utils/changeData.js', () => ({
    publish: vi.fn(),
    activeMaps: new Map(),
    characterChangeData: new Map(),
    markDirty: vi.fn(),
}));

describe('toKebabCase client/server parity (#1173)', () => {
    it.each([
        // plain names — existing paths byte-intact on both sides
        ['Cave', 'cave'],
        ['My Map', 'my-map'],
        ['UPPER CASE MAP', 'upper-case-map'],
        ['Room 123-A', 'room-123-a'],
        ['already-kebab', 'already-kebab'],
        ['', ''],
        ['!@#$%', ''],
        // .json-suffix edge — the drifted arm: client always stripped, server now mirrors
        ['Cave.json', 'cave'],
        ['cave.JSON', 'cave'],
        ['My Map.json', 'my-map'],
        // strip runs once, before the char filter — honest mirrored edge of the regex order
        ['cave.json.json', 'cavejson'],
        // non-json suffixes are NOT stripped — the dot is eaten by the char filter
        ['map.v2', 'mapv2'],
    ])('client and server agree: %s → %s (exact bytes)', (input, expected) => {
        expect(serverToKebabCase(input)).toBe(expected);
        expect(clientToKebabCase(input)).toBe(expected);
        expect(serverToKebabCase(input)).toBe(clientToKebabCase(input));
    });
});
