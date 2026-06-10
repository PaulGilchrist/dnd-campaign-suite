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
import {
  resetMiscBonuses,
  applyAbilityScoreIncreases,
  mergeDeduplicated,
} from '../shared/buffApplier.js';

import {
  computeFeatBuffs,
  computeAllFeatBuffs,
  applyFeatBuffsToFormData,
  clearAppliedFeatBuffs,
} from './featBuffService.js';

describe('computeFeatBuffs', () => {
  describe('5e ruleset — string benefit text parsing', () => {
    it('should return empty result when feat is null', () => {
      expect(computeFeatBuffs(null, '5e')).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('should return empty result when feat is undefined', () => {
      expect(computeFeatBuffs(undefined, '5e')).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('should return empty result when feat has no benefits', () => {
      expect(computeFeatBuffs({}, '5e')).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('should return empty result when benefits is not an array', () => {
      expect(computeFeatBuffs({ benefits: 'not-an-array' }, '5e')).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('should parse a single ability score increase', () => {
      const result = computeFeatBuffs(
        { benefits: ['Increase your Strength score by 2'] },
        '5e'
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 2, isChoice: false },
      ]);
      expect(result.proficiencies).toEqual([]);
      expect(result.resistances).toEqual([]);
      expect(result.features).toEqual([]);
    });

    it('should parse an ability score increase with "or" (choice)', () => {
      const result = computeFeatBuffs(
        { benefits: ['Increase your Strength or Dexterity score by 1'] },
        '5e'
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 1, isChoice: true },
        { name: 'Dexterity', amount: 1, isChoice: true },
      ]);
    });

    it('should parse an ability score increase with "choose one" pattern', () => {
      const result = computeFeatBuffs(
        { benefits: ['Choose one ability score. Increase the chosen ability score by 2'] },
        '5e'
      );

      expect(result.abilityScoreIncreases).toEqual([
        {
          name: 'any',
          amount: 2,
          isChoice: true,
          description: 'Choose one ability score. Increase the chosen ability score by 2',
        },
      ]);
    });

    it('should parse a proficiency gain', () => {
      const result = computeFeatBuffs(
        { benefits: ['You gain proficiency with heavy armor'] },
        '5e'
      );

      expect(result.proficiencies).toEqual([
        { name: 'heavy armor' },
      ]);
    });

    it('should parse a proficiency choice', () => {
      const result = computeFeatBuffs(
        { benefits: ['You gain proficiency in any combination of two skills of your choice'] },
        '5e'
      );

      expect(result.proficiencies).toEqual([
        { name: 'two skills', isChoice: true },
      ]);
    });

    it('should parse a speed increase', () => {
      const result = computeFeatBuffs(
        { benefits: ['Your speed increases by 10 feet'] },
        '5e'
      );

      expect(result.features).toEqual([
        { name: 'Speed Bonus', description: 'Your speed increases by 10 feet', type: 'speed', value: 10 },
      ]);
    });

    it('should parse an initiative bonus', () => {
      const result = computeFeatBuffs(
        { benefits: ['You gain a +5 bonus to initiative'] },
        '5e'
      );

      expect(result.features).toEqual([
        { name: 'Initiative Bonus', description: 'You gain a +5 bonus to initiative', type: 'initiative', value: 5 },
      ]);
    });

    it('should parse an HP per level bonus', () => {
      const result = computeFeatBuffs(
        { benefits: ['your hit point maximum increases by an additional 2 hit points'] },
        '5e'
      );

      expect(result.features).toEqual([
        { name: 'Hit Point Bonus', description: 'your hit point maximum increases by an additional 2 hit points', type: 'hp_per_level', value: 2 },
      ]);
    });

    it('should parse a flat HP bonus', () => {
      const result = computeFeatBuffs(
        { benefits: ['Your hit point maximum increases by 10'] },
        '5e'
      );

      expect(result.features).toEqual([
        { name: 'Hit Point Bonus', description: 'Your hit point maximum increases by 10', type: 'hp_flat', value: 10 },
      ]);
    });

    it('should parse a language bonus', () => {
      const result = computeFeatBuffs(
        { benefits: ['You learn 2 languages of your choice'] },
        '5e'
      );

      expect(result.features).toEqual([
        { name: 'Language Bonus', description: 'You learn 2 languages of your choice', type: 'language', value: 2 },
      ]);
    });

    it('should parse a resistance', () => {
      const result = computeFeatBuffs(
        { benefits: ['You have resistance to fire'] },
        '5e'
      );

      expect(result.resistances).toEqual(['fire']);
    });

    it('should parse a resistance with "gain" wording', () => {
      const result = computeFeatBuffs(
        { benefits: ['You gain resistance to cold'] },
        '5e'
      );

      expect(result.resistances).toEqual(['cold']);
    });

    it('should classify unrecognized benefit text as a passive feature', () => {
      const result = computeFeatBuffs(
        { benefits: ['You can cast detect magic at will'] },
        '5e'
      );

      expect(result.features).toEqual([
        { name: 'Passive Benefit', description: 'You can cast detect magic at will', type: 'passive' },
      ]);
    });

    it('should aggregate multiple benefits from a single feat', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            'Increase your Strength score by 2',
            'You gain proficiency with heavy armor',
            'Your speed increases by 10 feet',
          ],
        },
        '5e'
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 2, isChoice: false },
      ]);
      expect(result.proficiencies).toEqual([
        { name: 'heavy armor' },
      ]);
      expect(result.features).toEqual([
        { name: 'Speed Bonus', description: 'Your speed increases by 10 feet', type: 'speed', value: 10 },
      ]);
    });

    it('should skip non-string benefit entries', () => {
      const result = computeFeatBuffs(
        { benefits: ['Increase your Strength score by 2', null, 42, {}] },
        '5e'
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 2, isChoice: false },
      ]);
    });

    it('should handle ability score increase with "or" detected via text match', () => {
      const result = computeFeatBuffs(
        { benefits: ['Increase your Strength or Dexterity score by 1'] },
        '5e'
      );

      // ABILITY_OR_PATTERN matches first, so isChoice is set by that path
      expect(result.abilityScoreIncreases[0].isChoice).toBe(true);
      expect(result.abilityScoreIncreases[1].isChoice).toBe(true);
    });

    it('should handle case-insensitive ability score pattern', () => {
      const result = computeFeatBuffs(
        { benefits: ['increase your intelligence score by 1'] },
        '5e'
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'intelligence', amount: 1, isChoice: false },
      ]);
    });

    it('should handle case-insensitive speed pattern', () => {
      const result = computeFeatBuffs(
        { benefits: ['your speed increases by 5 feet'] },
        '5e'
      );

      expect(result.features[0].value).toBe(5);
    });

    it('should handle case-insensitive initiative pattern', () => {
      const result = computeFeatBuffs(
        { benefits: ['you gain a +3 bonus to initiative'] },
        '5e'
      );

      expect(result.features[0].value).toBe(3);
    });

    it('should handle case-insensitive HP flat pattern', () => {
      const result = computeFeatBuffs(
        { benefits: ['your hit point maximum increases by 5'] },
        '5e'
      );

      expect(result.features[0].value).toBe(5);
    });
  });

  describe('2024 ruleset — structured benefit objects', () => {
    it('should return empty result when feat is null', () => {
      expect(computeFeatBuffs(null, '2024')).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('should return empty result when feat has no benefits', () => {
      expect(computeFeatBuffs({}, '2024')).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('should parse a single ability_score_increase with one score', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'ability_score_increase', description: '+1 to an ability' },
          ],
          ability_score_increase: { scores: ['Strength'], amount: 1 },
        },
        '2024'
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 1, isChoice: false, description: '+1 to an ability' },
      ]);
    });

    it('should parse a single ability_score_increase with multiple scores', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'ability_score_increase', description: '+1 to two abilities' },
          ],
          ability_score_increase: { scores: ['Strength', 'Constitution'], amount: 1 },
        },
        '2024'
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 1, isChoice: true, description: '+1 to two abilities' },
        { name: 'Constitution', amount: 1, isChoice: true, description: '+1 to two abilities' },
      ]);
    });

    it('should parse a single ability_score_increase with more than 2 scores', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'ability_score_increase', description: 'Choose any ability' },
          ],
          ability_score_increase: { scores: ['STR', 'DEX', 'CON'], amount: 1 },
        },
        '2024'
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'any', amount: [1], isChoice: true, description: 'Choose any ability' },
      ]);
    });

    it('should parse a variable amount ability_score_increase', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'ability_score_increase', description: 'Variable ASI' },
          ],
          ability_score_increase: { scores: ['Strength'], amount: 'variable' },
        },
        '2024'
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'any', amount: [1, 2], isChoice: true, description: 'Variable ASI' },
      ]);
    });

    it('should parse a proficiency benefit with "all skills"', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Skill Expertise', description: 'Gain proficiency in all skills' },
          ],
        },
        '2024'
      );

      expect(result.proficiencies).toEqual([
        { name: 'all_skills', type: 'skill' },
      ]);
    });

    it('should parse a proficiency benefit with "Expertise"', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Expertise', description: 'Gain Expertise in a skill' },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        { name: 'Expertise', description: 'Gain Expertise in a skill', type: 'expertise' },
      ]);
    });

    it('should parse a regular proficiency benefit', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Light Armor', description: 'Gain proficiency with light armor' },
          ],
        },
        '2024'
      );

      expect(result.proficiencies).toEqual([
        { name: 'Light Armor', type: 'proficiency' },
      ]);
    });

    it('should parse a default benefit type as a feature', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'spell', name: 'Cantrip', description: 'Learn a cantrip' },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        { name: 'Cantrip', description: 'Learn a cantrip', type: 'spell' },
      ]);
    });

    it('should skip benefits without a type property', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'ability_score_increase', description: 'Valid' },
            { description: 'No type' },
            null,
          ],
          ability_score_increase: { scores: ['STR'], amount: 1 },
        },
        '2024'
      );

      expect(result.abilityScoreIncreases).toHaveLength(1);
    });

    it('should aggregate benefits from multiple benefit objects', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'ability_score_increase', description: '+1 STR' },
            { type: 'proficiency', name: 'Heavy Armor', description: 'Gain heavy armor proficiency' },
            { type: 'spell', name: 'Fire Bolt', description: 'Learn fire bolt' },
          ],
          ability_score_increase: { scores: ['Strength'], amount: 1 },
        },
        '2024'
      );

      expect(result.abilityScoreIncreases).toHaveLength(1);
      expect(result.proficiencies).toHaveLength(1);
      expect(result.features).toHaveLength(1);
    });

    it('should handle ability_score_increase with array amount and more than 2 scores', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'ability_score_increase', description: 'Multi ASI' },
          ],
          ability_score_increase: { scores: ['STR', 'DEX', 'CON'], amount: [1, 2] },
        },
        '2024'
      );

      // More than 2 scores triggers the "any" path with array amount
      expect(result.abilityScoreIncreases).toEqual([
        { name: 'any', amount: [1, 2], isChoice: true, description: 'Multi ASI' },
      ]);
    });

    it('should handle ability_score_increase with single score and numeric amount', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'ability_score_increase', description: '+1 STR' },
          ],
          ability_score_increase: { scores: ['Strength'], amount: 2 },
        },
        '2024'
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 2, isChoice: false, description: '+1 STR' },
      ]);
    });

    it('should default amount to 1 when not a number', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'ability_score_increase', description: '+? STR' },
          ],
          ability_score_increase: { scores: ['Strength'], amount: 'unknown' },
        },
        '2024'
      );

      expect(result.abilityScoreIncreases[0].amount).toBe(1);
    });
  });

  describe('ruleset selection', () => {
    it('should use 5e parsing for "5e" ruleset', () => {
      const result = computeFeatBuffs(
        { benefits: ['Increase your Strength score by 2'] },
        '5e'
      );

      expect(result.abilityScoreIncreases[0].name).toBe('Strength');
    });

    it('should use 2024 parsing for "2024" ruleset', () => {
      const result = computeFeatBuffs(
        {
          benefits: [{ type: 'ability_score_increase', description: '+1 STR' }],
          ability_score_increase: { scores: ['Strength'], amount: 1 },
        },
        '2024'
      );

      expect(result.abilityScoreIncreases[0].name).toBe('Strength');
    });

    it('should default to 2024 parsing when ruleset is not specified', () => {
      const result = computeFeatBuffs(
        {
          benefits: [{ type: 'ability_score_increase', description: '+1 STR' }],
          ability_score_increase: { scores: ['Strength'], amount: 1 },
        }
      );

      expect(result.abilityScoreIncreases[0].name).toBe('Strength');
    });
  });
});

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

describe('applyFeatBuffsToFormData', () => {
  it('should reset misc bonuses on abilities', () => {
    const formData = {
      rules: '5e',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', miscBonus: 5 }],
    };

    findFeat.mockReturnValue({
      benefits: ['Increase your Strength score by 2'],
    });

    applyFeatBuffsToFormData(formData, []);

    expect(resetMiscBonuses).toHaveBeenCalledWith(formData.abilities);
  });

  it('should apply ability score increases to abilities', () => {
    const formData = {
      rules: '5e',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', miscBonus: 0 }],
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
      abilities: [{ name: 'Strength', miscBonus: 0 }],
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

  it('should add non-ability buffs as specialActions for 2024 ruleset', () => {
    const formData = {
      rules: '2024',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', miscBonus: 0 }],
    };

    findFeat.mockReturnValue({
      benefits: [
        { type: 'spell', name: 'Cantrip', description: 'Learn a cantrip' },
      ],
    });

    applyFeatBuffsToFormData(formData, []);

    expect(formData.specialActions).toEqual([
      {
        name: 'Cantrip',
        description: 'Learn a cantrip',
        type: 'spell',
        source: 'feat',
      },
    ]);
  });

  it('should not add speed, initiative, hp_per_level, or hp_flat features as specialActions for 5e ruleset', () => {
    const formData = {
      rules: '5e',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', miscBonus: 0 }],
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

  it('should add passive features as specialActions for 5e ruleset', () => {
    const formData = {
      rules: '5e',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', miscBonus: 0 }],
    };

    findFeat.mockReturnValue({
      benefits: ['You can cast detect magic at will'],
    });

    applyFeatBuffsToFormData(formData, []);

    expect(formData.specialActions).toEqual([
      {
        name: 'Passive Benefit',
        description: 'You can cast detect magic at will',
        type: 'passive',
        source: 'feat',
      },
    ]);
  });

  it('should not duplicate specialActions with the same name', () => {
    const formData = {
      rules: '2024',
      feats: ['Tough', 'Alert'],
      abilities: [{ name: 'Strength', miscBonus: 0 }],
      specialActions: [
        { name: 'Cantrip', description: 'Learn a cantrip', type: 'spell', source: 'feat' },
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

    expect(formData.specialActions).toHaveLength(2);
    expect(formData.specialActions.find(a => a.name === 'Cantrip')).toBeDefined();
    expect(formData.specialActions.find(a => a.name === 'Fire Bolt')).toBeDefined();
  });

  it('should handle formData with no specialActions property', () => {
    const formData = {
      rules: '2024',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', miscBonus: 0 }],
    };

    findFeat.mockReturnValue({
      benefits: [{ type: 'spell', name: 'Cantrip', description: 'Learn a cantrip' }],
    });

    applyFeatBuffsToFormData(formData, []);

    expect(formData.specialActions).toBeDefined();
    expect(formData.specialActions).toHaveLength(1);
  });

  it('should handle specialActions as array of strings', () => {
    const formData = {
      rules: '2024',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', miscBonus: 0 }],
      specialActions: ['Existing Action'],
    };

    findFeat.mockReturnValue({
      benefits: [{ type: 'spell', name: 'Cantrip', description: 'Learn a cantrip' }],
    });

    applyFeatBuffsToFormData(formData, []);

    expect(formData.specialActions).toEqual([
      'Existing Action',
      { name: 'Cantrip', description: 'Learn a cantrip', type: 'spell', source: 'feat' },
    ]);
  });

  it('should return the computed buffs object', () => {
    const formData = {
      rules: '5e',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', miscBonus: 0 }],
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
      abilities: [{ name: 'Strength', miscBonus: 0 }],
    };

    findFeat.mockReturnValue({
      benefits: ['Your speed increases by 10 feet'],
    });

    applyFeatBuffsToFormData(formData, []);

    // In 5e mode, speed features should NOT be added as specialActions
    expect(formData.specialActions).toBeUndefined();
  });

  it('should handle empty feats array', () => {
    const formData = {
      rules: '5e',
      feats: [],
      abilities: [{ name: 'Strength', miscBonus: 0 }],
    };

    applyFeatBuffsToFormData(formData, []);

    expect(resetMiscBonuses).toHaveBeenCalledWith(formData.abilities);
    expect(applyAbilityScoreIncreases).toHaveBeenCalledWith(
      formData.abilities,
      []
    );
  });

  it('should handle undefined feats in formData', () => {
    const formData = {
      rules: '5e',
      abilities: [{ name: 'Strength', miscBonus: 0 }],
    };

    applyFeatBuffsToFormData(formData, []);

    expect(resetMiscBonuses).toHaveBeenCalledWith(formData.abilities);
  });

  it('should not add feature if name already exists in specialActions', () => {
    const formData = {
      rules: '2024',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', miscBonus: 0 }],
      specialActions: [
        { name: 'Cantrip', description: 'Old cantrip', type: 'spell' },
      ],
    };

    findFeat.mockReturnValue({
      benefits: [{ type: 'spell', name: 'Cantrip', description: 'New cantrip' }],
    });

    applyFeatBuffsToFormData(formData, []);

    // Should not add a duplicate
    expect(formData.specialActions).toHaveLength(1);
  });

  it('should use type "passive" when feature has no type', () => {
    const formData = {
      rules: '5e',
      feats: ['Tough'],
      abilities: [{ name: 'Strength', miscBonus: 0 }],
    };

    findFeat.mockReturnValue({
      benefits: ['You can cast detect magic at will'],
    });

    const buffs = applyFeatBuffsToFormData(formData, []);

    expect(buffs.features).toHaveLength(1);
    expect(buffs.features[0].type).toBe('passive');
    expect(formData.specialActions).toEqual([
      {
        name: 'Passive Benefit',
        description: 'You can cast detect magic at will',
        type: 'passive',
        source: 'feat',
      },
    ]);
  });
});

describe('clearAppliedFeatBuffs', () => {
  it('should call resetMiscBonuses with formData.abilities', () => {
    const formData = {
      abilities: [{ name: 'Strength', miscBonus: 5 }],
    };

    clearAppliedFeatBuffs(formData);

    expect(resetMiscBonuses).toHaveBeenCalledWith(formData.abilities);
  });

  it('should handle formData with no abilities property', () => {
    const formData = {};

    clearAppliedFeatBuffs(formData);

    expect(resetMiscBonuses).toHaveBeenCalledWith(undefined);
  });

  it('should throw when formData is null', () => {
    expect(() => clearAppliedFeatBuffs(null)).toThrow();
  });

  it('should call resetMiscBonuses with all abilities', () => {
    const formData = {
      abilities: [
        { name: 'Strength', miscBonus: 5 },
        { name: 'Dexterity', miscBonus: -2 },
        { name: 'Constitution', miscBonus: 3 },
      ],
    };

    clearAppliedFeatBuffs(formData);

    expect(resetMiscBonuses).toHaveBeenCalledWith(formData.abilities);
  });

  it('should not modify other properties on formData', () => {
    const formData = {
      abilities: [{ name: 'Strength', miscBonus: 5 }],
      name: 'Test Character',
      level: 5,
    };

    clearAppliedFeatBuffs(formData);

    expect(formData.name).toBe('Test Character');
    expect(formData.level).toBe(5);
  });

  it('should call resetMiscBonuses with abilities that have no miscBonus property', () => {
    const formData = {
      abilities: [{ name: 'Strength' }],
    };

    clearAppliedFeatBuffs(formData);

    expect(resetMiscBonuses).toHaveBeenCalledWith(formData.abilities);
  });
});
