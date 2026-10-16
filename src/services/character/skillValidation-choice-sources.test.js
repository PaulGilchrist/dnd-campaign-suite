// @maintained-by-ai
// skillValidation PAIR seam map (this file = choice-sources lane; core = skillValidation-core.test.js):
//   • choice-sources (HERE): WHERE skill choices come from — getSkillLimits' skillChoiceSources
//     attribution (source/count/pool per class/race/background/feat/race_feat lane), 5e guard.
//   • core: totals & fromClass/fromRace/fromBackground shapes, null-data defaults, getPreSelectedSkills.
//   • skillValidation.major-feature.test.js: canonical home for the 'major' lane (Student of War).
//     skillValidation-feats.test.js: canonical home for Boon of Skill all-skills short-circuit.
//     skillValidation.validation.test.js / .expertise.test.js: validateSkills messages / expertise slots.
// Disk honesty: all 2024 pool lanes run verbatim off public/data/2024/*.json (classes/feats/
// races/backgrounds). rules-validation.json (both rulesets) has NO skill entries — nothing to
// pin there; the only nearby anchor is background_languages:2, owned by background validation.
// Pools normalize "X, or Y" separators into bare skill names in BOTH the class lane
// (parse-skills.js) and the feat lane (getFeatProficiencyChoiceData's split regex) — pinned
// here against disk so a separator-handling regression in either lane fails loudly.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
  fetchBackgroundData: vi.fn(),
  fetchFeatData: vi.fn(),
  loadFeatData: vi.fn(),
  loadEquipment: vi.fn(async () => []),
}));

import { getSkillLimits } from './skillValidation.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const diskClasses2024 = JSON.parse(readFileSync('public/data/2024/classes.json', 'utf8'));
const diskFeats2024 = JSON.parse(readFileSync('public/data/2024/feats.json', 'utf8'));
const diskRaces2024 = JSON.parse(readFileSync('public/data/2024/races.json', 'utf8'));

const diskClass = (name) => clone(diskClasses2024.find((c) => c.name === name));
const diskRace = (name) => clone(diskRaces2024.find((r) => r.name === name));
const diskFeat = (name) => clone(diskFeats2024.find((f) => f.name === name));

describe('skillValidation - choice-sources lane (where skill choices come from)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attributes every 2024 pool verbatim off disk: background, class, Skillful race trait, and one entry per feat', async () => {
    const wizard = diskClass('Wizard');
    const human = diskRace('Human');
    const keenMind = diskFeat('Keen Mind');
    const observant = diskFeat('Observant');

    vi.mocked(dataLoader.fetchClassData).mockResolvedValue(wizard);
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(human);
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({ skill_proficiencies: 'Deception and Sleight of Hand' }); // verbatim public/data/2024/backgrounds.json Charlatan
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([keenMind, observant]);

    const result = await getSkillLimits(
      { rules: '2024', class: { name: 'Wizard' }, race: { name: 'Human' }, background: 'Charlatan', feats: ['Keen Mind', 'Observant'] },
      [keenMind, observant],
    );

    // class 2 + race 1 + background 2 + Keen Mind 1 + Observant 1
    expect(result.allowed).toBe(7);

    // Class pool matches the disk string verbatim; "or Religion" IS normalized here...
    expect(result.skillChoiceSources).toContainEqual({
      source: 'class',
      count: 2,
      skills: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Nature', 'Religion'],
    });

    // Human Skillful: one pool of all 18 skills straight off the race trait's proficiency_choices.
    const skillful = human.traits.find((t) => t.name === 'Skillful').proficiency_choices;
    expect(result.skillChoiceSources).toContainEqual({
      source: 'race',
      count: skillful.choose,
      skills: skillful.from.map((s) => s.replace('Skill: ', '').trim()),
    });

    // ...and the feat lane normalizes the trailing "or X" the same way.
    expect(result.skillChoiceSources).toContainEqual({
      source: 'feat',
      featName: 'Keen Mind',
      count: 1,
      skills: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'], // disk: "…Nature, or Religion"
    });
    expect(result.skillChoiceSources).toContainEqual({
      source: 'feat',
      featName: 'Observant',
      count: 1,
      skills: ['Insight', 'Investigation', 'Perception'], // disk: "Insight, Investigation, or Perception"
    });

    // Attribution stays discriminating: feat pools never leak class-only skills.
    const featPools = result.skillChoiceSources.filter((s) => s.source === 'feat');
    featPools.forEach((pool) => {
      expect(pool.skills).not.toContain('Medicine');
      expect(pool.skills).not.toContain('Sleight of Hand');
    });
    expect(result.details).toContain('Keen Mind: choose 1 from');
    expect(result.details).toContain('Observant: choose 1 from');
  });

  it('omits lanes that supply nothing: missing background field, unknown feat name, allSkillsGranted false', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ skill_proficiencies: 'Choose 2: Arcana, History' });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({}); // no skill_proficiencies field
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([diskFeat('Keen Mind')]);

    const result = await getSkillLimits(
      { rules: '2024', class: { name: 'Wizard' }, race: { name: 'Human' }, background: 'Unknown', feats: ['Not A Real Feat'] },
      [diskFeat('Keen Mind')],
    );

    expect(result.allowed).toBe(2); // class only — silent, graceful
    expect(result.skillChoiceSources).toEqual([
      { source: 'class', count: 2, skills: ['Arcana', 'History'] },
    ]);
    expect(result.allSkillsGranted).toBeFalsy();
    expect(result.details).not.toContain('In 5e rules');
  });

  it('parses singular "choose one" feat pools and Human Versatile origin-feat candidates without polluting skill pools', async () => {
    const keenMind = diskFeat('Keen Mind');
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ skill_proficiencies: 'Choose 2: Arcana, History' });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(diskRace('Human'));
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({});
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([keenMind]);

    const result = await getSkillLimits(
      { rules: '2024', class: { name: 'Wizard' }, race: { name: 'Human' }, feats: ['Keen Mind'] },
      [keenMind],
    );

    // class 2 + race Skillful 1 + Keen Mind 1
    expect(result.allowed).toBe(4);

    expect(result.skillChoiceSources).toContainEqual({
      source: 'feat',
      featName: 'Keen Mind',
      count: 1,
      skills: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'],
    });

    // Human Versatile lists origin-feat candidates (Crafter...Tough) that grant tools, spells,
    // or Skilled-style "any combination" — none match the restricted-skill-list regex, so no
    // race_feat pool and no invented Versatile choice may appear.
    const versatileFrom = diskRace('Human').traits.find((t) => t.name === 'Versatile').proficiency_choices.from;
    expect(result.skillChoiceSources.find((s) => s.featName === 'Versatile')).toBeUndefined();
    expect(result.skillChoiceSources.find((s) => s.source === 'race_feat')).toBeUndefined();
    versatileFrom.forEach((name) => {
      expect(result.skillChoiceSources.find((s) => s.featName === name)).toBeUndefined();
    });
  });

  it('builds 5e choice sources from class + feat pools only — no 2024-only background or major lanes leak in', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ skill_proficiencies: 'Choose 2 from Arcana, History' });
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({ skill_proficiencies: 'Insight and Religion' });
    vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);

    const result = await getSkillLimits(
      { rules: '5e', class: { name: 'Wizard' }, race: { name: 'Human' }, background: 'Acolyte' },
      [],
    );

    // Only the class lane joins the pool array; 5e backgrounds stay count-only (isChoice).
    expect(result.skillChoiceSources).toEqual([
      { source: 'class', count: 2, skills: ['Arcana', 'History'] },
    ]);
    expect(result.fromBackground).toEqual({ count: 2, skills: [], isChoice: true });
    expect(result.details).toContain('In 5e rules');
  });
});
