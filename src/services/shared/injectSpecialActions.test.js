// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { injectSpecialActions } from './injectSpecialActions.js';

describe('injectSpecialActions', () => {
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
  });

  it('creates entries with name, description, type, and source fields', () => {
    const existingActions = new Set();
    const features = [
      { name: 'Darkvision', description: 'Can see in the dark' },
      { name: 'Action Feature', description: 'D', type: 'action' },
    ];
    const result = injectSpecialActions(existingActions, features);
    expect(result[0]).toEqual({
      name: 'Darkvision',
      description: 'Can see in the dark',
      type: 'passive',
      source: 'feat',
    });
    expect(result[1]).toEqual({
      name: 'Action Feature',
      description: 'D',
      type: 'action',
      source: 'feat',
    });
  });

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
