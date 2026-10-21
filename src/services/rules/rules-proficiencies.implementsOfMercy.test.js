// @maintained-by-ai
// CLA-181 — Implements of Mercy (2024 Warrior of Mercy monk major, classes.json lv3):
// "Gain proficiency in Insight and Medicine skills and Herbalism Kit."
// Rules-root lane: pins getProficiencies (rules-proficiencies.js 2024 path wiring
// bonusSource = class.major) end-to-end against real disk data. The utility-level
// merge and the featuresToIgnore constant are owned by proficiencyUtils.test.js and
// featureCategories2024.test.js respectively; PB tiers are owned by
// abilityCalc2024.test.js — this file pins only the grant wiring + bonus integration.
import { describe, it, expect, vi } from 'vitest';
import { cloneDeep } from 'lodash';
import { getProficiencies } from './rules-proficiencies.js';
import { getAbilities } from './core/abilityCalc2024.js';
import classRules from '../character/classRules2024.js';
import classesData from '../../../public/data/2024/classes.json';

// Provider seam: dataLoader fetches over HTTP — serve REAL disk data instead.
// getCachedBackgroundData is keyed strictly by version: any other key throws.
// Dynamic imports inside the factory (vi.mock hoists above static imports).
vi.mock('../ui/dataLoader.js', async () => {
  const abilityScores = (await import('../../../public/data/ability-scores.json')).default;
  const backgrounds = (await import('../../../public/data/2024/backgrounds.json')).default;
  return {
    loadSkills: vi.fn(async () =>
      abilityScores.flatMap(a => a.skills.map(name => ({ name, ability: a.full_name })))),
    getCachedBackgroundData: vi.fn((version = '5e') => {
      if (version === '2024') return backgrounds;
      throw new Error('unexpected getCachedBackgroundData version: ' + version);
    }),
  };
});

// Mutually-distinguishable fixture: pre-selected skillProficiencies deliberately
// exclude Insight and Medicine, so any appearance of those names in the pool can
// only come from the Warrior of Mercy bonus_proficiencies merge (CLA-181).
// Wisdom 16 (+3) at level 17 (PB +6) makes proficient skills land on +9 exactly.
function makeMercyMonk() {
  const summary = {
    name: 'MercyMonk',
    level: 17,
    rules: '2024',
    class: { name: 'Monk', major: { name: 'Warrior of Mercy' } },
    background: 'Acolyte',
    skillProficiencies: ['Religion'],
    abilities: [
      { name: 'Strength', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Dexterity', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Constitution', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Intelligence', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Wisdom', baseScore: 16, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
      { name: 'Charisma', baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
    ],
  };
  const playerStats = cloneDeep(summary);
  playerStats.class = classRules.getClass(classesData, summary);
  playerStats.race = { traits: [], starting_proficiencies: [] };
  return playerStats;
}

describe('CLA-181 Implements of Mercy — rules-proficiencies (2024 Warrior of Mercy)', () => {
  it('disk row: Warrior of Mercy major declares exactly the three bonus_proficiencies bytes', () => {
    const monk = classesData.find(c => c.name === 'Monk');
    const major = monk.majors.find(m => m.name === 'Warrior of Mercy');
    expect(major.bonus_proficiencies).toEqual(['Skill: Insight', 'Skill: Medicine', 'Herbalism Kit']);
  });

  it('skill lane grants Insight and Medicine beyond the selected Religion — full tuple', () => {
    const playerStats = makeMercyMonk();
    expect(getProficiencies(playerStats, true, playerStats)).toEqual([2, ['Insight', 'Medicine', 'Religion']]);
  });

  it('tool lane: Herbalism Kit joins the non-skill pool with Acolyte background tool, no Skill: rows leak', () => {
    const playerStats = makeMercyMonk();
    expect(getProficiencies(playerStats, false, playerStats)).toEqual(
      [4, ["Calligrapher's Supplies", 'Herbalism Kit', 'Light Martial Weapons', 'Simple Weapons']]
    );
  });

  it('granted skills compute as WIS mod + PB while non-proficient WIS controls stay at mod', async () => {
    const playerStats = makeMercyMonk();
    const [, skillProfs] = getProficiencies(playerStats, true, playerStats);
    const abilities = await getAbilities({ ...playerStats, skillProficiencies: skillProfs });
    const wisdom = abilities.find(a => a.name === 'Wisdom');
    expect(wisdom.bonus).toBe(3);
    expect(Object.fromEntries(wisdom.skills.map(s => [s.name, s.bonus]))).toEqual({
      'Animal Handling': 3,
      'Insight': 9,
      'Medicine': 9,
      'Perception': 3,
      'Survival': 3,
    });
  });

  it('classRules.getFeatures surfaces the lv3 Implements of Mercy row in characterAdvancement', () => {
    const playerStats = makeMercyMonk();
    const rows = classRules.getFeatures(playerStats).characterAdvancement.filter(f => f.name === 'Implements of Mercy');
    expect(rows).toEqual([{
      name: 'Implements of Mercy',
      level: 3,
      description: 'Gain proficiency in Insight and Medicine skills and Herbalism Kit.',
    }]);
  });
});
