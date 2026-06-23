// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';

vi.mock('../shared/buffApplier.js', () => ({
  resetFeatIncreases: vi.fn(),
}));

import { resetFeatIncreases } from '../shared/buffApplier.js';
import { clearAppliedFeatBuffs } from './featBuffService.js';

describe('clearAppliedFeatBuffs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should reset featIncrease on each ability by calling resetFeatIncreases with abilities array', () => {
    const abilities = [
      { name: 'Strength', featIncrease: 5 },
      { name: 'Dexterity', featIncrease: -2 },
      { name: 'Constitution', featIncrease: 3 },
    ];
    const formData = { abilities };

    clearAppliedFeatBuffs(formData);

    expect(resetFeatIncreases).toHaveBeenCalledTimes(1);
    expect(resetFeatIncreases).toHaveBeenCalledWith(abilities);
  });

  it('should pass undefined to resetFeatIncreases when formData has no abilities property', () => {
    const formData = {};

    clearAppliedFeatBuffs(formData);

    expect(resetFeatIncreases).toHaveBeenCalledWith(undefined);
  });

  it('should throw when formData is null', () => {
    expect(() => clearAppliedFeatBuffs(null)).toThrow(TypeError);
  });

  it('should not throw when abilities array is empty', () => {
    const formData = { abilities: [] };

    expect(() => clearAppliedFeatBuffs(formData)).not.toThrow();
    expect(resetFeatIncreases).toHaveBeenCalledWith([]);
  });

  it('should not modify other formData properties', () => {
    const formData = {
      abilities: [{ name: 'Strength', featIncrease: 5 }],
      name: 'Test Character',
      level: 5,
      class: 'Wizard',
    };

    clearAppliedFeatBuffs(formData);

    expect(formData.name).toBe('Test Character');
    expect(formData.level).toBe(5);
    expect(formData.class).toBe('Wizard');
  });

  it('should handle abilities without featIncrease property', () => {
    const formData = {
      abilities: [{ name: 'Strength' }],
    };

    clearAppliedFeatBuffs(formData);

    expect(resetFeatIncreases).toHaveBeenCalledWith(formData.abilities);
  });
});
