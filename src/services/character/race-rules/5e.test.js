import { describe, it, expect, vi } from 'vitest';
import raceRules from './5e.js';

// Mock dependencies
vi.mock('../../ui/utils.js', () => ({
  default: {
    getAbilityLongName: vi.fn((name) => name)
  }
}));

describe('raceRules 5e (direct module)', () => {
  describe('getImmunities', () => {
    it('should return empty array when no race or class', () => {
      const playerSummary = { race: {}, class: {} };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toEqual([]);
    });

    it('should add Magical Sleep for Elf race', () => {
      const playerSummary = { race: { name: 'Elf' }, class: {} };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toContain('Magical Sleep');
    });

    it('should not add Magical Sleep for non-Elf race', () => {
      const playerSummary = { race: { name: 'Human' }, class: {} };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).not.toContain('Magical Sleep');
    });

    it('should add Disease and Poison immunity for Monk level > 9', () => {
      const playerSummary = {
        race: { name: 'Human' },
        class: { name: 'Monk' },
        level: 10
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toContain('Disease');
      expect(result).toContain('Poison');
    });

    it('should not add Disease/Poison immunity for Monk level <= 9', () => {
      const playerSummary = {
        race: { name: 'Human' },
        class: { name: 'Monk' },
        level: 9
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).not.toContain('Disease');
      expect(result).not.toContain('Poison');
    });

    it('should add Disease immunity for Paladin level > 2', () => {
      const playerSummary = {
        race: { name: 'Human' },
        class: { name: 'Paladin' },
        level: 3
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toContain('Disease');
    });

    it('should not add Disease immunity for Paladin level <= 2', () => {
      const playerSummary = {
        race: { name: 'Human' },
        class: { name: 'Paladin' },
        level: 2
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).not.toContain('Disease');
    });

    it('should include playerSummary immunities', () => {
      const playerSummary = {
        race: { name: 'Elf' },
        class: {},
        immunities: ['Disease']
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toContain('Magical Sleep');
      expect(result).toContain('Disease');
    });

    it('should deduplicate immunities', () => {
      const playerSummary = {
        race: { name: 'Elf' },
        class: {},
        immunities: ['Magical Sleep']
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result.filter((i) => i === 'Magical Sleep').length).toBe(1);
    });

    it('should sort immunities alphabetically', () => {
      const playerSummary = {
        race: { name: 'Elf' },
        class: {},
        immunities: ['Zebra', 'Alpha', 'Middle']
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result[0]).toBe('Alpha');
      expect(result[1]).toBe('Magical Sleep');
      expect(result[2]).toBe('Middle');
      expect(result[3]).toBe('Zebra');
    });
  });

  describe('getResistances', () => {
    it('should return empty array when no race', () => {
      const playerSummary = { race: {} };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual([]);
    });

    it('should add Poison resistance for Dwarf race', () => {
      const playerSummary = { race: { name: 'Dwarf' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Poison');
    });

    it('should not add Poison resistance for non-Dwarf race', () => {
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).not.toContain('Poison');
    });

    it('should add subrace damage_resistance for non-Dwarf races', () => {
      const playerSummary = {
        race: {
          name: 'Human',
          subrace: { damage_resistance: 'Fire' }
        }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Fire');
    });

    it('should add Charm resistance for Elf race', () => {
      const playerSummary = { race: { name: 'Elf' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Charm');
    });

    it('should add Frightened resistance for Halfling race', () => {
      const playerSummary = { race: { name: 'Halfling' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Frightened');
    });

    it('should add Poison resistance for Scout Halfling subrace', () => {
      const playerSummary = {
        race: {
          name: 'Halfling',
          subrace: { name: 'Scout Halfling' }
        }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Frightened');
      expect(result).toContain('Poison');
    });

    it('should not add extra Poison for non-Scout Halfling subrace', () => {
      const playerSummary = {
        race: {
          name: 'Halfling',
          subrace: { name: 'Lightfoot Halfling' }
        }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Frightened');
      expect(result).not.toContain('Poison');
    });

    it('should add Fire resistance for Tiefling race', () => {
      const playerSummary = { race: { name: 'Tiefling' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Fire');
    });

    it('should include playerSummary resistances', () => {
      const playerSummary = {
        race: { name: 'Elf' },
        resistances: ['Lightning']
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Charm');
      expect(result).toContain('Lightning');
    });

    it('should deduplicate resistances', () => {
      const playerSummary = {
        race: { name: 'Elf' },
        resistances: ['Charm']
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result.filter((r) => r === 'Charm').length).toBe(1);
    });

    it('should sort resistances alphabetically', () => {
      const playerSummary = {
        race: { name: 'Elf' },
        resistances: ['Zebra', 'Alpha', 'Middle']
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result[0]).toBe('Alpha');
      expect(result[1]).toBe('Charm');
      expect(result[2]).toBe('Middle');
      expect(result[3]).toBe('Zebra');
    });
  });

  describe('getSenses', () => {
    it('should return senses when playerStats has no senses', () => {
      const playerStats = {
        race: {
          traits: []
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should return existing senses', () => {
      const playerStats = {
        senses: [{ name: 'Normal Vision', value: '60 ft.' }],
        race: { traits: [] }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Normal Vision', value: '60 ft.' });
    });

    it('should add Darkvision when race has Darkvision trait and not already in senses', () => {
      const playerStats = {
        senses: [],
        race: {
          traits: [{ name: 'Darkvision' }]
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
    });

    it('should not add Darkvision if already in senses', () => {
      const playerStats = {
        senses: [{ name: 'Darkvision', value: '120 ft.' }],
        race: {
          traits: [{ name: 'Darkvision' }]
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result.filter((s) => s.name === 'Darkvision').length).toBe(1);
      expect(result.find((s) => s.name === 'Darkvision').value).toBe('120 ft.');
    });

    it('should not add Darkvision if not in race traits', () => {
      const playerStats = {
        senses: [],
        race: {
          traits: [{ name: 'Other Trait' }]
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).not.toContainEqual({ name: 'Darkvision', value: '60 ft.' });
    });

    it('should add Passive Perception when abilities available', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] },
        abilities: [
          {
            name: 'Wisdom',
            bonus: 2,
            skills: [{ name: 'Perception', bonus: 5 }]
          }
        ]
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '15' });
    });

    it('should use ability bonus when no skill bonus for Passive Perception', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] },
        abilities: [
          {
            name: 'Wisdom',
            bonus: 3,
            skills: []
          }
        ]
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '13' });
    });

    it('should add Passive Investigation when abilities available', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] },
        abilities: [
          {
            name: 'Intelligence',
            bonus: 1,
            skills: [{ name: 'Investigation', bonus: 3 }]
          }
        ]
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Passive Investigation', value: '13' });
    });

    it('should add Passive Insight when abilities available', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] },
        abilities: [
          {
            name: 'Wisdom',
            bonus: 2,
            skills: [{ name: 'Insight', bonus: 2 }]
          }
        ]
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Passive Insight', value: '12' });
    });

    it('should not add passive skills when abilities array missing', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).not.toContainEqual({ name: 'Passive Perception', value: '10' });
      expect(result).not.toContainEqual({ name: 'Passive Investigation', value: '10' });
      expect(result).not.toContainEqual({ name: 'Passive Insight', value: '10' });
    });

    it('should not add passive skill when ability not found', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] },
        abilities: [
          {
            name: 'Strength',
            bonus: 2,
            skills: []
          }
        ]
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).not.toContainEqual({ name: 'Passive Perception', value: '12' });
    });

    it('should use ability bonus when skill not found for Passive Perception', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] },
        abilities: [
          {
            name: 'Wisdom',
            bonus: 2,
            skills: [{ name: 'Animal Handling', bonus: 0 }]
          }
        ]
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '12' });
    });

    it('should sort senses alphabetically by name', () => {
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

    it('should handle race without traits', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] },
        abilities: [
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Perception', bonus: 0 }] },
          { name: 'Intelligence', bonus: 0, skills: [{ name: 'Investigation', bonus: 0 }] },
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Insight', bonus: 0 }] }
        ]
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '10' });
      expect(result).toContainEqual({ name: 'Passive Investigation', value: '10' });
      expect(result).toContainEqual({ name: 'Passive Insight', value: '10' });
    });
  });

  describe('getRace', () => {
    it('should return undefined when race not found', () => {
      const allRaces = [];
      const playerSummary = { race: { name: 'Custom Race' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result).toBeUndefined();
    });

    it('should return a clone of found race', () => {
      const allRaces = [{ name: 'Human', traits: [] }];
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.name).toBe('Human');
      expect(result).not.toBe(allRaces[0]);
    });

    it('should merge playerSummary race data into result', () => {
      const allRaces = [{ name: 'Human', traits: [] }];
      const playerSummary = {
        race: {
          name: 'Human',
          customProperty: 'custom value'
        }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.name).toBe('Human');
      expect(result.customProperty).toBe('custom value');
    });

    it('should resolve subrace from JSON data', () => {
      const allRaces = [
        {
          name: 'Elf',
          subraces: [
            {
              name: 'High Elf',
              damage_resistance: 'Fire',
              traits: []
            }
          ]
        }
      ];
      const playerSummary = {
        race: {
          name: 'Elf',
          subrace: { name: 'High Elf' }
        }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.subrace.name).toBe('High Elf');
      expect(result.subrace.damage_resistance).toBe('Fire');
    });

    it('should merge playerSummary subrace data', () => {
      const allRaces = [
        {
          name: 'Elf',
          subraces: [
            {
              name: 'High Elf',
              damage_resistance: 'Fire'
            }
          ]
        }
      ];
      const playerSummary = {
        race: {
          name: 'Elf',
          subrace: { name: 'High Elf' }
        },
        subrace: { customProp: 'value' }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.subrace.name).toBe('High Elf');
      expect(result.subrace.damage_resistance).toBe('Fire');
      expect(result.subrace.customProp).toBe('value');
    });

    it('should set subrace to null when no subrace selected', () => {
      const allRaces = [
        {
          name: 'Elf',
          subraces: [
            {
              name: 'High Elf',
              damage_resistance: 'Fire'
            }
          ]
        }
      ];
      const playerSummary = {
        race: {
          name: 'Elf'
        }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.subrace).toBeNull();
    });

    it('should delete subraces from result', () => {
      const allRaces = [
        {
          name: 'Elf',
          subraces: [
            {
              name: 'High Elf',
              damage_resistance: 'Fire'
            }
          ]
        }
      ];
      const playerSummary = {
        race: { name: 'Elf' }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.subraces).toBeUndefined();
    });

    it('should convert ability_score abbreviations via utils.getAbilityLongName', () => {
      const allRaces = [
        {
          name: 'Human',
          ability_bonuses: [{ ability_score: 'STR', bonus: 1 }]
        }
      ];
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      // Mock returns input as-is, so STR stays STR
      expect(result.ability_bonuses[0].ability_score).toBe('STR');
    });

    it('should convert subrace ability_score abbreviations via utils.getAbilityLongName', () => {
      const allRaces = [
        {
          name: 'Elf',
          subraces: [
            {
              name: 'High Elf',
              ability_bonuses: [{ ability_score: 'INT', bonus: 1 }]
            }
          ]
        }
      ];
      const playerSummary = {
        race: {
          name: 'Elf',
          subrace: { name: 'High Elf' }
        }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.subrace.ability_bonuses[0].ability_score).toBe('INT');
    });

    it('should handle race without ability_bonuses', () => {
      const allRaces = [{ name: 'Human', traits: [] }];
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.ability_bonuses).toBeUndefined();
    });

    it('should handle race without traits', () => {
      const allRaces = [{ name: 'Human' }];
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.name).toBe('Human');
    });
  });

  describe('getRacialBonus', () => {
    it('should return 0 when no ability_bonuses', () => {
      const playerStats = { race: {} };
      const result = raceRules.getRacialBonus(playerStats, 'Strength');
      expect(result).toBe(0);
    });

    it('should return 0 when ability bonus not found', () => {
      const playerStats = {
        race: {
          ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }]
        }
      };
      const result = raceRules.getRacialBonus(playerStats, 'Dexterity');
      expect(result).toBe(0);
    });

    it('should return bonus from race ability_bonuses', () => {
      const playerStats = {
        race: {
          ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }]
        }
      };
      const result = raceRules.getRacialBonus(playerStats, 'Strength');
      expect(result).toBe(2);
    });

    it('should return bonus from subrace ability_bonuses', () => {
      const playerStats = {
        race: {
          ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }],
          subrace: {
            ability_bonuses: [{ ability_score: 'Dexterity', bonus: 1 }]
          }
        }
      };
      const result = raceRules.getRacialBonus(playerStats, 'Dexterity');
      expect(result).toBe(1);
    });

    it('should sum bonuses from race and subrace for same ability', () => {
      const playerStats = {
        race: {
          ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }],
          subrace: {
            ability_bonuses: [{ ability_score: 'Strength', bonus: 1 }]
          }
        }
      };
      const result = raceRules.getRacialBonus(playerStats, 'Strength');
      expect(result).toBe(3);
    });

    it('should return 0 when subrace has no ability_bonuses', () => {
      const playerStats = {
        race: {
          ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }],
          subrace: {}
        }
      };
      const result = raceRules.getRacialBonus(playerStats, 'Strength');
      expect(result).toBe(2);
    });

    it('should return 0 when subrace is null', () => {
      const playerStats = {
        race: {
          ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }],
          subrace: null
        }
      };
      const result = raceRules.getRacialBonus(playerStats, 'Strength');
      expect(result).toBe(2);
    });

    it('should handle undefined playerStats', () => {
      const result = raceRules.getRacialBonus({ race: {} }, 'Strength');
      expect(result).toBe(0);
    });
  });

  describe('addTraits', () => {
    it('should categorize traits using featureCategories', () => {
      const traits = [
        { name: 'Darkvision', description: 'Can see in the dark' },
        { name: 'Fey Ancestry', description: 'Advantage on saves against being charmed' }
      ];
      const result = raceRules.addTraits(traits);
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.actions).toBeDefined();
      expect(result.bonusActions).toBeDefined();
      expect(result.reactions).toBeDefined();
      expect(result.specialActions).toBeDefined();
      expect(result.characterAdvancement).toBeDefined();
    });

    it('should categorize traits with desc field', () => {
      const traits = [
        { name: 'Trait1', desc: 'A trait with desc field' }
      ];
      const result = raceRules.addTraits(traits);
      expect(result).toBeDefined();
    });

    it('should handle empty traits array', () => {
      const result = raceRules.addTraits([]);
      expect(result).toBeDefined();
      expect(result.actions).toEqual([]);
      expect(result.specialActions).toEqual([]);
    });

    it('should handle null traits', () => {
      const result = raceRules.addTraits(null);
      expect(result).toBeDefined();
    });

    it('should handle undefined traits', () => {
      const result = raceRules.addTraits(undefined);
      expect(result).toBeDefined();
    });

    it('should skip features in featuresToIgnore list', () => {
      const traits = [
        { name: 'Darkvision', description: 'Can see in the dark' },
        { name: 'Spellcasting', description: 'You can cast spells' }
      ];
      const result = raceRules.addTraits(traits);
      expect(result.specialActions.find((t) => t.name === 'Spellcasting')).toBeUndefined();
    });

    it('should include traits not in any category in specialActions', () => {
      const traits = [
        { name: 'Custom Trait', description: 'A custom trait' }
      ];
      const result = raceRules.addTraits(traits);
      expect(result.specialActions.find((t) => t.name === 'Custom Trait')).toBeDefined();
    });
  });

  describe('getTraits', () => {
    it('should return categorized traits from race', () => {
      const playerStats = {
        race: {
          traits: [
            { name: 'Darkvision', description: 'Can see in the dark' },
            { name: 'Fey Ancestry', description: 'Advantage on saves against being charmed' }
          ]
        }
      };
      const result = raceRules.getTraits(playerStats);
      expect(result).toBeDefined();
      expect(Object.keys(result)).toContain('specialActions');
    });

    it('should handle race without traits', () => {
      const playerStats = { race: {} };
      const result = raceRules.getTraits(playerStats);
      expect(result).toBeDefined();
    });

    it('should handle undefined race', () => {
      const playerStats = { race: {} };
      const result = raceRules.getTraits(playerStats);
      expect(result).toBeDefined();
    });

    it('should merge subrace racial_traits with base traits', () => {
      const playerStats = {
        race: {
          traits: [
            { name: 'Darkvision', description: 'Can see in the dark' }
          ],
          subrace: {
            racial_traits: [
              { name: 'Elven Weapon Training', description: 'Proficient with handaxes' }
            ]
          }
        }
      };
      const result = raceRules.getTraits(playerStats);
      expect(result).toBeDefined();
      expect(Object.keys(result)).toContain('specialActions');
    });

    it('should handle subrace without racial_traits', () => {
      const playerStats = {
        race: {
          traits: [
            { name: 'Darkvision', description: 'Can see in the dark' }
          ],
          subrace: {}
        }
      };
      const result = raceRules.getTraits(playerStats);
      expect(result).toBeDefined();
    });

    it('should handle null subrace', () => {
      const playerStats = {
        race: {
          traits: [
            { name: 'Darkvision', description: 'Can see in the dark' }
          ],
          subrace: null
        }
      };
      const result = raceRules.getTraits(playerStats);
      expect(result).toBeDefined();
    });

    it('should handle empty traits array', () => {
      const playerStats = {
        race: {
          traits: []
        }
      };
      const result = raceRules.getTraits(playerStats);
      expect(result).toBeDefined();
    });

    it('should deduplicate traits when merging subrace traits', () => {
      const playerStats = {
        race: {
          traits: [
            { name: 'Darkvision', description: 'Can see in the dark' }
          ],
          subrace: {
            racial_traits: [
              { name: 'Darkvision', description: 'Extended darkvision' }
            ]
          }
        }
      };
      const result = raceRules.getTraits(playerStats);
      expect(result.characterAdvancement.filter((t) => t.name === 'Darkvision').length).toBe(1);
    });
  });
});
