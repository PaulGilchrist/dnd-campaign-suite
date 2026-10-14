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
} from './skillValidation.js';

describe('skillValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSkillLimits', () => {
    it('should return skill limits for 2024 ruleset with class, race, and background', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        skill_proficiencies: 'Insight',
      });
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
        skill_proficiencies: 'Deception and Persuasion',
      });

      const result = await getSkillLimits({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        background: 'Charlatan',
      });

      expect(result.allowed).toBe(5);
      expect(result.fromClass.isChoice).toBe(true);
      expect(result.fromClass.count).toBe(2);
      expect(result.fromRace.skills).toEqual(['Insight']);
      expect(result.fromBackground.skills).toEqual(['Deception', 'Persuasion']);
    });

    it('should return skill limits for 5e ruleset with class and background', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        skill_proficiencies: 'Insight',
      });

      const result = await getSkillLimits({
        rules: '5e',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        background: 'Acolyte',
      });

      expect(result.allowed).toBe(5);
      expect(result.fromClass.isChoice).toBe(true);
      expect(result.fromBackground.count).toBe(2);
    });

    it('should return correct defaults when all data is null', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);

      const result5e = await getSkillLimits({ rules: '5e' });
      expect(result5e.allowed).toBe(2);
      expect(result5e.fromClass).toEqual({ count: 0, skills: [], isChoice: true });
      expect(result5e.fromRace).toEqual({ count: 0, skills: [], isChoice: false });
      expect(result5e.fromBackground).toEqual({ count: 2, skills: [], isChoice: true });

      const result2024 = await getSkillLimits({ rules: '2024' });
      expect(result2024.allowed).toBe(0);
      expect(result2024.fromClass.count).toBe(0);
      expect(result2024.fromRace.count).toBe(0);
      expect(result2024.fromBackground.count).toBe(0);
    });

    it('should handle race with no skill_proficiencies field', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 1 from Arcana',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const result = await getSkillLimits({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
      });

      expect(result.fromRace.count).toBe(0);
      expect(result.fromRace.skills).toEqual([]);
    });

    it('should default to 2 skill choices when no class, race, or background provided in 5e', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);

      const result = await getSkillLimits({ rules: '5e' });

      expect(result.allowed).toBe(2);
      expect(result.fromClass.count).toBe(0);
      expect(result.fromBackground.count).toBe(2);
    });
  });

  describe('getPreSelectedSkills', () => {
    it('should return pre-selected skills from race, background, and class (not choices)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        skill_proficiencies: 'Insight and Perception',
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Arcana',
      });

      const result = await getPreSelectedSkills({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Dwarf' },
      });

      expect(result).toEqual(['Insight', 'Perception', 'Arcana']);
    });

    it('should return pre-selected skills from background in 2024', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
        skill_proficiencies: 'Deception and Persuasion',
      });

      const result = await getPreSelectedSkills({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        background: 'Charlatan',
      });

      expect(result).toEqual(['Deception', 'Persuasion']);
    });

    it('should not pre-select skills for 5e backgrounds', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
        skill_proficiencies: 'Deception and Persuasion',
      });

      const result = await getPreSelectedSkills({
        rules: '5e',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        background: 'Acolyte',
      });

      expect(result).toEqual([]);
    });

    it('should not include choice skills as pre-selected', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        skill_proficiencies: 'Choose 1 from Insight, Perception',
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
      });

      const result = await getPreSelectedSkills({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
      });

      expect(result).toEqual([]);
    });

    it('should return empty array when no race or class provided', async () => {
      const result = await getPreSelectedSkills({ rules: '2024' });

      expect(result).toEqual([]);
    });
  });
});
