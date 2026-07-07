import { describe, it, expect } from 'vitest';
import { computePassiveSkills } from './computePassiveSkills.js';

describe('computePassiveSkills', () => {
  it('returns empty array when abilities are missing', () => {
    expect(computePassiveSkills({})).toEqual([]);
  });

  it('returns senses alongside computed passive skills, sorted alphabetically', () => {
    const input = {
      senses: [
        { name: 'Alpha Sight', value: '10 ft.' },
        { name: 'Darkvision', value: '60 ft.' },
      ],
      abilities: [
        { name: 'Wisdom', bonus: 2, skills: [{ name: 'Perception', bonus: 5 }] },
        { name: 'Intelligence', bonus: 1, skills: [{ name: 'Investigation', bonus: 3 }] },
      ],
    };
    const result = computePassiveSkills(input);
    const names = result.map((s) => s.name);
    expect(names).toEqual(names.sort());
    expect(result).toContainEqual({ name: 'Darkvision', value: '60 ft.' });
    expect(result).toContainEqual({ name: 'Passive Insight', value: '12' });
    expect(result).toContainEqual({ name: 'Passive Investigation', value: '13' });
    expect(result).toContainEqual({ name: 'Passive Perception', value: '15' });
  });

  it('falls back to ability bonus when a skill is missing from the skills list', () => {
    const input = {
      abilities: [
        { name: 'Wisdom', bonus: 3, skills: [] },
        { name: 'Intelligence', bonus: 2, skills: [] },
      ],
    };
    const result = computePassiveSkills(input);
    expect(result).toContainEqual({ name: 'Passive Insight', value: '13' });
    expect(result).toContainEqual({ name: 'Passive Investigation', value: '12' });
    expect(result).toContainEqual({ name: 'Passive Perception', value: '13' });
  });

  it('omits passive skills when the required ability is not found', () => {
    const input = {
      abilities: [{ name: 'Strength', bonus: 2, skills: [] }],
    };
    const result = computePassiveSkills(input);
    expect(result.some((s) => s.name.startsWith('Passive '))).toBe(false);
  });
});
