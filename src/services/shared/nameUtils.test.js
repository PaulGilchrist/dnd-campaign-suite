import { describe, it, expect } from 'vitest';
import { stripParenthetical, stripNumericSuffix } from './nameUtils.js';

describe('stripParenthetical', () => {
  it('returns the name unchanged when there is no parenthetical', () => {
    expect(stripParenthetical('Grimjaw')).toBe('Grimjaw');
  });

  it('removes a trailing parenthetical with surrounding whitespace', () => {
    expect(stripParenthetical('Grimjaw (Orc)')).toBe('Grimjaw');
  });

  it('trims trailing whitespace after removing a parenthetical', () => {
    expect(stripParenthetical('Grimjaw (Orc)  ')).toBe('Grimjaw');
  });

  it('removes an empty parenthetical', () => {
    expect(stripParenthetical('Grimjaw ()')).toBe('Grimjaw');
  });

  it('removes a parenthetical containing only whitespace', () => {
    expect(stripParenthetical('Grimjaw (  )')).toBe('Grimjaw');
  });

  it('does not remove parentheses that are not at the end', () => {
    expect(stripParenthetical('Grimjaw (Orc) the Destroyer')).toBe(
      'Grimjaw (Orc) the Destroyer',
    );
  });

  it('does not remove nested parentheses at the end (regex stops at first closing paren)', () => {
    expect(stripParenthetical('Grimjaw (Orc (Subrace))')).toBe(
      'Grimjaw (Orc (Subrace))',
    );
  });

  it('returns empty string when the name is only a parenthetical', () => {
    expect(stripParenthetical('(Orc)')).toBe('');
  });

  it('returns empty string for an empty input', () => {
    expect(stripParenthetical('')).toBe('');
  });

  it('handles a multi-word name with a parenthetical', () => {
    expect(stripParenthetical('Longfellow the Brave (Halfling)')).toBe(
      'Longfellow the Brave',
    );
  });

  it('handles special characters inside the parenthetical', () => {
    expect(stripParenthetical('Grimjaw (Orc/Barbarian)')).toBe('Grimjaw');
  });

  it('handles a parenthetical with no space before the opening parenthesis', () => {
    expect(stripParenthetical('Grimjaw(Orc)')).toBe('Grimjaw');
  });
});

describe('stripNumericSuffix', () => {
  it('returns the name unchanged when there is no numeric suffix', () => {
    expect(stripNumericSuffix('Grimjaw')).toBe('Grimjaw');
  });

  it('removes a single-digit numeric suffix', () => {
    expect(stripNumericSuffix('Grimjaw 1')).toBe('Grimjaw');
  });

  it('removes a multi-digit numeric suffix', () => {
    expect(stripNumericSuffix('Grimjaw 12')).toBe('Grimjaw');
  });

  it('does not remove a number without a space before it', () => {
    expect(stripNumericSuffix('Grimjaw1')).toBe('Grimjaw1');
  });

  it('returns an empty string when input is null', () => {
    expect(stripNumericSuffix(null)).toBe('');
  });

  it('returns an empty string when input is undefined', () => {
    expect(stripNumericSuffix(undefined)).toBe('');
  });

  it('returns an empty string when input is an empty string', () => {
    expect(stripNumericSuffix('')).toBe('');
  });

  it('handles a multi-word name with a numeric suffix', () => {
    expect(stripNumericSuffix('Longfellow the Brave 3')).toBe(
      'Longfellow the Brave',
    );
  });

  it('does not remove a number embedded in the middle of the name', () => {
    expect(stripNumericSuffix('Grimjaw the 1st')).toBe('Grimjaw the 1st');
  });

  it('returns the number unchanged when the name is only a number', () => {
    expect(stripNumericSuffix('42')).toBe('42');
  });

  it('does not remove a trailing number when there are extra spaces after it', () => {
    expect(stripNumericSuffix('Grimjaw 5  ')).toBe('Grimjaw 5  ');
  });

  it('preserves trailing whitespace when there is no numeric suffix', () => {
    expect(stripNumericSuffix('Grimjaw   ')).toBe('Grimjaw   ');
  });

  it('handles a parenthesized name with a numeric suffix', () => {
    expect(stripNumericSuffix('Grimjaw (Orc) 2')).toBe('Grimjaw (Orc)');
  });

  it('handles a string of only whitespace', () => {
    expect(stripNumericSuffix('   ')).toBe('   ');
  });

  it('removes a leading-zero numeric suffix', () => {
    expect(stripNumericSuffix('Grimjaw 01')).toBe('Grimjaw');
  });

  it('does not remove a number followed by a non-digit', () => {
    expect(stripNumericSuffix('Grimjaw 5a')).toBe('Grimjaw 5a');
  });
});
