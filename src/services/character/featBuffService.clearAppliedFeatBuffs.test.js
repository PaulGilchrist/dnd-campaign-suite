import { describe, it, expect, vi } from 'vitest';

vi.mock('../shared/featFinder.js', () => ({
  findFeat: vi.fn(),
}));

vi.mock('../shared/buffApplier.js', () => ({
  resetMiscBonuses: vi.fn(),
  applyAbilityScoreIncreases: vi.fn(),
  mergeDeduplicated: vi.fn(),
}));

import { resetMiscBonuses } from '../shared/buffApplier.js';
import { clearAppliedFeatBuffs } from './featBuffService.js';

describe('clearAppliedFeatBuffs', () => {
  it('should call resetMiscBonuses with formData.abilities', () => {
    const formData = {
      abilities: [{ name: 'Strength', miscBonus: 5 }],
    };

    clearAppliedFeatBuffs(formData);

    expect(resetMiscBonuses).toHaveBeenCalledWith(formData.abilities);
  });

  it('should handle formData with no abilities property', () => {
    const formData = {};

    clearAppliedFeatBuffs(formData);

    expect(resetMiscBonuses).toHaveBeenCalledWith(undefined);
  });

  it('should throw when formData is null', () => {
    expect(() => clearAppliedFeatBuffs(null)).toThrow();
  });

  it('should call resetMiscBonuses with all abilities', () => {
    const formData = {
      abilities: [
        { name: 'Strength', miscBonus: 5 },
        { name: 'Dexterity', miscBonus: -2 },
        { name: 'Constitution', miscBonus: 3 },
      ],
    };

    clearAppliedFeatBuffs(formData);

    expect(resetMiscBonuses).toHaveBeenCalledWith(formData.abilities);
  });

  it('should not modify other properties on formData', () => {
    const formData = {
      abilities: [{ name: 'Strength', miscBonus: 5 }],
      name: 'Test Character',
      level: 5,
    };

    clearAppliedFeatBuffs(formData);

    expect(formData.name).toBe('Test Character');
    expect(formData.level).toBe(5);
  });

  it('should call resetMiscBonuses with abilities that have no miscBonus property', () => {
    const formData = {
      abilities: [{ name: 'Strength' }],
    };

    clearAppliedFeatBuffs(formData);

    expect(resetMiscBonuses).toHaveBeenCalledWith(formData.abilities);
  });
});
