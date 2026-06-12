import { describe, it, expect } from 'vitest';
import { stripParenthetical, stripNumericSuffix } from './nameUtils.js';

describe('stripParenthetical', () => {
  it('should return the name unchanged when there is no parenthetical', () => {
    expect(stripParenthetical('Grimjaw')).toBe('Grimjaw');
  });

  it('should remove a parenthetical at the end', () => {
    expect(stripParenthetical('Grimjaw (Orc)')).toBe('Grimjaw');
  });

  it('should remove a parenthetical with trailing whitespace', () => {
    expect(stripParenthetical('Grimjaw (Orc)  ')).toBe('Grimjaw');
  });

  it('should remove a parenthetical with leading whitespace before it', () => {
    expect(stripParenthetical('Grimjaw (Orc)')).toBe('Grimjaw');
  });

  it('should handle an empty parenthetical', () => {
    expect(stripParenthetical('Grimjaw ()')).toBe('Grimjaw');
  });

  it('should handle a parenthetical with spaces inside', () => {
    expect(stripParenthetical('Grimjaw (  )')).toBe('Grimjaw');
  });

  it('should not remove text inside parentheses that is not at the end', () => {
    expect(stripParenthetical('Grimjaw (Orc) the Destroyer')).toBe(
      'Grimjaw (Orc) the Destroyer',
    );
  });

  it('should handle nested parentheses at the end (non-greedy match from first open paren)', () => {
    expect(stripParenthetical('Grimjaw (Orc (Subrace))')).toBe('Grimjaw (Orc (Subrace))');
  });

  it('should handle a name that is only a parenthetical', () => {
    expect(stripParenthetical('(Orc)')).toBe('');
  });

  it('should handle an empty string', () => {
    expect(stripParenthetical('')).toBe('');
  });

  it('should handle a name with multiple words and a parenthetical', () => {
    expect(stripParenthetical('Longfellow the Brave (Halfling)')).toBe(
      'Longfellow the Brave',
    );
  });

  it('should handle a name with special characters in the parenthetical', () => {
    expect(stripParenthetical('Grimjaw (Orc/Barbarian)')).toBe('Grimjaw');
  });

  it('should handle a name with no trailing space before parenthetical', () => {
    expect(stripParenthetical('Grimjaw(Orc)')).toBe('Grimjaw');
  });

  it('should handle multiple spaces before the parenthetical', () => {
    expect(stripParenthetical('Grimjaw   (Orc)')).toBe('Grimjaw');
  });

  it('should not modify a string with parentheses in the middle only', () => {
    expect(stripParenthetical('Grimjaw (Orc) Fighter')).toBe(
      'Grimjaw (Orc) Fighter',
    );
  });
});

describe('stripNumericSuffix', () => {
  it('should return the name unchanged when there is no numeric suffix', () => {
    expect(stripNumericSuffix('Grimjaw')).toBe('Grimjaw');
  });

  it('should remove a single-digit numeric suffix', () => {
    expect(stripNumericSuffix('Grimjaw 1')).toBe('Grimjaw');
  });

  it('should remove a multi-digit numeric suffix', () => {
    expect(stripNumericSuffix('Grimjaw 12')).toBe('Grimjaw');
  });

  it('should remove a numeric suffix without extra space before it', () => {
    expect(stripNumericSuffix('Grimjaw1')).toBe('Grimjaw1');
  });

  it('should return empty string when input is null', () => {
    expect(stripNumericSuffix(null)).toBe('');
  });

  it('should return empty string when input is undefined', () => {
    expect(stripNumericSuffix(undefined)).toBe('');
  });

  it('should return empty string when input is an empty string', () => {
    expect(stripNumericSuffix('')).toBe('');
  });

  it('should handle a name with multiple words and a numeric suffix', () => {
    expect(stripNumericSuffix('Longfellow the Brave 3')).toBe(
      'Longfellow the Brave',
    );
  });

  it('should not remove a number in the middle of the name', () => {
    expect(stripNumericSuffix('Grimjaw the 1st')).toBe('Grimjaw the 1st');
  });

  it('should handle a name that is only a number', () => {
    expect(stripNumericSuffix('42')).toBe('42');
  });

  it('should handle a name with a number and trailing whitespace', () => {
    expect(stripNumericSuffix('Grimjaw 5  ')).toBe('Grimjaw 5  ');
  });

  it('should handle a name with no numeric suffix but trailing whitespace', () => {
    expect(stripNumericSuffix('Grimjaw   ')).toBe('Grimjaw   ');
  });

  it('should handle a name with a numeric suffix and no space', () => {
    expect(stripNumericSuffix('Grimjaw1')).toBe('Grimjaw1');
  });

  it('should handle a string with parentheses and a numeric suffix', () => {
    expect(stripNumericSuffix('Grimjaw (Orc) 2')).toBe('Grimjaw (Orc)');
  });
});
