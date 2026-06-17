import { describe, it, expect, vi } from 'vitest';

vi.mock('../shared/featFinder.js', () => ({
  findFeat: vi.fn(),
}));

vi.mock('../shared/buffApplier.js', () => ({
  resetFeatIncreases: vi.fn(),
  applyAbilityScoreIncreases: vi.fn(),
  mergeDeduplicated: vi.fn(),
}));

import { findFeat } from '../shared/featFinder.js';
import {
  resetFeatIncreases,
  applyAbilityScoreIncreases,
  mergeDeduplicated,
} from '../shared/buffApplier.js';

import { applyFeatBuffsToFormData } from './featBuffService.js';

describe('applyFeatBuffsToFormData', () => {
  it('should reset feat increases on abilities', () => {
    const formData = {
      rules: '5e',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', featIncrease: 5 }],
    };

    findFeat.mockReturnValue({
      benefits: ['Increase your Strength score by 2'],
    });

    applyFeatBuffsToFormData(formData, []);

    expect(resetFeatIncreases).toHaveBeenCalledWith(formData.abilities);
  });

  it('should apply ability score increases to abilities', () => {
    const formData = {
      rules: '5e',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', featIncrease: 0 }],
    };

    findFeat.mockReturnValue({
      benefits: ['Increase your Strength score by 2'],
    });

    applyFeatBuffsToFormData(formData, []);

    expect(applyAbilityScoreIncreases).toHaveBeenCalledWith(
      formData.abilities,
      [{ name: 'Strength', amount: 2, isChoice: false }]
    );
  });

  it('should merge resistances into formData', () => {
    const formData = {
      rules: '5e',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', featIncrease: 0 }],
      resistances: [],
    };

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

  it('should not add feat features to specialActions for 2024 ruleset', () => {
    const formData = {
      rules: '2024',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', featIncrease: 0 }],
    };

    findFeat.mockReturnValue({
      benefits: [
        { type: 'spell', name: 'Cantrip', description: 'Learn a cantrip' },
      ],
    });

    applyFeatBuffsToFormData(formData, []);

    expect(formData.specialActions).toBeUndefined();
  });

  it('should not add speed, initiative, hp_per_level, or hp_flat features for 5e ruleset', () => {
    const formData = {
      rules: '5e',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', featIncrease: 0 }],
    };

    findFeat.mockReturnValue({
      benefits: [
        'Your speed increases by 10 feet',
        'You gain a +5 bonus to initiative',
        'your hit point maximum increases by an additional 2 hit points',
        'Your hit point maximum increases by 10',
      ],
    });

    applyFeatBuffsToFormData(formData, []);

    expect(formData.specialActions).toBeUndefined();
  });

  it('should not add passive features to specialActions for 5e ruleset', () => {
    const formData = {
      rules: '5e',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', featIncrease: 0 }],
    };

    findFeat.mockReturnValue({
      benefits: ['You can cast detect magic at will'],
    });

    applyFeatBuffsToFormData(formData, []);

    expect(formData.specialActions).toBeUndefined();
  });

  it('should not modify specialActions when processing feats', () => {
    const formData = {
      rules: '2024',
      feats: ['Tough', 'Alert'],
      abilities: [{ name: 'Strength', featIncrease: 0 }],
      specialActions: [
        { name: 'Custom Action', description: 'Already there', type: 'custom' },
      ],
    };

    findFeat
      .mockReturnValueOnce({
        benefits: [{ type: 'spell', name: 'Cantrip', description: 'Learn a cantrip' }],
      })
      .mockReturnValueOnce({
        benefits: [{ type: 'spell', name: 'Fire Bolt', description: 'Learn fire bolt' }],
      });

    applyFeatBuffsToFormData(formData, []);

    expect(formData.specialActions).toHaveLength(1);
    expect(formData.specialActions[0].name).toBe('Custom Action');
  });

  it('should not modify specialActions when formData has no specialActions property', () => {
    const formData = {
      rules: '2024',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', featIncrease: 0 }],
    };

    findFeat.mockReturnValue({
      benefits: [{ type: 'spell', name: 'Cantrip', description: 'Learn a cantrip' }],
    });

    applyFeatBuffsToFormData(formData, []);

    expect(formData.specialActions).toBeUndefined();
  });

  it('should not modify specialActions when they are array of strings', () => {
    const formData = {
      rules: '2024',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', featIncrease: 0 }],
      specialActions: ['Existing Action'],
    };

    findFeat.mockReturnValue({
      benefits: [{ type: 'spell', name: 'Cantrip', description: 'Learn a cantrip' }],
    });

    applyFeatBuffsToFormData(formData, []);

    expect(formData.specialActions).toEqual(['Existing Action']);
  });

  it('should return the computed buffs object', () => {
    const formData = {
      rules: '5e',
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

  it('should default to "5e" ruleset when not specified', () => {
    const formData = {
      feats: ['Tough'],
      abilities: [{ name: 'Strength', featIncrease: 0 }],
    };

    findFeat.mockReturnValue({
      benefits: ['Your speed increases by 10 feet'],
    });

    applyFeatBuffsToFormData(formData, []);

    expect(formData.specialActions).toBeUndefined();
  });

  it('should handle empty feats array', () => {
    const formData = {
      rules: '5e',
      feats: [],
      abilities: [{ name: 'Strength', featIncrease: 0 }],
    };

    applyFeatBuffsToFormData(formData, []);

    expect(resetFeatIncreases).toHaveBeenCalledWith(formData.abilities);
    expect(applyAbilityScoreIncreases).toHaveBeenCalledWith(
      formData.abilities,
      []
    );
  });

  it('should handle undefined feats in formData', () => {
    const formData = {
      rules: '5e',
      abilities: [{ name: 'Strength', featIncrease: 0 }],
    };

    applyFeatBuffsToFormData(formData, []);

    expect(resetFeatIncreases).toHaveBeenCalledWith(formData.abilities);
  });

  it('should not modify specialActions when feature already exists', () => {
    const formData = {
      rules: '2024',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', featIncrease: 0 }],
      specialActions: [
        { name: 'Cantrip', description: 'Old cantrip', type: 'spell' },
      ],
    };

    findFeat.mockReturnValue({
      benefits: [{ type: 'spell', name: 'Cantrip', description: 'New cantrip' }],
    });

    applyFeatBuffsToFormData(formData, []);

    expect(formData.specialActions).toHaveLength(1);
  });

  it('should return buffs with type "passive" when feature has no type', () => {
    const formData = {
      rules: '5e',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', featIncrease: 0 }],
    };

    findFeat.mockReturnValue({
      benefits: ['You can cast detect magic at will'],
    });

    const buffs = applyFeatBuffsToFormData(formData, []);

    expect(buffs.features).toHaveLength(1);
    expect(buffs.features[0].type).toBe('passive');
    expect(formData.specialActions).toBeUndefined();
  });
});
