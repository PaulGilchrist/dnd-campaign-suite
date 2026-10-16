// @maintained-by-ai
// skillValidation MAJOR lane (façade seam, canonical home): getSkillLimits' 'major' skill-choice pool —
// the join where getMajorFeatureProficiencyChoices rows become {source:'major'} pools and +choose allowance.
// Cited, not re-pinned here (upstream majorFeatureChoices.test.js): level gate (:85, lv2→[]/lv3 included),
// 5e & no-major guards (:64), features-without-proficiency_choices skip (:42,:106), choose||1 default (:80).
// This file's distinct value = the façade-level 'Skill: '-prefix filter, pool attribution, allowance math,
// and details append — verified as ONE positive pin + ONE parameterized zero-contribution guard.
// Disk honesty: ZERO fabricated data — fixtures are the verbatim disk Fighter (public/data/2024/classes.json).
// Disk scan: Student of War is the ONLY 2024 major feature on disk with 'Skill:' proficiency_choices
// (choose: 1), so the lv18 pin exercises the entire real major lane; tool-only rows exercise the filter.
// Flag for subdir expertise lane #2059 (from #2056): Assassin 'Infiltration Expertise' is disk lv9 with NO
// proficiency_choices (passive_rule automation only) — the flagged +2 expertise-source bug cannot originate in
// this façade lane (getSkillLimits reads proficiency_choices only) and must be pinned in expertise.js's
// description-parsing seam there.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
  fetchBackgroundData: vi.fn(),
  fetchFeatData: vi.fn(),
  loadFeatData: vi.fn(async () => []),
  loadEquipment: vi.fn(async () => []),
}));

import { getSkillLimits } from './skillValidation.js';

const clone = (x) => JSON.parse(JSON.stringify(x));
const diskClasses2024 = JSON.parse(readFileSync('public/data/2024/classes.json', 'utf8'));
const diskFighter = clone(diskClasses2024.find((c) => c.name === 'Fighter'));
const diskChampion = diskFighter.majors.find((m) => m.name === 'Champion');

// The one real Skill-bearing major row on disk: Fighter > Battle Master > Student of War lv3
// (choose 1 tool + choose 1 skill; the skill `from` list is the pool this lane must surface).
const studentOfWarSkills = diskFighter.majors
  .find((m) => m.name === 'Battle Master')
  .features.find((f) => f.name === 'Student of War')
  .proficiency_choices.find((pc) => pc.from[0].startsWith('Skill: '))
  .from.map((e) => e.substring(7).trim());

const formData = (overrides) => ({
  rules: '2024',
  level: 18,
  class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
  race: { name: 'Human' },
  ...overrides,
});

describe('skillValidation - major feature (Student of War) skill pools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue(diskFighter);
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({});
  });

  it('adds exactly one major pool off disk at lv18: Skill: entries only, +1 allowed, named in details', async () => {
    const result = await getSkillLimits(formData(), []);

    // class Choose 2 + Student of War 1; the major must not double-count or shift the total.
    expect(result.allowed).toBe(3);

    // Exact major lane: one entry only — proves the tool-only choice (17 Artisan's Tools) is
    // filtered out at the façade, the pool is verbatim disk, and attribution (count/featName) sticks.
    expect(result.skillChoiceSources.filter((s) => s.source === 'major')).toEqual([
      { source: 'major', count: 1, featName: 'Student of War', skills: studentOfWarSkills },
    ]);
    expect(studentOfWarSkills).toHaveLength(9); // disk sanity: the full Fighter skill list, no off-pool skills
    expect(result.details).toContain('Student of War: choose 1 from');
  });

  it.each([
    {
      title: 'below the lv3 feature gate',
      data: formData({ level: 2 }),
      allowed: 2, // class-only baseline
    },
    {
      title: 'the selected major has no skill choices (Champion)',
      data: formData({ class: { name: 'Fighter', subclass: { name: 'Champion' } } }),
      classData: { name: 'Fighter', skill_proficiencies: diskFighter.skill_proficiencies, majors: [diskChampion] },
      allowed: 2, // disk Champion ships no proficiency_choices on any feature
    },
    {
      title: 'the 5e ruleset never reads the 2024 majors container',
      data: formData({ rules: '5e' }),
      allowed: 4, // class 2 + core's hardcoded 5e background default 2; major contributes 0
    },
  ])('grants no major pool and no allowance when $title', async ({ data, classData, allowed }) => {
    if (classData) vi.mocked(dataLoader.fetchClassData).mockResolvedValue(classData);

    const result = await getSkillLimits(data, []);

    expect(result.skillChoiceSources.filter((s) => s.source === 'major')).toEqual([]);
    expect(result.allowed).toBe(allowed);
    expect(result.details).not.toContain('Student of War');
  });
});
