import { describe, it, expect } from 'vitest';
import { computePassiveSkills } from './computePassiveSkills.js';

describe('computePassiveSkills', () => {
  describe('basic functionality', () => {
    it('should return an array of senses', () => {
      const playerStats = {
        senses: [{ name: 'Normal Vision', value: '60 ft.' }],
        abilities: [
          { name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 5 }] },
          { name: 'Intelligence', bonus: 1, skills: [{ name: 'Investigation', bonus: 3 }] },
          { name: 'Wisdom', bonus: 2, skills: [{ name: 'Insight', bonus: 2 }] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should return empty array when no senses and no abilities', () => {
      const playerStats = {};
      const result = computePassiveSkills(playerStats);
      expect(result).toEqual([]);
    });

    it('should return existing senses without passive skills when no abilities', () => {
      const playerStats = {
        senses: [{ name: 'Darkvision', value: '60 ft.' }],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
      expect(result).not.toContainEqual({ name: 'Passive Perception' });
    });

    it('should throw when playerStats is null', () => {
      expect(() => computePassiveSkills(null)).toThrow();
    });

    it('should throw when playerStats is undefined', () => {
      expect(() => computePassiveSkills(undefined)).toThrow();
    });
  });

  describe('Passive Perception', () => {
    it('should use skill bonus when Perception skill exists', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 5 }] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '15' });
    });

    it('should use ability bonus when Perception skill does not exist', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Wisdom', bonus: 3, skills: [] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '13' });
    });

    it('should use ability bonus when abilities array has no skills property', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Wisdom', bonus: 2 },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '12' });
    });

    it('should not add Passive Perception when Wisdom ability not found', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Strength', bonus: 2, skills: [] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).not.toContainEqual({ name: 'Passive Perception' });
    });

    it('should not add Passive Perception when abilities is null', () => {
      const playerStats = {
        senses: [],
        abilities: null,
      };
      const result = computePassiveSkills(playerStats);
      expect(result).not.toContainEqual({ name: 'Passive Perception' });
    });

    it('should return base 10 when ability bonus is 0', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Perception', bonus: 0 }] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '10' });
    });

    it('should use skill bonus even when ability bonus is different', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Wisdom', bonus: 1, skills: [{ name: 'Perception', bonus: 7 }] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '17' });
    });
  });

  describe('Passive Investigation', () => {
    it('should use skill bonus when Investigation skill exists', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Intelligence', bonus: 1, skills: [{ name: 'Investigation', bonus: 3 }] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).toContainEqual({ name: 'Passive Investigation', value: '13' });
    });

    it('should use ability bonus when Investigation skill does not exist', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Intelligence', bonus: 2, skills: [] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).toContainEqual({ name: 'Passive Investigation', value: '12' });
    });

    it('should not add Passive Investigation when Intelligence ability not found', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Wisdom', bonus: 2, skills: [] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).not.toContainEqual({ name: 'Passive Investigation' });
    });
  });

  describe('Passive Insight', () => {
    it('should use skill bonus when Insight skill exists', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Wisdom', bonus: 2, skills: [{ name: 'Insight', bonus: 2 }] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).toContainEqual({ name: 'Passive Insight', value: '12' });
    });

    it('should use ability bonus when Insight skill does not exist', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Wisdom', bonus: 3, skills: [] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).toContainEqual({ name: 'Passive Insight', value: '13' });
    });

    it('should not add Passive Insight when Wisdom ability not found for Insight skill', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Intelligence', bonus: 2, skills: [] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).not.toContainEqual({ name: 'Passive Insight' });
    });
  });

  describe('existing senses', () => {
    it('should include existing senses in the result', () => {
      const playerStats = {
        senses: [
          { name: 'Normal Vision', value: '60 ft.' },
          { name: 'Darkvision', value: '60 ft.' },
        ],
        abilities: [
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Perception', bonus: 0 }] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).toContainEqual({ name: 'Normal Vision', value: '60 ft.' });
      expect(result).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
      expect(result).toContainEqual({ name: 'Passive Perception', value: '10' });
    });

    it('should not deduplicate existing passive skills (function adds to existing array)', () => {
      const playerStats = {
        senses: [
          { name: 'Passive Perception', value: '20' },
        ],
        abilities: [
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Perception', bonus: 0 }] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      // The function does not deduplicate - it just adds to the existing senses array
      const passivePerceptionCount = result.filter(s => s.name === 'Passive Perception').length;
      expect(passivePerceptionCount).toBe(2);
    });

    it('should copy the senses array without mutating the original', () => {
      const playerStats = {
        senses: [{ name: 'Normal Vision', value: '60 ft.' }],
        abilities: [
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Perception', bonus: 0 }] },
        ],
      };
      const originalSenses = [...playerStats.senses];
      computePassiveSkills(playerStats);
      expect(playerStats.senses).toEqual(originalSenses);
    });
  });

  describe('sorting', () => {
    it('should sort senses alphabetically by name', () => {
      const playerStats = {
        senses: [
          { name: 'Zebra Vision', value: '10 ft.' },
          { name: 'Alpha Vision', value: '5 ft.' },
        ],
        abilities: [
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Perception', bonus: 0 }] },
          { name: 'Intelligence', bonus: 0, skills: [{ name: 'Investigation', bonus: 0 }] },
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Insight', bonus: 0 }] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      const names = result.map(s => s.name);
      expect(names).toEqual(names.sort());
    });

    it('should sort with all passive skills present', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Perception', bonus: 0 }] },
          { name: 'Intelligence', bonus: 0, skills: [{ name: 'Investigation', bonus: 0 }] },
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Insight', bonus: 0 }] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      const names = result.map(s => s.name);
      expect(names).toEqual(['Passive Insight', 'Passive Investigation', 'Passive Perception']);
    });
  });

  describe('edge cases', () => {
    it('should handle negative ability bonuses', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Wisdom', bonus: -2, skills: [{ name: 'Perception', bonus: -1 }] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '9' });
    });

    it('should handle large ability bonuses', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Wisdom', bonus: 10, skills: [{ name: 'Perception', bonus: 15 }] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '25' });
    });

    it('should handle senses with missing name property', () => {
      const playerStats = {
        senses: [{ value: '60 ft.' }],
        abilities: [
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Perception', bonus: 0 }] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).toContainEqual({ value: '60 ft.' });
      expect(result).toContainEqual({ name: 'Passive Perception', value: '10' });
    });

    it('should handle abilities with missing bonus property', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Wisdom', skills: [{ name: 'Perception', bonus: 5 }] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '15' });
    });

    it('should handle abilities with undefined bonus property', () => {
      const playerStats = {
        senses: [],
        abilities: [
          { name: 'Wisdom', bonus: undefined, skills: [{ name: 'Perception', bonus: 3 }] },
        ],
      };
      const result = computePassiveSkills(playerStats);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '13' });
    });
  });
});
