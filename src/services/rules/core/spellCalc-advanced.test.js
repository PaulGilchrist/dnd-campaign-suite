import { describe, it, expect, beforeEach } from 'vitest';
import { getSpellAbilities } from './spellCalc.js';
import { getStore, setRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';

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

describe('spellCalc advanced', () => {
  beforeEach(() => {
    const storeKeys = Array.from(getStore('TestWizard').keys());
    storeKeys.forEach(key => getStore('TestWizard').delete(key));
  });

  describe('getSpellAbilities', () => {
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
            major: {
              features: [{ name: 'Beguiling Magic' }],
            },
          },
          spells: ['Fire Bolt'],
          spellsKnown: 3,
          automation: {
            passives: [
              {
                type: 'passive_rule',
                effect: 'always_prepared_spells',
                name: 'Beguiling Magic',
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
            major: {
              features: [{ name: 'Magic User Spells' }],
            },
          },
          spells: ['Fire Bolt'],
          automation: {
            passives: [
              {
                type: 'passive_rule',
                effect: 'always_prepared_spells',
                name: 'Magic User Spells',
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

    describe('spell thief - caster blocklist', () => {
      it('removes blocked spells from spellAbilities', () => {
        const allSpells = [
          { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
          { name: 'Magic Missile', level: 1, classes: ['Wizard'] },
          { name: 'Shield', level: 1, classes: ['Wizard'] },
        ];
        const playerStats = makePlayerStats({
          name: 'TestWizard',
          class: {
            name: 'Wizard',
            subclass: null,
            class_levels: [],
            spell_casting_ability: 'Intelligence',
          },
          spells: ['Fire Bolt', 'Magic Missile', 'Shield'],
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({ cantrips_known: 3, spells_known: 0, spellCastingAbility: 'Intelligence' }));

        const blockList = JSON.stringify([
          { spellName: 'Magic Missile' },
          { spellName: 'Shield' },
        ]);
        setRuntimeValue('TestWizard', '_spellThiefCasterBlock', blockList, 'test-campaign');

        const result = getSpellAbilities(allSpells, playerStats);
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).toContain('Fire Bolt');
        expect(spellNames).not.toContain('Magic Missile');
        expect(spellNames).not.toContain('Shield');
      });

      it('handles blocked spells with null spellName gracefully', () => {
        const allSpells = [
          { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
          { name: 'Magic Missile', level: 1, classes: ['Wizard'] },
        ];
        const playerStats = makePlayerStats({
          name: 'TestWizard2',
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

        const blockList = JSON.stringify([
          { spellName: null },
          { spellName: 'Magic Missile' },
        ]);
        setRuntimeValue('TestWizard2', '_spellThiefCasterBlock', blockList, 'test-campaign');

        const result = getSpellAbilities(allSpells, playerStats);
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).toContain('Fire Bolt');
        expect(spellNames).not.toContain('Magic Missile');
      });

      it('does nothing when blocklist is empty array', () => {
        const allSpells = [
          { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
          { name: 'Magic Missile', level: 1, classes: ['Wizard'] },
        ];
        const playerStats = makePlayerStats({
          name: 'TestWizard3',
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

        const blockList = JSON.stringify([]);
        setRuntimeValue('TestWizard3', '_spellThiefCasterBlock', blockList, 'test-campaign');

        const result = getSpellAbilities(allSpells, playerStats);
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).toContain('Fire Bolt');
        expect(spellNames).toContain('Magic Missile');
      });

      it('does nothing when blocklist is not an array', () => {
        const allSpells = [
          { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
          { name: 'Magic Missile', level: 1, classes: ['Wizard'] },
        ];
        const playerStats = makePlayerStats({
          name: 'TestWizard4',
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

        const blockList = JSON.stringify({ spellName: 'Magic Missile' });
        setRuntimeValue('TestWizard4', '_spellThiefCasterBlock', blockList, 'test-campaign');

        const result = getSpellAbilities(allSpells, playerStats);
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).toContain('Fire Bolt');
        expect(spellNames).toContain('Magic Missile');
      });
    });

    describe('spell thief - stolen spells', () => {
      it('adds stolen spells to spellAbilities', () => {
        const allSpells = [
          { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
          { name: 'Charm Person', level: 1, classes: ['Bard'] },
        ];
        const playerStats = makePlayerStats({
          name: 'TestWizard5',
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
        setSpellcasting(playerStats, buildSpellcasting({ cantrips_known: 3, spells_known: 0, spellCastingAbility: 'Intelligence' }));

        const stolenList = JSON.stringify([
          { spellName: 'Charm Person' },
        ]);
        setRuntimeValue('TestWizard5', '_spellThiefStolenList', stolenList, 'test-campaign');

        const result = getSpellAbilities(allSpells, playerStats);
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).toContain('Fire Bolt');
        expect(spellNames).toContain('Charm Person');
        expect(result.spells_known).toBe(0);
        const stolenSpell = result.spells.find(s => s.name === 'Charm Person');
        expect(stolenSpell.prepared).toBe('Always');
      });

      it('does not add stolen spell that is already known', () => {
        const allSpells = [
          { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
          { name: 'Charm Person', level: 1, classes: ['Bard'] },
        ];
        const playerStats = makePlayerStats({
          name: 'TestWizard6',
          class: {
            name: 'Wizard',
            subclass: null,
            class_levels: [],
            spell_casting_ability: 'Intelligence',
          },
          spells: ['Fire Bolt', 'Charm Person'],
        });
        playerStats.class.class_levels = [];
        for (let i = 0; i < 5; i++) playerStats.class.class_levels[i] = { spellcasting: null };
        setSpellcasting(playerStats, buildSpellcasting({ cantrips_known: 3, spells_known: 0, spellCastingAbility: 'Intelligence' }));

        const stolenList = JSON.stringify([
          { spellName: 'Charm Person' },
        ]);
        setRuntimeValue('TestWizard6', '_spellThiefStolenList', stolenList, 'test-campaign');

        const result = getSpellAbilities(allSpells, playerStats);
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames.filter(n => n === 'Charm Person').length).toBe(1);
        expect(result.spells_known).toBe(0);
      });

      it('handles stolen spells with null/missing spellName gracefully', () => {
        const allSpells = [
          { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
          { name: 'Charm Person', level: 1, classes: ['Bard'] },
        ];
        const playerStats = makePlayerStats({
          name: 'TestWizard7',
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
        setSpellcasting(playerStats, buildSpellcasting({ cantrips_known: 3, spells_known: 0, spellCastingAbility: 'Intelligence' }));

        const stolenList = JSON.stringify([
          { spellName: null },
          { spellName: undefined },
          { spellName: 'Charm Person' },
        ]);
        setRuntimeValue('TestWizard7', '_spellThiefStolenList', stolenList, 'test-campaign');

        const result = getSpellAbilities(allSpells, playerStats);
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).toContain('Charm Person');
        expect(result.spells_known).toBe(0);
      });

      it('does nothing when stolen list is not an array', () => {
        const allSpells = [
          { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
        ];
        const playerStats = makePlayerStats({
          name: 'TestWizard8',
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
        setSpellcasting(playerStats, buildSpellcasting({ cantrips_known: 3, spells_known: 0, spellCastingAbility: 'Intelligence' }));

        const stolenList = JSON.stringify({ spellName: 'Charm Person' });
        setRuntimeValue('TestWizard8', '_spellThiefStolenList', stolenList, 'test-campaign');

        const result = getSpellAbilities(allSpells, playerStats);
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).toContain('Fire Bolt');
        expect(spellNames).not.toContain('Charm Person');
      });

      it('increments spells_known only when spells_known is a number', () => {
        const allSpells = [
          { name: 'Fire Bolt', level: 0, classes: ['Wizard'] },
          { name: 'Charm Person', level: 1, classes: ['Bard'] },
        ];
        const playerStats = makePlayerStats({
          name: 'TestWizard9',
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
        setSpellcasting(playerStats, buildSpellcasting({ cantrips_known: 3, spells_known: null, spellCastingAbility: 'Intelligence' }));

        const stolenList = JSON.stringify([
          { spellName: 'Charm Person' },
        ]);
        setRuntimeValue('TestWizard9', '_spellThiefStolenList', stolenList, 'test-campaign');

        const result = getSpellAbilities(allSpells, playerStats);
        const spellNames = result.spells.map(s => s.name);
        expect(spellNames).toContain('Charm Person');
        expect(result.spells_known).toBeNull();
      });
    });
  });
});
