// @maintained-by-ai
// spellCalc2024 twin lane. Scope: 2024 Path-of-the-Wild-Heart behavior NOT owned by siblings,
// pinned against disk ground truth (public/data/2024/classes.json Barbarian, read 2026-10-20:
// class spell_casting_ability is 'Intelligence'; major declares 'Wisdom'; major.spells carry
// unlock levels — Speak with Animals 1, Beast Sense 2, Commune with Nature 10).
//
// Owned elsewhere — cited, not duplicated:
//  - 'returns null when class level has no spellcasting and getHighestMajorLevel returns nothing'
//    — spellCalc2024.test.js:60 (covers the old Berserker-null test folded from this file)
//  - 'falls back to getHighestMajorLevel when class_levels lack spellcasting'
//    — spellCalc2024.test.js:120 (covers the old lv3 fallback-grant test folded from this file;
//    its Wisdom-header fixture was disk-inaccurate — the class's own Intelligence wins)
//  - 'returns spell abilities from class level spellcasting' (header DC math 8+3+2)
//    — spellCalc2024.test.js:86
//  - 'marks all spells Always prepared for non-wizard 2024 classes'
//    — spellCalc2024.test.js:235
//  - Wild Heart per-spell ritual stamps (_ritualOnly/_ritualFeature/casting_time 'Ritual',
//    per-spell Wisdom) and lv10 lv5-slotless survival — spellCalc2024-wildheart-rituals.test.js
//    (CLA-234). This file only pins the header-ability selection and the major.spells level gate.
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

// ── Fixtures (Barbarian class_levels rows transcribed verbatim from classes.json) ──

const DISK_CLASS_LEVELS = {
  1: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_type: 'known', spell_slots_level_1: 0, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_slots_level_5: 0, spell_slots_level_6: 0, spell_slots_level_7: 0, spell_slots_level_8: 0, spell_slots_level_9: 0, spellCastingAbility: 'Intelligence' },
  3: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_type: 'known', spell_slots_level_1: 2, spell_slots_level_2: 0, spell_slots_level_3: 0, spell_slots_level_4: 0, spell_slots_level_5: 0, spell_slots_level_6: 0, spell_slots_level_7: 0, spell_slots_level_8: 0, spell_slots_level_9: 0, spellCastingAbility: 'Intelligence' },
  9: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_type: 'known', spell_slots_level_1: 4, spell_slots_level_2: 3, spell_slots_level_3: 3, spell_slots_level_4: 1, spell_slots_level_5: 0, spell_slots_level_6: 0, spell_slots_level_7: 0, spell_slots_level_8: 0, spell_slots_level_9: 0, spellCastingAbility: 'Intelligence' },
  10: { required_major: 'Path of the Wild Heart', cantrips_known: 0, spells_known: 0, spell_type: 'known', spell_slots_level_1: 4, spell_slots_level_2: 3, spell_slots_level_3: 3, spell_slots_level_4: 2, spell_slots_level_5: 0, spell_slots_level_6: 0, spell_slots_level_7: 0, spell_slots_level_8: 0, spell_slots_level_9: 0, spellCastingAbility: 'Intelligence' },
};

// major.spells entries carry the classes.json unlock level verbatim (Commune lv10).
function makeWildHeartBarbarianStats({ level, proficiency }) {
  return {
    name: 'WildHeartTest',
    level,
    proficiency,
    class: {
      name: 'Barbarian',
      // Disk ground truth: Barbarian class itself declares Intelligence.
      spell_casting_ability: 'Intelligence',
      major: {
        name: 'Path of the Wild Heart',
        spell_casting_ability: 'Wisdom',
        spells: [
          { name: 'Speak with Animals', level: 1 },
          { name: 'Beast Sense', level: 2 },
          { name: 'Commune with Nature', level: 10 },
        ],
      },
      class_levels: Array.from({ length: level }, (_, i) => {
        const row = DISK_CLASS_LEVELS[i + 1];
        return row ? { level: i + 1, spellcasting: row } : { level: i + 1 };
      }),
    },
    // Wisdom decoy: if the header ever resolved through major.spell_casting_ability,
    // modifier/toHit/saveDc below would all shift upward and the test would fail.
    abilities: [
      { name: 'Intelligence', baseScore: 16, bonus: 3 },
      { name: 'Wisdom', baseScore: 20, bonus: 5 },
    ],
    spells: [],
    automation: {},
  };
}

const SPELL_DB = [
  { name: 'Speak with Animals', level: 1, casting_time: '1 action', range: '10 feet', school: 'Divination' },
  { name: 'Beast Sense', level: 2, casting_time: '1 action', range: 'Touch', school: 'Divination' },
  { name: 'Commune with Nature', level: 5, casting_time: '1 minute', range: '1 mile', school: 'Divination' },
];

describe('spellCalc2024-advanced — Path of the Wild Heart', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('computes the header from the class Intelligence — the major\'s Wisdom never promotes to header math (CLA-234 disk ground truth)', () => {
    // lv3 is when this major's table and grants switch on (required_major row appears here).
    const result = getSpellAbilities(SPELL_DB, makeWildHeartBarbarianStats({ level: 3, proficiency: 2 }));

    expect(result).not.toBeNull();
    expect(result.spellCastingAbility).toBe('Intelligence');
    expect(result.modifier).toBe(3);
    expect(result.toHit).toBe(5);
    expect(result.saveDc).toBe(13);
    expect(result.cantrips_known).toBe(0);
    expect(result.spell_slots_level_1).toBe(2);
    // Grants enter the known list the same lv3 the required_major table starts.
    expect(result.spells.map(s => s.name).sort()).toEqual(['Beast Sense', 'Speak with Animals']);
    // Per-spell Wisdom/ritual-only stamps on these rows are pinned in
    // spellCalc2024-wildheart-rituals.test.js (CLA-234) — not re-pinned here.
  });

  it('gates major.spells on the classes.json unlock level — Commune with Nature joins exactly at lv10, not lv9', () => {
    const lv9Names = getSpellAbilities(SPELL_DB, makeWildHeartBarbarianStats({ level: 9, proficiency: 4 })).spells.map(s => s.name);
    expect(lv9Names).not.toContain('Commune with Nature');

    const lv10 = getSpellAbilities(SPELL_DB, makeWildHeartBarbarianStats({ level: 10, proficiency: 4 }));
    expect(lv10.spells.map(s => s.name)).toContain('Commune with Nature');
    // Disk lv10 has no lv5 slot; the row's survival past the slot filter is owned by
    // spellCalc2024-wildheart-rituals.test.js 'keeps Commune with Nature past the
    // slot-level filter at lv10…' (CLA-234). Header DC at half-caster lv10: 8+3+4.
    expect(lv10.saveDc).toBe(15);
  });
});
