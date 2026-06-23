// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { injectSpecialActions } from './injectSpecialActions.js';

describe('injectSpecialActions', () => {
  describe('basic functionality', () => {
    it('returns an empty array when no features are provided', () => {
      const existingActions = new Set();
      const result = injectSpecialActions(existingActions, []);
      expect(result).toEqual([]);
      expect(existingActions.size).toBe(0);
    });

    it('returns only new features not already in existingActions', () => {
      const existingActions = new Set(['Darkvision', 'Fey Ancestry']);
      const features = [
        { name: 'Darkvision', description: 'Already known' },
        { name: 'Halfling Luck', description: 'New feature' },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Halfling Luck');
    });

    it('throws when existingActions does not support .has()', () => {
      const features = [{ name: 'Feature 1', description: 'First' }];
      expect(() => injectSpecialActions(null, features)).toThrow();
      expect(() => injectSpecialActions(undefined, features)).toThrow();
      expect(() => injectSpecialActions('not a set', features)).toThrow();
    });
  });

  describe('entry structure', () => {
    it('creates entries with name, description, type, and source', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Darkvision', description: 'Can see in the dark' },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result[0]).toEqual({
        name: 'Darkvision',
        description: 'Can see in the dark',
        type: 'passive',
        source: 'feat',
      });
    });

    it('uses the feature type when provided, defaulting to passive', () => {
      const withType = [{ name: 'Action Feature', description: 'D', type: 'action' }];
      const withoutType = [{ name: 'Passive Feature', description: 'D' }];

      const result1 = injectSpecialActions(new Set(), withType);
      const result2 = injectSpecialActions(new Set(), withoutType);

      expect(result1[0].type).toBe('action');
      expect(result2[0].type).toBe('passive');
    });

    it('always sets source to feat', () => {
      const existingActions = new Set();
      const features = [{ name: 'Feature', description: 'Desc' }];
      const result = injectSpecialActions(existingActions, features);
      expect(result[0].source).toBe('feat');
    });
  });

  describe('automation handling', () => {
    it('includes automation when includeAutomation is true (default)', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature', description: 'Desc', automation: { type: 'damage', amount: 10 } },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result[0].automation).toEqual({ type: 'damage', amount: 10 });
    });

    it('excludes automation when includeAutomation is false', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature', description: 'Desc', automation: { type: 'damage', amount: 10 } },
      ];
      const result = injectSpecialActions(existingActions, features, { includeAutomation: false });
      expect(result[0].automation).toBeUndefined();
    });

    it('omits automation when the feature has no automation, even if includeAutomation is true', () => {
      const existingActions = new Set();
      const features = [{ name: 'Feature', description: 'Desc' }];
      const result = injectSpecialActions(existingActions, features, { includeAutomation: true });
      expect(result[0].automation).toBeUndefined();
    });

    it('omits automation when the feature has null or empty automation', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature', description: 'Desc', automation: null },
        { name: 'Feature2', description: 'Desc', automation: '' },
        { name: 'Feature3', description: 'Desc', automation: 0 },
      ];
      const result = injectSpecialActions(existingActions, features, { includeAutomation: true });
      expect(result.every(r => r.automation === undefined)).toBe(true);
    });

    it('honors default includeAutomation when options is undefined or empty', () => {
      const features = [{ name: 'Feature', description: 'Desc', automation: { type: 'test' } }];

      const result1 = injectSpecialActions(new Set(), features, undefined);
      const result2 = injectSpecialActions(new Set(), features, {});

      expect(result1[0].automation).toEqual({ type: 'test' });
      expect(result2[0].automation).toEqual({ type: 'test' });
    });
  });

  describe('multiple features', () => {
    it('processes all features and returns all new ones', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature 1', description: 'First' },
        { name: 'Feature 2', description: 'Second' },
        { name: 'Feature 3', description: 'Third' },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result).toHaveLength(3);
      expect(result.map(r => r.name)).toEqual(['Feature 1', 'Feature 2', 'Feature 3']);
    });

    it('skips duplicates within the features list itself', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature 1', description: 'First' },
        { name: 'Feature 1', description: 'Duplicate' },
        { name: 'Feature 2', description: 'Second' },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Feature 1');
    });

    it('preserves the original order of features', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Zebra', description: 'Last alphabetically' },
        { name: 'Alpha', description: 'First alphabetically' },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result[0].name).toBe('Zebra');
      expect(result[1].name).toBe('Alpha');
    });
  });

  describe('existing actions tracking', () => {
    it('adds new feature names to the existingActions Set', () => {
      const existingActions = new Set(['Existing']);
      const features = [{ name: 'New', description: 'New' }];
      injectSpecialActions(existingActions, features);
      expect(existingActions).toContain('Existing');
      expect(existingActions).toContain('New');
    });

    it('does not re-add names that are already in existingActions', () => {
      const existingActions = new Set(['Existing']);
      const features = [{ name: 'Existing', description: 'Existing' }];
      injectSpecialActions(existingActions, features);
      expect(existingActions.size).toBe(1);
    });

    it('accumulates across multiple calls', () => {
      const existingActions = new Set();
      const f1 = [{ name: 'Feature 1', description: 'First' }];
      const f2 = [{ name: 'Feature 2', description: 'Second' }];
      injectSpecialActions(existingActions, f1);
      injectSpecialActions(existingActions, f2);
      expect(existingActions.size).toBe(2);
      expect(existingActions).toContain('Feature 1');
      expect(existingActions).toContain('Feature 2');
    });
  });

  describe('edge cases', () => {
    it('passes through empty name and description without error', () => {
      const existingActions = new Set();
      const features = [{ name: '', description: '' }];
      const result = injectSpecialActions(existingActions, features);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('');
      expect(result[0].description).toBe('');
    });

    it('passes through undefined description without error', () => {
      const existingActions = new Set();
      const features = [{ name: 'Feature' }];
      const result = injectSpecialActions(existingActions, features);
      expect(result[0].description).toBeUndefined();
    });

    it('ignores unexpected options properties', () => {
      const existingActions = new Set();
      const features = [{ name: 'Feature', description: 'Desc' }];
      const result = injectSpecialActions(existingActions, features, {
        includeAutomation: true,
        unknownProperty: 'should be ignored',
      });
      expect(result[0].name).toBe('Feature');
    });
  });
});
