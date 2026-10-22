// @maintained-by-ai
// spellLimits.js contract suite — REAL disk slot tables (both rulesets) served through
// the fetch mock; expectations are literal bytes so every assertion is falsifiable.
// Quirks pinned as CURRENT behavior (📌 reported, not sanctioned):
//   - spellLimits.js:187 — known-type casters get `level1` = spells_known (spells-known
//     COUNT, not slots); other slot levels read spell_slots_level_i. Warlock lv10 and
//     bard lv4 disk rows make the conflation observable (0-vs-10, 4-vs-7).
//   - validateSpellSelection does NOT forward extraOptions to getSpellLimits, so the
//     2024 Divine/Primal Order cantrip bonus inflates getSpellLimits but validation
//     still fails on the base count (spellLimits.js:312-313) — pinned in VT5.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getSpellLimits,
  validateSpellSelection,
  getAllSpellLimits,
  resetClassDataCache,
} from './spellLimits.js';

const PATH_5E = 'data/classes.json';
const PATH_2024 = 'data/2024/classes.json';

const readDisk = (p) => {
  const parsed = JSON.parse(readFileSync(resolve(process.cwd(), 'public', p), 'utf8'));
  return Array.isArray(parsed) ? parsed : parsed.classes;
};

const classes5e = readDisk(PATH_5E);
const classes2024 = readDisk(PATH_2024);
const allSpells = readDisk('data/spells.json');
const diskRow5e = (name, level) =>
  classes5e.find((c) => c.name === name).class_levels.find((l) => l.level === level).spellcasting;

// Default limits shape returned for non-casters / lookup failures (byte-exact of getDefaultSpellLimits)
const NON_CASTER_DEFAULT = Object.freeze({
  spellType: 'prepared',
  isNonSpellcaster: true,
  cantrip: 0,
  preparedSpells: 0,
  level1: 0, level2: 0, level3: 0, level4: 0, level5: 0,
  level6: 0, level7: 0, level8: 0, level9: 0,
});

const ZERO_COUNTS = Object.freeze({
  cantrip: 0,
  level1: 0, level2: 0, level3: 0, level4: 0, level5: 0,
  level6: 0, level7: 0, level8: 0, level9: 0,
});

// formData.abilities is an ordered array: STR DEX CON INT WIS CHA (spellLimits.js:229)
const abilityScores = (index, overrides = {}) =>
  Array.from({ length: 6 }, (_, i) => ({
    baseScore: '8',
    backgroundIncrease: '0',
    miscIncrease: '0',
    featIncrease: '0',
    racialIncrease: '0',
    ...(i === index ? overrides : null),
  }));
const INT = 3;
const CHA = 5;

let errorSpy;

beforeEach(() => {
  resetClassDataCache();
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  global.fetch = vi.fn(async (path) => ({
    ok: true,
    json: async () => readDisk(path),
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
  delete global.fetch;
});

describe('getSpellLimits — REAL disk tables (5e + 2024)', () => {
  it('converts the full-caster wizard lv20 row byte-exact, fresh and side-effect-free', async () => {
    const expected = {
      cantrip: 5,
      spellType: 'prepared',
      preparedSpells: null, // 5e wizard row has no prepared_spells and no abilityScores passed → implicit null carried
      level1: 4, level2: 3, level3: 3, level4: 3, level5: 3,
      level6: 2, level7: 2, level8: 1, level9: 1,
    };

    const limits = await getSpellLimits({ className: 'Wizard', level: 20, version: '5e' });
    expect(limits).toStrictEqual(expected);

    // purity/freshness: distinct objects per call, disk input row never mutated
    const again = await getSpellLimits({ className: 'Wizard', level: 20, version: '5e' });
    expect(again).toEqual(expected);
    expect(again).not.toBe(limits);
    const diskRowAfter = JSON.parse(readFileSync(resolve(process.cwd(), 'public', PATH_5E), 'utf8'))
      .find((c) => c.name === 'Wizard').class_levels[19].spellcasting;
    expect(JSON.stringify(diskRow5e('Wizard', 20))).toBe(JSON.stringify(diskRowAfter));
  });

  it('Pact Magic warlock lv10: level1 carries spells_known (10), NOT the 0 lv1 slots — conflation pin', async () => {
    // Disk row: cantrips_known 4, spells_known 10, spell_slots_level_1 0, spell_slots_level_5 2, spell_type known.
    // spellLimits.js:187 replaces only level1 with spells_known; lv2-lv9 stay slot-driven (📌 SOURCE BUG, pinned).
    const limits = await getSpellLimits({ className: 'Warlock', level: 10, version: '5e' });
    expect(limits).toStrictEqual({
      cantrip: 4,
      spellType: 'known',
      preparedSpells: null,
      level1: 10, // = spells_known, would be 0 if read from spell_slots_level_1
      level2: 0, level3: 0, level4: 0,
      level5: 2, // Pact slot lives here (slot-driven)
      level6: 0, level7: 0, level8: 0, level9: 0,
    });
  });

  it('missing disk keys collapse to 0 (ranger lv1) while non-casters keep the distinguishable isNonSpellcaster shape; class lookup is name-or-lowercase-index', async () => {
    // 5e ranger lv1 row: no cantrips_known, spells_known 0, slots lv1 0, lv6-lv9 keys ABSENT on disk.
    const ranger = await getSpellLimits({ className: 'Ranger', level: 1, version: '5e' });
    expect(ranger).toStrictEqual({
      cantrip: 0,
      spellType: 'known',
      preparedSpells: null,
      level1: 0, level2: 0, level3: 0, level4: 0, level5: 0,
      level6: 0, level7: 0, level8: 0, level9: 0,
    });
    // 0-slot legality key-carry: a real 0-slot caster must NOT look like a non-caster default.
    expect(ranger).not.toHaveProperty('isNonSpellcaster');

    // Barbarian lv1 has spellcasting undefined on disk → full default shape, byte-exact
    const barb = await getSpellLimits({ className: 'Barbarian', level: 1, version: '5e' });
    expect(barb).toStrictEqual(NON_CASTER_DEFAULT);

    // className matched via c.index === className.toLowerCase() (spellLimits.js:50)
    const shouty = await getSpellLimits({ className: 'WIZARD', level: 1, version: '5e' });
    expect(shouty.cantrip).toBe(3);
    expect(shouty.level1).toBe(2);
    expect(shouty).not.toHaveProperty('isNonSpellcaster');

    const unknown = await getSpellLimits({ className: 'Mystic', level: 1, version: '5e' });
    expect(unknown).toStrictEqual(NON_CASTER_DEFAULT);
  });

  it('5e rogue lv3 resolves via subclasses[].class_levels — index-as-level scan returns the SPARSE lv7 row; non-matching majors fall back', async () => {
    // 🔴 SOURCE BUG pinned (spellLimits.js:144-148): the subclass scan iterates array INDEX i from
    // level-1 downward, but AT's subclass.class_levels is sparse on disk ([0]=lv3,[1]=lv4,[2]=lv7...).
    // A lv3 query therefore lands on index 2 = the LEVEL 7 row (spells_known 5, slots lv1 4, lv2 2)
    // — same SP-075 slot-vs-level bug family (#1503 form). Byte-exact current behavior:
    const at = await getSpellLimits({ className: 'Rogue', level: 3, version: '5e', majorName: 'Arcane Trickster' });
    expect(at).toStrictEqual({
      cantrip: 3,
      spellType: 'known', // subclass row has no spell_type → 'known' fallback, then level1 = spells_known
      preparedSpells: null,
      level1: 5, // spells_known of the lv7 row (would be 3 if the lv3 row were found by level)
      level2: 2, // lv7 slots (the true lv3 disk value is 0)
      level3: 0, level4: 0, level5: 0, level6: 0, level7: 0, level8: 0, level9: 0, // lv5-lv9 keys ABSENT on the row
    });

    const thief = await getSpellLimits({ className: 'Rogue', level: 3, version: '5e', majorName: 'Thief' });
    expect(thief).toStrictEqual(NON_CASTER_DEFAULT);

    const noMajor = await getSpellLimits({ className: 'Rogue', level: 3, version: '5e' });
    expect(noMajor).toStrictEqual(NON_CASTER_DEFAULT);
  });

  it('2024 required_major gate on REAL disk rows: mismatch blocks, match accepts, unrequired row passes ungated', async () => {
    // fixture provenance: the disk row itself carries the gate
    expect(classes2024.find((c) => c.name === 'Rogue').class_levels[0].spellcasting.required_major).toBe('Arcane Trickster');

    // 2024 rogue lv1 disk row carries required_major 'Arcane Trickster' with all-zero casting.
    const blockedNull = await getSpellLimits({ className: 'Rogue', level: 1, version: '2024' });
    expect(blockedNull).toStrictEqual(NON_CASTER_DEFAULT);

    const blockedThief = await getSpellLimits({ className: 'Rogue', level: 1, version: '2024', majorName: 'Thief' });
    expect(blockedThief).toStrictEqual(NON_CASTER_DEFAULT);

    const accepted = await getSpellLimits({ className: 'Rogue', level: 1, version: '2024', majorName: 'Arcane Trickster' });
    expect(accepted).toStrictEqual({
      cantrip: 0,
      spellType: 'prepared',
      preparedSpells: 0, // explicit disk prepared_spells — no compute needed
      level1: 0, level2: 0, level3: 0, level4: 0, level5: 0,
      level6: 0, level7: 0, level8: 0, level9: 0,
    });

    // 2024 wizard lv1 disk row has NO required_major → never gated, prepared_spells explicit
    const wizard = await getSpellLimits({ className: 'Wizard', level: 1, version: '2024', majorName: null });
    expect(wizard).toStrictEqual({
      cantrip: 3,
      spellType: 'prepared',
      preparedSpells: 4,
      level1: 2, level2: 0, level3: 0, level4: 0, level5: 0,
      level6: 0, level7: 0, level8: 0, level9: 0,
    });
  });

  it('2024 order cantrip bonuses apply only to their guard class, value, and version', async () => {
    const cleric5e = await getSpellLimits({ className: 'Cleric', level: 1, version: '2024' });
    expect(cleric5e.cantrip).toBe(3); // baseline from disk

    const thaumaturge = await getSpellLimits({
      className: 'Cleric', level: 1, version: '2024', extraOptions: { divineOrder: 'Thaumaturge' },
    });
    expect(thaumaturge.cantrip).toBe(4); // +1 grant

    const wrongOrder = await getSpellLimits({
      className: 'Cleric', level: 1, version: '2024', extraOptions: { divineOrder: 'Cloistered' },
    });
    expect(wrongOrder.cantrip).toBe(3);

    const wrongClass = await getSpellLimits({
      className: 'Wizard', level: 1, version: '2024', extraOptions: { divineOrder: 'Thaumaturge' },
    });
    expect(wrongClass.cantrip).toBe(3);

    const druidBase = await getSpellLimits({ className: 'Druid', level: 1, version: '2024' });
    const druid = await getSpellLimits({
      className: 'Druid', level: 1, version: '2024', extraOptions: { primalOrder: 'Magician' },
    });
    expect(druid.cantrip).toBe(druidBase.cantrip + 1);

    // version guard: 5e never applies the 2024 order bonus
    const cleric5eWithOption = await getSpellLimits({
      className: 'Cleric', level: 1, version: '5e', extraOptions: { divineOrder: 'Thaumaturge' },
    });
    expect(cleric5eWithOption.cantrip).toBe(3);
  });

  it('computes prepared-spell limits from abilityScores for prepared disk rows lacking prepared_spells', async () => {
    // Wizard lv1, INT 16 (+3): level + mod = 4
    const wiz = await getSpellLimits({
      className: 'Wizard', level: 1, version: '5e', abilityScores: abilityScores(INT, { baseScore: '16' }),
    });
    expect(wiz.preparedSpells).toBe(4);

    // Paladin half-caster: floor(level/2) + mod — lv1 CHA 16 → 0+3, lv4 → 2+3
    const pal1 = await getSpellLimits({
      className: 'Paladin', level: 1, version: '5e', abilityScores: abilityScores(CHA, { baseScore: '16' }),
    });
    expect(pal1.preparedSpells).toBe(3);
    const pal4 = await getSpellLimits({
      className: 'Paladin', level: 4, version: '5e', abilityScores: abilityScores(CHA, { baseScore: '16' }),
    });
    expect(pal4.preparedSpells).toBe(5);

    // string accumulation across the five increase fields: baseScore '0' hits the ||8 fallback
    // (8+0+0+0+2=10 → mod 0 → lv1 → 1); without the fallback the answer would be -3
    const zeroBase = await getSpellLimits({
      className: 'Wizard', level: 1, version: '5e',
      abilityScores: abilityScores(INT, { baseScore: '0', racialIncrease: '2' }),
    });
    expect(zeroBase.preparedSpells).toBe(1);

    // guard arms: missing scores, array too short, and known-caster short-circuit → null
    const noScores = await getSpellLimits({ className: 'Wizard', level: 1, version: '5e' });
    expect(noScores.preparedSpells).toBeNull();
    const shortScores = await getSpellLimits({
      className: 'Wizard', level: 1, version: '5e', abilityScores: abilityScores(INT, { baseScore: '20' }).slice(0, 3),
    });
    expect(shortScores.preparedSpells).toBeNull(); // INT index 3 entry absent → abilityData guard
    const sorcerer = await getSpellLimits({
      className: 'Sorcerer', level: 1, version: '5e', abilityScores: abilityScores(INT, { baseScore: '20' }),
    });
    expect(sorcerer.preparedSpells).toBeNull(); // spell_type 'known' → never computes
  });

  it('fetch contract: per-version disk paths byte-exact, one fetch per version cached, reset re-fetches, arity pinned', async () => {
    await getSpellLimits({ className: 'Wizard', level: 1 });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith(PATH_5E);

    // second 5e query (different class) served from cache — still exactly one fetch
    await getSpellLimits({ className: 'Cleric', level: 1 });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    // 2024 is its own cache slot AND its own path (dual-ruleset data lane)
    await getSpellLimits({ className: 'Cleric', level: 1, version: '2024' });
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenLastCalledWith(PATH_2024);

    // unknown versions fall through to the 5e path and load the 5e table
    resetClassDataCache();
    global.fetch.mockClear();
    const bogus = await getSpellLimits({ className: 'Wizard', level: 1, version: '2014' });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenLastCalledWith(PATH_5E);
    expect(bogus.cantrip).toBe(3);

    // runtime Function.length pins (destructured pattern = 1 param; counting stops at first default)
    expect(getSpellLimits.length).toBe(1);
    expect(validateSpellSelection.length).toBe(1);
    expect(getAllSpellLimits.length).toBe(1); // (className, version='5e', majorName=null)
    expect(resetClassDataCache.length).toBe(0);
  });

  it('every failure lane returns the byte-exact default and logs console.error once per call', async () => {
    // lane 1: network rejection (caught inside loadClassData)
    resetClassDataCache();
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    expect(await getSpellLimits({ className: 'Wizard', level: 1 })).toStrictEqual(NON_CASTER_DEFAULT);
    expect(errorSpy).toHaveBeenCalledTimes(1);

    // lane 2: ok:false response (loadClassData throws on !response.ok)
    resetClassDataCache();
    global.fetch = vi.fn().mockResolvedValue({ ok: false });
    expect(await getSpellLimits({ className: 'Wizard', level: 1 })).toStrictEqual(NON_CASTER_DEFAULT);
    expect(errorSpy).toHaveBeenCalledTimes(2);

    // lane 3: 2024 path 404s while a bare object poisons the 5e cache — the {} IS cached
    // (truthy), so the TypeError from .find is re-thrown from cache WITHOUT a new fetch. 📌
    resetClassDataCache();
    global.fetch = vi.fn(async (path) =>
      path === PATH_2024 ? { ok: false } : { ok: true, json: async () => ({}) });
    expect(await getSpellLimits({ className: 'Wizard', level: 1 })).toStrictEqual(NON_CASTER_DEFAULT);
    expect(await getSpellLimits({ className: 'Wizard', level: 1 })).toStrictEqual(NON_CASTER_DEFAULT);
    expect(global.fetch).toHaveBeenCalledTimes(1); // corrupted body poisoned the cache — one fetch, two errors
    expect(errorSpy).toHaveBeenCalledTimes(4);
  });
});

describe('validateSpellSelection — selection legality (REAL rows)', () => {
  const CANTRIPS = ['Fire Bolt', 'Light', 'Prestidigitation', 'Chill Touch'];
  const LV1 = ['Bless', 'Cure Wounds', 'Guiding Bolt', 'Sanctuary', 'Shield of Faith'];
  const LV2 = ['Mirror Image', 'Spider Climb', 'Calm Emotions', 'Silence'];

  it('bard lv4 within disk limits: full result object byte-exact, including the level1=spells_known conflation', async () => {
    // disk bard lv4: cantrips_known 3, spells_known 7, slots 4/3/0/0...
    const result = await validateSpellSelection({
      selectedSpells: [CANTRIPS[0], CANTRIPS[1], CANTRIPS[2], LV1[0], LV1[1], LV2[0], LV2[1], LV2[2]],
      allSpells, className: 'Bard', level: 4, version: '5e',
    });
    expect(result).toStrictEqual({
      valid: true,
      violations: [],
      limits: {
        cantrip: 3,
        spellType: 'known',
        preparedSpells: null,
        level1: 7, // spells_known (not 4 slots) — same :187 quirk as getSpellLimits
        level2: 3,
        level3: 0, level4: 0, level5: 0, level6: 0, level7: 0, level8: 0, level9: 0,
      },
      counts: { cantrip: 3, level1: 2, level2: 3, level3: 0, level4: 0, level5: 0, level6: 0, level7: 0, level8: 0, level9: 0 },
    });
  });

  it('bard lv4 overrun: exact violation strings in emission order, prepared-row absent for known casters', async () => {
    const result = await validateSpellSelection({
      selectedSpells: [...CANTRIPS, ...LV2],
      allSpells, className: 'Bard', level: 4, version: '5e',
    });
    expect(result.valid).toBe(false);
    expect(result.violations).toStrictEqual(['Cantrips: 4/3', '2nd level: 4/3']);
    expect(result.counts.cantrip).toBe(4);
    expect(result.counts.level2).toBe(4);
  });

  it('2024 cleric lv1 prepared lane: total non-cantrip cap (disk prepared_spells 4), cantrip cap stacks', async () => {
    const over = await validateSpellSelection({
      selectedSpells: [...CANTRIPS, ...LV1],
      allSpells, className: 'Cleric', level: 1, version: '2024',
    });
    expect(over.valid).toBe(false);
    // prepared branch aggregates totals — no per-level rows appear
    expect(over.violations).toStrictEqual(['Cantrips: 4/3', 'Prepared spells: 5/4']);

    const atLimit = await validateSpellSelection({
      selectedSpells: [CANTRIPS[0], CANTRIPS[1], CANTRIPS[2], LV1[0], LV1[1], LV1[2], LV1[3]],
      allSpells, className: 'Cleric', level: 1, version: '2024',
    });
    expect(atLimit.valid).toBe(true);
    expect(atLimit.violations).toStrictEqual([]);
  });

  it('unforwarded extraOptions + implicit-null preparedSpells: two quantified source quirks pinned', async () => {
    // 📌 quirk A: validateSpellSelection never forwards extraOptions (spellLimits.js:313), so a
    // 2024 Thaumaturge cleric legally knowing 4 cantrips per getSpellLimits FAILS its own validation.
    const strictLimit = await getSpellLimits({
      className: 'Cleric', level: 1, version: '2024', extraOptions: { divineOrder: 'Thaumaturge' },
    });
    expect(strictLimit.cantrip).toBe(4);
    const validation = await validateSpellSelection({
      selectedSpells: CANTRIPS,
      allSpells, className: 'Cleric', level: 1, version: '2024',
    });
    expect(validation.limits.cantrip).toBe(3); // validation path re-fetches WITHOUT the order bonus
    expect(validation.violations).toStrictEqual(['Cantrips: 4/3']);

    // 📌 quirk B: 5e wizard lv1 row lacks prepared_spells and no abilityScores → preparedSpells null;
    // any non-cantrip selection then violates against the literal null (message byte '/null'),
    // observably distinct from a real 0 cap (which would read '/0' and is the NON_CASTER path instead).
    const wizardNull = await validateSpellSelection({
      selectedSpells: ['Fire Bolt', 'Magic Missile'],
      allSpells, className: 'Wizard', level: 1, version: '5e',
    });
    expect(wizardNull.limits.preparedSpells).toBeNull();
    expect(wizardNull.valid).toBe(false);
    expect(wizardNull.violations).toStrictEqual(['Prepared spells: 1/null']);
  });

  it('non-caster bypass + empty/null/undefined selections + unknown/index/levelless/level-10 spell arms', async () => {
    // Barbarian bypass: any selection allowed, counts still honest
    const barb = await validateSpellSelection({
      selectedSpells: ['Fire Bolt', 'Chill Touch', 'Magic Missile', 'Fireball', 'Shield'],
      allSpells, className: 'Barbarian', level: 1, version: '5e',
    });
    expect(barb.valid).toBe(true);
    expect(barb.violations).toStrictEqual([]);
    expect(barb.limits.isNonSpellcaster).toBe(true);
    expect(barb.counts).toStrictEqual({ ...ZERO_COUNTS, cantrip: 2, level1: 2, level3: 1 });

    // falsy triple: [], null, undefined all valid with all-zero counts
    for (const selected of [[], null, undefined]) {
      const result = await validateSpellSelection({
        selectedSpells: selected, allSpells, className: 'Bard', level: 4, version: '5e',
      });
      expect(result.valid).toBe(true);
      expect(result.counts).toStrictEqual(ZERO_COUNTS);
    }

    // unknown name silently uncounted
    const unknown = await validateSpellSelection({
      selectedSpells: ['Not A Spell'], allSpells, className: 'Bard', level: 4, version: '5e',
    });
    expect(unknown.counts).toStrictEqual(ZERO_COUNTS);

    // index-only match works; level-less spell defaults to cantrip; level 10 has no counter key and
    // is silently dropped (counts[levelKey] undefined guard, spellLimits.js:370)
    const custom = [
      { index: 'fire-bolt', level: 0 },
      { name: 'Levelless Wonder' },
      { name: 'Overlevel Mystery', level: 10 },
    ];
    const edges = await validateSpellSelection({
      selectedSpells: ['fire-bolt', 'Levelless Wonder', 'Overlevel Mystery'],
      allSpells: custom, className: 'Bard', level: 4, version: '5e',
    });
    expect(edges.counts).toStrictEqual({ ...ZERO_COUNTS, cantrip: 2 });
    expect(edges.valid).toBe(true);
  });
});

describe('getAllSpellLimits (orphan export — no production callers, last pin)', () => {
  it('maps levels 1-20 from cache with one fetch, consistent with direct getSpellLimits', async () => {
    const limits = await getAllSpellLimits('Wizard'); // version default '5e'
    expect(Object.keys(limits)).toStrictEqual(Array.from({ length: 20 }, (_, i) => String(i + 1)));
    expect(global.fetch).toHaveBeenCalledTimes(1); // cache serves all 20 levels

    await expect(getAllSpellLimits('Wizard')).resolves.toEqual(limits);

    // cross-export consistency: identical to direct single-level calls
    expect(limits[1]).toStrictEqual(await getSpellLimits({ className: 'Wizard', level: 1 }));
    expect(limits[20]).toStrictEqual(await getSpellLimits({ className: 'Wizard', level: 20 }));
  });
});
