import { describe, it, expect, vi } from 'vitest';
import raceRules from './5e.js';

vi.mock('../../ui/utils.js', () => ({
  default: {
    getAbilityLongName: vi.fn((name) => name)
  }
}));

describe('raceRules 5e - getRace', () => {
  describe('getRace', () => {
    it('returns undefined when allRaces is empty', () => {
      const allRaces = [];
      const playerSummary = { race: { name: 'Custom Race' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result).toBeUndefined();
    });

    it('returns a clone of the found race (not the original reference)', () => {
      const allRaces = [{ name: 'Human', traits: [] }];
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.name).toBe('Human');
      expect(result).not.toBe(allRaces[0]);
    });

    it('merges playerSummary race data into the result', () => {
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

    it('resolves subrace from JSON data and merges playerSummary subrace data', () => {
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
        },
        subrace: { customProp: 'value' }
      };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.subrace.name).toBe('High Elf');
      expect(result.subrace.damage_resistance).toBe('Fire');
      expect(result.subrace.customProp).toBe('value');
    });

    it('sets subrace to null when no subrace is selected or subrace name does not match', () => {
      // No subrace selected
      const allRacesNoSubrace = [
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
      const result1 = raceRules.getRace(allRacesNoSubrace, {
        race: { name: 'Elf' }
      });
      expect(result1.subrace).toBeNull();

      // Subrace name does not match
      const allRacesMismatch = [
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
      const result2 = raceRules.getRace(allRacesMismatch, {
        race: { name: 'Elf', subrace: { name: 'Wood Elf' } }
      });
      expect(result2.subrace).toBeNull();

      // Empty subraces array
      const allRacesEmpty = [
        {
          name: 'Elf',
          subraces: []
        }
      ];
      const result3 = raceRules.getRace(allRacesEmpty, {
        race: { name: 'Elf' }
      });
      expect(result3.subrace).toBeNull();
    });

    it('converts ability_score abbreviations via utils.getAbilityLongName for both race and subrace', () => {
      const allRaces = [
        {
          name: 'Elf',
          ability_bonuses: [{ ability_score: 'STR', bonus: 1 }],
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
      expect(result.ability_bonuses[0].ability_score).toBe('STR');
      expect(result.subrace.ability_bonuses[0].ability_score).toBe('INT');
    });

    it('handles race without ability_bonuses', () => {
      const allRaces = [{ name: 'Human', traits: [] }];
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result.ability_bonuses).toBeUndefined();
    });

    it('handles playerSummary.race without name', () => {
      const allRaces = [{ name: 'Human' }];
      const playerSummary = { race: {} };
      const result = raceRules.getRace(allRaces, playerSummary);
      expect(result).toBeUndefined();
    });

    it('preserves clone independence from source', () => {
      const sourceRace = { name: 'Human', traits: [] };
      const allRaces = [sourceRace];
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getRace(allRaces, playerSummary);
      result.customProp = 'added';
      expect(sourceRace.customProp).toBeUndefined();
    });
  });
});
