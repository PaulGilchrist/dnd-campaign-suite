// @maintained-by-ai
// Parity contract (fix#81 precedent): the expertise law in abilityCalc.js (5e)
// and abilityCalc2024.js (2024) is ONE contract across twins — both rulesets
// must produce byte-equal skill bonuses for the same inputs. RAW: expertise
// doubles the proficiency bonus ONLY where already proficient ("Choose two of
// your skill proficiencies" — classes.json Bard/Rogue; 2024/classes.json Bard/
// Rogue/Ranger Expertise rows). Defect pair #1231/#1232 fixed identically;
// this lane is the drift-alarm if either twin ever diverges again.
import { describe, it, expect, vi } from 'vitest';
import { cloneDeep } from 'lodash';
import { getAbilities as getAbilities5e } from './abilityCalc.js';
import { getAbilities as getAbilities2024 } from './abilityCalc2024.js';

const mockSkills = [
  { name: 'Athletics', ability: 'Strength' },
  { name: 'Acrobatics', ability: 'Dexterity' },
  { name: 'Sleight of Hand', ability: 'Dexterity' },
  { name: 'Stealth', ability: 'Dexterity' },
  { name: 'Arcana', ability: 'Intelligence' },
  { name: 'History', ability: 'Intelligence' },
  { name: 'Perception', ability: 'Wisdom' },
];

vi.mock('../../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(() => Promise.resolve(mockSkills)),
  loadWildMagicSurgeTable: vi.fn(async () => []),
}));

// Neutral racial axis so the 5e twin's getRacialBonus cannot skew parity.
vi.mock('../../character/race-rules/index.js', () => ({
  rules5e: { getRacialBonus: vi.fn(() => 0) },
}));

vi.mock('../../combat/automation/automationExpressions.js', () => ({
  evaluateAutoExpression: vi.fn(() => 0),
}));

describe('abilityCalc expertise parity (5e twin vs 2024 twin)', () => {
  // One stats shape satisfying both reader axes: 5e class.saving_throws,
  // 2024 class.saving_throw_proficiencies; non-Barbarian/Monk so no epic boons.
  const parityStats = (skillProficiencies, expertise) => ({
    level: 5, // proficiency +3 both rulesets (identical formula at :9 / :8)
    abilities: [
      { name: 'Strength', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Dexterity', baseScore: 14, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Constitution', baseScore: 12, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Wisdom', baseScore: 13, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Charisma', baseScore: 8, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    ],
    class: {
      name: 'Rogue',
      hit_die: 8,
      saving_throws: ['Dexterity'],
      saving_throw_proficiencies: ['Dexterity'],
    },
    race: { name: 'Human', subrace: null },
    skillProficiencies,
    expertise,
    saveProficiencies: [],
  });

  const skillBonuses = (abilities) => abilities
    .flatMap(a => a.skills.map(s => `${s.name}:${s.bonus}`))
    .sort();

  it('both twins output-equal across the full 4-quadrant expertise table', async () => {
    const cases = [
      // [label, skillProficiencies, expertise]
      ['expert + proficient', ['Stealth'], ['Stealth']],
      ['expert, NOT proficient', [], ['Stealth']], // RAW + post-fix: zero expertise bonus
      ['proficient only', ['Stealth'], []],
      ['neither', [], []],
      ['mixed legal + illegal marks', ['Sleight of Hand'], ['Sleight of Hand', 'Arcana']],
    ];
    for (const [label, skillProficiencies, expertise] of cases) {
      const stats = parityStats(skillProficiencies, expertise);
      const [r5e, r2024] = await Promise.all([
        getAbilities5e(cloneDeep(stats)),
        getAbilities2024(cloneDeep(stats)),
      ]);
      const flat5e = skillBonuses(r5e);
      const flat2024 = skillBonuses(r2024);
      expect(flat2024, `${label}: twin skill bonuses diverge`).toEqual(flat5e);
    }
  });

  it('parity output matches the RAW law (not just mutual agreement)', async () => {
    const stats = parityStats(['Stealth', 'Sleight of Hand'], ['Stealth', 'Arcana']);
    const [r5e, r2024] = await Promise.all([
      getAbilities5e(cloneDeep(stats)),
      getAbilities2024(cloneDeep(stats)),
    ]);
    // level 5 prof +3; DEX +2, INT +0
    for (const [ruleset, result] of [['5e', r5e], ['2024', r2024]]) {
      const skill = (name) => result.flatMap(a => a.skills).find(s => s.name === name);
      expect(skill('Stealth').bonus, `${ruleset} expert+proficient`).toBe(8);     // 2 + 3 + 3
      expect(skill('Arcana').bonus, `${ruleset} expert-not-proficient`).toBe(0);   // no phantom +3
      expect(skill('Sleight of Hand').bonus, `${ruleset} proficient-only`).toBe(5); // 2 + 3
      expect(skill('Acrobatics').bonus, `${ruleset} neither`).toBe(2);              // bonus only
    }
  });
});
