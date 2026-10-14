import { describe, it, expect, vi, afterEach } from 'vitest';

import { findFeat } from '../shared/featFinder.js';
import { mergeDeduplicated } from '../shared/buffApplier.js';

import { applyFeatBuffsToFormData } from './featBuffService.js';

vi.mock('../shared/featFinder.js', () => ({
  findFeat: vi.fn(),
}));

vi.mock('../shared/buffApplier.js', () => ({
  mergeDeduplicated: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('applyFeatBuffsToFormData', () => {
  const makeFormData = (overrides = {}) => ({
    rules: '5e',
    feats: ['Tough'],
    abilities: [
      { name: 'Strength', featIncrease: 0 },
      { name: 'Dexterity', featIncrease: 0 },
      { name: 'Constitution', featIncrease: 0 },
    ],
    ...overrides,
  });

  describe('side effects on formData', () => {
    it('applies non-choice ability score increases to matching abilities in formData', () => {
      const formData = makeFormData();

      findFeat.mockReturnValue({
        benefits: ['Increase your Strength score by 2'],
      });

      applyFeatBuffsToFormData(formData, []);

      expect(formData.abilities[0].featIncrease).toBe(2);
      expect(formData.abilities[1].featIncrease).toBe(0);
      expect(formData.abilities[2].featIncrease).toBe(0);
    });

    it('accumulates ability score increases when multiple feats affect the same ability', () => {
      const formData = makeFormData({
        feats: ['Feat1', 'Feat2'],
      });

      findFeat
        .mockReturnValueOnce({
          benefits: ['Increase your Strength score by 2'],
        })
        .mockReturnValueOnce({
          benefits: ['Increase your Strength score by 1'],
        });

      applyFeatBuffsToFormData(formData, []);

      expect(formData.abilities[0].featIncrease).toBe(3);
    });

    it('matches ability names case-insensitively', () => {
      const formData = makeFormData({
        abilities: [{ name: 'strength', featIncrease: 0 }],
      });

      findFeat.mockReturnValue({
        benefits: ['Increase your Strength score by 2'],
      });

      applyFeatBuffsToFormData(formData, []);

      expect(formData.abilities[0].featIncrease).toBe(2);
    });

    it('merges resistances from feat parsing into formData via mergeDeduplicated', () => {
      const formData = makeFormData({ resistances: ['cold'] });

      findFeat.mockReturnValue({
        benefits: ['You have resistance to fire'],
      });

      applyFeatBuffsToFormData(formData, []);

      expect(mergeDeduplicated).toHaveBeenCalledWith(
        formData,
        'resistances',
        ['fire']
      );
    });

    it('does not crash when formData has no abilities array', () => {
      const formData = {
        rules: '5e',
        feats: ['Tough'],
      };

      findFeat.mockReturnValue({
        benefits: ['Increase your Strength score by 2'],
      });

      expect(() => applyFeatBuffsToFormData(formData, [])).not.toThrow();
    });

    it('skips choice/any ability score increases when applying side effects to formData', () => {
      const formData = makeFormData();

      findFeat.mockReturnValue({
        benefits: ['Choose one ability score. Increase the chosen ability score by 2'],
      });

      applyFeatBuffsToFormData(formData, []);

      expect(formData.abilities.every(a => a.featIncrease === 0)).toBe(true);
    });
  });

  describe('return value structure', () => {
    it('returns all four buff categories when a feat produces mixed benefits', () => {
      const formData = makeFormData();

      findFeat.mockReturnValue({
        benefits: [
          'Increase your Strength score by 2',
          'You gain proficiency with heavy armor',
          'You have resistance to fire',
          'Your speed increases by 10 feet',
        ],
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.abilityScoreIncreases).toHaveLength(1);
      expect(result.proficiencies).toHaveLength(1);
      expect(result.resistances).toHaveLength(1);
      expect(result.features).toHaveLength(1);
    });

    it('returns empty arrays for all categories when no feats are selected', () => {
      const formData = makeFormData({ feats: [] });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.proficiencies).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.features).toEqual([]);
    });

    it('skips feats that are not found (findFeat returns null)', () => {
      findFeat.mockReturnValue(null);

      const formData = makeFormData({ feats: ['Nonexistent'] });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.proficiencies).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.features).toEqual([]);
    });
  });
});
