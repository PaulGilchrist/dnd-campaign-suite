// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { injectSpecialActions } from './injectSpecialActions.js';

describe('injectSpecialActions', () => {
  describe('returns new features as structured entries', () => {
    it('returns an empty array when no features are provided', () => {
      const existingActions = new Set();
      const result = injectSpecialActions(existingActions, []);
      expect(result).toEqual([]);
    });

    it('filters out features already in existingActions', () => {
      const existingActions = new Set(['Darkvision', 'Fey Ancestry']);
      const features = [
        { name: 'Darkvision', description: 'Already known' },
        { name: 'Halfling Luck', description: 'New feature' },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Halfling Luck');
    });

    it('deduplicates features within the input list, keeping the first occurrence', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature 1', description: 'First' },
        { name: 'Feature 1', description: 'Duplicate' },
        { name: 'Feature 2', description: 'Second' },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Feature 1');
      expect(result[0].description).toBe('First');
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

  describe('entry structure', () => {
    it('creates entries with name, description, type, and source fields', () => {
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

    it('always sets source to feat regardless of input', () => {
      const existingActions = new Set();
      const features = [{ name: 'Feature', description: 'Desc' }];
      const result = injectSpecialActions(existingActions, features);
      expect(result[0].source).toBe('feat');
    });
  });

  describe('automation handling', () => {
    it('includes automation when the feature has it and includeAutomation is true (default)', () => {
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
      expect(result[0]).not.toHaveProperty('automation');
    });

    it('omits automation when the feature has no automation or a falsy automation value', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature', description: 'Desc' },
        { name: 'Feature2', description: 'Desc', automation: null },
        { name: 'Feature3', description: 'Desc', automation: '' },
        { name: 'Feature4', description: 'Desc', automation: 0 },
      ];
      const result = injectSpecialActions(existingActions, features, { includeAutomation: true });
      expect(result.every(r => !r.automation)).toBe(true);
    });
  });

  describe('existing actions tracking', () => {
    it('adds new feature names to the existingActions Set', () => {
      const existingActions = new Set(['Existing']);
      const features = [{ name: 'New', description: 'New' }];
      injectSpecialActions(existingActions, features);
      expect(existingActions).toContain('New');
    });

    it('accumulates new names across multiple calls', () => {
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
});
