// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { findFeat } from '../../services/shared/featFinder.js';
import {
  computeAllFeatBuffs,
} from './featBuffService.js';

vi.mock('../../services/shared/featFinder.js', () => ({
  findFeat: vi.fn(),
}));

vi.mock('../../services/shared/buffApplier.js', () => ({
  applyAbilityScoreIncreases: vi.fn(),
  mergeDeduplicated: vi.fn(),
  resetMiscBonuses: vi.fn(),
}));



describe('computeAllFeatBuffs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('edge cases and error handling', () => {
    it('should return empty result when formData is null', () => {
      expect(() => computeAllFeatBuffs(null, [])).toThrow();
    });

    it('should return empty result when formData has no rules field', () => {
      const result = computeAllFeatBuffs({}, []);

      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.proficiencies).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.features).toEqual([]);
    });

    it('should return empty result when feats array is empty', () => {
      const result = computeAllFeatBuffs({ rules: '5e', feats: [] }, []);

      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.proficiencies).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.features).toEqual([]);
    });

    it('should return empty result when feats array is undefined', () => {
      const result = computeAllFeatBuffs({ rules: '5e' }, []);

      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.proficiencies).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.features).toEqual([]);
    });

    it('should return empty result when allFeats is null', () => {
      findFeat.mockReturnValue(null);

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Tough'] },
        null
      );

      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.proficiencies).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.features).toEqual([]);
    });

    it('should return empty result when findFeat returns null for all selected feats', () => {
      findFeat.mockReturnValue(null);

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Nonexistent1', 'Nonexistent2'] },
        [{ name: 'SomeFeat' }]
      );

      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.proficiencies).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.features).toEqual([]);
    });
  });

  describe('5e ruleset', () => {
    it('should default to "5e" ruleset when not specified', () => {
      findFeat.mockReturnValue({
        benefits: ['Increase your Strength score by 2'],
      });

      const result = computeAllFeatBuffs({ feats: ['Tough'] }, []);

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 2, isChoice: false },
      ]);
    });

    it('should find and parse a single 5e feat with ability score increase', () => {
      findFeat.mockReturnValue({
        benefits: ['Increase your Strength score by 2'],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Tough'] },
        [{ name: 'Tough' }]
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 2, isChoice: false },
      ]);
    });

    it('should parse ability score choice (OR pattern) in 5e', () => {
      findFeat.mockReturnValue({
        benefits: [
          'Increase your Strength or Dexterity score by 1',
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Custom Feat'] },
        []
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 1, isChoice: true },
        { name: 'Dexterity', amount: 1, isChoice: true },
      ]);
    });

    it('should parse choose-one ability increase in 5e', () => {
      findFeat.mockReturnValue({
        benefits: [
          'Choose one ability score. Increase it by 1',
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Custom Feat'] },
        []
      );

      expect(result.abilityScoreIncreases).toEqual([
        {
          name: 'any',
          amount: 1,
          isChoice: true,
          description: 'Choose one ability score. Increase it by 1',
        },
      ]);
    });

    it('should parse proficiency gain in 5e', () => {
      findFeat.mockReturnValue({
        benefits: ['You gain proficiency with heavy armor'],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Custom Feat'] },
        []
      );

      expect(result.proficiencies).toEqual([
        { name: 'heavy armor' },
      ]);
    });

    it('should parse proficiency choice in 5e', () => {
      findFeat.mockReturnValue({
        benefits: [
          'You gain proficiency in any combination of skills of your choice',
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Custom Feat'] },
        []
      );

      expect(result.proficiencies).toEqual([
        { name: 'skills', isChoice: true },
      ]);
    });

    it('should parse speed feature in 5e', () => {
      findFeat.mockReturnValue({
        benefits: ['Your speed increases by 10 feet'],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Custom Feat'] },
        []
      );

      expect(result.features).toEqual([
        {
          name: 'Speed Bonus',
          description: 'Your speed increases by 10 feet',
          type: 'speed',
          value: 10,
        },
      ]);
    });

    it('should parse initiative feature in 5e', () => {
      findFeat.mockReturnValue({
        benefits: ['You gain a +5 bonus to initiative'],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Custom Feat'] },
        []
      );

      expect(result.features).toEqual([
        {
          name: 'Initiative Bonus',
          description: 'You gain a +5 bonus to initiative',
          type: 'initiative',
          value: 5,
        },
      ]);
    });

    it('should parse HP per level feature in 5e', () => {
      findFeat.mockReturnValue({
        benefits: [
          'your hit point maximum increases by an additional 2 hit point',
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Custom Feat'] },
        []
      );

      expect(result.features).toEqual([
        {
          name: 'Hit Point Bonus',
          description:
            'your hit point maximum increases by an additional 2 hit point',
          type: 'hp_per_level',
          value: 2,
        },
      ]);
    });

    it('should parse flat HP feature in 5e', () => {
      findFeat.mockReturnValue({
        benefits: ['Your hit point maximum increases by 5'],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Custom Feat'] },
        []
      );

      expect(result.features).toEqual([
        {
          name: 'Hit Point Bonus',
          description: 'Your hit point maximum increases by 5',
          type: 'hp_flat',
          value: 5,
        },
      ]);
    });

    it('should parse language feature in 5e', () => {
      findFeat.mockReturnValue({
        benefits: ['You learn 2 languages of your choice'],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Custom Feat'] },
        []
      );

      expect(result.features).toEqual([
        {
          name: 'Language Bonus',
          description: 'You learn 2 languages of your choice',
          type: 'language',
          value: 2,
        },
      ]);
    });

    it('should parse resistance in 5e', () => {
      findFeat.mockReturnValue({
        benefits: ['You have resistance to fire'],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Custom Feat'] },
        []
      );

      expect(result.resistances).toEqual(['fire']);
    });

    it('should parse resistance with "gain" wording in 5e', () => {
      findFeat.mockReturnValue({
        benefits: ['You gain resistance to cold'],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Custom Feat'] },
        []
      );

      expect(result.resistances).toEqual(['cold']);
    });

    it('should classify unrecognized benefit as passive feature in 5e', () => {
      findFeat.mockReturnValue({
        benefits: ['You have an unusual aura'],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Custom Feat'] },
        []
      );

      expect(result.features).toEqual([
        {
          name: 'Passive Benefit',
          description: 'You have an unusual aura',
          type: 'passive',
        },
      ]);
    });

    it('should aggregate buffs from multiple 5e feats', () => {
      findFeat
        .mockReturnValueOnce({
          benefits: ['Increase your Strength score by 2'],
        })
        .mockReturnValueOnce({
          benefits: ['You gain proficiency with shields'],
        });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Tough', 'Alert'] },
        [{ name: 'Tough' }, { name: 'Alert' }]
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 2, isChoice: false },
      ]);
      expect(result.proficiencies).toEqual([
        { name: 'shields' },
      ]);
      expect(result.resistances).toEqual([]);
      expect(result.features).toEqual([]);
    });

    it('should handle a mix of ability, proficiency, resistance, and feature buffs from a single feat', () => {
      findFeat.mockReturnValue({
        benefits: [
          'Increase your Strength score by 2',
          'You gain proficiency with heavy armor',
          'You have resistance to fire',
          'Your speed increases by 10 feet',
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Custom Feat'] },
        []
      );

      expect(result.abilityScoreIncreases).toHaveLength(1);
      expect(result.abilityScoreIncreases[0]).toEqual({
        name: 'Strength',
        amount: 2,
        isChoice: false,
      });
      expect(result.proficiencies).toHaveLength(1);
      expect(result.proficiencies[0]).toEqual({ name: 'heavy armor' });
      expect(result.resistances).toHaveLength(1);
      expect(result.resistances[0]).toBe('fire');
      expect(result.features).toHaveLength(1);
      expect(result.features[0]).toEqual({
        name: 'Speed Bonus',
        description: 'Your speed increases by 10 feet',
        type: 'speed',
        value: 10,
      });
    });
  });

  describe('2024 ruleset', () => {
    it('should parse single-score ability_score_increase in 2024', () => {
      findFeat.mockReturnValue({
        benefits: [
          { type: 'ability_score_increase', description: '+1 STR' },
        ],
        ability_score_increase: { scores: ['Strength'], amount: 1 },
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Tough'] },
        [{ name: 'Tough' }]
      );

      expect(result.abilityScoreIncreases).toEqual([
        {
          name: 'Strength',
          amount: 1,
          isChoice: false,
          description: '+1 STR',
        },
      ]);
    });

    it('should parse two-score ability_score_increase as choice in 2024', () => {
      findFeat.mockReturnValue({
        benefits: [
          {
            type: 'ability_score_increase',
            description: '+1 to two abilities',
          },
        ],
        ability_score_increase: {
          scores: ['Strength', 'Dexterity'],
          amount: 1,
        },
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Custom Feat'] },
        []
      );

      expect(result.abilityScoreIncreases).toEqual([
        {
          name: 'any',
          amount: 1,
          isChoice: true,
          scores: ['Strength', 'Dexterity'],
          description: '+1 to two abilities',
        },
      ]);
    });

    it('should parse variable amount ability_score_increase in 2024', () => {
      findFeat.mockReturnValue({
        benefits: [
          {
            type: 'ability_score_increase',
            description: 'Variable increase',
          },
        ],
        ability_score_increase: {
          scores: ['Strength'],
          amount: 'variable',
        },
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Custom Feat'] },
        []
      );

      expect(result.abilityScoreIncreases).toEqual([
        {
          name: 'any',
          amount: [1, 2],
          isChoice: true,
          description: 'Variable increase',
        },
      ]);
    });

    it('should parse proficiency with improvised weapons in 2024', () => {
      findFeat.mockReturnValue({
        benefits: [
          {
            type: 'proficiency',
            name: 'Custom Feat',
            description: 'You gain proficiency with improvised weapons',
          },
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Custom Feat'] },
        []
      );

      expect(result.proficiencies).toEqual([
        { name: 'Improvised Weapons', type: 'proficiency' },
      ]);
    });

    it('should parse proficiency with all skills in 2024', () => {
      findFeat.mockReturnValue({
        benefits: [
          {
            type: 'proficiency',
            name: 'Custom Feat',
            description: 'You gain proficiency in all skills',
          },
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Custom Feat'] },
        []
      );

      expect(result.proficiencies).toEqual([
        { name: 'all_skills', type: 'skill' },
      ]);
    });

    it('should parse armor training proficiency in 2024', () => {
      findFeat.mockReturnValue({
        benefits: [
          {
            type: 'proficiency',
            name: 'Custom Feat',
            description:
              'You gain training with light armor and shields',
          },
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Custom Feat'] },
        []
      );

      expect(result.proficiencies).toEqual([
        { name: 'Light Armor', type: 'proficiency' },
        { name: 'Shields', type: 'proficiency' },
      ]);
    });

    it('should parse resistance with automation in 2024', () => {
      findFeat.mockReturnValue({
        benefits: [
          {
            type: 'resistance',
            name: 'Custom Feat',
            description: 'Resistance benefit',
            automation: {
              validTypes: ['fire', 'cold', 'lightning'],
              resistanceType: ['player_choice_fire_from_list'],
            },
          },
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Custom Feat'] },
        []
      );

      expect(result.features).toEqual([
        {
          name: 'Custom Feat',
          description: 'Resistance benefit',
          type: 'resistance_choice',
          automation: {
            validTypes: ['fire', 'cold', 'lightning'],
            resistanceType: ['player_choice_fire_from_list'],
            count: 2,
          },
        },
      ]);
    });

    it('should parse resistance without automation in 2024', () => {
      findFeat.mockReturnValue({
        benefits: [
          {
            type: 'resistance',
            name: 'Custom Feat',
            description: 'Resistance to poison',
          },
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Custom Feat'] },
        []
      );

      expect(result.features).toEqual([
        {
          name: 'Custom Feat',
          description: 'Resistance to poison',
          type: 'resistance',
        },
      ]);
    });

    it('should parse saving throw benefit in 2024', () => {
      findFeat.mockReturnValue({
        benefits: [
          {
            type: 'saving_throw',
            name: 'Custom Feat',
            description: 'Saving throw benefit',
            automation: { type: 'saving_throw_proficiency' },
          },
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Custom Feat'] },
        []
      );

      expect(result.features).toEqual([
        {
          name: 'Custom Feat',
          description: 'Saving throw benefit',
          type: 'saving_throw',
          automation: { type: 'saving_throw_proficiency' },
        },
      ]);
    });

    it('should parse Savage Attacker damage benefit in 2024', () => {
      findFeat.mockReturnValue({
        benefits: [
          {
            type: 'damage',
            name: 'Savage Attacker',
            description: 'Reroll damage once per turn',
            automation: { type: 'reroll_damage_once_per_turn' },
          },
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Custom Feat'] },
        []
      );

      expect(result.features).toEqual([
        {
          name: 'Savage Attacker',
          description: 'Reroll damage once per turn',
          type: 'reroll_damage_once_per_turn',
          automation: { type: 'reroll_damage_once_per_turn' },
        },
      ]);
    });

    it('should parse free spell benefit in 2024', () => {
      findFeat.mockReturnValue({
        benefits: [
          {
            type: 'spell',
            name: 'Level 1 Spell',
            description: 'Free spell benefit',
            automation: { type: 'free_spell' },
          },
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Custom Feat'] },
        []
      );

      expect(result.features).toEqual([
        {
          name: 'Level 1 Spell',
          description: 'Free spell benefit',
          type: 'free_spell',
          automation: { type: 'free_spell' },
        },
      ]);
    });

    it('should parse generic spell benefit in 2024', () => {
      findFeat.mockReturnValue({
        benefits: [
          {
            type: 'spell',
            name: 'Custom Spell',
            description: 'Spell benefit',
            automation: { type: 'spell' },
          },
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Custom Feat'] },
        []
      );

      expect(result.features).toEqual([
        {
          name: 'Custom Spell',
          description: 'Spell benefit',
          type: 'spell',
          automation: { type: 'spell' },
        },
      ]);
    });

    it('should parse Great Weapon Fighting in 2024 default case', () => {
      findFeat.mockReturnValue({
        benefits: [
          {
            type: 'some_type',
            name: 'Great Weapon Fighting',
            description: 'Damage reroll',
            automation: { type: 'great_weapon_fighting' },
          },
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Custom Feat'] },
        []
      );

      expect(result.features).toEqual([
        {
          name: 'Great Weapon Fighting',
          description: 'Damage reroll',
          type: 'great_weapon_fighting',
          automation: { type: 'great_weapon_fighting' },
        },
      ]);
    });

    it('should handle unknown benefit type in 2024 default case', () => {
      findFeat.mockReturnValue({
        benefits: [
          {
            type: 'unknown_type',
            name: 'Unknown Feat',
            description: 'Some unknown benefit',
            automation: { custom: true },
          },
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Custom Feat'] },
        []
      );

      expect(result.features).toEqual([
        {
          name: 'Unknown Feat',
          description: 'Some unknown benefit',
          type: 'unknown_type',
          automation: { custom: true },
        },
      ]);
    });

    it('should aggregate multiple 2024 feat buffs', () => {
      findFeat
        .mockReturnValueOnce({
          benefits: [
            {
              type: 'ability_score_increase',
              description: '+1 STR',
            },
          ],
          ability_score_increase: { scores: ['Strength'], amount: 1 },
        })
        .mockReturnValueOnce({
          benefits: [
            {
              type: 'proficiency',
              name: 'Custom Feat',
              description:
                'You gain training with heavy armor and shields',
            },
          ],
        });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['ASI Feat', 'Prof Feat'] },
        []
      );

      expect(result.abilityScoreIncreases).toEqual([
        {
          name: 'Strength',
          amount: 1,
          isChoice: false,
          description: '+1 STR',
        },
      ]);
      expect(result.proficiencies).toEqual([
        { name: 'Heavy Armor', type: 'proficiency' },
        { name: 'Shields', type: 'proficiency' },
      ]);
    });
  });

  describe('ruleset switching', () => {
    it('should use 5e parsing for 5e ruleset', () => {
      findFeat.mockReturnValue({
        benefits: ['Increase your Strength score by 2'],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Tough'] },
        []
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 2, isChoice: false },
      ]);
    });

    it('should use 2024 parsing for 2024 ruleset', () => {
      findFeat.mockReturnValue({
        benefits: [
          { type: 'ability_score_increase', description: '+1 STR' },
        ],
        ability_score_increase: { scores: ['Strength'], amount: 1 },
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Tough'] },
        []
      );

      expect(result.abilityScoreIncreases).toEqual([
        {
          name: 'Strength',
          amount: 1,
          isChoice: false,
          description: '+1 STR',
        },
      ]);
    });
  });
});
