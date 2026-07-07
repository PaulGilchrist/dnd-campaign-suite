// @cleaned-by-ai
import { describe, it, expect } from 'vitest';

import rules from '../rules.js';

describe('rules - missing array error handling', () => {
  describe('getPlayerStats array validation', () => {
    it.each`
      traits       | description
      ${null}      | ${'null'}
      ${undefined} | ${'undefined'}
    `('should throw when race.traits is $description', async ({ traits }) => {
      const playerSummary = {
        name: 'TestCharacter',
        level: 1,
        rules: '5e',
        class: { name: 'Fighter', saving_throws: [], languages: [], fightingStyles: [], proficiencies: [], class_levels: [{}], subclass: {}, major: {} },
        race: { name: 'Human', languages: ['Common'], traits },
        languages: [],
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 13, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 12, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
        inventory: { equipped: [], magicItems: [] },
        skillProficiencies: [], expertise: [], actions: [], bonusActions: [], reactions: [], specialActions: [], activeBuffs: [],
      };
      await expect(rules.getPlayerStats([], [], [], [], [], playerSummary)).rejects.toThrow('Missing array: race.traits');
    });


  });

  describe('getActions array validation', () => {
    it.each`
      field
      ${'actions'}
      ${'bonusActions'}
      ${'reactions'}
      ${'specialActions'}
    `('should throw when $field is null', ({ field }) => {
      const playerStats = {
        name: 'TestCharacter',
        rules: '5e',
        class: { name: 'Fighter', fightingStyles: [], languages: [], proficiencies: [], class_levels: [{}], subclass: { class_levels: [] }, major: {} },
        race: { name: 'Human', languages: ['Common'], traits: [] },
        languages: [],
        actions: [],
        bonusActions: [],
        reactions: [],
        specialActions: [],
      };
      playerStats[field] = null;

      expect(() => rules.getActions(playerStats, {})).toThrow(`Missing array: ${field} for TestCharacter`);
    });
  });

  describe('getLanguages array validation', () => {
    it.each`
      field
      ${'race.languages'}
      ${'subrace.languages'}
    `('should throw when $field is null', ({ field }) => {
      const stats = {
        name: 'TestCharacter',
        race: { languages: ['Common'], subrace: { languages: ['Elvish'], language_options: { choose: 0 } } },
        class: { languages: ['Common'] },
        languages: [],
      };

      if (field === 'race.languages') {
        stats.race.languages = null;
      } else if (field === 'subrace.languages') {
        stats.race.subrace.languages = null;
      }

      expect(() => rules.getLanguages(stats, {})).toThrow(`Missing array: ${field} for TestCharacter`);
    });
  });

  describe('getMagicItems array validation', () => {
    it('should throw when inventory.magicItems is null', () => {
      expect(() => rules.getMagicItems([], { inventory: { magicItems: null } })).toThrow('Missing array: inventory.magicItems');
    });
  });
});
