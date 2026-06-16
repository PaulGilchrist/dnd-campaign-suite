import { describe, it, expect } from 'vitest';
import { injectSpecialActions } from './injectSpecialActions.js';

describe('injectSpecialActions', () => {
  describe('basic functionality', () => {
    it('should return an empty array when no features provided', () => {
      const existingActions = new Set();
      const result = injectSpecialActions(existingActions, []);
      expect(result).toEqual([]);
      expect(existingActions.size).toBe(0);
    });

    it('should add new features to existing actions', () => {
      const existingActions = new Set(['Existing Feature']);
      const features = [
        { name: 'New Feature', description: 'A new feature' },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('New Feature');
      expect(existingActions.has('New Feature')).toBe(true);
    });

    it('should not add features that already exist', () => {
      const existingActions = new Set(['Existing Feature']);
      const features = [
        { name: 'Existing Feature', description: 'Duplicate' },
        { name: 'New Feature', description: 'A new feature' },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('New Feature');
    });

    it('should throw when existing actions is null (expects Set)', () => {
      const features = [
        { name: 'Feature 1', description: 'First' },
      ];
      expect(() => injectSpecialActions(null, features)).toThrow();
    });

    it('should throw when existing actions is undefined (expects Set)', () => {
      const features = [
        { name: 'Feature 1', description: 'First' },
      ];
      expect(() => injectSpecialActions(undefined, features)).toThrow();
    });
  });

  describe('feature entry structure', () => {
    it('should create entries with name, description, type, and source', () => {
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

    it('should default type to passive when not provided', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature', description: 'Desc' },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result[0].type).toBe('passive');
    });

    it('should use provided type when present', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature', description: 'Desc', type: 'action' },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result[0].type).toBe('action');
    });

    it('should always set source to feat', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature', description: 'Desc' },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result[0].source).toBe('feat');
    });
  });

  describe('automation handling', () => {
    it('should include automation when includeAutomation is true (default)', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature', description: 'Desc', automation: { type: 'damage', amount: 10 } },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result[0].automation).toEqual({ type: 'damage', amount: 10 });
    });

    it('should not include automation when includeAutomation is false', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature', description: 'Desc', automation: { type: 'damage', amount: 10 } },
      ];
      const result = injectSpecialActions(existingActions, features, { includeAutomation: false });
      expect(result[0].automation).toBeUndefined();
    });

    it('should not include automation when feature has no automation property', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature', description: 'Desc' },
      ];
      const result = injectSpecialActions(existingActions, features, { includeAutomation: true });
      expect(result[0].automation).toBeUndefined();
    });

    it('should not include automation when feature has null automation', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature', description: 'Desc', automation: null },
      ];
      const result = injectSpecialActions(existingActions, features, { includeAutomation: true });
      // null is falsy, so the if (f.automation) check skips it
      expect(result[0].automation).toBeUndefined();
    });
  });

  describe('multiple features', () => {
    it('should process all features and return all new ones', () => {
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

    it('should skip duplicates among the features list itself', () => {
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

    it('should add features in order they appear', () => {
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
    it('should add new feature names to the existing actions Set', () => {
      const existingActions = new Set(['Existing']);
      const features = [
        { name: 'New', description: 'New' },
      ];
      injectSpecialActions(existingActions, features);
      expect(existingActions.has('Existing')).toBe(true);
      expect(existingActions.has('New')).toBe(true);
    });

    it('should not add existing feature names again', () => {
      const existingActions = new Set(['Existing']);
      const features = [
        { name: 'Existing', description: 'Existing' },
      ];
      injectSpecialActions(existingActions, features);
      expect(existingActions.size).toBe(1);
    });

    it('should accumulate across multiple calls', () => {
      const existingActions = new Set();
      const f1 = [{ name: 'Feature 1', description: 'First' }];
      const f2 = [{ name: 'Feature 2', description: 'Second' }];
      injectSpecialActions(existingActions, f1);
      injectSpecialActions(existingActions, f2);
      expect(existingActions.size).toBe(2);
      expect(existingActions.has('Feature 1')).toBe(true);
      expect(existingActions.has('Feature 2')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle features with empty name', () => {
      const existingActions = new Set();
      const features = [
        { name: '', description: 'Empty name' },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('');
    });

    it('should handle features with empty description', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature', description: '' },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result[0].description).toBe('');
    });

    it('should handle features with undefined description', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature' },
      ];
      const result = injectSpecialActions(existingActions, features);
      expect(result[0].description).toBeUndefined();
    });

    it('should handle options as undefined (default to includeAutomation true)', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature', description: 'Desc', automation: { type: 'test' } },
      ];
      const result = injectSpecialActions(existingActions, features, undefined);
      expect(result[0].automation).toEqual({ type: 'test' });
    });

    it('should handle options as empty object (default to includeAutomation true)', () => {
      const existingActions = new Set();
      const features = [
        { name: 'Feature', description: 'Desc', automation: { type: 'test' } },
      ];
      const result = injectSpecialActions(existingActions, features, {});
      expect(result[0].automation).toEqual({ type: 'test' });
    });
  });
});
