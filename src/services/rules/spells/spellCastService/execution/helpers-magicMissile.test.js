import { describe, it, expect } from 'vitest';

/* ------------------------------------------------------------------ */
/*  SUT imports                                                        */
/* ------------------------------------------------------------------ */

import { isMagicMissile, getMagicMissileCount } from './helpers.js';

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('helpers.js — isMagicMissile', () => {
  it('returns true for Magic Missile', () => {
    expect(isMagicMissile({ name: 'Magic Missile' })).toBe(true);
  });

  it('returns false for other spells', () => {
    expect(isMagicMissile({ name: 'Fireball' })).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isMagicMissile({ name: 'magic missile' })).toBe(true);
    expect(isMagicMissile({ name: 'MAGIC MISSILE' })).toBe(true);
  });

  it('handles null/undefined name gracefully', () => {
    expect(isMagicMissile({})).toBeFalsy();
    expect(() => isMagicMissile(null)).toThrow();
  });
});

describe('helpers.js — getMagicMissileCount', () => {
  it('returns 3 for level 1', () => {
    expect(getMagicMissileCount(1)).toBe(3);
  });

  it('returns 4 for level 2', () => {
    expect(getMagicMissileCount(2)).toBe(4);
  });

  it('returns 5 for level 3', () => {
    expect(getMagicMissileCount(3)).toBe(5);
  });

  it('returns 6 for level 4', () => {
    expect(getMagicMissileCount(4)).toBe(6);
  });

  it('returns 10 for level 8', () => {
    expect(getMagicMissileCount(8)).toBe(10);
  });
});
