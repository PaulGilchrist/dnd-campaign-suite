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

  it('includes automation by default and excludes it when includeAutomation is false', () => {
    const features = [
      { name: 'Feature', description: 'Desc', automation: { type: 'damage', amount: 10 } },
    ];

    const resultWithAutomation = injectSpecialActions(new Set(), features);
    expect(resultWithAutomation[0].automation).toEqual({ type: 'damage', amount: 10 });

    const resultWithoutAutomation = injectSpecialActions(new Set(), features, { includeAutomation: false });
    expect(resultWithoutAutomation[0]).not.toHaveProperty('automation');
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
