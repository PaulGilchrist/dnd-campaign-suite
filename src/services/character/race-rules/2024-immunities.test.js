import { describe, it, expect } from 'vitest';
import raceRules from './2024.js';

describe('raceRules 2024 - getImmunities', () => {
  describe('getImmunities', () => {
    it('returns empty array when playerSummary is empty', () => {
      expect(raceRules.getImmunities({})).toEqual([]);
    });

    it('returns empty array when traits have no immunity mention', () => {
      const input = {
        race: {
          traits: [
            { description: 'You have darkvision with a range of 60 feet.' },
            { description: 'You can speak Common and Elvish.' }
          ]
        }
      };
      expect(raceRules.getImmunities(input)).toEqual([]);
    });

    it('extracts immunity type from trait description', () => {
      const input = {
        race: {
          traits: [{ description: 'You have immunity to poison damage.' }]
        }
      };
      const result = raceRules.getImmunities(input);
      expect(result).toContain('poison');
    });

    it('extracts immunity type ending with a period', () => {
      const input = {
        race: {
          traits: [{ description: 'You have immunity to charm.' }]
        }
      };
      expect(raceRules.getImmunities(input)).toContain('charm');
    });

    it('extracts multiple immunities from different traits', () => {
      const input = {
        race: {
          traits: [
            { description: 'You have immunity to poison.' },
            { description: 'You have immunity to disease.' }
          ]
        }
      };
      const result = raceRules.getImmunities(input);
      expect(result).toContain('poison');
      expect(result).toContain('disease');
    });

    it('combines trait immunities with playerSummary immunities', () => {
      const input = {
        race: {
          traits: [{ description: 'You have immunity to poison.' }]
        },
        immunities: ['Disease']
      };
      const result = raceRules.getImmunities(input);
      expect(result).toContain('poison');
      expect(result).toContain('Disease');
    });

    it('deduplicates immunities across sources', () => {
      const input = {
        race: {
          traits: [{ description: 'You have immunity to poison.' }]
        },
        immunities: ['poison']
      };
      const result = raceRules.getImmunities(input);
      expect(result.filter((i) => i === 'poison').length).toBe(1);
    });

    it('returns immunities sorted alphabetically', () => {
      const input = {
        race: { traits: [] },
        immunities: ['Zebra', 'Alpha', 'Middle']
      };
      const result = raceRules.getImmunities(input);
      expect(result).toEqual(['Alpha', 'Middle', 'Zebra']);
    });

    it('returns object immunities sorted by name alphabetically', () => {
      const input = {
        race: { traits: [] },
        immunities: [{ name: 'Zebra' }, { name: 'Alpha' }, { name: 'Middle' }]
      };
      const result = raceRules.getImmunities(input);
      expect(result[0].name).toBe('Alpha');
      expect(result[1].name).toBe('Middle');
      expect(result[2].name).toBe('Zebra');
    });

    it('adds Magical Sleep immunity for Trance trait', () => {
      const input = {
        race: {
          traits: [{ name: 'Trance', description: "Magic can't put you to sleep." }]
        }
      };
      expect(raceRules.getImmunities(input)).toContain('Magical Sleep');
    });

    it('combines Trance Magical Sleep with other immunities', () => {
      const input = {
        race: {
          traits: [
            { name: 'Trance', description: "Magic can't put you to sleep." },
            { description: 'You have immunity to poison.' }
          ]
        }
      };
      const result = raceRules.getImmunities(input);
      expect(result).toContain('Magical Sleep');
      expect(result).toContain('poison');
    });

    it('handles trait with no description field', () => {
      const input = { race: { traits: [{ name: 'Some Trait' }] } };
      expect(raceRules.getImmunities(input)).toEqual([]);
    });
  });
});
