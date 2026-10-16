// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => {
  return {
    fetchClassData: vi.fn(),
  };
});

import { getMajorFeatureProficiencyChoices } from './majorFeatureChoices.js';

// Synthetic fixture: Student of War values are verbatim from
// public/data/2024/classes.json (Fighter > Battle Master), lists truncated.
// The real Battle Master has exactly one choice-bearing feature (Student of War, lv3),
// so the synthetic lv10 feature and the non-null major-level proficiency_choices
// exist solely to exercise the level filter, the choose||1 default, the
// empty-from filter, and the "choices live on features, not majors" contract.
const studentOfWar = {
  name: 'Student of War',
  level: 3,
  description: "Gain proficiency with one type of Artisan's Tools and one skill of your choice from Fighter skills.",
  proficiency_choices: [
    { choose: 1, from: ["Tool: Alchemist's Supplies", "Tool: Smith's Tools"] },
    { choose: 1, from: ['Skill: Acrobatics', 'Skill: History', 'Skill: Perception'] },
  ],
};

const syntheticLv10Feature = {
  name: 'Synthetic Battle Study',
  level: 10,
  proficiency_choices: [
    { from: ['Tool: Mason\'s Tools', 'Skill: Insight'] }, // choose omitted → defaults to 1
    { choose: 2, from: [] }, // empty from → excluded
  ],
};

const battleMasterMajor = {
  name: 'Battle Master',
  proficiency_choices: [{ choose: 1, from: ['Skill: Sleight of Hand'] }], // must be ignored (feature-only contract)
  features: [
    { name: 'Improved Combat Superiority', level: 10, description: 'Superiority Die becomes d10.' },
    studentOfWar,
    syntheticLv10Feature,
  ],
};

const formData = (overrides) => ({
  rules: '2024',
  level: 18,
  class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
  ...overrides,
});

describe('majorFeatureChoices - getMajorFeatureProficiencyChoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      name: 'Fighter',
      majors: [battleMasterMajor],
    });
  });

  it('returns [] without fetching for 5e or when no major is selected', async () => {
    expect(await getMajorFeatureProficiencyChoices(formData({ rules: '5e' }))).toEqual([]);
    expect(await getMajorFeatureProficiencyChoices(formData({ rules: undefined }))).toEqual([]);
    expect(await getMajorFeatureProficiencyChoices({ rules: '2024' })).toEqual([]);
    expect(await getMajorFeatureProficiencyChoices(formData({ class: { name: 'Fighter' } }))).toEqual([]);
    expect(dataLoader.fetchClassData).not.toHaveBeenCalled();
  });

  it('extracts reached feature choices for a lv18 Battle Master with exact envelope', async () => {
    const result = await getMajorFeatureProficiencyChoices(formData());

    // Exact pin: feature order preserved, featureName attached, choose||1 default,
    // empty-from choice and major-level proficiency_choices excluded.
    expect(result).toEqual([
      { featureName: 'Student of War', choose: 1, from: ["Tool: Alchemist's Supplies", "Tool: Smith's Tools"] },
      { featureName: 'Student of War', choose: 1, from: ['Skill: Acrobatics', 'Skill: History', 'Skill: Perception'] },
      { featureName: 'Synthetic Battle Study', choose: 1, from: ['Tool: Mason\'s Tools', 'Skill: Insight'] },
    ]);
    expect(dataLoader.fetchClassData).toHaveBeenCalledWith('Fighter', '2024');
  });

  it('includes only features at or below the character level (default level 1)', async () => {
    const namesAt = async (level) => {
      const result = await getMajorFeatureProficiencyChoices(formData({ level }));
      return result.map(c => c.featureName);
    };

    expect(await namesAt(undefined)).toEqual([]); // level || 1 → nothing at lv1
    expect(await namesAt(2)).toEqual([]); // below Student of War
    expect(await namesAt(3)).toEqual(['Student of War', 'Student of War']); // exact level included
    expect(await namesAt(10)).toEqual(['Student of War', 'Student of War', 'Synthetic Battle Study']);
  });

  it('resolves the major by class.major.name as well as class.subclass.name', async () => {
    const viaMajor = await getMajorFeatureProficiencyChoices(
      formData({ class: { name: 'Fighter', major: { name: 'Battle Master' } } }),
    );
    const viaSubclass = await getMajorFeatureProficiencyChoices(formData());
    expect(viaMajor).toEqual(viaSubclass); // subclass lane pinned exactly in the lv18 test
    expect(viaMajor).toHaveLength(3);
  });

  it('returns [] when class data is missing, the major is absent, or it has no features', async () => {
    const byMajorName = formData({ class: { name: 'Fighter', subclass: { name: 'Battle Master' } } });

    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ name: 'Fighter', majors: [] });
    expect(await getMajorFeatureProficiencyChoices(byMajorName)).toEqual([]);

    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      name: 'Fighter',
      majors: [{ name: 'Champion', features: [studentOfWar] }], // name mismatch
    });
    expect(await getMajorFeatureProficiencyChoices(byMajorName)).toEqual([]);

    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      name: 'Fighter',
      majors: [{ name: 'Battle Master' }], // major exists but no features
    });
    expect(await getMajorFeatureProficiencyChoices(byMajorName)).toEqual([]);

    vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
    expect(await getMajorFeatureProficiencyChoices(byMajorName)).toEqual([]);
  });
});
