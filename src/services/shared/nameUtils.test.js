// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { stripParenthetical, stripNumericSuffix } from './nameUtils.js';

describe('stripParenthetical', () => {
  it('returns the name unchanged when there is no parenthetical', () => {
    expect(stripParenthetical('Grimjaw')).toBe('Grimjaw');
  });

  it('trims trailing whitespace after removing a trailing parenthetical', () => {
    expect(stripParenthetical('Grimjaw (Orc)')).toBe('Grimjaw');
    expect(stripParenthetical('Longfellow the Brave (Halfling)')).toBe(
      'Longfellow the Brave',
    );
  });

  it('removes a parenthetical with no space before it', () => {
    expect(stripParenthetical('Grimjaw(Orc)')).toBe('Grimjaw');
  });

  it('handles empty or whitespace-only parentheticals', () => {
    expect(stripParenthetical('Grimjaw ()')).toBe('Grimjaw');
    expect(stripParenthetical('Grimjaw (  )')).toBe('Grimjaw');
  });

  it('does not remove parentheses that are not at the end', () => {
    expect(stripParenthetical('Grimjaw (Orc) the Destroyer')).toBe(
      'Grimjaw (Orc) the Destroyer',
    );
  });

  it('returns empty string when input is only a parenthetical or empty', () => {
    expect(stripParenthetical('(Orc)')).toBe('');
    expect(stripParenthetical('')).toBe('');
  });
});

describe('stripNumericSuffix', () => {
  it('returns the name unchanged when there is no numeric suffix', () => {
    expect(stripNumericSuffix('Grimjaw')).toBe('Grimjaw');
    expect(stripNumericSuffix('Grimjaw   ')).toBe('Grimjaw   ');
  });

  it('removes a numeric suffix preceded by whitespace', () => {
    expect(stripNumericSuffix('Grimjaw 12')).toBe('Grimjaw');
    expect(stripNumericSuffix('Longfellow the Brave 3')).toBe(
      'Longfellow the Brave',
    );
  });

  it('does not remove a number without a space before it', () => {
    expect(stripNumericSuffix('Grimjaw1')).toBe('Grimjaw1');
  });

  it('does not remove numbers embedded in the name or followed by non-digits', () => {
    expect(stripNumericSuffix('Grimjaw the 1st')).toBe('Grimjaw the 1st');
    expect(stripNumericSuffix('Grimjaw 5a')).toBe('Grimjaw 5a');
  });

  it('preserves trailing whitespace when there is no numeric suffix at the very end', () => {
    expect(stripNumericSuffix('Grimjaw 5  ')).toBe('Grimjaw 5  ');
  });

  it('returns empty string for null, undefined, or empty input', () => {
    expect(stripNumericSuffix(null)).toBe('');
    expect(stripNumericSuffix(undefined)).toBe('');
    expect(stripNumericSuffix('')).toBe('');
  });

  it('returns the number unchanged when the input is only a number', () => {
    expect(stripNumericSuffix('42')).toBe('42');
  });

  it('strips a numeric suffix after a parenthetical', () => {
    expect(stripNumericSuffix('Grimjaw (Orc) 2')).toBe('Grimjaw (Orc)');
  });

  it('preserves whitespace-only input unchanged', () => {
    expect(stripNumericSuffix('   ')).toBe('   ');
  });
});
