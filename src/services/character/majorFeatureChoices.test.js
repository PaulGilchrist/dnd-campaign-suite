import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  fetchClassData: vi.fn(),
}));

import { getMajorFeatureProficiencyChoices } from './majorFeatureChoices.js';

const battleMasterMajor = {
  name: 'Battle Master',
  proficiency_choices: null,
  features: [
    { name: 'Improved Combat Superiority', level: 10, description: '...' },
    {
      name: 'Student of War',
      level: 3,
      description: "Gain proficiency with one type of Artisan's Tools and one skill of your choice from Fighter skills.",
      proficiency_choices: [
        { choose: 1, from: ["Tool: Alchemist's Supplies", "Tool: Smith's Tools"] },
        { choose: 1, from: ['Skill: Acrobatics', 'Skill: History', 'Skill: Perception'] },
      ],
    },
  ],
};

describe('majorFeatureChoices - getMajorFeatureProficiencyChoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      name: 'Fighter',
      majors: [battleMasterMajor],
    });
  });

  it('returns empty for 5e ruleset', async () => {
    const result = await getMajorFeatureProficiencyChoices({
      rules: '5e',
      level: 18,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
    });
    expect(result).toEqual([]);
    expect(dataLoader.fetchClassData).not.toHaveBeenCalled();
  });

  it('returns empty when no class or no major selected', async () => {
    expect(await getMajorFeatureProficiencyChoices({ rules: '2024' })).toEqual([]);
    expect(await getMajorFeatureProficiencyChoices({ rules: '2024', class: { name: 'Fighter' } })).toEqual([]);
  });

  it('resolves Student of War choices from major.features for a Battle Master lv18', async () => {
    const result = await getMajorFeatureProficiencyChoices({
      rules: '2024',
      level: 18,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      featureName: 'Student of War',
      choose: 1,
      from: ["Tool: Alchemist's Supplies", "Tool: Smith's Tools"],
    });
    expect(result[1]).toEqual({
      featureName: 'Student of War',
      choose: 1,
      from: ['Skill: Acrobatics', 'Skill: History', 'Skill: Perception'],
    });
  });

  it('excludes feature choices below the character level (lv2 has no Student of War)', async () => {
    const result = await getMajorFeatureProficiencyChoices({
      rules: '2024',
      level: 2,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
    });
    expect(result).toEqual([]);
  });

  it('includes Student of War exactly at level 3', async () => {
    const result = await getMajorFeatureProficiencyChoices({
      rules: '2024',
      level: 3,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
    });
    expect(result).toHaveLength(2);
  });

  it('accepts class.major.name as well as class.subclass.name', async () => {
    const result = await getMajorFeatureProficiencyChoices({
      rules: '2024',
      level: 18,
      class: { name: 'Fighter', major: { name: 'Battle Master' } },
    });
    expect(result).toHaveLength(2);
  });

  it('returns empty when major not found in class data or lacks features', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ name: 'Fighter', majors: [] });
    expect(await getMajorFeatureProficiencyChoices({
      rules: '2024',
      level: 18,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
    })).toEqual([]);

    vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
    expect(await getMajorFeatureProficiencyChoices({
      rules: '2024',
      level: 18,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
    })).toEqual([]);
  });
});
