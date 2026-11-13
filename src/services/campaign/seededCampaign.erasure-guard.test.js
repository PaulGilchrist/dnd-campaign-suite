// @maintained-by-ai
// ─── Lane: seed-lane PUT body vs the server map-PUT guards ──────────────────
// bug-erase-guard-breaks-seeded-campaign-create: `persistDungeonMap()` POSTs a
// full indoor doc (type/gridSize/walls/placedItems all armed on disk) then
// PUTs the RAW generateDungeon()/carveArena() output — which has no `type` —
// so the generalized whole-map erasure guard (shipped 625db8fae) 400'd every
// seeded dungeon: arena/starter quick-create half-seeded and Regenerate
// adventure died. The fix stamps `type: 'indoor'` on the PUT body; these pins
// run the REAL seed lanes and assert every map-doc PUT body passes BOTH
// server guards (erasure + players-clobber) against the document the create
// route stores, and pin the regression itself (raw generator output alone
// still trips the guard — the fix must live client-side).
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createSeededCampaign, regenerateAdventure } from './seededCampaign.js';
import * as mapsService from '../maps/mapsService.js';
import { generateDungeon } from '../maps/dungeonGenerator.js';
import { wholeMapErasureError, erasesStoredPlayers } from '../../../server/routes/maps.js';
import { loadStarterSeed } from './starterSeedService.js';
import { loadQuests } from './questsService.js';
import { loadSettlement } from './settlementsService.js';

// Mock set mirrors seededCampaign.test.js (spied collaborators so the lanes
// run end-to-end without a server).
vi.mock('../maps/mapsService.js', () => ({
  toKebabCase: (n) => n.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
  createMap: vi.fn(async () => ({ name: 'm', fileName: 'm.json', slug: 'm' })),
  saveMapData: vi.fn(async () => ({ message: 'ok' })),
  loadMapData: vi.fn(async () => ({ name: 'wilds', type: 'outdoor', pois: [] })),
  activateMap: vi.fn(async () => ({ message: 'ok' })),
  deleteMap: vi.fn(async () => ({ message: 'ok' })),
}));

vi.mock('../encounters/encountersService.js', () => ({
  saveEncounter: vi.fn(async () => ({ message: 'ok' })),
  updateEncounter: vi.fn(async () => ({ message: 'ok' })),
}));

vi.mock('./settlementGenerator.js', () => ({
  generateSettlement: vi.fn(async () => ({
    name: 'Thornhollow',
    size: 'village',
    description: 'A quiet village.',
  })),
}));

vi.mock('./settlementsService.js', () => ({
  saveSettlement: vi.fn(async () => ({})),
  loadSettlement: vi.fn(async () => null),
}));
vi.mock('./questsService.js', () => ({
  saveQuests: vi.fn(async () => {}),
  loadQuests: vi.fn(async () => []),
}));
vi.mock('./starterSeedService.js', () => ({
  loadStarterSeed: vi.fn(async () => null),
  saveStarterSeed: vi.fn(async () => ({})),
}));
vi.mock('../ui/dataLoader.js', () => ({
  loadMonsters: vi.fn(async () => [
    { name: 'Goblin', index: 'goblin', armor_class: 15, hit_points: 7, speed: { walk: '30 ft.' }, ability_score_modifiers: { dex: 2 } },
    { name: 'Kobold', index: 'kobold', armor_class: 12, hit_points: 5, speed: { walk: '30 ft.' }, ability_score_modifiers: { dex: 2 } },
    { name: 'Skeleton', index: 'skeleton', armor_class: 14, hit_points: 13, speed: { walk: '30 ft.' }, initiative: 3 },
    { name: 'Zombie', index: 'zombie', armor_class: 8, hit_points: 15, speed: { walk: '20 ft.' }, initiative: -2 },
    { name: 'Wolf', index: 'wolf', armor_class: 12, hit_points: 11, speed: { walk: '40 ft.' }, initiative: 2 },
    { name: 'Bandit', index: 'bandit', armor_class: 12, hit_points: 11, speed: { walk: '30 ft.' }, initiative: 1 },
    { name: 'Orc', index: 'orc', armor_class: 13, hit_points: 15, speed: { walk: '30 ft.' }, ability_score_modifiers: { dex: 1 } },
    { name: 'Hobgoblin', index: 'hobgoblin', armor_class: 18, hit_points: 11, speed: { walk: '30 ft.' }, ability_score_modifiers: { dex: 1 } },
    { name: 'Bugbear', index: 'bugbear', armor_class: 16, hit_points: 27, speed: { walk: '30 ft.' }, ability_score_modifiers: { dex: 2 } },
    { name: 'Giant Spider', index: 'giant-spider', armor_class: 14, hit_points: 26, speed: { walk: '30 ft.' }, initiative: 3 },
  ]),
}));

const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ message: 'created' }) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ message: 'created' }) }));
  mapsService.createMap.mockResolvedValue({ name: 'm', fileName: 'm.json', slug: 'm' });
  mapsService.saveMapData.mockResolvedValue({ message: 'ok' });
  mapsService.loadMapData.mockResolvedValue({ name: 'wilds', type: 'outdoor', pois: [] });
});

// The document POST /maps stores for the seed lane's create body (mirrors the
// server buildIndoorMapData / buildOutdoorMapData whitelists — every guarded
// key present, players as an array).
const createdIndoorDoc = (mapName, gridSize) => ({
  displayName: mapName,
  name: mapName,
  type: 'indoor',
  gridSize,
  walls: [],
  placedItems: [],
  paintCells: [],
  items: [],
  players: [],
  fog: [],
  terrain: {},
  pois: [],
});
const createdOutdoorDoc = (mapName, gridSize) => ({
  displayName: mapName,
  name: mapName,
  type: 'outdoor',
  gridSize,
  terrain: {},
  pois: [],
  partyPosition: { q: 0, r: 0 },
});

// Assert one PUT body passes BOTH server guards against its stored doc.
function expectGuardsPass(storedDoc, body, isOutdoor) {
  expect(wholeMapErasureError(storedDoc, body, isOutdoor)).toBeNull();
  expect(erasesStoredPlayers(storedDoc, body)).toBe(false);
}

describe('seed dungeon PUT vs the whole-map erasure guard', () => {
  it('pins the regression: raw generator output alone trips the guard', () => {
    const raw = generateDungeon({ gridSize: 24, density: 0.55, seed: 3 });
    // The generator really does omit `type` — the client merge is the fix.
    expect(raw.type).toBeUndefined();
    const message = wholeMapErasureError(createdIndoorDoc('raw', raw.gridSize), raw, false);
    expect(message).toMatch(/^Map save rejected: a whole-map save must include the /);
    expect(message).toContain('"type"');
  });

  it('arena preset: both carved-hall PUT bodies pass the guards', async () => {
    await createSeededCampaign('arena', { name: 'qa-arena', seed: 3 });
    expect(mapsService.saveMapData).toHaveBeenCalledTimes(2);
    for (const [, mapName, body] of mapsService.saveMapData.mock.calls) {
      expect(body.type).toBe('indoor');
      expect(body.walls.length).toBeGreaterThan(0); // carved walls ride the same PUT
      expectGuardsPass(createdIndoorDoc(mapName, body.gridSize), body, false);
    }
  });

  it('starter preset: dungeon AND hex PUT bodies pass their per-type guards', async () => {
    await createSeededCampaign('starter', { name: 'qa-starter', seed: 5 });
    const dungeonPut = mapsService.saveMapData.mock.calls.find(([, , b]) => b.type === 'indoor');
    const hexPut = mapsService.saveMapData.mock.calls.find(([, , b]) => b.type === 'outdoor');
    expect(dungeonPut).toBeTruthy();
    expect(hexPut).toBeTruthy();
    expectGuardsPass(createdIndoorDoc(dungeonPut[1], dungeonPut[2].gridSize), dungeonPut[2], false);
    expectGuardsPass(createdOutdoorDoc(hexPut[1], hexPut[2].gridSize), hexPut[2], true);
  });

  it('regenerateAdventure: the fresh dungeon PUT body passes the guard', async () => {
    loadStarterSeed.mockResolvedValue({
      version: 1,
      seed: 99,
      layer: 1,
      createdAt: 1,
      regeneratedAt: null,
      entities: {
        settlement: 'Thornhollow',
        hexMap: { name: 'Thornhollow Countryside', slug: 'thornhollow-countryside' },
        dungeonMap: { name: 'Old Keep', slug: 'old-keep' },
        dungeonTitle: 'Old Keep',
        quests: ['Starter — Into the Ruins'],
        encounters: ['Dungeon Wave 1', 'Dungeon Wave 2', 'Dungeon Wave 3'],
      },
    });
    loadQuests.mockResolvedValue([]);
    loadSettlement.mockResolvedValue(null);
    const result = await regenerateAdventure('qa-starter');
    const dungeonPut = mapsService.saveMapData.mock.calls.find(([, , b]) => b.type === 'indoor');
    expect(dungeonPut).toBeTruthy();
    expect(dungeonPut[1]).toBe(result.dungeonTitle);
    expectGuardsPass(createdIndoorDoc(dungeonPut[1], dungeonPut[2].gridSize), dungeonPut[2], false);
  });
});
