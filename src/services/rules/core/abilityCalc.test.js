// @maintained-by-ai
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
  loadWildMagicSurgeTable: vi.fn(async () => []),
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

describe('abilityCalc (5e)', () => {
  describe('getAbilities', () => {
    function makeStats(overrides = {}) {
      return {
        level: overrides.level || 5,
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
        saveProficiencies: overrides.saveProficiencies || [],
      };
    }

    it('returns six abilities in canonical order with skills assigned by ability', async () => {
      const result = await getAbilities(makeStats());

      expect(result.map(a => a.name)).toEqual(
        ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
      );
      // skills are filtered from the loaded list onto their ability (Con has none)
      expect(result.map(a => a.skills.length)).toEqual([1, 3, 0, 5, 5, 4]);
      expect(result[0].skills[0].name).toBe('Athletics');
    });

    it('maps full score range 1-30 to 5e modifiers floor((score-10)/2), capped at 20', async () => {
      // Canonical 5e modifier truth table; scores above 20 clamp to 20 / +5
      const table = [
        [1, 1, -5], [2, 2, -4], [3, 3, -4], [4, 4, -3], [5, 5, -3],
        [6, 6, -2], [7, 7, -2], [8, 8, -1], [9, 9, -1], [10, 10, 0],
        [11, 11, 0], [12, 12, 1], [13, 13, 1], [14, 14, 2], [15, 15, 2],
        [16, 16, 3], [17, 17, 3], [18, 18, 4], [19, 19, 4], [20, 20, 5],
        [21, 20, 5], [25, 20, 5], [30, 20, 5],
      ];
      for (const [score, totalScore, bonus] of table) {
        const result = await getAbilities(makeStats({
          abilities: [{ name: 'Intelligence', baseScore: score, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }],
        }));
        expect(result[0].totalScore, `score ${score}`).toBe(totalScore);
        expect(result[0].bonus, `score ${score}`).toBe(bonus);
      }
    });

    it('computes save bonuses from class/feature proficiency union and proficiency breakpoints', async () => {
      const result = await getAbilities(makeStats({
        level: 7, // proficiency 3
        saveProficiencies: ['Dexterity', 'Wisdom'],
      }));
      const byName = Object.fromEntries(result.map(a => [a.name, a]));

      expect(byName.Strength.proficient).toBe(true);
      expect(byName.Strength.save).toBe(6); // 3 + 3 prof (class)
      expect(byName.Constitution.save).toBe(4); // 1 + 3 prof (class)
      expect(byName.Dexterity.proficient).toBe(true);
      expect(byName.Dexterity.save).toBe(5); // 2 + 3 prof (feature)
      expect(byName.Wisdom.proficient).toBe(true);
      expect(byName.Wisdom.save).toBe(4); // 1 + 3 prof (feature)
      expect(byName.Charisma.proficient).toBe(false);
      expect(byName.Charisma.save).toBe(-1); // bonus only

      // Proficiency scales at 5e breakpoints: 2 @1-4, 3 @5-8, 4 @9-12, 5 @13-16, 6 @17-20
      const breakpoints = [[1, 5], [4, 5], [5, 6], [8, 6], [9, 7], [12, 7], [13, 8], [16, 8], [17, 9], [20, 9]];
      for (const [level, expectedSave] of breakpoints) {
        const r = await getAbilities(makeStats({ level }));
        expect(r[0].save, `level ${level}`).toBe(expectedSave); // STR 16 = 3 + prof
      }
    });

    it('applies Primal Champion (+4 Str/Con above the cap) to Barbarian at level 20 only', async () => {
      const barbarian = (level) => getAbilities(makeStats({
        level,
        class: { name: 'Barbarian', saving_throws: ['Strength', 'Constitution'] },
      }));

      const r20 = await barbarian(20);
      expect(r20.find(a => a.name === 'Strength').totalScore).toBe(20); // 16 + 4
      expect(r20.find(a => a.name === 'Strength').bonus).toBe(5);
      expect(r20.find(a => a.name === 'Constitution').totalScore).toBe(16); // 12 + 4
      expect(r20.find(a => a.name === 'Constitution').bonus).toBe(3);

      // Guards: below level 20 and non-Barbarian get no bonus
      const r19 = await barbarian(19);
      expect(r19.find(a => a.name === 'Strength').totalScore).toBe(16);
      const fighter20 = await getAbilities(makeStats({ level: 20 }));
      expect(fighter20.find(a => a.name === 'Strength').totalScore).toBe(16);
    });

    it('adds racial bonus and feat/misc improvements to the total score', async () => {
      vi.mocked(raceRules.rules5e.getRacialBonus).mockImplementationOnce(() => 2);
      const result = await getAbilities(makeStats({ race: { name: 'Half-Orc' } }));
      const str = result.find(a => a.name === 'Strength');
      expect(str.totalScore).toBe(18); // 16 + 2 racial
      expect(str.bonus).toBe(4);
      expect(raceRules.rules5e.getRacialBonus).toHaveBeenCalledWith(expect.any(Object), 'Strength');

      const result2 = await getAbilities(makeStats({
        abilities: [
          { name: 'Strength', baseScore: 8, featIncrease: 2, miscIncrease: 1, backgroundIncrease: 0 },
          { name: 'Dexterity', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Wisdom', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
          { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ],
      }));
      const str2 = result2.find(a => a.name === 'Strength');
      expect(str2.totalScore).toBe(11); // 8 + 2 feat + 1 misc + 0 racial
      expect(str2.bonus).toBe(0); // floor((11-10)/2) = 0
    });

    it('applies the RAW expertise law: doubled proficiency ONLY where proficient (4-quadrant)', async () => {
      const result = await getAbilities(makeStats({
        level: 5, // proficiency +3
        skillProficiencies: ['Athletics', 'Stealth', 'Sleight of Hand'],
        expertise: ['Stealth', 'Acrobatics'], // Acrobatics: illegal expertise mark (not proficient)
      }));
      const skill = (abilityName, name) =>
        result.find(a => a.name === abilityName).skills.find(s => s.name === name);

      // [quadrant, ability, skill, expected bonus] — STR +3, DEX +2, WIS +1
      const table = [
        ['expert + proficient', 'Dexterity', 'Stealth', 8],       // 2 + 3 + 3 (doubled prof) — working path intact
        ['expert, NOT proficient', 'Dexterity', 'Acrobatics', 2], // ability bonus only — RAW: expertise requires proficiency first
        ['proficient only', 'Dexterity', 'Sleight of Hand', 5],   // 2 + 3 prof
        ['neither', 'Wisdom', 'Perception', 1],                    // bonus only
        ['proficient only', 'Strength', 'Athletics', 6],           // 3 + 3 prof
      ];
      for (const [quadrant, abilityName, name, expected] of table) {
        expect(skill(abilityName, name).bonus, `${quadrant}: ${name}`).toBe(expected);
      }

      // DC-20 comparison pin (phantom-bonus falsifier): d20 showing 15 on the
      // expert-marked-but-not-proficient Acrobatics — RAW 15 + 2 = 17 FAILS DC 20;
      // pre-fix phantom (15 + 2 + 3 = 20) would have falsely SUCCEEDED.
      const d20 = 15;
      expect(d20 + skill('Dexterity', 'Acrobatics').bonus).toBe(17); // fail
      expect(d20 + skill('Dexterity', 'Stealth').bonus).toBe(23);    // legit expert succeeds
    });

    it('treats missing class.saving_throws as no save proficiencies', async () => {
      const result = await getAbilities(makeStats({
        class: { name: 'Fighter', saving_throws: undefined },
      }));

      result.forEach(a => expect(a.proficient).toBe(false));
      // bonus-only: STR 16/DEX 14/CON 12/INT 10/WIS 13/CHA 8
      expect(result.map(a => a.save)).toEqual([3, 2, 1, 0, 1, -1]);
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

    function withCon(level, conBonus) {
      return makeStats({
        level,
        abilities: [{ name: 'Constitution', baseScore: 10 + 2 * conBonus, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: conBonus }],
      });
    }

    it('computes HP as max die + average per level + Con bonus per level', () => {
      // d10: 10 + 6*(level-1) + con*level — literals from the 5e HP rule
      const table = [
        [1, 0, 10],   // 10
        [2, 0, 16],   // 10 + 6
        [5, 0, 34],   // 10 + 24
        [1, 2, 12],   // 10 + 2
        [1, -1, 9],   // 10 - 1 (negative Con modifier is honored)
        [5, 2, 44],   // 10 + 24 + 10
      ];
      for (const [level, conBonus, expected] of table) {
        expect(getHitPoints(withCon(level, conBonus)), `level ${level}, con ${conBonus}`).toBe(expected);
      }
    });

    it('stacks subrace and subclass per-level HP bonuses', () => {
      const hillDwarf = { name: 'Dwarf', subrace: { name: 'Hill Dwarf', hit_point_bonus_per_level: 1 } };

      // level 5 Hill Dwarf: 34 + 5
      expect(getHitPoints(makeStats({ level: 5, race: hillDwarf }))).toBe(39);

      // level 3 Hill Dwarf + subclass: 22 + 3 + 3
      expect(getHitPoints(makeStats({
        level: 3,
        race: hillDwarf,
        class: { hit_die: 10, subclass: { hit_point_bonus_per_level: 1 } },
      }))).toBe(28);
    });

    it('defaults Con bonus to 0 when constitution is missing or its bonus is undefined', () => {
      const stats = makeStats();
      stats.abilities = stats.abilities.filter(a => a.name !== 'Constitution');
      expect(getHitPoints(stats)).toBe(10);

      expect(getHitPoints(makeStats({
        abilities: [{ name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: undefined }],
      }))).toBe(10);
    });

    it('adds static and expression max_hp_increase passives from automation', () => {
      expect(getHitPoints(makeStats({
        automation: { passives: [{ type: 'passive_rule', effect: 'max_hp_increase', amount: 3 }] },
      }))).toBe(13); // 10 + 3

      // evaluateAutoExpression is mocked to return 5 app-wide in this file
      expect(getHitPoints(makeStats({
        automation: { passives: [{ type: 'passive_rule', effect: 'max_hp_increase', bonusExpression: 'level' }] },
      }))).toBe(15); // 10 + 5
    });

    it('ignores passives without amount/expression, non-matching effects, and missing automation', () => {
      expect(getHitPoints(makeStats({
        automation: { passives: [{ type: 'passive_rule', effect: 'max_hp_increase' }] },
      }))).toBe(10);

      expect(getHitPoints(makeStats({
        automation: { passives: [{ type: 'passive_rule', effect: 'other_effect', amount: 100 }] },
      }))).toBe(10);

      expect(getHitPoints(makeStats())).toBe(10);
    });
  });

  describe('getCarryingCapacity (re-export of carryingCapacity.js)', () => {
    const capacity = (abilities, sizeMultiplier) => getCarryingCapacity({ abilities, sizeMultiplier });

    it('is STR totalScore x 15 with default score and size multiplier', () => {
      expect(capacity([{ name: 'Strength', totalScore: 16 }])).toBe(240);
      expect(capacity([{ name: 'Dexterity', totalScore: 14 }])).toBe(150); // missing STR defaults to 10
      expect(capacity([{ name: 'Strength', totalScore: 10 }], 2)).toBe(300);
      expect(capacity([{ name: 'Strength', totalScore: 10 }], 1.5)).toBe(225);
    });
  });
});
