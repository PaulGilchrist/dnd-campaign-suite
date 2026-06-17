import { describe, it, expect, vi } from 'vitest';

vi.mock('../shared/featFinder.js', () => ({
  findFeat: vi.fn(),
}));

vi.mock('../shared/buffApplier.js', () => ({
  resetMiscBonuses: vi.fn(),
  applyAbilityScoreIncreases: vi.fn(),
  mergeDeduplicated: vi.fn(),
}));

import { computeFeatBuffs } from './featBuffService.js';

describe('Savage Attacker feat parsing', () => {
  it('should parse 2024 Savage Attacker with damage benefit type and reroll automation', () => {
    const feat = {
      name: 'Savage Attacker',
      type: 'Origin Feat',
      benefits: [
        {
          name: 'Savage Strike',
          description: 'Once per turn when you hit a target with a weapon, you can roll the weapon\'s damage dice twice and use either roll against the target.',
          type: 'damage',
          automation: {
            type: 'reroll_damage_once_per_turn',
          },
        },
      ],
    };

    const result = computeFeatBuffs(feat, '2024');

    expect(result.features).toHaveLength(1);
    expect(result.features[0].name).toBe('Savage Attacker');
    expect(result.features[0].type).toBe('reroll_damage_once_per_turn');
    expect(result.features[0].automation).toEqual({ type: 'reroll_damage_once_per_turn' });
  });

  it('should parse 2024 Savage Attacker with Savage Strike benefit name', () => {
    const feat = {
      name: 'Savage Attacker',
      type: 'Origin Feat',
      benefits: [
        {
          name: 'Savage Strike',
          description: 'Once per turn when you hit a target with a weapon, you can roll the weapon\'s damage dice twice and use either roll against the target.',
          type: 'other_type',
        },
      ],
    };

    const result = computeFeatBuffs(feat, '2024');

    expect(result.features).toHaveLength(1);
    expect(result.features[0].name).toBe('Savage Attacker');
    expect(result.features[0].type).toBe('reroll_damage_once_per_turn');
  });
});
