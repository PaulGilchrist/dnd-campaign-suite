import { describe, it, expect, vi } from 'vitest';

vi.mock('../shared/featFinder.js', () => ({
  findFeat: vi.fn(),
}));

vi.mock('../shared/buffApplier.js', () => ({
  resetFeatIncreases: vi.fn(),
  applyAbilityScoreIncreases: vi.fn(),
  mergeDeduplicated: vi.fn(),
}));

import { resetFeatIncreases } from '../shared/buffApplier.js';
import { clearAppliedFeatBuffs } from './featBuffService.js';

describe('clearAppliedFeatBuffs', () => {
  it('should call resetFeatIncreases with formData.abilities', () => {
    const formData = {
      abilities: [{ name: 'Strength', featIncrease: 5 }],
    };

    clearAppliedFeatBuffs(formData);

    expect(resetFeatIncreases).toHaveBeenCalledWith(formData.abilities);
  });

  it('should handle formData with no abilities property', () => {
    const formData = {};

    clearAppliedFeatBuffs(formData);

    expect(resetFeatIncreases).toHaveBeenCalledWith(undefined);
  });

  it('should throw when formData is null', () => {
    expect(() => clearAppliedFeatBuffs(null)).toThrow();
  });

  it('should call resetFeatIncreases with all abilities', () => {
    const formData = {
      abilities: [
        { name: 'Strength', featIncrease: 5 },
        { name: 'Dexterity', featIncrease: -2 },
        { name: 'Constitution', featIncrease: 3 },
      ],
    };

    clearAppliedFeatBuffs(formData);

    expect(resetFeatIncreases).toHaveBeenCalledWith(formData.abilities);
  });

  it('should not modify other properties on formData', () => {
    const formData = {
      abilities: [{ name: 'Strength', featIncrease: 5 }],
      name: 'Test Character',
      level: 5,
    };

    clearAppliedFeatBuffs(formData);

    expect(formData.name).toBe('Test Character');
    expect(formData.level).toBe(5);
  });

  it('should call resetFeatIncreases with abilities that have no featIncrease property', () => {
    const formData = {
      abilities: [{ name: 'Strength' }],
    };

    clearAppliedFeatBuffs(formData);

    expect(resetFeatIncreases).toHaveBeenCalledWith(formData.abilities);
  });
});
