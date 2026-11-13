/**
 * Seeded-campaign orchestrator (arena-starter plan §2/§3).
 *
 * One shared entry for BOTH quick-create flows:
 *   createSeededCampaign('arena' | 'starter', { name, seed })
 *     1. POST /api/campaigns { campaignName } (throws the server's message on
 *        a campaign-lock 403 so the UI can show why),
 *     2. PUT /api/campaigns/:name/meta { type } (badge lane — see
 *        campaignMetaService.js),
 *     3. runs the preset's seeding step against the fresh folder,
 *     4. returns { name, seeded } where `seeded` reports every created entity
 *        (maps / encounters / quests / settlement) for UI feedback.
 *
 * Everything below RE-USES the existing generators and services (dungeon,
 * hex terrain, settlement, encounter/quest/settlement/map CRUD) — no rule or
 * generation logic is duplicated here. Randomness comes from the same
 * mulberry32 the map generators use, so a roll is reproducible from its seed.
 *
 * `regenerateAdventure(campaignName)` (starter only) re-rolls the dungeon /
 * monsters / treasure layer: a brand-new dungeon map file, re-pointed hex
 * portal POI + main-quest link, and rewritten Wave 1-3 monster rows — while
 * settlement and party stay untouched (§3.2). One `adventure_regenerated`
 * audit row names old → new titles in the campaign log (backlog 2026-11-11:
 * the destructive op used to log nothing).
 */

import { mulberry32 } from '../maps/rng.js';
import { generateDungeon } from '../maps/dungeonGenerator.js';
import { generateHexTerrain } from '../maps/hexTerrainGenerator.js';
import { toKebabCase, createMap, saveMapData, loadMapData, activateMap, deleteMap } from '../maps/mapsService.js';
import { saveEncounter, updateEncounter } from '../encounters/encountersService.js';
import { generateSettlement } from './settlementGenerator.js';
import { saveSettlement, loadSettlement } from './settlementsService.js';
import { saveQuests, loadQuests } from './questsService.js';
import { loadStarterSeed, saveStarterSeed } from './starterSeedService.js';
import { saveCampaignType } from './campaignMetaService.js';
import { loadMonsters } from '../ui/dataLoader.js';
import { addEntry as addLogEntry } from '../ui/logService.js';

// ---------------------------------------------------------------------------
// Low-CR classics (arena-starter §1) — exact bestiary names so the Encounter
// Builder / getMonsterData lanes resolve real stats from monsters.json.
// ---------------------------------------------------------------------------
export const CLASSIC_MONSTERS = [
  'Skeleton', 'Goblin', 'Kobold', 'Zombie', 'Wolf',
  'Bandit', 'Orc', 'Hobgoblin', 'Bugbear', 'Giant Spider',
];

const ARENA_MAP_NAMES = ['The Sparring Hall', 'The Colosseum Pit'];

// Sparring-pit flavor assigned by index to ARENA_MAP_NAMES. generateDungeon
// draws dungeon-decay prose ("Traps and guardians still protect the dungeon's
// secrets") from the shared namegen pool — wrong theme for arena halls, so the
// arena preset overwrites the description (text only: names, grid sizes and
// RNG draw order stay byte-stable).
const ARENA_MAP_DESCRIPTIONS = [
  'A roofed drill hall with sand raked smooth across the floor. Weapon racks and padded posts stand ready along the walls for the next bout.',
  'An open-air fighting pit ringed by weathered stone benches. Sun-bleached sand at the center is scored with the scrapes of a hundred duels.',
];

const WAVE_MONSTER_POOLS = [
  ['Goblin', 'Kobold', 'Bandit', 'Skeleton'],          // Wave 1 — CR ≤ .25
  ['Skeleton', 'Zombie', 'Wolf', 'Orc', 'Goblin'],     // Wave 2 — CR ≤ .5
  ['Hobgoblin', 'Bugbear', 'Giant Spider', 'Orc'],     // Wave 3 — CR ≤ 1
];

const WAVE_NAMES = ['Dungeon Wave 1', 'Dungeon Wave 2', 'Dungeon Wave 3'];

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

function pickN(rng, list, count) {
  const pool = [...list];
  const out = [];
  while (out.length < count && pool.length) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

/** Parse "30 ft." walk speed into the numeric speed the saved-encounter lane uses. */
function monsterSpeed(monster) {
  const walk = monster.speed?.walk ?? monster.speed;
  const n = parseInt(String(walk), 10);
  return Number.isFinite(n) ? n : 30;
}

/** Initiative modifier: explicit field first, Dex modifier as the rules-lawful
 *  fallback (both present in monsters.json rows); the join lane re-rolls real
 *  initiative, so this only fills the saved `creatures` preview rows. */
function monsterInitBonus(monster) {
  if (Number.isFinite(monster.initiative)) return monster.initiative;
  if (Number.isFinite(monster.ability_score_modifiers?.dex)) return monster.ability_score_modifiers.dex;
  return 0;
}

/** Sentence-article assembly helper for flavor copy that prefixes "The" onto a
 *  generated service/business name (backlog 2026-11-03: shop/guild banks ship
 *  ~1400 names already leading with "The ", so a blind `The ${name}` produced
 *  "The The Quality Emporium hasn't had a caravan…"). Collides ONLY a genuine
 *  sentence-leading article word (case-sensitive, followed by whitespace), so
 *  mid-string "the" and words merely starting with A/An ("Anthel's Arcana")
 *  pass through untouched. Exported for unit tests; used at every composer
 *  seam that interpolates a service name, so it holds across regenerate. */
export function withLeadingArticle(name) {
  return /^(The|A|An)\s/.test(name) ? name : `The ${name}`;
}

async function findBestiaryRows(names) {
  const monsters = await loadMonsters();
  const byName = new Map(monsters.map(m => [m.name.toLowerCase(), m]));
  return names.map(name => {
    const monster = byName.get(name.toLowerCase());
    if (!monster) throw new Error(`Bestiary monster "${name}" not found in monsters.json`);
    return monster;
  });
}

/** Build one saved-encounter document from bestiary picks: `selectedMonsters`
 *  refs (what Join consumes) + §1 `creatures` preview rows (real stats). */
function buildEncounterData(description, picks) {
  const creatures = [];
  const selectedMonsters = [];
  for (const { monster, qty } of picks) {
    selectedMonsters.push({ index: monster.index, name: monster.name, qty });
    for (let i = 0; i < qty; i++) {
      creatures.push({
        name: qty === 1 ? monster.name : `${monster.name} ${i + 1}`,
        type: 'monster',
        ac: typeof monster.armor_class === 'number' ? monster.armor_class : 10,
        hp: monster.hit_points || 10,
        maxHp: monster.hit_points || 10,
        speed: monsterSpeed(monster),
        initBonus: monsterInitBonus(monster),
        conditions: [],
        effects: [],
        notes: '',
      });
    }
  }
  return {
    description,
    round: 1,
    activeCreatureName: creatures[0]?.name || null,
    creatures,
    selectedMonsters,
    effectiveXP: creatures.length * 50, // rough pool placeholder; EB recomputes on load
  };
}

async function persistDungeonMap(campaignName, dungeon, mapName) {
  await createMap(campaignName, mapName, { type: 'indoor', gridSize: dungeon.gridSize });
  // Whole-doc PUT is REPLACE, and the server's erasure guard 400s any body
  // omitting a required indoor field the created doc carries (`type`/
  // `gridSize`/`walls`/`placedItems`). The generator output has everything
  // but `type`, so stamp it before the save (bug-erase-guard-breaks-seeded-
  // campaign-create: the raw PUT 400'd and half-seeded arena/starter).
  await saveMapData(campaignName, mapName, { ...dungeon, type: 'indoor' });
  return { name: mapName, slug: toKebabCase(mapName) };
}

// ---------------------------------------------------------------------------
// Arena map tuning — generateDungeon({gridSize:24, density:0.55, seed}) then
// carve the arena silhouette out of the raw dungeon (the generator exposes no
// "open hall" knob). Exact landing options, documented per plan §2.2:
//   • gridSize 24, density 0.55 — dense enough that the un-carved shell reads
//     as chambers around the ring;
//   • central hall: every wall inside the rectangle
//     x ∈ [6, size-7], y ∈ [7, size-7] is removed → an open 12×10 floor;
//   • all props/furniture inside the hall are removed too (a sparring ring is
//     empty floor);
//   • perimeter ring is re-stamped solid except the two side entrances:
//     left/right wall at y ∈ {size/2 - 1, size/2}.
// ---------------------------------------------------------------------------
export function carveArena(dungeon) {
  const size = dungeon.gridSize;
  const hall = { x1: 6, x2: size - 7, y1: 7, y2: size - 7 };
  const midY = Math.floor(size / 2);
  const inHall = (x, y) => x >= hall.x1 && x <= hall.x2 && y >= hall.y1 && y <= hall.y2;

  const walls = new Set(dungeon.walls);
  for (const w of dungeon.walls) {
    const [x, y] = w.split(',').map(Number);
    if (inHall(x, y)) walls.delete(w);
  }
  for (let x = 0; x < size; x++) {
    walls.add(`${x},0`);
    walls.add(`${x},${size - 1}`);
  }
  for (let y = 0; y < size; y++) {
    walls.add(`0,${y}`);
    walls.add(`${size - 1},${y}`);
  }
  for (const y of [midY - 1, midY]) {
    walls.delete(`0,${y}`);
    walls.delete(`${size - 1},${y}`);
  }

  return {
    ...dungeon,
    walls: [...walls],
    placedItems: (dungeon.placedItems || []).filter(item =>
      !inHall(Number(item.gridX ?? item.x), Number(item.gridY ?? item.y))),
  };
}

// ---------------------------------------------------------------------------
// Hex POI placement for the starter outdoor map
// ---------------------------------------------------------------------------
const WATER_TERRAINS = new Set(['water', 'beach']);

function hexDistance(aq, ar, bq, br) {
  const dq = aq - bq;
  const dr = ar - br;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

function parseHexKey(key) {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

/** Pick settlement + dungeon hexes: settlement nearest land to the map centre,
 *  dungeon a land hex 4-8 away (fallback: furthest reachable land). */
function pickPoiHexes(terrain) {
  const land = Object.entries(terrain)
    .filter(([, t]) => !WATER_TERRAINS.has(t))
    .map(([key, t]) => ({ ...parseHexKey(key), terrain: t }));
  if (land.length < 2) throw new Error('Generated hex map has too little dry land to seed');

  const centers = land.reduce((best, h) => {
    const d = Math.abs(h.q - best.dq) + Math.abs(h.r - best.dr);
    return d < best.d ? { d, dq: h.q, dr: h.r } : best;
  }, { d: Infinity, dq: 0, dr: 0 });
  const settlement = land.reduce(
    (best, h) => (Math.abs(h.q - centers.dq) + Math.abs(h.r - centers.dr) <
                  Math.abs(best.q - centers.dq) + Math.abs(best.r - centers.dr) ? h : best),
    land[0],
  );
  const candidates = land.filter(h => hexDistance(h.q, h.r, settlement.q, settlement.r) >= 4);
  const dungeonHex = candidates.length
    ? candidates.reduce((best, h) => {
        const d = hexDistance(h.q, h.r, settlement.q, settlement.r);
        return d > best.d ? { d, ...h } : best;
      }, { d: 0, ...candidates[0] })
    : land.reduce((best, h) => {
        const d = hexDistance(h.q, h.r, settlement.q, settlement.r);
        return d > best.d ? { d, ...h } : best;
      }, { d: 0, ...land[0] });

  return { settlement, dungeon: dungeonHex };
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

/**
 * YYYYMMDD stamp from the LOCAL date parts. Quick-create defaults must show
 * the user's own date — the old `toISOString().slice(0,10)` recipe rolled to
 * "tomorrow" after local evening (UTC-ahead offsets, 2026-11-04 backlog).
 */
export function localDateStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

const ARENA_PRESET = {
  defaultName: () => `Arena-${localDateStamp()}`,
  metaType: 'arena',
  async seed(campaignName, seed) {
    const rng = mulberry32(seed);
    const seeded = { maps: [], encounters: [] };

    // Two carved arena halls; the first is activated.
    const sizes = [24, 20];
    for (let i = 0; i < ARENA_MAP_NAMES.length; i++) {
      const dungeon = carveArena(generateDungeon({
        gridSize: sizes[i],
        density: 0.55,
        seed: Math.floor(rng() * 2147483647),
      }));
      const map = await persistDungeonMap(campaignName,
        { ...dungeon, description: ARENA_MAP_DESCRIPTIONS[i] }, ARENA_MAP_NAMES[i]);
      seeded.maps.push(map);
    }
    await activateMap(campaignName, ARENA_MAP_NAMES[0]);

    // Sparring pool — three saved encounters drawn from the classics so the
    // Join lane resolves real stats (plan §2.2). No quests/factions/
    // settlements/NPCs: the arena stays lean (D5 disposable folder).
    const pools = [
      { name: 'Sparring — Goblin Pack', picks: [['Goblin', 3], ['Kobold', 2]] },
      { name: 'Sparring — Skeleton Watch', picks: [['Skeleton', 3], ['Zombie', 2]] },
      { name: 'Sparring — Pack Hunt', picks: [['Wolf', 3], ['Bandit', 2]] },
    ];
    for (const pool of pools) {
      const monsters = await findBestiaryRows(pool.picks.map(p => p[0]));
      const byName = new Map(monsters.map(m => [m.name, m]));
      const data = buildEncounterData(
        `Arena sparring pool draw (seed ${seed}). ${pool.picks.map(([n, q]) => `${q}x ${n}`).join(', ')}.`,
        pool.picks.map(([n, q]) => ({ monster: byName.get(n), qty: q })),
      );
      await saveEncounter(campaignName, pool.name, data);
      seeded.encounters.push(pool.name);
    }
    return seeded;
  },
};

const STARTER_PRESET = {
  defaultName: () => `Starter-${localDateStamp()}`,
  metaType: 'starter',
  async seed(campaignName, seed) {
    const rng = mulberry32(seed);
    const seeded = { maps: [], encounters: [], quests: [], settlement: null };

    // 1. Settlement — fixed teachable size, fresh name/content each roll.
    //    Plus layer rumors referencing the current adventure hook (§4.1-2).
    const settlement = await generateSettlement([], { size: 'village' });
    const dungeon = generateDungeon({ gridSize: 30, density: 0.5, seed });
    settlement.rumors = [
        `Folk in ${settlement.name} whisper about ${dungeon.name} — ${WAVE_MONSTER_POOLS[0][0]}s seen on the road at dusk.`,
        `${withLeadingArticle(settlement.services?.[0]?.name || 'general store')} hasn't had a caravan through since ${WAVE_MONSTER_POOLS[2][0]}s took the old ruin.`,
        ...(settlement.rumors || []),
    ].slice(0, 4);
    await saveSettlement(campaignName, settlement);
    seeded.settlement = settlement.name;

    // 2. Dungeon — BSP generator; chests it places ARE the loot cache
    //    (plan §3.1: "placed-item chest on the map" needs no new code),
    //    alongside the generator's prop/furniture clusters.
    const dungeonMap = await persistDungeonMap(campaignName, dungeon, dungeon.name);

    // 3. Small hex wilds with settlement + dungeon POIs; the dungeon POI's
    //    linkedMap rides the portal lane (indoor-linked-on-outdoor; the Enter
    //    badge additionally gates on party adjacency — expected travel design).
    const hexGridSize = 12;
    const { terrain, rivers } = generateHexTerrain({ gridSize: hexGridSize, seed });
    const pois = pickPoiHexes(terrain);
    const hexMapName = `${settlement.name} Countryside`;
    // The hex doc (POIs + party marker AT the settlement hex, §4.1-3) rides
    // the full-document save lane — the create route builds a bare doc and
    // would drop partyPosition.
    const starterPois = [
      {
        id: 'poi-settlement', type: 'settlement', label: settlement.name,
        q: pois.settlement.q, r: pois.settlement.r, visible: true,
      },
      {
        id: 'poi-dungeon', type: 'dungeon', label: dungeon.name,
        q: pois.dungeon.q, r: pois.dungeon.r, visible: true,
        linkedMap: dungeonMap.slug,
      },
    ];
    await createMap(campaignName, hexMapName, {
      type: 'outdoor',
      gridSize: hexGridSize,
      terrain,
      rivers,
      pois: starterPois,
    });
    await saveMapData(campaignName, hexMapName, {
      name: toKebabCase(hexMapName),
      displayName: hexMapName,
      type: 'outdoor',
      gridSize: hexGridSize,
      terrain,
      rivers,
      partyPosition: { q: pois.settlement.q, r: pois.settlement.r },
      pois: starterPois,
      zoom: 1,
      panX: 0,
      panY: 0,
    });
    await activateMap(campaignName, hexMapName);
    seeded.maps = [
      { name: hexMapName, slug: toKebabCase(hexMapName) },
      dungeonMap,
    ];

    // 4. Quests — hook / side / payoff, referencing the generated names.
    //    Row NAMES stay stable across regenerations (stable lookup keys);
    //    the generated settlement/dungeon titles live in description+notes.
    const missingNpc = settlement.notableNPCs?.[0]?.name || 'a village trader';
    const wave3Boss = WAVE_MONSTER_POOLS[2][0];
    const quests = [
      {
        name: 'Starter — Into the Ruins',
        status: 'active',
        description: `Word from ${settlement.name} is that ${dungeon.name} nearby teems with ${WAVE_MONSTER_POOLS[0][0]}s and worse. Clear it out.`,
        rewards: `Treasure cached in ${dungeon.name}`,
        notes: `Starter main quest — dungeon: ${dungeon.name}`,
      },
      {
        name: 'Starter — The Missing Trader',
        status: 'active',
        description: `${missingNpc} left for ${dungeon.name} and never returned to ${settlement.name}. ${WAVE_MONSTER_POOLS[1][0]}s hold the upper halls — find what happened.`,
        rewards: 'A village debt of gratitude',
        notes: `Starter side quest — missing: ${missingNpc}`,
      },
      {
        name: 'Starter — The Spoils',
        status: 'active',
        description: `Drive the ${wave3Boss} that rules ${dungeon.name} from its lair and bring back the chests it guards; ${settlement.name} will pay well.`,
        rewards: 'Seeded treasure: chests placed in the dungeon',
        notes: `Starter payoff quest — boss-tier: ${wave3Boss}`,
      },
    ];
    // Rows arrive UNS-tamped on purpose: the concurrent-save guard reads an
    // echoed updatedAt on a row disk doesn't know as a resurrection attempt
    // (409). Fresh creates never stamp; the server stamps them on write.
    await saveQuests(campaignName, quests.map(q => ({ id: crypto.randomUUID(), ...q })));
    seeded.quests = quests.map(q => q.name);

    // 5. Dungeon Wave 1-3 saved encounters from the classics.
    seeded.encounters = await seedWaves(campaignName, rng);

    // 6. Rolling seed document — drives checklist visibility + regenerate.
    const seedDoc = {
      version: 1,
      seed,
      layer: 1, // regenerateAdventure bumps (§4.1 "bumps layer number")
      createdAt: Date.now(),
      regeneratedAt: null,
      entities: {
        settlement: settlement.name,
        hexMap: seeded.maps[0],
        dungeonMap,
        dungeonTitle: dungeon.name,
        quests: seeded.quests,
        encounters: seeded.encounters,
      },
    };
    await saveStarterSeed(campaignName, seedDoc);
    seeded.seed = seedDoc;
    return seeded;
  },
};

const PRESETS = { arena: ARENA_PRESET, starter: STARTER_PRESET };

async function seedWaves(campaignName, rng) {
  const names = [];
  for (let w = 0; w < WAVE_NAMES.length; w++) {
    const picks = pickN(rng, WAVE_MONSTER_POOLS[w], 2 + (w % 2)).map(name => ({
      name,
      qty: 2 + Math.floor(rng() * 2),
    }));
    const monsters = await findBestiaryRows(picks.map(p => p.name));
    const byName = new Map(monsters.map(m => [m.name, m]));
    const data = buildEncounterData(
      `Starter dungeon wave ${w + 1}. ${picks.map(p => `${p.qty}x ${p.name}`).join(', ')}.`,
      picks.map(p => ({ monster: byName.get(p.name), qty: p.qty })),
    );
    await saveEncounter(campaignName, WAVE_NAMES[w], data);
    names.push(WAVE_NAMES[w]);
  }
  return names;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function createSeededCampaign(presetKey, { name, seed } = {}) {
  const preset = PRESETS[presetKey];
  if (!preset) {
    throw new Error(`Unknown seeded-campaign preset "${presetKey}"`);
  }
  const campaignName = (name || preset.defaultName()).trim();
  const roll = Number.isFinite(seed) ? seed : Math.floor(Math.random() * 2147483647);

  const response = await fetch('/api/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaignName }),
  });
  if (!response.ok) {
    // Surface the server's plain-English refusal (campaign-lock 403 etc.).
    let serverError;
    try {
      const body = await response.json();
      serverError = body?.error;
    } catch {
      // No JSON error body — fall back to statusText.
    }
    throw new Error(serverError || `Failed to create campaign: ${response.statusText}`);
  }

  // Record the type (campaign-meta.json) so list + sidebar surfaces badge this
  // folder as Arena/Starter from creation on. A failed meta write must not
  // abort an otherwise-seeded campaign — starter still infers from its seed
  // document; a lost arena meta only costs the badge (logged loudly).
  try {
    await saveCampaignType(campaignName, preset.metaType);
  } catch (err) {
    console.error(`[createSeededCampaign] failed to record campaign type "${preset.metaType}":`, err);
  }

  const seeded = await preset.seed(campaignName, roll);
  return { name: campaignName, seed: roll, seeded };
}

// ---------------------------------------------------------------------------
// Regenerate adventure (starter, GM-only — plan §3.2)
// ---------------------------------------------------------------------------

export async function regenerateAdventure(campaignName) {
  const seedDoc = await loadStarterSeed(campaignName);
  if (!seedDoc) {
    throw new Error('Not a starter campaign — no starter seed found');
  }

  const rng = mulberry32(seedDoc.seed ^ 0x5eed);
  const newSeed = Math.floor(rng() * 2147483647);
  const oldDungeon = seedDoc.entities.dungeonMap;
  const oldTitle = seedDoc.entities.dungeonTitle;
  // Every title the campaign's flavor text may still name (each layer ever
  // rolled) — re-point them ALL, so two regenerations ago can't haunt the
  // village rumors. Longest-first so a shared-word title can't half-swap.
  const retiredTitles = [...new Set([oldTitle, ...(seedDoc.entities.pastTitles || [])])]
    .filter(t => typeof t === 'string' && t)
    .sort((a, b) => b.length - a.length);
  const swapTitles = (s) => (typeof s === 'string'
    ? retiredTitles.reduce((acc, t) => acc.split(t).join(dungeon.name), s)
    : s);

  // 1. Fresh dungeon map file (name + walls + chest props).
  const dungeon = generateDungeon({ gridSize: 30, density: 0.5, seed: newSeed });
  const dungeonMap = await persistDungeonMap(campaignName, dungeon, dungeon.name);

  // 2. Re-point the hex portal POI, then drop the retired map file.
  const hexMap = seedDoc.entities.hexMap;
  const hexDoc = await loadMapData(campaignName, hexMap.slug);
  const pois = (hexDoc.pois || []).map(poi => (
    poi.id === 'poi-dungeon'
      ? { ...poi, label: dungeon.name, linkedMap: dungeonMap.slug }
      : poi
  ));
  await saveMapData(campaignName, hexMap.slug, { ...hexDoc, pois });
  await deleteMap(campaignName, oldDungeon.slug);

  // 3. Re-roll the wave monster line-ups (row names stable).
  const encounters = await rerollWaves(campaignName, rng);

  // 4. Re-point every quest row's dungeon reference (the hook names it in
  //    description; side/payoff rows may too). Row names stay stable.
  const quests = await loadQuests(campaignName);
  const rerolledQuest = (q) => {
    const next = { ...q, description: swapTitles(q.description), rewards: swapTitles(q.rewards), notes: swapTitles(q.notes) };
    if (q.name === seedDoc.entities.quests[0]) {
      next.notes = `Starter main quest — dungeon: ${dungeon.name}`;
    }
    return next;
  };
  await saveQuests(campaignName, quests.map(rerolledQuest));

  // 4b. Re-point the settlement's layer rumors at the new dungeon (the
  //     settlement itself — name, services, NPCs — stays, §3.2 "settlement
  //     kept"). The GET-single lane answers the { settlement } envelope.
  try {
    const row = await loadSettlement(campaignName, seedDoc.entities.settlement);
    const settlementRow = row?.settlement || row;
    if (settlementRow && settlementRow.name) {
      const rerolved = (settlementRow.rumors || []).map(swapTitles);
      await saveSettlement(campaignName, { ...settlementRow, rumors: rerolved });
    }
  } catch (err) {
    console.error('[regenerateAdventure] settlement rumor re-point failed:', err);
  }

  // 5. Rewrite the seed document with the new roll + names, and bump the
  //    adventure layer number (§4.1: layer 1 → 2 → …).
  const nextDoc = {
    ...seedDoc,
    seed: newSeed,
    layer: (seedDoc.layer || 1) + 1,
    regeneratedAt: Date.now(),
    entities: {
      ...seedDoc.entities,
      dungeonMap,
      dungeonTitle: dungeon.name,
      pastTitles: retiredTitles,
      encounters,
    },
  };
  await saveStarterSeed(campaignName, nextDoc);

  // 6. Audit the destructive op in the shared campaign log (backlog 2026-11-11:
  //    the replace/re-point used to land with zero rows). One row naming the
  //    retired title(s) → the new one, riding the same POST /log lane the
  //    server's addEntry backs. First-generation seeds carry no previous
  //    title — say so honestly instead of logging an empty old-title.
  const oldTitlesDisplay = [...new Set(
    [oldTitle, ...(seedDoc.entities.pastTitles || [])].filter(t => typeof t === 'string' && t)
  )];
  const description = oldTitlesDisplay.length
    ? `Adventure regenerated: ${oldTitlesDisplay.join(', ')} → ${dungeon.name} (adventure layer ${nextDoc.layer})`
    : `Adventure regenerated: initial generation — ${dungeon.name} (adventure layer ${nextDoc.layer})`;
  try {
    await addLogEntry(campaignName, { type: 'adventure_regenerated', description });
  } catch (err) {
    console.error('[regenerateAdventure] adventure_regenerated audit row failed:', err);
  }

  return {
    seed: newSeed,
    dungeonMap,
    dungeonTitle: dungeon.name,
    encounters,
    preserved: { settlement: seedDoc.entities.settlement, hexMap },
  };
}

async function rerollWaves(campaignName, rng) {
  for (let w = 0; w < WAVE_NAMES.length; w++) {
    const picks = pickN(rng, WAVE_MONSTER_POOLS[w], 2 + (w % 2)).map(name => ({
      name,
      qty: 2 + Math.floor(rng() * 2),
    }));
    const monsters = await findBestiaryRows(picks.map(p => p.name));
    const byName = new Map(monsters.map(m => [m.name, m]));
    const data = buildEncounterData(
      `Starter dungeon wave ${w + 1} (regenerated). ${picks.map(p => `${p.qty}x ${p.name}`).join(', ')}.`,
      picks.map(p => ({ monster: byName.get(p.name), qty: p.qty })),
    );
    await updateEncounter(campaignName, WAVE_NAMES[w], data);
  }
  return [...WAVE_NAMES];
}
