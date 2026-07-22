// @cleaned-by-ai
import { describe, it, expect } from 'vitest';

import { computeFeatBuffs } from './featBuffService.js';

describe('computeFeatBuffs', () => {
  describe('null/undefined/empty handling', () => {
    it('returns empty result when feat is null', () => {
      expect(computeFeatBuffs(null, '5e')).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('returns empty result when feat is undefined', () => {
      expect(computeFeatBuffs(undefined, '5e')).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('returns empty result when feat has no benefits property', () => {
      expect(computeFeatBuffs({}, '5e')).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('returns empty result when benefits is not an array', () => {
      expect(computeFeatBuffs({ benefits: 'not-an-array' }, '5e')).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('returns empty result when benefits is an empty array', () => {
      expect(computeFeatBuffs({ benefits: [] }, '5e')).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });
  });

  describe('5e ruleset — string benefit text parsing', () => {
    describe('ability score increases', () => {
      it('parses a single ability score increase', () => {
        const result = computeFeatBuffs(
          { benefits: ['Increase your Strength score by 2'] },
          '5e'
        );

        expect(result.abilityScoreIncreases).toEqual([
          { name: 'Strength', amount: 2, isChoice: false, max_value: 20 },
        ]);
        expect(result.proficiencies).toEqual([]);
        expect(result.resistances).toEqual([]);
        expect(result.features).toEqual([]);
      });

      it('parses case-insensitive ability score increase', () => {
        const result = computeFeatBuffs(
          { benefits: ['increase your intelligence score by 1'] },
          '5e'
        );

        expect(result.abilityScoreIncreases).toEqual([
          { name: 'intelligence', amount: 1, isChoice: false, max_value: 20 },
        ]);
      });

      it('parses an ability score increase with "or" as two choice entries', () => {
        const result = computeFeatBuffs(
          { benefits: ['Increase your Strength or Dexterity score by 1'] },
          '5e'
        );

        expect(result.abilityScoreIncreases).toEqual([
          { name: 'Strength', amount: 1, isChoice: true, max_value: 20 },
          { name: 'Dexterity', amount: 1, isChoice: true, max_value: 20 },
        ]);
      });

      it('parses a "choose one" ability score increase', () => {
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
            max_value: 20,
          },
        ]);
      });
    });

    describe('proficiencies', () => {
      it('parses a proficiency gain', () => {
        const result = computeFeatBuffs(
          { benefits: ['You gain proficiency with heavy armor'] },
          '5e'
        );

        expect(result.proficiencies).toEqual([
          { name: 'heavy armor' },
        ]);
      });

      it('parses a proficiency choice', () => {
        const result = computeFeatBuffs(
          { benefits: ['You gain proficiency in any combination of two skills of your choice'] },
          '5e'
        );

        expect(result.proficiencies).toEqual([
          { name: 'two skills', isChoice: true },
        ]);
      });
    });

    describe('features (speed, initiative, HP, language, resistance)', () => {
      it('parses a speed increase', () => {
        const result = computeFeatBuffs(
          { benefits: ['Your speed increases by 10 feet'] },
          '5e'
        );

        expect(result.features).toEqual([
          { name: 'Speed Bonus', description: 'Your speed increases by 10 feet', type: 'speed', value: 10 },
        ]);
      });

      it('parses an initiative bonus', () => {
        const result = computeFeatBuffs(
          { benefits: ['You gain a +5 bonus to initiative'] },
          '5e'
        );

        expect(result.features).toEqual([
          { name: 'Initiative Bonus', description: 'You gain a +5 bonus to initiative', type: 'initiative', value: 5 },
        ]);
      });

      it('parses an HP per level bonus', () => {
        const result = computeFeatBuffs(
          { benefits: ['your hit point maximum increases by an additional 2 hit points'] },
          '5e'
        );

        expect(result.features).toEqual([
          { name: 'Hit Point Bonus', description: 'your hit point maximum increases by an additional 2 hit points', type: 'hp_per_level', value: 2 },
        ]);
      });

      it('parses a flat HP bonus', () => {
        const result = computeFeatBuffs(
          { benefits: ['Your hit point maximum increases by 10'] },
          '5e'
        );

        expect(result.features).toEqual([
          { name: 'Hit Point Bonus', description: 'Your hit point maximum increases by 10', type: 'hp_flat', value: 10 },
        ]);
      });

      it('parses a language bonus', () => {
        const result = computeFeatBuffs(
          { benefits: ['You learn 2 languages of your choice'] },
          '5e'
        );

        expect(result.features).toEqual([
          { name: 'Language Bonus', description: 'You learn 2 languages of your choice', type: 'language', value: 2 },
        ]);
      });

      it('parses a resistance with "have" wording', () => {
        const result = computeFeatBuffs(
          { benefits: ['You have resistance to fire'] },
          '5e'
        );

        expect(result.resistances).toEqual(['fire']);
      });

      it('parses a resistance with "gain" wording', () => {
        const result = computeFeatBuffs(
          { benefits: ['You gain resistance to cold'] },
          '5e'
        );

        expect(result.resistances).toEqual(['cold']);
      });
    });

    describe('fallback and filtering', () => {
      it('classifies unrecognized benefit text as a passive feature', () => {
        const result = computeFeatBuffs(
          { benefits: ['You can cast detect magic at will'] },
          '5e'
        );

        expect(result.features).toEqual([
          { name: 'Passive Benefit', description: 'You can cast detect magic at will', type: 'passive' },
        ]);
      });

      it('skips non-string benefit entries', () => {
        const result = computeFeatBuffs(
          { benefits: ['Increase your Strength score by 2', null, 42, {}] },
          '5e'
        );

        expect(result.abilityScoreIncreases).toEqual([
          { name: 'Strength', amount: 2, isChoice: false, max_value: 20 },
        ]);
      });

      it('aggregates multiple benefits from a single feat', () => {
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
          { name: 'Strength', amount: 2, isChoice: false, max_value: 20 },
        ]);
        expect(result.proficiencies).toEqual([
          { name: 'heavy armor' },
        ]);
        expect(result.features).toEqual([
          { name: 'Speed Bonus', description: 'Your speed increases by 10 feet', type: 'speed', value: 10 },
        ]);
      });
    });
  });

  describe('2024 ruleset — structured benefit objects', () => {
    describe('ability_score_increase', () => {
      it('parses a single ability_score_increase with one score', () => {
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
          { name: 'Strength', amount: 1, isChoice: false, description: '+1 to an ability', max_value: 20 },
        ]);
      });

      it('parses a single ability_score_increase with two scores as a choice', () => {
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
          { name: 'any', amount: 1, isChoice: true, scores: ['Strength', 'Constitution'], description: '+1 to two abilities', max_value: 20 },
        ]);
      });

      it('parses an ability_score_increase with more than 2 scores', () => {
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
          { name: 'any', amount: [1], isChoice: true, description: 'Choose any ability', max_value: 20 },
        ]);
      });

      it('parses a variable amount ability_score_increase', () => {
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
          { name: 'any', amount: [1, 2], isChoice: true, description: 'Variable ASI', max_value: 20 },
        ]);
      });

      it('defaults amount to 1 when not a number', () => {
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

      it('handles array amount with more than 2 scores', () => {
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
          { name: 'any', amount: [1, 2], isChoice: true, description: 'Multi ASI', max_value: 20 },
        ]);
      });
    });

    describe('proficiency', () => {
      it('parses a proficiency benefit with "all skills"', () => {
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

      it('parses a generic proficiency benefit', () => {
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

      it('parses weapon proficiency from Martial Weapon Training', () => {
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

      it('parses weapon proficiency from Simple weapons', () => {
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

      it('parses armor training from Heavily Armored', () => {
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

      it('parses armor training with shields from Lightly Armored', () => {
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

      it('parses armor training for medium armor without shields', () => {
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

      it('parses Expertise keyword as a feature when no skill list is found', () => {
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

      it('parses Skill Expert generic expertise as a proficiency choice with expertise', () => {
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

      it('parses Observant Keen Observer as a proficiency choice with expertise', () => {
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

      it('parses a proficiency choice with a count from Crafter feat', () => {
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

      it('parses Skilled feat proficiency choice (three skills or tools)', () => {
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

      it('parses a proficiency choice with "different" keyword', () => {
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
    });

    describe('bonus_action', () => {
      it('parses Observant Quick Search as a bonus action feature', () => {
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

      it('parses Durable feat Speedy Recovery with self_healing automation', () => {
        const result = computeFeatBuffs(
          {
            benefits: [
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
          },
          '2024'
        );

        expect(result.features).toEqual([
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
            isBonusAction: true,
          },
        ]);
      });

      it('extracts tool proficiency from bonus_action description with tool proficiency pattern', () => {
        const result = computeFeatBuffs(
          {
            benefits: [
              {
                type: 'bonus_action',
                name: 'Brew Poison',
                description: "You gain proficiency with the Poisoner's Kit. With 1 hour of work using such a kit and expending 50 GP worth of materials, you can create a number of poison doses equal to your Proficiency Bonus.",
              },
            ],
          },
          '2024'
        );

        expect(result.proficiencies).toEqual([
          { name: "the Poisoner's Kit" },
        ]);
        expect(result.features).toEqual([
          {
            name: 'Brew Poison',
            description: "You gain proficiency with the Poisoner's Kit. With 1 hour of work using such a kit and expending 50 GP worth of materials, you can create a number of poison doses equal to your Proficiency Bonus.",
            type: 'bonus_action',
            isBonusAction: true,
          },
        ]);
      });
    });

    describe('passive with automation', () => {
      it('parses Defy Death as a passive with conditional_advantage automation', () => {
        const result = computeFeatBuffs(
          {
            benefits: [
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
            ],
          },
          '2024'
        );

        expect(result.features).toEqual([
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
        ]);
      });

      it('parses Poisoner feat with ignore_resistance automation and proficiency', () => {
        const result = computeFeatBuffs(
          {
            benefits: [
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
          },
          '2024'
        );

        expect(result.features).toHaveLength(2);
        expect(result.features.find(f => f.name === 'Potent Poison').automation).toEqual({
          type: 'ignore_resistance',
          damageTypes: ['Poison'],
        });
        expect(result.features.find(f => f.name === 'Brew Poison').isBonusAction).toBe(true);
      });
    });

    describe('spell', () => {
      it('parses a default benefit type as a feature', () => {
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
    });

    describe('filtering and aggregation', () => {
      it('skips benefits without a type property', () => {
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

      it('aggregates benefits from multiple benefit objects', () => {
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

      it('parses all three Observant benefits together', () => {
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
          { name: 'any', amount: 1, isChoice: true, scores: ['Intelligence', 'Wisdom'], description: 'Increase your Intelligence or Wisdom score by 1, to a maximum of 20.', max_value: 20 },
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

      it('parses all three Skill Expert benefits together', () => {
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
          { name: 'any', amount: [1], isChoice: true, description: 'Increase one ability score of your choice by 1, to a maximum of 20.', max_value: 20 },
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

      it('parses a complete feat with ASI, passive automation, and bonus action automation', () => {
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

        expect(result.abilityScoreIncreases).toEqual([
          { name: 'Constitution', amount: 1, isChoice: false, description: 'Increase your Constitution score by 1, to a maximum of 20.', max_value: 20 },
        ]);
        expect(result.features).toHaveLength(2);
        expect(result.features.find(f => f.name === 'Defy Death').automation).toEqual({
          type: 'conditional_advantage',
          target: 'death_saving_throws',
          effect: 'advantage',
          casting_time: 'passive',
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
    });
  });

});
