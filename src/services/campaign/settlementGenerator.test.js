// @maintained-by-ai
/**
 * settlementGenerator lane — pure procedural settlement CREATION (the
 * settlementsService lane owns CRUD persistence).
 *
 * Disk-verbatim: the generator fetches six static /data/*.json name banks;
 * this suite serves the REAL disk files (cf. monsters.json disk-verbatim
 * pattern) instead of fabricated mini-tables. The old mock was canned —
 * 'A cluster of cottages.' etc. do not exist on disk — and omitted the
 * Mixed/Nomadic cultures, silently routing every town/city/metropolis name
 * through the Human fallback branch.
 *
 * Dice discipline: all randomness is pick/pickN/randomInt over Math.random
 * (seeded-vs-live: none — the module is fully live-random). Every test rigs
 * a constant with a vi spy (exact capture; vi.restoreAllMocks in afterEach
 * is the restore — avoids the historical raw-assignment restore poison) and
 * pins exact table-first (rig 0) / table-last (rig ~1) outputs plus exact
 * roll economies:
 *   village 21 = culture+name+flavor(3)+pop+featCount+feat(2)+threat
 *                +svcCount+types(1) | 1 service x 7 | rumorCount+rumors(1)
 *   city    83   metropolis 115 (+2 guild-resolve)   no-size path +1
 *
 * Cache honesty: the module caches each fetch at module scope, so the suite
 * re-imports a FRESH instance per test (the previous file reset modules in
 * afterEach AFTER a static top-level import — caches were never actually
 * cleared between tests, so the "Dwarven.city = []" mutation there never
 * reached the generator). src/test/setup.js installs an inert global fetch;
 * this suite overrides it per-test with verbatim disk content and fails
 * loudly on any unmapped URL.
 *
 * Production caller (live): Settlements.jsx handleGenerateSettlement calls
 * generateSettlement(settlements) with NO options — the random-size lane
 * (first roll = SIZE_LABELS pick) is the production path and is pinned.
 * No timers, no Date.now in the module — procedural gen is clock-free.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';

const DATA_FILES = [
  '/data/settlement-names.json',
  '/data/npc-names.json',
  '/data/settlement-descriptions.json',
  '/data/shop-names.json',
  '/data/guild-names.json',
  '/data/settlement-rumors.json',
];

// Verbatim disk content, parsed once.
const disk = Object.fromEntries(
  DATA_FILES.map((p) => [p, JSON.parse(readFileSync('public' + p, 'utf8'))])
);

let fetchSpy;

// Constant rig via vi.spyOn — capture happens inside the spy; afterEach's
// vi.restoreAllMocks is the restore. 0 → table-first, 0.999999 → table-last
// (arrays here are all < 1e6 long).
function riggedRandom(value) {
  return vi.spyOn(Math, 'random').mockReturnValue(value);
}

// Serve verbatim disk content; unknown URLs fail loudly (no unmocked holes).
// Tests pass an override map to shadow one file (e.g. the fallback ladder).
function serveDisk(overrides = {}) {
  return fetchSpy.mockImplementation(async (url) => {
    if (url in overrides) return { ok: true, json: async () => overrides[url] };
    if (!(url in disk)) throw new Error(`Unmocked fetch in settlementGenerator test: ${url}`);
    return { ok: true, json: async () => disk[url] };
  });
}

// Table-first village (rig 0), values verbatim from public/data/*.json.
const VILLAGE_FIRST = {
  name: 'Ashford',
  size: 'village',
  description:
    'A cluster of thatched-roof cottages circles a mossy stone well at the center of town. ' +
    'An ancient stone well at the village center, its rim worn smooth by generations of hands. ' +
    'A massive oak tree in the village green, said to be older than the village itself.',
  atmosphere: 'The smell of wood smoke and baking bread fills every lane.',
  government: 'A village elder, chosen by consensus of the founding families, settles disputes and leads meetings.',
  population: '50-100 souls',
  services: [
    {
      type: 'inn',
      name: 'Key & Ram',
      description: 'A quiet inn with clean rooms and a warm hearth. The rooms are modest but well-kept.',
    },
  ],
  notableNPCs: [
    {
      name: 'Adelaide',
      role: 'Innkeeper',
      description: 'The Innkeeper of Key & Ram. Known for fair dealing and a dry sense of humor.',
    },
  ],
  rumors: ['A merchant caravan went missing on the northern road three days ago.'],
  tags: 'village, human-culture, inn',
  notes: '',
  threat: 'Bandits from the nearby hills have been raiding outlying farms with increasing boldness.',
};

// Table-last metropolis (rig ~1). Note the guild quirk pinned below: the
// guild NPC keeps the PRE-RESOLVE shop name (guild pool last) while
// services.name is replaced by the smugglers guild name (guild category
// pick also lands last under this rig).
const METRO_LAST = {
  name: 'Mizva Ultimate',
  size: 'metropolis',
  description:
    'The metropolis is built on the ruins of an older civilization. ' +
    'A great market square, paved with colored stone and dominated by a central fountain. ' +
    'The imperial walls, their battlements patrolled by the elite guard. ' +
    'A great bridge, its surface lined with shops and stalls, spanning the river. ' +
    "The imperial arsenal, where the realm's weapons and armor are manufactured.",
  atmosphere: "The metropolis's many bridges echo with footsteps.",
  government: 'A lord mayor appointed by the emperor governs with absolute authority.',
  population: '250,000+ souls',
  services: [
    { type: 'bank', name: 'The Federal Bank', description: 'The only bank in the region. Takes a percentage on all deposits but is considered trustworthy.' },
    { type: 'stable', name: "Undine's Pastures", description: 'A breeding stable known for quality warhorses. Premium prices for premium stock.' },
    { type: 'tailor', name: 'The Delicate Hem', description: 'A high-end tailor catering to the wealthy with custom fittings.' },
    { type: 'butcher', name: 'Ribmarket', description: 'The local butcher also sells leather and bones for craft projects.' },
    { type: 'bakery', name: 'The Toasty Roll', description: "A baker's shop that serves as an informal gathering place for morning gossip." },
    { type: 'alchemist', name: 'The Purple Potion', description: 'A renowned alchemist whose potions are sought across the region.' },
    { type: 'guild', name: 'RustyHaven', description: 'A guild hall that doubles as a social club. Fine drinks and finer conversation.' },
    { type: 'temple', name: 'Forest Garden', description: 'A controversial temple whose teachings draw both followers and critics.' },
    { type: 'magic_shop', name: 'Evocationhold', description: 'A hidden magic shop, accessible only through an unmarked door in an alley.' },
    { type: 'general_store', name: "Theron's Warehouse", description: 'A new general store struggling to compete with a larger supplier across town.' },
    { type: 'blacksmith', name: 'The Tempered Helm', description: 'An amateur blacksmith still learning the trade. Prices are low but the work is rough.' },
    { type: 'tavern', name: "Hadrian's Drinks", description: "A tavern famous for its house ale, brewed locally. The secret recipe is closely guarded." },
  ],
  notableNPCs: [
    { name: 'Zurgash', role: 'Factor', description: 'The Factor of The Federal Bank. Hardworking and tired, but always has time for a conversation.' },
    { name: 'Zurgash 2', role: 'Hostler', description: "The Hostler of Undine's Pastures. Hardworking and tired, but always has time for a conversation." },
    { name: 'Zurgash 3', role: 'Seamstress', description: 'The Seamstress of The Delicate Hem. Hardworking and tired, but always has time for a conversation.' },
    { name: 'Zurgash 4', role: 'Butcher', description: 'The Butcher of Ribmarket. Hardworking and tired, but always has time for a conversation.' },
    { name: 'Zurgash 5', role: 'shopkeeper', description: 'The shopkeeper of The Toasty Roll. Hardworking and tired, but always has time for a conversation.' },
    { name: 'Zurgash 6', role: 'Herbalist', description: 'The Herbalist of The Purple Potion. Hardworking and tired, but always has time for a conversation.' },
    // Guild NPC keeps the pre-resolve shop name while the service carries
    // the smugglers guild name — current behavior, flagged to the lane log.
    { name: 'Zurgash 7', role: 'Lieutenant', description: 'The Lieutenant of The Hidden Sentinel. Hardworking and tired, but always has time for a conversation.' },
    { name: 'Zurgash 8', role: 'Cleric', description: 'The Cleric of Forest Garden. Hardworking and tired, but always has time for a conversation.' },
    { name: 'Zurgash 9', role: 'Warlock', description: 'The Warlock of Evocationhold. Hardworking and tired, but always has time for a conversation.' },
    { name: 'Zurgash 10', role: 'Proprietor', description: "The Proprietor of Theron's Warehouse. Hardworking and tired, but always has time for a conversation." },
    { name: 'Zurgash 11', role: 'Forge-master', description: 'The Forge-master of The Tempered Helm. Hardworking and tired, but always has time for a conversation.' },
    { name: 'Zurgash 12', role: 'Publican', description: "The Publican of Hadrian's Drinks. Hardworking and tired, but always has time for a conversation." },
  ],
  rumors: [
    'A merchant has begun selling goods on credit but collecting debts with hired muscle.',
    'The trading post at the crossroads is the only source of supplies for three days travel.',
    'A new law requires all goods passing through the town gate to be inspected, slowing trade.',
  ],
  tags: 'metropolis, nomadic-culture, bank, many-services',
  notes: '',
  threat: 'A dark power is awakening beneath the metropolis, and the ground trembles with its stirrings.',
};

describe('settlementGenerator', () => {
  let generateSettlement;

  beforeEach(async () => {
    // Fresh module instance → module-level fetch caches are genuinely empty.
    vi.resetModules();
    generateSettlement = (await import('./settlementGenerator.js')).generateSettlement;
    // Override setup.js's inert global fetch with verbatim disk content.
    fetchSpy = vi.spyOn(globalThis, 'fetch');
    serveDisk();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('data loading', () => {
    it('fetches the six /data name banks exactly once and caches across calls', async () => {
      riggedRandom(0.5);

      await generateSettlement([], { size: 'village' });
      expect(fetchSpy).toHaveBeenCalledTimes(6);
      expect(fetchSpy.mock.calls.map(([url]) => url)).toEqual(DATA_FILES);

      await generateSettlement([], { size: 'city' });
      expect(fetchSpy).toHaveBeenCalledTimes(6); // module cache, no refetch
    });
  });

  describe('table-first output (rig 0)', () => {
    it('produces the exact first-entry village with exact roll economy', async () => {
      const randomSpy = riggedRandom(0);

      const result = await generateSettlement([], { size: 'village' });

      expect(result).toEqual(VILLAGE_FIRST);
      // 12 head + 1 service x 7 + 2 rumor rolls
      expect(randomSpy).toHaveBeenCalledTimes(21);
    });

    it('builds description from base description plus exactly 2 rolled features', async () => {
      riggedRandom(0);

      const result = await generateSettlement([], { size: 'village' });
      const villageDescs = disk['/data/settlement-descriptions.json'].village;

      expect(result.description).toBe(
        `${villageDescs.descriptions[0]} ${villageDescs.features[0]} ${villageDescs.features[1]}`
      );
    });

    it('production path (no options) burns one extra roll on the size pick, then matches the village pin', async () => {
      // Settlements.jsx:445 calls generateSettlement(settlements) — no size.
      const randomSpy = riggedRandom(0);

      const result = await generateSettlement();

      expect(result.size).toBe('village'); // SIZE_LABELS[0]
      expect(result).toEqual(VILLAGE_FIRST);
      expect(randomSpy).toHaveBeenCalledTimes(22); // 21 + size pick
    });

    it('appends incrementing numbers to resolve settlement-name conflicts (no extra rolls)', async () => {
      const randomSpy = riggedRandom(0);

      // rig 0 names the village 'Ashford' (Human.village first, disk-verbatim)
      const result = await generateSettlement(
        [{ name: 'Ashford' }, { name: 'Ashford 2' }],
        { size: 'village' }
      );

      expect(result.name).toBe('Ashford 3');
      expect(randomSpy).toHaveBeenCalledTimes(21); // conflict loop is roll-free
    });
  });

  describe('table-last output (rig ~1)', () => {
    it('produces the exact last-entry metropolis: 12 services (inn dropped), guild resolved, NPC name increments', async () => {
      const randomSpy = riggedRandom(0.999999);

      const result = await generateSettlement([], { size: 'metropolis' });

      expect(result).toEqual(METRO_LAST);
      // 25 head + 12 services x 7 + 2 guild-resolve + 4 rumor rolls
      expect(randomSpy).toHaveBeenCalledTimes(115);
      // pickN from the tail skips the head type ('inn')
      expect(result.services.map((s) => s.type)).toEqual([
        'bank', 'stable', 'tailor', 'butcher', 'bakery', 'alchemist',
        'guild', 'temple', 'magic_shop', 'general_store', 'blacksmith', 'tavern',
      ]);
      // 12 NPCs all roll the same first name → 'Zurgash', 'Zurgash 2'…'Zurgash 12'
      expect(result.notableNPCs.map((n) => n.name)).toEqual([
        'Zurgash', 'Zurgash 2', 'Zurgash 3', 'Zurgash 4', 'Zurgash 5', 'Zurgash 6',
        'Zurgash 7', 'Zurgash 8', 'Zurgash 9', 'Zurgash 10', 'Zurgash 11', 'Zurgash 12',
      ]);
    });

    it('production path (no options) at rig ~1 rolls metropolis with one extra size roll', async () => {
      const randomSpy = riggedRandom(0.999999);

      const result = await generateSettlement();

      expect(result.size).toBe('metropolis'); // SIZE_LABELS[3]
      expect(result).toEqual(METRO_LAST);
      expect(randomSpy).toHaveBeenCalledTimes(116); // 115 + size pick
    });

    it('draws guild-type names from guild-names.json, NPCs keep the pre-resolve shop name', async () => {
      riggedRandom(0.999999);

      const result = await generateSettlement([], { size: 'metropolis' });

      expect(result.services[6].name).toBe(disk['/data/guild-names.json'].smugglers.at(-1));
      expect(result.notableNPCs[6].description).toContain(disk['/data/shop-names.json'].guild.at(-1));
    });
  });

  describe('population table (module constants)', () => {
    it('maps each size to its exact population band (rig 0 = first, rig ~1 = last)', async () => {
      riggedRandom(0);
      expect((await generateSettlement([], { size: 'village' })).population).toBe('50-100 souls');
      expect((await generateSettlement([], { size: 'town' })).population).toBe('800-1,500 souls');
      expect((await generateSettlement([], { size: 'city' })).population).toBe('5,000-12,000 souls');
      expect((await generateSettlement([], { size: 'metropolis' })).population).toBe('50,000-100,000 souls');

      riggedRandom(0.999999);
      expect((await generateSettlement([], { size: 'village' })).population).toBe('400-800 souls');
      expect((await generateSettlement([], { size: 'town' })).population).toBe('3,000-5,000 souls');
      expect((await generateSettlement([], { size: 'city' })).population).toBe('25,000-50,000 souls');
      expect((await generateSettlement([], { size: 'metropolis' })).population).toBe('250,000+ souls');
    });
  });

  describe('culture fallback ladder', () => {
    // Only Human.town survives: culture rolls 'Elven' (city pool last) →
    // names.Elven missing → names.Human.city missing → names.Human.town.
    const LADDER_NAMES = { Human: { town: ['Fallbackton'] } };

    it('walks culture → Human[size] → Human.town and pins the result', async () => {
      serveDisk({ '/data/settlement-names.json': LADDER_NAMES });
      const randomSpy = riggedRandom(0.999999);

      const result = await generateSettlement([], { size: 'city' });

      expect(result.name).toBe('Fallbackton');
      expect(result.tags).toBe('city, elven-culture, stable, many-services');
      expect(randomSpy).toHaveBeenCalledTimes(83); // city economy, unchanged by fallback
    });

    it('applies the conflict suffix to fallback names too', async () => {
      serveDisk({ '/data/settlement-names.json': LADDER_NAMES });
      riggedRandom(0.999999);

      const result = await generateSettlement([{ name: 'Fallbackton' }], { size: 'city' });

      expect(result.name).toBe('Fallbackton 2');
    });

    it('rejects loudly (TypeError) on an unknown size instead of inventing data', async () => {
      riggedRandom(0);

      // No culture map for 'hamlet' → pick(undefined) throws; the generator
      // never silently fabricates a settlement for a size it doesn't know.
      await expect(generateSettlement([], { size: 'hamlet' })).rejects.toThrow(TypeError);
    });
  });
});
