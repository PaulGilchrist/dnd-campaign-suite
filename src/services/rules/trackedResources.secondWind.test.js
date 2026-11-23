// @maintained-by-ai
// Regression pin for bug-5e-fighter-extra-attacks-second-wind-zeroed: the
// Second Wind max resolver (computeSecondWindMax) and its seed site
// (computeTrackedResources.addMartialResources). The 2024 table carries a
// top-level second_wind column; the 5e table carries NONE, so the 5e lane
// must derive from its own canon (classes.json Fighter lv1 'Second Wind' —
// one use, recharged by a short or long rest). Before the fix both the sheet
// row and the tracked-resource seed read classLevel.second_wind unconditionally,
// zeroing every 5e Fighter's pool (0/0, silently unusable).

import { describe, it, expect, vi, beforeEach } from 'vitest';

import classes2024 from '../../../public/data/2024/classes.json';
import classes5e from '../../../public/data/classes.json';

vi.mock('../character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({})),
}));

import { computeSecondWindMax, computeTrackedResources } from './trackedResources.js';

function fighter(level, rules, classLevels) {
  return {
    name: 'Test Fighter',
    level,
    rules,
    class: { name: 'Fighter', major: {}, subclass: {}, class_levels: classLevels || [] },
  };
}

describe('computeSecondWindMax', () => {
  beforeEach(() => vi.clearAllMocks());

  it('5e Fighter is never 0 at any level (the bug: 0/0 dead row)', () => {
    for (let level = 1; level <= 20; level++) {
      expect(computeSecondWindMax(fighter(level, '5e', []))).toBe(1);
    }
  });

  it('5e derivation ignores the 2024-only top-level column (one use is the 5e canon)', () => {
    const rows = [{ level: 5, second_wind: 9 }];
    expect(computeSecondWindMax(fighter(5, '5e', rows))).toBe(1);
  });

  it('2024 reads the disk table verbatim (2024 is the ruleset with the multi-use ladder)', () => {
    const table = classes2024.find(c => c.name === 'Fighter').class_levels;
    for (const row of table) {
      expect(computeSecondWindMax(fighter(row.level, '2024', table))).toBe(row.second_wind);
    }
  });

  it('2024 without a matching row falls back to 0', () => {
    expect(computeSecondWindMax(fighter(5, '2024', []))).toBe(0);
  });

  it('non-Fighters own no Second Wind under either ruleset', () => {
    const monk = { ...fighter(5, '5e', []), class: { name: 'Monk', class_levels: [] } };
    expect(computeSecondWindMax(monk)).toBe(0);
    expect(computeSecondWindMax(undefined)).toBe(0);
    expect(computeSecondWindMax({ level: 5 })).toBe(0);
  });
});

describe('computeTrackedResources — secondWindUses seed', () => {
  beforeEach(() => vi.clearAllMocks());

  it('seeds the 5e Fighter pool to 1 from the real 5e disk table (was absent)', () => {
    const table = classes5e.find(c => c.name === 'Fighter').class_levels;
    const bucket = computeTrackedResources(fighter(18, '5e', table));
    expect(bucket.secondWindUses).toEqual({ current: 1, max: 1 });
  });

  it('2024 Fighter seed stays byte-identical (disk column, level 18 = 4)', () => {
    const table = classes2024.find(c => c.name === 'Fighter').class_levels;
    const bucket = computeTrackedResources(fighter(18, '2024', table));
    expect(bucket.secondWindUses).toEqual({ current: 4, max: 4 });
  });

  it('non-Fighters seed no secondWindUses key under either ruleset', () => {
    for (const rules of ['5e', '2024']) {
      const bucket = computeTrackedResources({
        ...fighter(5, rules, []),
        class: { name: 'Ranger', class_levels: [] },
      });
      expect(bucket).not.toHaveProperty('secondWindUses');
    }
  });
});
