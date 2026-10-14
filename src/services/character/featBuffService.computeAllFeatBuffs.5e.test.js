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

describe('computeAllFeatBuffs — 5e ruleset', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('multi-benefit feat aggregation', () => {
    it('should parse both ability score increase and resistance from the same feat', () => {
      findFeat.mockReturnValue({
        name: 'War Caster',
        benefits: [
          'Increase your Constitution score by 1',
          'You have resistance to fire',
        ],
      });

      const result = computeAllFeatBuffs(
        { rules: '5e', feats: ['War Caster'] },
        []
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Constitution', amount: 1, isChoice: false, featName: 'War Caster', featDescription: undefined, max_value: 20 },
      ]);
      expect(result.resistances).toEqual(['fire']);
      expect(result.proficiencies).toEqual([]);
      expect(result.features).toEqual([]);
    });
  });
});
