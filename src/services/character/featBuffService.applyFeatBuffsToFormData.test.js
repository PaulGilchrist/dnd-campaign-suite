// @cleaned-by-ai
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../shared/featFinder.js', () => ({
  findFeat: vi.fn(),
}));

vi.mock('../shared/buffApplier.js', () => ({
  resetFeatIncreases: vi.fn(),
  mergeDeduplicated: vi.fn(),
}));

import { findFeat } from '../shared/featFinder.js';
import {
  mergeDeduplicated,
} from '../shared/buffApplier.js';

import { applyFeatBuffsToFormData } from './featBuffService.js';

afterEach(() => {
  vi.clearAllMocks();
});

describe('applyFeatBuffsToFormData', () => {
  const baseFormData = (overrides = {}) => ({
    rules: '5e',
    feats: ['Tough'],
    abilities: [{ name: 'Strength', featIncrease: 0 }],
    ...overrides,
  });

  describe('side effects on formData', () => {
    it('should apply non-choice ability score increases to formData abilities', () => {
      const formData = {
        rules: '5e',
        feats: ['Tough'],
        abilities: [
          { name: 'Strength', featIncrease: 0 },
          { name: 'Dexterity', featIncrease: 0 },
        ],
      };

      findFeat.mockReturnValue({ benefits: ['Increase your Strength score by 2'] });

      applyFeatBuffsToFormData(formData, []);

      expect(formData.abilities[0].featIncrease).toBe(2);
      expect(formData.abilities[1].featIncrease).toBe(0);
    });

    it('should merge resistances from feat parsing into formData', () => {
      const formData = baseFormData({ resistances: ['cold'] });

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

  });

  describe('return value structure', () => {
    it('should return an object with abilityScoreIncreases populated from feat benefits', () => {
      const formData = baseFormData();

      findFeat.mockReturnValue({
        benefits: ['Increase your Strength score by 2'],
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 2, isChoice: false },
      ]);
    });

    it('should return an object with proficiencies populated from feat benefits', () => {
      const formData = baseFormData();

      findFeat.mockReturnValue({
        benefits: ['You gain proficiency with heavy armor'],
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.proficiencies).toEqual([
        { name: 'heavy armor' },
      ]);
    });

    it('should return an object with resistances populated from feat benefits', () => {
      const formData = baseFormData();

      findFeat.mockReturnValue({
        benefits: ['You have resistance to fire'],
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.resistances).toEqual(['fire']);
    });

    it('should return an object with features populated from speed/initiative/hp/language benefits', () => {
      const formData = baseFormData();

      findFeat.mockReturnValue({
        benefits: ['Your speed increases by 10 feet'],
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.features).toHaveLength(1);
      expect(result.features[0].type).toBe('speed');
    });

    it('should return features with type "passive" for unrecognized benefit text', () => {
      const formData = baseFormData();

      findFeat.mockReturnValue({
        benefits: ['You can cast detect magic at will'],
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.features).toHaveLength(1);
      expect(result.features[0].type).toBe('passive');
    });

    it('should return all four buff categories when a feat produces mixed benefits', () => {
      const formData = baseFormData();

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

    it('should return empty arrays for all categories when no feats are selected', () => {
      const formData = baseFormData({ feats: [] });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.proficiencies).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.features).toEqual([]);
    });

    });

  describe('ability score increase parsing', () => {
    it('should mark isChoice true when benefit text contains "or" (dual ability selection)', () => {
      const formData = baseFormData();

      findFeat.mockReturnValue({
        benefits: ['Increase your Strength or Dexterity score by 2'],
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.abilityScoreIncreases).toHaveLength(2);
      expect(result.abilityScoreIncreases[0].name).toBe('Strength');
      expect(result.abilityScoreIncreases[0].isChoice).toBe(true);
      expect(result.abilityScoreIncreases[1].name).toBe('Dexterity');
      expect(result.abilityScoreIncreases[1].isChoice).toBe(true);
    });

    it('should mark isChoice true and name "any" for choose-one ability score benefits', () => {
      const formData = baseFormData();

      findFeat.mockReturnValue({
        benefits: ['Choose one ability score. Increase the chosen ability score by 1'],
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.abilityScoreIncreases).toHaveLength(1);
      expect(result.abilityScoreIncreases[0].name).toBe('any');
      expect(result.abilityScoreIncreases[0].isChoice).toBe(true);
      expect(result.abilityScoreIncreases[0].description).toBe(
        'Choose one ability score. Increase the chosen ability score by 1'
      );
    });

    it('should set isChoice false for single-ability increases without "or"', () => {
      const formData = baseFormData();

      findFeat.mockReturnValue({
        benefits: ['Increase your Constitution score by 1'],
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.abilityScoreIncreases[0].isChoice).toBe(false);
    });
  });

  describe('features parsing', () => {
    it('should create speed feature with parsed numeric value', () => {
      const formData = baseFormData();

      findFeat.mockReturnValue({
        benefits: ['Your speed increases by 15 feet'],
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.features).toHaveLength(1);
      expect(result.features[0].type).toBe('speed');
      expect(result.features[0].value).toBe(15);
    });

    it('should create initiative feature with parsed numeric value', () => {
      const formData = baseFormData();

      findFeat.mockReturnValue({
        benefits: ['You gain a +2 bonus to initiative'],
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.features).toHaveLength(1);
      expect(result.features[0].type).toBe('initiative');
      expect(result.features[0].value).toBe(2);
    });

    it('should create hp_per_level feature when benefit mentions "additional" hit points', () => {
      const formData = baseFormData();

      findFeat.mockReturnValue({
        benefits: ['your hit point maximum increases by an additional 4 hit points'],
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.features).toHaveLength(1);
      expect(result.features[0].type).toBe('hp_per_level');
      expect(result.features[0].value).toBe(4);
    });

    it('should create hp_flat feature for flat hit point increases', () => {
      const formData = baseFormData();

      findFeat.mockReturnValue({
        benefits: ['Your hit point maximum increases by 10'],
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.features).toHaveLength(1);
      expect(result.features[0].type).toBe('hp_flat');
      expect(result.features[0].value).toBe(10);
    });

    it('should create language feature with parsed numeric value', () => {
      const formData = baseFormData();

      findFeat.mockReturnValue({
        benefits: ['You learn 2 languages of your choice'],
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.features).toHaveLength(1);
      expect(result.features[0].type).toBe('language');
      expect(result.features[0].value).toBe(2);
    });
  });

  describe('ruleset handling', () => {
    it('should default to "5e" ruleset when not specified', () => {
      const formData = {
        feats: ['Tough'],
        abilities: [{ name: 'Strength', featIncrease: 0 }],
      };

      findFeat.mockReturnValue({
        benefits: ['Increase your Strength score by 2'],
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 2, isChoice: false },
      ]);
    });

    it('should use "2024" ruleset when specified', () => {
      const formData = baseFormData({ rules: '2024' });

      findFeat.mockReturnValue({
        benefits: [
          { type: 'ability_score_increase', description: '+1 STR' },
        ],
        ability_score_increase: { scores: ['Strength'], amount: 1 },
      });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 1, isChoice: false, description: '+1 STR' },
      ]);
    });
  });

  describe('edge cases', () => {
    it('should handle multiple feats by aggregating their buffs', () => {
      findFeat
        .mockReturnValueOnce({
          benefits: ['Increase your Strength score by 2'],
        })
        .mockReturnValueOnce({
          benefits: ['Increase your Dexterity score by 1'],
        });

      const formData = baseFormData({ feats: ['Tough', 'Alert'] });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.abilityScoreIncreases).toHaveLength(2);
      expect(result.abilityScoreIncreases[0].name).toBe('Strength');
      expect(result.abilityScoreIncreases[0].amount).toBe(2);
      expect(result.abilityScoreIncreases[1].name).toBe('Dexterity');
      expect(result.abilityScoreIncreases[1].amount).toBe(1);
    });

    it('should skip feats that are not found in the allFeats list', () => {
      findFeat.mockReturnValue(null);

      const formData = baseFormData({ feats: ['Nonexistent'] });

      const result = applyFeatBuffsToFormData(formData, []);

      expect(result.abilityScoreIncreases).toEqual([]);
      expect(result.proficiencies).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.features).toEqual([]);
    });

  });
});
