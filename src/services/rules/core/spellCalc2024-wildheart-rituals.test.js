// CLA-234 regression: Path of the Wild Heart Nature Speaker / Animal Speaker.
// Commune with Nature / Beast Sense / Speak with Animals are castable ONLY as
// Rituals (no spell slot) with WISDOM as the spellcasting ability. getSpellAbilities
// must stamp _ritualOnly + _ritualFeature + spellCastingAbility:'Wisdom' on the
// granted spells (per-spell override, CLA-212 carry pattern) while the Barbarian
// class-wide spellCastingAbility stays Intelligence (JSON is ground truth), and the
// spells must survive the "no spell slots at this level" filter even when the
// Barbarian slot table has no slot at that spell level (lv10 → lv5 spell).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc2024.js';

// ── Module-level mocks for all ESM dependencies ──
vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: vi.fn(() => undefined),
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_key, _prop) => null),
}));

// ── Fixtures ──

// major.spells entries carry the SPELL's own level (matches classes.json data).
const WILD_HEART_SPELLS = [
  { name: 'Speak with Animals', level: 1 },
  { name: 'Beast Sense', level: 2 },
  { name: 'Commune with Nature', level: 5 },
];

function makeWildHeartMajor() {
  return {
    name: 'Path of the Wild Heart',
    spell_casting_ability: 'Wisdom',
    features: [
      { name: 'Animal Speaker', description: 'You can cast the Beast Sense and Speak with Animals spells but only as Rituals. Wisdom is your spellcasting ability for them.', level: 3 },
      { name: 'Nature Speaker', description: 'You can cast the Commune with Nature spell but only as a Ritual. Wisdom is your spellcasting ability for it.', level: 10 },
    ],
    spells: WILD_HEART_SPELLS,
  };
}

function makeSpellDetail(name, level, extra = {}) {
  return {
    name,
    level,
    casting_time: level === 0 ? '1 action' : '1 minute or Ritual',
    range: 'Self',
    damage: null,
    ritual: true,
    school: 'Divination',
    description: [`<p>${name} spell text.</p>`],
    ...extra,
  };
}

function makeBarbarianStats({ level = 13, major = makeWildHeartMajor() } = {}) {
  const lv5Slots = level >= 13 ? 1 : 0;
  const lv6Slots = level >= 13 ? 1 : 0;
  // required_major mirrors the character's actual major so spellcasting resolves
  // for both the Wild Heart subject and the Berserker control.
  const requiredMajor = major.name;
  return {
    name: 'DraconicDragon',
    level,
    proficiency: level >= 13 ? 5 : 4,
    class: {
      name: 'Barbarian',
      spell_casting_ability: 'Intelligence',
      major,
      class_levels: Array.from({ length: level }, (_, i) => ({
        level: i + 1,
        spellcasting: {
          required_major: requiredMajor,
          cantrips_known: 0,
          spells_known: 0,
          spell_type: 'known',
          spell_slots_level_1: 4,
          spell_slots_level_2: 3,
          spell_slots_level_3: 3,
          spell_slots_level_4: 2,
          spell_slots_level_5: i + 1 >= 13 ? 1 : lv5Slots,
          spell_slots_level_6: i + 1 >= 13 ? 1 : lv6Slots,
          spell_slots_level_7: 0,
          spell_slots_level_8: 0,
          spell_slots_level_9: 0,
          spellCastingAbility: 'Intelligence',
        },
      })),
    },
    abilities: [
      { name: 'Intelligence', baseScore: 8, bonus: -1 },
      { name: 'Wisdom', baseScore: 15, bonus: 3 },
    ],
    spells: ['Animal Friendship'],
    automation: {},
  };
}

function allSpellsFixture() {
  return [
    makeSpellDetail('Commune with Nature', 5),
    makeSpellDetail('Beast Sense', 2),
    makeSpellDetail('Speak with Animals', 1),
    makeSpellDetail('Animal Friendship', 1),
  ];
}

describe('spellCalc2024 — Path of the Wild Heart ritual grants (CLA-234)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('stamps Commune with Nature as ritual-only with Wisdom casting ability at lv13', () => {
    const result = getSpellAbilities(allSpellsFixture(), makeBarbarianStats({ level: 13 }));

    const commune = result.spells.find(s => s.name === 'Commune with Nature');
    expect(commune).toBeTruthy();
    expect(commune.casting_time).toBe('Ritual');
    expect(commune._ritualOnly).toBe(true);
    expect(commune._ritualFeature).toBe('Nature Speaker');
    expect(commune.spellCastingAbility).toBe('Wisdom');
  });

  it('stamps Animal Speaker spells (Beast Sense, Speak with Animals) ritual-only with Wisdom', () => {
    const result = getSpellAbilities(allSpellsFixture(), makeBarbarianStats({ level: 13 }));

    const beastSense = result.spells.find(s => s.name === 'Beast Sense');
    const speakAnimals = result.spells.find(s => s.name === 'Speak with Animals');
    expect(beastSense._ritualOnly).toBe(true);
    expect(beastSense._ritualFeature).toBe('Animal Speaker');
    expect(beastSense.spellCastingAbility).toBe('Wisdom');
    expect(speakAnimals._ritualOnly).toBe(true);
    expect(speakAnimals.spellCastingAbility).toBe('Wisdom');
  });

  it('keeps the class-wide spellCastingAbility Intelligence (Barbarian JSON is ground truth) but overrides per-spell Wisdom', () => {
    const result = getSpellAbilities(allSpellsFixture(), makeBarbarianStats({ level: 13 }));

    expect(result.spellCastingAbility).toBe('Intelligence');
    // Class-list spell without a major grant keeps no per-spell override.
    const animalFriendship = result.spells.find(s => s.name === 'Animal Friendship');
    expect(animalFriendship._ritualOnly).toBeUndefined();
    expect(animalFriendship.spellCastingAbility).toBeUndefined();
  });

  it('keeps Commune with Nature past the slot-level filter at lv10 where the Barbarian has no lv5 slots', () => {
    const result = getSpellAbilities(allSpellsFixture(), makeBarbarianStats({ level: 10 }));

    // Sanity: no lv5+ slots declared at lv10.
    expect(result.spell_slots_level_5 || 0).toBe(0);
    const commune = result.spells.find(s => s.name === 'Commune with Nature');
    expect(commune).toBeTruthy();
    expect(commune._ritualOnly).toBe(true);
  });

  it('does not stamp ritual-only flags for a non-Wild Heart barbarian', () => {
    const berserkerMajor = { name: 'Path of the Berserker', features: [], spells: [] };
    const stats = makeBarbarianStats({ level: 13, major: berserkerMajor });
    // Major-granted Commune with Nature still added via major spells list? No — Berserker has none;
    // keep the spell in the player list so we can check it is NOT stamped.
    stats.spells = ['Commune with Nature'];

    const result = getSpellAbilities(allSpellsFixture(), stats);

    const commune = result.spells.find(s => s.name === 'Commune with Nature');
    expect(commune).toBeTruthy();
    expect(commune._ritualOnly).toBeUndefined();
    expect(commune.spellCastingAbility).toBeUndefined();
    expect(commune.casting_time).not.toBe('Ritual');
  });

  it('carries the spellCastingAbility override through the full-spell-detail remap (CLA-212 pattern)', () => {
    // The granted entry starts as a bare {name, prepared} pushed by the major-spells
    // grant; the remap clones the spells.json detail — the stamped Wisdom must survive.
    const result = getSpellAbilities(allSpellsFixture(), makeBarbarianStats({ level: 13 }));
    const commune = result.spells.find(s => s.name === 'Commune with Nature');
    // Full detail remap fields present:
    expect(commune.description).toBeTruthy();
    expect(commune.school).toBe('Divination');
    // Override fields still present:
    expect(commune.spellCastingAbility).toBe('Wisdom');
    expect(commune._ritualOnly).toBe(true);
    expect(commune._ritualFeature).toBe('Nature Speaker');
  });
});
