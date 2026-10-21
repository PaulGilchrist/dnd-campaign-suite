// @maintained-by-ai
// Base spellCalc coverage: the spellcasting gate, DC math, race traits, subclass
// cantrip/school adjustments, class prepared rules, catalog population, sorting and
// the feat/race fallback. Subclass-prerequisite, passive-gate and spell-thief
// block/stolen list branches are owned by spellCalc-advanced.test.js (#1262).
import { describe, it, expect, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc.js';
import { getStore } from '../../../hooks/runtime/useRuntimeState.js';

const ABILITIES = [
  { name: 'Intelligence', bonus: 4 },
  { name: 'Wisdom', bonus: 3 },
  { name: 'Charisma', bonus: 2 },
  { name: 'Strength', bonus: 1 },
  { name: 'Dexterity', bonus: 0 },
  { name: 'Constitution', bonus: -1 },
];

// Level-5 default with the standard proficiency formula. Class overrides merge onto
// the full Wizard scaffold so callers never rebuild class_levels by hand.
const makePlayerStats = (overrides = {}) => {
  const level = overrides.level ?? 5;
  return {
    name: 'TestWizard',
    level,
    proficiency: overrides.proficiency ?? Math.floor((level - 1) / 4) + 2,
    abilities: overrides.abilities ?? ABILITIES,
    class: {
      name: 'Wizard',
      spell_casting_ability: 'Intelligence',
      major: null,
      subclass: null,
      class_levels: Array.from({ length: level }, () => ({ spellcasting: null })),
      ...(overrides.class || {}),
    },
    race: { name: 'Human', subrace: null, ...(overrides.race || {}) },
    spells: overrides.spells ?? null,
  };
};

const setSpellcasting = (playerStats, spellcasting) => {
  playerStats.class.class_levels[playerStats.level - 1] = { spellcasting };
};

const spellcasting = (opts = {}) => ({
  cantrips_known: 3,
  spells_known: 0,
  spellCastingAbility: 'Intelligence',
  ...opts,
});

const names = (result) => result.spells.map(s => s.name);

const casterWith = (castingAbility, { class: classOverrides, spellcasting: scOverrides, ...rest } = {}) => {
  const stats = makePlayerStats({
    ...rest,
    class: { spell_casting_ability: castingAbility, ...classOverrides },
  });
  setSpellcasting(stats, spellcasting({ spellCastingAbility: castingAbility, ...scOverrides }));
  return stats;
};

describe('spellCalc', () => {
  beforeEach(() => {
    const store = getStore('TestWizard');
    Array.from(store.keys()).forEach(key => store.delete(key));
  });

  describe('getSpellAbilities', () => {
    it('gates spellcasting on container presence and required_major', () => {
      // No class spellcasting row and no fallback spells: nothing to build from.
      expect(getSpellAbilities([], makePlayerStats())).toBeNull();

      // required_major matching neither major nor subclass blocks the row.
      const blocked = casterWith('Intelligence', {
        spellcasting: { required_major: 'OtherSubclass' },
        class: { major: { name: 'Evocation' } },
      });
      expect(getSpellAbilities([], blocked)).toBeNull();

      // Matching the major name admits the row...
      const majorMatch = casterWith('Intelligence', {
        spellcasting: { required_major: 'Evocation' },
        class: { major: { name: 'Evocation' } },
      });
      const majorResult = getSpellAbilities([], majorMatch);
      expect(majorResult.spellCastingAbility).toBe('Intelligence');
      expect(majorResult.saveDc).toBe(15);

      // ...and so does matching the subclass name.
      const subclassMatch = casterWith('Intelligence', {
        spellcasting: { required_major: 'School of Necromancy' },
        class: { subclass: { name: 'School of Necromancy' } },
      });
      const subclassResult = getSpellAbilities([], subclassMatch);
      expect(subclassResult.spellCastingAbility).toBe('Intelligence');
      expect(subclassResult.saveDc).toBe(15);
    });

    it('computes modifier, toHit and saveDc from the resolved casting ability', () => {
      const castWith = (ability) => getSpellAbilities([], casterWith(ability));
      // Level 5: proficiency +3, save DC = 8 + mod + prof.
      expect(castWith('Intelligence')).toMatchObject({ modifier: 4, toHit: 7, saveDc: 15 });
      // Falsifying swap: INT -> CHA moves DC and toHit by the ability delta (-2).
      expect(castWith('Charisma')).toMatchObject({ modifier: 2, toHit: 5, saveDc: 13 });
      // Negative modifiers subtract from both.
      expect(castWith('Constitution')).toMatchObject({ modifier: -1, toHit: 2, saveDc: 10 });
    });

    it('stacks Tiefling traits with a level-3 gate on Hellish Rebuke', () => {
      const tieflingAt = (level) => {
        const stats = makePlayerStats({ level, race: { name: 'Tiefling', subrace: null } });
        setSpellcasting(stats, spellcasting());
        return getSpellAbilities([], stats);
      };
      // Level 3 boundary: both traits granted, stamped Always on top of class
      // casting. Catalog-less rows sort alphabetically (localeCompare fallback).
      const lvl3 = tieflingAt(3);
      expect(lvl3.cantrips_known).toBe(4);
      expect(lvl3.spells).toEqual([
        { name: 'Hellish Rebuke', prepared: 'Always' },
        { name: 'Thaumaturgy', prepared: 'Always' },
      ]);
      expect(lvl3.spells_known).toBe(1);

      // Below level 3: only Thaumaturgy.
      const lvl2 = tieflingAt(2);
      expect(lvl2.cantrips_known).toBe(4);
      expect(names(lvl2)).toEqual(['Thaumaturgy']);
      expect(lvl2.spells_known).toBe(0);
    });

    it('grants High Elf cantrip count and Forest Gnome Minor Illusion while casting', () => {
      const highElf = casterWith('Intelligence', { race: { name: 'Elf', subrace: { name: 'High Elf' } } });
      const heResult = getSpellAbilities([], highElf);
      expect(heResult.cantrips_known).toBe(4);
      // High Elf bumps the count only — no spell row is stamped.
      expect(heResult.spells).toEqual([]);

      const gnome = casterWith('Intelligence', { race: { name: 'Gnome', subrace: { name: 'Forest Gnome' } } });
      const fgResult = getSpellAbilities([], gnome);
      expect(fgResult.cantrips_known).toBe(4);
      expect(fgResult.spells).toEqual([{ name: 'Minor Illusion', prepared: 'Always' }]);
    });

    it('creates a race-only spellcasting container for non-caster classes', () => {
      // Tiefling Barbarian: Charisma container with its trait spells.
      const tiefling = getSpellAbilities([], makePlayerStats({
        class: { name: 'Barbarian', spell_casting_ability: null },
        race: { name: 'Tiefling', subrace: null },
      }));
      expect(tiefling.spellCastingAbility).toBe('Charisma');
      expect(tiefling.cantrips_known).toBe(1);
      expect(tiefling.spells_known).toBe(1);
      expect(tiefling.spells).toEqual([
        { name: 'Hellish Rebuke', prepared: 'Always' },
        { name: 'Thaumaturgy', prepared: 'Always' },
      ]);
      // Container ability resolves through the ability rows: CHA +2, prof +3.
      expect(tiefling).toMatchObject({ modifier: 2, toHit: 5, saveDc: 13 });

      // High Elf Ranger: Intelligence container, cantrip count only.
      const highElf = getSpellAbilities([], makePlayerStats({
        class: { name: 'Ranger', spell_casting_ability: null },
        race: { name: 'Elf', subrace: { name: 'High Elf' } },
      }));
      expect(highElf.spellCastingAbility).toBe('Intelligence');
      expect(highElf.cantrips_known).toBe(1);
      expect(highElf.spells).toEqual([]);

      // Forest Gnome Fighter: Intelligence container with stamped Minor Illusion.
      const gnome = getSpellAbilities([], makePlayerStats({
        class: { name: 'Fighter', spell_casting_ability: null },
        race: { name: 'Gnome', subrace: { name: 'Forest Gnome' } },
      }));
      expect(gnome.spellCastingAbility).toBe('Intelligence');
      expect(gnome.cantrips_known).toBe(1);
      expect(gnome.spells).toEqual([{ name: 'Minor Illusion', prepared: 'Always' }]);
    });

    it('applies subclass bonus cantrips: Light pushes a row, Nature bumps the count', () => {
      const light = makePlayerStats({ class: { subclass: { name: 'Light' } }, spells: ['Fire Bolt'] });
      setSpellcasting(light, spellcasting());
      const lightResult = getSpellAbilities([], light);
      expect(lightResult.cantrips_known).toBe(4);
      expect(lightResult.spells).toEqual([
        { name: 'Fire Bolt', prepared: '' },
        { name: 'Light', prepared: '' },
      ]);

      // Nature (Druid): +1 cantrip, no pushed row; Druids know the whole class
      // list. spells must be non-null to reach the subclass-bonus branch
      // (applyClassSpellListAndSubclassBonus early-returns on null).
      const nature = casterWith('Wisdom', {
        class: { name: 'Druid', subclass: { name: 'Nature' } },
        spells: [],
        spellcasting: { cantrips_known: 2 },
      });
      const natureResult = getSpellAbilities([], nature);
      expect(natureResult.cantrips_known).toBe(3);
      expect(natureResult.spells).toEqual([]);
      expect(natureResult.spells_known).toBeNull();
    });

    it('sets school limits and arcane trickster cantrip bonus', () => {
      // Arcane Trickster pushes Mage Hand when absent and adds 3 cantrips;
      // Rogue is an all-prepared class so the pushed row is stamped Always.
      // (spells: [] — non-null is required to reach the bonus-cantrip branch.)
      const trickster = makePlayerStats({ class: { name: 'Rogue', subclass: { name: 'Arcane Trickster' } }, spells: [] });
      setSpellcasting(trickster, spellcasting());
      const trickResult = getSpellAbilities([], trickster);
      expect(trickResult.schoolLimits).toEqual(['enchantment', 'illusion']);
      expect(trickResult.cantrips_known).toBe(6);
      expect(trickResult.spells).toEqual([{ name: 'Mage Hand', prepared: 'Always' }]);

      // Eldritch Knight gets its own limit pair and no bonus cantrips.
      const knight = makePlayerStats({ class: { name: 'Fighter', subclass: { name: 'Eldritch Knight' } } });
      setSpellcasting(knight, spellcasting());
      const knightResult = getSpellAbilities([], knight);
      expect(knightResult.schoolLimits).toEqual(['abjuration', 'evocation']);
      expect(knightResult.cantrips_known).toBe(3);
      expect(knightResult.spells).toEqual([]);
    });

    it('caps prepared spells by class formula (full caster and half caster)', () => {
      // Wizard level 5 + INT +4 = 9.
      expect(getSpellAbilities([], casterWith('Intelligence')).maxPreparedSpells).toBe(9);
      // Paladin half-caster: CHA +2 + floor(5/2) = 4.
      expect(getSpellAbilities([], casterWith('Charisma', { class: { name: 'Paladin' } })).maxPreparedSpells).toBe(4);
    });

    it('marks every spell Always and sets no cap for all-prepared classes', () => {
      const allSpells = [
        { name: 'Charm Person', level: 1, classes: ['Sorcerer'] },
        { name: 'Fire Bolt', level: 0, classes: ['Sorcerer'] },
      ];
      const result = getSpellAbilities(allSpells, casterWith('Charisma', {
        class: { name: 'Sorcerer' },
        spells: ['Charm Person', 'Fire Bolt'],
        spellcasting: { spells_known: 3 },
      }));
      expect(result.maxPreparedSpells).toBeUndefined();
      expect(result.spells.map(s => [s.name, s.prepared])).toEqual([
        ['Fire Bolt', 'Always'],
        ['Charm Person', 'Always'],
      ]);
    });

    it('expands rows from the catalog, stamps cantrips Always, preserves unknown spells', () => {
      const allSpells = [
        { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
        { name: 'Magic Missile', level: 1, classes: ['Wizard'] },
      ];
      const wizard = makePlayerStats({ spells: ['Magic Missile', 'Fire Bolt', 'Unknown Spell'] });
      setSpellcasting(wizard, spellcasting());
      const result = getSpellAbilities(allSpells, wizard);

      const fireBolt = result.spells.find(s => s.name === 'Fire Bolt');
      expect(fireBolt.level).toBe(0); // expanded from the catalog
      expect(fireBolt.prepared).toBe('Always'); // cantrips are never "prepareable"

      // Leveled wizard spells keep their unprepared status; the prepared class is
      // NOT blanket-stamped (contrast with the all-prepared default branch above).
      const magicMissile = result.spells.find(s => s.name === 'Magic Missile');
      expect(magicMissile.level).toBe(1);
      expect(magicMissile.prepared).toBe('');

      // Spells missing from the catalog pass through as bare rows.
      expect(result.spells.find(s => s.name === 'Unknown Spell')).toEqual({ name: 'Unknown Spell', prepared: '' });
    });

    it('populates the full Druid class list filtered by class and slot level', () => {
      const allSpells = [
        { name: 'Acid Splash', level: 1, classes: ['Druid'] },
        { name: 'Sacred Flame', level: 1, classes: ['Druid'] },
        { name: 'Cure Wounds', level: 1, classes: ['Cleric'] },
        { name: 'Shapechange', level: 9, classes: ['Druid'] },
        { name: 'Druidcraft', level: 0, classes: ['Druid'] },
      ];
      const result = getSpellAbilities(allSpells, casterWith('Wisdom', {
        class: { name: 'Druid' },
        spellcasting: { spell_slots_level_1: 2 },
      }));
      expect(result.spells_known).toBeNull(); // whole class list is "known"
      // Class filter drops Cure Wounds, slot ceiling drops Shapechange,
      // cantrips are handled by cantrips_known, not the spell list.
      expect(names(result)).toEqual(['Acid Splash', 'Sacred Flame']);
    });

    it('sorts spells by level ascending then name alphabetically', () => {
      const allSpells = [
        { name: 'Fireball', level: 3, classes: ['Wizard'] },
        { name: 'Magic Missile', level: 1, classes: ['Wizard'] },
        { name: 'Shield', level: 1, classes: ['Wizard'] },
        { name: 'Charm Person', level: 1, classes: ['Wizard'] },
        { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
      ];
      const wizard = makePlayerStats({ spells: ['Fireball', 'Magic Missile', 'Shield', 'Charm Person', 'Fire Bolt'] });
      setSpellcasting(wizard, spellcasting());
      expect(names(getSpellAbilities(allSpells, wizard))).toEqual([
        'Fire Bolt', 'Charm Person', 'Magic Missile', 'Shield', 'Fireball',
      ]);
    });

    it('feat/race fallback builds half-caster slots capped to highest known spell level', () => {
      // Honest pin of current behavior (spellCalc.js:90-117): the fallback honors
      // playerStats.spells for slot sizing but DROPS the spell rows themselves.
      // Reported as a source defect; update this pin when fixed.
      const allSpells = [
        { name: 'Detect Magic', level: 1, classes: [] },
        { name: 'Fire Bolt', level: 0, classes: [] },
      ];
      const fallbackFighter = (spells) => getSpellAbilities(allSpells, makePlayerStats({
        class: { name: 'Fighter', spell_casting_ability: null },
        spells,
      }));

      const leveled = fallbackFighter(['Detect Magic']);
      expect(leveled.spells).toEqual([]); // KNOWN DEFECT: input spells dropped
      expect(leveled.spell_slots_level_1).toBe(3); // half-caster level 5, uncapped
      expect(leveled.cantrips_known).toBe(0);
      expect(leveled.spellCastingAbility).toBeUndefined();
      // No casting ability: DC comes from proficiency alone (8 + 3).
      expect(leveled).toMatchObject({ modifier: 0, toHit: 3, saveDc: 11 });

      // Cantrip-only input: highest spell level 0 caps every slot away.
      const cantripOnly = fallbackFighter(['Fire Bolt']);
      expect(cantripOnly.spell_slots_level_1).toBeUndefined();
      expect(cantripOnly.spells).toEqual([]);
    });
  });
});
