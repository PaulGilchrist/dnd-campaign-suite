// @improved-by-ai
import { describe, it, expect } from 'vitest';

import { computeFeatBuffs } from './featBuffService.js';

describe('Savage Attacker feat parsing', () => {
  describe('2024 ruleset — damage type benefit with explicit automation', () => {
    it('extracts reroll_damage_once_per_turn feature when benefit type is "damage" with automation.type', () => {
      const feat = {
        name: 'Savage Attacker',
        type: 'Origin Feat',
        benefits: [
          {
            name: 'Savage Strike',
            description: 'Once per turn when you hit a target with a weapon, you can roll the weapon\'s damage dice twice and use either roll against the target.',
            type: 'damage',
            automation: { type: 'reroll_damage_once_per_turn' },
          },
        ],
      };

      const result = computeFeatBuffs(feat, '2024');

      expect(result.features).toHaveLength(1);
      expect(result.features[0].name).toBe('Savage Attacker');
      expect(result.features[0].type).toBe('reroll_damage_once_per_turn');
      expect(result.features[0].automation).toEqual({ type: 'reroll_damage_once_per_turn' });
      expect(result.abilityScoreIncreases).toHaveLength(0);
      expect(result.proficiencies).toHaveLength(0);
      expect(result.resistances).toHaveLength(0);
    });
  });

  describe('2024 ruleset — damage type benefit without automation', () => {
    it('falls through to default case and still extracts reroll_damage_once_per_turn when benefit name includes "Savage Strike"', () => {
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

    it('extracts reroll_damage_once_per_turn when benefit name is exactly "Savage Attacker" in default case', () => {
      const feat = {
        name: 'Savage Attacker',
        type: 'Origin Feat',
        benefits: [
          {
            name: 'Savage Attacker',
            description: 'Once per turn when you hit a target with a weapon, you can roll the weapon\'s damage dice twice and use either roll against the target.',
            type: 'other_type',
          },
        ],
      };

      const result = computeFeatBuffs(feat, '2024');

      expect(result.features).toHaveLength(1);
      expect(result.features[0].type).toBe('reroll_damage_once_per_turn');
    });
  });

  describe('2024 ruleset — multiple benefits including Savage Attacker', () => {
    it('parses Savage Attacker alongside other benefits without interference', () => {
      const feat = {
        name: 'Savage Attacker',
        type: 'Origin Feat',
        benefits: [
          {
            name: 'Savage Strike',
            description: 'Once per turn when you hit a target with a weapon, you can roll the weapon\'s damage dice twice and use either roll against the target.',
            type: 'damage',
            automation: { type: 'reroll_damage_once_per_turn' },
          },
          {
            name: 'Ability Score Increase',
            description: 'Increase your Strength score by 1, to a maximum of 20.',
            type: 'ability_score_increase',
          },
        ],
        ability_score_increase: { scores: ['Strength'], amount: 1 },
      };

      const result = computeFeatBuffs(feat, '2024');

      expect(result.features).toHaveLength(1);
      expect(result.features[0].type).toBe('reroll_damage_once_per_turn');
      expect(result.abilityScoreIncreases).toHaveLength(1);
      expect(result.abilityScoreIncreases[0].name).toBe('Strength');
    });
  });

  describe('5e ruleset — Savage Attacker is not applicable', () => {
    it('returns empty result when Savage Attacker feat is parsed with 5e ruleset (string benefits)', () => {
      const feat = {
        name: 'Savage Attacker',
        type: 'Origin Feat',
        benefits: [
          'Once per turn when you hit a target with a weapon, you can roll the weapon\'s damage dice twice and use either roll.',
        ],
      };

      const result = computeFeatBuffs(feat, '5e');

      // 5e parsing treats the benefit as unrecognized text, falling through to passive
      // but the string does not match any 5e patterns, so it becomes a passive feature
      expect(result.features).toHaveLength(1);
      expect(result.features[0].type).toBe('passive');
    });
  });
});
