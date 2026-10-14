import { describe, it, expect } from 'vitest';
import { computePassiveSkills } from './computePassiveSkills.js';

describe('computePassiveSkills', () => {
  it('returns empty array when input has no abilities or senses', () => {
    expect(computePassiveSkills({})).toEqual([]);
  });

  it('returns empty array when abilities array is empty', () => {
    expect(computePassiveSkills({ abilities: [] })).toEqual([]);
  });

  it('returns senses when abilities is null', () => {
    const input = {
      senses: [{ name: 'Blindsight', value: '30 ft.' }],
    };
    expect(computePassiveSkills(input)).toEqual([
      { name: 'Blindsight', value: '30 ft.' },
    ]);
  });

  it('returns senses when abilities array is empty (no passive skills added)', () => {
    const input = {
      senses: [{ name: 'Tremorsense', value: '60 ft.' }],
      abilities: [],
    };
    expect(computePassiveSkills(input)).toEqual([
      { name: 'Tremorsense', value: '60 ft.' },
    ]);
  });

  it('computes passive skills from ability bonuses when skill entries are missing', () => {
    const input = {
      abilities: [
        { name: 'Wisdom', bonus: 3, skills: [] },
        { name: 'Intelligence', bonus: 2, skills: [] },
      ],
    };
    const result = computePassiveSkills(input);
    expect(result).toEqual([
      { name: 'Passive Insight', value: '13' },
      { name: 'Passive Investigation', value: '12' },
      { name: 'Passive Perception', value: '13' },
    ]);
  });

  it('uses individual skill bonuses when present instead of ability bonus', () => {
    const input = {
      abilities: [
        {
          name: 'Wisdom',
          bonus: 1,
          skills: [
            { name: 'Perception', bonus: 5 },
            { name: 'Insight', bonus: 0 },
          ],
        },
        {
          name: 'Intelligence',
          bonus: 1,
          skills: [{ name: 'Investigation', bonus: 4 }],
        },
      ],
    };
    const result = computePassiveSkills(input);
    expect(result).toEqual([
      { name: 'Passive Insight', value: '10' },
      { name: 'Passive Investigation', value: '14' },
      { name: 'Passive Perception', value: '15' },
    ]);
  });

  it('includes senses alongside passive skills sorted alphabetically (localeCompare order)', () => {
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
    expect(result).toEqual([
      { name: 'Alpha Sight', value: '10 ft.' },
      { name: 'Darkvision', value: '60 ft.' },
      { name: 'Passive Insight', value: '12' },
      { name: 'Passive Investigation', value: '13' },
      { name: 'Passive Perception', value: '15' },
    ]);
  });

  it('omits all passive skills when required abilities are not found', () => {
    const input = {
      abilities: [{ name: 'Strength', bonus: 2, skills: [] }],
      senses: [{ name: 'Blindsight', value: '30 ft.' }],
    };
    const result = computePassiveSkills(input);
    expect(result).toEqual([
      { name: 'Blindsight', value: '30 ft.' },
    ]);
  });

  it('handles zero ability and skill bonuses', () => {
    const input = {
      abilities: [
        { name: 'Wisdom', bonus: 0, skills: [{ name: 'Perception', bonus: 0 }] },
        { name: 'Intelligence', bonus: 0, skills: [{ name: 'Investigation', bonus: 0 }] },
      ],
    };
    const result = computePassiveSkills(input);
    expect(result).toEqual([
      { name: 'Passive Insight', value: '10' },
      { name: 'Passive Investigation', value: '10' },
      { name: 'Passive Perception', value: '10' },
    ]);
  });

  it('handles negative ability bonuses', () => {
    const input = {
      abilities: [
        { name: 'Wisdom', bonus: -2, skills: [{ name: 'Perception', bonus: -1 }] },
        { name: 'Intelligence', bonus: -1, skills: [{ name: 'Investigation', bonus: -2 }] },
      ],
    };
    const result = computePassiveSkills(input);
    expect(result).toEqual([
      { name: 'Passive Insight', value: '8' },
      { name: 'Passive Investigation', value: '8' },
      { name: 'Passive Perception', value: '9' },
    ]);
  });

  it('uses skill bonus over ability bonus when both exist', () => {
    const input = {
      abilities: [
        {
          name: 'Wisdom',
          bonus: 5,
          skills: [{ name: 'Perception', bonus: -3 }],
        },
        {
          name: 'Intelligence',
          bonus: 5,
          skills: [{ name: 'Investigation', bonus: 4 }],
        },
      ],
    };
    const result = computePassiveSkills(input);
    // Perception: 10 + (-3) = 7 (skill bonus used, not ability bonus 5)
    // Investigation: 10 + 4 = 14 (skill bonus used)
    // Insight: 10 + 5 = 15 (no skill entry, falls back to ability bonus)
    expect(result).toEqual([
      { name: 'Passive Insight', value: '15' },
      { name: 'Passive Investigation', value: '14' },
      { name: 'Passive Perception', value: '7' },
    ]);
  });

  it('handles missing bonus field by treating it as 0', () => {
    const input = {
      abilities: [
        { name: 'Wisdom', skills: [{ name: 'Perception' }] },
        { name: 'Intelligence', skills: [{ name: 'Investigation' }] },
      ],
    };
    const result = computePassiveSkills(input);
    expect(result).toEqual([
      { name: 'Passive Insight', value: '10' },
      { name: 'Passive Investigation', value: '10' },
      { name: 'Passive Perception', value: '10' },
    ]);
  });

  it('handles undefined skills array gracefully', () => {
    const input = {
      abilities: [
        { name: 'Wisdom', bonus: 2 },
        { name: 'Intelligence', bonus: 1 },
      ],
    };
    const result = computePassiveSkills(input);
    expect(result).toEqual([
      { name: 'Passive Insight', value: '12' },
      { name: 'Passive Investigation', value: '11' },
      { name: 'Passive Perception', value: '12' },
    ]);
  });

  it('returns only senses when all passive skill abilities are missing', () => {
    const input = {
      senses: [
        { name: 'Darkvision', value: '60 ft.' },
        { name: 'Passive Perception', value: '15' },
      ],
      abilities: [{ name: 'Dexterity', bonus: 3, skills: [] }],
    };
    const result = computePassiveSkills(input);
    // Original senses preserved, no passive skills added (Wisdom/Intelligence not in abilities)
    expect(result).toEqual([
      { name: 'Darkvision', value: '60 ft.' },
      { name: 'Passive Perception', value: '15' },
    ]);
  });

  it('does not duplicate passive skill entries when ability exists but skill is missing', () => {
    const input = {
      abilities: [
        { name: 'Wisdom', bonus: 2, skills: [] },
        { name: 'Intelligence', bonus: 1, skills: [] },
      ],
      senses: [{ name: 'Passive Perception', value: '20' }],
    };
    const result = computePassiveSkills(input);
    // Should have original Passive Perception from senses AND computed one
    const passivePerceptions = result.filter((s) => s.name === 'Passive Perception');
    expect(passivePerceptions).toHaveLength(2);
    expect(result).toContainEqual({ name: 'Passive Perception', value: '20' });
    expect(result).toContainEqual({ name: 'Passive Perception', value: '12' });
  });

  it('handles large positive bonuses', () => {
    const input = {
      abilities: [
        { name: 'Wisdom', bonus: 6, skills: [{ name: 'Perception', bonus: 9 }] },
        { name: 'Intelligence', bonus: 5, skills: [{ name: 'Investigation', bonus: 7 }] },
      ],
    };
    const result = computePassiveSkills(input);
    expect(result).toEqual([
      { name: 'Passive Insight', value: '16' },
      { name: 'Passive Investigation', value: '17' },
      { name: 'Passive Perception', value: '19' },
    ]);
  });
});
