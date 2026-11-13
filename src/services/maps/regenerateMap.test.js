// @maintained-by-ai: 2026-11-12
// Regenerate-from-stamped-opts service (VG backlog 2026-11-12): the stamped
// generationOpts must reach the correct CLIENT generator VERBATIM (Room Adjacent →
// generateAdjacentDungeon, BSP → generateDungeon, Terrain → generateHexTerrain), the
// PUT must land on the SAME doc preserving every identity field (name, displayName,
// createdAt, description, players, generationOpts, seed) while replacing only the
// mode's generated layout fields, and exactly ONE campaign-log audit row names the map
// on success (none on a failed GET/PUT). The generators are mocked here — seeded
// byte-determinism of the real trio is engine law (rng.js), proven live.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted: the vi.mock factories below run during the import phase (before
// module-body consts), so the shared generator-output builder lives here.
const { dungeonOutput } = vi.hoisted(() => {
    const dungeonOutput = (mode) => ({
        name: 'Squelching Cave',
        description: 'A dank generated den.',
        gridSize: 20,
        seed: 42,
        walls: ['0,0', '1,0'],
        placedItems: [{ id: 'door-1', gridX: 3, gridY: 4, type: 'door' }],
        players: [],
        zoom: 1,
        panX: 0,
        panY: 0,
        ...(mode === 'adjacent' ? { generationMode: 'adjacent' } : {}),
    });
    return { dungeonOutput };
});

vi.mock('./dungeonGenerator.js', () => ({
    generateDungeon: vi.fn(() => dungeonOutput('bsp')),
    generateAdjacentDungeon: vi.fn(() => dungeonOutput('adjacent')),
}));

vi.mock('./hexTerrainGenerator.js', () => ({
    generateHexTerrain: vi.fn(() => ({
        terrain: { '0,0': 'grass', '1,1': 'water' },
        rivers: ['1,1', '2,1'],
        seed: 7,
    })),
}));

vi.mock('./mapsService.js', () => ({
    loadMapData: vi.fn(),
    saveMapData: vi.fn(),
}));

vi.mock('../ui/logService.js', () => ({
    addEntry: vi.fn(),
}));

import * as mapsService from './mapsService.js';
import { addEntry } from '../ui/logService.js';
import { generateDungeon, generateAdjacentDungeon } from './dungeonGenerator.js';
import { generateHexTerrain } from './hexTerrainGenerator.js';
import {
    describeGenerationOpts,
    buildRegeneratedDocument,
    regenerateMapDocument,
} from './regenerateMap.js';

const CAMPAIGN = 'test-campaign';
const ADJACENT_OPTS = {
    mode: 'adjacent',
    roomSize: 'standard',
    gridSize: 20,
    density: 0.5,
    seed: 42,
    roomCount: 8,
    corridorLength: 'compact',
    layoutStyle: 'balanced',
    minRoom: 4,
    maxRoom: 9,
};
const BSP_OPTS = { mode: 'bsp', gridSize: 30, density: 0.5, seed: 42 };
const TERRAIN_OPTS = { mode: 'terrain', gridSize: 30, seed: 7 };

const storedDoc = (overrides) => ({
    displayName: 'Gen Cave',
    name: 'gen-cave',
    type: 'indoor',
    gridSize: 20,
    walls: ['9,9'],
    placedItems: [],
    paintCells: [],
    items: [],
    players: [{ id: 'elderpaladin', name: 'ElderPaladin', gridX: 2, gridY: 2 }],
    fog: [],
    generationMode: 'adjacent',
    description: 'Authored blurb',
    seed: 42,
    generationOpts: ADJACENT_OPTS,
    createdAt: '2026-11-12T00:00:00.000Z',
    zoom: 1.5,
    panX: 10,
    panY: 20,
    ...overrides,
});

const storedOutdoorDoc = () => ({
    displayName: 'Gen Field',
    name: 'gen-field',
    type: 'outdoor',
    gridSize: 30,
    terrain: { '0,0': 'forest' },
    rivers: ['old'],
    pois: [{ id: 'poi-1', label: 'Ruins' }],
    seed: 7,
    generationOpts: TERRAIN_OPTS,
    partyPosition: { q: 30, r: 15 },
    zoom: 1,
    panX: 0,
    panY: 0,
    createdAt: '2026-11-12T00:00:00.000Z',
});

beforeEach(() => {
    vi.resetAllMocks();
    mapsService.saveMapData.mockResolvedValue({ message: 'Map saved successfully' });
    addEntry.mockResolvedValue({});
});

describe('regenerateMapDocument — generator dispatch with stamped opts verbatim', () => {
    it('Room Adjacent stamp re-runs generateAdjacentDungeon with the whole stamped object', async () => {
        mapsService.loadMapData.mockResolvedValue(storedDoc());
        await regenerateMapDocument(CAMPAIGN, 'gen-cave.json', ADJACENT_OPTS);
        expect(generateAdjacentDungeon).toHaveBeenCalledTimes(1);
        expect(generateAdjacentDungeon).toHaveBeenCalledWith(ADJACENT_OPTS);
        expect(generateDungeon).not.toHaveBeenCalled();
        expect(generateHexTerrain).not.toHaveBeenCalled();
    });

    it('BSP stamp re-runs generateDungeon with the whole stamped object', async () => {
        mapsService.loadMapData.mockResolvedValue(storedDoc({ generationOpts: BSP_OPTS }));
        await regenerateMapDocument(CAMPAIGN, 'gen-cave.json', BSP_OPTS);
        expect(generateDungeon).toHaveBeenCalledTimes(1);
        expect(generateDungeon).toHaveBeenCalledWith(BSP_OPTS);
        expect(generateAdjacentDungeon).not.toHaveBeenCalled();
    });

    it('Terrain stamp re-runs generateHexTerrain with the whole stamped object', async () => {
        mapsService.loadMapData.mockResolvedValue(storedOutdoorDoc());
        await regenerateMapDocument(CAMPAIGN, 'gen-field.json', TERRAIN_OPTS);
        expect(generateHexTerrain).toHaveBeenCalledTimes(1);
        expect(generateHexTerrain).toHaveBeenCalledWith(TERRAIN_OPTS);
        expect(generateDungeon).not.toHaveBeenCalled();
    });

    it('unknown mode fails loudly with zero writes and zero log rows', async () => {
        mapsService.loadMapData.mockResolvedValue(storedDoc());
        await expect(
            regenerateMapDocument(CAMPAIGN, 'gen-cave.json', { mode: 'vortex', gridSize: 20, seed: 1 }),
        ).rejects.toThrow('unknown generation mode');
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });
});

describe('regenerateMapDocument — PUT preserves identity, replaces layout', () => {
    it('PUTs onto the SAME doc keeping every identity field', async () => {
        const doc = storedDoc();
        mapsService.loadMapData.mockResolvedValue(doc);
        await regenerateMapDocument(CAMPAIGN, 'gen-cave.json', ADJACENT_OPTS);

        expect(mapsService.saveMapData).toHaveBeenCalledTimes(1);
        const [campaign, fileName, body] = mapsService.saveMapData.mock.calls[0];
        expect(campaign).toBe(CAMPAIGN);
        expect(fileName).toBe('gen-cave.json');
        // Identity fields survive verbatim…
        expect(body.name).toBe('gen-cave');
        expect(body.displayName).toBe('Gen Cave');
        expect(body.createdAt).toBe(doc.createdAt);
        expect(body.description).toBe('Authored blurb');
        expect(body.players).toEqual(doc.players);
        expect(body.generationOpts).toEqual(ADJACENT_OPTS);
        expect(body.seed).toBe(42);
        // …view state too (the generator's reset-to-defaults values must NOT leak).
        expect(body.zoom).toBe(1.5);
        expect(body.panX).toBe(10);
        expect(body.panY).toBe(20);
        // Generated layout fields are replaced by fresh generator output.
        expect(body.walls).toEqual(['0,0', '1,0']);
        expect(body.placedItems).toEqual(dungeonOutput('adjacent').placedItems);
        expect(body.generationMode).toBe('adjacent');
        // The generator's flavor name/description never overwrite the authored ones.
        expect(body.name).not.toBe('Squelching Cave');
        expect(body.description).not.toBe('A dank generated den.');
    });

    it('terrain PUT replaces terrain/rivers and keeps pois/partyPosition', async () => {
        mapsService.loadMapData.mockResolvedValue(storedOutdoorDoc());
        await regenerateMapDocument(CAMPAIGN, 'gen-field.json', TERRAIN_OPTS);

        const [, , body] = mapsService.saveMapData.mock.calls[0];
        expect(body.terrain).toEqual({ '0,0': 'grass', '1,1': 'water' });
        expect(body.rivers).toEqual(['1,1', '2,1']);
        expect(body.pois).toEqual([{ id: 'poi-1', label: 'Ruins' }]);
        expect(body.partyPosition).toEqual({ q: 30, r: 15 });
        expect(body.generationOpts).toEqual(TERRAIN_OPTS);
        expect(body.seed).toBe(7);
        expect('walls' in body).toBe(false);
    });

    it('a successful regenerate writes exactly ONE audit row naming the map', async () => {
        mapsService.loadMapData.mockResolvedValue(storedDoc());
        await regenerateMapDocument(CAMPAIGN, 'gen-cave.json', ADJACENT_OPTS);

        expect(addEntry).toHaveBeenCalledTimes(1);
        const [campaign, entry] = addEntry.mock.calls[0];
        expect(campaign).toBe(CAMPAIGN);
        expect(entry.type).toBe('map_regenerated');
        expect(entry.map).toBe('Gen Cave');
        expect(entry.mode).toBe('adjacent');
        expect(entry.seed).toBe(42);
        expect(entry.description).toContain('Gen Cave');
        expect(entry.description).toContain('Room Adjacent');
    });

    it('a failed doc read writes nothing (no PUT, no log row)', async () => {
        mapsService.loadMapData.mockRejectedValue(new Error('Failed to load map data'));
        await expect(
            regenerateMapDocument(CAMPAIGN, 'gen-cave.json', ADJACENT_OPTS),
        ).rejects.toThrow('Failed to load map data');
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
    });

    it('a failed PUT writes no log row', async () => {
        mapsService.loadMapData.mockResolvedValue(storedDoc());
        mapsService.saveMapData.mockRejectedValue(new Error('Failed to save map data'));
        await expect(
            regenerateMapDocument(CAMPAIGN, 'gen-cave.json', ADJACENT_OPTS),
        ).rejects.toThrow('Failed to save map data');
        expect(addEntry).not.toHaveBeenCalled();
    });
});

describe('buildRegeneratedDocument', () => {
    it('returns a new object and leaves the stored doc untouched', () => {
        const doc = storedDoc();
        const next = buildRegeneratedDocument(doc, ADJACENT_OPTS);
        expect(next).not.toBe(doc);
        expect(doc.walls).toEqual(['9,9']);
        expect(next.walls).toEqual(['0,0', '1,0']);
    });
});

describe('describeGenerationOpts — read-only tooltip copy', () => {
    it('adjacent stamp reads human-readably with every mode-specific key', () => {
        expect(describeGenerationOpts(ADJACENT_OPTS)).toBe(
            'Generated with: Mode: Room Adjacent · Seed: 42 · Grid size: 20 · '
            + 'Density: 50% · Room size: Standard · Rooms: 8 · Room bounds: 4-9 · '
            + 'Corridors: Compact · Layout: Balanced',
        );
    });

    it('bsp stamp covers mode/seed/grid/density', () => {
        expect(describeGenerationOpts(BSP_OPTS)).toBe(
            'Generated with: Mode: BSP Dungeon · Seed: 42 · Grid size: 30 · Density: 50%',
        );
    });

    it('terrain stamp covers mode/seed/grid and nothing invented', () => {
        expect(describeGenerationOpts(TERRAIN_OPTS)).toBe(
            'Generated with: Mode: Terrain · Seed: 7 · Grid size: 30',
        );
    });

    it('absent stamp yields null so the caller shows the honest legacy face', () => {
        expect(describeGenerationOpts(null)).toBeNull();
        expect(describeGenerationOpts(undefined)).toBeNull();
    });
});
