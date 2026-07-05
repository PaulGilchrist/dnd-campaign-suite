// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import * as raceRulesModule from './index.js';
import rules5e from './5e.js';
import rules2024 from './2024.js';

const EXPECTED_METHODS = [
  'getImmunities',
  'getRace',
  'getRacialBonus',
  'getResistances',
  'getSenses',
  'addTraits',
  'getTraits',
];

describe('race-rules/index', () => {
  describe('exports', () => {
    it('exports rules5e as a defined object', () => {
      expect(raceRulesModule.rules5e).toBeDefined();
      expect(typeof raceRulesModule.rules5e).toBe('object');
    });

    it('exports rules2024 as a defined object', () => {
      expect(raceRulesModule.rules2024).toBeDefined();
      expect(typeof raceRulesModule.rules2024).toBe('object');
    });

    it('exports are different objects', () => {
      expect(raceRulesModule.rules5e).not.toBe(raceRulesModule.rules2024);
    });

    it('exports rules5e as the default from 5e.js', () => {
      expect(raceRulesModule.rules5e).toBe(rules5e);
    });

    it('exports rules2024 as the default from 2024.js', () => {
      expect(raceRulesModule.rules2024).toBe(rules2024);
    });

    it('exports only rules5e and rules2024', () => {
      expect(Object.keys(raceRulesModule)).toEqual(['rules5e', 'rules2024']);
    });
  });

  describe('rules5e contract', () => {
    it.each(EXPECTED_METHODS)('has method %s as a function', (method) => {
      expect(typeof raceRulesModule.rules5e[method]).toBe('function');
    });

    it('has no unexpected methods beyond the expected set', () => {
      const actualMethods = Object.keys(raceRulesModule.rules5e);
      expect(actualMethods).toEqual(expect.arrayContaining(EXPECTED_METHODS));
    });
  });

  describe('rules2024 contract', () => {
    it.each(EXPECTED_METHODS)('has method %s as a function', (method) => {
      expect(typeof raceRulesModule.rules2024[method]).toBe('function');
    });

    it('has no unexpected methods beyond the expected set', () => {
      const actualMethods = Object.keys(raceRulesModule.rules2024);
      expect(actualMethods).toEqual(expect.arrayContaining(EXPECTED_METHODS));
    });
  });

  describe('5e vs 2024 differences', () => {
    it('exports are not the same reference even though they share the same method names', () => {
      for (const method of EXPECTED_METHODS) {
        expect(typeof raceRulesModule.rules5e[method]).toBe('function');
        expect(typeof raceRulesModule.rules2024[method]).toBe('function');
      }
      expect(raceRulesModule.rules5e).not.toBe(raceRulesModule.rules2024);
    });

    it('5e getRacialBonus returns a non-zero value for a race with ability bonuses', () => {
      const result = raceRulesModule.rules5e.getRacialBonus(
        { race: { ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }] } },
        'Strength'
      );
      expect(result).toBe(2);
    });

    it('2024 getRacialBonus returns 0 regardless of input', () => {
      const result = raceRulesModule.rules2024.getRacialBonus(
        { race: { ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }] } },
        'Strength'
      );
      expect(result).toBe(0);
    });

    it('5e getRace returns undefined when race not found, 2024 returns playerSummary.race', () => {
      const allRaces = [];
      const playerSummary = { race: { name: 'Custom Race' } };
      const result5e = raceRulesModule.rules5e.getRace(allRaces, playerSummary);
      const result2024 = raceRulesModule.rules2024.getRace(allRaces, playerSummary);
      expect(result5e).toBeUndefined();
      expect(result2024).toEqual({ name: 'Custom Race' });
    });

    it('5e getRace returns cloned race, 2024 getRace also returns cloned race', () => {
      const allRaces = [{ name: 'Human', traits: [] }];
      const playerSummary = { race: { name: 'Human' } };
      const result5e = raceRulesModule.rules5e.getRace(allRaces, playerSummary);
      const result2024 = raceRulesModule.rules2024.getRace(allRaces, playerSummary);
      expect(result5e).not.toBe(allRaces[0]);
      expect(result2024).not.toBe(allRaces[0]);
    });

    it('5e getRace removes subraces array from result, 2024 does not', () => {
      const allRaces = [
        {
          name: 'Elf',
          subraces: [{ name: 'High Elf' }]
        }
      ];
      const playerSummary = { race: { name: 'Elf' } };
      const result5e = raceRulesModule.rules5e.getRace(allRaces, playerSummary);
      const result2024 = raceRulesModule.rules2024.getRace(allRaces, playerSummary);
      expect(result5e.subraces).toBeUndefined();
      expect(result2024.subraces).toEqual([{ name: 'High Elf' }]);
    });

    it('5e getRace sets subrace to null when not found, 2024 leaves original subrace object', () => {
      const allRaces = [
        {
          name: 'Elf',
          subraces: [{ name: 'High Elf' }]
        }
      ];
      const playerSummary = {
        race: { name: 'Elf', subrace: { name: 'Wood Elf' } }
      };
      const result5e = raceRulesModule.rules5e.getRace(allRaces, playerSummary);
      const result2024 = raceRulesModule.rules2024.getRace(allRaces, playerSummary);
      expect(result5e.subrace).toBeNull();
      expect(result2024.subrace).toEqual({ name: 'Wood Elf' });
    });

    it('5e getResistances uses simple .sort(), 2024 uses localeCompare sort', () => {
      const result5e = raceRulesModule.rules5e.getResistances({
        race: { name: 'Elf' },
        resistances: ['Zebra', 'alpha', 'Middle']
      });
      const result2024 = raceRulesModule.rules2024.getResistances({
        race: { traits: [] },
        resistances: [{ name: 'Zebra' }, { name: 'alpha' }, { name: 'Middle' }]
      });
      // 5e: simple string sort (uppercase before lowercase)
      expect(result5e).toEqual(expect.arrayContaining(['Zebra', 'Middle', 'alpha', 'Charm']));
      // 2024: localeCompare sort (case-insensitive, alphabetical order)
      expect(result2024[0].name).toBe('alpha');
      expect(result2024[1].name).toBe('Middle');
      expect(result2024[2].name).toBe('Zebra');
    });

    it('5e getSenses uses trait name matching, 2024 uses regex on description', () => {
      const playerStats5e = {
        race: { traits: [{ name: 'Darkvision' }] }
      };
      const playerStats2024 = {
        race: { traits: [{ description: 'You have darkvision with a range of 60 feet.' }] }
      };
      const result5e = raceRulesModule.rules5e.getSenses(playerStats5e);
      const result2024 = raceRulesModule.rules2024.getSenses(playerStats2024);
      expect(result5e).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
      expect(result2024).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
    });

    it('5e getSenses adds Feral Senses as a sense name, 2024 adds Blindsight 30 ft.', () => {
      const playerStats5e = {
        race: { traits: [] },
        class: { class_levels: [{ features: [{ name: 'Feral Senses' }] }] }
      };
      const playerStats2024 = {
        race: { traits: [] },
        class: { class_levels: [{ features: [{ name: 'Feral Senses' }] }] }
      };
      const result5e = raceRulesModule.rules5e.getSenses(playerStats5e);
      const result2024 = raceRulesModule.rules2024.getSenses(playerStats2024);
      expect(result5e).toContainEqual({ name: 'Feral Senses', value: '' });
      expect(result2024).toContainEqual({ name: 'Blindsight', value: '30 ft.' });
    });

    it('5e getImmunities has hardcoded race checks (Elf, Monk, Paladin), 2024 extracts from traits', () => {
      const elfSummary5e = { race: { name: 'Elf' }, class: {}, level: 1 };
      const tranceInput2024 = {
        race: {
          traits: [{ name: 'Trance', description: "Magic can't put you to sleep." }]
        }
      };
      const result5e = raceRulesModule.rules5e.getImmunities(elfSummary5e);
      const result2024 = raceRulesModule.rules2024.getImmunities(tranceInput2024);
      expect(result5e).toContain('Magical Sleep');
      expect(result2024).toContain('Magical Sleep');
    });

    it('5e getResistances has hardcoded race checks (Dwarf, Elf, Halfling, Tiefling), 2024 extracts from traits', () => {
      const dwarfSummary5e = { race: { name: 'Dwarf' } };
      const resistanceInput2024 = {
        race: { traits: [{ description: 'You have resistance to fire.' }] }
      };
      const result5e = raceRulesModule.rules5e.getResistances(dwarfSummary5e);
      const result2024 = raceRulesModule.rules2024.getResistances(resistanceInput2024);
      expect(result5e).toContain('Poison');
      expect(result2024).toContain('fire');
    });

    it('5e getTraits merges base traits with subrace racial_traits, 2024 merges base traits with lineage traits', () => {
      const playerStats5e = {
        race: {
          traits: [{ name: 'Darkvision' }],
          subrace: { racial_traits: [{ name: 'Elven Weapon Training' }] }
        }
      };
      const playerStats2024 = {
        race: {
          lineage: 'High Elf',
          traits: [
            { name: 'Darkvision' },
            {
              name: 'Ancestry',
              sub_traits: [{ name: 'High Elf', description: 'Lineage trait' }]
            }
          ]
        }
      };
      const result5e = raceRulesModule.rules5e.getTraits(playerStats5e);
      const result2024 = raceRulesModule.rules2024.getTraits(playerStats2024);
      const names5e = result5e.specialActions.map((t) => t.name);
      const names2024 = result2024.specialActions.map((t) => t.name);
      expect(names5e).toContain('Darkvision');
      expect(names5e).toContain('Elven Weapon Training');
      expect(names2024).toContain('Darkvision');
      expect(names2024).toContain('Ancestry (High Elf)');
    });

    it('addTraits returns same category keys for both rulesets', () => {
      const traits = [{ name: 'Darkvision', description: 'Can see in the dark' }];
      const result5e = raceRulesModule.rules5e.addTraits(traits);
      const result2024 = raceRulesModule.rules2024.addTraits(traits);
      expect(Object.keys(result5e)).toEqual([
        'actions',
        'bonusActions',
        'reactions',
        'specialActions',
        'characterAdvancement'
      ]);
      expect(Object.keys(result2024)).toEqual([
        'actions',
        'bonusActions',
        'reactions',
        'specialActions',
        'characterAdvancement'
      ]);
    });

    it('addTraits deduplicates traits by name for both rulesets', () => {
      const traits = [
        { name: 'Darkvision', description: 'First' },
        { name: 'Darkvision', description: 'Second' }
      ];
      const result5e = raceRulesModule.rules5e.addTraits(traits);
      const result2024 = raceRulesModule.rules2024.addTraits(traits);
      expect(result5e.specialActions.filter((t) => t.name === 'Darkvision').length).toBe(1);
      expect(result2024.specialActions.filter((t) => t.name === 'Darkvision').length).toBe(1);
    });

    it('addTraits handles null input for both rulesets', () => {
      const result5e = raceRulesModule.rules5e.addTraits(null);
      const result2024 = raceRulesModule.rules2024.addTraits(null);
      expect(result5e.actions).toEqual([]);
      expect(result5e.specialActions).toEqual([]);
      expect(result2024.actions).toEqual([]);
      expect(result2024.specialActions).toEqual([]);
    });

    it('addTraits handles undefined input for both rulesets', () => {
      const result5e = raceRulesModule.rules5e.addTraits(undefined);
      const result2024 = raceRulesModule.rules2024.addTraits(undefined);
      expect(result5e.actions).toEqual([]);
      expect(result5e.specialActions).toEqual([]);
      expect(result2024.actions).toEqual([]);
      expect(result2024.specialActions).toEqual([]);
    });

    it('getTraits handles empty traits array for both rulesets', () => {
      const result5e = raceRulesModule.rules5e.getTraits({ race: { traits: [] } });
      const result2024 = raceRulesModule.rules2024.getTraits({ race: { traits: [] } });
      expect(result5e.actions).toEqual([]);
      expect(result5e.specialActions).toEqual([]);
      expect(result2024.actions).toEqual([]);
      expect(result2024.specialActions).toEqual([]);
    });

    it('getTraits handles undefined race for 2024, null race for 5e', () => {
      const result2024 = raceRulesModule.rules2024.getTraits({});
      expect(Object.keys(result2024)).toEqual([
        'actions',
        'bonusActions',
        'reactions',
        'specialActions',
        'characterAdvancement'
      ]);
    });
  });
});
