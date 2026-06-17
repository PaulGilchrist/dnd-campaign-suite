import { describe, it, expect } from 'vitest';
import { getAbilities, getHitPoints } from './abilityCalc.js';

const makePlayerStats = (overrides = {}) => ({
  level: 5,
  proficiency: 3,
  abilities: [
    { name: 'Strength', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { name: 'Dexterity', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { name: 'Constitution', baseScore: 12, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { name: 'Wisdom', baseScore: 13, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    { name: 'Charisma', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
  ],
  class: {
    name: 'Fighter',
    hit_die: 10,
    saving_throws: ['Strength', 'Constitution'],
    proficiency_choices: [],
  },
  race: { name: 'Human', subrace: null },
  skillProficiencies: [],
  expertise: null,
  ...overrides,
});

describe('abilityCalc', () => {
  describe('getAbilities', () => {
    it('should calculate ability bonuses correctly', async () => {
      const result = await getAbilities(makePlayerStats());
      const str = result.find(a => a.name === 'Strength');
      expect(str.bonus).toBe(3);
    });

    it('should mark saving throw proficiencies from class', async () => {
      const result = await getAbilities(makePlayerStats());
      const str = result.find(a => a.name === 'Strength');
      const dex = result.find(a => a.name === 'Dexterity');
      expect(str.proficient).toBe(true);
      expect(dex.proficient).toBe(false);
    });

    it('should calculate save bonus with proficiency', async () => {
      const result = await getAbilities(makePlayerStats());
      const str = result.find(a => a.name === 'Strength');
      expect(str.save).toBe(6); // 3 (bonus) + 3 (proficiency)
    });

    it('should calculate save bonus without proficiency', async () => {
      const result = await getAbilities(makePlayerStats());
      const dex = result.find(a => a.name === 'Dexterity');
      expect(dex.save).toBe(2); // just bonus, no proficiency
    });

    it('should include skills for each ability', async () => {
      const result = await getAbilities(makePlayerStats());
      const str = result.find(a => a.name === 'Strength');
      expect(str.skills.length).toBeGreaterThan(0);
    });

    it('should mark skill proficiencies from skillProficiencies', async () => {
      const result = await getAbilities(makePlayerStats({
        skillProficiencies: ['Athletics'],
      }));
      const str = result.find(a => a.name === 'Strength');
      const athletics = str.skills.find(s => s.name === 'Athletics');
      expect(athletics.bonus).toBe(6); // 3 (str bonus) + 3 (proficiency)
    });

    it('should apply expertise bonus', async () => {
      const result = await getAbilities(makePlayerStats({
        expertise: ['Stealth'],
      }));
      const dex = result.find(a => a.name === 'Dexterity');
      const stealth = dex.skills.find(s => s.name === 'Stealth');
      expect(stealth.bonus).toBe(5); // 2 (dex bonus) + 3 (double proficiency)
    });

    it('should calculate proficiency bonus based on level', async () => {
      // Level 5 -> floor((5-1)/4 + 2) = 3
      const result = await getAbilities(makePlayerStats({ level: 5 }));
      const str = result.find(a => a.name === 'Strength');
      expect(str.save).toBe(6); // 3 + 3
    });

    it('should use proficiency 2 at level 1', async () => {
      // Level 1 -> floor((1-1)/4 + 2) = 2
      const result = await getAbilities(makePlayerStats({ level: 1 }));
      const str = result.find(a => a.name === 'Strength');
      expect(str.save).toBe(5); // 3 + 2
    });

    it('should apply Primal Champion at level 20 for Barbarian', async () => {
      const result = await getAbilities(makePlayerStats({
        level: 20,
        class: {
          name: 'Barbarian',
          saving_throws: ['Strength', 'Constitution'],
          proficiency_choices: [],
        },
      }));
      const str = result.find(a => a.name === 'Strength');
      // 16 base + 4 (Primal Champion) = 20, bonus = 5
      expect(str.bonus).toBe(5);
      expect(str.totalScore).toBe(20);
    });

    it('should not apply Primal Champion for non-Barbarian', async () => {
      const result = await getAbilities(makePlayerStats({ level: 20 }));
      const str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(16);
    });

    it('should handle extreme ability scores', async () => {
      const abilities = [
        { name: 'Strength', baseScore: 3, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Dexterity', baseScore: 30, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      ];
      const result = await getAbilities(makePlayerStats({ abilities }));
      const str = result.find(a => a.name === 'Strength');
      const dex = result.find(a => a.name === 'Dexterity');
      expect(str.bonus).toBe(-4);
      // Score 30 capped at 20: bonus = (20-10)/2 = 5
      expect(dex.bonus).toBe(5);
    });
  });

  describe('getHitPoints', () => {
    it('should calculate hit points correctly at level 1', () => {
      const playerStats = makePlayerStats({ level: 1 });
      const hp = getHitPoints(playerStats);
      // conBonus = 0 (no .bonus on raw ability data)
      // 10 + (10/2+1)*0 + 0 = 10
      expect(hp).toBe(10);
    });

    it('should calculate hit points correctly at level 5', () => {
      const playerStats = makePlayerStats({ level: 5 });
      const hp = getHitPoints(playerStats);
      // 10 + (10/2+1)*4 + 0 = 10 + 24 = 34
      expect(hp).toBe(34);
    });

    it('should include racial hit point bonus (Hill Dwarf)', () => {
      const playerStats = makePlayerStats({
        race: {
          name: 'Dwarf',
          subrace: { name: 'Hill Dwarf', hit_point_bonus_per_level: 1 },
        },
        level: 5,
      });
      const hp = getHitPoints(playerStats);
      // 34 + (1 * 5) = 39
      expect(hp).toBe(39);
    });

    it('should stack Hill Dwarf with subclass bonuses', () => {
      const playerStats = makePlayerStats({
        level: 3,
        race: {
          name: 'Dwarf',
          subrace: { name: 'Hill Dwarf', hit_point_bonus_per_level: 1 },
        },
        class: {
          ...makePlayerStats().class,
          subclass: { hit_point_bonus_per_level: 1 },
        },
      });
      const hp = getHitPoints(playerStats);
      // base: 10 + (6*2) + 0 = 22, + 3 (hill dwarf) + 3 (subclass) = 28
      expect(hp).toBe(28);
    });

    it('should use 0 con bonus when constitution ability is missing', () => {
      const playerStats = makePlayerStats();
      playerStats.abilities = playerStats.abilities.filter(a => a.name !== 'Constitution');
      const hp = getHitPoints(playerStats);
      // Constitution not found -> conBonus = 0
      // 10 + (6*4) + 0 = 34
      expect(hp).toBe(34);
    });
  });
});
