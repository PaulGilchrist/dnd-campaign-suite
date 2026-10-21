// @maintained-by-ai
import { describe, it, expect } from 'vitest';

import rules from '../rules.js';

// Error-handling contract for the rules facade: missing/null arrays must throw
// (or reject, for the async orchestrator) with 'Missing array: <path> for <name>'.
// Sync per-field guards for getLanguages/getMagicItems live in rules.helpers.test.js;
// this file owns the getPlayerStats propagation face and the getActions null-face
// table (cited by #1248).

describe('rules facade - missing array validation', () => {
  it('getPlayerStats rejects with the guard message when race.traits is null', async () => {
    const playerSummary = {
      name: 'TestCharacter',
      level: 1,
      rules: '5e',
      class: { name: 'Fighter', saving_throws: [], languages: [], fightingStyles: [], proficiencies: [], class_levels: [{}], subclass: {}, major: {} },
      race: { name: 'Human', languages: ['Common'], traits: null },
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

    await expect(
      rules.getPlayerStats({ allClasses: [], allEquipment: [], allMagicItems: [], allRaces: [], allSpells: [], playerSummary })
    ).rejects.toThrow('Missing array: race.traits for TestCharacter');
  });

  describe('getActions array validation', () => {
    it.each`
      field
      ${'actions'}
      ${'bonusActions'}
      ${'reactions'}
      ${'specialActions'}
    `('throws when $field is null', ({ field }) => {
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
});
