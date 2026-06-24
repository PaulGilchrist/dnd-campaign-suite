// @improved-by-ai
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

    it('returns the first matching feat when multiple feats share the same name', () => {
      const feats = [
        { name: 'Actor', desc: 'first' },
        { name: 'Actor', desc: 'second' },
      ];
      expect(findFeat('Actor', feats)).toEqual({ name: 'Actor', desc: 'first' });
    });

    it('returns the full feat object preserving all properties', () => {
      const feats = [
        { name: 'Complex', source: 'PHB', page: 167, prereqs: ['STR 13'] },
      ];
      expect(findFeat('Complex', feats)).toEqual({ name: 'Complex', source: 'PHB', page: 167, prereqs: ['STR 13'] });
    });

    it('returns the feat when it has minimal properties', () => {
      const feats = [{ name: 'Minimal' }];
      expect(findFeat('Minimal', feats)).toEqual({ name: 'Minimal' });
    });

    it('is case-sensitive and does not match different casing', () => {
      const feats = [{ name: 'Great Weapon Master', desc: '...' }];
      expect(findFeat('great weapon master', feats)).toBeNull();
    });

    it('does not match when the search string is a substring of a feat name', () => {
      const feats = [{ name: 'Actor (Extra)', desc: '...' }];
      expect(findFeat('Actor', feats)).toBeNull();
    });
  });

  describe('parenthetical stripping fallback', () => {
    it('strips a simple parenthetical suffix to find a match', () => {
      const feats = [{ name: 'Actor', desc: '...' }];
      expect(findFeat('Actor (Extra)', feats)).toEqual({ name: 'Actor', desc: '...' });
    });

    it('strips nested parenthetical suffixes', () => {
      const feats = [
        { name: 'Foo Bar Baz', desc: 'base' },
        { name: 'Foo Bar Baz (Extra)', desc: 'extra' },
      ];
      expect(findFeat('Foo Bar Baz (Extra) (More)', feats)).toEqual({ name: 'Foo Bar Baz (Extra)', desc: 'extra' });
    });

    it('strips a parenthetical with trailing whitespace', () => {
      const feats = [{ name: 'Tough', desc: '...' }];
      expect(findFeat('Tough (PHB) ', feats)).toEqual({ name: 'Tough', desc: '...' });
    });

    it('strips a parenthetical containing special characters like commas and ordinals', () => {
      const feats = [{ name: 'Skill Expert', desc: '...' }];
      expect(findFeat('Skill Expert (1st, 2nd, 3rd)', feats)).toEqual({ name: 'Skill Expert', desc: '...' });
    });

    it('strips a parenthetical containing only whitespace', () => {
      const feats = [{ name: 'Resilient', desc: '...' }];
      expect(findFeat('Resilient (  )', feats)).toEqual({ name: 'Resilient', desc: '...' });
    });

    it('strips empty parentheses', () => {
      const feats = [{ name: 'Feat Name', desc: '...' }];
      expect(findFeat('Feat Name ()', feats)).toEqual({ name: 'Feat Name', desc: '...' });
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
        { name: 'Sharpshooter', desc: '...' },
      ];
      expect(findFeat('Nonexistent Feat', feats)).toBeNull();
    });

    it('returns null when the search array is empty', () => {
      expect(findFeat('Great Weapon Master', [])).toBeNull();
    });

    it('returns null when stripped name still does not match any feat', () => {
      const feats = [{ name: 'Actor', desc: '...' }];
      expect(findFeat('Foo (Bar)', feats)).toBeFalsy();
    });

    it('returns null when featName is an empty string', () => {
      const feats = [{ name: 'Actor', desc: '...' }];
      expect(findFeat('', feats)).toBeNull();
    });

    it('returns null when featName has no parens and does not match any feat', () => {
      const feats = [{ name: 'Actor', desc: '...' }];
      expect(findFeat('Bard', feats)).toBeNull();
    });
  });
});
