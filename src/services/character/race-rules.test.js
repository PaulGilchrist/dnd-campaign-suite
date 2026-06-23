// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';
import { rules5e as raceRules } from './race-rules/index.js';
import * as utilsModule from '../ui/utils.js';

// Mock dependencies — only what getRace actually calls
vi.mock('../ui/utils.js', () => ({
  default: {
    getAbilityLongName: vi.fn((name) => name)
  }
}));

describe('raceRules (rules5e)', () => {
  describe('getImmunities', () => {
    it('returns empty array when race and class have no matching immunities', () => {
      const playerSummary = { race: { name: 'Human' }, class: { name: 'Fighter' }, level: 1 };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toEqual([]);
    });

    it('adds Magical Sleep immunity for Elf race', () => {
      const playerSummary = { race: { name: 'Elf' }, class: { name: 'Wizard' }, level: 1 };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toContain('Magical Sleep');
    });

    it('does not add Magical Sleep for non-Elf race', () => {
      const playerSummary = { race: { name: 'Human' }, class: { name: 'Wizard' }, level: 1 };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).not.toContain('Magical Sleep');
    });

    it('adds Disease and Poison immunity for Monk level > 9', () => {
      const playerSummary = { race: { name: 'Human' }, class: { name: 'Monk' }, level: 10 };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toContain('Disease');
      expect(result).toContain('Poison');
    });

    it('does not add Disease/Poison for Monk at level 9 (boundary)', () => {
      const playerSummary = { race: { name: 'Human' }, class: { name: 'Monk' }, level: 9 };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).not.toContain('Disease');
      expect(result).not.toContain('Poison');
    });

    it('adds Disease immunity for Paladin level > 2', () => {
      const playerSummary = { race: { name: 'Human' }, class: { name: 'Paladin' }, level: 3 };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toContain('Disease');
    });

    it('does not add Disease for Paladin at level 2 (boundary)', () => {
      const playerSummary = { race: { name: 'Human' }, class: { name: 'Paladin' }, level: 2 };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).not.toContain('Disease');
    });

    it('includes and deduplicates immunities from playerSummary', () => {
      const playerSummary = {
        race: { name: 'Elf' },
        class: { name: 'Monk' },
        level: 10,
        immunities: ['Magical Sleep', 'Disease']
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result.filter((i) => i === 'Magical Sleep').length).toBe(1);
      expect(result).toContain('Disease');
    });

    it('returns immunities sorted alphabetically', () => {
      const playerSummary = {
        race: { name: 'Elf' },
        class: {},
        level: 1,
        immunities: ['Zebra', 'Alpha', 'Middle']
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toEqual(['Alpha', 'Magical Sleep', 'Middle', 'Zebra']);
    });
  });

  describe('getResistances', () => {
    it('returns empty array when race has no resistances', () => {
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual([]);
    });

    it('adds Poison resistance for Dwarf race', () => {
      const playerSummary = { race: { name: 'Dwarf' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Poison');
    });

    it('does not add Poison resistance for non-Dwarf race', () => {
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).not.toContain('Poison');
    });

    it('adds subrace damage_resistance for non-Dwarf races', () => {
      const playerSummary = {
        race: { name: 'Human', subrace: { damage_resistance: 'Fire' } }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Fire');
    });

    it('does not add subrace damage_resistance for Dwarf', () => {
      const playerSummary = {
        race: { name: 'Dwarf', subrace: { damage_resistance: 'Fire' } }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).not.toContain('Fire');
    });

    it('adds Charm resistance for Elf race', () => {
      const playerSummary = { race: { name: 'Elf' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Charm');
    });

    it('adds Frightened resistance for Halfling race', () => {
      const playerSummary = { race: { name: 'Halfling' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Frightened');
    });

    it('adds Poison resistance for Scout Halfling subrace in addition to Frightened', () => {
      const playerSummary = {
        race: { name: 'Halfling', subrace: { name: 'Scout Halfling' } }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Frightened');
      expect(result).toContain('Poison');
    });

    it('does not add extra Poison for non-Scout Halfling subrace', () => {
      const playerSummary = {
        race: { name: 'Halfling', subrace: { name: 'Lightfoot Halfling' } }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Frightened');
      expect(result).not.toContain('Poison');
    });

    it('adds Fire resistance for Tiefling race', () => {
      const playerSummary = { race: { name: 'Tiefling' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Fire');
    });

    it('includes and deduplicates resistances from playerSummary', () => {
      const playerSummary = {
        race: { name: 'Elf' },
        resistances: ['Charm', 'Lightning']
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result.filter((r) => r === 'Charm').length).toBe(1);
      expect(result).toContain('Lightning');
    });

    it('returns resistances sorted alphabetically', () => {
      const playerSummary = {
        race: { name: 'Elf' },
        resistances: ['Zebra', 'Alpha', 'Middle']
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual(['Alpha', 'Charm', 'Middle', 'Zebra']);
    });
  });

  describe('getSenses', () => {
    it('returns empty sorted array when playerStats has no senses or race traits', () => {
      const playerStats = { race: { traits: [] } };
      const result = raceRules.getSenses(playerStats);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('preserves existing senses and returns sorted', () => {
      const playerStats = {
        senses: [{ name: 'Normal Vision', value: '60 ft.' }],
        race: { traits: [] }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Normal Vision', value: '60 ft.' });
    });

    it('adds Darkvision when race has Darkvision trait and it is not already present', () => {
      const playerStats = {
        senses: [],
        race: { traits: [{ name: 'Darkvision' }] }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
    });

    it('does not duplicate Darkvision when already in senses', () => {
      const playerStats = {
        senses: [{ name: 'Darkvision', value: '120 ft.' }],
        race: { traits: [{ name: 'Darkvision' }] }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result.filter((s) => s.name === 'Darkvision').length).toBe(1);
      expect(result.find((s) => s.name === 'Darkvision').value).toBe('120 ft.');
    });

    it('does not add Darkvision when race does not have the trait', () => {
      const playerStats = {
        senses: [],
        race: { traits: [{ name: 'Other Trait' }] }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).not.toContainEqual({ name: 'Darkvision', value: '60 ft.' });
    });

    it('adds Passive Perception when Wisdom ability with Perception skill exists', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] },
        abilities: [{ name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 5 }] }]
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '15' });
    });

    it('falls back to ability bonus when Perception skill is missing', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] },
        abilities: [{ name: 'Wisdom', bonus: 3, skills: [] }]
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '13' });
    });

    it('does not add passive skills when abilities array is missing', () => {
      const playerStats = { senses: [], race: { traits: [] } };
      const result = raceRules.getSenses(playerStats);
      expect(result).not.toContainEqual({ name: 'Passive Perception', value: '10' });
    });

    it('adds Feral Senses when a class feature has Feral Senses', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] },
        class: { class_levels: [{ features: [{ name: 'Feral Senses' }] }] }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Feral Senses', value: '' });
    });

    it('does not add Feral Senses when no class feature has it', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] },
        class: { class_levels: [{ features: [{ name: 'Other Feature' }] }] }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).not.toContainEqual({ name: 'Feral Senses', value: '' });
    });

    it('does not duplicate Feral Senses when already in senses', () => {
      const playerStats = {
        senses: [{ name: 'Feral Senses', value: '120 ft.' }],
        race: { traits: [] },
        class: { class_levels: [{ features: [{ name: 'Feral Senses' }] }] }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result.filter((s) => s.name === 'Feral Senses').length).toBe(1);
      expect(result.find((s) => s.name === 'Feral Senses').value).toBe('120 ft.');
    });

    it('handles missing class_levels gracefully', () => {
      const playerStats = { senses: [], race: { traits: [] }, class: {} };
      const result = raceRules.getSenses(playerStats);
      expect(result).not.toContainEqual({ name: 'Feral Senses', value: '' });
    });

    it('returns senses sorted alphabetically by name', () => {
      const playerStats = {
        senses: [
          { name: 'Zebra Vision', value: '10 ft.' },
          { name: 'Alpha Vision', value: '5 ft.' }
        ],
        race: { traits: [] }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result[0].name).toBe('Alpha Vision');
      expect(result[1].name).toBe('Zebra Vision');
    });
  });

  describe('getRace', () => {
    const mockRaces = [
      {
        name: 'Human',
        ability_bonuses: [{ ability_score: 'STR', bonus: 1 }],
        traits: []
      },
      {
        name: 'Elf',
        ability_bonuses: [{ ability_score: 'DEX', bonus: 2 }],
        traits: [{ name: 'Darkvision' }],
        subraces: [
          {
            name: 'High Elf',
            ability_bonuses: [{ ability_score: 'INT', bonus: 1 }],
            traits: []
          }
        ]
      }
    ];

    it('returns undefined when race is not found in allRaces', () => {
      const playerSummary = { race: { name: 'NonExistent' } };
      const result = raceRules.getRace(mockRaces, playerSummary);
      expect(result).toBeUndefined();
    });

    it('returns a clone of the found race (not the original reference)', () => {
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getRace(mockRaces, playerSummary);
      expect(result.name).toBe('Human');
      expect(result).not.toBe(mockRaces[0]);
    });

    it('merges playerSummary race data into the result', () => {
      const playerSummary = {
        race: { name: 'Human', customProperty: 'custom value' }
      };
      const result = raceRules.getRace(mockRaces, playerSummary);
      expect(result.name).toBe('Human');
      expect(result.customProperty).toBe('custom value');
    });

    it('resolves subrace from JSON data and merges playerSummary subrace data', () => {
      const playerSummary = {
        race: { name: 'Elf', subrace: { name: 'High Elf' } },
        subrace: { customProp: 'value' }
      };
      const result = raceRules.getRace(mockRaces, playerSummary);
      expect(result.subrace.name).toBe('High Elf');
      expect(result.subrace.customProp).toBe('value');
    });

    it('sets subrace to null when no subrace is selected', () => {
      const playerSummary = { race: { name: 'Elf' } };
      const result = raceRules.getRace(mockRaces, playerSummary);
      expect(result.subrace).toBeNull();
    });

    it('removes subraces array from the result', () => {
      const playerSummary = { race: { name: 'Elf' } };
      const result = raceRules.getRace(mockRaces, playerSummary);
      expect(result.subraces).toBeUndefined();
    });

    it('converts ability_score abbreviations via utils.getAbilityLongName', () => {
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getRace(mockRaces, playerSummary);
      expect(utilsModule.default.getAbilityLongName).toHaveBeenCalledWith('STR');
      expect(result.ability_bonuses[0].ability_score).toBe('STR');
    });

    it('converts subrace ability_score abbreviations via utils.getAbilityLongName', () => {
      const playerSummary = {
        race: { name: 'Elf', subrace: { name: 'High Elf' } }
      };
      const result = raceRules.getRace(mockRaces, playerSummary);
      expect(result.subrace.ability_bonuses[0].ability_score).toBe('INT');
    });

    it('handles race without ability_bonuses', () => {
      const races = [{ name: 'Human', traits: [] }];
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getRace(races, playerSummary);
      expect(result.ability_bonuses).toBeUndefined();
    });

    it('handles race without traits', () => {
      const races = [{ name: 'Human' }];
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getRace(races, playerSummary);
      expect(result.name).toBe('Human');
    });

    it('returns undefined when subrace name does not match any subrace', () => {
      const playerSummary = {
        race: { name: 'Elf', subrace: { name: 'Wood Elf' } }
      };
      const result = raceRules.getRace(mockRaces, playerSummary);
      expect(result.subrace).toBeNull();
    });
  });

  describe('getRacialBonus', () => {
    it('returns 0 when race has no ability_bonuses', () => {
      const playerStats = { race: {} };
      const result = raceRules.getRacialBonus(playerStats, 'Strength');
      expect(result).toBe(0);
    });

    it('returns 0 when ability name is not in ability_bonuses', () => {
      const playerStats = {
        race: { ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }] }
      };
      const result = raceRules.getRacialBonus(playerStats, 'Dexterity');
      expect(result).toBe(0);
    });

    it('returns the bonus from race ability_bonuses', () => {
      const playerStats = {
        race: { ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }] }
      };
      const result = raceRules.getRacialBonus(playerStats, 'Strength');
      expect(result).toBe(2);
    });

    it('returns the bonus from subrace ability_bonuses', () => {
      const playerStats = {
        race: {
          ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }],
          subrace: { ability_bonuses: [{ ability_score: 'Dexterity', bonus: 1 }] }
        }
      };
      const result = raceRules.getRacialBonus(playerStats, 'Dexterity');
      expect(result).toBe(1);
    });

    it('sums bonuses from race and subrace for the same ability', () => {
      const playerStats = {
        race: {
          ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }],
          subrace: { ability_bonuses: [{ ability_score: 'Strength', bonus: 1 }] }
        }
      };
      const result = raceRules.getRacialBonus(playerStats, 'Strength');
      expect(result).toBe(3);
    });

    it('returns race bonus when subrace is null', () => {
      const playerStats = {
        race: {
          ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }],
          subrace: null
        }
      };
      const result = raceRules.getRacialBonus(playerStats, 'Strength');
      expect(result).toBe(2);
    });

    it('returns race bonus when subrace is undefined', () => {
      const playerStats = {
        race: { ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }] }
      };
      const result = raceRules.getRacialBonus(playerStats, 'Strength');
      expect(result).toBe(2);
    });

    it('returns race bonus when subrace exists but has no ability_bonuses', () => {
      const playerStats = {
        race: {
          ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }],
          subrace: {}
        }
      };
      const result = raceRules.getRacialBonus(playerStats, 'Strength');
      expect(result).toBe(2);
    });
  });

  describe('addTraits', () => {
    it('categorizes traits into the correct category keys', () => {
      const traits = [
        { name: 'Darkvision', description: 'Can see in the dark' },
        { name: 'Fey Ancestry', description: 'Advantage on saves against being charmed' }
      ];
      const result = raceRules.addTraits(traits);
      expect(result).toEqual({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: expect.arrayContaining([
          expect.objectContaining({ name: 'Darkvision' }),
          expect.objectContaining({ name: 'Fey Ancestry' })
        ]),
        characterAdvancement: []
      });
    });

    it('supports traits with description field', () => {
      const traits = [{ name: 'Trait1', description: 'A trait with description' }];
      const result = raceRules.addTraits(traits);
      const trait = result.specialActions.find((t) => t.name === 'Trait1');
      expect(trait).toBeDefined();
      expect(trait.description).toBe('A trait with description');
    });

    it('returns empty category arrays for empty input', () => {
      const result = raceRules.addTraits([]);
      expect(result.actions).toEqual([]);
      expect(result.specialActions).toEqual([]);
      expect(result.bonusActions).toEqual([]);
      expect(result.reactions).toEqual([]);
      expect(result.characterAdvancement).toEqual([]);
    });

    it('returns empty category arrays for null input', () => {
      const result = raceRules.addTraits(null);
      expect(result.actions).toEqual([]);
      expect(result.specialActions).toEqual([]);
    });

    it('returns empty category arrays for undefined input', () => {
      const result = raceRules.addTraits(undefined);
      expect(result.actions).toEqual([]);
      expect(result.specialActions).toEqual([]);
    });

    it('places traits not in any category into specialActions', () => {
      const traits = [{ name: 'Custom Trait', description: 'A custom trait' }];
      const result = raceRules.addTraits(traits);
      expect(result.specialActions.find((t) => t.name === 'Custom Trait')).toBeDefined();
    });
  });

  describe('getTraits', () => {
    it('returns categorized traits from race', () => {
      const playerStats = {
        race: {
          traits: [
            { name: 'Darkvision', description: 'Can see in the dark' },
            { name: 'Fey Ancestry', description: 'Advantage on saves against being charmed' }
          ]
        }
      };
      const result = raceRules.getTraits(playerStats);
      expect(result).toEqual({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: expect.any(Array),
        characterAdvancement: []
      });
    });

    it('handles race without traits', () => {
      const playerStats = { race: {} };
      const result = raceRules.getTraits(playerStats);
      expect(result).toEqual({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });
    });

    it('merges subrace racial_traits with base traits and deduplicates', () => {
      const playerStats = {
        race: {
          traits: [{ name: 'Darkvision', description: 'Can see in the dark' }],
          subrace: {
            racial_traits: [{ name: 'Elven Weapon Training', description: 'Proficient with handaxes' }]
          }
        }
      };
      const result = raceRules.getTraits(playerStats);
      const names = result.specialActions.map((t) => t.name);
      expect(names).toContain('Darkvision');
      expect(names).toContain('Elven Weapon Training');
    });

    it('deduplicates traits when base and subrace have the same trait', () => {
      const playerStats = {
        race: {
          traits: [{ name: 'Darkvision', description: 'Can see in the dark' }],
          subrace: {
            racial_traits: [{ name: 'Darkvision', description: 'Extended darkvision' }]
          }
        }
      };
      const result = raceRules.getTraits(playerStats);
      expect(result.specialActions.filter((t) => t.name === 'Darkvision').length).toBe(1);
    });

    it('handles subrace without racial_traits', () => {
      const playerStats = {
        race: {
          traits: [{ name: 'Darkvision', description: 'Can see in the dark' }],
          subrace: {}
        }
      };
      const result = raceRules.getTraits(playerStats);
      expect(result.specialActions.find((t) => t.name === 'Darkvision')).toBeDefined();
    });

    it('handles null subrace', () => {
      const playerStats = {
        race: {
          traits: [{ name: 'Darkvision', description: 'Can see in the dark' }],
          subrace: null
        }
      };
      const result = raceRules.getTraits(playerStats);
      expect(result.specialActions.find((t) => t.name === 'Darkvision')).toBeDefined();
    });

    it('handles empty traits array', () => {
      const playerStats = { race: { traits: [] } };
      const result = raceRules.getTraits(playerStats);
      expect(result).toEqual({
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
        characterAdvancement: []
      });
    });
  });
});
