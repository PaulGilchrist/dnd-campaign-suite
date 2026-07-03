// @cleaned-by-ai
// @improved-by-ai
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
    it('returns existing senses unchanged when no abilities', () => {
      const input = { senses: [{ name: 'Darkvision', value: '60 ft.' }] };
      const result = computePassiveSkills(input);
      expect(result).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
    });

    it('returns sorted senses when no abilities', () => {
      const input = {
        senses: [
          { name: 'Zebra Sight', value: '10 ft.' },
          { name: 'Alpha Sight', value: '30 ft.' },
        ],
      };
      const result = computePassiveSkills(input);
      const names = result.map((s) => s.name);
      expect(names).toEqual(['Alpha Sight', 'Zebra Sight']);
    });

    it('does not mutate the input senses array', () => {
      const input = { senses: [{ name: 'Normal Vision', value: '60 ft.' }] };
      const originalLength = input.senses.length;
      computePassiveSkills(input);
      expect(input.senses.length).toBe(originalLength);
    });

    it('handles senses with missing name property', () => {
      const input = { senses: [{ value: '60 ft.' }] };
      const result = computePassiveSkills(input);
      expect(result).toContainEqual({ value: '60 ft.' });
    });

    it('does not deduplicate existing passive skill entries', () => {
      const input = { senses: [{ name: 'Passive Perception', value: '20' }] };
      const result = computePassiveSkills(input);
      const count = result.filter((s) => s.name === 'Passive Perception').length;
      expect(count).toBe(1);
    });
  });

  describe('passive skill score computation', () => {
    it('computes Passive Perception from skill bonus when Perception skill exists', () => {
      const input = {
        abilities: [{ name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 5 }] }],
      };
      const result = computePassiveSkills(input);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '15' });
    });

    it('computes Passive Investigation from skill bonus when Investigation skill exists', () => {
      const input = {
        abilities: [{ name: 'Intelligence', bonus: 1, skills: [{ name: 'Investigation', bonus: 3 }] }],
      };
      const result = computePassiveSkills(input);
      expect(result).toContainEqual({ name: 'Passive Investigation', value: '13' });
    });

    it('computes Passive Insight from skill bonus when Insight skill exists', () => {
      const input = {
        abilities: [{ name: 'Wisdom', bonus: 2, skills: [{ name: 'Insight', bonus: 2 }] }],
      };
      const result = computePassiveSkills(input);
      expect(result).toContainEqual({ name: 'Passive Insight', value: '12' });
    });

    it('falls back to ability bonus when the passive skill is missing from the skills list', () => {
      const inputs = [
        {
          expected: { name: 'Passive Perception', value: '13' },
          input: { abilities: [{ name: 'Wisdom', bonus: 3, skills: [] }] },
        },
        {
          expected: { name: 'Passive Perception', value: '12' },
          input: { abilities: [{ name: 'Wisdom', bonus: 2 }] },
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
  });

  describe('skill bonus takes precedence over ability bonus', () => {
    it('uses skill bonus for passive skills when both skill and ability exist', () => {
      const cases = [
        {
          expected: { name: 'Passive Perception', value: '17' },
          input: { abilities: [{ name: 'Wisdom', bonus: 1, skills: [{ name: 'Perception', bonus: 7 }] }] },
        },
        {
          expected: { name: 'Passive Investigation', value: '11' },
          input: { abilities: [{ name: 'Intelligence', bonus: 5, skills: [{ name: 'Investigation', bonus: 1 }] }] },
        },
        {
          expected: { name: 'Passive Insight', value: '14' },
          input: { abilities: [{ name: 'Wisdom', bonus: -1, skills: [{ name: 'Insight', bonus: 4 }] }] },
        },
      ];
      for (const { expected, input } of cases) {
        const result = computePassiveSkills(input);
        expect(result).toContainEqual(expected);
      }
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

  describe('score boundary conditions', () => {
    it('returns base 10 when ability bonus is 0 and no skill', () => {
      const input = {
        abilities: [{ name: 'Wisdom', bonus: 0, skills: [] }],
      };
      const result = computePassiveSkills(input);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '10' });
    });

    it('returns base 10 when skill bonus is 0', () => {
      const input = {
        abilities: [{ name: 'Wisdom', bonus: 0, skills: [{ name: 'Perception', bonus: 0 }] }],
      };
      const result = computePassiveSkills(input);
      expect(result).toContainEqual({ name: 'Passive Perception', value: '10' });
    });

    it('handles negative ability and skill bonuses', () => {
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

    it('treats missing or undefined ability bonus as 0', () => {
      const result1 = computePassiveSkills({
        abilities: [{ name: 'Wisdom', skills: [{ name: 'Perception', bonus: 5 }] }],
      });
      expect(result1).toContainEqual({ name: 'Passive Perception', value: '15' });

      const result2 = computePassiveSkills({
        abilities: [{ name: 'Wisdom', bonus: undefined, skills: [{ name: 'Perception', bonus: 3 }] }],
      });
      expect(result2).toContainEqual({ name: 'Passive Perception', value: '13' });
    });
  });

  describe('sorting', () => {
    it('sorts all passive skills alphabetically', () => {
      const input = {
        abilities: [
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Perception', bonus: 0 }] },
          { name: 'Intelligence', bonus: 0, skills: [{ name: 'Investigation', bonus: 0 }] },
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Insight', bonus: 0 }] },
        ],
      };
      const result = computePassiveSkills(input);
      const names = result.map((s) => s.name);
      expect(names).toEqual(['Passive Insight', 'Passive Investigation', 'Passive Perception']);
    });

    it('sorts mixed senses and passive skills alphabetically', () => {
      const input = {
        senses: [{ name: 'Zebra Vision', value: '10 ft.' }, { name: 'Alpha Vision', value: '5 ft.' }],
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

  describe('combined senses and passive skills', () => {
    it('includes existing senses alongside computed passive skills', () => {
      const input = {
        senses: [
          { name: 'Normal Vision', value: '60 ft.' },
          { name: 'Darkvision', value: '60 ft.' },
        ],
        abilities: [
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Perception', bonus: 0 }] },
        ],
      };
      const result = computePassiveSkills(input);
      expect(result).toContainEqual({ name: 'Normal Vision', value: '60 ft.' });
      expect(result).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
      expect(result).toContainEqual({ name: 'Passive Perception', value: '10' });
    });

    it('includes all three passive skills when all abilities and skills are present', () => {
      const input = {
        senses: [],
        abilities: [
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Perception', bonus: 0 }] },
          { name: 'Intelligence', bonus: 0, skills: [{ name: 'Investigation', bonus: 0 }] },
          { name: 'Wisdom', bonus: 0, skills: [{ name: 'Insight', bonus: 0 }] },
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
        senses: [],
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
