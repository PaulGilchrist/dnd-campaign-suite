// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { findFeat } from './featFinder.js';

describe('findFeat', () => {
  describe('exact match', () => {
    it('returns the feat when search name matches exactly', () => {
      const feats = [
        { name: 'Great Weapon Master', desc: '...' },
        { name: 'Sharpshooter', desc: '...' },
      ];
      expect(findFeat('Great Weapon Master', feats)).toEqual({ name: 'Great Weapon Master', desc: '...' });
    });
  });

  describe('parenthetical stripping fallback', () => {
    it('strips parenthetical suffixes to find a match', () => {
      const feats = [{ name: 'Actor', desc: '...' }];
      expect(findFeat('Actor (Extra)', feats)).toEqual({ name: 'Actor', desc: '...' });
    });

    it('prefers exact match over parenthetical-stripped match when both exist', () => {
      const feats = [
        { name: 'Actor', desc: 'base' },
        { name: 'Actor (Extra)', desc: 'extra' },
      ];
      expect(findFeat('Actor (Extra)', feats)).toEqual({ name: 'Actor (Extra)', desc: 'extra' });
    });
  });

  describe('no match', () => {
    it('returns null when no feat matches the search name', () => {
      const feats = [
        { name: 'Great Weapon Master', desc: '...' },
        { name: 'Actor', desc: '...' },
      ];
      expect(findFeat('Nonexistent Feat', feats)).toBeNull();
    });

    it('returns falsy when stripped name still does not match any feat', () => {
      const feats = [{ name: 'Actor', desc: '...' }];
      expect(findFeat('Foo (Bar)', feats)).toBeFalsy();
    });
  });
});
