import { describe, it, expect } from 'vitest';
import { getSpellAbilities } from './spellCalc.js';

const makePlayerStats = (overrides = {}) => {
  const level = overrides.level || 5;
  const classLevels = [];
  // class_levels is indexed by level-1, so pre-fill up to the character's level
  for (let i = 0; i < level; i++) {
    classLevels[i] = { spellcasting: null };
  }
  return {
    level,
    proficiency: overrides.proficiency !== undefined ? overrides.proficiency : Math.floor((level - 1) / 4) + 2,
    abilities: [
      { name: 'Intelligence', bonus: 4 },
      { name: 'Wisdom', bonus: 3 },
      { name: 'Charisma', bonus: 2 },
      { name: 'Strength', bonus: 1 },
      { name: 'Dexterity', bonus: 0 },
      { name: 'Constitution', bonus: -1 },
    ],
    class: {
      name: 'Wizard',
      spell_casting_ability: 'Intelligence',
      major: null,
      subclass: null,
      class_levels: classLevels,
      ...overrides.class,
    },
    race: {
      name: 'Human',
      subrace: null,
      ...overrides.race,
    },
    spells: overrides.spells || null,
    ...overrides,
  };
};

const setSpellcasting = (playerStats, spellcasting) => {
  playerStats.class.class_levels[playerStats.level - 1] = { spellcasting };
};

describe('spellCalc', () => {
  describe('getSpellAbilities', () => {
    it('should return null when class has no spellcasting', () => {
      const playerStats = makePlayerStats();
      const result = getSpellAbilities([], playerStats);
      expect(result).toBeNull();
    });

    it('should return null when required_major does not match', () => {
      const playerStats = makePlayerStats();
      setSpellcasting(playerStats, {
        cantrips_known: 3,
        spell_slots: {},
        required_major: 'SomeOtherSubclass',
        spells_known: 0,
      });
      playerStats.class.major = { name: 'Evocation' };
      const result = getSpellAbilities([], playerStats);
      expect(result).toBeNull();
    });

    it('should return spell abilities for class with spellcasting', () => {
      const playerStats = makePlayerStats();
      setSpellcasting(playerStats, {
        cantrips_known: 3,
        spell_slots: { '1': 4 },
        spells_known: 0,
        spellCastingAbility: 'Intelligence',
      });
      const result = getSpellAbilities([], playerStats);
      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(3);
    });

    it('should calculate spell modifier from abilities', () => {
      const playerStats = makePlayerStats();
      setSpellcasting(playerStats, {
        cantrips_known: 3,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Intelligence',
      });
      const result = getSpellAbilities([], playerStats);
      expect(result.modifier).toBe(4);
      expect(result.toHit).toBe(7); // 4 + 3 (proficiency)
      expect(result.saveDc).toBe(15); // 8 + 4 + 3
    });

    it('should handle missing spell ability in abilities array', () => {
      const playerStats = makePlayerStats();
      playerStats.abilities = playerStats.abilities.filter(a => a.name !== 'Intelligence');
      setSpellcasting(playerStats, {
        cantrips_known: 3,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Intelligence',
      });
      // spellAbility will be undefined, accessing .bonus throws
      expect(() => getSpellAbilities([], playerStats)).toThrow();
    });

    it('should add Tiefling racial spells', () => {
      const playerStats = makePlayerStats({ race: { name: 'Tiefling', subrace: null } });
      setSpellcasting(playerStats, {
        cantrips_known: 3,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Intelligence',
      });
      const result = getSpellAbilities([], playerStats);
      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(4); // 3 + 1 (Tiefling)
      const spellNames = result.spells.map(s => s.name);
      expect(spellNames).toContain('Thaumaturgy');
    });

    it('should add Tiefling Hellish Rebuke at level 3+', () => {
      const playerStats = makePlayerStats({
        level: 3,
        proficiency: 2,
        race: { name: 'Tiefling', subrace: null },
      });
      setSpellcasting(playerStats, {
        cantrips_known: 3,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Intelligence',
      });
      const result = getSpellAbilities([], playerStats);
      const spellNames = result.spells.map(s => s.name);
      expect(spellNames).toContain('Hellish Rebuke');
      expect(result.spells_known).toBe(1);
    });

    it('should add High Elf cantrip bonus', () => {
      const playerStats = makePlayerStats({
        race: { name: 'Elf', subrace: { name: 'High Elf' } },
      });
      setSpellcasting(playerStats, {
        cantrips_known: 3,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Intelligence',
      });
      const result = getSpellAbilities([], playerStats);
      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(4); // 3 + 1
    });

    it('should add Forest Gnome Minor Illusion cantrip', () => {
      const playerStats = makePlayerStats({
        race: { name: 'Gnome', subrace: { name: 'Forest Gnome' } },
      });
      setSpellcasting(playerStats, {
        cantrips_known: 3,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Intelligence',
      });
      const result = getSpellAbilities([], playerStats);
      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(4); // 3 + 1
      const spellNames = result.spells.map(s => s.name);
      expect(spellNames).toContain('Minor Illusion');
    });

    it('should set maxPreparedSpells for Wizard', () => {
      const playerStats = makePlayerStats();
      setSpellcasting(playerStats, {
        cantrips_known: 3,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Intelligence',
      });
      const result = getSpellAbilities([], playerStats);
      expect(result).not.toBeNull();
      expect(result.maxPreparedSpells).toBe(9); // 4 (int bonus) + 5 (level)
    });

    it('should add Arcane Trickster school limits', () => {
      const playerStats = makePlayerStats();
      playerStats.class.subclass = { name: 'Arcane Trickster' };
      setSpellcasting(playerStats, {
        cantrips_known: 3,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Intelligence',
      });
      const result = getSpellAbilities([], playerStats);
      expect(result).not.toBeNull();
      expect(result.schoolLimits).toEqual(['enchantment', 'illusion']);
    });

    it('should add Eldritch Knight school limits', () => {
      const playerStats = makePlayerStats({
        class: {
          name: 'Fighter',
          subclass: { name: 'Eldritch Knight' },
          class_levels: [],
          spell_casting_ability: 'Intelligence',
        },
      });
      // Rebuild class_levels for level 5
      playerStats.class.class_levels = [];
      for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
      setSpellcasting(playerStats, {
        cantrips_known: 2,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Intelligence',
      });
      const result = getSpellAbilities([], playerStats);
      expect(result).not.toBeNull();
      expect(result.schoolLimits).toEqual(['abjuration', 'evocation']);
    });

    it('should add Mage Hand to Arcane Trickster spells', () => {
      const playerStats = makePlayerStats({
        spells: ['Fire Bolt'],
      });
      playerStats.class.subclass = { name: 'Arcane Trickster' };
      setSpellcasting(playerStats, {
        cantrips_known: 3,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Intelligence',
      });
      const allSpells = [
        { name: 'Fire Bolt', level: 0, classes: ['Rogue'] },
      ];
      const result = getSpellAbilities(allSpells, playerStats);
      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(6); // 3 base + 3 Mage Hand legerdemain
      const spellNames = result.spells.map(s => s.name);
      expect(spellNames).toContain('Fire Bolt');
    });

    it('should add Light cantrip for Light domain cleric', () => {
      const playerStats = makePlayerStats({
        class: {
          name: 'Cleric',
          subclass: { name: 'Light' },
          class_levels: [],
          spell_casting_ability: 'Wisdom',
        },
        spells: ['Sacred Flame'],
      });
      playerStats.class.class_levels = [];
      for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
      setSpellcasting(playerStats, {
        cantrips_known: 3,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Wisdom',
      });
      const allSpells = [
        { name: 'Sacred Flame', level: 0, classes: ['Cleric'] },
      ];
      const result = getSpellAbilities(allSpells, playerStats);
      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(4); // 3 base + 1 bonus
      const spellNames = result.spells.map(s => s.name);
      expect(spellNames).toContain('Sacred Flame');
    });

    it('should add Land druid bonus cantrip', () => {
      const playerStats = makePlayerStats({
        class: {
          name: 'Druid',
          subclass: { name: 'Land', circle: 'Forest' },
          class_levels: [],
          spell_casting_ability: 'Wisdom',
        },
      });
      playerStats.class.class_levels = [];
      for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
      setSpellcasting(playerStats, {
        cantrips_known: 2,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Wisdom',
      });
      const result = getSpellAbilities([], playerStats);
      expect(result).not.toBeNull();
      expect(result.cantrips_known).toBe(3); // 2 base + 1 (Land bonus)
    });

    it('should set Paladin maxPreparedSpells correctly', () => {
      const playerStats = makePlayerStats({
        class: {
          name: 'Paladin',
          subclass: null,
          class_levels: [],
          spell_casting_ability: 'Charisma',
        },
      });
      playerStats.class.class_levels = [];
      for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
      setSpellcasting(playerStats, {
        cantrips_known: 0,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Charisma',
      });
      const result = getSpellAbilities([], playerStats);
      expect(result).not.toBeNull();
      expect(result.maxPreparedSpells).toBe(4); // 2 (cha bonus) + Math.floor(5/2) = 2 + 2 = 4
    });

    it('should add subclass spells as always prepared', () => {
      const playerStats = makePlayerStats({
        level: 5,
        class: {
          name: 'Cleric',
          subclass: {
            name: 'Life',
            spells: [
              {
                spell: { name: 'Lesser Restoration' },
                prerequisites: [{ index: 'class-3' }],
              },
            ],
          },
          class_levels: [],
          spell_casting_ability: 'Wisdom',
        },
      });
      playerStats.class.class_levels = [];
      for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
      setSpellcasting(playerStats, {
        cantrips_known: 3,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Wisdom',
      });
      const result = getSpellAbilities([], playerStats);
      expect(result).not.toBeNull();
      const subSpell = result.spells.find(s => s.name === 'Lesser Restoration');
      expect(subSpell).toBeDefined();
      expect(subSpell.prepared).toBe('Always');
    });

    it('should sort spells by level then name', () => {
      const allSpells = [
        { name: 'Fireball', level: 3, classes: ['Wizard'] },
        { name: 'Magic Missile', level: 1, classes: ['Wizard'] },
        { name: 'Shield', level: 1, classes: ['Wizard'] },
      ];
      const playerStats = makePlayerStats({
        class: {
          name: 'Wizard',
          subclass: null,
          class_levels: [],
          spell_casting_ability: 'Intelligence',
        },
        spells: ['Fireball', 'Magic Missile', 'Shield'],
      });
      playerStats.class.class_levels = [];
      for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
      setSpellcasting(playerStats, {
        cantrips_known: 3,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Intelligence',
      });
      const result = getSpellAbilities(allSpells, playerStats);
      const names = result.spells.map(s => s.name);
      expect(names).toContain('Magic Missile');
      expect(names).toContain('Shield');
      expect(names).toContain('Fireball');
    });

    it('should always prepare cantrips', () => {
      const allSpells = [
        { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
      ];
      const playerStats = makePlayerStats({
        class: {
          name: 'Wizard',
          subclass: null,
          class_levels: [],
          spell_casting_ability: 'Intelligence',
        },
        spells: ['Fire Bolt'],
      });
      playerStats.class.class_levels = [];
      for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
      setSpellcasting(playerStats, {
        cantrips_known: 3,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Intelligence',
      });
      const result = getSpellAbilities(allSpells, playerStats);
      const fireBolt = result.spells.find(s => s.name === 'Fire Bolt');
      expect(fireBolt.prepared).toBe('Always');
    });

    it('should handle spells not found in allSpells catalog', () => {
      const playerStats = makePlayerStats({
        class: {
          name: 'Wizard',
          subclass: null,
          class_levels: [],
          spell_casting_ability: 'Intelligence',
        },
        spells: ['Unknown Spell'],
      });
      playerStats.class.class_levels = [];
      for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
      setSpellcasting(playerStats, {
        cantrips_known: 3,
        spell_slots: {},
        spells_known: 0,
        spellCastingAbility: 'Intelligence',
      });
      const result = getSpellAbilities([], playerStats);
      expect(result).not.toBeNull();
      expect(result.spells).toHaveLength(1);
      expect(result.spells[0].name).toBe('Unknown Spell');
    });
  });
});
