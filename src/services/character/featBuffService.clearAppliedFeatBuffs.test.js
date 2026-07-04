// @cleaned-by-ai
import { describe, it, expect } from 'vitest';

import { clearAppliedFeatBuffs } from './featBuffService.js';

describe('clearAppliedFeatBuffs', () => {
  it('should reset featIncrease on each ability to 0', () => {
    const abilities = [
      { name: 'Strength', featIncrease: 5 },
      { name: 'Dexterity', featIncrease: -2 },
      { name: 'Constitution', featIncrease: 3 },
    ];
    const formData = { abilities };

    clearAppliedFeatBuffs(formData);

    expect(formData.abilities[0].featIncrease).toBe(0);
    expect(formData.abilities[1].featIncrease).toBe(0);
    expect(formData.abilities[2].featIncrease).toBe(0);
  });

  it('should handle undefined formData.abilities gracefully', () => {
    const formData = {};

    expect(() => clearAppliedFeatBuffs(formData)).not.toThrow();
  });

  it('should throw when formData is null', () => {
    expect(() => clearAppliedFeatBuffs(null)).toThrow(TypeError);
  });

  it('should not modify other formData properties', () => {
    const formData = {
      abilities: [{ name: 'Strength', featIncrease: 5 }],
      name: 'Test Character',
      level: 5,
      class: 'Wizard',
    };

    clearAppliedFeatBuffs(formData);

    expect(formData.abilities[0].featIncrease).toBe(0);
    expect(formData.name).toBe('Test Character');
    expect(formData.level).toBe(5);
    expect(formData.class).toBe('Wizard');
  });

});
