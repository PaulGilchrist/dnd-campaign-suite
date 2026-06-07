import { describe, it, expect } from 'vitest';
import { getProficiencies, getProficiencyChoiceCount } from './proficiencyUtils2024.js';

describe('proficiencyUtils2024', () => {
  describe('getProficiencies', () => {
    it('should be a function (re-exported from proficiencyUtils.js)', () => {
      expect(typeof getProficiencies).toBe('function');
    });
  });

  describe('getProficiencyChoiceCount', () => {
    it('should return 0 when class has no skill_proficiency_choices', () => {
      const playerStats = {
        class: {},
        race: {},
      };

      const result = getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(0);
    });

    it('should return 0 when class has skill_proficiency_choices but no match', () => {
      const playerStats = {
        class: {
          skill_proficiency_choices: 'No numbers here',
        },
        race: {},
      };

      const result = getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(0);
    });

    it('should parse Choose X pattern from class skill_proficiency_choices', () => {
      const playerStats = {
        class: {
          skill_proficiency_choices: 'Choose 2 skills from Acrobatics, Athletics, Perception, Stealth',
        },
        race: {},
      };

      const result = getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(2);
    });

    it('should parse Choose X with single digit', () => {
      const playerStats = {
        class: {
          skill_proficiency_choices: 'Choose 1',
        },
        race: {},
      };

      const result = getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(1);
    });

    it('should add race starting_proficiency_options for skills when skills=true', () => {
      const playerStats = {
        class: {
          skill_proficiency_choices: 'Choose 1 skill',
        },
        race: {
          starting_proficiency_options: {
            choose: 2,
            from: ['Skill: Acrobatics', 'Skill: Athletics'],
          },
        },
      };

      const result = getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(3); // 1 from class + 2 from race
    });

    it('should NOT add race starting_proficiency_options for non-skills when skills=true', () => {
      const playerStats = {
        class: {
          skill_proficiency_choices: 'Choose 1 skill',
        },
        race: {
          starting_proficiency_options: {
            choose: 2,
            from: ['Tool: Thieves Tools', 'Tool: Navigator Tools'],
          },
        },
      };

      const result = getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(1); // 1 from class, race not counted (not skill)
    });

    it('should add race starting_proficiency_options for non-skills when skills=false', () => {
      const playerStats = {
        class: {},
        race: {
          starting_proficiency_options: {
            choose: 1,
            from: ['Tool: Thieves Tools'],
          },
        },
      };

      const result = getProficiencyChoiceCount(playerStats, false);

      expect(result).toBe(1);
    });

    it('should NOT add race starting_proficiency_options for skills when skills=false', () => {
      const playerStats = {
        class: {},
        race: {
          starting_proficiency_options: {
            choose: 2,
            from: ['Skill: Acrobatics', 'Skill: Athletics'],
          },
        },
      };

      const result = getProficiencyChoiceCount(playerStats, false);

      expect(result).toBe(0); // race options are skills, but we want non-skills
    });

    it('should handle both class choices and race options combined', () => {
      const playerStats = {
        class: {
          skill_proficiency_choices: 'Choose 3 skills',
        },
        race: {
          starting_proficiency_options: {
            choose: 1,
            from: ['Skill: Stealth'],
          },
        },
      };

      const result = getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(4); // 3 from class + 1 from race
    });

    it('should handle starting_proficiency_options with no from array', () => {
      const playerStats = {
        class: {},
        race: {
          starting_proficiency_options: {
            choose: 2,
            from: [],
          },
        },
      };

      // Accessing from[0] on empty array returns undefined → undefined.startsWith throws
      expect(() => getProficiencyChoiceCount(playerStats, true)).toThrow();
    });

    it('should return 0 when playerStats is minimal', () => {
      const playerStats = {
        class: {},
        race: {},
      };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
      expect(getProficiencyChoiceCount(playerStats, false)).toBe(0);
    });
  });
});
