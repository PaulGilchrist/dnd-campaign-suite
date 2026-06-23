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

  it('should return null when the search array is empty', () => {
    const result = findFeat('Great Weapon Master', []);
    expect(result).toBeNull();
  });

  it('should return the first matching feat when multiple feats share the same name', () => {
    const feats = [
      { name: 'Actor', desc: 'first' },
      { name: 'Actor', desc: 'second' },
    ];
    const result = findFeat('Actor', feats);
    expect(result).toEqual({ name: 'Actor', desc: 'first' });
  });

  it('should prefer exact match over parenthetical-stripped match', () => {
    const feats = [
      { name: 'Actor', desc: 'base' },
      { name: 'Actor (Extra)', desc: 'extra' },
    ];
    // Searching for "Actor (Extra)" should match the feat named "Actor (Extra)" exactly,
    // not fall through to the feat named "Actor"
    const result = findFeat('Actor (Extra)', feats);
    expect(result).toEqual({ name: 'Actor (Extra)', desc: 'extra' });
  });

  it('should find a feat when the search name includes a parenthetical suffix', () => {
    const feats = [{ name: 'Actor', desc: '...' }];
    const result = findFeat('Actor (Extra)', feats);
    expect(result).toEqual({ name: 'Actor', desc: '...' });
  });

  it('should find a feat when the search name includes nested parenthetical suffixes', () => {
    const feats = [
      { name: 'Foo Bar Baz', desc: 'base' },
      { name: 'Foo Bar Baz (Extra)', desc: 'extra' },
    ];
    // "Foo Bar Baz (Extra) (More)" strips to "Foo Bar Baz (Extra)" first,
    // which exactly matches the feat with that name
    const result = findFeat('Foo Bar Baz (Extra) (More)', feats);
    expect(result).toEqual({ name: 'Foo Bar Baz (Extra)', desc: 'extra' });
  });

  it('should find a feat when the search name has trailing whitespace after parenthetical', () => {
    const feats = [{ name: 'Tough', desc: '...' }];
    const result = findFeat('Tough (PHB) ', feats);
    expect(result).toEqual({ name: 'Tough', desc: '...' });
  });

  it('should find a feat when parentheses contain special characters', () => {
    const feats = [{ name: 'Skill Expert', desc: '...' }];
    const result = findFeat('Skill Expert (1st, 2nd, 3rd)', feats);
    expect(result).toEqual({ name: 'Skill Expert', desc: '...' });
  });

  it('should find a feat when parentheses contain only whitespace', () => {
    const feats = [{ name: 'Resilient', desc: '...' }];
    const result = findFeat('Resilient (  )', feats);
    expect(result).toEqual({ name: 'Resilient', desc: '...' });
  });

  it('should find a feat when parentheses are empty', () => {
    const feats = [{ name: 'Feat Name', desc: '...' }];
    const result = findFeat('Feat Name ()', feats);
    expect(result).toEqual({ name: 'Feat Name', desc: '...' });
  });

  it('should return undefined when stripped name still does not match any feat', () => {
    const feats = [{ name: 'Actor', desc: '...' }];
    const result = findFeat('Foo (Bar)', feats);
    expect(result).toBeUndefined();
  });

  it('should not match across different casing', () => {
    const feats = [{ name: 'Great Weapon Master', desc: '...' }];
    const result = findFeat('great weapon master', feats);
    expect(result).toBeNull();
  });

  it('should return the full feat object including all properties', () => {
    const feats = [
      { name: 'Complex', source: 'PHB', page: 167, prereqs: ['STR 13'] },
    ];
    const result = findFeat('Complex', feats);
    expect(result).toEqual({ name: 'Complex', source: 'PHB', page: 167, prereqs: ['STR 13'] });
  });

  it('should find a feat object with minimal properties', () => {
    const feats = [{ name: 'Minimal' }];
    const result = findFeat('Minimal', feats);
    expect(result).toEqual({ name: 'Minimal' });
  });

  it('should throw a TypeError when allFeats is null', () => {
    expect(() => findFeat('Actor', null)).toThrow(TypeError);
  });

  it('should throw a TypeError when allFeats is undefined', () => {
    expect(() => findFeat('Actor', undefined)).toThrow(TypeError);
  });

  it('should throw when allFeats is not an array', () => {
    expect(() => findFeat('Actor', { name: 'Actor' })).toThrow(TypeError);
  });
});
