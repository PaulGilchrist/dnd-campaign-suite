import { describe, it, expect, vi } from 'vitest';

vi.mock('../shared/featFinder.js', () => ({
  findFeat: vi.fn(),
}));

vi.mock('../shared/buffApplier.js', () => ({
  resetMiscBonuses: vi.fn(),
  applyAbilityScoreIncreases: vi.fn(),
  mergeDeduplicated: vi.fn(),
}));

import { computeFeatBuffs } from './featBuffService.js';

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

    it('should parse Skill Expert generic expertise as a proficiency choice with expertise', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'proficiency',
              name: 'Expertise',
              description: 'Choose one skill in which you have proficiency but lack Expertise. You gain Expertise with that skill.',
            },
          ],
        },
        '2024'
      );

      expect(result.proficiencies).toEqual([
        {
          name: 'Expertise',
          type: 'proficiency',
          isChoice: true,
          choose: 1,
          from: ['Acrobatics, Animal Handling, Arcana, Athletics, Deception, History, Insight, Intimidation, Investigation, Medicine, Nature, Perception, Performance, Persuasion, Religion, Sleight of Hand, Stealth, Survival'],
          grantsExpertise: true,
        },
      ]);
      expect(result.features).toHaveLength(0);
    });

    it('should parse Observant Keen Observer as a proficiency choice with expertise', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'proficiency',
              name: 'Keen Observer',
              description: 'Choose one of the following skills: Insight, Investigation, or Perception. If you lack proficiency with the chosen skill, you gain proficiency in it, and if you already have proficiency in it, you gain Expertise in it.',
            },
          ],
        },
        '2024'
      );

      expect(result.proficiencies).toEqual([
        {
          name: 'Keen Observer',
          type: 'proficiency',
          isChoice: true,
          choose: 1,
          from: ['Insight, Investigation, Perception'],
          grantsExpertise: true,
        },
      ]);
      expect(result.features).toHaveLength(0);
    });

    it('should parse Observant Quick Search as a bonus action feature', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'bonus_action',
              name: 'Quick Search',
              description: 'You can take the Search action as a Bonus Action.',
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Quick Search',
          description: 'You can take the Search action as a Bonus Action.',
          type: 'bonus_action',
          isBonusAction: true,
        },
      ]);
    });

    it('should parse Durable feat Speedy Recovery with self_healing automation', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              name: 'Ability Score Increase',
              description: 'Increase your Constitution score by 1, to a maximum of 20.',
              type: 'ability_score_increase',
            },
            {
              name: 'Defy Death',
              description: 'You have Advantage on Death Saving Throws.',
              type: 'passive',
              automation: {
                type: 'conditional_advantage',
                target: 'death_saving_throws',
                effect: 'advantage',
                casting_time: 'passive',
              },
            },
            {
              name: 'Speedy Recovery',
              description: 'As a Bonus Action, you can expend one of your Hit Point Dice, roll the die, and regain a number of Hit Points equal to the roll.',
              type: 'bonus_action',
              automation: {
                type: 'self_healing',
                action: 'bonus_action',
                hitDiceCost: 1,
                healExpression: 'hit_die_roll',
                casting_time: '1 bonus action',
              },
            },
          ],
          ability_score_increase: { scores: ['Constitution'], amount: 1, max_value: 20 },
        },
        '2024'
      );

      expect(result.features).toHaveLength(2);
      expect(result.features.find(f => f.name === 'Defy Death')).toEqual({
        name: 'Defy Death',
        description: 'You have Advantage on Death Saving Throws.',
        type: 'passive',
        automation: {
          type: 'conditional_advantage',
          target: 'death_saving_throws',
          effect: 'advantage',
          casting_time: 'passive',
        },
      });
      expect(result.features.find(f => f.name === 'Speedy Recovery')).toEqual({
        name: 'Speedy Recovery',
        description: 'As a Bonus Action, you can expend one of your Hit Point Dice, roll the die, and regain a number of Hit Points equal to the roll.',
        type: 'bonus_action',
        automation: {
          type: 'self_healing',
          action: 'bonus_action',
          hitDiceCost: 1,
          healExpression: 'hit_die_roll',
          casting_time: '1 bonus action',
        },
        isBonusAction: true,
      });
    });

    it('should parse all three Observant benefits together', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              name: 'Ability Score Increase',
              description: 'Increase your Intelligence or Wisdom score by 1, to a maximum of 20.',
              type: 'ability_score_increase',
            },
            {
              name: 'Keen Observer',
              description: 'Choose one of the following skills: Insight, Investigation, or Perception. If you lack proficiency with the chosen skill, you gain proficiency in it, and if you already have proficiency in it, you gain Expertise in it.',
              type: 'proficiency',
            },
            {
              name: 'Quick Search',
              description: 'You can take the Search action as a Bonus Action.',
              type: 'bonus_action',
            },
          ],
          ability_score_increase: { scores: ['Intelligence', 'Wisdom'], amount: 1, max_value: 20 },
        },
        '2024'
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Intelligence', amount: 1, isChoice: true, description: 'Increase your Intelligence or Wisdom score by 1, to a maximum of 20.' },
        { name: 'Wisdom', amount: 1, isChoice: true, description: 'Increase your Intelligence or Wisdom score by 1, to a maximum of 20.' },
      ]);
      expect(result.proficiencies).toEqual([
        {
          name: 'Keen Observer',
          type: 'proficiency',
          isChoice: true,
          choose: 1,
          from: ['Insight, Investigation, Perception'],
          grantsExpertise: true,
        },
      ]);
      expect(result.features).toEqual([
        {
          name: 'Quick Search',
          description: 'You can take the Search action as a Bonus Action.',
          type: 'bonus_action',
          isBonusAction: true,
        },
      ]);
    });

    it('should parse all three Skill Expert benefits together', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              name: 'Ability Score Increase',
              description: 'Increase one ability score of your choice by 1, to a maximum of 20.',
              type: 'ability_score_increase',
            },
            {
              name: 'Skill Proficiency',
              description: 'You gain proficiency in one skill of your choice.',
              type: 'proficiency',
            },
            {
              name: 'Expertise',
              description: 'Choose one skill in which you have proficiency but lack Expertise. You gain Expertise with that skill.',
              type: 'proficiency',
            },
          ],
          ability_score_increase: { scores: ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'], amount: 1, max_value: 20 },
        },
        '2024'
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'any', amount: [1], isChoice: true, description: 'Increase one ability score of your choice by 1, to a maximum of 20.' },
      ]);
      expect(result.proficiencies).toEqual([
        {
          name: 'Skill Proficiency',
          type: 'proficiency',
          isChoice: true,
          choose: 1,
          from: ['skill'],
        },
        {
          name: 'Expertise',
          type: 'proficiency',
          isChoice: true,
          choose: 1,
          from: ['Acrobatics, Animal Handling, Arcana, Athletics, Deception, History, Insight, Intimidation, Investigation, Medicine, Nature, Perception, Performance, Persuasion, Religion, Sleight of Hand, Stealth, Survival'],
          grantsExpertise: true,
        },
      ]);
      expect(result.features).toHaveLength(0);
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

    it('should parse weapon proficiency from Martial Weapon Training feat', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Weapon Proficiency', description: 'You gain proficiency with Martial weapons.' },
          ],
        },
        '2024'
      );

      expect(result.proficiencies).toEqual([
        { name: 'Martial Weapons', type: 'proficiency' },
      ]);
    });

    it('should parse weapon proficiency from simple weapons', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Weapon Proficiency', description: 'You gain proficiency with Simple weapons.' },
          ],
        },
        '2024'
      );

      expect(result.proficiencies).toEqual([
        { name: 'Simple Weapons', type: 'proficiency' },
      ]);
    });

    it('should fall through to benefit name for non-weapon proficiencies', () => {
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

    it('should parse armor training from Heavily Armored feat', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Armor Training', description: 'You gain training with Heavy armor.' },
          ],
        },
        '2024'
      );

      expect(result.proficiencies).toEqual([
        { name: 'Heavy Armor', type: 'proficiency' },
      ]);
    });

    it('should parse armor training with shields from Lightly Armored feat', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Armor Training', description: 'You gain training with Light armor and Shields.' },
          ],
        },
        '2024'
      );

      expect(result.proficiencies).toEqual([
        { name: 'Light Armor', type: 'proficiency' },
        { name: 'Shields', type: 'proficiency' },
      ]);
    });

    it('should parse armor training from Moderately Armored feat (medium armor only, no shields)', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Armor Training', description: 'You gain training with Medium armor.' },
          ],
        },
        '2024'
      );

      expect(result.proficiencies).toEqual([
        { name: 'Medium Armor', type: 'proficiency' },
      ]);
    });

    it('should parse proficiency choice from Crafter feat', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Tool Proficiency', description: 'You gain proficiency with three different Artisan\'s Tools of your choice from the Fast Crafting table.' },
          ],
        },
        '2024'
      );

      expect(result.proficiencies).toEqual([
        {
          name: 'Tool Proficiency',
          type: 'proficiency',
          isChoice: true,
          choose: 3,
          from: ["Artisan's Tools"],
        },
      ]);
    });

    it('should parse Skilled feat proficiency choice (three skills or tools)', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Proficiency', description: 'You gain proficiency in any combination of three skills or tools of your choice.' },
          ],
        },
        '2024'
      );

      expect(result.proficiencies).toEqual([
        {
          name: 'Proficiency',
          type: 'proficiency',
          isChoice: true,
          choose: 3,
          from: ['skills or tools'],
        },
      ]);
    });

    it('should parse a proficiency choice with "different" keyword', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Tool Proficiency', description: 'You gain proficiency with two different weapons of your choice.' },
          ],
        },
        '2024'
      );

      expect(result.proficiencies).toEqual([
        {
          name: 'Tool Proficiency',
          type: 'proficiency',
          isChoice: true,
          choose: 2,
          from: ['weapons'],
        },
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

    it('should parse Poisoner feat with ignore_resistance automation and proficiency', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              name: 'Ability Score Increase',
              description: 'Increase your Dexterity or Intelligence score by 1, to a maximum of 20.',
              type: 'ability_score_increase',
            },
            {
              name: 'Potent Poison',
              description: 'When you make a damage roll that deals Poison damage, it ignores Resistance to Poison damage.',
              type: 'passive',
              automation: {
                type: 'ignore_resistance',
                damageTypes: ['Poison'],
              },
            },
            {
              name: 'Brew Poison',
              description: "You gain proficiency with the Poisoner's Kit. With 1 hour of work using such a kit and expending 50 GP worth of materials, you can create a number of poison doses equal to your Proficiency Bonus.",
              type: 'bonus_action',
            },
          ],
          ability_score_increase: { scores: ['Dexterity', 'Intelligence'], amount: 1, max_value: 20 },
        },
        '2024'
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Dexterity', amount: 1, isChoice: true, description: 'Increase your Dexterity or Intelligence score by 1, to a maximum of 20.' },
        { name: 'Intelligence', amount: 1, isChoice: true, description: 'Increase your Dexterity or Intelligence score by 1, to a maximum of 20.' },
      ]);

      expect(result.proficiencies).toEqual([
        { name: "the Poisoner's Kit" },
      ]);

      expect(result.features).toHaveLength(2);
      expect(result.features[0].name).toBe('Potent Poison');
      expect(result.features[0].automation).toEqual({
        type: 'ignore_resistance',
        damageTypes: ['Poison'],
      });
      expect(result.features[1].name).toBe('Brew Poison');
      expect(result.features[1].isBonusAction).toBe(true);
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
