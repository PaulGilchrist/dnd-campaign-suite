import { describe, it, expect, vi, beforeEach } from 'vitest';
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

import {
  getSkillLimits,
  getPreSelectedSkills,
  getExpertiseLimits,
  validateSkills,
} from './skillValidation.js';

describe('skillValidation - Boon of Skill feat integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Boon of Skill feat', () => {
    const boonOfSkillFeat = {
      name: 'Boon Of Skill',
      index: 'boon-of-skill',
      benefits: [
        {
          name: 'All-Around Adept',
          description: 'You gain proficiency in all skills.',
          type: 'proficiency',
        },
        {
          name: 'Expertise',
          description: 'Choose one skill in which you lack Expertise. You gain Expertise in that skill.',
          type: 'proficiency',
        },
      ],
    };

    it('should return all 18 skills as allowed when Boon of Skill feat is selected', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.loadFeatData).mockResolvedValue([boonOfSkillFeat]);

      const result = await getSkillLimits({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        feats: ['Boon Of Skill'],
      }, [boonOfSkillFeat]);

      expect(result.allowed).toBe(18);
      expect(result.allSkillsGranted).toBe(true);
      expect(result.details).toContain('Boon of Skill');
    });

    it('should return all 18 skills as pre-selected when Boon of Skill feat is selected', async () => {
      vi.mocked(dataLoader.loadFeatData).mockResolvedValue([boonOfSkillFeat]);

      const result = await getPreSelectedSkills({
        rules: '2024',
        class: { name: 'Wizard' },
        feats: ['Boon Of Skill'],
      }, [boonOfSkillFeat]);

      expect(result).toHaveLength(18);
      expect(result).toContain('Acrobatics');
      expect(result).toContain('Stealth');
      expect(result).toContain('Perception');
    });

    it('should add +1 expertise slot from Boon of Skill feat', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [] },
          {
            level: 2,
            features: [
              { name: 'Expertise', feature_specific: { expertise: { count: 2 } } },
            ],
          },
        ],
      });
      vi.mocked(dataLoader.loadFeatData).mockResolvedValue([boonOfSkillFeat]);

      const result = await getExpertiseLimits({
        rules: '2024',
        class: { name: 'Rogue' },
        level: 2,
        feats: ['Boon Of Skill'],
      }, [boonOfSkillFeat]);

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(3);
      expect(result.details).toContain('+ 1 from feats');
    });

    it('should show no warnings when all 18 skills selected with Boon of Skill', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
        class_levels: [
          {
            level: 2,
            features: [
              { name: 'Expertise', feature_specific: { expertise: { count: 2 } } },
            ],
          },
        ],
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.loadFeatData).mockResolvedValue([boonOfSkillFeat]);

      const warnings = await validateSkills({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        feats: ['Boon Of Skill'],
        skillProficiencies: [
          'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History',
          'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception',
          'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival',
        ],
        expertSkills: ['Acrobatics'],
      }, [boonOfSkillFeat]);

      expect(warnings).toEqual([]);
    });

    it('should not match feat when Boon of Skill is not in the feats list', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.loadFeatData).mockResolvedValue([boonOfSkillFeat]);

      const result = await getSkillLimits({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        feats: ['Tough'],
      }, [boonOfSkillFeat]);

      expect(result.allowed).toBe(2);
      expect(result.allSkillsGranted).toBeUndefined();
    });

    it('should handle no feats array gracefully', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const result = await getSkillLimits({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
      }, []);

      expect(result.allowed).toBe(2);
    });

    it('should add expertise from feat when class has no expertise', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [{ level: 1, features: [] }],
      });
      vi.mocked(dataLoader.loadFeatData).mockResolvedValue([boonOfSkillFeat]);

      const result = await getExpertiseLimits({
        rules: '2024',
        class: { name: 'Fighter' },
        level: 1,
        feats: ['Boon Of Skill'],
      }, [boonOfSkillFeat]);

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
      expect(result.details).toContain('+ 1 from feats');
    });
  });
});
