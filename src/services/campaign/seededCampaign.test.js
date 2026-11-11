// @maintained-by-ai
// ─── Lane: seeded-campaign orchestrator (arena-starter plan §2/§3/§6) ───────
// The orchestrator must RE-USE the existing generators/services, so every
// collaborator here is spied: assertions cover WHICH lane each seeded entity
// rides (maps → createMap/saveMapData/activateMap, encounters →
// saveEncounter with bestiary-resolved rows, quests/settlement/seed → their
// CRUD services) plus the arena carve geometry and the regenerate re-pointing.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  createSeededCampaign,
  regenerateAdventure,
  carveArena,
  CLASSIC_MONSTERS,
} from './seededCampaign.js';
import * as mapsService from '../maps/mapsService.js';
import { saveEncounter, updateEncounter } from '../encounters/encountersService.js';
import { generateSettlement } from './settlementGenerator.js';
import { saveSettlement, loadSettlement } from './settlementsService.js';
import { saveQuests, loadQuests } from './questsService.js';
import { loadStarterSeed, saveStarterSeed } from './starterSeedService.js';

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
  mapsService.loadMapData.mockResolvedValue({ name: 'wilds', type: 'outdoor', pois: [] });
});

// ---------------------------------------------------------------------------
// carveArena geometry
// ---------------------------------------------------------------------------
describe('carveArena', () => {
  const arena = carveArena({
    gridSize: 24,
    walls: ['3,3', '8,10', '12,12', '5,5', '0,11', '0,12', '23,11', '23,12'],
    placedItems: [
      { id: 'chest-1', gridX: 10, gridY: 10, type: 'chest' },   // hall → dropped
      { id: 'torch-1', gridX: 2, gridY: 2, type: 'torch' },     // ring → kept
    ],
  });
  const wallSet = new Set(arena.walls);

  it('empties the central hall of walls and props', () => {
    expect(wallSet.has('8,10')).toBe(false);
    expect(wallSet.has('12,12')).toBe(false);
    expect(arena.placedItems.map(i => i.id)).toEqual(['torch-1']);
  });

  it('re-stamps a solid perimeter ring', () => {
    expect(wallSet.has('11,0')).toBe(true);
    expect(wallSet.has('11,23')).toBe(true);
    expect(wallSet.has('0,5')).toBe(true);
    expect(wallSet.has('23,18')).toBe(true);
  });

  it('opens exactly the two side entrances', () => {
    expect(wallSet.has('0,11')).toBe(false);
    expect(wallSet.has('0,12')).toBe(false);
    expect(wallSet.has('23,11')).toBe(false);
    expect(wallSet.has('23,12')).toBe(false);
    expect(wallSet.has('0,10')).toBe(true);
    expect(wallSet.has('23,14')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// createSeededCampaign — shared entry
// ---------------------------------------------------------------------------
describe('createSeededCampaign', () => {
  it('rejects an unknown preset before any network call', async () => {
    await expect(createSeededCampaign('nope', { name: 'x' })).rejects.toThrow(/Unknown seeded-campaign preset/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('surfaces the server 403 lock message verbatim and seeds nothing', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({ error: 'Campaign creation is locked to test-campaign' }),
    });
    await expect(createSeededCampaign('arena', { name: 'Frostfall' }))
      .rejects.toThrow('Campaign creation is locked to test-campaign');
    expect(mapsService.createMap).not.toHaveBeenCalled();
  });

  it('POSTs /api/campaigns with the trimmed name and returns {name, seed, seeded}', async () => {
    const result = await createSeededCampaign('arena', { name: ' qa-arena ', seed: 7 });
    expect(fetchMock).toHaveBeenCalledWith('/api/campaigns', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ campaignName: 'qa-arena' });
    expect(result.name).toBe('qa-arena');
    expect(result.seed).toBe(7);
    expect(result.seeded.maps.length).toBe(2);
    expect(result.seeded.encounters).toHaveLength(3);
  });

  it('records the preset type via the campaign-meta lane after the folder POST', async () => {
    await createSeededCampaign('arena', { name: 'qa-arena', seed: 7 });
    expect(fetchMock).toHaveBeenCalledWith('/api/campaigns/qa-arena/meta',
      expect.objectContaining({ method: 'PUT' }));
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ type: 'arena' });

    fetchMock.mockClear();
    await createSeededCampaign('starter', { name: 'qa-starter', seed: 7 });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ type: 'starter' });
  });

  it('still seeds the campaign when the meta write fails (badge-only loss)', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockImplementation(async (url, opts) => (
      opts?.method === 'PUT'
        ? { ok: false, status: 403, statusText: 'Forbidden', json: async () => ({ error: 'locked' }) }
        : { ok: true, json: async () => ({ message: 'created' }) }
    ));
    const result = await createSeededCampaign('arena', { name: 'qa-arena', seed: 7 });
    expect(result.seeded.maps.length).toBe(2);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it('reproduces the same roll from the same seed', async () => {
    const a = await createSeededCampaign('arena', { name: 'qa-arena', seed: 11 });
    const firstDocs = mapsService.saveMapData.mock.calls.map(c => JSON.stringify(c[2].walls));
    vi.clearAllMocks();
    fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ message: 'created' }) }));
    const b = await createSeededCampaign('arena', { name: 'qa-arena2', seed: 11 });
    const secondDocs = mapsService.saveMapData.mock.calls.map(c => JSON.stringify(c[2].walls));
    expect(secondDocs).toEqual(firstDocs);
    expect(a.seeded).toEqual(b.seeded);
  });
});

// ---------------------------------------------------------------------------
// ARENA preset
// ---------------------------------------------------------------------------
describe('arena preset', () => {
  beforeEach(async () => {
    await createSeededCampaign('arena', { name: 'qa-arena', seed: 3 });
  });

  it('creates two carved indoor maps and activates the first', () => {
    const created = mapsService.createMap.mock.calls.map(c => c[1]);
    expect(created).toEqual(['The Sparring Hall', 'The Colosseum Pit']);
    expect(mapsService.createMap).toHaveBeenCalledWith('qa-arena', 'The Sparring Hall',
      expect.objectContaining({ type: 'indoor', gridSize: 24 }));
    expect(mapsService.activateMap).toHaveBeenCalledWith('qa-arena', 'The Sparring Hall');
    // Seeded docs carry walls (carved) and empty players.
    const doc = mapsService.saveMapData.mock.calls[0][2];
    expect(doc.walls.length).toBeGreaterThan(0);
    expect(doc.players).toEqual([]);
  });

  it('pins sparring-pit flavor on both arena maps — never dungeon-decay prose', () => {
    for (const call of mapsService.saveMapData.mock.calls) {
      expect(call[2].description.toLowerCase()).not.toMatch(/dungeon|traps and guardians|ancient evil/);
    }
    expect(mapsService.saveMapData.mock.calls[1][2].description).toContain('fighting pit');
  });

  it('seeds three sparring encounters with bestiary-resolved creature rows', () => {
    expect(saveEncounter).toHaveBeenCalledTimes(3);
    const [campaign, name, data] = saveEncounter.mock.calls[0];
    expect(campaign).toBe('qa-arena');
    expect(name).toBe('Sparring — Goblin Pack');
    expect(data.selectedMonsters.map(m => m.name)).toEqual(['Goblin', 'Kobold']);
    const goblin = data.creatures.find(c => c.name === 'Goblin 1');
    expect(goblin).toMatchObject({ type: 'monster', ac: 15, hp: 7, maxHp: 7, speed: 30, initBonus: 2 });
    // Every creature name is a CLASSIC_MONSTERS base (Encounter Builder resolves real stats).
    for (const call of saveEncounter.mock.calls) {
      for (const ref of call[2].selectedMonsters) {
        expect(CLASSIC_MONSTERS).toContain(ref.name);
      }
    }
  });

  it('stays lean: no quests, settlements, factions, or NPCs', () => {
    expect(saveQuests).not.toHaveBeenCalled();
    expect(saveSettlement).not.toHaveBeenCalled();
    expect(saveStarterSeed).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// STARTER preset
// ---------------------------------------------------------------------------
describe('starter preset', () => {
  let result;
  beforeEach(async () => {
    result = await createSeededCampaign('starter', { name: 'qa-starter', seed: 5 });
  });

  it('seeds a village settlement whose rumors reference the current adventure layer', async () => {
    const roll = await createSeededCampaign('starter', { name: 'qa-starter', seed: 5 });
    expect(generateSettlement).toHaveBeenCalledWith([], expect.objectContaining({ size: 'village' }));
    const saved = saveSettlement.mock.calls[0][1];
    expect(saved.name).toBe('Thornhollow');
    expect(saved.rumors.join(' ')).toContain(roll.seeded.seed.entities.dungeonTitle);
  });

  it('creates the dungeon map and an outdoor hex map with settlement + dungeon POIs', () => {
    const outdoorCall = mapsService.createMap.mock.calls.find(c => c[2].type === 'outdoor');
    expect(outdoorCall).toBeTruthy();
    const [, hexName, opts] = outdoorCall;
    expect(hexName).toBe('Thornhollow Countryside');
    expect(opts.gridSize).toBe(12);
    expect(Object.keys(opts.terrain).length).toBeGreaterThan(0);
    const poiByName = Object.fromEntries(opts.pois.map(p => [p.id, p]));
    expect(poiByName['poi-settlement'].label).toBe('Thornhollow');
    expect(poiByName['poi-dungeon'].type).toBe('dungeon');
    expect(poiByName['poi-dungeon'].linkedMap).toBe(result.seeded.maps[1].slug);
    // POIs land on dry land, apart from each other.
    for (const poi of opts.pois) {
      expect(['water', 'beach']).not.toContain(opts.terrain[`${poi.q},${poi.r}`]);
    }
    expect(mapsService.activateMap).toHaveBeenCalledWith('qa-starter', hexName);

    // Party marker sits ON the settlement hex (§4.1-3), stamped via the doc save.
    const hexSave = mapsService.saveMapData.mock.calls.find(c => c[1] === hexName);
    expect(hexSave[2].partyPosition).toEqual({ q: poiByName['poi-settlement'].q, r: poiByName['poi-settlement'].r });
  });

  it('seeds three quests naming the generated settlement + dungeon', () => {
    expect(saveQuests).toHaveBeenCalledTimes(1);
    const quests = saveQuests.mock.calls[0][1];
    expect(quests).toHaveLength(3);
    const joined = JSON.stringify(quests);
    expect(joined).toContain('Thornhollow');
    expect(joined).toContain(result.seeded.seed.entities.dungeonTitle);
    expect(quests.every(q => q.id && q.status === 'active')).toBe(true);
    // Fresh-create rows must NOT carry updatedAt echoes (live 409 pin): the
    // jsonEntityCrud guard reads a stamped row disk lacks as a resurrection.
    expect(quests.every(q => q.updatedAt === undefined)).toBe(true);
  });

  it('seeds Dungeon Wave 1-3 from the classics and persists the rolling seed', () => {
    expect(saveEncounter).toHaveBeenCalledTimes(3);
    expect(saveEncounter.mock.calls.map(c => c[1]))
      .toEqual(['Dungeon Wave 1', 'Dungeon Wave 2', 'Dungeon Wave 3']);
    for (const call of saveEncounter.mock.calls) {
      for (const ref of call[2].selectedMonsters) expect(CLASSIC_MONSTERS).toContain(ref.name);
    }
    expect(saveStarterSeed).toHaveBeenCalledWith('qa-starter', expect.objectContaining({
      version: 1,
      seed: 5,
    }));
    const doc = saveStarterSeed.mock.calls[0][1];
    expect(doc.entities.settlement).toBe('Thornhollow');
    expect(doc.layer).toBe(1);
    expect(doc.entities.encounters).toEqual(['Dungeon Wave 1', 'Dungeon Wave 2', 'Dungeon Wave 3']);
    expect(result.seeded.settlement).toBe('Thornhollow');
  });
});

// ---------------------------------------------------------------------------
// regenerateAdventure
// ---------------------------------------------------------------------------
describe('regenerateAdventure', () => {
  const seedDoc = {
    version: 1,
    seed: 99,
    layer: 2,
    createdAt: 1,
    regeneratedAt: null,
    entities: {
      settlement: 'Thornhollow',
      hexMap: { name: 'Thornhollow Countryside', slug: 'thornhollow-countryside' },
      dungeonMap: { name: 'Old Keep', slug: 'old-keep' },
      dungeonTitle: 'Old Keep',
      // A title retired by an earlier regeneration must ALSO be swapped out of
      // every flavor row (rumors/quests) — history lives on the seed doc.
      pastTitles: ['Elder Tomb'],
      quests: ['Starter — Into the Ruins', 'Starter — Trouble in Town', 'Starter — The Spoils'],
      encounters: ['Dungeon Wave 1', 'Dungeon Wave 2', 'Dungeon Wave 3'],
    },
  };

  beforeEach(() => {
    loadStarterSeed.mockResolvedValue(seedDoc);
    loadQuests.mockResolvedValue([
      { name: 'Starter — Into the Ruins', status: 'active', description: 'Raid Old Keep.', rewards: 'Gold in Old Keep', notes: 'Starter main quest — dungeon: Old Keep' },
      { name: 'Starter — Trouble in Town', status: 'active', description: 'Tales of Elder Tomb linger in town.', rewards: '', notes: 'side' },
    ]);
    mapsService.loadMapData.mockResolvedValue({
      name: 'thornhollow-countryside', type: 'outdoor', pois: [
        { id: 'poi-settlement', label: 'Thornhollow', q: 6, r: 4, visible: true },
        { id: 'poi-dungeon', label: 'Old Keep', q: 2, r: 8, visible: true, linkedMap: 'old-keep' },
      ],
    });
    loadSettlement.mockResolvedValue({ settlement: { name: 'Thornhollow', rumors: ['Raiders from Old Keep prowl the road.', 'Good ale at the inn.'] } });
  });

  it('refuses a campaign without a starter seed', async () => {
    loadStarterSeed.mockResolvedValueOnce(null);
    await expect(regenerateAdventure('test-campaign'))
      .rejects.toThrow(/Not a starter campaign/);
    expect(mapsService.createMap).not.toHaveBeenCalled();
  });

  it('re-rolls the dungeon, re-points the portal + main quest, and retires the old map', async () => {
    const result = await regenerateAdventure('qa-starter');
    expect(result.dungeonTitle).toBeTruthy();
    expect(result.dungeonTitle).not.toBe('Old Keep');

    // New dungeon map file created + persisted.
    const dungeonCreate = mapsService.createMap.mock.calls.find(c => c[2].type === 'indoor');
    expect(dungeonCreate[1]).toBe(result.dungeonTitle);

    // Hex POI re-pointed at the new slug + label, settlement POI untouched.
    const hexPut = mapsService.saveMapData.mock.calls.find(c => c[1] === 'thornhollow-countryside');
    const poiByName = Object.fromEntries(hexPut[2].pois.map(p => [p.id, p]));
    expect(poiByName['poi-dungeon'].label).toBe(result.dungeonTitle);
    expect(poiByName['poi-dungeon'].linkedMap).toBe(result.dungeonMap.slug);
    expect(poiByName['poi-settlement'].label).toBe('Thornhollow');

    // Old dungeon file deleted; waves rewritten via the update lane.
    expect(mapsService.deleteMap).toHaveBeenCalledWith('qa-starter', 'old-keep');
    expect(updateEncounter).toHaveBeenCalledTimes(3);
    expect(saveEncounter).not.toHaveBeenCalled();

    // Main quest references only the new title; side quest untouched.
    const quests = saveQuests.mock.calls[0][1];
    const main = quests.find(q => q.name === 'Starter — Into the Ruins');
    const side = quests.find(q => q.name === 'Starter — Trouble in Town');
    expect(main.description).toContain(result.dungeonTitle);
    expect(main.description).not.toContain('Old Keep');
    expect(main.rewards).toContain(result.dungeonTitle);
    expect(main.notes).toBe(`Starter main quest — dungeon: ${result.dungeonTitle}`);
    // Layer-1 title (Elder Tomb) is swapped out of the side quest too.
    expect(side.description).toContain(result.dungeonTitle);
    expect(side.description).not.toContain('Elder Tomb');

    // Seed rewritten: new roll + title, settlement preserved.
    const doc = saveStarterSeed.mock.calls[0][1];
    expect(doc.seed).not.toBe(99);
    expect(doc.layer).toBe(3); // 2 → 3 (§4.1 layer bump)
    expect(doc.entities.pastTitles).toEqual(expect.arrayContaining(['Old Keep', 'Elder Tomb']));
    expect(doc.entities.dungeonTitle).toBe(result.dungeonTitle);
    expect(doc.entities.settlement).toBe('Thornhollow');
    expect(doc.regeneratedAt).toBeGreaterThan(0);
    expect(result.preserved.settlement).toBe('Thornhollow');

    // Layer rumor re-pointed at the new dungeon; unrelated rumors byte-kept.
    const savedSettlement = saveSettlement.mock.calls.find(c => c[1]?.rumors)?.[1];
    expect(savedSettlement.rumors[0]).toContain(result.dungeonTitle);
    expect(savedSettlement.rumors[0]).not.toContain('Old Keep');
    expect(savedSettlement.rumors[1]).toBe('Good ale at the inn.');
  });

  // Backlog 2026-11-11: the destructive regenerate used to leave the campaign
  // log silent — exactly ONE adventure_regenerated row must name the retired
  // title(s) → the new one via the shared POST /log lane (server addEntry).
  it('writes exactly one adventure_regenerated audit row naming old → new titles', async () => {
    const result = await regenerateAdventure('qa-starter');
    const logPosts = fetchMock.mock.calls.filter(([url]) => url === '/api/campaigns/qa-starter/log');
    expect(logPosts).toHaveLength(1);
    const entry = JSON.parse(logPosts[0][1].body);
    expect(entry.type).toBe('adventure_regenerated');
    // Current title first, then the layer-1 history, then the fresh roll.
    expect(entry.description).toContain('Old Keep, Elder Tomb');
    expect(entry.description).toContain(`→ ${result.dungeonTitle}`);
    expect(entry.description).toContain('layer 3');
  });

  it('logs an honest initial-generation row when the seed doc has no previous title', async () => {
    loadStarterSeed.mockResolvedValueOnce({
      ...seedDoc,
      entities: { ...seedDoc.entities, dungeonTitle: null, pastTitles: undefined },
    });
    const result = await regenerateAdventure('qa-starter');
    const logPosts = fetchMock.mock.calls.filter(([url]) => url === '/api/campaigns/qa-starter/log');
    expect(logPosts).toHaveLength(1);
    const entry = JSON.parse(logPosts[0][1].body);
    expect(entry.type).toBe('adventure_regenerated');
    expect(entry.description).toContain('initial generation');
    expect(entry.description).toContain(result.dungeonTitle);
    // Never a misleading empty old-title ("… → New" with nothing before the arrow).
    expect(entry.description).not.toMatch(/^Adventure regenerated: ,/);
    expect(entry.description).not.toContain('Old Keep');
  });
});
