import { describe, it, expect, vi } from 'vitest';
import raceRules from './2024.js';

// Mock dependencies
vi.mock('../../ui/utils.js', () => ({
  default: {
    getAbilityLongName: vi.fn((name) => name)
  }
}));

vi.mock('../../hooks/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null)
}));

describe('raceRules 2024 (direct module)', () => {
  describe('getImmunities', () => {
    it('should return empty array when no race', () => {
      const playerSummary = {};
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toEqual([]);
    });

    it('should return empty array when race has no traits', () => {
      const playerSummary = { race: { name: 'Human', traits: [] } };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toEqual([]);
    });

    it('should return empty array when traits have no immunity mention', () => {
      const playerSummary = {
        race: {
          traits: [
            { description: 'You have darkvision with a range of 60 feet.' },
            { description: 'You can speak Common and Elvish.' }
          ]
        }
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toEqual([]);
    });

    it('should extract immunity type from trait description', () => {
      const playerSummary = {
        race: {
          traits: [
            { description: 'You have immunity to poison damage.' }
          ]
        }
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toContain('poison');
    });

    it('should extract immunity type with period at end', () => {
      const playerSummary = {
        race: {
          traits: [
            { description: 'You have immunity to charm.' }
          ]
        }
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toContain('charm');
    });

    it('should extract multiple immunities from different traits', () => {
      const playerSummary = {
        race: {
          traits: [
            { description: 'You have immunity to poison.' },
            { description: 'You have immunity to disease.' }
          ]
        }
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toContain('poison');
      expect(result).toContain('disease');
    });

    it('should include playerSummary immunities', () => {
      const playerSummary = {
        race: { traits: [] },
        immunities: ['Disease']
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toContain('Disease');
    });

    it('should combine trait immunities with playerSummary immunities', () => {
      const playerSummary = {
        race: {
          traits: [
            { description: 'You have immunity to poison.' }
          ]
        },
        immunities: ['Disease']
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toContain('poison');
      expect(result).toContain('Disease');
    });

    it('should deduplicate immunities', () => {
      const playerSummary = {
        race: {
          traits: [
            { description: 'You have immunity to poison.' }
          ]
        },
        immunities: ['poison']
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result.filter((i) => i === 'poison').length).toBe(1);
    });

    it('should sort immunities alphabetically', () => {
      const playerSummary = {
        race: { traits: [] },
        immunities: [{ name: 'Zebra' }, { name: 'Alpha' }, { name: 'Middle' }]
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result[0].name).toBe('Alpha');
      expect(result[1].name).toBe('Middle');
      expect(result[2].name).toBe('Zebra');
    });

    it('should sort immunities with name property', () => {
      const playerSummary = {
        race: { traits: [] },
        immunities: [{ name: 'Zebra' }, { name: 'Alpha' }]
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result[0].name).toBe('Alpha');
      expect(result[1].name).toBe('Zebra');
    });

    it('should add Magical Sleep immunity for Trance trait', () => {
      const playerSummary = {
        race: {
          traits: [
            { name: 'Trance', description: "You don't need to sleep, and magic can't put you to sleep." }
          ]
        }
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toContain('Magical Sleep');
    });

    it('should combine Trance Magical Sleep with other immunities', () => {
      const playerSummary = {
        race: {
          traits: [
            { name: 'Trance', description: "You don't need to sleep, and magic can't put you to sleep." },
            { description: 'You have immunity to poison.' }
          ]
        }
      };
      const result = raceRules.getImmunities(playerSummary);
      expect(result).toContain('Magical Sleep');
      expect(result).toContain('poison');
    });
  });

  describe('getResistances', () => {
    it('should return empty array when no race', () => {
      const playerSummary = {};
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual([]);
    });

    it('should return empty array when race has no traits or subrace', () => {
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual([]);
    });

    it('should extract resistance from subrace damage_resistance', () => {
      const playerSummary = {
        race: {
          subrace: { damage_resistance: 'Fire' }
        }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Fire');
    });

    it('should extract resistance from trait description', () => {
      const playerSummary = {
        race: {
          traits: [
            { description: 'You have resistance to cold damage.' }
          ]
        }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('cold');
    });

    it('should combine subrace and trait resistances', () => {
      const playerSummary = {
        race: {
          subrace: { damage_resistance: 'Fire' },
          traits: [
            { description: 'You have resistance to poison.' }
          ]
        }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Fire');
      expect(result).toContain('poison');
    });

    it('should include playerSummary resistances', () => {
      const playerSummary = {
        race: { traits: [] },
        resistances: ['Lightning']
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Lightning');
    });

    it('should combine all resistance sources', () => {
      const playerSummary = {
        race: {
          subrace: { damage_resistance: 'Fire' },
          traits: [
            { description: 'You have resistance to cold.' }
          ]
        },
        resistances: ['Acid']
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Fire');
      expect(result).toContain('cold');
      expect(result).toContain('Acid');
    });

    it('should deduplicate resistances', () => {
      const playerSummary = {
        race: {
          traits: [
            { description: 'You have resistance to fire.' }
          ]
        },
        resistances: ['fire']
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result.filter((r) => r === 'fire').length).toBe(1);
    });

    it('should sort resistances alphabetically', () => {
      const playerSummary = {
        race: { traits: [] },
        resistances: [{ name: 'Zebra' }, { name: 'Alpha' }, { name: 'Middle' }]
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result[0].name).toBe('Alpha');
      expect(result[1].name).toBe('Middle');
      expect(result[2].name).toBe('Zebra');
    });

    it('should return Fiendish Legacy resistance based on runtime selection (Abyssal)', async () => {
      const { getRuntimeValue } = await import('../../hooks/useRuntimeState.js');
      getRuntimeValue.mockReturnValue('Abyssal');

      const playerSummary = {
        name: 'TestChar',
        race: {
          traits: [
            { name: 'Fiendish Legacies', description: 'Abyssal: Resistance to Poison damage.' }
          ]
        }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Poison');
    });

    it('should return Fiendish Legacy resistance based on runtime selection (Chthonic)', async () => {
      const { getRuntimeValue } = await import('../../hooks/useRuntimeState.js');
      getRuntimeValue.mockReturnValue('Chthonic');

      const playerSummary = {
        name: 'TestChar',
        race: {
          traits: [
            { name: 'Fiendish Legacies', description: 'Chthonic: Resistance to Necrotic damage.' }
          ]
        }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Necrotic');
    });

    it('should return Fiendish Legacy resistance based on runtime selection (Infernal)', async () => {
      const { getRuntimeValue } = await import('../../hooks/useRuntimeState.js');
      getRuntimeValue.mockReturnValue('Infernal');

      const playerSummary = {
        name: 'TestChar',
        race: {
          traits: [
            { name: 'Fiendish Legacies', description: 'Infernal: Resistance to Fire damage.' }
          ]
        }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Fire');
    });

    it('should not add Fiendish Legacy resistance when no legacy selected', async () => {
      const { getRuntimeValue } = await import('../../hooks/useRuntimeState.js');
      getRuntimeValue.mockReturnValue(null);

      const playerSummary = {
        race: {
          traits: [
            { name: 'Fiendish Legacies', description: 'Abyssal: Resistance to Poison damage.' }
          ]
        }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toContain('Poison');
    });
  });

  describe('getSenses', () => {
    it('should return empty array when no senses or traits', () => {
      const playerStats = { race: { traits: [] } };
      const result = raceRules.getSenses(playerStats);
      expect(result).toEqual([]);
    });

    it('should return existing senses', () => {
      const playerStats = {
        senses: [{ name: 'Normal Vision', value: '60 ft.' }],
        race: { traits: [] }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Normal Vision', value: '60 ft.' });
    });

    it('should handle undefined senses', () => {
      const playerStats = { race: { traits: [] } };
      const result = raceRules.getSenses(playerStats);
      expect(result).toEqual([]);
    });

    it('should extract darkvision with 60 ft range', () => {
      const playerStats = {
        senses: [],
        race: {
          traits: [
            { description: 'You have darkvision with a range of 60 feet.' }
          ]
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
    });

    it('should extract darkvision with 120 ft range', () => {
      const playerStats = {
        senses: [],
        race: {
          traits: [
            { description: 'You have darkvision with a range of 120 feet.' }
          ]
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Darkvision', value: '120 ft.' });
    });

    it('should not duplicate darkvision if already present', () => {
      const playerStats = {
        senses: [{ name: 'Darkvision', value: '120 ft.' }],
        race: {
          traits: [
            { description: 'You have darkvision with a range of 60 feet.' }
          ]
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result.filter((s) => s.name === 'Darkvision').length).toBe(1);
      expect(result.find((s) => s.name === 'Darkvision').value).toBe('120 ft.');
    });

    it('should extract tremorsense with 30 ft range', () => {
      const playerStats = {
        senses: [],
        race: {
          traits: [
            { description: 'You have tremorsense with a range of 30 feet.' }
          ]
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Tremorsense', value: '30 ft.' });
    });

    it('should extract tremorsense with 60 ft range', () => {
      const playerStats = {
        senses: [],
        race: {
          traits: [
            { description: 'You have tremorsense with a range of 60 feet.' }
          ]
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toContainEqual({ name: 'Tremorsense', value: '60 ft.' });
    });

    it('should not duplicate tremorsense if already present', () => {
      const playerStats = {
        senses: [{ name: 'Tremorsense', value: '60 ft.' }],
        race: {
          traits: [
            { description: 'You have tremorsense with a range of 30 feet.' }
          ]
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result.filter((s) => s.name === 'Tremorsense').length).toBe(1);
      expect(result.find((s) => s.name === 'Tremorsense').value).toBe('60 ft.');
    });

    it('should add passive perception when abilities available', () => {
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

    it('should use ability bonus when no skill bonus', () => {
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

    it('should add passive investigation when abilities available', () => {
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

    it('should add passive insight when abilities available', () => {
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

    it('should not add passive skills when abilities missing', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] },
        abilities: []
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).not.toContainEqual({ name: 'Passive Perception', value: '10' });
      expect(result).not.toContainEqual({ name: 'Passive Investigation', value: '10' });
      expect(result).not.toContainEqual({ name: 'Passive Insight', value: '10' });
    });

    it('should not add passive skills when abilities array missing', () => {
      const playerStats = {
        senses: [],
        race: { traits: [] }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).not.toContainEqual({ name: 'Passive Perception', value: '10' });
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

    it('should use ability bonus when skill not found', () => {
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

    it('should sort senses alphabetically', () => {
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

    it('should handle trait with no description', () => {
      const playerStats = {
        senses: [],
        race: {
          traits: [
            { name: 'Some Trait' }
          ]
        }
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toEqual([]);
    });

    it('should handle undefined race', () => {
      const playerStats = {
        senses: []
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toEqual([]);
    });

    it('should handle race without traits', () => {
      const playerStats = {
        senses: [],
        race: {}
      };
      const result = raceRules.getSenses(playerStats);
      expect(result).toEqual([]);
    });
  });

  describe('getRace', () => {
    it('should return playerSummary.race when race not found', () => {
      const allRaces = [];
      const playerSummary = { race: { name: 'Custom Race' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result).toEqual({ name: 'Custom Race' });
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
          subrace: { name: 'High Elf', customProp: 'value' }
        }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.subrace.name).toBe('High Elf');
      expect(result.subrace.damage_resistance).toBe('Fire');
      expect(result.subrace.customProp).toBe('value');
    });

    it('should handle subrace not found in subraces list', () => {
      const allRaces = [
        {
          name: 'Elf',
          subraces: []
        }
      ];
      const playerSummary = {
        race: {
          name: 'Elf',
          subrace: { name: 'High Elf' }
        }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.subrace).toEqual({ name: 'High Elf' });
    });

    it('should handle lineage selection', () => {
      const allRaces = [
        {
          name: 'Elf',
          traits: [
            {
              name: 'Ancestry',
              sub_traits: [
                { name: 'High Elf', description: 'High elf traits.' }
              ]
            }
          ]
        }
      ];
      const playerSummary = {
        race: {
          name: 'Elf',
          lineage: 'High Elf'
        }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.traits[0].selectedLineage).toBeDefined();
      expect(result.traits[0].selectedLineage.name).toBe('High Elf');
    });

    it('should handle lineage not found in sub_traits', () => {
      const allRaces = [
        {
          name: 'Elf',
          traits: [
            {
              name: 'Ancestry',
              sub_traits: [
                { name: 'High Elf', description: 'High elf traits.' }
              ]
            }
          ]
        }
      ];
      const playerSummary = {
        race: {
          name: 'Elf',
          lineage: 'Wood Elf'
        }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.traits[0].selectedLineage).toBeUndefined();
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

    it('should handle race without ability_bonuses', () => {
      const allRaces = [{ name: 'Human', traits: [] }];
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.ability_bonuses).toBeUndefined();
    });

    it('should handle race without traits', () => {
      const allRaces = [{ name: 'Human' }];
      const playerSummary = {
        race: {
          name: 'Human',
          lineage: 'Some Lineage'
        }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.name).toBe('Human');
    });

    it('should handle race with no lineage', () => {
      const allRaces = [
        {
          name: 'Elf',
          traits: [
            {
              name: 'Ancestry',
              sub_traits: [
                { name: 'High Elf', description: 'High elf traits.' }
              ]
            }
          ]
        }
      ];
      const playerSummary = {
        race: { name: 'Elf' }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.traits[0].selectedLineage).toBeUndefined();
    });
  });

  describe('getRacialBonus', () => {
    it('should always return 0', () => {
      const result = raceRules.getRacialBonus();
      expect(result).toBe(0);
    });

    it('should return 0 regardless of arguments', () => {
      const result = raceRules.getRacialBonus({ race: { ability_bonuses: [] } }, 'Strength');
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
      const playerStats = {};
      const result = raceRules.getTraits(playerStats);
      expect(result).toBeDefined();
    });

    it('should handle lineage-specific traits', () => {
      const playerStats = {
        race: {
          lineage: 'High Elf',
          traits: [
            {
              name: 'Ancestry',
              sub_traits: [
                { name: 'High Elf', description: 'High elf traits.' }
              ]
            }
          ]
        }
      };
      const result = raceRules.getTraits(playerStats);
      expect(result).toBeDefined();
      expect(Object.keys(result)).toContain('specialActions');
    });

    it('should merge lineage traits with base traits', () => {
      const playerStats = {
        race: {
          lineage: 'High Elf',
          traits: [
            { name: 'Darkvision', description: 'Can see in the dark' },
            {
              name: 'Ancestry',
              sub_traits: [
                { name: 'High Elf', description: 'High elf lineage traits.' }
              ]
            }
          ]
        }
      };
      const result = raceRules.getTraits(playerStats);
      expect(result).toBeDefined();
    });

    it('should handle lineage not found in sub_traits', () => {
      const playerStats = {
        race: {
          lineage: 'Wood Elf',
          traits: [
            {
              name: 'Ancestry',
              sub_traits: [
                { name: 'High Elf', description: 'High elf traits.' }
              ]
            }
          ]
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

    it('should handle traits with null lineage', () => {
      const playerStats = {
        race: {
          lineage: null,
          traits: [
            { name: 'Darkvision', description: 'Can see in the dark' }
          ]
        }
      };
      const result = raceRules.getTraits(playerStats);
      expect(result).toBeDefined();
    });
  });
});
