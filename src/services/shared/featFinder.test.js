// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';
import { findFeat } from './featFinder.js';

describe('findFeat', () => {
  it('returns the feat when search name matches exactly', () => {
    const feats = [{ name: 'Great Weapon Master', desc: '...' }];
    expect(findFeat('Great Weapon Master', feats)).toEqual({ name: 'Great Weapon Master', desc: '...' });
  });

  it('prefers exact match over parenthetical-stripped match when both exist', () => {
    const feats = [
      { name: 'Actor', desc: 'base' },
      { name: 'Actor (Extra)', desc: 'extra' },
    ];
    expect(findFeat('Actor (Extra)', feats)).toEqual({ name: 'Actor (Extra)', desc: 'extra' });
  });

  it('strips parenthetical suffix to find a match when no exact match exists', () => {
    const feats = [
      { name: 'Actor', desc: 'base' },
      { name: 'Great Weapon Master', desc: '...' },
    ];
    expect(findFeat('Actor (Extra)', feats)).toEqual({ name: 'Actor', desc: 'base' });
  });

  it('strips parentheses with no space before the opening paren', () => {
    const feats = [{ name: 'Actor', desc: 'base' }];
    expect(findFeat('Actor(Extra)', feats)).toEqual({ name: 'Actor', desc: 'base' });
  });

  it('returns falsy when stripped name does not match any feat', () => {
    const feats = [{ name: 'Actor', desc: 'base' }];
    expect(findFeat('Nonexistent (Extra)', feats)).toBeFalsy();
  });

  it('returns falsy when feat name has no parentheses and no exact match', () => {
    const feats = [{ name: 'Actor', desc: 'base' }];
    expect(findFeat('Nonexistent', feats)).toBeFalsy();
  });

  it('returns falsy when allFeats is an empty array', () => {
    expect(findFeat('Actor', [])).toBeFalsy();
  });

  it('logs nothing to console when a feat is found (epic boon regression)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const feats = [
      { name: 'Ability Score Improvement', desc: '...' },
      { name: 'Boon Of Fortitude', desc: '...' },
    ];
    expect(findFeat('Boon Of Fortitude', feats)).toEqual({ name: 'Boon Of Fortitude', desc: '...' });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('still logs NOT FOUND for genuine misses', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(findFeat('Nonexistent', [{ name: 'Actor', desc: '...' }])).toBeFalsy();
    expect(spy).toHaveBeenCalledWith('[findFeat] NOT FOUND:', 'Nonexistent', 'allFeats sample:', ['Actor']);
    spy.mockRestore();
  });
});
