import { describe, it, expect } from 'vitest';

import { clearAppliedFeatBuffs } from './featBuffService.js';

describe('clearAppliedFeatBuffs', () => {
  it('resets featIncrease to 0 on every ability', () => {
    const formData = {
      abilities: [
        { name: 'Strength', featIncrease: 5 },
        { name: 'Dexterity', featIncrease: -2 },
        { name: 'Constitution', featIncrease: 3 },
      ],
    };

    clearAppliedFeatBuffs(formData);

    expect(formData.abilities.every(a => a.featIncrease === 0)).toBe(true);
  });

  it('does not throw when abilities is missing or empty', () => {
    expect(() => clearAppliedFeatBuffs({})).not.toThrow();
    expect(() => clearAppliedFeatBuffs({ abilities: [] })).not.toThrow();
  });
});
