// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { findFeat } from './featFinder.js';

describe('findFeat', () => {
  it('returns the feat when search name matches exactly', () => {
    const feats = [
      { name: 'Great Weapon Master', desc: '...' },
    ];
    expect(findFeat('Great Weapon Master', feats)).toEqual({ name: 'Great Weapon Master', desc: '...' });
  });

  it('strips parenthetical suffixes to find a match when no exact match exists', () => {
    const feats = [
      { name: 'Actor', desc: 'base' },
      { name: 'Great Weapon Master', desc: '...' },
    ];
    expect(findFeat('Actor (Extra)', feats)).toEqual({ name: 'Actor', desc: 'base' });
    expect(findFeat('Nonexistent (Extra)', feats)).toBeFalsy();
  });

  it('prefers exact match over parenthetical-stripped match when both exist', () => {
    const feats = [
      { name: 'Actor', desc: 'base' },
      { name: 'Actor (Extra)', desc: 'extra' },
    ];
    expect(findFeat('Actor (Extra)', feats)).toEqual({ name: 'Actor (Extra)', desc: 'extra' });
  });
});
