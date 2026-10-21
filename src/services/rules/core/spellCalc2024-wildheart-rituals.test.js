// @maintained-by-ai
// CLA-234 regression: Path of the Wild Heart Nature Speaker / Animal Speaker.
// Commune with Nature / Beast Sense / Speak with Animals are castable ONLY as
// Rituals (no spell slot) with WISDOM as the spellcasting ability. getSpellAbilities
// must stamp the exact triple casting_time:'Ritual' + _ritualOnly:true +
// _ritualFeature:<feature> plus spellCastingAbility:'Wisdom' on the granted rows.
// Stamp placement (spellCalc2024.js, read 2026-10-20): the detail remap runs at :775,
// stampWildHeartRituals at :780 — AFTER the remap, so the clone-wipe trap in
// remapSpellRow (:697) cannot eat the stamps — and BEFORE the slot-level filter at
// :796, so _ritualOnly rows (keepSpellRow :745) survive with no slot at their level.
//
// Fixtures are read straight from disk (public/data/2024/classes.json Barbarian +
// public/data/2024/spells.json) and deep-cloned before use — disk is ground truth:
// major.spells entries carry the classes.json UNLOCK level verbatim, i.e.
// Commune with Nature is level:10 (the lv5 value is its spells.json base level,
// which the row picks up only via the detail remap).
//
// Owned elsewhere — cited, not duplicated:
//  - header spellCastingAbility 'Intelligence' + DC math — spellCalc2024-advanced.test.js:89
//  - major.spells unlock gate (absent lv9 / present lv10) — spellCalc2024-advanced.test.js:106
//  - Ritual Master feat stamps / Quick Ritual — spellCalc2024-ritualMaster.test.js
import { describe, it, expect, vi } from 'vitest';
import { cloneDeep } from 'lodash';
import classes2024 from '../../../../public/data/2024/classes.json';
import spells2024 from '../../../../public/data/2024/spells.json';
import { getSpellAbilities } from './spellCalc2024.js';

// ── Module-level mocks for all ESM dependencies ──
vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getHighestMajorLevel: () => undefined,
  },
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: () => null,
}));

// ── Disk-derived fixtures (read, never transcribed) ──

const DISK_BARBARIAN = classes2024.find(c => c.name === 'Barbarian');
const DISK_WILD_HEART = DISK_BARBARIAN.majors.find(m => m.name === 'Path of the Wild Heart');

// Ground-truth sanity on the disk inputs this file leans on: Nature Speaker's
// major.spells entry is the lv10 UNLOCK gate, and the spells.json base detail is lv5.
expect(DISK_WILD_HEART.spell_casting_ability).toBe('Wisdom');
expect(DISK_WILD_HEART.spells.find(s => s.name === 'Commune with Nature').level).toBe(10);

const RITUAL_DB_NAMES = ['Commune with Nature', 'Beast Sense', 'Speak with Animals'];

function spellDb() {
  return cloneDeep(
    spells2024.filter(s => [...RITUAL_DB_NAMES, 'Animal Friendship'].includes(s.name))
  );
}

// class_levels is the full disk ladder (spellCalc2024.js:502 resolves by level-1).
// required_major is re-pointed at the fixture's major so BOTH subjects keep a live
// casting container: on disk every Barbarian spellcasting row is gated to
// 'Path of the Wild Heart', so without this the Berserker counter-example would
// resolve to a null container and prove nothing about the stamp gate. For the
// Wild Heart subject the re-point is a no-op — disk bytes.
function makeBarbarianStats({ level = 13, major = cloneDeep(DISK_WILD_HEART) } = {}) {
  return {
    name: 'WildHeartTest',
    level,
    proficiency: DISK_BARBARIAN.class_levels[level - 1].proficiency_bonus
      ?? (level >= 13 ? 5 : 4),
    class: {
      name: 'Barbarian',
      // Disk ground truth: the Barbarian class itself declares Intelligence; only the
      // per-spell stamp below carries the major's Wisdom. Header ability is pinned in
      // spellCalc2024-advanced.test.js — not re-pinned here.
      spell_casting_ability: DISK_BARBARIAN.spell_casting_ability,
      major,
      class_levels: DISK_BARBARIAN.class_levels.map(cl => ({
        ...cl,
        spellcasting: cl.spellcasting
          ? { ...cl.spellcasting, required_major: major.name }
          : cl.spellcasting,
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

const findSpell = (result, name) => result.spells.find(s => s.name === name);

describe('spellCalc2024 — Path of the Wild Heart ritual grants (CLA-234)', () => {
  it('stamps every granted spell with the exact ritual triple + Wisdom, and leaves ungranted spells byte-clean', () => {
    const result = getSpellAbilities(spellDb(), makeBarbarianStats({ level: 13 }));

    // Exact-bytes stamp triple (owned here, cited by spellCalc2024-advanced :17 and
    // spellCalc2024-ritualMaster :10): casting_time overwrites the DB byte
    // ('1 minute or Ritual' / 'Action or Ritual'), + _ritualOnly + _ritualFeature.
    const stamps = [
      ['Commune with Nature', 'Nature Speaker'],
      ['Beast Sense', 'Animal Speaker'],
      ['Speak with Animals', 'Animal Speaker'],
    ];
    stamps.forEach(([name, feature]) => {
      const row = findSpell(result, name);
      expect(row, name).toBeTruthy();
      expect(row.casting_time, name).toBe('Ritual');
      expect(row._ritualOnly, name).toBe(true);
      expect(row._ritualFeature, name).toBe(feature);
      expect(row.spellCastingAbility, name).toBe('Wisdom');
      expect(row.prepared, name).toBe('Always');
    });

    // Falsifier: a class-list spell with no major ritual grant keeps no stamp keys and
    // its un-overwritten disk casting_time byte — the stamp must key strictly by name.
    const animalFriendship = findSpell(result, 'Animal Friendship');
    expect(animalFriendship).toBeTruthy();
    expect(animalFriendship.casting_time).toBe('Action');
    expect(animalFriendship._ritualOnly).toBeUndefined();
    expect(animalFriendship._ritualFeature).toBeUndefined();
    expect(animalFriendship.spellCastingAbility).toBeUndefined();

    // Container hygiene: the disk table carries spells_known:0 — never NaN.
    expect(result.spells_known).toBe(0);
  });

  it('keeps Commune with Nature alive past the slot-level filter at lv10 (no lv5 slot exists)', () => {
    // The CLA-234 placement falsifier: if stampWildHeartRituals (:780) ever moved
    // AFTER the keepSpellRow filter (:796), this lv5 row on a lv5-slot-zero lv10
    // Barbarian would silently vanish. (Unlock gate absent-lv9/present-lv10 is owned
    // by spellCalc2024-advanced.test.js:106 — not re-pinned here.)
    const result = getSpellAbilities(spellDb(), makeBarbarianStats({ level: 10 }));

    expect(result.spell_slots_level_5).toBe(0);
    const commune = findSpell(result, 'Commune with Nature');
    expect(commune).toBeTruthy();
    expect(commune.level).toBe(5); // spells.json base level via the detail remap
    expect(commune.casting_time).toBe('Ritual');
    expect(commune._ritualOnly).toBe(true);
    expect(commune._ritualFeature).toBe('Nature Speaker');
    expect(commune.spellCastingAbility).toBe('Wisdom');
    expect(commune.prepared).toBe('Always');
  });

  it('does not stamp a non-Wild Heart barbarian casting the same spell from its own list', () => {
    // Falsifies the major-name guard at spellCalc2024.js:780: same DB detail, same
    // player list — no Wild Heart major, no ritual stamps, casting_time stays disk bytes.
    const berserker = { name: 'Path of the Berserker', features: [], spells: [] };
    const stats = makeBarbarianStats({ level: 13, major: berserker });
    stats.spells = ['Commune with Nature'];

    const result = getSpellAbilities(spellDb(), stats);

    const commune = findSpell(result, 'Commune with Nature');
    expect(commune).toBeTruthy();
    expect(commune.casting_time).toBe('1 minute or Ritual');
    expect(commune._ritualOnly).toBeUndefined();
    expect(commune._ritualFeature).toBeUndefined();
    expect(commune.spellCastingAbility).toBeUndefined();
  });

  it('still stamps ritual-only and logs the exact error when the major omits spell_casting_ability', () => {
    // spellCalc2024.js:431-432 diagnostic branch: the ritual flags must land even
    // when the ability cannot be stamped, and the sheet must not fail open silently.
    const errorSpy = vi.spyOn(console, 'error');
    const noAbilityMajor = cloneDeep(DISK_WILD_HEART);
    delete noAbilityMajor.spell_casting_ability;

    const result = getSpellAbilities(spellDb(), makeBarbarianStats({ level: 13, major: noAbilityMajor }));

    const commune = findSpell(result, 'Commune with Nature');
    expect(commune.casting_time).toBe('Ritual');
    expect(commune._ritualOnly).toBe(true);
    expect(commune._ritualFeature).toBe('Nature Speaker');
    expect(commune.spellCastingAbility).toBeUndefined();
    expect(errorSpy).toHaveBeenCalledWith(
      '[spellCalc2024] Path of the Wild Heart major is missing spell_casting_ability'
    );
    errorSpy.mockRestore();
  });
});
