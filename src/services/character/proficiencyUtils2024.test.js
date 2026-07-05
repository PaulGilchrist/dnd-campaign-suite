// @cleaned-by-ai
import { describe, it, expect } from 'vitest';
import { getProficiencies, getProficiencyChoiceCount } from './proficiencyUtils2024.js';

describe('proficiencyUtils2024', () => {
  describe('getProficiencies', () => {
    const defaultConfig = {
      raceProficiencies: () => [],
    };

    const skillConfig = {
      ...defaultConfig,
      backgroundToolProficiencies: () => ['Healer\'s Kit'],
      backgroundToolProficiencyChoices: () => [
        { choose: 1, from: ['Artisan\'s Tools', 'Thieves\' Tools'] },
      ],
    };

    it('returns base class skill proficiencies with background allowance', () => {
      const playerStats = {
        class: { proficiencies: ['Skill: Athletics', 'Skill: Perception'] },
        race: { starting_proficiencies: [] },
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, defaultConfig);

      expect(proficiencies).toEqual(['Athletics', 'Perception']);
      expect(allowed).toBe(4);
    });

    it('returns base class non-skill proficiencies', () => {
      const playerStats = {
        class: { proficiencies: ['Light Armor', 'Medium Armor', 'Skill: Athletics'] },
        race: { starting_proficiencies: ['Shields'] },
        proficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, defaultConfig);

      expect(proficiencies).toEqual(['Light Armor', 'Medium Armor', 'Shields']);
      expect(proficiencies).not.toContain('Athletics');
      expect(allowed).toBe(3);
    });

    it('adds background tool proficiencies for non-skill', () => {
      const playerStats = {
        class: { proficiencies: [] },
        race: { starting_proficiencies: [] },
        proficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, skillConfig);

      expect(proficiencies).toContain('Healer\'s Kit');
    });

    it('adds background tool proficiency choices for non-skill', () => {
      const playerStats = {
        class: { proficiencies: [] },
        race: { starting_proficiencies: [] },
        proficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, skillConfig);

      expect(proficiencies).toContain('Artisan\'s Tools');
      expect(proficiencies).toContain('Thieves\' Tools');
      expect(allowed).toBe(3);
    });

    it('adds bonus proficiencies from bonusSource', () => {
      const config = {
        ...defaultConfig,
        bonusSource: { bonus_proficiencies: ['Heavy Armor', 'Martial Weapons'] },
      };

      const playerStats = {
        class: { proficiencies: [] },
        race: { starting_proficiencies: [] },
        proficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, config);

      expect(proficiencies).toEqual(['Heavy Armor', 'Martial Weapons']);
      expect(allowed).toBe(2);
    });

    it('adds bonus skill proficiencies from bonusSource to allowed count', () => {
      const config = {
        ...defaultConfig,
        bonusSource: { bonus_skill_proficiencies: 2 },
      };

      const playerStats = {
        class: { proficiencies: ['Skill: Athletics'] },
        race: { starting_proficiencies: [] },
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed] = getProficiencies(playerStats, true, getChoiceCount, config);

      expect(allowed).toBe(5);
    });

    it('merges already-selected skill proficiencies into the available pool', () => {
      const playerStats = {
        class: { proficiencies: ['Skill: Stealth'] },
        race: { starting_proficiencies: [] },
        skillProficiencies: ['Perception', 'Insight'],
      };

      const getChoiceCount = () => 0;
      const [, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, defaultConfig);

      expect(proficiencies).toEqual(['Insight', 'Perception', 'Stealth']);
    });

    it('merges already-selected non-skill proficiencies into the available pool', () => {
      const playerStats = {
        class: { proficiencies: ['Light Armor'] },
        race: { starting_proficiencies: [] },
        proficiencies: ['Medium Armor', 'Heavy Armor'],
      };

      const getChoiceCount = () => 0;
      const [, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, defaultConfig);

      expect(proficiencies).toEqual(['Heavy Armor', 'Light Armor', 'Medium Armor']);
    });

    it('returns proficiencies sorted alphabetically', () => {
      const playerStats = {
        class: { proficiencies: ['Z Weapon', 'A Weapon', 'M Weapon'] },
        race: { starting_proficiencies: [] },
        proficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, defaultConfig);

      expect(proficiencies).toEqual(['A Weapon', 'M Weapon', 'Z Weapon']);
    });

    it('deduplicates proficiencies from all sources', () => {
      const playerStats = {
        class: { proficiencies: ['Skill: Athletics'] },
        race: { starting_proficiencies: ['Skill: Athletics'] },
        skillProficiencies: ['Athletics'],
      };

      const getChoiceCount = () => 0;
      const [, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, defaultConfig);

      expect(proficiencies).toEqual(['Athletics']);
    });

    it('adds race proficiencies returned by config.raceProficiencies', () => {
      const config = {
        raceProficiencies: () => ['Longsword'],
      };

      const playerStats = {
        class: { proficiencies: [] },
        race: { starting_proficiencies: [] },
        proficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, config);

      expect(proficiencies).toEqual(['Longsword']);
    });

    it('merges proficiency_choices from bonusSource', () => {
      const config = {
        ...defaultConfig,
        bonusSource: {
          proficiency_choices: [
            { choose: 2, from: ['Skill: Perception', 'Skill: Stealth'] },
          ],
        },
      };

      const playerStats = {
        class: { proficiencies: [] },
        race: { starting_proficiencies: [] },
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, config);

      expect(proficiencies).toEqual(['Perception', 'Stealth']);
      expect(allowed).toBe(4);
    });

    it('filters bonusSource proficiency_choices by skill vs non-skill correctly', () => {
      const config = {
        ...defaultConfig,
        bonusSource: {
          proficiency_choices: [
            { choose: 1, from: ['Tool: Smith Tools'] },
            { choose: 1, from: ['Skill: Acrobatics', 'Skill: Athletics'] },
          ],
        },
      };

      const playerStats = {
        class: { proficiencies: [] },
        race: { starting_proficiencies: [] },
        skillProficiencies: [],
        proficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [, skillProfs] = getProficiencies(playerStats, true, getChoiceCount, config);
      const [, toolProfs] = getProficiencies(playerStats, false, getChoiceCount, config);

      expect(skillProfs).toContain('Acrobatics');
      expect(skillProfs).toContain('Athletics');
      expect(skillProfs).not.toContain('Tool: Smith Tools');
      expect(toolProfs).toContain('Tool: Smith Tools');
      expect(toolProfs).not.toContain('Acrobatics');
    });

    it('handles empty proficiency_choices from bonusSource', () => {
      const config = {
        ...defaultConfig,
        bonusSource: { proficiency_choices: [] },
      };

      const playerStats = {
        class: { proficiencies: ['Skill: Athletics'] },
        race: { starting_proficiencies: [] },
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, config);

      expect(proficiencies).toEqual(['Athletics']);
      expect(allowed).toBe(3);
    });

    it('handles undefined bonusSource gracefully', () => {
      const config = {
        raceProficiencies: () => [],
      };

      const playerStats = {
        class: { proficiencies: ['Skill: Athletics'] },
        race: { starting_proficiencies: [] },
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, config);

      expect(proficiencies).toEqual(['Athletics']);
      expect(allowed).toBe(3);
    });

    it('handles missing class.proficiencies', () => {
      const playerStats = {
        class: {},
        race: { starting_proficiencies: [] },
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, defaultConfig);

      expect(proficiencies).toEqual([]);
      expect(allowed).toBe(2);
    });

    it('handles missing race.starting_proficiencies', () => {
      const playerStats = {
        class: { proficiencies: ['Skill: Athletics'] },
        race: {},
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, defaultConfig);

      expect(proficiencies).toEqual(['Athletics']);
      expect(allowed).toBe(3);
    });

    it('handles empty proficiencies from all sources', () => {
      const playerStats = {
        class: { proficiencies: [] },
        race: { starting_proficiencies: [] },
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, defaultConfig);

      expect(proficiencies).toEqual([]);
      expect(allowed).toBe(2);
    });

    it('throws when playerStats has no class property', () => {
      const playerStats = {
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      expect(() => getProficiencies(playerStats, true, getChoiceCount, defaultConfig)).toThrow(TypeError);
    });

    it('throws when playerStats has no race property', () => {
      const playerStats = {
        class: { proficiencies: ['Skill: Athletics'] },
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      expect(() => getProficiencies(playerStats, true, getChoiceCount, defaultConfig)).toThrow(TypeError);
    });
  });

  describe('getProficiencyChoiceCount', () => {
    it('parses class skill_proficiency_choices "Choose 2" format', () => {
      const playerStats = {
        class: { skill_proficiency_choices: 'Choose 2' },
        race: {},
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(2);
    });

    it('parses class skill_proficiency_choices "Choose 5" format', () => {
      const playerStats = {
        class: { skill_proficiency_choices: 'Choose 5' },
        race: {},
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(5);
    });

    it('returns 0 when class has no skill_proficiency_choices', () => {
      const playerStats = { class: {}, race: {} };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('returns 0 when skill_proficiency_choices does not match pattern', () => {
      const playerStats = {
        class: { skill_proficiency_choices: 'Choose two skills' },
        race: {},
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('returns 0 for non-skill when only skill choices exist', () => {
      const playerStats = {
        class: { skill_proficiency_choices: 'Choose 2' },
        race: {},
      };
      expect(getProficiencyChoiceCount(playerStats, false)).toBe(0);
    });

    it('counts race starting_proficiency_options for skills', () => {
      const playerStats = {
        class: {},
        race: {
          starting_proficiency_options: {
            choose: 2,
            from: ['Skill: Perception', 'Skill: Stealth'],
          },
        },
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(2);
    });

    it('excludes race starting_proficiency_options non-skills when skills=true', () => {
      const playerStats = {
        class: {},
        race: {
          starting_proficiency_options: {
            choose: 2,
            from: ['Light Armor', 'Medium Armor'],
          },
        },
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('counts race starting_proficiency_options for non-skills when skills=false', () => {
      const playerStats = {
        class: {},
        race: {
          starting_proficiency_options: {
            choose: 3,
            from: ['Heavy Armor', 'Martial Weapons', 'Shields'],
          },
        },
      };
      expect(getProficiencyChoiceCount(playerStats, false)).toBe(3);
    });

    it('counts proficiency choices from race traits', () => {
      const playerStats = {
        class: {},
        race: {
          traits: [
            {
              proficiency_choices: {
                choose: 1,
                from: ['Skill: Survival'],
              },
            },
          ],
        },
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(1);
    });

    it('excludes race trait non-skill choices when skills=true', () => {
      const playerStats = {
        class: {},
        race: {
          traits: [
            {
              proficiency_choices: {
                choose: 2,
                from: ['Heavy Armor', 'Martial Weapons'],
              },
            },
          ],
        },
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('counts race trait skill choices when skills=false', () => {
      const playerStats = {
        class: {},
        race: {
          traits: [
            {
              proficiency_choices: {
                choose: 1,
                from: ['Skill: Perception'],
              },
            },
          ],
        },
      };
      expect(getProficiencyChoiceCount(playerStats, false)).toBe(0);
    });

    it('handles race traits with empty from array', () => {
      const playerStats = {
        class: {},
        race: {
          traits: [
            {
              proficiency_choices: {
                choose: 1,
                from: [],
              },
            },
          ],
        },
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('handles race traits without proficiency_choices', () => {
      const playerStats = {
        class: {},
        race: {
          traits: [
            { name: 'Darkvision' },
          ],
        },
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('handles race with no traits', () => {
      const playerStats = { class: {}, race: {} };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('handles race traits being null', () => {
      const playerStats = {
        class: {},
        race: { traits: null },
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('handles race traits being undefined', () => {
      const playerStats = {
        class: {},
        race: { traits: undefined },
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('counts subclass proficiency_choices from class.major', () => {
      const playerStats = {
        class: {
          major: {
            proficiency_choices: [
              {
                choose: 2,
                from: ['Skill: History', 'Skill: Arcana'],
              },
            ],
          },
        },
        race: {},
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(2);
    });

    it('excludes subclass non-skill choices when skills=true', () => {
      const playerStats = {
        class: {
          major: {
            proficiency_choices: [
              {
                choose: 2,
                from: ['Heavy Armor', 'Martial Weapons'],
              },
            ],
          },
        },
        race: {},
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('counts subclass skill choices when skills=false', () => {
      const playerStats = {
        class: {
          major: {
            proficiency_choices: [
              {
                choose: 1,
                from: ['Skill: Perception'],
              },
            ],
          },
        },
        race: {},
      };
      expect(getProficiencyChoiceCount(playerStats, false)).toBe(0);
    });

    it('handles class.major without proficiency_choices', () => {
      const playerStats = {
        class: {
          major: { name: 'Battle Master' },
        },
        race: {},
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('handles class without major', () => {
      const playerStats = {
        class: { name: 'Fighter' },
        race: {},
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('sums choices from all sources combined', () => {
      const playerStats = {
        class: {
          skill_proficiency_choices: 'Choose 2',
          major: {
            proficiency_choices: [
              {
                choose: 1,
                from: ['Skill: Insight'],
              },
            ],
          },
        },
        race: {
          starting_proficiency_options: {
            choose: 1,
            from: ['Skill: Survival'],
          },
          traits: [
            {
              proficiency_choices: {
                choose: 1,
                from: ['Skill: Perception'],
              },
            },
          ],
        },
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(5);
    });

    it('sums choices from multiple race traits', () => {
      const playerStats = {
        class: {},
        race: {
          traits: [
            {
              proficiency_choices: {
                choose: 1,
                from: ['Skill: Survival'],
              },
            },
            {
              proficiency_choices: {
                choose: 2,
                from: ['Skill: Perception', 'Skill: Insight'],
              },
            },
          ],
        },
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(3);
    });

    it('handles multiple race traits with mixed skill/non-skill choices', () => {
      const playerStats = {
        class: {},
        race: {
          traits: [
            {
              proficiency_choices: {
                choose: 2,
                from: ['Skill: Perception'],
              },
            },
            {
              proficiency_choices: {
                choose: 3,
                from: ['Heavy Armor', 'Martial Weapons'],
              },
            },
          ],
        },
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(2);
      expect(getProficiencyChoiceCount(playerStats, false)).toBe(3);
    });

    it('handles empty proficiency_choices from', () => {
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

    it('handles missing class.major.proficiency_choices from', () => {
      const playerStats = {
        class: {
          major: {
            proficiency_choices: [
              { choose: 1 },
            ],
          },
        },
        race: {},
      };
      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('throws when playerStats has no class property', () => {
      const playerStats = { race: {} };
      expect(() => getProficiencyChoiceCount(playerStats, true)).toThrow(TypeError);
    });

    it('throws when playerStats has no race property', () => {
      const playerStats = { class: {} };
      expect(() => getProficiencyChoiceCount(playerStats, true)).toThrow(TypeError);
    });
  });
});
