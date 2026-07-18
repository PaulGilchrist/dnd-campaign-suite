// @cleaned-by-ai
// @improved-by-ai
import { describe, it, expect, vi } from 'vitest';
import { getAbilities, getHitPoints, getCarryingCapacity } from './abilityCalc2024.js';

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

vi.mock('../../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(() => Promise.resolve(mockSkills)),
  loadWildMagicSurgeTable: vi.fn(async () => []),
}));

// Mock evaluateAutoExpression for automation.passives tests
vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(() => 5),
}));

describe('abilityCalc2024', () => {
  describe('getAbilities', () => {
    function makeStats(overrides = {}) {
      return {
        level: overrides.level || 1,
        abilities: overrides.abilities || [
          { name: 'Strength', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
        class: {
          saving_throw_proficiencies: [],
          ...overrides.class,
        },
        skillProficiencies: overrides.skillProficiencies || [],
        expertise: overrides.expertise || [],
        saveProficiencies: overrides.saveProficiencies || [],
      };
    }

    it('should return all six abilities with correct structure', async () => {
      const result = await getAbilities(makeStats({}));

      expect(result).toHaveLength(6);
      const names = result.map(a => a.name);
      expect(names).toContain('Strength');
      expect(names).toContain('Dexterity');
      expect(names).toContain('Constitution');
      expect(names).toContain('Intelligence');
      expect(names).toContain('Wisdom');
      expect(names).toContain('Charisma');
    });

    it('should compute ability bonuses from total score using floor((score-10)/2)', async () => {
      const result = await getAbilities(makeStats({
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 13, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      }));

      const str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(15);
      expect(str.bonus).toBe(2);

      const dex = result.find(a => a.name === 'Dexterity');
      expect(dex.totalScore).toBe(14);
      expect(dex.bonus).toBe(2);

      const con = result.find(a => a.name === 'Constitution');
      expect(con.totalScore).toBe(13);
      expect(con.bonus).toBe(1);

      const wis = result.find(a => a.name === 'Wisdom');
      expect(wis.totalScore).toBe(8);
      expect(wis.bonus).toBe(-1);
    });

    it('should mark saving throw proficiencies from class', async () => {
      const result = await getAbilities(makeStats({
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
        class: { saving_throw_proficiencies: ['Strength', 'Constitution'] },
      }));

      const str = result.find(a => a.name === 'Strength');
      expect(str.proficient).toBe(true);
      expect(str.save).toBe(4); // bonus 2 + proficiency 2

      const dex = result.find(a => a.name === 'Dexterity');
      expect(dex.proficient).toBe(false);
      expect(dex.save).toBe(0); // just bonus
    });

    it('should merge class save proficiencies with feature save proficiencies', async () => {
      const result = await getAbilities(makeStats({
        level: 7,
        abilities: [
          { name: 'Strength', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
        class: { saving_throw_proficiencies: ['Dexterity', 'Intelligence'] },
        saveProficiencies: ['Wisdom'],
      }));

      const dex = result.find(a => a.name === 'Dexterity');
      expect(dex.proficient).toBe(true);
      expect(dex.save).toBe(5); // +2 bonus + 3 proficiency

      const wis = result.find(a => a.name === 'Wisdom');
      expect(wis.proficient).toBe(true);
      expect(wis.save).toBe(6); // +3 bonus + 3 proficiency

      const str = result.find(a => a.name === 'Strength');
      expect(str.proficient).toBe(false);
      expect(str.save).toBe(0);
    });

    it('should handle missing class.saving_throw_proficiencies gracefully', async () => {
      const result = await getAbilities(makeStats({ class: {} }));

      result.forEach(ability => {
        expect(ability.proficient).toBe(false);
        expect(ability.save).toBe(ability.bonus);
      });
    });

    it('should compute proficiency bonus correctly at different levels', async () => {
      const profAt = (level) => Math.floor((level - 1) / 4 + 2);

      // Level 1 -> proficiency 2
      const r1 = await getAbilities(makeStats({
        level: 1,
        class: { saving_throw_proficiencies: ['Strength'] },
      }));
      const str1 = r1.find(a => a.name === 'Strength');
      expect(str1.save).toBe(0 + profAt(1)); // bonus 0 + proficiency 2

      // Level 5 -> proficiency 3
      const r5 = await getAbilities(makeStats({
        level: 5,
        class: { saving_throw_proficiencies: ['Strength'] },
      }));
      const str5 = r5.find(a => a.name === 'Strength');
      expect(str5.save).toBe(0 + profAt(5)); // bonus 0 + proficiency 3

      // Level 17 -> proficiency 6
      const r17 = await getAbilities(makeStats({
        level: 17,
        class: { saving_throw_proficiencies: ['Strength'] },
      }));
      const str17 = r17.find(a => a.name === 'Strength');
      expect(str17.save).toBe(0 + profAt(17)); // bonus 0 + proficiency 6
    });

    it('should include skills, mark proficiency, and apply expertise as double proficiency', async () => {
      const result = await getAbilities(makeStats({
        skillProficiencies: ['Athletics', 'Stealth'],
      }));

      const str = result.find(a => a.name === 'Strength');
      expect(str.skills).toHaveLength(1);
      expect(str.skills[0].name).toBe('Athletics');
      expect(str.skills[0].bonus).toBe(2); // bonus 0 + proficiency 2

      const dex = result.find(a => a.name === 'Dexterity');
      const stealth = dex.skills.find(s => s.name === 'Stealth');
      expect(stealth.bonus).toBe(2); // bonus 0 + proficiency 2
    });

    it('should apply expertise as double proficiency on skills, even when skill is not in skillProficiencies', async () => {
      const result = await getAbilities(makeStats({
        skillProficiencies: ['Athletics'],
        expertise: ['Athletics'],
      }));

      const str = result.find(a => a.name === 'Strength');
      expect(str.skills[0].bonus).toBe(4); // bonus 0 + proficiency 2 + expertise bonus 2

      // expertise without proficiency
      const result2 = await getAbilities(makeStats({
        skillProficiencies: [],
        expertise: ['Arcana'],
      }));

      const int = result2.find(a => a.name === 'Intelligence');
      const arcana = int.skills.find(s => s.name === 'Arcana');
      expect(arcana.bonus).toBe(2);
    });

    it('should apply ability improvements, enforce 20 cap, and enforce 25 cap on racial/class boosts', async () => {
      // ability improvements
      let result = await getAbilities(makeStats({
        abilities: [
          { name: 'Strength', baseScore: 8, featIncrease: 2, miscIncrease: 1, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      }));

      let str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(11); // 8 + 2 + 1
      expect(str.bonus).toBe(0); // floor((11-10)/2) = 0

      // 20 cap
      result = await getAbilities(makeStats({
        abilities: [
          { name: 'Dexterity', baseScore: 30, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Strength', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      }));

      let dex = result.find(a => a.name === 'Dexterity');
      expect(dex.totalScore).toBe(20); // capped at 20
      expect(dex.bonus).toBe(5);

      // 25 cap on racial/class boosts
      result = await getAbilities(makeStats({
        level: 20,
        class: { name: 'Barbarian', saving_throw_proficiencies: [] },
        abilities: [
          { name: 'Strength', baseScore: 22, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      }));

      str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(24); // base 22 capped at 20, then +4 Primal Champion = 24
      expect(str.bonus).toBe(7);
    });

    it('should apply Primal Champion (+4 to Str/Con) for level 20 Barbarian, Soul/Mind of Sea for Monk, and not for non-matching class or level < 20', async () => {
      // Barbarian Primal Champion
      let result = await getAbilities(makeStats({
        level: 20,
        class: { name: 'Barbarian', saving_throw_proficiencies: [] },
        abilities: [
          { name: 'Strength', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      }));

      let str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(20); // 16 + 4
      expect(str.bonus).toBe(5);

      let con = result.find(a => a.name === 'Constitution');
      expect(con.totalScore).toBe(18); // 14 + 4
      expect(con.bonus).toBe(4);

      // Monk Soul/Mind of Sea
      result = await getAbilities(makeStats({
        level: 20,
        class: { name: 'Monk', saving_throw_proficiencies: [] },
        abilities: [
          { name: 'Strength', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 12, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      }));

      let dex = result.find(a => a.name === 'Dexterity');
      expect(dex.totalScore).toBe(20); // 16 + 4
      expect(dex.bonus).toBe(5);

      let wis = result.find(a => a.name === 'Wisdom');
      expect(wis.totalScore).toBe(18); // 14 + 4
      expect(wis.bonus).toBe(4);

      // Strength should not be affected
      str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(10);
      expect(str.bonus).toBe(0);

      // Not below level 20
      result = await getAbilities(makeStats({
        level: 19,
        class: { name: 'Barbarian', saving_throw_proficiencies: [] },
        abilities: [
          { name: 'Strength', baseScore: 15, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      }));

      str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(15);
      expect(str.bonus).toBe(2);

      // Non-matching class
      result = await getAbilities(makeStats({
        level: 20,
        class: { name: 'Fighter', saving_throw_proficiencies: [] },
        abilities: [
          { name: 'Strength', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      }));

      str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(16);
      expect(str.bonus).toBe(3);
    });

    it('should apply Thaumaturge divine order bonus to Arcana and Religion', async () => {
      const result = await getAbilities(makeStats({
        class: { name: 'Cleric', divineOrder: 'Thaumaturge', saving_throw_proficiencies: [] },
        abilities: [
          { name: 'Strength', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 2 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      }));

      const int = result.find(a => a.name === 'Intelligence');
      const arcana = int.skills.find(s => s.name === 'Arcana');
      const religion = int.skills.find(s => s.name === 'Religion');
      const history = int.skills.find(s => s.name === 'History');

      // WIS mod = 2, divineBonus = max(1, 2) = 2
      expect(arcana.bonus).toBe(2); // 0 + 2 divine
      expect(religion.bonus).toBe(2); // 0 + 2 divine
      expect(history.bonus).toBe(0); // unaffected
    });

    it('should apply Thaumaturge divine order with minimum +1 when WIS mod is negative', async () => {
      const result = await getAbilities(makeStats({
        class: { name: 'Cleric', divineOrder: 'Thaumaturge', saving_throw_proficiencies: [] },
        abilities: [
          { name: 'Strength', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      }));

      const int = result.find(a => a.name === 'Intelligence');
      const arcana = int.skills.find(s => s.name === 'Arcana');
      // WIS mod = -1, divineBonus = max(1, -1) = 1
      expect(arcana.bonus).toBe(1);
    });

    it('should apply Magician primal order bonus to Arcana and Nature', async () => {
      const result = await getAbilities(makeStats({
        class: { name: 'Druid', primalOrder: 'Magician', saving_throw_proficiencies: [] },
        abilities: [
          { name: 'Strength', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: 3 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      }));

      const int = result.find(a => a.name === 'Intelligence');
      const arcana = int.skills.find(s => s.name === 'Arcana');
      const nature = int.skills.find(s => s.name === 'Nature');
      const history = int.skills.find(s => s.name === 'History');

      // WIS mod = 3, primalBonus = max(1, 3) = 3
      expect(arcana.bonus).toBe(3); // 0 + 3 primal
      expect(nature.bonus).toBe(3); // 0 + 3 primal
      expect(history.bonus).toBe(0); // unaffected
    });
  });

  describe('getHitPoints', () => {
    it('should calculate HP at level 1 with d10 hit die and +2 Con', () => {
      const playerStats = {
        level: 1,
        abilities: [
          { name: 'Constitution', baseScore: 14, featIncrease: 0, miscIncrease: 0, bonus: 2 },
        ],
        class: { hit_point_die: 'd10' },
        race: {},
      };

      expect(getHitPoints(playerStats)).toBe(12); // 10 + (6*0) + (2*1)
    });

    it('should calculate HP at level 5 with d10 hit die and +2 Con', () => {
      const playerStats = {
        level: 5,
        abilities: [
          { name: 'Constitution', baseScore: 14, featIncrease: 0, miscIncrease: 0, bonus: 2 },
        ],
        class: { hit_point_die: 'd10' },
        race: {},
      };

      // 10 + (6*4) + (2*5) = 10 + 24 + 10 = 44
      expect(getHitPoints(playerStats)).toBe(44);
    });

    it('should fall back to hit_die when hit_point_die is missing, default to d8 when invalid', () => {
      const playerStats1 = {
        level: 1,
        abilities: [
          { name: 'Constitution', baseScore: 12, featIncrease: 0, miscIncrease: 0, bonus: 1 },
        ],
        class: { hit_die: 'd8' },
        race: {},
      };
      expect(getHitPoints(playerStats1)).toBe(9); // 8 + (5*0) + (1*1)

      const playerStats2 = {
        level: 1,
        abilities: [
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, bonus: 0 },
        ],
        class: { hit_point_die: 'invalid' },
        race: {},
      };
      expect(getHitPoints(playerStats2)).toBe(8); // 8 + (4*0) + (0*1)
    });

    it('should include race subrace and class major hit point bonuses, and stack them', () => {
      const playerStats1 = {
        level: 5,
        abilities: [
          { name: 'Constitution', baseScore: 14, featIncrease: 0, miscIncrease: 0, bonus: 2 },
        ],
        class: { hit_point_die: 'd8' },
        race: { subrace: { hit_point_bonus_per_level: 1 } },
      };
      // 8 + (5*4) + (2*5) + (1*5) = 8 + 20 + 10 + 5 = 43
      expect(getHitPoints(playerStats1)).toBe(43);

      const playerStats2 = {
        level: 3,
        abilities: [
          { name: 'Constitution', baseScore: 12, featIncrease: 0, miscIncrease: 0, bonus: 1 },
        ],
        class: { hit_point_die: 'd6', major: { hit_point_bonus_per_level: 2 } },
        race: {},
      };
      // 6 + (4*2) + (1*3) + (2*3) = 6 + 8 + 3 + 6 = 23
      expect(getHitPoints(playerStats2)).toBe(23);

      const playerStats3 = {
        level: 3,
        abilities: [
          { name: 'Constitution', baseScore: 12, featIncrease: 0, miscIncrease: 0, bonus: 1 },
        ],
        class: { hit_point_die: 'd6', major: { hit_point_bonus_per_level: 2 } },
        race: { subrace: { hit_point_bonus_per_level: 1 } },
      };
      // 6 + (4*2) + (1*3) + (1*3) + (2*3) = 6 + 8 + 3 + 3 + 6 = 26
      expect(getHitPoints(playerStats3)).toBe(26);
    });

    it('should handle level 0 and throw when constitution ability is missing', () => {
      const playerStats = {
        level: 0,
        abilities: [
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, bonus: 0 },
        ],
        class: { hit_point_die: 'd10' },
        race: {},
      };
      // 10 + (6*-1) + (0*0) = 10 - 6 = 4
      expect(getHitPoints(playerStats)).toBe(4);

      const playerStats2 = {
        level: 1,
        abilities: [
          { name: 'Strength', baseScore: 10, featIncrease: 0, miscIncrease: 0, bonus: 0 },
        ],
        class: { hit_point_die: 'd8' },
        race: {},
      };
      expect(() => getHitPoints(playerStats2)).toThrow();
    });

    it('should add static and expression-based max_hp_increase from automation passives, ignore non-matching passives, and handle missing passives', () => {
      // static
      let playerStats = {
        level: 1,
        abilities: [
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, bonus: 0 },
        ],
        class: { hit_point_die: 'd8' },
        race: {},
        automation: {
          passives: [{ type: 'passive_rule', effect: 'max_hp_increase', amount: 3 }],
        },
      };
      expect(getHitPoints(playerStats)).toBe(11); // 8 + 0 + 0 + 3

      // expression (mocked to return 5)
      playerStats = {
        level: 1,
        abilities: [
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, bonus: 0 },
        ],
        class: { hit_point_die: 'd8' },
        race: {},
        automation: {
          passives: [{ type: 'passive_rule', effect: 'max_hp_increase', bonusExpression: '1d4+1' }],
        },
      };
      expect(getHitPoints(playerStats)).toBe(13); // 8 + 0 + 0 + 5

      // missing amount/expression
      playerStats = {
        level: 1,
        abilities: [
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, bonus: 0 },
        ],
        class: { hit_point_die: 'd8' },
        race: {},
        automation: {
          passives: [{ type: 'passive_rule', effect: 'max_hp_increase' }],
        },
      };
      expect(getHitPoints(playerStats)).toBe(8);

      // non-matching effect
      playerStats = {
        level: 1,
        abilities: [
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, bonus: 0 },
        ],
        class: { hit_point_die: 'd8' },
        race: {},
        automation: {
          passives: [{ type: 'passive_rule', effect: 'other_effect', amount: 100 }],
        },
      };
      expect(getHitPoints(playerStats)).toBe(8);

      // missing passives
      playerStats = {
        level: 1,
        abilities: [
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, bonus: 0 },
        ],
        class: { hit_point_die: 'd8' },
        race: {},
      };
      expect(getHitPoints(playerStats)).toBe(8);
    });
  });

  describe('getCarryingCapacity', () => {
    it('should calculate capacity as Strength score * 15, default to 150 when Strength missing, and apply size multiplier', () => {
      expect(getCarryingCapacity({
        abilities: [{ name: 'Strength', totalScore: 16 }],
      })).toBe(240); // 16 * 15

      expect(getCarryingCapacity({
        abilities: [{ name: 'Dexterity', totalScore: 14 }],
      })).toBe(150); // 10 * 15

      expect(getCarryingCapacity({
        abilities: [{ name: 'Strength', totalScore: 10 }],
        sizeMultiplier: 2,
      })).toBe(300); // 10 * 15 * 2

      expect(getCarryingCapacity({
        abilities: [],
        sizeMultiplier: 1.5,
      })).toBe(225); // 10 * 15 * 1.5
    });
  });
});
