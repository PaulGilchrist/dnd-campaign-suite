import { describe, it, expect } from 'vitest';
import { getProficiencies, getProficiencyChoiceCount } from './proficiencyUtils2024.js';

describe('proficiencyUtils2024', () => {
  describe('getProficiencies', () => {
    it('is re-exported from proficiencyUtils', () => {
      expect(typeof getProficiencies).toBe('function');
    });

    it('returns an array with two elements', () => {
      const mockChoiceCount = () => 0;
      const mockConfig = {
        raceProficiencies: () => [],
      };
      const playerStats = {
        class: { proficiencies: ['Simple Weapons'] },
        race: { starting_proficiencies: [] },
      };
      const result = getProficiencies(playerStats, true, mockChoiceCount, mockConfig);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
    });

    it('returns skill proficiencies when skills is true', () => {
      const mockChoiceCount = () => 0;
      const mockConfig = {
        raceProficiencies: () => [],
      };
      const playerStats = {
        class: { proficiencies: ['Skill: Perception', 'Skill: Stealth'] },
        race: { starting_proficiencies: [] },
      };
      const result = getProficiencies(playerStats, true, mockChoiceCount, mockConfig);
      expect(result[1]).toContain('Perception');
      expect(result[1]).toContain('Stealth');
    });

    it('returns non-skill proficiencies when skills is false', () => {
      const mockChoiceCount = () => 0;
      const mockConfig = {
        raceProficiencies: () => [],
      };
      const playerStats = {
        class: { proficiencies: ['Simple Weapons', 'Skill: Perception'] },
        race: { starting_proficiencies: [] },
      };
      const result = getProficiencies(playerStats, false, mockChoiceCount, mockConfig);
      expect(result[1]).toContain('Simple Weapons');
      expect(result[1]).not.toContain('Perception');
    });

    it('adds background tool proficiencies when provided', () => {
      const mockChoiceCount = () => 0;
      const mockConfig = {
        raceProficiencies: () => [],
        backgroundToolProficiencies: () => ['Healer\'s Kit'],
      };
      const playerStats = {
        class: { proficiencies: [] },
        race: { starting_proficiencies: [] },
      };
      const result = getProficiencies(playerStats, false, mockChoiceCount, mockConfig);
      expect(result[1]).toContain('Healer\'s Kit');
    });

    it('adds bonus proficiencies from bonusSource', () => {
      const mockChoiceCount = () => 0;
      const mockConfig = {
        raceProficiencies: () => [],
        bonusSource: { bonus_proficiencies: ['Medium Armor'] },
      };
      const playerStats = {
        class: { proficiencies: [] },
        race: { starting_proficiencies: [] },
      };
      const result = getProficiencies(playerStats, false, mockChoiceCount, mockConfig);
      expect(result[1]).toContain('Medium Armor');
    });

    it('adds bonus skill proficiencies from bonusSource', () => {
      const mockChoiceCount = () => 0;
      const mockConfig = {
        raceProficiencies: () => [],
        bonusSource: { bonus_skill_proficiencies: 2 },
      };
      const playerStats = {
        class: { proficiencies: ['Skill: Perception'] },
        race: { starting_proficiencies: [] },
      };
      const result = getProficiencies(playerStats, true, mockChoiceCount, mockConfig);
      expect(result[0]).toBeGreaterThan(1);
    });

    it('merges already-selected skill proficiencies', () => {
      const mockChoiceCount = () => 0;
      const mockConfig = {
        raceProficiencies: () => [],
      };
      const playerStats = {
        class: { proficiencies: ['Skill: Stealth'] },
        race: { starting_proficiencies: [] },
        skillProficiencies: ['Perception'],
      };
      const result = getProficiencies(playerStats, true, mockChoiceCount, mockConfig);
      expect(result[1]).toContain('Perception');
      expect(result[1]).toContain('Stealth');
    });

    it('merges already-selected proficiencies', () => {
      const mockChoiceCount = () => 0;
      const mockConfig = {
        raceProficiencies: () => [],
      };
      const playerStats = {
        class: { proficiencies: ['Simple Weapons'] },
        race: { starting_proficiencies: [] },
        proficiencies: ['Medium Armor'],
      };
      const result = getProficiencies(playerStats, false, mockChoiceCount, mockConfig);
      expect(result[1]).toContain('Simple Weapons');
      expect(result[1]).toContain('Medium Armor');
    });

    it('returns sorted proficiencies', () => {
      const mockChoiceCount = () => 0;
      const mockConfig = {
        raceProficiencies: () => [],
      };
      const playerStats = {
        class: { proficiencies: ['Z Weapon', 'A Weapon'] },
        race: { starting_proficiencies: [] },
      };
      const result = getProficiencies(playerStats, false, mockChoiceCount, mockConfig);
      expect(result[1]).toEqual(['A Weapon', 'Z Weapon']);
    });

    it('handles race proficiencies from config', () => {
      const mockChoiceCount = () => 0;
      const mockConfig = {
        raceProficiencies: () => ['Longsword'],
      };
      const playerStats = {
        class: { proficiencies: [] },
        race: { starting_proficiencies: [] },
      };
      const result = getProficiencies(playerStats, false, mockChoiceCount, mockConfig);
      expect(result[1]).toContain('Longsword');
    });

    it('handles proficiency_choices from bonusSource (array format)', () => {
      const mockChoiceCount = () => 0;
      const mockConfig = {
        raceProficiencies: () => [],
        bonusSource: {
          proficiency_choices: [
            { from: ['Skill: Perception', 'Skill: Stealth'] },
          ],
        },
      };
      const playerStats = {
        class: { proficiencies: [] },
        race: { starting_proficiencies: [] },
      };
      const result = getProficiencies(playerStats, true, mockChoiceCount, mockConfig);
      expect(result[1]).toContain('Perception');
      expect(result[1]).toContain('Stealth');
    });

    it('handles background tool proficiency choices', () => {
      const mockChoiceCount = () => 0;
      const mockConfig = {
        raceProficiencies: () => [],
        backgroundToolProficiencyChoices: () => [
          { choose: 1, from: ['Artisan\'s Tools', 'Thieves\' Tools'] },
        ],
      };
      const playerStats = {
        class: { proficiencies: [] },
        race: { starting_proficiencies: [] },
      };
      const result = getProficiencies(playerStats, false, mockChoiceCount, mockConfig);
      expect(result[1]).toContain('Artisan\'s Tools');
      expect(result[1]).toContain('Thieves\' Tools');
      expect(result[0]).toBe(2);
    });
  });

  describe('getProficiencyChoiceCount', () => {
    it('is re-exported from proficiencyUtils', () => {
      expect(typeof getProficiencyChoiceCount).toBe('function');
    });

    it('parses class skill_proficiency_choices (2024 format)', () => {
      const playerStats = {
        class: { skill_proficiency_choices: 'Choose 2' },
        race: {},
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(2);
    });

    it('returns 0 when no skill_proficiency_choices', () => {
      const playerStats = {
        class: {},
        race: {},
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('returns 0 when skill_proficiency_choices does not match pattern', () => {
      const playerStats = {
        class: { skill_proficiency_choices: 'Choose two skills' },
        race: {},
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('handles proficiency_choices with empty from array', () => {
      const playerStats = {
        class: {
          major: {
            proficiency_choices: [
              { choose: 1, from: [] },
            ],
          },
        },
        race: {},
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });
  });
});
