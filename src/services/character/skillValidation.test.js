// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
  fetchBackgroundData: vi.fn(),
}));

import {
  getSkillLimits,
  getPreSelectedSkills,
  getExpertiseLimits,
  validateSkills,
  getSkillInfo,
} from './skillValidation.js';

describe('skillValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSkillLimits', () => {
    it('should return skill limits for 2024 ruleset', async () => {
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

    it('should return skill limits for 5e ruleset', async () => {
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

    it('should return defaults when all data is null', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);

      const result = await getSkillLimits({});

      expect(result.allowed).toBe(2);
      expect(result.fromClass).toEqual({ count: 0, skills: [], isChoice: true });
      expect(result.fromRace).toEqual({ count: 0, skills: [], isChoice: false });
      expect(result.fromBackground).toEqual({ count: 2, skills: [], isChoice: true });
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

    it('should parse "Choose X from..." format correctly', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 3 from Arcana, History, Insight, Religion',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const result = await getSkillLimits({
        rules: '2024',
        class: { name: 'Cleric' },
        race: { name: 'Human' },
      });

      expect(result.fromClass.count).toBe(3);
      expect(result.fromClass.skills).toEqual(['Arcana', 'History', 'Insight', 'Religion']);
    });

    it('should handle race with comma-separated skills', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        skill_proficiencies: 'Insight, Perception, Survival',
      });

      const result = await getSkillLimits({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Dwarf' },
      });

      expect(result.fromRace.skills).toEqual(['Insight', 'Perception', 'Survival']);
    });

    it('should return zero when no class, race, or background provided in 2024', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);

      const result = await getSkillLimits({ rules: '2024' });

      expect(result.allowed).toBe(0);
      expect(result.fromClass.count).toBe(0);
      expect(result.fromRace.count).toBe(0);
      expect(result.fromBackground.count).toBe(0);
    });

    it('should handle 5e background count override', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
      });

      const result = await getSkillLimits({
        rules: '5e',
        class: { name: 'Wizard' },
      });

      expect(result.allowed).toBe(4);
      expect(result.fromBackground.count).toBe(2);
      expect(result.fromBackground.isChoice).toBe(true);
    });
  });

  describe('getPreSelectedSkills', () => {
    it('should return pre-selected skills from race', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        skill_proficiencies: 'Insight and Perception',
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
      });

      const result = await getPreSelectedSkills({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Dwarf' },
      });

      expect(result).toEqual(['Insight', 'Perception']);
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

      const result = await getPreSelectedSkills({
        rules: '5e',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        background: 'Acolyte',
      });

      expect(result).toEqual([]);
    });

    it('should return empty array when no skills are pre-selected', async () => {
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

    it('should return pre-selected skills from class when not a choice', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Insight',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const result = await getPreSelectedSkills({
        rules: '2024',
        class: { name: 'Wizard' },
      });

      expect(result).toEqual(['Insight']);
    });

    it('should deduplicate skills from multiple sources', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        skill_proficiencies: 'Insight',
      });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Insight',
      });

      const result = await getPreSelectedSkills({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
      });

      expect(result).toEqual(['Insight']);
    });

    it('should return empty array when no race or class provided', async () => {
      const result = await getPreSelectedSkills({ rules: '2024' });

      expect(result).toEqual([]);
    });
  });

  describe('getExpertiseLimits', () => {
    it('should return expertise limits for a class with expertise feature', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [] },
          {
            level: 2,
            features: [
              {
                name: 'Expertise',
                feature_specific: { expertise: { count: 2 } },
              },
            ],
          },
        ],
      });

      const result = await getExpertiseLimits({
        rules: '2024',
        class: { name: 'Rogue' },
        level: 2,
      });

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(2);
    });

    it('should return no expertise for class without expertise feature', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [] },
          { level: 2, features: [{ name: 'Second Wind' }] },
        ],
      });

      const result = await getExpertiseLimits({
        rules: '2024',
        class: { name: 'Fighter' },
        level: 2,
      });

      expect(result.allowed).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should return no expertise when no class is selected', async () => {
      const result = await getExpertiseLimits({
        rules: '2024',
        level: 1,
      });

      expect(result.allowed).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should parse expertise count from feature description', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [] },
          {
            level: 2,
            features: [{ name: 'Expertise', desc: 'Choose 2 skills' }],
          },
        ],
      });

      const result = await getExpertiseLimits({
        rules: '2024',
        class: { name: 'Rogue' },
        level: 2,
      });

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(2);
    });

    it('should not count expertise if level is too low', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [] },
          {
            level: 2,
            features: [
              {
                name: 'Expertise',
                feature_specific: { expertise: { count: 2 } },
              },
            ],
          },
        ],
      });

      const result = await getExpertiseLimits({
        rules: '2024',
        class: { name: 'Rogue' },
        level: 1,
      });

      expect(result.allowed).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should handle subclass expertise for 2024', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [{ level: 1, features: [] }],
        majors: [
          {
            name: 'Arcane Trickster',
            features: [
              { level: 3, name: 'Expertise', description: 'Choose 2 skills' },
            ],
          },
        ],
      });

      const result = await getExpertiseLimits({
        rules: '2024',
        class: { name: 'Rogue', subclass: { name: 'Arcane Trickster' } },
        level: 3,
      });

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(2);
    });

    it('should handle subclass expertise for 5e', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [{ level: 1, features: [] }],
        subclasses: [
          {
            name: 'Arcane Trickster',
            class_levels: [
              {
                level: 3,
                features: [
                  { name: 'Expertise', description: 'Choose 2 skills' },
                ],
              },
            ],
          },
        ],
      });

      const result = await getExpertiseLimits({
        rules: '5e',
        class: { name: 'Rogue', subclass: { name: 'Arcane Trickster' } },
        level: 3,
      });

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(2);
    });

    it('should handle expertise with no description defaulting to 2', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [] },
          {
            level: 2,
            features: [{ name: 'Expertise' }],
          },
        ],
      });

      const result = await getExpertiseLimits({
        rules: '2024',
        class: { name: 'Rogue' },
        level: 2,
      });

      expect(result.allowed).toBe(true);
      expect(result.count).toBe(2);
    });

    it('should skip future class levels beyond current level', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [] },
          { level: 2, features: [] },
          {
            level: 5,
            features: [
              { name: 'Expertise', feature_specific: { expertise: { count: 3 } } },
            ],
          },
        ],
      });

      const result = await getExpertiseLimits({
        rules: '2024',
        class: { name: 'Rogue' },
        level: 3,
      });

      expect(result.allowed).toBe(false);
      expect(result.count).toBe(0);
    });

    it('should return no expertise when class data has no class_levels', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});

      const result = await getExpertiseLimits({
        rules: '2024',
        class: { name: 'Wizard' },
        level: 1,
      });

      expect(result.allowed).toBe(false);
      expect(result.count).toBe(0);
    });
  });

  describe('validateSkills', () => {
    it('should return warning when too many skills selected', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const warnings = await validateSkills({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        skillProficiencies: ['Arcana', 'History', 'Insight', 'Religion'],
      });

      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe('warning');
      expect(warnings[0].message).toContain('Rules allow');
    });

    it('should return info when fewer skills selected than allowed', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const warnings = await validateSkills({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        skillProficiencies: ['Arcana'],
      });

      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe('info');
      expect(warnings[0].message).toContain('up to');
    });

    it('should return no warnings when exactly the right number of skills selected', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const warnings = await validateSkills({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        skillProficiencies: ['Arcana', 'History'],
      });

      expect(warnings).toEqual([]);
    });

    it('should warn when expertise selected but not allowed', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
        class_levels: [{ level: 1, features: [] }],
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const warnings = await validateSkills({
        rules: '2024',
        class: { name: 'Fighter' },
        race: { name: 'Human' },
        skillProficiencies: ['Arcana'],
        expertSkills: ['Arcana'],
      });

      expect(warnings.some((w) => w.message.includes('Expertise is not available'))).toBe(
        true,
      );
    });

    it('should warn when expert skills not in proficient list', async () => {
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

      const warnings = await validateSkills({
        rules: '2024',
        class: { name: 'Rogue' },
        race: { name: 'Human' },
        level: 2,
        skillProficiencies: ['Arcana'],
        expertSkills: ['History'],
      });

      expect(
        warnings.some((w) => w.message.includes('Expertise requires proficiency')),
      ).toBe(true);
    });

    it('should warn about duplicate skills', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const warnings = await validateSkills({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        skillProficiencies: ['Arcana', 'Arcana'],
      });

      expect(warnings.some((w) => w.message.includes('multiple times'))).toBe(true);
    });

    it('should return empty warnings when no skills selected', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const warnings = await validateSkills({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        skillProficiencies: [],
      });

      expect(warnings).toEqual([]);
    });

    it('should warn when too many expertise slots selected', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
        class_levels: [
          {
            level: 2,
            features: [
              { name: 'Expertise', feature_specific: { expertise: { count: 1 } } },
            ],
          },
        ],
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const warnings = await validateSkills({
        rules: '2024',
        class: { name: 'Rogue' },
        race: { name: 'Human' },
        level: 2,
        skillProficiencies: ['Arcana', 'History'],
        expertSkills: ['Arcana', 'History'],
      });

      expect(
        warnings.some((w) => w.message.includes('expertise in 1 skill')),
      ).toBe(true);
    });

    it('should combine multiple warning types', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
        class_levels: [{ level: 1, features: [] }],
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const warnings = await validateSkills({
        rules: '2024',
        class: { name: 'Fighter' },
        race: { name: 'Human' },
        skillProficiencies: ['Arcana', 'History', 'Insight'],
        expertSkills: ['Arcana'],
      });

      expect(warnings.some((w) => w.message.includes('Rules allow'))).toBe(true);
      expect(warnings.some((w) => w.message.includes('Expertise is not available'))).toBe(
        true,
      );
    });

    it('should handle missing skillProficiencies and expertSkills gracefully', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const warnings = await validateSkills({
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
      });

      expect(warnings).toEqual([]);
    });

    it('should use default class name when class is missing in expertise warning', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const warnings = await validateSkills({
        rules: '2024',
        skillProficiencies: ['Arcana'],
        expertSkills: ['Arcana'],
      });

      expect(
        warnings.some((w) => w.message.includes('this class')),
      ).toBe(true);
    });
  });

  describe('getSkillInfo', () => {
    it('should identify skill source from class', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const result = await getSkillInfo('Arcana', {
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
      });

      expect(result.isAllowed).toBe(true);
      expect(result.source).toContain('Class');
    });

    it('should identify skill source from race and mark as pre-selected', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        skill_proficiencies: 'Insight',
      });

      const result = await getSkillInfo('Insight', {
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Dwarf' },
      });

      expect(result.isAllowed).toBe(true);
      expect(result.isPreSelected).toBe(true);
      expect(result.source).toContain('Race');
    });

    it('should return isAllowed false when skill not in any source', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Arcana',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const result = await getSkillInfo('Stealth', {
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
      });

      expect(result.isAllowed).toBe(false);
      expect(result.source).toBe('');
      expect(result.isPreSelected).toBe(false);
    });

    it('should identify skill from background in 2024', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
        skill_proficiencies: 'Deception and Persuasion',
      });

      const result = await getSkillInfo('Deception', {
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        background: 'Charlatan',
      });

      expect(result.isAllowed).toBe(true);
      expect(result.source).toContain('Background');
      expect(result.isPreSelected).toBe(true);
    });

    it('should not check background for 5e ruleset', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({
        skill_proficiencies: 'Deception',
      });

      const result = await getSkillInfo('Deception', {
        rules: '5e',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
        background: 'Charlatan',
      });

      expect(result.isAllowed).toBe(false);
    });

    it('should list multiple sources when skill comes from class and race', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Insight',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({
        skill_proficiencies: 'Insight',
      });

      const result = await getSkillInfo('Insight', {
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
      });

      expect(result.isAllowed).toBe(true);
      expect(result.source).toBe('Class, Race');
    });

    it('should mark as not pre-selected when skill is from a choice source', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        skill_proficiencies: 'Choose 2 from Arcana, History',
      });
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});

      const result = await getSkillInfo('Arcana', {
        rules: '2024',
        class: { name: 'Wizard' },
        race: { name: 'Human' },
      });

      expect(result.isAllowed).toBe(true);
      expect(result.isPreSelected).toBe(false);
    });
  });
});
