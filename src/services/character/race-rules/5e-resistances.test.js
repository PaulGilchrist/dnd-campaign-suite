import { describe, it, expect } from 'vitest';
import raceRules from './5e.js';

describe('raceRules 5e - getResistances', () => {
  describe('getResistances', () => {
    it('returns empty array when race has no name', () => {
      const playerSummary = { race: {} };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual([]);
    });

    it('adds Poison resistance for Dwarf race', () => {
      const playerSummary = { race: { name: 'Dwarf' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual(['Poison']);
    });

    it('does not add Poison resistance for non-Dwarf race', () => {
      const playerSummary = { race: { name: 'Human' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual([]);
    });

    it('adds subrace damage_resistance for non-Dwarf races', () => {
      const playerSummary = {
        race: {
          name: 'Human',
          subrace: { damage_resistance: 'Fire' }
        }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual(['Fire']);
    });

    it('does not add subrace damage_resistance for Dwarf', () => {
      const playerSummary = {
        race: {
          name: 'Dwarf',
          subrace: { damage_resistance: 'Fire' }
        }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual(['Poison']);
    });

    it('adds Charm resistance for Elf race', () => {
      const playerSummary = { race: { name: 'Elf' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual(['Charm']);
    });

    it('adds Frightened resistance for Halfling race', () => {
      const playerSummary = { race: { name: 'Halfling' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual(['Frightened']);
    });

    it('adds Poison resistance for Scout Halfling subrace in addition to Frightened', () => {
      const playerSummary = {
        race: {
          name: 'Halfling',
          subrace: { name: 'Scout Halfling' }
        }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual(['Frightened', 'Poison']);
    });

    it('does not add extra Poison for non-Scout Halfling subrace', () => {
      const playerSummary = {
        race: {
          name: 'Halfling',
          subrace: { name: 'Lightfoot Halfling' }
        }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual(['Frightened']);
    });

    it('adds Fire resistance for Tiefling race', () => {
      const playerSummary = { race: { name: 'Tiefling' } };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual(['Fire']);
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

    it('handles null subrace gracefully', () => {
      const playerSummary = {
        race: {
          name: 'Human',
          subrace: null
        }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual([]);
    });

    it('handles empty or undefined resistances gracefully', () => {
      const base = { race: { name: 'Elf' } };
      expect(raceRules.getResistances({ ...base, resistances: [] })).toEqual(['Charm']);
      expect(raceRules.getResistances({ ...base, resistances: undefined })).toEqual(['Charm']);
    });

    it('handles subrace without damage_resistance', () => {
      const playerSummary = {
        race: {
          name: 'Human',
          subrace: { name: 'Variant' }
        }
      };
      const result = raceRules.getResistances(playerSummary);
      expect(result).toEqual([]);
    });
  });
});
