// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getClassFeatures } from './classFeatures.js';
import classRules5e from './classRules.js';
import classRules2024 from './classRules2024.js';

// Mock classRules with realistic return shapes matching the actual implementation
vi.mock('./classRules.js', () => ({
  default: {
    getBardFeatures: vi.fn(),
    getClericFeatures: vi.fn(),
    getDruidFeatures: vi.fn(),
    getPaladinFeatures: vi.fn(),
    getSorcererFeatures: vi.fn(),
    getWarlockFeatures: vi.fn(),
    getWizardFeatures: vi.fn(),
    getMonkFeatures: vi.fn(),
    getRogueFeatures: vi.fn(),
    getRangerFeatures: vi.fn(),
  },
}));

// Mock classRules2024 with realistic return shapes matching the actual implementation
vi.mock('./classRules2024.js', () => ({
  default: {
    getBardFeatures: vi.fn(),
    getClericFeatures: vi.fn(),
    getDruidFeatures: vi.fn(),
    getPaladinFeatures: vi.fn(),
    getSorcererFeatures: vi.fn(),
    getWarlockFeatures: vi.fn(),
    getWizardFeatures: vi.fn(),
    getMonkFeatures: vi.fn(),
    getRogueFeatures: vi.fn(),
    getRangerFeatures: vi.fn(),
  },
}));

const all5eClasses = [
  'Bard', 'Cleric', 'Druid', 'Paladin', 'Sorcerer',
  'Warlock', 'Wizard', 'Monk', 'Rogue', 'Ranger',
];

const all2024Classes = [
  'Bard', 'Cleric', 'Druid', 'Paladin', 'Sorcerer',
  'Warlock', 'Wizard', 'Monk', 'Rogue', 'Ranger',
];

const basePlayerStats = {
  name: 'Test Character',
  rules: '5e',
  class: { name: 'Cleric' },
};

describe('getClassFeatures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('null/undefined handling', () => {
    it('returns null for unknown class name', () => {
      const stats = { ...basePlayerStats, class: { name: 'Barbarian' } };
      expect(getClassFeatures(stats)).toBeNull();
    });

    it('returns null when class is undefined', () => {
      const stats = { ...basePlayerStats, class: undefined };
      expect(getClassFeatures(stats)).toBeNull();
    });

    it('returns null when class.name is undefined', () => {
      const stats = { ...basePlayerStats, class: {} };
      expect(getClassFeatures(stats)).toBeNull();
    });

    it('returns null when class.name is empty string', () => {
      const stats = { ...basePlayerStats, class: { name: '' } };
      expect(getClassFeatures(stats)).toBeNull();
    });
  });

  describe('delegates to correct rules module', () => {
    it('delegates to classRules for 5e ruleset (default)', () => {
      const stats = { ...basePlayerStats };
      const result = getClassFeatures(stats);
      expect(result).toBeUndefined();
      expect(classRules5e.getClericFeatures).toHaveBeenCalled();
    });

    it('delegates to classRules2024 for 2024 ruleset', () => {
      const stats = { ...basePlayerStats, rules: '2024' };
      const result = getClassFeatures(stats);
      expect(result).toBeUndefined();
      expect(classRules2024.getClericFeatures).toHaveBeenCalled();
    });

    it('uses classRules for explicit "5e" ruleset', () => {
      const stats = { ...basePlayerStats, rules: '5e' };
      getClassFeatures(stats);
      expect(classRules5e.getClericFeatures).toHaveBeenCalled();
      expect(classRules2024.getClericFeatures).not.toHaveBeenCalled();
    });

    it('uses classRules when rules is undefined (defaults to 5e)', () => {
      const stats = { ...basePlayerStats, rules: undefined };
      getClassFeatures(stats);
      expect(classRules5e.getClericFeatures).toHaveBeenCalled();
      expect(classRules2024.getClericFeatures).not.toHaveBeenCalled();
    });

    it('uses classRules when rules is an unexpected value', () => {
      const stats = { ...basePlayerStats, rules: '3e' };
      getClassFeatures(stats);
      expect(classRules5e.getClericFeatures).toHaveBeenCalled();
    });
  });

  describe('passes playerStats to feature functions', () => {
    const testCases = [
      { rules: '5e', rulesModule: classRules5e, className: 'Cleric' },
      { rules: '2024', rulesModule: classRules2024, className: 'Bard' },
    ];

    for (const tc of testCases) {
      it(`passes stats object to ${tc.className} function (${tc.rules})`, () => {
        const stats = { ...basePlayerStats, rules: tc.rules, class: { name: tc.className } };
        getClassFeatures(stats);
        const fn = tc.rulesModule[`get${tc.className}Features`];
        expect(fn).toHaveBeenCalledWith(stats);
      });
    }
  });

  describe('5e class delegation', () => {
    for (const className of all5eClasses) {
      it(`delegates to classRules.get${className}Features for ${className}`, () => {
        const stats = { ...basePlayerStats, class: { name: className } };
        getClassFeatures(stats);
        expect(classRules5e[`get${className}Features`]).toHaveBeenCalledWith(stats);
      });
    }

    it('returns undefined when feature function returns nothing', () => {
      classRules5e.getClericFeatures.mockReturnValue(undefined);
      const stats = { ...basePlayerStats, class: { name: 'Cleric' } };
      expect(getClassFeatures(stats)).toBeUndefined();
    });

    it('returns null when feature function returns null', () => {
      classRules5e.getClericFeatures.mockReturnValue(null);
      const stats = { ...basePlayerStats, class: { name: 'Cleric' } };
      expect(getClassFeatures(stats)).toBeNull();
    });

    it('returns the feature function result object as-is', () => {
      const expected = { channelDivinity: 3, destroyUndeadCR: 7 };
      classRules5e.getClericFeatures.mockReturnValue(expected);
      const stats = { ...basePlayerStats, class: { name: 'Cleric' } };
      expect(getClassFeatures(stats)).toBe(expected);
    });
  });

  describe('2024 class delegation', () => {
    for (const className of all2024Classes) {
      it(`delegates to classRules2024.get${className}Features for ${className}`, () => {
        const stats = { ...basePlayerStats, rules: '2024', class: { name: className } };
        getClassFeatures(stats);
        expect(classRules2024[`get${className}Features`]).toHaveBeenCalledWith(stats);
      });
    }

    it('returns undefined when feature function returns nothing', () => {
      classRules2024.getClericFeatures.mockReturnValue(undefined);
      const stats = { ...basePlayerStats, rules: '2024', class: { name: 'Cleric' } };
      expect(getClassFeatures(stats)).toBeUndefined();
    });

    it('returns the feature function result object as-is', () => {
      const expected = { maxChannelDivinity: 2, destroyUndeadCR: null };
      classRules2024.getClericFeatures.mockReturnValue(expected);
      const stats = { ...basePlayerStats, rules: '2024', class: { name: 'Cleric' } };
      expect(getClassFeatures(stats)).toBe(expected);
    });
  });

  describe('feature function type validation', () => {
    it('returns undefined (fallthrough) when feature function is not a function (5e)', () => {
      classRules5e.getClericFeatures = 'not a function';
      const stats = { ...basePlayerStats, class: { name: 'Cleric' } };
      expect(getClassFeatures(stats)).toBeUndefined();
    });

    it('returns undefined (fallthrough) when feature function is not a function (2024)', () => {
      classRules2024.getClericFeatures = 'not a function';
      const stats = { ...basePlayerStats, rules: '2024', class: { name: 'Cleric' } };
      expect(getClassFeatures(stats)).toBeUndefined();
    });

    it('returns undefined (fallthrough) when feature function is undefined (5e)', () => {
      classRules5e.getClericFeatures = undefined;
      const stats = { ...basePlayerStats, class: { name: 'Cleric' } };
      expect(getClassFeatures(stats)).toBeUndefined();
    });

    it('returns undefined (fallthrough) when feature function is undefined (2024)', () => {
      classRules2024.getClericFeatures = undefined;
      const stats = { ...basePlayerStats, rules: '2024', class: { name: 'Cleric' } };
      expect(getClassFeatures(stats)).toBeUndefined();
    });
  });

  describe('behavioral correctness', () => {
    it('does not throw for any valid class name in both rulesets', () => {
      for (const className of all5eClasses) {
        const stats = { ...basePlayerStats, class: { name: className } };
        expect(() => getClassFeatures(stats)).not.toThrow();
      }
      for (const className of all2024Classes) {
        const stats = { ...basePlayerStats, rules: '2024', class: { name: className } };
        expect(() => getClassFeatures(stats)).not.toThrow();
      }
    });

    it('returns different results for same class across rulesets when implementations differ', () => {
      classRules5e.getMonkFeatures.mockReturnValue({ martialArtsDie: 4 });
      classRules2024.getMonkFeatures.mockReturnValue({ martialArtsDie: 6 });

      const stats5e = { ...basePlayerStats, class: { name: 'Monk' } };
      const stats2024 = { ...basePlayerStats, rules: '2024', class: { name: 'Monk' } };

      expect(getClassFeatures(stats5e)).toEqual({ martialArtsDie: 4 });
      expect(getClassFeatures(stats2024)).toEqual({ martialArtsDie: 6 });
    });

    it('calls only the relevant rules module for a given class', () => {
      const stats = { ...basePlayerStats, class: { name: 'Monk' } };
      getClassFeatures(stats);
      expect(classRules5e.getMonkFeatures).toHaveBeenCalled();
    });
  });
});
