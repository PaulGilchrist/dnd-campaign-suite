import { describe, it, expect, vi, beforeEach } from 'vitest';

import { findFeat } from '../../services/shared/featFinder.js';
import {
  computeAllFeatBuffs,
} from './featBuffService.js';

vi.mock('../../services/shared/featFinder.js', () => ({
  findFeat: vi.fn(),
}));

describe('computeAllFeatBuffs — edge cases and error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('invalid / missing input handling', () => {
    it('should throw TypeError when formData is null', () => {
      expect(() => computeAllFeatBuffs(null, [])).toThrow(TypeError);
    });

    it('should throw TypeError when formData is undefined', () => {
      expect(() => computeAllFeatBuffs(undefined, [])).toThrow(TypeError);
    });

    it('should default rules to "5e" when formData.rules is missing', () => {
      findFeat.mockReturnValue({
        name: 'Tough',
        benefits: ['Increase your Strength score by 2'],
      });

      const result = computeAllFeatBuffs({ feats: ['Tough'] }, []);

      expect(result.abilityScoreIncreases).toHaveLength(1);
      expect(result.abilityScoreIncreases[0].name).toBe('Strength');
    });

    it('should return empty result when formData has no rules field and no feats', () => {
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

    it('should return empty result when formData.feats is undefined', () => {
      const result = computeAllFeatBuffs({ rules: '5e' }, []);

      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.proficiencies).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.features).toEqual([]);
    });
  });

  describe('findFeat returning null', () => {
    it('should return empty result when allFeats is null and selected feats exist', () => {
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

    it('should skip selected feats that findFeat cannot resolve', () => {
      findFeat
        .mockReturnValueOnce(null)
        .mockReturnValueOnce({
          name: 'Tough',
          benefits: ['Increase your Strength score by 2'],
        });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Nonexistent', 'Tough'] },
        [{ name: 'Tough' }]
      );

      expect(result.abilityScoreIncreases).toHaveLength(1);
      expect(result.abilityScoreIncreases[0].featName).toBe('Tough');
    });

    it('should return empty result when all selected feats are unresolvable', () => {
      findFeat.mockReturnValue(null);

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Nonexistent1', 'Nonexistent2'] },
        [{ name: 'SomeFeat' }]
      );

      expect(result.features).toEqual([]);
    });
  });

  describe('aggregation across multiple feats', () => {
    it('should aggregate buffs from multiple 5e feats and attach featName', () => {
      findFeat
        .mockReturnValueOnce({
          name: 'Tough',
          benefits: ['Increase your Strength score by 2'],
        })
        .mockReturnValueOnce({
          name: 'Alert',
          benefits: ['You gain proficiency with shields'],
        });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Tough', 'Alert'] },
        [{ name: 'Tough' }, { name: 'Alert' }]
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 2, isChoice: false, featName: 'Tough', featDescription: undefined, max_value: 20 },
      ]);
      expect(result.proficiencies).toEqual([
        { name: 'Shields', type: 'proficiency' },
      ]);
      expect(result.abilityScoreIncreases[0].featName).toBe('Tough');
    });

    it('should aggregate multiple 2024 feat buffs and attach featName', () => {
      findFeat
        .mockReturnValueOnce({
          name: 'ASI Feat',
          benefits: [
            {
              type: 'ability_score_increase',
              description: '+1 STR',
            },
          ],
          ability_score_increase: { scores: ['Strength'], amount: 1 },
        })
        .mockReturnValueOnce({
          name: 'Prof Feat',
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
          featName: 'ASI Feat',
          featDescription: undefined,
          max_value: 20,
        },
      ]);
      expect(result.proficiencies).toEqual([
        { name: 'Heavy Armor', type: 'proficiency' },
        { name: 'Shields', type: 'proficiency' },
      ]);
      expect(result.abilityScoreIncreases[0].featName).toBe('ASI Feat');
    });

    it('should handle 2024 feats with description attached to ASI', () => {
      findFeat.mockReturnValueOnce({
        name: 'Tough',
        benefits: [
          { type: 'ability_score_increase', description: '+1 STR' },
        ],
        ability_score_increase: { scores: ['Strength'], amount: 1 },
        description: 'Extra hit points',
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Tough'] },
        [{ name: 'Tough' }]
      );

      expect(result.abilityScoreIncreases[0].featDescription).toBe('Extra hit points');
    });
  });

  describe('feature featName attachment', () => {
    it('should attach featName to parsed features from 5e', () => {
      findFeat.mockReturnValue({
        name: 'Custom Feat',
        benefits: [
          'You have an unusual aura',
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['Custom Feat'] },
        []
      );

      expect(result.features[0].featName).toBe('Custom Feat');
    });

    it('should attach featName to 2024 features from all benefit types', () => {
      findFeat.mockReturnValueOnce({
        name: 'Feat A',
        benefits: [
          { type: 'resistance', name: 'Feat A', description: 'Resistance to fire', automation: { validTypes: [], resistanceType: ['fixed'] } },
        ],
      })
      .mockReturnValueOnce({
        name: 'Feat B',
        benefits: [
          { type: 'spell', name: 'Fire Bolt', description: 'Learn fire bolt', automation: { type: 'spell' } },
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Feat A', 'Feat B'] },
        []
      );

      expect(result.features[0].featName).toBe('Feat A');
      expect(result.features[1].featName).toBe('Feat B');
    });
  });
});
