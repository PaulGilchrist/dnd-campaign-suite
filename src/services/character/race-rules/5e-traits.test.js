import { describe, it, expect } from 'vitest';
import raceRules from './5e.js';

describe('raceRules 5e - getTraits', () => {
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
      const names = result.specialActions.map((t) => t.name);
      expect(names).toContain('Darkvision');
      expect(names).toContain('Fey Ancestry');
    });

    it('merges subrace racial_traits with base traits and deduplicates', () => {
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
      const names = result.specialActions.map((t) => t.name);
      expect(names).toContain('Darkvision');
      expect(names).toContain('Elven Weapon Training');
    });

    it('deduplicates traits when base and subrace have the same trait', () => {
      const playerStats = {
        race: {
          traits: [
            { name: 'Darkvision', description: 'Base darkvision' }
          ],
          subrace: {
            racial_traits: [
              { name: 'Darkvision', description: 'Extended darkvision' }
            ]
          }
        }
      };
      const result = raceRules.getTraits(playerStats);
      expect(result.specialActions.filter((t) => t.name === 'Darkvision').length).toBe(1);
    });

    it('handles race without subrace', () => {
      const playerStats = {
        race: {
          traits: [
            { name: 'Darkvision', description: 'Can see in the dark' }
          ]
        }
      };
      const result = raceRules.getTraits(playerStats);
      const names = result.specialActions.map((t) => t.name);
      expect(names).toContain('Darkvision');
    });
  });
});
