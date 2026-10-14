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

import { getSkillLimits } from './skillValidation.js';

describe('skillValidation - Skill choice sources with restricted pools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSkillLimits with feat skill pools', () => {
    const keenMindFeat = {
      name: 'Keen Mind',
      index: 'keen-mind',
      benefits: [
        {
          name: 'Ability Score Increase',
          description: 'Increase your Intelligence score by 1, to a maximum of 20.',
          type: 'ability_score_increase',
        },
        {
          name: 'Lore Knowledge',
          description: 'Choose one of the following skills: Arcana, History, Investigation, Nature, or Religion. If you lack proficiency in the chosen skill, you gain proficiency in it, and if you already have proficiency in it, you gain Expertise in it.',
          type: 'proficiency',
        },
      ],
    };

    const observantFeat = {
      name: 'Observant',
      index: 'observant',
      benefits: [
        {
          name: 'Ability Score Increase',
          description: 'Increase your Intelligence or Wisdom score by 1, to a maximum of 20.',
          type: 'ability_score_increase',
        },
        {
          name: 'Keen Observer',
          description: 'Choose one of the following skills: Insight, Investigation, or Perception. If you lack proficiency with the chosen skill, you gain proficiency in it, and if you already have proficiency in it, you gain Expertise in it.',
          type: 'proficiency',
        },
      ],
    };

    it('should parse "Choose X:" format with "or" separator from class skill_proficiencies', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2: Arcana, History, Insight, Investigation, Medicine, Nature, or Religion',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const result = await getSkillLimits({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
      });

      expect(result.fromClass.count).toBe(2);
      expect(result.fromClass.skills).toEqual(['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Nature', 'Religion']);
    });

    it('should build skillChoiceSources array with correct order and structure for class, background, and feat pools', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2: Arcana, History, Insight, Investigation, Medicine, Nature, or Religion',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
        skill_proficiencies: 'Deception and Persuasion',
      });
      vi.mocked(dataLoader.loadFeatData).mockResolvedValue([keenMindFeat, observantFeat]);

      const result = await getSkillLimits({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        background: 'Charlatan',
        feats: ['Keen Mind', 'Observant'],
      }, [keenMindFeat, observantFeat]);

      expect(result.allowed).toBe(6);
      expect(result.skillChoiceSources).toHaveLength(4);

      // Background is non-choice, added first in 2024
      expect(result.skillChoiceSources[0]).toEqual({
        source: 'background',
        count: 2,
        skills: ['Deception', 'Persuasion'],
      });
      // Class choice is added second
      expect(result.skillChoiceSources[1]).toEqual({
        source: 'class',
        count: 2,
        skills: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Nature', 'Religion'],
      });
      // Feats are added after class/race
      expect(result.skillChoiceSources[2].source).toBe('feat');
      expect(result.skillChoiceSources[2].featName).toBe('Keen Mind');
      expect(result.skillChoiceSources[2].count).toBe(1);
      expect(result.skillChoiceSources[3].featName).toBe('Observant');
      expect(result.skillChoiceSources[3].count).toBe(1);
    });

    it('should handle feat not found in allFeats array gracefully', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2: Arcana, History, Insight, Investigation, Medicine, Nature, or Religion',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({});
      vi.mocked(dataLoader.loadFeatData).mockResolvedValue([]);

      const result = await getSkillLimits({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        feats: ['Keen Mind'],
      }, []);

      expect(result.allowed).toBe(2);
      expect(result.skillChoiceSources).toHaveLength(1);
      expect(result.skillChoiceSources[0].source).toBe('class');
    });

    it('should parse "choose one" singular format without explicit number in feat descriptions', async () => {
      const chooseOneFeat = {
        name: 'Choose One Feat',
        index: 'choose-one-feat',
        benefits: [
          {
            name: 'Skill Choice',
            description: 'Choose one of the following skills: Athletics, Acrobatics, or Stealth. You gain proficiency in the chosen skill.',
            type: 'proficiency',
          },
        ],
      };

      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2: Arcana, History',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({});
      vi.mocked(dataLoader.loadFeatData).mockResolvedValue([chooseOneFeat]);

      const result = await getSkillLimits({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        feats: ['Choose One Feat'],
      }, [chooseOneFeat]);

      expect(result.allowed).toBe(3);
      expect(result.skillChoiceSources).toHaveLength(2);
      expect(result.skillChoiceSources[1].source).toBe('feat');
      expect(result.skillChoiceSources[1].featName).toBe('Choose One Feat');
      expect(result.skillChoiceSources[1].skills).toEqual(['Athletics', 'Acrobatics', 'Stealth']);
    });

    it('should handle background with no skill_proficiencies field', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2: Arcana, History, Insight',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({});

      const result = await getSkillLimits({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        background: 'Unknown',
        feats: ['Keen Mind'],
      }, [keenMindFeat]);

      expect(result.allowed).toBe(3);
      expect(result.skillChoiceSources).toHaveLength(2);
      expect(result.skillChoiceSources[0].source).toBe('class');
      expect(result.skillChoiceSources[1].source).toBe('feat');
    });
  });
});
