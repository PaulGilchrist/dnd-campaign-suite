import { describe, it, expect } from 'vitest';
import { stripParenthetical, stripNumericSuffix } from './nameUtils.js';

describe('stripParenthetical', () => {
  it('removes a trailing parenthetical with optional space before it', () => {
    expect(stripParenthetical('Grimjaw (Orc)')).toBe('Grimjaw');
    expect(stripParenthetical('Grimjaw(Orc)')).toBe('Grimjaw');
    expect(stripParenthetical('Longfellow the Brave (Halfling)')).toBe(
      'Longfellow the Brave',
    );
  });

  it('does not remove non-trailing parentheticals', () => {
    expect(stripParenthetical('Grimjaw (Orc) the Destroyer')).toBe(
      'Grimjaw (Orc) the Destroyer',
    );
  });

  it('handles empty parentheticals and returns empty string for empty input', () => {
    expect(stripParenthetical('Grimjaw ()')).toBe('Grimjaw');
    expect(stripParenthetical('(Orc)')).toBe('');
    expect(stripParenthetical('')).toBe('');
  });

  it('does not crash on null/undefined — throws TypeError', () => {
    expect(() => stripParenthetical(null)).toThrow(TypeError);
    expect(() => stripParenthetical(undefined)).toThrow(TypeError);
  });

  it('trims the result but not trailing whitespace inside the parenthetical match', () => {
    expect(stripParenthetical('  Grimjaw (Orc)  ')).toBe('Grimjaw');
    expect(stripParenthetical('  (Orc)  ')).toBe('');
  });

  it('does not handle nested parentheses — leaves unmatched content', () => {
    expect(stripParenthetical('Grimjaw (Orc (Subtype))')).toBe(
      'Grimjaw (Orc (Subtype))',
    );
    expect(stripParenthetical('Grimjaw (Orc) (Subtype)')).toBe('Grimjaw (Orc)');
  });
});

describe('stripNumericSuffix', () => {
  it('removes a numeric suffix preceded by whitespace', () => {
    expect(stripNumericSuffix('Grimjaw 12')).toBe('Grimjaw');
    expect(stripNumericSuffix('Longfellow the Brave 3')).toBe(
      'Longfellow the Brave',
    );
    expect(stripNumericSuffix('Grimjaw (Orc) 2')).toBe('Grimjaw (Orc)');
  });

  it('handles null and undefined', () => {
    expect(stripNumericSuffix(null)).toBe('');
    expect(stripNumericSuffix(undefined)).toBe('');
  });

  it('does not remove numbers without leading whitespace', () => {
    expect(stripNumericSuffix('Grimjaw1')).toBe('Grimjaw1');
    expect(stripNumericSuffix('Grimjaw the 1st')).toBe('Grimjaw the 1st');
    expect(stripNumericSuffix('Grimjaw 5a')).toBe('Grimjaw 5a');
    expect(stripNumericSuffix('Grimjaw 5  ')).toBe('Grimjaw 5  ');
    expect(stripNumericSuffix('42')).toBe('42');
  });

  it('does not trim trailing whitespace after the numeric suffix', () => {
    expect(stripNumericSuffix('Grimjaw 12  ')).toBe('Grimjaw 12  ');
    expect(stripNumericSuffix('Grimjaw  ')).toBe('Grimjaw  ');
  });

  it('returns input unchanged for whitespace-only, and strips trailing numeric-only with surrounding spaces', () => {
    expect(stripNumericSuffix('   ')).toBe('   ');
    expect(stripNumericSuffix('  42  ')).toBe('  42  ');
  });
});
