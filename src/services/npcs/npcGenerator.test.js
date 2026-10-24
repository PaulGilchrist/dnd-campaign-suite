// @maintained-by-ai
// Lane: npcGenerator.js — pure random custom-NPC factory. Sole export: generateNPC(existingNPCs).
// Split (owner): npcsService.test.js owns campaign-CRUD transport (/api/.../npcs);
// npcFormUtils.test.js owns form defaults (#1179); npcCombatService.test.js owns initiative (#1178);
// NPCs.*.test.jsx owns UI wiring (mocks this module — real generator never runs there).
// This file is the ONLY verifier of the real generator: exact-if-fetch table transport (#1010),
// RNG-consumed-in-order byte-exact pins (#1076/#1160), loud decoys (#1166), exact name lanes,
// dedupe suffixes, CR/dice scaling. Custom-NPC invariant (@app): output lands in the custom
// npcs.json lane via the NPCs.jsx save flow; distinctness vs bestiary is server-enforced (#1177) —
// the generator's load-bearing contribution is unique-name suffixing, pinned in the dedupe table.
// No wall-clock (#app): zero timers here. No logging in source → no log assertions (#app).
//
// RNG slot map (Math.random consumption order, generateNPC):
//   1 race | 2 gender | 3 name (length-checked chain race->Human[gender]->Human.male,
//   throws LOUD when every pool is empty/absent — #1180) | 4-9 classRole/attitude/
//   appearance/personality/goals/secrets | 10 numTags=randomInt(1,3) | 11..(10+numTags) pickN
//   | includeStatBlock (>0.3) | then stat block: cr, abilityScore, hp, ac, speed(+extra pick if
//   cr>=2 && roll>0.75), primary, secondary | per action: builder roll, template pick, index pick,
//   one roll per die of scaled dice | traits roll (+pool pick if cr>=1 && roll>0.5).
//
// Old->new map (13 old tests -> 6 units / 12 cases):
//   core fields + tags string                -> seed census byte-exact outputs
//   fetches both data files                  -> transport exact-if-fetch + cache
//   name matches race/gender                 -> census + name-lane table row A
//   race-missing fallback                    -> name-lane row B
//   gender-pool-empty fallback (mislabelled: fell back to Human female, not male) -> rows C/D
//   numeric suffix / empty+undefined arrays -> dedupe table 1/2/3
//   skip stat block + minimal NPC            -> decoy guard test (zero stat-block RNG proof)
//   complete stat block, empty immunities, saves/skills objects, ability-CR scaling
//   (vacuous if-guard)                       -> census exact pins
//   melee/spell action tests (vacuous if-guards) -> census exact action objects
//   propagates fetch rejection               -> kept, extended (no cache poisoning)
//   successive independent NPCs (toBeDefined noise) -> removed, low value
// RNG slot map consumed once by hand (#815); fixtures mirror real /data shapes (#977/#993).
import { describe, it, expect, vi, afterEach } from 'vitest';

// ─── Fixtures (mirror real public/data/npc-names.json + npc-generator-traits.json shapes) ──

const NAMES = {
  Human: { male: ['Aldric', 'Bram'], female: ['Elena', 'Fiona'] },
  Elf: { male: ['Legolas', 'Elrond'], female: ['Arwen', 'Galadriel'] },
  Dwarf: { male: ['Thorgar'], female: [] },
};

const TRAITS = {
  races: ['Human', 'Elf'],
  classRoles: ['Warrior', 'Rogue'],
  attitudes: ['Friendly', 'Hostile'],
  appearances: ['Tall', 'Stocky'],
  personalities: ['Brave', 'Cautious'],
  goals: ['Wealth', 'Power'],
  secrets: ['None', 'Has a dark past'],
  tags: ['merchant', 'soldier', 'hermit'],
};

const NAMES_WITH_MISSING_HUMAN_FEMALE = {
  ...NAMES,
  // female KEY ABSENT: the absence arm of the presence+non-empty chain (#1180 fix)
  // mirrors the old || shape — absent or [] both route to Human.male.
  Human: { male: ['Aldric', 'Bram'] },
};

const NAMES_WITH_EMPTY_HUMAN_FEMALE = {
  ...NAMES,
  // female key PRESENT but EMPTY []: pre-fix, `[] || fallback` short-circuited to
  // the empty array itself and pick([]) === undefined leaked an unnamed NPC slot.
  Human: { male: ['Aldric', 'Bram'], female: [] },
};

const NAMES_WITH_HUMAN_POOLS_EXHAUSTED = {
  Elf: { male: ['Legolas'], female: ['Arwen'] },
  // Human present, every gender pool empty: the terminal arm must go LOUD, not undefined.
  Human: { male: [], female: [] },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

async function loadGenerator({ names = NAMES, traits = TRAITS } = {}) {
  vi.resetModules();
  const fetchMock = vi.fn((url) => {
    const data = url === '/data/npc-names.json' ? names : traits;
    return Promise.resolve({ json: () => Promise.resolve(data) });
  });
  vi.stubGlobal('fetch', fetchMock);
  const mod = await import('./npcGenerator.js');
  return { mod, fetchMock };
}

// Sequence RNG pinned in documented slot order; overrun THROWS (loud decoy — any
// un-pinned consumption, e.g. a stat block rolling on a guard path, fails loudly).
function pinRandom(slots) {
  const queue = [...slots];
  Math.random = () => {
    if (queue.length === 0) {
      throw new Error('RNG overrun: generator consumed more randomness than pinned');
    }
    return queue.shift();
  };
}

// 12 base-path slots ending in includeStatBlock=false (<=0.3): the throw-on-overrun
// slot after value 12 proves the stat block consumed zero randomness.
const BASE_NO_STAT = [
  0.1, 0.7, 0.1, // race Human, gender male, name Aldric
  0.1, 0.1, 0.1, 0.1, 0.1, 0.1, // Warrior, Friendly, Tall, Brave, Wealth, None
  0.2, // numTags = 1
  0.5, // pickN -> 'soldier'
  0.2, // includeStatBlock = false
];

const originalRandom = Math.random;

afterEach(() => {
  // Intact-state teardown (#1161): restore real RNG + fetch for every subsequent test.
  // fix#357: restoreAllMocks FIRST (unwinds console.error/Math vi.spyOn chains —
  // vitest dedupes spyOn, so counts would otherwise leak across tests), THEN the raw
  // pinRandom restore (raw assignments are invisible to restoreAllMocks — the #1161
  // poison order this comment always warned about).
  vi.restoreAllMocks();
  Math.random = originalRandom;
  vi.unstubAllGlobals();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('generateNPC', () => {
  // Seed census (#903): two distinct seeds, each output pinned byte-exact (#1160);
  // the two pinned objects being different IS the byte-distinctness proof.
  it.each([
    {
      // CR2 via roll 0.85: prof 2, atk +3, actionsCount 2 (melee 0.3 + ranged 0.7),
      // dice floored to 2d (cr>=2), 2 traits rolls -> Frightful Presence. Hand-derived once (#815).
      label: 'CR2 Human Warrior: melee + ranged actions, roll traits',
      traits: TRAITS,
      slots: [
        0.4, 0.7, 0.2, // race Human, male, Aldric
        0.1, 0.1, 0.1, 0.1, 0.1, 0.1, // Warrior, Friendly, Tall, Brave, Wealth, None
        0.5, 0.1, 0.6, // numTags 2 -> merchant, hermit
        0.9, // includeStatBlock true
        0.85, 0.6, 0.38, 0.3, // cr 2, abilityScore 10+3+1=14, hp floor(.38*25)+51=60, ac floor(.3*4)+14=15
        0.5, // speed: no extra (0.5 <= 0.75)
        0.2, 0.25, // primary str=14; secondary others=['dex','con',...] idx1 -> con=10+2=12, dex stays 10
        0.3, 0.1, 0.05, 0.7, 0.9, // melee: Longsword 1d8->2d8, dice 6+8=14
        0.7, 0.1, 0.05, 0.5, 0.4, // ranged: Longbow 1d8->2d8, dice 5+4=9
        0.8, 0.8, // traits roll > 0.5 -> pool idx floor(.8*12)=9 Frightful Presence
      ],
      expected: {
        name: 'Aldric', race: 'Human', classRole: 'Warrior', attitude: 'Friendly',
        appearance: 'Tall', personality: 'Brave', goals: 'Wealth', secrets: 'None',
        tags: 'merchant, hermit', notes: '',
        armorClass: 15, hitPoints: '60', hitDice: '5d6+5', initiativeBonus: '0',
        speed: { walk: '30 ft.' },
        abilityScores: { str: 14, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
        savingThrowBonuses: {}, skillBonuses: {},
        damageResistances: [], damageImmunities: [], conditionImmunities: [],
        actions: [
          {
            name: 'Longsword', attack_bonus: '+3', damage_dice_primary: '2d8+2',
            damage_type_primary: 'Slashing',
            description: 'Melee Attack Roll: +3, reach 5 ft. Hit: 14 (2d8+2) Slashing damage.',
          },
          {
            // verbatim quirk pinned: ranged drops the ability mod from damage fields and
            // double-periods "ft.." because range strings already end in "ft."
            name: 'Longbow', attack_bonus: '+3', damage_dice_primary: '2d8',
            damage_type_primary: 'Piercing',
            description: 'Ranged Attack Roll: +3, range 150/600 ft.. Hit: 9 (2d8) Piercing damage.',
          },
        ],
        traits: "**Frightful Presence.** Each creature of the creature's choice within 30 feet must succeed on a DC 11 Wisdom saving throw or become frightened for 1 minute.",
        reactions: '',
      },
    },
    {
      // CR3 caster via 'Wizard' (cr roll 0.90 < 0.94): prof 2 + floor(3*0.7)=2 -> atk +4,
      // actionsCount 3 (spell, spell, melee<=0.4 — caster can still swing), fly speed branch
      // (0.8>0.75), spell 1d10->2d10 (cr>=2 floor), hitDice cr>=3 -> d8 + con bonus,
      // traits skipped (0.1). Spell rows pin the verbatim empty attack_bonus/damage fields.
      label: 'CR3 Elf Wizard: spell + spell + melee actions, fly speed, no traits',
      traits: { ...TRAITS, classRoles: ['Wizard'] },
      slots: [
        0.5, 0.9, 0.8, // race Elf, male, Elrond
        0.5, 0.9, 0.9, 0.5, 0.1, 0.5, // Wizard, Hostile, Stocky, Cautious, Wealth, dark past
        0.2, 0.5, // numTags 1 -> soldier
        0.9, // includeStatBlock true
        0.90, 0.8, 0.5, 0.3, // cr 3 (<0.94), abilityScore 10+4+1=15, hp floor(.5*25)+76=88, ac floor(.3*4)+15=16
        0.8, 0.1, // speed extra (cr>=2, 0.8>0.75) -> fly
        0.45, 0.85, // caster primary int=15, secondary cha=10+3=13; con=max(10,10+2)=12
        0.6, 0.1, 0.05, 0.65, 0.75, // spell: Firebolt 1d10->2d10, dice 7+8=15
        0.5, 0.6, 0.1, 0.6, 0.2, 0.7, // spell: Burning Hands 3d6, dice 4+2+5=11
        0.2, 0.3, 0.5, 0.4, 0.5, // melee: Warhammer 1d8->2d8, dice 4+5=9
        0.1, // traits roll <= 0.5 -> none
      ],
      expected: {
        name: 'Elrond', race: 'Elf', classRole: 'Wizard', attitude: 'Hostile',
        appearance: 'Stocky', personality: 'Cautious', goals: 'Wealth', secrets: 'Has a dark past',
        tags: 'soldier', notes: '',
        armorClass: 16, hitPoints: '88', hitDice: '7d8+7', initiativeBonus: '0',
        speed: { walk: '30 ft.', fly: '30 ft.' },
        abilityScores: { str: 10, dex: 10, con: 12, int: 15, wis: 10, cha: 13 },
        savingThrowBonuses: {}, skillBonuses: {},
        damageResistances: [], damageImmunities: [], conditionImmunities: [],
        actions: [
          {
            name: 'Firebolt', attack_bonus: '', damage_dice_primary: '',
            damage_type_primary: '',
            description: 'Spell Attack Roll: +4, range 60 ft.. Hit: 15 (2d10) Fire/Cold/Necrotic/Force/Radiant damage.',
          },
          {
            name: 'Burning Hands', attack_bonus: '', damage_dice_primary: '',
            damage_type_primary: '',
            description: 'Spell Attack Roll: +4, range 60 ft.. Hit: 11 (3d6) Fire/Thunder/Cold/Lightning/Radiant damage.',
          },
          {
            name: 'Warhammer', attack_bonus: '+4', damage_dice_primary: '2d8+2',
            damage_type_primary: 'Bludgeoning',
            description: 'Melee Attack Roll: +4, reach 5 ft. Hit: 9 (2d8+2) Bludgeoning damage.',
          },
        ],
        traits: '',
        reactions: '',
      },
    },
  ])('seed census: $label', async ({ traits, slots, expected }) => {
    const { mod } = await loadGenerator({ traits });
    pinRandom(slots);
    expect(await mod.generateNPC()).toEqual(expected);
  });

  it('no-stat-block guard: exact minimal output, stat block consumes zero RNG (overrun throws)', async () => {
    const { mod } = await loadGenerator();
    pinRandom(BASE_NO_STAT);

    const npc = await mod.generateNPC();

    expect(npc).toEqual({
      name: 'Aldric', race: 'Human', classRole: 'Warrior', attitude: 'Friendly',
      appearance: 'Tall', personality: 'Brave', goals: 'Wealth', secrets: 'None',
      tags: 'soldier', notes: '',
    });
  });

  // Name resolution lanes: exact names pin which pool the length-checked fallback
  // chain (source ~L294-309, #1180) chose.
  it.each([
    {
      label: 'race pool hit: Elf male draws from Elf.male',
      traits: { ...TRAITS, races: ['Elf'] },
      slots: [0.5, 0.7, 0.1, ...BASE_NO_STAT.slice(3)],
      name: 'Legolas', race: 'Elf',
    },
    {
      label: 'race absent from names table: female falls back to Human.female',
      traits: { ...TRAITS, races: ['Gnome'] },
      slots: [0.5, 0.4, 0.1, ...BASE_NO_STAT.slice(3)],
      name: 'Elena', race: 'Gnome',
    },
    {
      label: 'race female pool empty: falls back to Human.female (NOT Dwarf.male)',
      traits: { ...TRAITS, races: ['Dwarf'] },
      slots: [0.5, 0.4, 0.6, ...BASE_NO_STAT.slice(3)],
      name: 'Fiona', race: 'Dwarf',
    },
    {
      label: 'Human.female key absent: absence arm lands on Human.male',
      traits: { ...TRAITS, races: ['Human'] },
      names: NAMES_WITH_MISSING_HUMAN_FEMALE,
      slots: [0.5, 0.4, 0.6, ...BASE_NO_STAT.slice(3)],
      name: 'Bram', race: 'Human',
    },
    {
      // #1180 fixed: empty [] is truthy — pre-fix this rode the `|| []` terminal
      // into pick([]) === undefined and produced an unnamed NPC.
      label: 'Human.female present-but-empty []: non-empty arm falls back to Human.male (not undefined name-hole)',
      traits: { ...TRAITS, races: ['Human'] },
      names: NAMES_WITH_EMPTY_HUMAN_FEMALE,
      slots: [0.5, 0.4, 0.6, ...BASE_NO_STAT.slice(3)],
      name: 'Bram', race: 'Human',
    },
  ])('name lane: $label', async ({ traits, names = NAMES, slots, name, race }) => {
    const { mod } = await loadGenerator({ names, traits });
    pinRandom(slots);

    const npc = await mod.generateNPC();

    expect({ name: npc.name, race: npc.race }).toEqual({ name, race });
  });

  // #1180 terminal arm: every name pool empty/absent is LOUD — no undefined-name leak.
  it.each([
    {
      label: 'Human present with all gender pools empty: throws, no unnamed NPC',
      names: NAMES_WITH_HUMAN_POOLS_EXHAUSTED,
    },
    {
      label: 'Human key absent entirely and race pool empty: throws, no TypeError-on-undefined, no unnamed NPC',
      names: { Dwarf: { male: [], female: [] } },
    },
  ])('name-data exhausted lane: $label', async ({ names }) => {
    const { mod } = await loadGenerator({
      names,
      traits: { ...TRAITS, races: ['Dwarf'] },
    });
    pinRandom([0.5, 0.4]); // race Dwarf, gender female; consumed no further — throw precedes pick

    await expect(mod.generateNPC()).rejects.toThrow('name data has no usable pool');
  });

  // Unique-name suffix (custom-npc invariant contribution, see header).
  it.each([
    { label: 'collision appends " 2"', existing: [{ name: 'Aldric' }], name: 'Aldric 2' },
    { label: 'taken suffix " 2" is skipped, lands " 3"', existing: [{ name: 'Aldric' }, { name: 'Aldric 2' }], name: 'Aldric 3' },
    { label: 'undefined existingNPCs defaults to [] — no suffix', existing: undefined, name: 'Aldric' },
  ])('dedupe: $label', async ({ existing, name }) => {
    const { mod } = await loadGenerator();
    pinRandom(BASE_NO_STAT);

    const npc = await mod.generateNPC(existing);

    expect(npc.name).toBe(name);
  });

  // fix#357 x7 trait-picks: absent-or-empty pool is LOUD (console.error) + refused
  // (TypeError) at the pick site — never an `undefined` field riding onto the NPC
  // record (name-hole class twin, fix#197 census). Producer census: disk
  // npc-generator-traits.json ships races:15 classRoles:89 attitudes:5 appearances:101
  // personalities:79 goals:57 secrets:55 — every pool non-empty TODAY, so the guard
  // is unreachable on real data and all existing quiet pins stay byte-identical.
  it.each(['races', 'classRoles', 'attitudes', 'appearances', 'personalities', 'goals', 'secrets'].flatMap(pool => [
    { pool, traits: { ...TRAITS, [pool]: [] }, label: 'present-empty' },
    { pool, traits: Object.fromEntries(Object.entries(TRAITS).filter(([k]) => k !== pool)), label: 'key absent' },
  ]))('trait pool $pool $label: loud console.error + TypeError, no undefined field', async ({ traits }) => {
    const { mod } = await loadGenerator({ traits });
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    await expect(mod.generateNPC()).rejects.toThrow(TypeError);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('trait pool'));
  });

  // fix#357 preservation arm (authored-intent, pinned QUIET): a stat-block run —
  // the :189/:203/:218-era template(names) picks draw from this file's own parallel
  // non-empty literal tables — consumes ZERO console.error.
  it('quiet preservation (fix#357): stat-block generateNPC logs zero console.error', async () => {
    const { mod } = await loadGenerator();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const npc = await mod.generateNPC();

    expect(npc.armorClass).toBeGreaterThan(0); // stat block ran (templates consumed)
    expect(typeof npc.actions[0].name).toBe('string');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('fetches each data table exactly once per module lifetime (exact-if-fetch + cache)', async () => {
    const { mod, fetchMock } = await loadGenerator();
    pinRandom([...BASE_NO_STAT, 0.1, 0.7, 0.9, ...BASE_NO_STAT.slice(3)]);

    const npc1 = await mod.generateNPC();
    const npc2 = await mod.generateNPC();

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      '/data/npc-names.json',
      '/data/npc-generator-traits.json',
    ]);
    expect(npc1.tags).toBe('soldier');
    // second call re-rolls with cache served: name slot picks Bram, zero new fetches
    expect(npc2.name).toBe('Bram');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('propagates a fetch rejection without poisoning the cache', async () => {
    vi.resetModules();
    const failing = vi.fn(() => Promise.reject(new Error('Network failed')));
    vi.stubGlobal('fetch', failing);
    pinRandom(BASE_NO_STAT);

    const mod = await import('./npcGenerator.js');
    await expect(mod.generateNPC()).rejects.toThrow('Network failed');

    // failed load leaves the cache unset — retry with working fetch still generates
    const { fetchMock } = await loadGenerator();
    pinRandom(BASE_NO_STAT);
    const npc = await mod.generateNPC();
    expect(npc.name).toBe('Aldric');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
