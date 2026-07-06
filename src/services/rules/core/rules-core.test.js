// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../character/classRules.js', () => ({
  default: {
    getClass: vi.fn(),
    getFeatures: vi.fn(),
    getHighestSubclassLevel: vi.fn(),
  },
}));

vi.mock('../../character/race-rules/index.js', () => ({
  rules5e: {
    getRace: vi.fn(),
    getRacialBonus: vi.fn(),
    getImmunities: vi.fn(),
    getResistances: vi.fn(),
    getSenses: vi.fn(),
    getTraits: vi.fn(),
  },
  rules2024: {
    getRace: vi.fn(),
    getSenses: vi.fn(),
    getTraits: vi.fn(),
  },
}));

vi.mock('./abilityCalc2024.js', () => ({
  getAbilities: vi.fn(),
  getHitPoints: vi.fn(),
  getCarryingCapacity: vi.fn(),
}));

vi.mock('./attackCalc2024.js', () => ({
  getAttacks: vi.fn(),
}));

vi.mock('./spellCalc2024.js', () => ({
  getSpellAbilities: vi.fn(),
}));

vi.mock('../../character/proficiencyUtils2024.js', () => ({
  getProficiencyChoiceCount: vi.fn(),
  getProficiencies: vi.fn(),
}));

vi.mock('../../character/classRules2024.js', () => ({
  default: {
    getClass: vi.fn(),
    getFeatures: vi.fn(),
    getHighestSubclassLevel: vi.fn(),
  },
}));

import rules from '../rules.js';
import { rules5e as raceRules } from '../../character/race-rules/index.js';
import * as dataLoader from '../../ui/dataLoader.js';

const makePlayerSummary = (overrides = {}) => ({
  level: 1,
  rules: '5e',
  class: { name: 'Fighter', saving_throws: [], languages: [], fightingStyles: [] },
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
  skillProficiencies: [],
  expertise: [],
  actions: [],
  bonusActions: [],
  reactions: [],
  specialActions: [],
  activeBuffs: [],
  ...overrides,
});

const defaultSkills = [
  { name: 'Athletics', ability: 'Strength' },
  { name: 'Stealth', ability: 'Dexterity' },
  { name: 'Acrobatics', ability: 'Dexterity' },
  { name: 'Arcana', ability: 'Intelligence' },
  { name: 'History', ability: 'Intelligence' },
  { name: 'Perception', ability: 'Wisdom' },
  { name: 'Insight', ability: 'Wisdom' },
  { name: 'Persuasion', ability: 'Charisma' },
  { name: 'Deception', ability: 'Charisma' },
];

describe('rules', () => {
  describe('getSpellMaxLevel', () => {
    it('should return null when all spell slots are zero', () => {
      const spellAbilities = {
        spell_slots_level_1: 0,
        spell_slots_level_2: 0,
      };

      expect(rules.getSpellMaxLevel(spellAbilities)).toBeNull();
    });

    it('should return the highest level with non-zero slots', () => {
      const spellAbilities = {
        spell_slots_level_1: 4,
        spell_slots_level_3: 3,
        spell_slots_level_9: 1,
      };

      expect(rules.getSpellMaxLevel(spellAbilities)).toBe(9);
    });

    it('should skip levels with null slot values', () => {
      const spellAbilities = {
        spell_slots_level_1: null,
        spell_slots_level_2: 2,
        spell_slots_level_3: null,
      };

      expect(rules.getSpellMaxLevel(spellAbilities)).toBe(2);
    });

    it('should handle non-contiguous level keys', () => {
      const spellAbilities = {
        spell_slots_level_1: 4,
        spell_slots_level_5: 2,
        spell_slots_level_9: 1,
      };

      expect(rules.getSpellMaxLevel(spellAbilities)).toBe(9);
    });

    it('should return null for null, undefined, or empty object input', () => {
      expect(rules.getSpellMaxLevel(null)).toBeNull();
      expect(rules.getSpellMaxLevel(undefined)).toBeNull();
      expect(rules.getSpellMaxLevel({})).toBeNull();
    });
  });

  describe('getSubModules', () => {
    it('should return 5e modules when rules is "5e"', () => {
      const modules = rules.getSubModules({ rules: '5e' });

      expect(modules.use2024).toBe(false);
    });

    it('should return 2024 modules when rules is "2024"', () => {
      const modules = rules.getSubModules({ rules: '2024' });

      expect(modules.use2024).toBe(true);
    });

    it('should prefer playerStats.rules over playerSummary.rules', () => {
      const modules = rules.getSubModules({ rules: '5e' }, { rules: '2024' });

      expect(modules.use2024).toBe(false);
    });

    it('should fall back to playerSummary.rules when playerStats lacks rules', () => {
      const modules = rules.getSubModules({ level: 1 }, { rules: '2024' });

      expect(modules.use2024).toBe(true);
    });
  });

  describe('getAbilities (5e)', () => {
    beforeEach(() => {
      vi.mocked(dataLoader.loadSkills).mockResolvedValue(defaultSkills);
      vi.mocked(dataLoader.loadPassiveSkills).mockResolvedValue(['Insight', 'Investigation', 'Perception']);
      raceRules.getRacialBonus.mockReturnValue(0);
    });

    it('should calculate totalScore from baseScore + featIncrease + miscIncrease + backgroundIncrease', async () => {
      const playerStats = makePlayerSummary({
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 2, miscIncrease: 1, backgroundIncrease: 1 },
        ],
        class: { name: 'Fighter', saving_throws: [] },
        skillProficiencies: [],
        expertise: [],
      });

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find((a) => a.name === 'Strength');

      expect(str.totalScore).toBe(19); // 15 + 2 + 1 + 1
      expect(str.bonus).toBe(4); // (19 - 10) / 2
    });

    it('should mark saving throw proficiencies from class', async () => {
      const playerStats = makePlayerSummary({
        level: 5,
        class: { name: 'Fighter', saving_throws: ['Strength', 'Constitution'] },
      });

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find((a) => a.name === 'Strength');
      const con = abilities.find((a) => a.name === 'Constitution');

      expect(str.proficient).toBe(true);
      expect(con.proficient).toBe(true);
      expect(str.save).toBe(str.bonus + 3);
      expect(con.save).toBe(con.bonus + 3);
    });

    it('should apply racial bonus from raceRules.getRacialBonus', async () => {
      raceRules.getRacialBonus.mockReturnValue(2);

      const playerStats = makePlayerSummary({
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      });

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find((a) => a.name === 'Strength');

      expect(str.totalScore).toBe(17); // 15 + 0 + 0 + 2 (racial)
    });

    it('should apply Barbarian Primal Champion bonus at level 20', async () => {
      const playerStats = makePlayerSummary({
        level: 20,
        class: { name: 'Barbarian', saving_throws: [] },
      });

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find((a) => a.name === 'Strength');
      const con = abilities.find((a) => a.name === 'Constitution');

      // Base 15 + 4 (Primal Champion) = 19, bonus = 4
      expect(str.totalScore).toBe(19);
      expect(str.bonus).toBe(4);
      // Base 13 + 4 = 17, bonus = 3
      expect(con.totalScore).toBe(17);
      expect(con.bonus).toBe(3);
    });

    it('should not apply Primal Champion before level 20', async () => {
      const playerStats = makePlayerSummary({
        level: 19,
        class: { name: 'Barbarian', saving_throws: [] },
      });

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find((a) => a.name === 'Strength');

      expect(str.totalScore).toBe(15);
      expect(str.bonus).toBe(2);
    });

    it('should calculate proficiency bonus based on level', async () => {
      // Level 1 -> floor((1-1)/4 + 2) = 2
      const playerStats = makePlayerSummary({ level: 1 });

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find((a) => a.name === 'Strength');
      // Strength is not a proficient save (class.saving_throws is []), so save = bonus only
      expect(str.save).toBe(str.bonus);
    });

    it('should apply proficiency bonus to proficient saves at level 1', async () => {
      const playerStats = makePlayerSummary({
        level: 1,
        class: { name: 'Fighter', saving_throws: ['Strength'] },
      });

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find((a) => a.name === 'Strength');
      // Level 1 proficiency = 2, str.bonus = 2, save = 2 + 2 = 4
      expect(str.proficient).toBe(true);
      expect(str.save).toBe(4);
    });

    it('should apply expertise bonus for double proficiency', async () => {
      const playerStats = makePlayerSummary({
        level: 5,
        class: { name: 'Rogue', saving_throws: [] },
        skillProficiencies: ['Stealth'],
        expertise: ['Stealth'],
      });

      const abilities = await rules.getAbilities(playerStats);
      const dex = abilities.find((a) => a.name === 'Dexterity');
      const stealth = dex.skills.find((s) => s.name === 'Stealth');
      const proficiency = Math.floor((5 - 1) / 4 + 2); // 3

      expect(stealth.bonus).toBe(dex.bonus + proficiency + proficiency);
    });

    it('should include skills from ability-scores.json data', async () => {
      const playerStats = makePlayerSummary({ level: 1 });

      const abilities = await rules.getAbilities(playerStats);
      const str = abilities.find((a) => a.name === 'Strength');

      expect(str.skills).toContainEqual(expect.objectContaining({ name: 'Athletics', ability: 'Strength' }));
    });

    it('should not crash with empty skills data', async () => {
      vi.mocked(dataLoader.loadSkills).mockResolvedValue([]);

      const playerStats = makePlayerSummary({ level: 1 });

      const abilities = await rules.getAbilities(playerStats);

      expect(abilities).toHaveLength(6);
      abilities.forEach((ability) => {
        expect(ability.skills).toEqual([]);
      });
    });

    it('should handle missing ability name gracefully', async () => {
      const playerStats = makePlayerSummary({
        abilities: [],
      });

      const abilities = await rules.getAbilities(playerStats);

      expect(abilities).toEqual([]);
    });
  });
});
