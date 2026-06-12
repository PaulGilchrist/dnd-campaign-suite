import { describe, it, expect } from 'vitest';
import { findFeat } from './featFinder.js';

describe('findFeat', () => {
  it('should find a feat by exact name match', () => {
    const allFeats = [
      { name: 'Great Weapon Master', desc: '...' },
      { name: 'Sharpshooter', desc: '...' },
    ];
    const result = findFeat('Great Weapon Master', allFeats);
    expect(result).toEqual({ name: 'Great Weapon Master', desc: '...' });
  });

  it('should return null when no feat matches', () => {
    const allFeats = [
      { name: 'Great Weapon Master', desc: '...' },
      { name: 'Sharpshooter', desc: '...' },
    ];
    const result = findFeat('Nonexistent Feat', allFeats);
    expect(result).toBeNull();
  });

  it('should throw when allFeats is null', () => {
    expect(() => findFeat('Great Weapon Master', null)).toThrow(TypeError);
  });

  it('should throw when allFeats is undefined', () => {
    expect(() => findFeat('Great Weapon Master', undefined)).toThrow(TypeError);
  });

  it('should return null when allFeats is an empty array', () => {
    const result = findFeat('Great Weapon Master', []);
    expect(result).toBeNull();
  });

  it('should find a feat when search name has a parenthetical suffix', () => {
    const allFeats = [
      { name: 'Actor', desc: '...' },
    ];
    const result = findFeat('Actor (Extra)', allFeats);
    expect(result).toEqual({ name: 'Actor', desc: '...' });
  });

  it('should find a feat when search name has a trailing parenthetical with spaces', () => {
    const allFeats = [
      { name: 'Alert', desc: '...' },
    ];
    const result = findFeat('Alert   (Bonus)', allFeats);
    expect(result).toEqual({ name: 'Alert', desc: '...' });
  });

  it('should find a feat via fallback when search has extra parenthetical', () => {
    const allFeats = [
      { name: 'Foo Bar Baz (Extra)', desc: '...' },
    ];
    // "Foo Bar Baz (Extra) (More)" strips to "Foo Bar Baz (Extra)" which exact matches
    const result = findFeat('Foo Bar Baz (Extra) (More)', allFeats);
    expect(result).toEqual({ name: 'Foo Bar Baz (Extra)', desc: '...' });
  });

  it('should find a feat when search name has nested parentheses stripped', () => {
    const allFeats = [
      { name: 'Foo Bar Baz', desc: '...' },
    ];
    const result = findFeat('Foo Bar Baz (Extra)', allFeats);
    expect(result).toEqual({ name: 'Foo Bar Baz', desc: '...' });
  });

  it('should find an exact match before trying parenthetical stripping', () => {
    const allFeats = [
      { name: 'Actor', desc: 'exact' },
      { name: 'Actor (Extra)', desc: 'extra' },
    ];
    // When searching for "Actor (Extra)", exact match should win
    const result = findFeat('Actor (Extra)', allFeats);
    expect(result).toEqual({ name: 'Actor (Extra)', desc: 'extra' });
  });

  it('should return the first matching feat when multiple feats have the same name', () => {
    const allFeats = [
      { name: 'Actor', desc: 'first' },
      { name: 'Actor', desc: 'second' },
    ];
    const result = findFeat('Actor', allFeats);
    expect(result).toEqual({ name: 'Actor', desc: 'first' });
  });

  it('should match feat name with different casing only via exact match', () => {
    const allFeats = [
      { name: 'Great Weapon Master', desc: '...' },
    ];
    // Case-sensitive exact match should NOT match
    const result = findFeat('great weapon master', allFeats);
    expect(result).toBeNull();
  });

  it('should not strip parentheticals when the stripped version equals the original', () => {
    const allFeats = [
      { name: 'No Parentheses', desc: '...' },
    ];
    // "No Parentheses" has no parenthetical, so stripped === original,
    // and no fallback is attempted
    const result = findFeat('No Parentheses', allFeats);
    expect(result).toEqual({ name: 'No Parentheses', desc: '...' });
  });

  it('should handle feat names with empty parentheses', () => {
    const allFeats = [
      { name: 'Feat Name', desc: '...' },
    ];
    const result = findFeat('Feat Name ()', allFeats);
    expect(result).toEqual({ name: 'Feat Name', desc: '...' });
  });

  it('should handle feat names with parentheses containing special characters', () => {
    const allFeats = [
      { name: 'Skill Expert', desc: '...' },
    ];
    const result = findFeat('Skill Expert (1st, 2nd, 3rd)', allFeats);
    expect(result).toEqual({ name: 'Skill Expert', desc: '...' });
  });

  it('should handle feat names with multiple words and parentheses', () => {
    const allFeats = [
      { name: 'Crusher', desc: '...' },
    ];
    const result = findFeat('Crusher (PHB)', allFeats);
    expect(result).toEqual({ name: 'Crusher', desc: '...' });
  });

  it('should return undefined when stripped name still does not match any feat', () => {
    const allFeats = [
      { name: 'Actor', desc: '...' },
    ];
    const result = findFeat('Foo (Bar)', allFeats);
    expect(result).toBeUndefined();
  });

  it('should handle feat objects with minimal properties', () => {
    const allFeats = [
      { name: 'Minimal' },
    ];
    const result = findFeat('Minimal', allFeats);
    expect(result).toEqual({ name: 'Minimal' });
  });

  it('should handle feat objects with many properties', () => {
    const allFeats = [
      { name: 'Complex', source: 'PHB', page: 167, prereqs: ['STR 13'] },
    ];
    const result = findFeat('Complex', allFeats);
    expect(result.source).toBe('PHB');
    expect(result.page).toBe(167);
    expect(result.prereqs).toEqual(['STR 13']);
  });

  it('should find feat when search name has trailing whitespace after parenthetical', () => {
    const allFeats = [
      { name: 'Tough', desc: '...' },
    ];
    const result = findFeat('Tough (PHB) ', allFeats);
    expect(result).toEqual({ name: 'Tough', desc: '...' });
  });

  it('should find feat when search name has parentheses with only whitespace inside', () => {
    const allFeats = [
      { name: 'Resilient', desc: '...' },
    ];
    const result = findFeat('Resilient (  )', allFeats);
    expect(result).toEqual({ name: 'Resilient', desc: '...' });
  });
});
