// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';
import { getAbilities, getHitPoints, getCarryingCapacity } from './abilityCalc.js';
import * as raceRules from '../../character/race-rules/index.js';

// Mock loadSkills from dataLoader — provides deterministic skill lists
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

vi.mock('../../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(() => Promise.resolve(mockSkills)),
}));

// Mock race rules — getRacialBonus returns 0 by default (Human baseline)
vi.mock('../../character/race-rules/index.js', () => ({
  rules5e: {
    getRacialBonus: vi.fn(() => 0),
  },
}));

// Mock evaluateAutoExpression for automation passives in getHitPoints
vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(() => 5),
}));

describe('abilityCalc', () => {
  describe('getAbilities', () => {
    function makeStats(overrides = {}) {
      return {
        level: overrides.level || 5,
        proficiency: overrides.proficiency || 3,
        abilities: overrides.abilities || [
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
          saving_throws: overrides.class?.saving_throws || ['Strength', 'Constitution'],
          proficiency_choices: [],
          ...overrides.class,
        },
        race: {
          name: 'Human',
          subrace: null,
          ...overrides.race,
        },
        skillProficiencies: overrides.skillProficiencies || [],
        expertise: overrides.expertise || null,
      };
    }

    it('should return all six abilities with correct structure, skills, and bonus calculations', async () => {
      const result = await getAbilities(makeStats());

      expect(result).toHaveLength(6);
      const names = result.map(a => a.name);
      expect(names).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']);

      // ability bonuses from floor((score-10)/2)
      const str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(16);
      expect(str.bonus).toBe(3);

      const cha = result.find(a => a.name === 'Charisma');
      expect(cha.totalScore).toBe(8);
      expect(cha.bonus).toBe(-1);

      // skills included
      expect(str.skills).toHaveLength(1);
      expect(str.skills[0].name).toBe('Athletics');
      expect(cha.skills).toHaveLength(4);
    });

    it('should compute save bonuses (proficient = bonus + proficiency, not proficient = bonus only)', async () => {
      const result = await getAbilities(makeStats());

      const str = result.find(a => a.name === 'Strength');
      expect(str.proficient).toBe(true);
      expect(str.save).toBe(6); // 3 (bonus) + 3 (proficiency)

      const dex = result.find(a => a.name === 'Dexterity');
      expect(dex.proficient).toBe(false);
      expect(dex.save).toBe(2); // just bonus
    });

    it('should mark skill proficiencies and apply expertise as double proficiency', async () => {
      const result = await getAbilities(makeStats({
        skillProficiencies: ['Athletics'],
      }));

      const str = result.find(a => a.name === 'Strength');
      const athletics = str.skills.find(s => s.name === 'Athletics');
      expect(athletics.bonus).toBe(6); // 3 (str bonus) + 3 (proficiency)

      const result2 = await getAbilities(makeStats({
        expertise: ['Stealth'],
      }));

      const dex = result2.find(a => a.name === 'Dexterity');
      const stealth = dex.skills.find(s => s.name === 'Stealth');
      expect(stealth.bonus).toBe(5); // 2 (dex bonus) + 3 (proficiency) + 3 (expertise)
    });

    it('should compute proficiency bonus correctly at different levels', async () => {
      const profAt = (level) => Math.floor((level - 1) / 4 + 2);

      // Level 1 -> proficiency 2
      const r1 = await getAbilities(makeStats({ level: 1 }));
      const str1 = r1.find(a => a.name === 'Strength');
      expect(str1.save).toBe(3 + profAt(1)); // 3 + 2

      // Level 5 -> proficiency 3
      const r5 = await getAbilities(makeStats({ level: 5 }));
      const str5 = r5.find(a => a.name === 'Strength');
      expect(str5.save).toBe(3 + profAt(5)); // 3 + 3

      // Level 17 -> proficiency 6
      const r17 = await getAbilities(makeStats({ level: 17 }));
      const str17 = r17.find(a => a.name === 'Strength');
      expect(str17.save).toBe(3 + profAt(17)); // 3 + 6
    });

    it('should apply Primal Champion (+4 to Str/Con) for level 20 Barbarian only', async () => {
      const result = await getAbilities(makeStats({
        level: 20,
        class: {
          name: 'Barbarian',
          saving_throws: ['Strength', 'Constitution'],
        },
      }));

      const str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(20); // 16 + 4
      expect(str.bonus).toBe(5);

      const con = result.find(a => a.name === 'Constitution');
      expect(con.totalScore).toBe(16); // 12 + 4
      expect(con.bonus).toBe(3);

      // Non-Barbarian at level 20
      const r2 = await getAbilities(makeStats({ level: 20 }));
      const str2 = r2.find(a => a.name === 'Strength');
      expect(str2.totalScore).toBe(16);
      expect(str2.bonus).toBe(3);

      // Barbarian below level 20
      const r3 = await getAbilities(makeStats({
        level: 19,
        class: {
          name: 'Barbarian',
          saving_throws: ['Strength', 'Constitution'],
        },
      }));
      const str3 = r3.find(a => a.name === 'Strength');
      expect(str3.totalScore).toBe(16);
      expect(str3.bonus).toBe(3);
    });

    it('should enforce 20 cap on ability scores, apply racial bonus, and apply ability improvements', async () => {
      // 20 cap
      const abilities = [
        { name: 'Dexterity', baseScore: 25, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Strength', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      ];
      let result = await getAbilities(makeStats({ abilities }));
      let dex = result.find(a => a.name === 'Dexterity');
      expect(dex.totalScore).toBe(20); // capped at 20
      expect(dex.bonus).toBe(5);

      // racial bonus
      vi.mocked(raceRules.rules5e.getRacialBonus).mockReturnValue(2);
      result = await getAbilities(makeStats({
        race: {
          name: 'Half-Orc',
          ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }],
        },
      }));
      const str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(18); // 16 + 2 racial
      expect(raceRules.rules5e.getRacialBonus).toHaveBeenCalledWith(expect.any(Object), 'Strength');

      // ability improvements
      vi.mocked(raceRules.rules5e.getRacialBonus).mockReturnValue(0);
      result = await getAbilities(makeStats({
        abilities: [
          { name: 'Strength', baseScore: 8, featIncrease: 2, miscIncrease: 1, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      }));
      const str2 = result.find(a => a.name === 'Strength');
      expect(str2.totalScore).toBe(11); // 8 + 2 + 1 + 0 racial
      expect(str2.bonus).toBe(0); // floor((11-10)/2) = 0
    });

    it('should handle extreme ability scores (low bonus, high capped)', async () => {
      const abilities = [
        { name: 'Strength', baseScore: 3, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Dexterity', baseScore: 30, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      ];
      const result = await getAbilities(makeStats({ abilities }));

      const str = result.find(a => a.name === 'Strength');
      expect(str.bonus).toBe(-4);

      const dex = result.find(a => a.name === 'Dexterity');
      expect(dex.totalScore).toBe(20); // capped
      expect(dex.bonus).toBe(5);
    });

    it('should not include skills when skills array is empty', async () => {
      vi.mocked((await import('../../ui/dataLoader.js')).loadSkills).mockResolvedValue([]);

      const result = await getAbilities(makeStats());
      result.forEach(ability => {
        expect(ability.skills).toHaveLength(0);
      });
    });

    it('should throw when class.saving_throws is undefined', async () => {
      await expect(
        getAbilities(makeStats({
          class: {
            name: 'Fighter',
            saving_throws: undefined,
          },
        }))
      ).rejects.toThrow();
    });
  });

  describe('getHitPoints', () => {
    function makeStats(overrides = {}) {
      return {
        level: overrides.level || 1,
        abilities: overrides.abilities || [
          { name: 'Strength', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 12, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
        class: {
          name: 'Fighter',
          hit_die: 10,
          ...overrides.class,
        },
        race: {
          name: 'Human',
          subrace: null,
          ...overrides.race,
        },
        automation: overrides.automation || null,
      };
    }

    it('should calculate hit points at level 1 with d10 hit die and +0 Con', () => {
      const playerStats = makeStats({ level: 1 });
      const hp = getHitPoints(playerStats);
      // 10 + (6*0) + (0*1) = 10
      expect(hp).toBe(10);
    });

    it('should calculate hit points at level 5 with d10 hit die and +0 Con', () => {
      const playerStats = makeStats({ level: 5 });
      const hp = getHitPoints(playerStats);
      // 10 + (6*4) + (0*5) = 10 + 24 + 0 = 34
      expect(hp).toBe(34);
    });

    it('should calculate hit points with +2 Con', () => {
      const playerStats = makeStats({
        level: 1,
        abilities: [
          { name: 'Constitution', baseScore: 14, featIncrease: 0, miscIncrease: 0, bonus: 2 },
        ],
      });
      const hp = getHitPoints(playerStats);
      // 10 + (6*0) + (2*1) = 12
      expect(hp).toBe(12);
    });

    it('should include racial hit point bonus (Hill Dwarf) and stack with subclass bonuses', () => {
      const playerStats = makeStats({
        level: 5,
        race: {
          name: 'Dwarf',
          subrace: { name: 'Hill Dwarf', hit_point_bonus_per_level: 1 },
        },
      });
      const hp = getHitPoints(playerStats);
      // base: 10 + (6*4) + (0*5) = 10 + 24 + 0 = 34
      // + 5 (hill dwarf) = 39
      expect(hp).toBe(39);
    });

    it('should stack Hill Dwarf with subclass bonuses', () => {
      const playerStats = makeStats({
        level: 3,
        race: {
          name: 'Dwarf',
          subrace: { name: 'Hill Dwarf', hit_point_bonus_per_level: 1 },
        },
        class: {
          ...makeStats().class,
          subclass: { hit_point_bonus_per_level: 1 },
        },
      });
      const hp = getHitPoints(playerStats);
      // base: 10 + (6*2) + (0*3) = 10 + 12 + 0 = 22
      // + 3 (hill dwarf) + 3 (subclass) = 28
      expect(hp).toBe(28);
    });

    it('should use 0 con bonus when constitution ability is missing or bonus is undefined', () => {
      const playerStats = makeStats();
      playerStats.abilities = playerStats.abilities.filter(a => a.name !== 'Constitution');
      expect(getHitPoints(playerStats)).toBe(10);

      const playerStats2 = makeStats({
        abilities: [
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: undefined },
        ],
      });
      expect(getHitPoints(playerStats2)).toBe(10);
    });

    it('should add static and expression-based max_hp_increase from automation passives', () => {
      // static amount
      const playerStats1 = makeStats({
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'max_hp_increase', amount: 3 },
          ],
        },
      });
      expect(getHitPoints(playerStats1)).toBe(13); // 10 + 0 + 0 + 3

      // expression (mocked to return 5)
      const playerStats2 = makeStats({
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'max_hp_increase', bonusExpression: '1d4+1' },
          ],
        },
      });
      expect(getHitPoints(playerStats2)).toBe(15); // 10 + 0 + 0 + 5
    });

    it('should ignore automation passives with missing amount/expression, non-matching effects, missing passives, or null automation', () => {
      let playerStats = makeStats({
        automation: {
          passives: [{ type: 'passive_rule', effect: 'max_hp_increase' }],
        },
      });
      expect(getHitPoints(playerStats)).toBe(10);

      playerStats = makeStats({
        automation: {
          passives: [{ type: 'passive_rule', effect: 'other_effect', amount: 100 }],
        },
      });
      expect(getHitPoints(playerStats)).toBe(10);

      expect(getHitPoints(makeStats())).toBe(10);
      expect(getHitPoints(makeStats({ automation: null }))).toBe(10);
    });
  });

  describe('getCarryingCapacity', () => {
    function makeStats(overrides = {}) {
      return {
        abilities: overrides.abilities || [
          { name: 'Strength', totalScore: 10 },
        ],
        sizeMultiplier: overrides.sizeMultiplier || 1,
      };
    }

    it('should calculate capacity as Strength totalScore * 15, default to 150 when Strength missing, and apply size multiplier', () => {
      expect(getCarryingCapacity(makeStats({ abilities: [{ name: 'Strength', totalScore: 16 }] }))).toBe(240); // 16 * 15
      expect(getCarryingCapacity(makeStats({ abilities: [{ name: 'Dexterity', totalScore: 14 }] }))).toBe(150); // 10 * 15
      expect(getCarryingCapacity(makeStats({ abilities: [], sizeMultiplier: 2 }))).toBe(300); // 10 * 15 * 2
      expect(getCarryingCapacity(makeStats({ sizeMultiplier: 2 }))).toBe(300);
      expect(getCarryingCapacity(makeStats({ sizeMultiplier: 1.5 }))).toBe(225); // 10 * 15 * 1.5
    });
  });
});
