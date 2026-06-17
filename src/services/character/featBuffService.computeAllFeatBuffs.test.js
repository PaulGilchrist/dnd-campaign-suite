import { describe, it, expect, vi } from 'vitest';

vi.mock('../shared/featFinder.js', () => ({
  findFeat: vi.fn(),
}));

vi.mock('../shared/buffApplier.js', () => ({
  resetMiscBonuses: vi.fn(),
  applyAbilityScoreIncreases: vi.fn(),
  mergeDeduplicated: vi.fn(),
}));

import { findFeat } from '../shared/featFinder.js';
import { computeAllFeatBuffs } from './featBuffService.js';

describe('computeAllFeatBuffs', () => {
  it('should return empty result when no feats selected', () => {
    const result = computeAllFeatBuffs({ rules: '5e', feats: [] }, []);

    expect(result.abilityScoreIncreases).toEqual([]);
    expect(result.proficiencies).toEqual([]);
    expect(result.resistances).toEqual([]);
    expect(result.features).toEqual([]);
  });

  it('should return empty result when feats array is undefined', () => {
    const result = computeAllFeatBuffs({ rules: '5e' }, []);

    expect(result.abilityScoreIncreases).toEqual([]);
  });

  it('should throw when formData is null', () => {
    expect(() => computeAllFeatBuffs(null, [])).toThrow();
  });

  it('should return empty result when allFeats is null', () => {
    const result = computeAllFeatBuffs({ rules: '5e', feats: ['Tough'] }, null);

    expect(result.abilityScoreIncreases).toEqual([]);
  });

  it('should default to "5e" ruleset when not specified', () => {
    findFeat.mockReturnValue({
      benefits: ['Increase your Strength score by 2'],
    });

    const result = computeAllFeatBuffs({ feats: ['Tough'] }, []);

    expect(result.abilityScoreIncreases).toEqual([
      { name: 'Strength', amount: 2, isChoice: false },
    ]);
  });

  it('should find and parse a single feat', () => {
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

  it('should aggregate buffs from multiple feats', () => {
    findFeat
      .mockReturnValueOnce({
        benefits: ['Increase your Strength score by 2'],
      })
      .mockReturnValueOnce({
        benefits: ['Increase your Dexterity score by 1'],
      });

    const result = computeAllFeatBuffs(
      { rules: '5e', feats: ['Tough', 'Alert'] },
      [{ name: 'Tough' }, { name: 'Alert' }]
    );

    expect(result.abilityScoreIncreases).toEqual([
      { name: 'Strength', amount: 2, isChoice: false },
      { name: 'Dexterity', amount: 1, isChoice: false },
    ]);
  });

  it('should skip feats that are not found', () => {
    findFeat.mockReturnValue(null);

    const result = computeAllFeatBuffs(
      { rules: '5e', feats: ['Nonexistent'] },
      [{ name: 'Tough' }]
    );

    expect(result.abilityScoreIncreases).toEqual([]);
  });

  it('should use "2024" ruleset when specified', () => {
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
      { name: 'Strength', amount: 1, isChoice: false, description: '+1 STR' },
    ]);
  });

  it('should aggregate proficiencies from multiple feats', () => {
    findFeat
      .mockReturnValueOnce({
        benefits: ['You gain proficiency with heavy armor'],
      })
      .mockReturnValueOnce({
        benefits: ['You gain proficiency with shields'],
      });

    const result = computeAllFeatBuffs(
      { rules: '5e', feats: ['Tough', 'Alert'] },
      [{ name: 'Tough' }, { name: 'Alert' }]
    );

    expect(result.proficiencies).toEqual([
      { name: 'heavy armor' },
      { name: 'shields' },
    ]);
  });

  it('should aggregate resistances from multiple feats', () => {
    findFeat
      .mockReturnValueOnce({
        benefits: ['You have resistance to fire'],
      })
      .mockReturnValueOnce({
        benefits: ['You have resistance to cold'],
      });

    const result = computeAllFeatBuffs(
      { rules: '5e', feats: ['Tough', 'Alert'] },
      [{ name: 'Tough' }, { name: 'Alert' }]
    );

    expect(result.resistances).toEqual(['fire', 'cold']);
  });

  it('should aggregate features from multiple feats', () => {
    findFeat
      .mockReturnValueOnce({
        benefits: ['Your speed increases by 10 feet'],
      })
      .mockReturnValueOnce({
        benefits: ['You gain a +5 bonus to initiative'],
      });

    const result = computeAllFeatBuffs(
      { rules: '5e', feats: ['Tough', 'Alert'] },
      [{ name: 'Tough' }, { name: 'Alert' }]
    );

    expect(result.features).toHaveLength(2);
    expect(result.features[0].type).toBe('speed');
    expect(result.features[1].type).toBe('initiative');
  });

  it('should handle a mix of ability, proficiency, resistance, and feature buffs', () => {
    findFeat.mockReturnValue({
      benefits: [
        'Increase your Strength score by 2',
        'You gain proficiency with heavy armor',
        'You have resistance to fire',
        'Your speed increases by 10 feet',
      ],
    });

    const result = computeAllFeatBuffs(
      { rules: '5e', feats: ['Tough'] },
      [{ name: 'Tough' }]
    );

    expect(result.abilityScoreIncreases).toHaveLength(1);
    expect(result.proficiencies).toHaveLength(1);
    expect(result.resistances).toHaveLength(1);
    expect(result.features).toHaveLength(1);
  });
});
