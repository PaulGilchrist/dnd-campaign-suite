// @maintained-by-ai
import { describe, it, expect, vi } from 'vitest';
import { getAbilities, getHitPoints, getCarryingCapacity } from './abilityCalc2024.js';
import { getCarryingCapacity as baseGetCarryingCapacity } from './carryingCapacity.js';

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

// Mock evaluateAutoExpression for automation passives in getHitPoints
vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(() => 5),
}));

describe('abilityCalc2024', () => {
  describe('getAbilities', () => {
    function fullScores(overrides = {}) {
      return ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'].map(
        name => ({
          name,
          baseScore: overrides[name] ?? 10,
          featIncrease: 0,
          miscIncrease: 0,
          backgroundIncrease: 0,
        })
      );
    }

    function makeStats(overrides = {}) {
      return {
        level: overrides.level || 1,
        abilities: overrides.abilities || fullScores(),
        class: {
          saving_throw_proficiencies: [],
          ...overrides.class,
        },
        skillProficiencies: overrides.skillProficiencies || [],
        expertise: overrides.expertise || [],
        saveProficiencies: overrides.saveProficiencies || [],
      };
    }

    // NOTE: totals here have NO racial bonus — 2024 getAbilities does not call
    // raceRules.getRacialBonus (diverges from twin abilityCalc.js:12, whose
    // score table is canonical at abilityCalc.test.js:87-103).

    it('returns six abilities in canonical order with skills filtered onto their ability', async () => {
      const result = await getAbilities(makeStats());

      expect(result.map(a => a.name)).toEqual(
        ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
      );
      expect(result.map(a => a.skills.length)).toEqual([1, 3, 0, 5, 5, 4]); // from mockSkills
      expect(result[0].skills[0].name).toBe('Athletics');
    });

    it('maps full score range 1-30 to 2024 modifiers floor((score-10)/2), capped at 20', async () => {
      // Same shared math as 5e twin (abilityCalc.test.js:87-103); no racial bonus here.
      const table = [
        [1, 1, -5], [2, 2, -4], [3, 3, -4], [4, 4, -3], [5, 5, -3],
        [6, 6, -2], [7, 7, -2], [8, 8, -1], [9, 9, -1], [10, 10, 0],
        [11, 11, 0], [12, 12, 1], [13, 13, 1], [14, 14, 2], [15, 15, 2],
        [16, 16, 3], [17, 17, 3], [18, 18, 4], [19, 19, 4], [20, 20, 5],
        [21, 20, 5], [25, 20, 5], [30, 20, 5], // even/odd boundaries + cap rows
      ];
      for (const [score, totalScore, bonus] of table) {
        const result = await getAbilities(makeStats({
          abilities: [{ name: 'Intelligence', baseScore: score, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }],
        }));
        expect(result[0].totalScore, `score ${score}`).toBe(totalScore);
        expect(result[0].bonus, `score ${score}`).toBe(bonus);
      }
    });

    it('sums feat, background, and misc improvements into the total score', async () => {
      const result = await getAbilities(makeStats({
        abilities: [{ name: 'Strength', baseScore: 8, featIncrease: 2, miscIncrease: 1, backgroundIncrease: 1 }],
      }));
      expect(result[0].totalScore).toBe(12); // 8 + 2 + 1 + 1
      expect(result[0].bonus).toBe(1); // floor((12-10)/2)
    });

    it('computes saves from the union of class.saving_throw_proficiencies and feature saveProficiencies', async () => {
      // 2024 axis: saves live on class.saving_throw_proficiencies (abilityCalc2024.js:24)
      const result = await getAbilities(makeStats({
        level: 7, // proficiency 3
        abilities: fullScores({ Dexterity: 14, Wisdom: 16 }),
        class: { saving_throw_proficiencies: ['Dexterity', 'Intelligence'] },
        saveProficiencies: ['Wisdom'],
      }));
      const byName = Object.fromEntries(result.map(a => [a.name, a]));

      expect(byName.Dexterity.proficient).toBe(true);
      expect(byName.Dexterity.save).toBe(5); // 2 + 3 prof (class)
      expect(byName.Intelligence.save).toBe(3); // 0 + 3 prof (class)
      expect(byName.Wisdom.proficient).toBe(true);
      expect(byName.Wisdom.save).toBe(6); // 3 + 3 prof (feature)
      expect(byName.Strength.proficient).toBe(false);
      expect(byName.Strength.save).toBe(0); // bonus only

      // undefined class key is treated as no class saves (|| [] at :24)
      const r2 = await getAbilities(makeStats({
        level: 7,
        abilities: fullScores({ Dexterity: 14, Wisdom: 16 }),
        class: { saving_throw_proficiencies: undefined },
      }));
      expect(r2.map(a => a.save)).toEqual([0, 2, 0, 0, 3, 0]); // all bonus-only
      expect(r2.every(a => !a.proficient)).toBe(true);
    });

    it('scales proficiency bonus at literal 2024 breakpoints (prof 2/3/4/5/6)', async () => {
      // STR 10 = +0, so each save equals the proficiency bonus exactly
      const breakpoints = [[1, 2], [4, 2], [5, 3], [8, 3], [9, 4], [12, 4], [13, 5], [16, 5], [17, 6], [20, 6]];
      for (const [level, expectedSave] of breakpoints) {
        const result = await getAbilities(makeStats({
          level,
          class: { saving_throw_proficiencies: ['Strength'] },
        }));
        expect(result[0].save, `level ${level}`).toBe(expectedSave);
      }
    });

    it('applies the RAW expertise law: doubled proficiency ONLY where proficient (4-quadrant)', async () => {
      const result = await getAbilities(makeStats({
        level: 7, // proficiency +3
        abilities: fullScores({ Dexterity: 14 }), // DEX +2, INT +0
        skillProficiencies: ['Stealth', 'Sleight of Hand'],
        expertise: ['Stealth', 'Arcana'], // Arcana: illegal expertise mark (not proficient)
      }));
      const dex = result.find(a => a.name === 'Dexterity');
      const int = result.find(a => a.name === 'Intelligence');
      const skill = (ability, name) => result.find(a => a.name === ability).skills.find(s => s.name === name);

      // [quadrant, ability, skill, expected bonus] — mirrors the 5e twin lane
      const table = [
        ['expert + proficient', 'Dexterity', 'Stealth', 8],       // 2 + 3 prof + 3 expertise — working path intact
        ['expert, NOT proficient', 'Intelligence', 'Arcana', 0],  // was pinned 3 (defect): expertise requires proficiency first
        ['proficient only', 'Dexterity', 'Sleight of Hand', 5],   // 2 + 3 prof
        ['neither', 'Dexterity', 'Acrobatics', 2],                 // bonus only
      ];
      for (const [quadrant, ability, name, expected] of table) {
        expect(skill(ability, name).bonus, `${quadrant}: ${name}`).toBe(expected);
      }

      // DC-20 comparison pin (phantom-bonus falsifier): d20 showing 17 on the
      // expert-marked-but-not-proficient Arcana — RAW 17 + 0 = 17 FAILS DC 20;
      // pre-fix phantom (17 + 3 = 20) would have falsely SUCCEEDED.
      const d20 = 17;
      expect(d20 + int.skills.find(s => s.name === 'Arcana').bonus).toBe(17); // fail
      expect(d20 + dex.skills.find(s => s.name === 'Stealth').bonus).toBe(25); // legit expert succeeds
    });

    it('applies epic boon +4 (cap 25) to Barbarian Str/Con and Monk Dex/Wis at level 20 only', async () => {
      const epic = (level, name, abilityName, baseScore) => getAbilities(makeStats({
        level,
        class: { name, saving_throw_proficiencies: [] },
        abilities: [{ name: abilityName, baseScore, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 }],
      }));

      // [level, class, ability, baseScore, totalScore, bonus] — literals
      const rows = [
        [20, 'Barbarian', 'Strength', 16, 20, 5], // Primal Champion 16 + 4
        [20, 'Barbarian', 'Constitution', 14, 18, 4],
        [20, 'Barbarian', 'Strength', 22, 24, 7], // cap-then-add: min(22,20)+4 = 24 (cap 25)
        [20, 'Monk', 'Dexterity', 16, 20, 5], // Soul of the Four Winds line
        [20, 'Monk', 'Wisdom', 14, 18, 4], // Perfect Selfibility line
        [20, 'Monk', 'Strength', 10, 10, 0], // non-targeted ability untouched
        [19, 'Barbarian', 'Strength', 16, 16, 3], // guard: below level 20
        [20, 'Fighter', 'Strength', 16, 16, 3], // guard: non-matching class
      ];
      for (const [level, name, abilityName, baseScore, totalScore, bonus] of rows) {
        const result = await epic(level, name, abilityName, baseScore);
        expect(result[0].totalScore, `${name} L${level} ${abilityName}`).toBe(totalScore);
        expect(result[0].bonus, `${name} L${level} ${abilityName}`).toBe(bonus);
      }
    });

    it('applies Thaumaturge divine order to Arcana/Religion from the COMPUTED Wisdom mod', async () => {
      // CLA-265: stored abilities carry no `bonus` field — the order bonus must
      // come from the computed modifier (abilityCalc2024.js:43-57). All rows
      // below use the raw stored shape (no `bonus` key).
      // raw stored shape: +1 improvements arrive via backgroundIncrease, no `bonus` key
      const orderStats = (wis, int, boost) => fullScores({ Wisdom: wis, Intelligence: int }).map(a =>
        boost && (a.name === 'Intelligence' || a.name === 'Wisdom') ? { ...a, backgroundIncrease: 1 } : a
      );

      // [wisdom, intelligence, boost, arcana, religion, history] with divineBonus = max(1, wisMod)
      const rows = [
        [14, 10, false, 2, 2, 0], // WIS +2: 0 + 2 on each; History unaffected control
        [8, 10, false, 1, 1, 0], // WIS -1: minimum +1 applies
        [15, 8, true, 2, 2, -1], // CLA-265: INT 8+1=9 (-1) + computed WIS 15+1=16 (+3) = 2
      ];
      for (const [wis, int, boost, arcana, religion, history] of rows) {
        const result = await getAbilities(makeStats({
          level: 20,
          abilities: orderStats(wis, int, boost),
          class: { name: 'Cleric', divineOrder: 'Thaumaturge', saving_throw_proficiencies: [] },
        }));
        const skills = result.find(a => a.name === 'Intelligence').skills;
        const got = [
          skills.find(s => s.name === 'Arcana').bonus,
          skills.find(s => s.name === 'Religion').bonus,
          skills.find(s => s.name === 'History').bonus,
        ];
        expect(got, `WIS ${wis}`).toEqual([arcana, religion, history]);
      }

      // Guard: divineOrder on a non-Cleric grants nothing
      const guard = await getAbilities(makeStats({
        abilities: orderStats(16, 10, false),
        class: { name: 'Druid', divineOrder: 'Thaumaturge', saving_throw_proficiencies: [] },
      }));
      const guardSkills = guard.find(a => a.name === 'Intelligence').skills;
      expect(guardSkills.find(s => s.name === 'Religion').bonus).toBe(0);
    });

    it('applies Magician primal order to Arcana/Nature from the COMPUTED Wisdom mod', async () => {
      // CLA-265 + Magician skill set differs from Thaumaturge (Nature, not Religion).
      const orderStats = (wis, int, boost) => fullScores({ Wisdom: wis, Intelligence: int }).map(a =>
        boost && (a.name === 'Intelligence' || a.name === 'Wisdom') ? { ...a, backgroundIncrease: 1 } : a
      );

      // [wisdom, intelligence, boost, arcana, nature, religion, history]
      const rows = [
        [16, 10, false, 3, 3, 0, 0], // WIS +3: primalBonus = max(1,3); Religion NOT buffed
        [9, 10, false, 1, 1, 0, 0], // WIS 9 (-1): minimum +1
        [15, 8, true, 2, 2, -1, -1], // CLA-265 raw shape: INT 9 (-1) + computed WIS 16 (+3) = 2
      ];
      for (const [wis, int, boost, arcana, nature, religion, history] of rows) {
        const result = await getAbilities(makeStats({
          level: 20,
          abilities: orderStats(wis, int, boost),
          class: { name: 'Druid', primalOrder: 'Magician', saving_throw_proficiencies: [] },
        }));
        const skills = result.find(a => a.name === 'Intelligence').skills;
        const got = [
          skills.find(s => s.name === 'Arcana').bonus,
          skills.find(s => s.name === 'Nature').bonus,
          skills.find(s => s.name === 'Religion').bonus,
          skills.find(s => s.name === 'History').bonus,
        ];
        expect(got, `WIS ${wis}`).toEqual([arcana, nature, religion, history]);
      }

      // Guard: primalOrder on a non-Druid grants nothing
      const guard = await getAbilities(makeStats({
        abilities: orderStats(16, 10, false),
        class: { name: 'Cleric', primalOrder: 'Magician', saving_throw_proficiencies: [] },
      }));
      const guardSkills = guard.find(a => a.name === 'Intelligence').skills;
      expect(guardSkills.find(s => s.name === 'Nature').bonus).toBe(0);
    });
  });

  describe('getHitPoints', () => {
    function makeStats(overrides = {}) {
      return {
        level: overrides.level ?? 1,
        abilities: overrides.abilities ?? [
          { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0, bonus: overrides.conBonus ?? 0 },
        ],
        class: { hit_point_die: 'd10', ...overrides.class },
        race: overrides.race ?? {},
        automation: overrides.automation ?? null,
      };
    }

    it('computes HP as max die + average per level + Con per level (2024 level-1 = max die + Con)', () => {
      // d10: 10 + 6*(level-1) + con*level — literals from the 2024 HP rule
      const table = [
        [1, 0, 10], // level-1 2024 rule: max die
        [1, 2, 12], // level-1: max die + Con
        [1, -1, 9], // negative Con modifier honored at level 1
        [2, 0, 16], // 10 + 6
        [5, 2, 44], // 10 + 24 + 10
        [20, 5, 224], // scale check: 10 + 114 + 100
        [0, 0, 4], // guard-falsifier: proves the (level-1) factor — 10 - 6
      ];
      for (const [level, conBonus, expected] of table) {
        expect(getHitPoints(makeStats({ level, conBonus })), `level ${level}, con ${conBonus}`).toBe(expected);
      }
    });

    it('parses string hit_point_die, falls back to hit_die, defaults invalid to d8', () => {
      expect(getHitPoints(makeStats({ class: { hit_point_die: 'd12' } }))).toBe(12);

      // hit_point_die missing -> hit_die fallback (abilityCalc2024.js:73)
      expect(getHitPoints(makeStats({ conBonus: 1, class: { hit_point_die: undefined, hit_die: 'd8' } }))).toBe(9);

      // unparseable die defaults to d8; level 2 distinguishes it from d10
      expect(getHitPoints(makeStats({ level: 2, class: { hit_point_die: 'invalid' } }))).toBe(13); // 8 + 5
    });

    it('stacks subrace and class.major per-level HP bonuses', () => {
      // 2024 axis: subclass bonus lives on class.major (abilityCalc2024.js:84),
      // not class.subclass as in the 5e twin (abilityCalc.js:49-50).
      expect(getHitPoints(makeStats({
        level: 5,
        conBonus: 2,
        class: { hit_point_die: 'd8' },
        race: { subrace: { hit_point_bonus_per_level: 1 } },
      }))).toBe(43); // 8 + 20 + 10 + 5

      expect(getHitPoints(makeStats({
        level: 3,
        conBonus: 1,
        class: { hit_point_die: 'd6', major: { hit_point_bonus_per_level: 2 } },
      }))).toBe(23); // 6 + 8 + 3 + 6

      expect(getHitPoints(makeStats({
        level: 3,
        conBonus: 1,
        class: { hit_point_die: 'd6', major: { hit_point_bonus_per_level: 2 } },
        race: { subrace: { hit_point_bonus_per_level: 1 } },
      }))).toBe(26); // both stack: 6 + 8 + 3 + 3 + 6
    });

    it('throws when the Constitution ability is missing (2024 diverges from 5e twin)', () => {
      // 5e defaults Con to 0 (abilityCalc.js:39-40, pinned at abilityCalc.test.js:261-269);
      // 2024 reads constitution.bonus unguarded (abilityCalc2024.js:72,78) and throws.
      expect(() => getHitPoints({
        level: 1,
        abilities: [{ name: 'Strength', baseScore: 10, featIncrease: 0, miscIncrease: 0, bonus: 0 }],
        class: { hit_point_die: 'd8' },
        race: {},
      })).toThrow();
    });

    it('folds static and expression max_hp_increase passives through the shared pipeline', () => {
      // Internals (missing amount, non-matching effect, fortified_health fold) are
      // unit-tested at carryingCapacity.test.js:15-59 (cite-refreshed post-#1245 —
      // the retired :14-63 range drifted when the ladder fold landed); this pins the getHitPoints seam.
      expect(getHitPoints(makeStats({
        class: { hit_point_die: 'd8' },
        automation: { passives: [{ type: 'passive_rule', effect: 'max_hp_increase', amount: 3 }] },
      }))).toBe(11); // d8 8 + 3

      // evaluateAutoExpression is mocked to return 5 app-wide in this file
      expect(getHitPoints(makeStats({
        class: { hit_point_die: 'd8' },
        automation: { passives: [{ type: 'passive_rule', effect: 'max_hp_increase', bonusExpression: '1d4+1' }] },
      }))).toBe(13); // 8 + 5

      expect(getHitPoints(makeStats())).toBe(10); // no automation: d10 base
    });
  });

  describe('getCarryingCapacity (re-export of carryingCapacity.js)', () => {
    it('is the identical re-export; behavior lives in carryingCapacity.test.js', () => {
      // Same module instance as the 5e twin uses (abilityCalc.js:4); full math is
      // canonical at abilityCalc.test.js:295-304 and carryingCapacity.test.js.
      expect(getCarryingCapacity).toBe(baseGetCarryingCapacity);
      expect(getCarryingCapacity({ abilities: [{ name: 'Strength', totalScore: 16 }] })).toBe(240); // 16 * 15
    });
  });
});
