// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { computePassiveSkills } from './computePassiveSkills.js';

describe('computePassiveSkills', () => {
  describe('null/undefined input', () => {
    it('throws TypeError when playerStats is null or undefined', () => {
      expect(() => computePassiveSkills(null)).toThrow(TypeError);
      expect(() => computePassiveSkills(undefined)).toThrow(TypeError);
    });
  });

  describe('empty input', () => {
    it('returns empty array when input is empty, abilities is null, or abilities is undefined', () => {
      expect(computePassiveSkills({})).toEqual([]);
      expect(computePassiveSkills({ senses: [], abilities: null })).toEqual([]);
      expect(computePassiveSkills({ senses: [], abilities: undefined })).toEqual([]);
    });
  });

  describe('senses passthrough', () => {
    it('returns existing senses alongside computed passive skills', () => {
      const input = {
        senses: [
          { name: 'Darkvision', value: '60 ft.' },
          { name: 'Alpha Sight', value: '10 ft.' },
        ],
        abilities: [{ name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 5 }] }],
      };
      const result = computePassiveSkills(input);
      expect(result).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
      expect(result).toContainEqual({ name: 'Alpha Sight', value: '10 ft.' });
      expect(result).toContainEqual({ name: 'Passive Perception', value: '15' });
    });

    it('sorts all entries alphabetically by name', () => {
      const input = {
        senses: [{ name: 'Zebra Vision', value: '10 ft.' }],
        abilities: [
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Perception', bonus: 0 }] },
          { name: 'Intelligence', bonus: 0, skills: [{ name: 'Investigation', bonus: 0 }] },
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Insight', bonus: 0 }] },
        ],
      };
      const result = computePassiveSkills(input);
      const names = result.map((s) => s.name);
      expect(names).toEqual(names.sort());
    });
  });

  describe('passive skill score computation', () => {
    it('computes passive skill values from skill bonus when skill exists', () => {
      const input = {
        abilities: [{ name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 5 }] }],
      };
      const result = computePassiveSkills(input);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '15' });
    });

    it('falls back to ability bonus when the passive skill is missing from the skills list', () => {
      const inputs = [
        {
          expected: { name: 'Passive Perception', value: '13' },
          input: { abilities: [{ name: 'Wisdom', bonus: 3, skills: [] }] },
        },
        {
          expected: { name: 'Passive Investigation', value: '12' },
          input: { abilities: [{ name: 'Intelligence', bonus: 2, skills: [] }] },
        },
        {
          expected: { name: 'Passive Insight', value: '13' },
          input: { abilities: [{ name: 'Wisdom', bonus: 3, skills: [] }] },
        },
      ];
      for (const { expected, input } of inputs) {
        const result = computePassiveSkills(input);
        expect(result).toContainEqual(expected);
      }
    });

    it('handles negative bonuses', () => {
      const input = {
        abilities: [{ name: 'Wisdom', bonus: -2, skills: [{ name: 'Perception', bonus: -1 }] }],
      };
      const result = computePassiveSkills(input);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '9' });
    });

    it('handles large positive bonuses', () => {
      const input = {
        abilities: [{ name: 'Wisdom', bonus: 10, skills: [{ name: 'Perception', bonus: 15 }] }],
      };
      const result = computePassiveSkills(input);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '25' });
    });
  });

  describe('missing ability for passive skills', () => {
    it('omits passive skills when the required ability is not found', () => {
      const input = {
        abilities: [{ name: 'Strength', bonus: 2, skills: [] }],
      };
      const result = computePassiveSkills(input);
      expect(result.some((s) => s.name === 'Passive Perception')).toBe(false);
      expect(result.some((s) => s.name === 'Passive Insight')).toBe(false);
      expect(result.some((s) => s.name === 'Passive Investigation')).toBe(false);
    });
  });

  describe('combined senses and passive skills', () => {
    it('includes all three passive skills when all abilities and skills are present', () => {
      const input = {
        abilities: [
          { name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 5 }, { name: 'Insight', bonus: 2 }] },
          { name: 'Intelligence', bonus: 1, skills: [{ name: 'Investigation', bonus: 3 }] },
        ],
      };
      const result = computePassiveSkills(input);
      expect(result).toHaveLength(3);
      expect(result.map((s) => s.name)).toEqual([
        'Passive Insight',
        'Passive Investigation',
        'Passive Perception',
      ]);
    });

    it('includes only available passive skills when some abilities are missing', () => {
      const input = {
        abilities: [
          { name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 5 }] },
        ],
      };
      const result = computePassiveSkills(input);
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '15' });
      expect(result).toContainEqual({ name: 'Passive Insight', value: '12' });
      expect(result.some((s) => s.name === 'Passive Investigation')).toBe(false);
    });
  });
});
