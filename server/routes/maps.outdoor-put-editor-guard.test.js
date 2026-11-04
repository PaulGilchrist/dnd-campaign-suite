// @maintained-by-ai
// ─── Lane: outdoor PUT editor-scope differential (bug-lan-player-terrain-paint-persists) ─
// The PUT outdoor branch used to skip refuseUnlessGm ENTIRELY, so a LAN tab
// could arm hex Paint terrain and persistently rewrite terrain/pois/roads/
// rivers/gridSize on the shared document (live two-tab proof: PUT 200, disk
// terrain 5→6 cells, broadcast to every client) while the twin indoor PUT 403d.
// The fix keeps the narrow all-tab party-travel lane open (partyPosition /
// travelState / marchingOrder / zoom / pan / weather) but rejects any
// EDITOR-field delta (terrain/rivers/roads/pois/gridSize/draft) from a foreign
// Host with the canonical GM-only 403, deny-safe when nothing is stored.
// Mirrors maps-create-localhost-guard.test.js (foreign-Host via .set('Host')).
import express from 'express';
import fs from 'fs';
import { request } from '../test-utils/localhostSupertest.js';
import maps from './maps.js';

const mockFsState = { exists: new Set(), files: new Map() };
let publishedEvents = [];

vi.mock('fs', () => {
    const impl = {
        existsSync: vi.fn((p) => mockFsState.exists.has(p) || mockFsState.files.has(p)),
        mkdirSync: vi.fn((p) => { mockFsState.exists.add(p); }),
        writeFileSync: vi.fn((p, data) => { mockFsState.files.set(p, data); }),
        readFileSync: vi.fn((p) => {
            if (mockFsState.files.has(p)) return mockFsState.files.get(p);
            throw new Error('ENOENT');
        }),
        unlinkSync: vi.fn((p) => { mockFsState.files.delete(p); }),
    };
    return { default: impl, ...impl };
});

vi.mock('../utils/campaignPaths.js', () => ({
    campaignMapsDir: (name) => `/mock/campaigns/${name}/maps`,
    normalizeMapFile: (name) => (name.endsWith('.json') ? name : `${name}.json`),
}));

vi.mock('../utils/changeData.js', () => ({
    warnIfNewTopLevelKey: vi.fn(),
    publish: vi.fn((key, data, campaign) => { publishedEvents.push({ key, data, campaign }); }),
    activeMaps: new Map(),
    characterChangeData: new Map(),
    markDirty: vi.fn(),
}));

const FOREIGN_HOST = '192.168.0.224';
const MAPS_DIR = '/mock/campaigns/test-campaign/maps';
const HEX_FILE = `${MAPS_DIR}/north-reach.json`;

// Stored outdoor document as the GET/HexMap loader would hand it out: the
// builder-created file has NO rivers/weather/draft keys (guard normalization
// must treat those as empty, not as a delta).
const STORED_HEX = {
    displayName: 'North Reach',
    name: 'north-reach',
    type: 'outdoor',
    gridSize: 8,
    terrain: { '0,0': 'plains', '1,0': 'forest' },
    pois: [{ id: 'poi-1', type: 'city', label: 'Village', q: 2, r: 2, visible: true }],
    zoom: 1,
    panX: 0,
    panY: 0,
};

// The exact 14-key envelope hex useMapLoader.buildHexEnvelope PUTs.
function hexEnvelope(overrides = {}) {
    return {
        type: 'outdoor',
        displayName: 'North Reach',
        gridSize: 8,
        terrain: { '0,0': 'plains', '1,0': 'forest' },
        rivers: [],
        roads: [],
        pois: STORED_HEX.pois,
        zoom: 1,
        panX: 0,
        panY: 0,
        marchingOrder: [],
        partyPosition: { q: 8, r: 4 },
        weather: null,
        travelState: null,
        ...overrides,
    };
}

function createTestApp() {
    const app = express();
    app.use(express.json());
    app.use(maps);
    return app;
}

function seedHexDoc() {
    mockFsState.exists.add(MAPS_DIR);
    mockFsState.files.set(HEX_FILE, JSON.stringify(STORED_HEX));
}

beforeEach(() => {
    mockFsState.exists.clear();
    mockFsState.files.clear();
    publishedEvents = [];
    vi.clearAllMocks();
});

describe('maps PUT outdoor — editor-scope differential', () => {
    describe('non-localhost (network client)', () => {
        it('403s a terrain-paint delta and writes nothing (the filed bug)', async () => {
            seedHexDoc();
            const res = await request(createTestApp())
                .put('/api/campaigns/test-campaign/maps/north-reach')
                .set('Host', FOREIGN_HOST)
                .send(hexEnvelope({ terrain: { ...STORED_HEX.terrain, '6,2': 'plains' } }));

            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(fs.writeFileSync).not.toHaveBeenCalled();
            expect(publishedEvents).toHaveLength(0);
            expect(JSON.parse(mockFsState.files.get(HEX_FILE))).toEqual(STORED_HEX);
        });

        it.each([
            ['rivers', { rivers: ['3,3', '4,3'] }],
            ['roads', { roads: [{ id: 'r1', hexes: ['2,2', '3,3'] }] }],
            ['pois', { pois: [] }],
            ['gridSize', { gridSize: 10 }],
        ])('403s a %s delta too (every editor field is GM-only)', async (_field, overrides) => {
            seedHexDoc();
            const res = await request(createTestApp())
                .put('/api/campaigns/test-campaign/maps/north-reach')
                .set('Host', FOREIGN_HOST)
                .send(hexEnvelope(overrides));
            expect(res.status).toBe(403);
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        it('deny-safes a create-via-PUT onto a missing outdoor document', async () => {
            mockFsState.exists.add(MAPS_DIR); // file absent
            const res = await request(createTestApp())
                .put('/api/campaigns/test-campaign/maps/ghost-hex')
                .set('Host', FOREIGN_HOST)
                .send(hexEnvelope({ displayName: 'Ghost Hex', name: 'ghost-hex' }));
            expect(res.status).toBe(403);
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });

        it('still accepts the party-travel lane (party marker / travelState / view drift) — 200 + persist', async () => {
            seedHexDoc();
            const res = await request(createTestApp())
                .put('/api/campaigns/test-campaign/maps/north-reach')
                .set('Host', FOREIGN_HOST)
                .send(hexEnvelope({
                    panX: -40,
                    panY: 12,
                    zoom: 1.5,
                    partyPosition: { q: 9, r: 4 },
                    marchingOrder: ['AasimarTest'],
                    travelState: { travelMode: 'planning', path: ['9,4', '10,4'] },
                    weather: { label: 'Clear', budgetMod: 1 },
                }));

            expect(res.status).toBe(200);
            const saved = JSON.parse(mockFsState.files.get(HEX_FILE));
            expect(saved.panX).toBe(-40);
            expect(saved.travelState).toEqual({ travelMode: 'planning', path: ['9,4', '10,4'] });
            expect(saved.terrain).toEqual(STORED_HEX.terrain); // editor bytes echo unchanged
            expect(publishedEvents.some(e => e.key === 'map-data-test-campaign-north-reach')).toBe(true);
        });

        it('treats missing stored rivers/weather as empty (a plain echo never 403s)', async () => {
            seedHexDoc();
            const res = await request(createTestApp())
                .put('/api/campaigns/test-campaign/maps/north-reach')
                .set('Host', FOREIGN_HOST)
                .send(hexEnvelope({ panY: 5 }));
            expect(res.status).toBe(200);
        });

        it('keeps refusing indoor documents outright (control)', async () => {
            mockFsState.exists.add(MAPS_DIR);
            mockFsState.files.set(`${MAPS_DIR}/test-map.json`, JSON.stringify({ displayName: 'Test Map', type: 'indoor', players: [] }));
            const res = await request(createTestApp())
                .put('/api/campaigns/test-campaign/maps/test-map')
                .set('Host', FOREIGN_HOST)
                .send({ type: 'indoor', gridSize: 20, players: [] });
            expect(res.status).toBe(403);
            expect(res.body.error).toBe('Access denied: GM-only feature');
            expect(fs.writeFileSync).not.toHaveBeenCalled();
        });
    });

    describe('localhost (GM)', () => {
        it('still persists terrain/rivers/roads/pois/gridSize edits', async () => {
            seedHexDoc();
            const painted = { ...STORED_HEX.terrain, '6,2': 'plains' };
            const res = await request(createTestApp())
                .put('/api/campaigns/test-campaign/maps/north-reach')
                .set('Host', 'localhost')
                .send(hexEnvelope({ terrain: painted, rivers: ['3,3', '4,3'], gridSize: 9 }));

            expect(res.status).toBe(200);
            const saved = JSON.parse(mockFsState.files.get(HEX_FILE));
            expect(saved.terrain).toEqual(painted);
            expect(saved.rivers).toEqual(['3,3', '4,3']);
            expect(saved.gridSize).toBe(9);
        });
    });
});
