import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const fighterClassData = {
  name: 'Fighter',
  skill_proficiencies: 'Choose 2: Acrobatics, Animal Handling, Athletics, History, Insight, Intimidation, Persuasion, Perception, or Survival',
  majors: [
    {
      name: 'Battle Master',
      proficiency_choices: null,
      features: [
        {
          name: 'Student of War',
          level: 3,
          proficiency_choices: [
            { choose: 1, from: ["Tool: Alchemist's Supplies", "Tool: Smith's Tools"] },
            { choose: 1, from: ['Skill: Acrobatics', 'Skill: Animal Handling', 'Skill: Athletics', 'Skill: History', 'Skill: Insight', 'Skill: Intimidation', 'Skill: Persuasion', 'Skill: Perception', 'Skill: Survival'] },
          ],
        },
      ],
    },
  ],
};

describe('skillValidation - major feature (Student of War) skill pools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue(fighterClassData);
    vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
    vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({});
  });

  it('adds a major-skill-choice pool and +1 allowed for Battle Master lv18', async () => {
    const result = await getSkillLimits({
      rules: '2024',
      level: 18,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
      race: { name: 'Human' },
    }, []);

    expect(result.allowed).toBe(3);
    const majorSource = result.skillChoiceSources.find(s => s.source === 'major');
    expect(majorSource).toBeDefined();
    expect(majorSource.featName).toBe('Student of War');
    expect(majorSource.count).toBe(1);
    expect(majorSource.skills).toContain('History');
    expect(majorSource.skills).not.toContain('Arcana');
    expect(result.details).toContain('Student of War: choose 1 from');
  });

  it('excludes tool-only choices from the skill pools', async () => {
    const result = await getSkillLimits({
      rules: '2024',
      level: 18,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
    }, []);

    result.skillChoiceSources.forEach(source => {
      source.skills.forEach(skill => {
        expect(skill.startsWith('Tool')).toBe(false);
      });
    });
  });

  it('grants no major skill pool below feature level (lv2)', async () => {
    const result = await getSkillLimits({
      rules: '2024',
      level: 2,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
    }, []);

    expect(result.skillChoiceSources.find(s => s.source === 'major')).toBeUndefined();
    expect(result.allowed).toBe(2);
  });

  it('grants no major skill pool for a major without feature proficiency_choices', async () => {
    vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
      name: 'Fighter',
      skill_proficiencies: fighterClassData.skill_proficiencies,
      majors: [{ name: 'Champion', features: [{ name: 'Improved Critical', level: 3 }] }],
    });

    const result = await getSkillLimits({
      rules: '2024',
      level: 18,
      class: { name: 'Fighter', subclass: { name: 'Champion' } },
    }, []);

    expect(result.skillChoiceSources.find(s => s.source === 'major')).toBeUndefined();
    expect(result.allowed).toBe(2);
  });

  it('does not add major pools for 5e ruleset', async () => {
    const result = await getSkillLimits({
      rules: '5e',
      level: 18,
      class: { name: 'Fighter', subclass: { name: 'Battle Master' } },
    }, []);

    expect(result.skillChoiceSources.find(s => s.source === 'major')).toBeUndefined();
  });
});
