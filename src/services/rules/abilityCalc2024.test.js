import { describe, it, expect, vi } from 'vitest';
import { getAbilities, getHitPoints } from './abilityCalc2024.js';

// Mock loadSkills from dataLoader
const mockSkills = [
  { name: 'Athletics', ability: 'Strength' },
  { name: 'Acrobatics', ability: 'Dexterity' },
  { name: 'Sleight of Hand', ability: 'Dexterity' },
  { name: 'Stealth', ability: 'Dexterity' },
  { name: 'Arcana', ability: 'Intelligence' },
  { name: 'History', ability: 'Intelligence' },
  { name: 'Investigation', ability: 'Intelligence' },
  { name: 'Nature', ability: 'Intelligence' },
  { name: 'Religion', ability: 'Intelligence' },
  { name: 'Animal Handling', ability: 'Wisdom' },
  { name: 'Insight', ability: 'Wisdom' },
  { name: 'Medicine', ability: 'Wisdom' },
  { name: 'Perception', ability: 'Wisdom' },
  { name: 'Survival', ability: 'Wisdom' },
  { name: 'Deception', ability: 'Charisma' },
  { name: 'Intimidation', ability: 'Charisma' },
  { name: 'Performance', ability: 'Charisma' },
  { name: 'Persuasion', ability: 'Charisma' },
];

vi.mock('../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(() => Promise.resolve(mockSkills)),
}));

describe('abilityCalc2024', () => {
  describe('getAbilities', () => {
    it('should return abilities with computed bonus, save, and skill values', async () => {
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Constitution', baseScore: 13, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Wisdom', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Charisma', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
        ],
        class: {
          saving_throw_proficiencies: ['Strength', 'Constitution'],
        },
        skillProficiencies: ['Athletics'],
        expertise: [],
      };

      const result = await getAbilities(playerStats);

      expect(result).toHaveLength(6);

      // Strength: 15 → bonus +2, proficient in save → save = 2 + 2 = 4
      const str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(15);
      expect(str.bonus).toBe(2);
      expect(str.proficient).toBe(true);
      expect(str.save).toBe(4);

      // Dexterity: 14 → bonus +2, not proficient in save → save = 2
      const dex = result.find(a => a.name === 'Dexterity');
      expect(dex.totalScore).toBe(14);
      expect(dex.bonus).toBe(2);
      expect(dex.proficient).toBe(false);
      expect(dex.save).toBe(2);

      // Constitution: 13 → bonus +1, proficient in save → save = 1 + 2 = 3
      const con = result.find(a => a.name === 'Constitution');
      expect(con.totalScore).toBe(13);
      expect(con.bonus).toBe(1);
      expect(con.proficient).toBe(true);
      expect(con.save).toBe(3);

      // Intelligence: 10 → bonus 0
      const int = result.find(a => a.name === 'Intelligence');
      expect(int.totalScore).toBe(10);
      expect(int.bonus).toBe(0);
      expect(int.proficient).toBe(false);
      expect(int.save).toBe(0);

      // Wisdom: 8 → bonus -1
      const wis = result.find(a => a.name === 'Wisdom');
      expect(wis.totalScore).toBe(8);
      expect(wis.bonus).toBe(-1);
      expect(wis.proficient).toBe(false);
      expect(wis.save).toBe(-1);

      // Charisma: 8 → bonus -1
      const cha = result.find(a => a.name === 'Charisma');
      expect(cha.totalScore).toBe(8);
      expect(cha.bonus).toBe(-1);
      expect(cha.proficient).toBe(false);
      expect(cha.save).toBe(-1);
    });

    it('should compute skill bonuses with proficiency', async () => {
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Constitution', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Wisdom', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Charisma', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
        ],
        class: {
          saving_throw_proficiencies: [],
        },
        skillProficiencies: ['Athletics'],
        expertise: [],
      };

      const result = await getAbilities(playerStats);
      const str = result.find(a => a.name === 'Strength');

      expect(str.skills).toHaveLength(1);
      expect(str.skills[0].name).toBe('Athletics');
      // Proficiency bonus at level 1 = 2, ability bonus = 2
      expect(str.skills[0].bonus).toBe(4);
    });

    it('should apply expertise as double proficiency on skills', async () => {
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Constitution', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Wisdom', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Charisma', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
        ],
        class: {
          saving_throw_proficiencies: [],
        },
        skillProficiencies: ['Athletics'],
        expertise: ['Athletics'],
      };

      const result = await getAbilities(playerStats);
      const str = result.find(a => a.name === 'Strength');

      // Proficiency at level 1 = 2, ability bonus = 2, expertise adds another 2 = 6
      expect(str.skills[0].bonus).toBe(6);
    });

    it('should compute proficiency bonus correctly at level 5', async () => {
      const playerStats = {
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Constitution', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Wisdom', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Charisma', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
        ],
        class: {
          saving_throw_proficiencies: ['Strength'],
        },
        skillProficiencies: ['Athletics'],
        expertise: [],
      };

      const result = await getAbilities(playerStats);
      const str = result.find(a => a.name === 'Strength');

      // Proficiency at level 5 = Math.floor((5-1)/4+2) = Math.floor(1+2) = 3
      expect(str.save).toBe(5); // bonus 2 + proficiency 3
      expect(str.skills[0].bonus).toBe(5); // bonus 2 + proficiency 3
    });

    it('should compute proficiency bonus correctly at level 20', async () => {
      const playerStats = {
        level: 20,
        abilities: [
          { name: 'Strength', baseScore: 20, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Constitution', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Wisdom', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Charisma', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
        ],
        class: {
          saving_throw_proficiencies: ['Strength'],
        },
        skillProficiencies: [],
        expertise: [],
      };

      const result = await getAbilities(playerStats);
      const str = result.find(a => a.name === 'Strength');

      // Proficiency at level 20 = Math.floor((20-1)/4+2) = Math.floor(4.75+2) = 6
      // Ability bonus = Math.floor((20-10)/2) = 5
      expect(str.bonus).toBe(5);
      expect(str.save).toBe(11); // 5 + 6
    });

    it('should handle ability improvements and misc bonuses', async () => {
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 8, abilityImprovements: 2, miscBonus: 1 },
          { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Constitution', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Wisdom', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Charisma', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
        ],
        class: {
          saving_throw_proficiencies: [],
        },
        skillProficiencies: [],
        expertise: [],
      };

      const result = await getAbilities(playerStats);
      const str = result.find(a => a.name === 'Strength');

      // totalScore = 8 + 2 + 1 = 11
      expect(str.totalScore).toBe(11);
      // bonus = Math.floor((11-10)/2) = 0
      expect(str.bonus).toBe(0);
    });

    it('should handle empty skillProficiencies and expertise arrays', async () => {
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Constitution', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Wisdom', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Charisma', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
        ],
        class: {
          saving_throw_proficiencies: [],
        },
        skillProficiencies: [],
        expertise: [],
      };

      const result = await getAbilities(playerStats);
      expect(result).toHaveLength(6);
      result.forEach(ability => {
        expect(ability.bonus).toBe(0);
        expect(ability.proficient).toBe(false);
        expect(ability.save).toBe(0);
      });
    });

    it('should handle undefined saving_throw_proficiencies gracefully', async () => {
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Dexterity', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Constitution', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Wisdom', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Charisma', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
        ],
        class: {},
        skillProficiencies: [],
        expertise: [],
      };

      const result = await getAbilities(playerStats);
      const str = result.find(a => a.name === 'Strength');
      expect(str.proficient).toBe(false);
      expect(str.save).toBe(2);
    });

    it('should handle extreme ability scores (0 and 30)', async () => {
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 0, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Dexterity', baseScore: 30, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Constitution', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Wisdom', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Charisma', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
        ],
        class: {
          saving_throw_proficiencies: [],
        },
        skillProficiencies: [],
        expertise: [],
      };

      const result = await getAbilities(playerStats);
      const str = result.find(a => a.name === 'Strength');
      const dex = result.find(a => a.name === 'Dexterity');

      // Score 0: totalScore=0, bonus=Math.floor((0-10)/2)=Math.floor(-5)=-5
      expect(str.bonus).toBe(-5);
      // Score 30: totalScore=30, bonus=Math.floor((30-10)/2)=Math.floor(10)=10
      expect(dex.bonus).toBe(10);
    });
  });

  describe('getHitPoints', () => {
    it('should calculate HP for level 1 Fighter with 14 Con', () => {
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Constitution', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Wisdom', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Charisma', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        class: {
          hit_point_die: 'd10',
        },
        race: {},
      };

      const hp = getHitPoints(playerStats);
      // Level 1: hitDie + (con.bonus * level) = 10 + (2 * 1) = 12
      expect(hp).toBe(12);
    });

    it('should calculate HP for level 5 Fighter with 14 Con', () => {
      const playerStats = {
        level: 5,
        abilities: [
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Constitution', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
          { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Wisdom', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
          { name: 'Charisma', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        class: {
          hit_point_die: 'd10',
        },
        race: {},
      };

      const hp = getHitPoints(playerStats);
      // Level 5: 10 + ((10/2+1) * 4) + (2 * 5) = 10 + (6*4) + 10 = 10+24+10 = 44
      expect(hp).toBe(44);
    });

    it('should fall back to hit_die when hit_point_die is missing', () => {
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Constitution', baseScore: 12, abilityImprovements: 0, miscBonus: 0, bonus: 1 },
        ],
        class: {
          hit_die: 'd8',
        },
        race: {},
      };

      const hp = getHitPoints(playerStats);
      // hit_point_die is undefined, falls to hit_die = 'd8' → 8
      // 8 + (1 * 1) = 9
      expect(hp).toBe(9);
    });

    it('should default to d8 when hit die string is NaN', () => {
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Constitution', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        class: {
          hit_point_die: 'invalid',
        },
        race: {},
      };

      const hp = getHitPoints(playerStats);
      // Defaults to d8: 8 + (0 * 1) = 8
      expect(hp).toBe(8);
    });

    it('should include race subrace hit point bonus per level', () => {
      const playerStats = {
        level: 5,
        abilities: [
          { name: 'Constitution', baseScore: 14, abilityImprovements: 0, miscBonus: 0, bonus: 2 },
        ],
        class: {
          hit_point_die: 'd8',
        },
        race: {
          subrace: {
            hit_point_bonus_per_level: 1,
          },
        },
      };

      const hp = getHitPoints(playerStats);
      // d8 base: 8 + ((8/2+1)*4) + (2*5) + (1*5) = 8 + 20 + 10 + 5 = 43
      expect(hp).toBe(43);
    });

    it('should include class major hit point bonus per level', () => {
      const playerStats = {
        level: 3,
        abilities: [
          { name: 'Constitution', baseScore: 12, abilityImprovements: 0, miscBonus: 0, bonus: 1 },
        ],
        class: {
          hit_point_die: 'd6',
          major: {
            hit_point_bonus_per_level: 2,
          },
        },
        race: {},
      };

      const hp = getHitPoints(playerStats);
      // d6 base: 6 + ((6/2+1)*2) + (1*3) + (2*3) = 6 + 8 + 3 + 6 = 23
      expect(hp).toBe(23);
    });

    it('should handle level 0 gracefully', () => {
      const playerStats = {
        level: 0,
        abilities: [
          { name: 'Constitution', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        class: {
          hit_point_die: 'd10',
        },
        race: {},
      };

      const hp = getHitPoints(playerStats);
      // Level 0: 10 + ((10/2+1)*(-1)) + (0*0) = 10 + (-6) + 0 = 4
      expect(hp).toBe(4);
    });

    it('should throw when constitution ability is missing', () => {
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 10, abilityImprovements: 0, miscBonus: 0, bonus: 0 },
        ],
        class: {
          hit_point_die: 'd8',
        },
        race: {},
      };

      // Current behavior: accessing .bonus on undefined constitution throws
      expect(() => getHitPoints(playerStats)).toThrow();
    });
  });
});
