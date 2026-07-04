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

    it('filters out features already in existingActions and deduplicates within the input list', () => {
      const existingActions = new Set(['Darkvision']);
      const features = [
        { name: 'Darkvision', description: 'Already known' },
        { name: 'Halfling Luck', description: 'New feature' },
        { name: 'Halfling Luck', description: 'Duplicate in input' },
        { name: 'Feature 1', description: 'First' },
        { name: 'Feature 1', description: 'Duplicate in input' },
        { name: 'Feature 2', description: 'Second' },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result).toHaveLength(3);
      expect(result.map(r => r.name)).toEqual(['Halfling Luck', 'Feature 1', 'Feature 2']);
      expect(result[0].description).toBe('New feature');
      expect(result[1].description).toBe('First');
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
  });

  describe('existing actions tracking', () => {
    it('adds new feature names to the existingActions Set and accumulates across calls', () => {
      const existingActions = new Set(['Existing']);
      const f1 = [{ name: 'Feature 1', description: 'First' }];
      const f2 = [{ name: 'Feature 2', description: 'Second' }];

      injectSpecialActions(existingActions, f1);
      expect(existingActions).toContain('Feature 1');

      injectSpecialActions(existingActions, f2);
      expect(existingActions.size).toBe(3);
      expect(existingActions).toContain('Feature 2');
    });
  });
});
