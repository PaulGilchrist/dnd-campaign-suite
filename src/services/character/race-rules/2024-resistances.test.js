import { describe, it, expect, vi } from 'vitest';
import raceRules from './2024.js';

vi.mock('../../ui/utils.js', () => ({
  default: {
    getAbilityLongName: vi.fn((name) => name)
  }
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null)
}));

describe('raceRules 2024 - getResistances', () => {
  describe('getResistances', () => {
    it('returns empty array when playerSummary has no race', () => {
      expect(raceRules.getResistances({})).toEqual([]);
    });

    it('handles null/undefined race and traits gracefully', () => {
      expect(raceRules.getResistances({ race: undefined })).toEqual([]);
      expect(raceRules.getResistances({ race: null })).toEqual([]);
      expect(raceRules.getResistances({ race: { traits: null } })).toEqual([]);
      expect(raceRules.getResistances({ race: { traits: undefined } })).toEqual([]);
    });

    it('handles missing subrace gracefully', () => {
      const input = { race: { name: 'Human', subrace: undefined } };
      expect(raceRules.getResistances(input)).toEqual([]);
    });

    it('handles null resistances gracefully', () => {
      const input = { race: { traits: [] }, resistances: null };
      expect(raceRules.getResistances(input)).toEqual([]);
    });

    it('extracts resistance from subrace damage_resistance', () => {
      const input = { race: { subrace: { damage_resistance: 'Fire' } } };
      expect(raceRules.getResistances(input)).toContain('Fire');
    });

    it('extracts resistance from trait description', () => {
      const input = {
        race: { traits: [{ description: 'You have resistance to cold damage.' }] }
      };
      expect(raceRules.getResistances(input)).toContain('cold');
    });

    it('combines subrace, trait, and playerSummary resistances', () => {
      const input = {
        race: {
          subrace: { damage_resistance: 'Fire' },
          traits: [{ description: 'You have resistance to cold.' }]
        },
        resistances: ['Acid']
      };
      const result = raceRules.getResistances(input);
      expect(result).toContain('Fire');
      expect(result).toContain('cold');
      expect(result).toContain('Acid');
    });

    it('deduplicates resistances across sources', () => {
      const input = {
        race: { traits: [{ description: 'You have resistance to fire.' }] },
        resistances: ['fire']
      };
      const result = raceRules.getResistances(input);
      expect(result.filter((r) => r === 'fire').length).toBe(1);
    });

    it('returns resistances sorted alphabetically', () => {
      const input = {
        race: { traits: [] },
        resistances: [{ name: 'Zebra' }, { name: 'Alpha' }, { name: 'Middle' }]
      };
      const result = raceRules.getResistances(input);
      expect(result[0].name).toBe('Alpha');
      expect(result[1].name).toBe('Middle');
      expect(result[2].name).toBe('Zebra');
    });

    it('skips "the" keyword from resistance extraction', () => {
      const input = {
        race: { traits: [{ description: 'You have resistance to the magic damage.' }] }
      };
      const result = raceRules.getResistances(input);
      expect(result).not.toContain('the');
    });

    it('handles trait with no description field', () => {
      const input = { race: { traits: [{ name: 'Some Trait' }] } };
      expect(raceRules.getResistances(input)).toEqual([]);
    });

    it('extracts only single-word resistance per regex match from trait description', () => {
      const input = {
        race: {
          traits: [{ description: 'You have resistance to fire and cold damage.' }]
        }
      };
      const result = raceRules.getResistances(input);
      expect(result).toContain('fire');
      expect(result).not.toContain('cold');
    });

    it('extracts multiple resistances from separate trait descriptions', () => {
      const input = {
        race: {
          traits: [
            { description: 'You have resistance to fire damage.' },
            { description: 'You have resistance to cold damage.' }
          ]
        }
      };
      const result = raceRules.getResistances(input);
      expect(result).toContain('fire');
      expect(result).toContain('cold');
    });

    it('adds Tiefling Fiendish Legacy resistances based on subrace name', () => {
      const tieflingTests = [
        { subrace: 'Abyssal Tiefling', expected: 'Poison' },
        { subrace: 'Chthonic Tiefling', expected: 'Necrotic' },
        { subrace: 'Infernal Tiefling', expected: 'Fire' }
      ];
      for (const { subrace, expected } of tieflingTests) {
        const input = {
          race: {
            name: 'Tiefling',
            subrace: { name: subrace }
          }
        };
        const result = raceRules.getResistances(input);
        expect(result).toContain(expected);
      }
    });

    it('skips Fiendish Legacies trait when Tiefling subrace provides resistance', () => {
      const input = {
        race: {
          name: 'Tiefling',
          subrace: { name: 'Abyssal Tiefling' },
          traits: [{ name: 'Fiendish Legacies', description: 'Resistance to poison damage per legacy.' }]
        }
      };
      const result = raceRules.getResistances(input);
      expect(result).toContain('Poison');
      expect(result).not.toContain('legacies');
    });
  });
});
