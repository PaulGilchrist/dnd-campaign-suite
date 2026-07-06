// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { getSpellAbilities } from './spellCalc.js';

const makePlayerStats = (overrides = {}) => {
  const level = overrides.level || 5;
  const classLevels = [];
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
  const idx = playerStats.level - 1;
  if (!playerStats.class.class_levels[idx]) {
    playerStats.class.class_levels[idx] = {};
  }
  playerStats.class.class_levels[idx] = { spellcasting };
};

const buildSpellcasting = (opts = {}) => ({
  cantrips_known: opts.cantrips_known ?? 3,
  spell_slots: opts.spell_slots ?? {},
  spells_known: opts.spells_known ?? 0,
  spellCastingAbility: opts.spellCastingAbility ?? 'Intelligence',
  ...opts,
});

const expectSpellcastingResult = (result) => {
  expect(result).not.toBeNull();
  expect(result).toHaveProperty('cantrips_known');
  expect(result).toHaveProperty('spellCastingAbility');
  expect(result).toHaveProperty('spells');
  expect(Array.isArray(result.spells)).toBe(true);
};

describe('spellCalc', () => {
  describe('getSpellAbilities', () => {
    describe('null spellcasting', () => {
      it('returns null when class has no spellcasting ability', () => {
        const playerStats = makePlayerStats();
        const result = getSpellAbilities([], playerStats);
        expect(result).toBeNull();
      });

      it('returns null when required_major does not match', () => {
        const playerStats = makePlayerStats();
        setSpellcasting(playerStats, buildSpellcasting({ required_major: 'OtherSubclass' }));
        playerStats.class.major = { name: 'Evocation' };
        const result = getSpellAbilities([], playerStats);
        expect(result).toBeNull();
      });

      it('satisfies required_major when it matches major name', () => {
        const playerStats = makePlayerStats();
        setSpellcasting(playerStats, buildSpellcasting({ required_major: 'Evocation' }));
        playerStats.class.major = { name: 'Evocation' };
        const result = getSpellAbilities([], playerStats);
        expectSpellcastingResult(result);
      });

      it('satisfies required_major when it matches subclass name', () => {
        const playerStats = makePlayerStats();
        setSpellcasting(playerStats, buildSpellcasting({ required_major: 'School of Necromancy' }));
        playerStats.class.subclass = { name: 'School of Necromancy' };
        const result = getSpellAbilities([], playerStats);
        expectSpellcastingResult(result);
      });
    });

    describe('spell modifier calculations', () => {
      it('calculates modifier, toHit, and saveDc from spell casting ability', () => {
        const playerStats = makePlayerStats();
        setSpellcasting(playerStats, buildSpellcasting({ spellCastingAbility: 'Intelligence' }));
        const result = getSpellAbilities([], playerStats);
        expectSpellcastingResult(result);
        expect(result.modifier).toBe(4);
        expect(result.toHit).toBe(7);
        expect(result.saveDc).toBe(15);
      });

      it('calculates modifier from Wisdom', () => {
        const playerStats = makePlayerStats({
          class: { spell_casting_ability: 'Wisdom', class_levels: [] },
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({ spellCastingAbility: 'Wisdom' }));
        const result = getSpellAbilities([], playerStats);
        expect(result.modifier).toBe(3);
        expect(result.toHit).toBe(6);
        expect(result.saveDc).toBe(14);
      });

      it('handles negative ability modifier', () => {
        const playerStats = makePlayerStats({
          proficiency: 2,
          abilities: [
            { name: 'Intelligence', bonus: -2 },
            { name: 'Wisdom', bonus: 0 },
            { name: 'Charisma', bonus: 0 },
          ],
          class: { spell_casting_ability: 'Intelligence', class_levels: [] },
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({ spellCastingAbility: 'Intelligence' }));
        const result = getSpellAbilities([], playerStats);
        expect(result.modifier).toBe(-2);
        expect(result.toHit).toBe(0);
        expect(result.saveDc).toBe(8);
      });
    });

    describe('racial spell bonuses', () => {
      it('adds Tiefling Thaumaturgy cantrip', () => {
        const playerStats = makePlayerStats({ race: { name: 'Tiefling', subrace: null } });
        setSpellcasting(playerStats, buildSpellcasting());
        const result = getSpellAbilities([], playerStats);
        expect(result.cantrips_known).toBe(4);
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).toContain('Thaumaturgy');
      });

      it('adds Tiefling Hellish Rebuke at level 3+', () => {
        const playerStats = makePlayerStats({
          level: 3,
          proficiency: 2,
          race: { name: 'Tiefling', subrace: null },
        });
        setSpellcasting(playerStats, buildSpellcasting());
        const result = getSpellAbilities([], playerStats);
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).toContain('Hellish Rebuke');
        expect(result.spells_known).toBe(1);
      });

      it('does not add Tiefling Hellish Rebuke below level 3', () => {
        const playerStats = makePlayerStats({
          level: 2,
          race: { name: 'Tiefling', subrace: null },
        });
        setSpellcasting(playerStats, buildSpellcasting());
        const result = getSpellAbilities([], playerStats);
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).not.toContain('Hellish Rebuke');
      });

      it('adds High Elf cantrip bonus', () => {
        const playerStats = makePlayerStats({
          race: { name: 'Elf', subrace: { name: 'High Elf' } },
        });
        setSpellcasting(playerStats, buildSpellcasting());
        const result = getSpellAbilities([], playerStats);
        expect(result.cantrips_known).toBe(4);
      });

      it('adds Forest Gnome Minor Illusion cantrip', () => {
        const playerStats = makePlayerStats({
          race: { name: 'Gnome', subrace: { name: 'Forest Gnome' } },
        });
        setSpellcasting(playerStats, buildSpellcasting());
        const result = getSpellAbilities([], playerStats);
        expect(result.cantrips_known).toBe(4);
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).toContain('Minor Illusion');
      });
    });

    describe('non-spellcaster racial bonuses', () => {
      it('creates spell abilities for Tiefling non-spellcaster', () => {
        const playerStats = makePlayerStats({
          class: {
            name: 'Barbarian',
            subclass: null,
            class_levels: [],
            spell_casting_ability: null,
          },
          race: { name: 'Tiefling', subrace: null },
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        const result = getSpellAbilities([], playerStats);
        expect(result.spellCastingAbility).toBe('Charisma');
        expect(result.cantrips_known).toBe(1);
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).toContain('Thaumaturgy');
      });

      it('creates spell abilities for High Elf non-spellcaster', () => {
        const playerStats = makePlayerStats({
          class: {
            name: 'Ranger',
            subclass: null,
            class_levels: [],
            spell_casting_ability: null,
          },
          race: { name: 'Elf', subrace: { name: 'High Elf' } },
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        const result = getSpellAbilities([], playerStats);
        expect(result.spellCastingAbility).toBe('Intelligence');
        expect(result.cantrips_known).toBe(1);
      });

      it('creates spell abilities for Forest Gnome non-spellcaster', () => {
        const playerStats = makePlayerStats({
          class: {
            name: 'Fighter',
            subclass: null,
            class_levels: [],
            spell_casting_ability: null,
          },
          race: { name: 'Gnome', subrace: { name: 'Forest Gnome' } },
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        const result = getSpellAbilities([], playerStats);
        expect(result.spellCastingAbility).toBe('Intelligence');
        expect(result.cantrips_known).toBe(1);
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).toContain('Minor Illusion');
      });
    });

    describe('subclass spell bonuses', () => {
      it('adds Nature subclass cantrip bonus for Druid', () => {
        const playerStats = makePlayerStats({
          class: {
            name: 'Druid',
            subclass: { name: 'Nature' },
            class_levels: [],
            spell_casting_ability: 'Wisdom',
          },
          spells: ['Druidcraft'],
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({ cantrips_known: 2, spellCastingAbility: 'Wisdom' }));
        const result = getSpellAbilities([], playerStats);
        expect(result.cantrips_known).toBe(3);
      });

      it('adds Land subclass bonus cantrip', () => {
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
        setSpellcasting(playerStats, buildSpellcasting({ cantrips_known: 2, spellCastingAbility: 'Wisdom' }));
        const result = getSpellAbilities([], playerStats);
        expect(result.cantrips_known).toBe(3);
      });
    });

    describe('school limits', () => {
      it('sets Arcane Trickster school limits', () => {
        const playerStats = makePlayerStats();
        playerStats.class.subclass = { name: 'Arcane Trickster' };
        setSpellcasting(playerStats, buildSpellcasting());
        const result = getSpellAbilities([], playerStats);
        expect(result.schoolLimits).toEqual(['enchantment', 'illusion']);
      });

      it('sets Eldritch Knight school limits', () => {
        const playerStats = makePlayerStats({
          class: {
            name: 'Fighter',
            subclass: { name: 'Eldritch Knight' },
            class_levels: [],
            spell_casting_ability: 'Intelligence',
          },
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({ cantrips_known: 2, spellCastingAbility: 'Intelligence' }));
        const result = getSpellAbilities([], playerStats);
        expect(result.schoolLimits).toEqual(['abjuration', 'evocation']);
      });
    });

    describe('max prepared spells', () => {
      it('sets maxPreparedSpells for Wizard (int bonus + level)', () => {
        const playerStats = makePlayerStats();
        setSpellcasting(playerStats, buildSpellcasting());
        const result = getSpellAbilities([], playerStats);
        expect(result.maxPreparedSpells).toBe(9);
      });

      it('sets maxPreparedSpells for Cleric (wis bonus + level)', () => {
        const playerStats = makePlayerStats({
          class: {
            name: 'Cleric',
            subclass: null,
            class_levels: [],
            spell_casting_ability: 'Wisdom',
          },
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({ spellCastingAbility: 'Wisdom' }));
        const result = getSpellAbilities([], playerStats);
        expect(result.maxPreparedSpells).toBe(8);
      });

      it('sets maxPreparedSpells for Paladin (cha bonus + floor(level/2))', () => {
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
        setSpellcasting(playerStats, buildSpellcasting({ spellCastingAbility: 'Charisma' }));
        const result = getSpellAbilities([], playerStats);
        expect(result.maxPreparedSpells).toBe(4);
      });

      it('does not set maxPreparedSpells for Sorcerer (all prepared)', () => {
        const playerStats = makePlayerStats({
          class: {
            name: 'Sorcerer',
            subclass: null,
            class_levels: [],
            spell_casting_ability: 'Charisma',
          },
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({ spellCastingAbility: 'Charisma' }));
        const result = getSpellAbilities([], playerStats);
        expect(result.maxPreparedSpells).toBeUndefined();
      });
    });

    describe('spell population from catalog', () => {
      it('populates Druid spells from catalog (non-cantrip, class-matching)', () => {
        const allSpells = [
          { name: 'Druidcraft', level: 0, classes: ['Druid'] },
          { name: 'Acid Splash', level: 1, classes: ['Druid'] },
          { name: 'Shield', level: 1, classes: ['Wizard'] },
          { name: 'Sacred Flame', level: 1, classes: ['Druid'] },
        ];
        const playerStats = makePlayerStats({
          class: {
            name: 'Druid',
            subclass: null,
            class_levels: [],
            spell_casting_ability: 'Wisdom',
          },
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({
          cantrips_known: 2,
          spells_known: null,
          spell_slots_level_1: 2,
          spellCastingAbility: 'Wisdom',
        }));
        const result = getSpellAbilities(allSpells, playerStats);
        expect(result.spells_known).toBeNull();
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).toContain('Acid Splash');
        expect(spellNames).toContain('Sacred Flame');
        expect(spellNames).not.toContain('Shield');
      });

      it('filters spells by class and max spell level', () => {
        const allSpells = [
          { name: 'Acid Splash', level: 1, classes: ['Druid'] },
          { name: 'Cure Wounds', level: 1, classes: ['Druid'] },
          { name: 'Shapechange', level: 9, classes: ['Druid'] },
        ];
        const playerStats = makePlayerStats({
          class: {
            name: 'Druid',
            subclass: null,
            class_levels: [],
            spell_casting_ability: 'Wisdom',
          },
          spells: null,
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({
          cantrips_known: 2,
          spells_known: null,
          spell_slots_level_1: 1,
          spellCastingAbility: 'Wisdom',
        }));
        const result = getSpellAbilities(allSpells, playerStats);
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).toContain('Acid Splash');
        expect(spellNames).toContain('Cure Wounds');
        expect(spellNames).not.toContain('Shapechange');
      });
    });

    describe('subclass spells always prepared', () => {
      it('adds subclass spells as always prepared when not already known', () => {
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
        setSpellcasting(playerStats, buildSpellcasting({ spellCastingAbility: 'Wisdom' }));
        const result = getSpellAbilities([], playerStats);
        const subSpell = result.spells.find(s => s.name === 'Lesser Restoration');
        expect(subSpell).toBeDefined();
        expect(subSpell.prepared).toBe('Always');
      });

      it('marks subclass spell as always prepared when already known', () => {
        const allSpells = [
          { name: 'Lesser Restoration', level: 2, classes: ['Cleric'] },
        ];
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
          spells: ['Lesser Restoration'],
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({ spellCastingAbility: 'Wisdom' }));
        const result = getSpellAbilities(allSpells, playerStats);
        const spell = result.spells.find(s => s.name === 'Lesser Restoration');
        expect(spell.prepared).toBe('Always');
      });

      it('respects subclass level prerequisites', () => {
        const playerStats = makePlayerStats({
          level: 1,
          class: {
            name: 'Cleric',
            subclass: {
              name: 'Life',
              spells: [
                {
                  spell: { name: 'Hymn of Pain' },
                  prerequisites: [{ index: 'class-3' }],
                },
              ],
            },
            class_levels: [],
            spell_casting_ability: 'Wisdom',
          },
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 1; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({ spellCastingAbility: 'Wisdom' }));
        const result = getSpellAbilities([], playerStats);
        const subSpell = result.spells.find(s => s.name === 'Hymn of Pain');
        expect(subSpell).toBeUndefined();
      });

      it('respects Land subclass circle prerequisites', () => {
        const playerStats = makePlayerStats({
          level: 5,
          class: {
            name: 'Druid',
            subclass: {
              name: 'Land',
              circle: 'Dreams',
              class_levels: [],
            },
            class_levels: [],
            spell_casting_ability: 'Wisdom',
          },
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        playerStats.class.subclass.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.subclass.class_levels[i] = { level: i + 1 };
        setSpellcasting(playerStats, buildSpellcasting({ spellCastingAbility: 'Wisdom' }));
        const result = getSpellAbilities([], playerStats);
        const dreamSpell = result.spells.find(s => s.name === 'Awaken');
        expect(dreamSpell).toBeUndefined();
      });
    });

    describe('automation passives', () => {
      it('adds unknown spell from automation passives', () => {
        const allSpells = [
          { name: 'Fire Bolt', level: 0, classes: ['Wizard', 'Sorcerer'] },
          { name: 'Charm Person', level: 1, classes: ['Wizard', 'Bard'] },
        ];
        const playerStats = makePlayerStats({
          class: {
            name: 'Wizard',
            subclass: null,
            class_levels: [],
            spell_casting_ability: 'Intelligence',
          },
          spells: ['Fire Bolt'],
          spellsKnown: 3,
          automation: {
            passives: [
              {
                type: 'passive_rule',
                effect: 'always_prepared_spells',
                spells: ['Charm Person'],
              },
            ],
          },
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({ cantrips_known: 3, spells_known: 3, spellCastingAbility: 'Intelligence' }));
        const result = getSpellAbilities(allSpells, playerStats);
        expect(result.spells_known).toBe(4);
        const addedSpell = result.spells.find(s => s.name === 'Charm Person');
        expect(addedSpell).toBeDefined();
        expect(addedSpell.prepared).toBe('Always');
      });

      it('handles multiple passive spell groups', () => {
        const allSpells = [
          { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
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
          spells: ['Fire Bolt'],
          automation: {
            passives: [
              {
                type: 'passive_rule',
                effect: 'always_prepared_spells',
                spells: ['Magic Missile', 'Shield'],
              },
            ],
          },
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({ cantrips_known: 3, spells_known: 0, spellCastingAbility: 'Intelligence' }));
        const result = getSpellAbilities(allSpells, playerStats);
        const mm = result.spells.find(s => s.name === 'Magic Missile');
        const sh = result.spells.find(s => s.name === 'Shield');
        expect(mm.prepared).toBe('Always');
        expect(sh.prepared).toBe('Always');
      });
    });

    describe('spell sorting', () => {
      it('sorts spells by level ascending then name alphabetically', () => {
        const allSpells = [
          { name: 'Fireball', level: 3, classes: ['Wizard'] },
          { name: 'Magic Missile', level: 1, classes: ['Wizard'] },
          { name: 'Shield', level: 1, classes: ['Wizard'] },
          { name: 'Charm Person', level: 1, classes: ['Wizard'] },
          { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
        ];
        const playerStats = makePlayerStats({
          class: {
            name: 'Wizard',
            subclass: null,
            class_levels: [],
            spell_casting_ability: 'Intelligence',
          },
          spells: ['Fireball', 'Magic Missile', 'Shield', 'Charm Person', 'Fire Bolt'],
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({ cantrips_known: 3, spells_known: 0, spellCastingAbility: 'Intelligence' }));
        const result = getSpellAbilities(allSpells, playerStats);
        const names = result.spells.map(s => s.name);
        const expectedOrder = ['Fire Bolt', 'Charm Person', 'Magic Missile', 'Shield', 'Fireball'];
        expect(names).toEqual(expectedOrder);
      });
    });

    describe('cantrip prepared status', () => {
      it('marks all cantrips as always prepared', () => {
        const allSpells = [
          { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
          { name: 'Magic Missile', level: 1, classes: ['Wizard'] },
        ];
        const playerStats = makePlayerStats({
          class: {
            name: 'Wizard',
            subclass: null,
            class_levels: [],
            spell_casting_ability: 'Intelligence',
          },
          spells: ['Fire Bolt', 'Magic Missile'],
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({ cantrips_known: 3, spells_known: 0, spellCastingAbility: 'Intelligence' }));
        const result = getSpellAbilities(allSpells, playerStats);
        const fireBolt = result.spells.find(s => s.name === 'Fire Bolt');
        expect(fireBolt.prepared).toBe('Always');
      });
    });

    describe('unknown spells from catalog', () => {
      it('includes spells not found in allSpells catalog', () => {
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
        setSpellcasting(playerStats, buildSpellcasting({ cantrips_known: 3, spells_known: 0, spellCastingAbility: 'Intelligence' }));
        const result = getSpellAbilities([], playerStats);
        expect(result.spells).toHaveLength(1);
        expect(result.spells[0].name).toBe('Unknown Spell');
      });
    });

    describe('class with all spells prepared', () => {
      it('marks all spells as always prepared for Sorcerer', () => {
        const allSpells = [
          { name: 'Charm Person', level: 1, classes: ['Sorcerer'] },
          { name: 'Magic Missile', level: 1, classes: ['Wizard'] },
        ];
        const playerStats = makePlayerStats({
          class: {
            name: 'Sorcerer',
            subclass: null,
            class_levels: [],
            spell_casting_ability: 'Charisma',
          },
          spells: ['Charm Person'],
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({ cantrips_known: 2, spells_known: 3, spellCastingAbility: 'Charisma' }));
        const result = getSpellAbilities(allSpells, playerStats);
        expect(result.maxPreparedSpells).toBeUndefined();
        expect(result.spells[0].prepared).toBe('Always');
      });
    });
  });
});
