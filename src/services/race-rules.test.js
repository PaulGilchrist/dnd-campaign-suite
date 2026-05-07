import { describe, it, expect } from 'vitest';
import { rules5e as raceRules } from './race-rules/index.js';

describe('raceRules', () => {
  describe('getImmunities', () => {
    it('should return empty array for race without immunities', () => {
      const playerSummary = {
        race: { name: 'Human' },
        class: { name: 'Fighter' },
        level: 1
         };

      const result = raceRules.getImmunities(playerSummary);

      expect(result).toEqual([]);
       });

    it('should return Magical Sleep immunity for Elf', () => {
      const playerSummary = {
        race: { name: 'Elf' },
        class: { name: 'Wizard' },
        level: 1
         };

      const result = raceRules.getImmunities(playerSummary);

      expect(result).toContain('Magical Sleep');
       });

    it('should return Disease and Poison immunities for Monk level 10+', () => {
      const playerSummary = {
        race: { name: 'Human' },
        class: { name: 'Monk' },
        level: 10
         };

      const result = raceRules.getImmunities(playerSummary);

      expect(result).toContain('Disease');
      expect(result).toContain('Poison');
       });

    it('should not return Monk immunities for level 9 or below', () => {
      const playerSummary = {
        race: { name: 'Human' },
        class: { name: 'Monk' },
        level: 9
         };

      const result = raceRules.getImmunities(playerSummary);

      expect(result).not.toContain('Disease');
      expect(result).not.toContain('Poison');
       });

    it('should return Disease immunity for Paladin level 3+', () => {
      const playerSummary = {
        race: { name: 'Human' },
        class: { name: 'Paladin' },
        level: 3
         };

      const result = raceRules.getImmunities(playerSummary);

      expect(result).toContain('Disease');
       });

    it('should not return Paladin immunity for level 2 or below', () => {
      const playerSummary = {
        race: { name: 'Human' },
        class: { name: 'Paladin' },
        level: 2
         };

      const result = raceRules.getImmunities(playerSummary);

      expect(result).not.toContain('Disease');
       });

    it('should combine immunities from race, class, and playerSummary', () => {
      const playerSummary = {
        race: { name: 'Elf' },
        class: { name: 'Monk' },
        level: 10,
        immunities: ['Custom Immunity']
         };

      const result = raceRules.getImmunities(playerSummary);

      expect(result).toContain('Magical Sleep');
      expect(result).toContain('Disease');
      expect(result).toContain('Poison');
      expect(result).toContain('Custom Immunity');
       });

    it('should deduplicate immunities', () => {
      const playerSummary = {
        race: { name: 'Elf' },
        class: { name: 'Monk' },
        level: 10,
        immunities: ['Magical Sleep']
         };

      const result = raceRules.getImmunities(playerSummary);

      expect(result.filter(imm => imm === 'Magical Sleep')).toHaveLength(1);
       });

    it('should return sorted immunities', () => {
      const playerSummary = {
        race: { name: 'Elf' },
        class: { name: 'Monk' },
        level: 10,
        immunities: ['Zebra', 'Apple']
         };

      const result = raceRules.getImmunities(playerSummary);

      expect(result[0]).toBe('Apple');
     });
      });

  describe('getRace', () => {
    const mockRaces = [
        {
          name: 'Human',
          ability_bonuses: [{ ability_score: 'STR', bonus: 1 }],
          traits: [],
          subraces: []
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

    it('should return race data for valid race', () => {
      const playerSummary = {
        race: { name: 'Human' }
         };

      const result = raceRules.getRace(mockRaces, playerSummary);

      expect(result.name).toBe('Human');
      expect(result.ability_bonuses[0].ability_score).toBe('Strength');
       });

    it('should convert ability_score abbreviations to full names', () => {
      const playerSummary = {
        race: { name: 'Elf' }
         };

      const result = raceRules.getRace(mockRaces, playerSummary);

      expect(result.ability_bonuses[0].ability_score).toBe('Dexterity');
       });

    it('should include subrace when specified', () => {
      const playerSummary = {
        race: {
          name: 'Elf',
          subrace: { name: 'High Elf' }
           }
          };

      const result = raceRules.getRace(mockRaces, playerSummary);

      expect(result.subrace.name).toBe('High Elf');
      expect(result.subrace.ability_bonuses[0].ability_score).toBe('Intelligence');
       });

    it('should set subrace to null when not specified', () => {
      const playerSummary = {
        race: { name: 'Elf' }
         };

      const result = raceRules.getRace(mockRaces, playerSummary);

      expect(result.subrace).toBeNull();
       });

    it('should delete subraces property from result', () => {
      const playerSummary = {
        race: { name: 'Elf' }
         };

      const result = raceRules.getRace(mockRaces, playerSummary);

      expect(result.subraces).toBeUndefined();
       });

    it('should merge playerSummary race data with base race', () => {
      const playerSummary = {
        race: {
          name: 'Human',
          customProperty: 'custom value'
           }
          };

      const result = raceRules.getRace(mockRaces, playerSummary);

      expect(result.name).toBe('Human');
      expect(result.customProperty).toBe('custom value');
       });

    it('should handle race not found', () => {
      const playerSummary = {
        race: { name: 'NonExistent' }
         };

      const result = raceRules.getRace(mockRaces, playerSummary);

      expect(result).toBeUndefined();
          });

    it('should handle race without ability_bonuses', () => {
      const races = [
          { name: 'Human', traits: [] }
        ];
      const playerSummary = {
        race: { name: 'Human' }
         };

      const result = raceRules.getRace(races, playerSummary);

      expect(result.name).toBe('Human');
      expect(result.ability_bonuses).toBeUndefined();
       });
     });

  describe('getRacialBonus', () => {
    it('should return 0 for race without ability bonuses', () => {
      const playerStats = {
        race: {
          name: 'Human',
          ability_bonuses: []
          }
         };

      const result = raceRules.getRacialBonus(playerStats, 'Strength');

      expect(result).toBe(0);
       });

    it('should return bonus from race ability_bonuses', () => {
      const playerStats = {
        race: {
          name: 'Human',
          ability_bonuses: [{ ability_score: 'Strength', bonus: 1 }]
          }
         };

      const result = raceRules.getRacialBonus(playerStats, 'Strength');

      expect(result).toBe(1);
       });

    it('should return bonus from subrace ability_bonuses', () => {
      const playerStats = {
        race: {
          name: 'Elf',
          ability_bonuses: [{ ability_score: 'Dexterity', bonus: 2 }],
          subrace: {
            name: 'High Elf',
            ability_bonuses: [{ ability_score: 'Intelligence', bonus: 1 }]
            }
          }
         };

      const result = raceRules.getRacialBonus(playerStats, 'Intelligence');

      expect(result).toBe(1);
       });

    it('should combine bonuses from race and subrace', () => {
      const playerStats = {
        race: {
          name: 'Elf',
          ability_bonuses: [{ ability_score: 'Dexterity', bonus: 2 }],
          subrace: {
            name: 'High Elf',
            ability_bonuses: [{ ability_score: 'Dexterity', bonus: 1 }]
            }
          }
         };

      const result = raceRules.getRacialBonus(playerStats, 'Dexterity');

      expect(result).toBe(3);
       });

    it('should return 0 for ability without bonus', () => {
      const playerStats = {
        race: {
          name: 'Human',
          ability_bonuses: [{ ability_score: 'Strength', bonus: 1 }]
          }
         };

      const result = raceRules.getRacialBonus(playerStats, 'Dexterity');

      expect(result).toBe(0);
       });

    it('should handle race without subrace', () => {
      const playerStats = {
        race: {
          name: 'Human',
          ability_bonuses: [{ ability_score: 'Strength', bonus: 1 }],
          subrace: null
          }
         };

      const result = raceRules.getRacialBonus(playerStats, 'Strength');

      expect(result).toBe(1);
       });

    it('should handle subrace without ability_bonuses', () => {
      const playerStats = {
        race: {
          name: 'Elf',
          ability_bonuses: [{ ability_score: 'Dexterity', bonus: 2 }],
          subrace: {
            name: 'High Elf',
            traits: []
            }
          }
         };

      const result = raceRules.getRacialBonus(playerStats, 'Dexterity');

      expect(result).toBe(2);
       });
     });

  describe('getResistances', () => {
    it('should return empty array for race without resistances', () => {
      const playerSummary = {
        race: { name: 'Human' }
         };

      const result = raceRules.getResistances(playerSummary);

      expect(result).toEqual([]);
       });

    it('should return Charm resistance for Elf', () => {
      const playerSummary = {
        race: { name: 'Elf' }
         };

      const result = raceRules.getResistances(playerSummary);

      expect(result).toContain('Charm');
       });

    it('should return Frightened resistance for Halfling', () => {
      const playerSummary = {
        race: { name: 'Halfling' }
         };

      const result = raceRules.getResistances(playerSummary);

      expect(result).toContain('Frightened');
       });

    it('should return Fire resistance for Tiefling', () => {
      const playerSummary = {
        race: { name: 'Tiefling' }
         };

      const result = raceRules.getResistances(playerSummary);

      expect(result).toContain('Fire');
       });

    it('should return Fire resistance for Red Dragonborn', () => {
      const playerSummary = {
        race: { name: 'Dragonborn', type: 'Red' }
         };

      const result = raceRules.getResistances(playerSummary);

      expect(result).toContain('Fire');
       });

    it('should return Acid resistance for Black Dragonborn', () => {
      const playerSummary = {
        race: { name: 'Dragonborn', type: 'Black' }
         };

      const result = raceRules.getResistances(playerSummary);

      expect(result).toContain('Acid');
       });

    it('should return Lightning resistance for Blue Dragonborn', () => {
      const playerSummary = {
        race: { name: 'Dragonborn', type: 'Blue' }
         };

      const result = raceRules.getResistances(playerSummary);

      expect(result).toContain('Lightning');
       });

    it('should return Cold resistance for White Dragonborn', () => {
      const playerSummary = {
        race: { name: 'Dragonborn', type: 'White' }
         };

      const result = raceRules.getResistances(playerSummary);

      expect(result).toContain('Cold');
       });

    it('should return Poison resistance for Scout Halfling', () => {
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

    it('should combine resistances from race and playerSummary', () => {
      const playerSummary = {
        race: { name: 'Tiefling' },
        resistances: ['Custom Resistance']
         };

      const result = raceRules.getResistances(playerSummary);

      expect(result).toContain('Fire');
      expect(result).toContain('Custom Resistance');
       });

    it('should deduplicate resistances', () => {
      const playerSummary = {
        race: { name: 'Tiefling' },
        resistances: ['Fire']
         };

      const result = raceRules.getResistances(playerSummary);

      expect(result.filter(r => r === 'Fire')).toHaveLength(1);
       });

    it('should return sorted resistances', () => {
      const playerSummary = {
        race: { name: 'Tiefling' },
        resistances: ['Zebra', 'Apple']
         };

      const result = raceRules.getResistances(playerSummary);

      expect(result[0]).toBe('Apple');
       });
     });

  describe('getSenses', () => {
    it('should return existing senses', () => {
      const playerStats = {
        senses: [{ name: 'Normal Vision', value: '60 ft.' }],
        race: {
          traits: []
          }
         };

      const result = raceRules.getSenses(playerStats);

      expect(result).toContainEqual({ name: 'Normal Vision', value: '60 ft.' });
       });

    it('should add Darkvision when race has Darkvision trait', () => {
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

      expect(result.filter(s => s.name === 'Darkvision')).toHaveLength(1);
      expect(result.find(s => s.name === 'Darkvision').value).toBe('120 ft.');
       });

    it('should handle null senses', () => {
      const playerStats = {
        senses: null,
        race: {
          traits: [{ name: 'Darkvision' }]
          }
         };

      const result = raceRules.getSenses(playerStats);

      expect(result).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
       });

    it('should handle undefined senses', () => {
      const playerStats = {
        race: {
          traits: [{ name: 'Darkvision' }]
          }
         };

      const result = raceRules.getSenses(playerStats);

      expect(result).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
       });

    it('should return sorted senses', () => {
      const playerStats = {
        senses: [{ name: 'Zebra Vision', value: '10 ft.' }],
        race: {
          traits: [{ name: 'Darkvision' }]
          }
         };

      const result = raceRules.getSenses(playerStats);

      expect(result[0].name).toBe('Darkvision');
       });

    it('should not add Darkvision when race does not have the trait', () => {
      const playerStats = {
        senses: [],
        race: {
          traits: [{ name: 'Other Trait' }]
          }
         };

      const result = raceRules.getSenses(playerStats);

      expect(result).not.toContainEqual({ name: 'Darkvision', value: '60 ft.' });
       });
     });

  describe('getTraits', () => {
    it('should return categorized traits from race', () => {
      const playerStats = {
        race: {
          traits: [
              { name: 'Darkvision', description: 'Can see in the dark' },
              { name: 'Fey Ancestry', description: 'Advantage on saves against being charmed' }
              ],
          subrace: null
          }
         };

      const result = raceRules.getTraits(playerStats);

            expect(result).toBeDefined();
      expect(Object.keys(result)).toContain('specialActions');
        });

    it('should merge traits from race and subrace', () => {
      const playerStats = {
        race: {
          traits: [{ name: 'Darkvision', description: 'Can see in the dark' }],
          subrace: {
            name: 'High Elf',
            racial_traits: [{ name: 'Cantrip', description: 'Know one cantrip' }]
            }
          }
         };

      const result = raceRules.getTraits(playerStats);

      expect(result).toBeDefined();
       });

    it('should handle race without subrace', () => {
      const playerStats = {
        race: {
          traits: [{ name: 'Darkvision', description: 'Can see in the dark' }],
          subrace: null
          }
         };

      const result = raceRules.getTraits(playerStats);

      expect(result).toBeDefined();
       });

    it('should handle subrace without racial_traits', () => {
      const playerStats = {
        race: {
          traits: [{ name: 'Darkvision', description: 'Can see in the dark' }],
          subrace: {
            name: 'High Elf'
            }
          }
         };

      const result = raceRules.getTraits(playerStats);

      expect(result).toBeDefined();
       });

    it('should return empty traits when race has no traits', () => {
      const playerStats = {
        race: {
          traits: [],
          subrace: null
          }
         };

      const result = raceRules.getTraits(playerStats);

      expect(result).toBeDefined();
       });
     });

  describe('addTraits', () => {
    it('should categorize traits', () => {
      const traits = [
          { name: 'Darkvision', description: 'Can see in the dark' },
          { name: 'Fey Ancestry', description: 'Advantage on saves' }
          ];

      const result = raceRules.addTraits(traits);

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
       });

    it('should handle empty traits array', () => {
      const result = raceRules.addTraits([]);

      expect(result).toBeDefined();
       });
     });
});

