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

    it('should return all six abilities with correct structure', async () => {
      const result = await getAbilities(makeStats());

      expect(result).toHaveLength(6);
      const names = result.map(a => a.name);
      expect(names).toEqual(['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']);
    });

    it('should compute ability bonuses from total score using floor((score-10)/2)', async () => {
      const result = await getAbilities(makeStats({
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 13, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 1, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      }));

      const str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(15);
      expect(str.bonus).toBe(2);

      const con = result.find(a => a.name === 'Constitution');
      expect(con.totalScore).toBe(13);
      expect(con.bonus).toBe(1);

      const wis = result.find(a => a.name === 'Wisdom');
      expect(wis.totalScore).toBe(8);
      expect(wis.bonus).toBe(-1);

      const cha = result.find(a => a.name === 'Charisma');
      expect(cha.totalScore).toBe(1);
      expect(cha.bonus).toBe(-5);
    });

    it('should mark saving throw proficiencies from class.saving_throws', async () => {
      const result = await getAbilities(makeStats());

      const str = result.find(a => a.name === 'Strength');
      expect(str.proficient).toBe(true);

      const dex = result.find(a => a.name === 'Dexterity');
      expect(dex.proficient).toBe(false);
    });

    it('should compute save bonus as bonus + proficiency when proficient', async () => {
      const result = await getAbilities(makeStats());

      const str = result.find(a => a.name === 'Strength');
      expect(str.save).toBe(6); // 3 (bonus) + 3 (proficiency)
    });

    it('should compute save bonus as bonus only when not proficient', async () => {
      const result = await getAbilities(makeStats());

      const dex = result.find(a => a.name === 'Dexterity');
      expect(dex.save).toBe(2); // just bonus, no proficiency
    });

    it('should include skills for each ability', async () => {
      const result = await getAbilities(makeStats());

      const str = result.find(a => a.name === 'Strength');
      expect(str.skills).toHaveLength(1);
      expect(str.skills[0].name).toBe('Athletics');

      const dex = result.find(a => a.name === 'Dexterity');
      expect(dex.skills).toHaveLength(3);

      const cha = result.find(a => a.name === 'Charisma');
      expect(cha.skills).toHaveLength(4);
    });

    it('should mark skill proficiencies from skillProficiencies', async () => {
      const result = await getAbilities(makeStats({
        skillProficiencies: ['Athletics'],
      }));

      const str = result.find(a => a.name === 'Strength');
      const athletics = str.skills.find(s => s.name === 'Athletics');
      expect(athletics.bonus).toBe(6); // 3 (str bonus) + 3 (proficiency)
    });

    it('should apply expertise as double proficiency on skills', async () => {
      const result = await getAbilities(makeStats({
        expertise: ['Stealth'],
      }));

      const dex = result.find(a => a.name === 'Dexterity');
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

    it('should apply Primal Champion (+4 to Str/Con) for level 20 Barbarian', async () => {
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
    });

    it('should not apply Primal Champion for non-Barbarian at level 20', async () => {
      const result = await getAbilities(makeStats({ level: 20 }));

      const str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(16);
      expect(str.bonus).toBe(3);
    });

    it('should not apply Primal Champion below level 20', async () => {
      const result = await getAbilities(makeStats({
        level: 19,
        class: {
          name: 'Barbarian',
          saving_throws: ['Strength', 'Constitution'],
        },
      }));

      const str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(16);
      expect(str.bonus).toBe(3);
    });

    it('should handle extreme ability scores (low and high)', async () => {
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

    it('should enforce 20 cap on ability scores before racial/class bonuses', async () => {
      const abilities = [
        { name: 'Dexterity', baseScore: 25, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Strength', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      ];
      const result = await getAbilities(makeStats({ abilities }));

      const dex = result.find(a => a.name === 'Dexterity');
      expect(dex.totalScore).toBe(20); // capped at 20
      expect(dex.bonus).toBe(5);
    });

    it('should apply racial bonus from race.ability_bonuses', async () => {
      vi.mocked(raceRules.rules5e.getRacialBonus).mockReturnValue(2);

      const result = await getAbilities(makeStats({
        race: {
          name: 'Half-Orc',
          ability_bonuses: [{ ability_score: 'Strength', bonus: 2 }],
        },
      }));

      const str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(18); // 16 + 2 racial
      expect(raceRules.rules5e.getRacialBonus).toHaveBeenCalledWith(expect.any(Object), 'Strength');
    });

    it('should apply ability improvements (feat, misc, background)', async () => {
      // Reset the racial bonus mock for this test
      vi.mocked(raceRules.rules5e.getRacialBonus).mockReturnValue(0);

      const result = await getAbilities(makeStats({
        abilities: [
          { name: 'Strength', baseScore: 8, featIncrease: 2, miscIncrease: 1, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      }));

      const str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(11); // 8 + 2 + 1 + 0 racial
      expect(str.bonus).toBe(0); // floor((11-10)/2) = 0
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

    it('should calculate hit points at level 1 with +2 Con', () => {
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

    it('should include racial hit point bonus (Hill Dwarf)', () => {
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

    it('should use 0 con bonus when constitution ability is missing', () => {
      const playerStats = makeStats();
      playerStats.abilities = playerStats.abilities.filter(a => a.name !== 'Constitution');
      const hp = getHitPoints(playerStats);
      // 10 + (6*0) + (0*1) = 10
      expect(hp).toBe(10);
    });

    it('should use 0 con bonus when constitution bonus is explicitly undefined', () => {
      const playerStats = makeStats({
        abilities: [
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: undefined },
        ],
      });
      const hp = getHitPoints(playerStats);
      // conBonus = 0 (explicit undefined falls back to 0)
      // 10 + (6*0) + (0*1) = 10
      expect(hp).toBe(10);
    });

    it('should add static max_hp_increase from automation passives', () => {
      const playerStats = makeStats({
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'max_hp_increase', amount: 3 },
          ],
        },
      });

      const hp = getHitPoints(playerStats);
      expect(hp).toBe(13); // 10 + 0 + 0 + 3
    });

    it('should add expression-based max_hp_increase from automation passives', () => {
      const playerStats = makeStats({
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'max_hp_increase', bonusExpression: '1d4+1' },
          ],
        },
      });

      // evaluateAutoExpression is mocked to return 5
      const hp = getHitPoints(playerStats);
      expect(hp).toBe(15); // 10 + 0 + 0 + 5
    });

    it('should ignore automation passives with missing amount and expression', () => {
      const playerStats = makeStats({
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'max_hp_increase' },
          ],
        },
      });

      const hp = getHitPoints(playerStats);
      expect(hp).toBe(10); // no bonus added
    });

    it('should ignore non-max_hp_increase automation passives', () => {
      const playerStats = makeStats({
        automation: {
          passives: [
            { type: 'passive_rule', effect: 'other_effect', amount: 100 },
          ],
        },
      });

      const hp = getHitPoints(playerStats);
      expect(hp).toBe(10); // unaffected
    });

    it('should handle missing automation passives gracefully', () => {
      const playerStats = makeStats();
      const hp = getHitPoints(playerStats);
      expect(hp).toBe(10);
    });

    it('should handle null automation gracefully', () => {
      const playerStats = makeStats({ automation: null });
      const hp = getHitPoints(playerStats);
      expect(hp).toBe(10);
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

    it('should calculate capacity as Strength totalScore * 15', () => {
      const playerStats = makeStats({
        abilities: [
          { name: 'Strength', totalScore: 16 },
        ],
      });

      expect(getCarryingCapacity(playerStats)).toBe(240); // 16 * 15
    });

    it('should default to 150 when Strength ability is missing', () => {
      const playerStats = makeStats({
        abilities: [
          { name: 'Dexterity', totalScore: 14 },
        ],
      });

      expect(getCarryingCapacity(playerStats)).toBe(150); // 10 * 15
    });

    it('should default to 150 when abilities array is empty', () => {
      const playerStats = makeStats({ abilities: [] });

      expect(getCarryingCapacity(playerStats)).toBe(150); // 10 * 15
    });

    it('should apply size multiplier', () => {
      const playerStats = makeStats({
        abilities: [
          { name: 'Strength', totalScore: 10 },
        ],
        sizeMultiplier: 2,
      });

      expect(getCarryingCapacity(playerStats)).toBe(300); // 10 * 15 * 2
    });

    it('should apply fractional size multiplier', () => {
      const playerStats = makeStats({
        abilities: [
          { name: 'Strength', totalScore: 10 },
        ],
        sizeMultiplier: 1.5,
      });

      expect(getCarryingCapacity(playerStats)).toBe(225); // 10 * 15 * 1.5
    });

    it('should apply size multiplier to default strength', () => {
      const playerStats = makeStats({
        abilities: [],
        sizeMultiplier: 2,
      });

      expect(getCarryingCapacity(playerStats)).toBe(300); // 10 * 15 * 2
    });
  });
});
