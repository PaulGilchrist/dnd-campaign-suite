import { describe, it, expect, vi, beforeEach } from 'vitest';

import { findFeat } from '../../services/shared/featFinder.js';
import {
  computeAllFeatBuffs,
} from './featBuffService.js';

vi.mock('../../services/shared/featFinder.js', () => ({
  findFeat: vi.fn(),
}));

describe('computeAllFeatBuffs — 2024 ruleset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('aggregation across multiple feats', () => {
    it('should aggregate buffs from multiple 2024 feats', () => {
      findFeat
        .mockReturnValueOnce({
          name: 'ASI Feat',
          benefits: [
            { type: 'ability_score_increase', description: '+1 STR' },
          ],
          ability_score_increase: { scores: ['Strength'], amount: 1 },
        })
        .mockReturnValueOnce({
          name: 'Prof Feat',
          benefits: [
            { type: 'proficiency', name: 'Prof Feat', description: 'You gain training with heavy armor and shields' },
          ],
        });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['ASI Feat', 'Prof Feat'] },
        []
      );

      expect(result.abilityScoreIncreases).toHaveLength(1);
      expect(result.proficiencies).toHaveLength(2);
      expect(result.abilityScoreIncreases[0].featName).toBe('ASI Feat');
      expect(result.proficiencies[0].name).toBe('Heavy Armor');
      expect(result.proficiencies[1].name).toBe('Shields');
    });

    it('should skip benefits without a type property', () => {
      findFeat.mockReturnValue({
        benefits: [
          { type: 'ability_score_increase', description: 'Valid' },
          { description: 'No type' },
          null,
        ],
        ability_score_increase: { scores: ['STR'], amount: 1 },
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Custom Feat'] },
        []
      );

      expect(result.abilityScoreIncreases).toHaveLength(1);
    });

    it('should aggregate benefits from multiple benefit objects in a single feat', () => {
      findFeat.mockReturnValue({
        benefits: [
          { type: 'ability_score_increase', description: '+1 STR' },
          { type: 'proficiency', name: 'Heavy Armor', description: 'Gain heavy armor proficiency' },
          { type: 'spell', name: 'Fire Bolt', description: 'Learn fire bolt' },
        ],
        ability_score_increase: { scores: ['Strength'], amount: 1 },
      });

      const result = computeAllFeatBuffs(
        { rules: '2024', feats: ['Custom Feat'] },
        []
      );

      expect(result.abilityScoreIncreases).toHaveLength(1);
      expect(result.proficiencies).toHaveLength(1);
      expect(result.features).toHaveLength(1);
    });

    it('should attach featName to all features from all feats', () => {
      findFeat
        .mockReturnValueOnce({
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

    it('should attach featName and featDescription to ability score increases', () => {
      findFeat.mockReturnValue({
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

      expect(result.abilityScoreIncreases[0].featName).toBe('Tough');
      expect(result.abilityScoreIncreases[0].featDescription).toBe('Extra hit points');
    });
  });
});
