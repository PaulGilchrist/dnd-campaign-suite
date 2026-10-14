import { describe, it, expect } from 'vitest';

import { computeFeatBuffs } from './featBuffService.js';

describe('computeFeatBuffs — 2024 ruleset', () => {
  describe('null/undefined/empty handling', () => {
    it('returns empty result when feat is null', () => {
      const result = computeFeatBuffs(null, '2024');
      expect(result).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('returns empty result when feat is undefined', () => {
      const result = computeFeatBuffs(undefined, '2024');
      expect(result).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('returns empty result when feat has no benefits property', () => {
      const result = computeFeatBuffs({}, '2024');
      expect(result).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('returns empty result when benefits is not an array', () => {
      const result = computeFeatBuffs({ benefits: 'not-an-array' }, '2024');
      expect(result).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });

    it('returns empty result when benefits is an empty array', () => {
      const result = computeFeatBuffs({ benefits: [] }, '2024');
      expect(result).toEqual({
        abilityScoreIncreases: [],
        proficiencies: [],
        resistances: [],
        features: [],
      });
    });
  });

  describe('ability_score_increase parsing', () => {
    it('recognizes a single-score ability score increase as non-choice', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'ability_score_increase', description: '+1 to Strength' },
          ],
          ability_score_increase: { scores: ['Strength'], amount: 1 },
        },
        '2024'
      );

      expect(result.abilityScoreIncreases).toEqual([
        { name: 'Strength', amount: 1, isChoice: false, description: '+1 to Strength', max_value: 20 },
      ]);
      expect(result.proficiencies).toEqual([]);
      expect(result.features).toEqual([]);
    });

    it('recognizes a two-score ability score increase as a choice with scores array', () => {
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

    it('recognizes a multi-score ability score increase (>2) as a choice with array amount', () => {
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

    it('recognizes a variable-amount ability score increase as a choice with range', () => {
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

    it('defaults amount to 1 when non-numeric for single-score case', () => {
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

    it('defaults amount to 1 when non-numeric for two-score case', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'ability_score_increase', description: '+? STR/DEX' },
          ],
          ability_score_increase: { scores: ['Strength', 'Dexterity'], amount: 'unknown' },
        },
        '2024'
      );

      expect(result.abilityScoreIncreases[0].amount).toBe(1);
    });

    it('recognizes multi-score with array amount as a choice', () => {
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

    it('respects custom max_value from ability_score_increase config', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'ability_score_increase', description: '+1 STR to 30' },
          ],
          ability_score_increase: { scores: ['Strength'], amount: 1, max_value: 30 },
        },
        '2024'
      );

      expect(result.abilityScoreIncreases[0].max_value).toBe(30);
    });
  });

  describe('proficiency parsing', () => {
    it('recognizes all skills proficiency as a special skill entry', () => {
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
      expect(result.features).toEqual([]);
    });

    it('recognizes improvised weapon proficiency', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Improvised', description: 'You gain proficiency with improvised weapons' },
          ],
        },
        '2024'
      );

      expect(result.proficiencies).toEqual([
        { name: 'Improvised Weapons', type: 'proficiency' },
      ]);
    });

    it('recognizes generic proficiency when no special pattern matches', () => {
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

    it('recognizes weapon proficiencies from Martial and Simple keywords', () => {
      const martialResult = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Weapon Proficiency', description: 'You gain proficiency with Martial weapons.' },
          ],
        },
        '2024'
      );

      expect(martialResult.proficiencies).toEqual([
        { name: 'Martial Weapons', type: 'proficiency' },
      ]);

      const simpleResult = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Weapon Proficiency', description: 'You gain proficiency with Simple weapons.' },
          ],
        },
        '2024'
      );

      expect(simpleResult.proficiencies).toEqual([
        { name: 'Simple Weapons', type: 'proficiency' },
      ]);
    });

    it('recognizes armor training with and without shields', () => {
      const heavyResult = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Armor Training', description: 'You gain training with Heavy armor.' },
          ],
        },
        '2024'
      );

      expect(heavyResult.proficiencies).toEqual([
        { name: 'Heavy Armor', type: 'proficiency' },
      ]);

      const lightShieldsResult = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Armor Training', description: 'You gain training with Light armor and Shields.' },
          ],
        },
        '2024'
      );

      expect(lightShieldsResult.proficiencies).toEqual([
        { name: 'Light Armor', type: 'proficiency' },
        { name: 'Shields', type: 'proficiency' },
      ]);
    });

    it('recognizes expertise with a specific skill list as a proficiency choice with expertise', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'proficiency',
              name: 'Keen Observer',
              description: 'Choose one of the following skills: Insight, Investigation, or Perception. If you already have proficiency in it, you gain Expertise in it.',
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

    it('recognizes generic expertise as a feature when no skill list is found', () => {
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

    it('recognizes expertise with broad skill selection as a proficiency choice with expertise', () => {
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

    it('recognizes proficiency choices with numeric counts and from lists', () => {
      const crafterResult = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Tool Proficiency', description: 'You gain proficiency with three different Artisan\'s Tools of your choice from the Fast Crafting table.' },
          ],
        },
        '2024'
      );

      expect(crafterResult.proficiencies).toEqual([
        {
          name: 'Tool Proficiency',
          type: 'proficiency',
          isChoice: true,
          choose: 3,
          from: ["Artisan's Tools"],
        },
      ]);

      const skilledResult = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Proficiency', description: 'You gain proficiency in any combination of three skills or tools of your choice.' },
          ],
        },
        '2024'
      );

      expect(skilledResult.proficiencies).toEqual([
        {
          name: 'Proficiency',
          type: 'proficiency',
          isChoice: true,
          choose: 3,
          from: ['skills or tools'],
        },
      ]);

      const weaponResult = computeFeatBuffs(
        {
          benefits: [
            { type: 'proficiency', name: 'Tool Proficiency', description: 'You gain proficiency with two different weapons of your choice.' },
          ],
        },
        '2024'
      );

      expect(weaponResult.proficiencies).toEqual([
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

  describe('resistance benefit parsing', () => {
    it('recognizes resistance with validTypes as a resistance_choice feature', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'resistance',
              name: 'Elemental Resist',
              description: 'Choose a damage type',
              automation: {
                validTypes: ['fire', 'cold', 'lightning'],
                resistanceType: ['player_choice_fire_from_list'],
              },
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Elemental Resist',
          description: 'Choose a damage type',
          type: 'resistance_choice',
          automation: {
            validTypes: ['fire', 'cold', 'lightning'],
            resistanceType: ['player_choice_fire_from_list'],
            count: 2,
          },
        },
      ]);
    });

    it('recognizes resistance with empty validTypes as a plain resistance feature', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'resistance',
              name: 'Poison Resist',
              description: 'Resistance to poison',
              automation: {
                validTypes: [],
                resistanceType: ['fixed'],
              },
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Poison Resist',
          description: 'Resistance to poison',
          type: 'resistance',
          automation: {
            validTypes: [],
            resistanceType: ['fixed'],
          },
        },
      ]);
    });

    it('recognizes resistance without automation as a plain resistance feature', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'resistance',
              name: 'Poison Resist',
              description: 'Resistance to poison',
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Poison Resist',
          description: 'Resistance to poison',
          type: 'resistance',
        },
      ]);
    });
  });

  describe('saving_throw benefit parsing', () => {
    it('recognizes saving_throw benefit with automation', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'saving_throw',
              name: 'Resilient',
              description: 'Saving throw proficiency',
              automation: { type: 'saving_throw_proficiency', saveType: 'Constitution' },
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Resilient',
          description: 'Saving throw proficiency',
          type: 'saving_throw',
          automation: { type: 'saving_throw_proficiency', saveType: 'Constitution' },
        },
      ]);
    });

    it('skips saving_throw benefit without automation', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'saving_throw',
              name: 'Resilient',
              description: 'Saving throw proficiency',
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([]);
    });
  });

  describe('damage benefit parsing', () => {
    it('recognizes Savage Attacker with reroll_damage_once_per_turn automation', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'damage',
              name: 'Savage Attacker',
              description: 'Reroll damage once per turn',
              automation: { type: 'reroll_damage_once_per_turn' },
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Savage Attacker',
          description: 'Reroll damage once per turn',
          type: 'reroll_damage_once_per_turn',
          automation: { type: 'reroll_damage_once_per_turn' },
        },
      ]);
    });

    it('recognizes Great Weapon Fighting by name', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'damage',
              name: 'Great Weapon Fighting',
              description: 'Damage reroll',
              automation: { type: 'great_weapon_fighting' },
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Great Weapon Fighting',
          description: 'Damage reroll',
          type: 'great_weapon_fighting',
          automation: { type: 'great_weapon_fighting' },
        },
      ]);
    });

    it('recognizes Enhanced Unarmed Strike by name', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'damage',
              name: 'Enhanced Unarmed Strike',
              description: 'Improved unarmed damage',
              automation: { type: 'enhanced_unarmed', damage: '1d6' },
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Enhanced Unarmed Strike',
          description: 'Improved unarmed damage',
          type: 'damage',
          automation: { type: 'enhanced_unarmed', damage: '1d6' },
        },
      ]);
    });

    it('recognizes Extra Attack Damage as Two Weapon Fighting', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'damage',
              name: 'Extra Attack Damage',
              description: 'Bonus attack damage',
              automation: { type: 'two_weapon_fighting' },
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Two Weapon Fighting',
          description: 'Bonus attack damage',
          type: 'two_weapon_fighting',
          automation: { type: 'two_weapon_fighting' },
        },
      ]);
    });

    it('recognizes Dual Wielding as two_weapon_fighting', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'damage',
              name: 'Dual Wielding',
              description: 'Off-hand attack bonus',
              automation: { type: 'dual_wielding' },
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Dual Wielding',
          description: 'Off-hand attack bonus',
          type: 'two_weapon_fighting',
          automation: { type: 'two_weapon_fighting' },
        },
      ]);
    });

    it('passes through unknown damage type as a feature with its automation', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'damage',
              name: 'Unknown Damage',
              description: 'Some unknown damage benefit',
              automation: { custom: true },
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Unknown Damage',
          description: 'Some unknown damage benefit',
          type: 'damage',
          automation: { custom: true },
        },
      ]);
    });
  });

  describe('spell benefit parsing', () => {
    it('recognizes free_spell automation type', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'spell',
              name: 'Level 1 Spell',
              description: 'Free spell benefit',
              automation: { type: 'free_spell' },
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Level 1 Spell',
          description: 'Free spell benefit',
          type: 'free_spell',
          automation: { type: 'free_spell' },
        },
      ]);
    });

    it('recognizes level 1 spell mention with automation as free_spell', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'spell',
              name: 'Level 1 Spell',
              description: 'Spell benefit',
              automation: { type: 'some_spell' },
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Level 1 Spell',
          description: 'Spell benefit',
          type: 'free_spell',
          automation: { type: 'some_spell' },
        },
      ]);
    });

    it('recognizes Minor Telekinesis with custom automation', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'spell',
              name: 'Minor Telekinesis',
              description: 'You learn the Mage Hand spell. You can cast it without Verbal or Somatic components, you can make the spectral hand invisible, and its range and the distance it can be away from you both increase by 30 feet when you cast it. The spell\'s spellcasting ability is the ability increased by this feat.',
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Minor Telekinesis',
          description: 'You learn the Mage Hand spell. You can cast it without Verbal or Somatic components, you can make the spectral hand invisible, and its range and the distance it can be away from you both increase by 30 feet when you cast it. The spell\'s spellcasting ability is the ability increased by this feat.',
          type: 'spell',
          automation: {
            type: 'minor_telekinesis_spell',
            spell: 'Mage Hand',
          },
        },
      ]);
    });

    it('passes through generic spell benefit with automation', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'spell',
              name: 'Custom Spell',
              description: 'Spell benefit',
              automation: { type: 'spell' },
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Custom Spell',
          description: 'Spell benefit',
          type: 'spell',
          automation: { type: 'spell' },
        },
      ]);
    });
  });

  describe('bonus_action benefit parsing', () => {
    it('recognizes bonus_action as a feature with isBonusAction flag', () => {
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

    it('recognizes bonus_action with self_healing automation', () => {
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

    it('extracts tool proficiency from bonus_action description', () => {
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

  describe('passive benefit parsing', () => {
    it('recognizes passive with conditional_advantage automation', () => {
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

    it('recognizes passive with ignore_resistance automation', () => {
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
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Potent Poison',
          description: 'When you make a damage roll that deals Poison damage, it ignores Resistance to Poison damage.',
          type: 'passive',
          automation: {
            type: 'ignore_resistance',
            damageTypes: ['Poison'],
          },
        },
      ]);
    });
  });

  describe('default/fallback handling', () => {
    it('recognizes unknown benefit type as a feature with its type', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'unknown_type',
              name: 'Unknown Feat',
              description: 'Some unknown benefit',
              automation: { custom: true },
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Unknown Feat',
          description: 'Some unknown benefit',
          type: 'unknown_type',
          automation: { custom: true },
        },
      ]);
    });

    it('recognizes Savage Strike name as reroll_damage_once_per_turn', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'action',
              name: 'Savage Strike',
              description: 'Extra damage on strike',
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Savage Attacker',
          description: 'Extra damage on strike',
          type: 'reroll_damage_once_per_turn',
          automation: { type: 'reroll_damage_once_per_turn' },
        },
      ]);
    });

    it('recognizes Tavern Brawler damage reroll', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'action',
              name: 'Tavern Brawler Damage Reroll',
              description: 'Reroll 1s on damage',
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Tavern Brawler Damage Reroll',
          description: 'Reroll 1s on damage',
          type: 'passive',
          automation: { type: 'tavern_brawler_reroll_ones' },
        },
      ]);
    });

    it('recognizes Tavern Brawler push', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'action',
              name: 'Tavern Brawler Push',
              description: 'Push creature',
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Tavern Brawler Push',
          description: 'Push creature',
          type: 'action',
          automation: { type: 'tavern_brawler_push', oncePerTurn: true },
        },
      ]);
    });

    it('recognizes weapon_mastery_choice automation', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'action',
              name: 'Mastery Property',
              description: 'Weapon mastery',
              automation: { type: 'weapon_mastery_choice' },
            },
          ],
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Mastery Property',
          description: 'Weapon mastery',
          type: 'passive',
          automation: { type: 'weapon_mastery_choice' },
        },
      ]);
    });

    it('falls back to feat-level automation when benefit has none', () => {
      const result = computeFeatBuffs(
        {
          benefits: [
            {
              type: 'passive',
              name: 'Custom Passive',
              description: 'A passive benefit',
            },
          ],
          automation: { type: 'custom_feat_automation' },
        },
        '2024'
      );

      expect(result.features).toEqual([
        {
          name: 'Custom Passive',
          description: 'A passive benefit',
          type: 'passive',
          automation: { type: 'custom_feat_automation' },
        },
      ]);
    });
  });

  describe('filtering and aggregation', () => {
    it('skips null and non-object benefit entries', () => {
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
      expect(result.proficiencies).toEqual([]);
      expect(result.features).toEqual([]);
    });

    it('aggregates benefits from multiple benefit objects in a single feat', () => {
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
