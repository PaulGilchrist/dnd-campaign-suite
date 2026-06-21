// @improved-by-ai
import { describe, it, expect } from 'vitest';
import { getProficiencies, getProficiencyChoiceCount } from './proficiencyUtils.js';

describe('proficiencyUtils', () => {
  describe('getProficiencies', () => {
    const defaultConfig = {
      raceProficiencies: () => [],
      bonusSource: null,
    };

    const skillConfig = {
      ...defaultConfig,
      backgroundToolProficiencies: () => ['Tool: Cook\'s Supplies'],
      backgroundToolProficiencyChoices: () => [
        { choose: 1, from: ['Tool: Alchemist Supplies', 'Tool: Brewer Supplies'] },
      ],
    };

    it('returns base class and race skill proficiencies plus background allowance', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Athletics', 'Skill: Perception', 'Light Armor'],
        },
        race: {
          starting_proficiencies: ['Skill: Survival'],
        },
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, defaultConfig);

      expect(proficiencies).toContain('Athletics');
      expect(proficiencies).toContain('Perception');
      expect(proficiencies).toContain('Survival');
      expect(allowed).toBe(5);
    });

    it('returns non-skill proficiencies without Skill-prefixed entries', () => {
      const playerStats = {
        class: {
          proficiencies: ['Light Armor', 'Medium Armor', 'Skill: Athletics'],
        },
        race: {
          starting_proficiencies: ['Darkvision'],
        },
        proficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, defaultConfig);

      expect(proficiencies).toContain('Light Armor');
      expect(proficiencies).toContain('Medium Armor');
      expect(proficiencies).toContain('Darkvision');
      expect(proficiencies).not.toContain('Athletics');
      expect(proficiencies).not.toContain('Skill: Athletics');
      expect(allowed).toBe(3);
    });

    it('merges skillProficiencies into the available pool', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Athletics'],
        },
        race: {
          starting_proficiencies: [],
        },
        skillProficiencies: ['Stealth', 'Perception'],
      };

      const getChoiceCount = () => 0;
      const [, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, defaultConfig);

      expect(proficiencies).toContain('Athletics');
      expect(proficiencies).toContain('Stealth');
      expect(proficiencies).toContain('Perception');
    });

    it('merges existing non-skill proficiencies into the available pool', () => {
      const playerStats = {
        class: {
          proficiencies: ['Light Armor'],
        },
        race: {
          starting_proficiencies: [],
        },
        proficiencies: ['Shields'],
      };

      const getChoiceCount = () => 0;
      const [, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, defaultConfig);

      expect(proficiencies).toContain('Light Armor');
      expect(proficiencies).toContain('Shields');
    });

    it('adds bonus skill proficiencies from subclass bonus_skill_proficiencies', () => {
      const config = {
        raceProficiencies: () => [],
        bonusSource: { bonus_skill_proficiencies: 2 },
      };

      const playerStats = {
        class: {
          proficiencies: ['Skill: Athletics'],
        },
        race: {
          starting_proficiencies: [],
        },
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed] = getProficiencies(playerStats, true, getChoiceCount, config);

      expect(allowed).toBe(5);
    });

    it('adds bonus non-skill proficiencies from subclass bonus_proficiencies', () => {
      const config = {
        raceProficiencies: () => [],
        bonusSource: { bonus_proficiencies: ['Heavy Armor', 'Martial Weapons'] },
      };

      const playerStats = {
        class: {
          proficiencies: ['Light Armor'],
        },
        race: {
          starting_proficiencies: [],
        },
        proficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, config);

      expect(proficiencies).toContain('Light Armor');
      expect(proficiencies).toContain('Heavy Armor');
      expect(proficiencies).toContain('Martial Weapons');
      expect(allowed).toBe(3);
    });

    it('adds class-based skill proficiency choices to the allowed count', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Athletics'],
          proficiency_choices: [
            { choose: 2, from: ['Skill: Acrobatics', 'Skill: Stealth', 'Skill: Perception'] },
          ],
        },
        race: {
          starting_proficiencies: [],
        },
        skillProficiencies: [],
      };

      const getChoiceCount = () => 2;
      const [allowed] = getProficiencies(playerStats, true, getChoiceCount, defaultConfig);

      expect(allowed).toBe(5);
    });

    it('deduplicates proficiencies from all sources', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Athletics', 'Skill: Perception'],
        },
        race: {
          starting_proficiencies: ['Skill: Athletics'],
        },
        skillProficiencies: ['Athletics'],
      };

      const getChoiceCount = () => 0;
      const [, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, defaultConfig);

      const athleticsCount = proficiencies.filter(p => p === 'Athletics').length;
      expect(athleticsCount).toBe(1);
    });

    it('returns proficiencies sorted alphabetically', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Stealth', 'Skill: Athletics', 'Skill: Perception'],
        },
        race: {
          starting_proficiencies: [],
        },
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, defaultConfig);

      expect(proficiencies).toEqual(['Athletics', 'Perception', 'Stealth']);
    });

    it('includes proficiencies returned by raceProficiencies config function', () => {
      const config = {
        raceProficiencies: () => ['Skill: Intimidation'],
        bonusSource: null,
      };

      const playerStats = {
        class: {
          proficiencies: ['Skill: Athletics'],
        },
        race: {
          starting_proficiencies: [],
        },
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, config);

      expect(proficiencies).toContain('Intimidation');
    });

    it('handles empty proficiencies from all sources', () => {
      const playerStats = {
        class: {
          proficiencies: [],
        },
        race: {
          starting_proficiencies: [],
        },
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, defaultConfig);

      expect(proficiencies).toEqual([]);
      expect(allowed).toBe(2);
    });

    it('handles playerStats with no class property throws', () => {
      const playerStats = {
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      expect(() => getProficiencies(playerStats, true, getChoiceCount, defaultConfig)).toThrow(TypeError);
    });

    it('handles playerStats with no race property throws', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Athletics'],
        },
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      expect(() => getProficiencies(playerStats, true, getChoiceCount, defaultConfig)).toThrow(TypeError);
    });

    it('handles undefined bonusSource', () => {
      const config = {
        raceProficiencies: () => [],
      };

      const playerStats = {
        class: {
          proficiencies: ['Skill: Athletics'],
        },
        race: {
          starting_proficiencies: [],
        },
        skillProficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, config);

      expect(proficiencies).toContain('Athletics');
      expect(allowed).toBe(3);
    });

    it('merges background tool proficiencies for non-skill', () => {
      const playerStats = {
        class: {
          proficiencies: ['Light Armor'],
        },
        race: {
          starting_proficiencies: [],
        },
        proficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, skillConfig);

      expect(proficiencies).toContain('Light Armor');
      expect(proficiencies).toContain('Tool: Cook\'s Supplies');
    });

    it('merges background tool proficiency choices for non-skill', () => {
      const playerStats = {
        class: {
          proficiencies: ['Light Armor'],
        },
        race: {
          starting_proficiencies: [],
        },
        proficiencies: [],
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, skillConfig);

      expect(proficiencies).toContain('Tool: Alchemist Supplies');
      expect(proficiencies).toContain('Tool: Brewer Supplies');
      expect(allowed).toBe(4); // 1 existing + 1 background tool + 2 choices
    });

    it('deduplicates bonusSource proficiency_choices with existing proficiencies', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: History'],
        },
        race: {
          starting_proficiencies: [],
        },
        skillProficiencies: [],
      };

      const config = {
        raceProficiencies: () => [],
        bonusSource: {
          proficiency_choices: [
            { choose: 1, from: ['Skill: History', 'Skill: Insight'] },
          ],
        },
      };

      const getChoiceCount = () => 0;
      const [, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, config);

      expect(proficiencies).toContain('History');
      expect(proficiencies).toContain('Insight');
      expect(proficiencies.filter(p => p === 'History')).toHaveLength(1);
    });

    it('merges bonusSource proficiency_choices into skill available pool', () => {
      const playerStats = {
        class: {
          proficiencies: [],
        },
        race: {
          starting_proficiencies: [],
        },
        skillProficiencies: [],
      };

      const config = {
        raceProficiencies: () => [],
        bonusSource: {
          proficiency_choices: [
            { choose: 1, from: ['Skill: History', 'Skill: Insight'] },
          ],
        },
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, config);

      expect(proficiencies).toContain('History');
      expect(proficiencies).toContain('Insight');
      expect(allowed).toBe(4);
    });

    it('merges bonusSource proficiency_choices into non-skill available pool', () => {
      const playerStats = {
        class: {
          proficiencies: [],
        },
        race: {
          starting_proficiencies: [],
        },
        proficiencies: [],
      };

      const config = {
        raceProficiencies: () => [],
        bonusSource: {
          proficiency_choices: [
            { choose: 1, from: ['Tool: Alchemist Supplies', 'Tool: Brewer Supplies'] },
          ],
        },
      };

      const getChoiceCount = () => 0;
      const [, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, config);

      expect(proficiencies).toContain('Tool: Alchemist Supplies');
      expect(proficiencies).toContain('Tool: Brewer Supplies');
    });

    it('filters bonusSource proficiency_choices by skill vs non-skill correctly', () => {
      const playerStats = {
        class: {
          proficiencies: [],
        },
        race: {
          starting_proficiencies: [],
        },
        skillProficiencies: [],
        proficiencies: [],
      };

      const config = {
        raceProficiencies: () => [],
        bonusSource: {
          proficiency_choices: [
            { choose: 1, from: ['Tool: Smith Tools'] },
            { choose: 1, from: ['Skill: Acrobatics', 'Skill: Athletics'] },
          ],
        },
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

    it('handles empty bonusSource proficiency_choices array', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Athletics'],
        },
        race: {
          starting_proficiencies: [],
        },
        skillProficiencies: [],
      };

      const config = {
        raceProficiencies: () => [],
        bonusSource: {
          proficiency_choices: [],
        },
      };

      const getChoiceCount = () => 0;
      const [allowed, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, config);

      expect(proficiencies).toContain('Athletics');
      expect(allowed).toBe(3);
    });
  });

  describe('getProficiencyChoiceCount', () => {
    it('returns 0 when class has no proficiency_choices', () => {
      const playerStats = { class: {}, race: {} };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
      expect(getProficiencyChoiceCount(playerStats, false)).toBe(0);
    });

    it('throws when playerStats has no class property', () => {
      const playerStats = { race: {} };

      expect(() => getProficiencyChoiceCount(playerStats, true)).toThrow(TypeError);
      expect(() => getProficiencyChoiceCount(playerStats, false)).toThrow(TypeError);
    });

    it('counts skill proficiency choices from class', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 2, from: ['Skill: Acrobatics', 'Skill: Stealth'] },
          ],
        },
        race: {},
      };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(2);
    });

    it('counts non-skill proficiency choices from class', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 1, from: ['Light Armor', 'Medium Armor'] },
          ],
        },
        race: {},
      };

      expect(getProficiencyChoiceCount(playerStats, false)).toBe(1);
    });

    it('excludes skill choices when skills=false', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 2, from: ['Skill: Acrobatics', 'Skill: Stealth'] },
          ],
        },
        race: {},
      };

      expect(getProficiencyChoiceCount(playerStats, false)).toBe(0);
    });

    it('excludes non-skill choices when skills=true', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 1, from: ['Light Armor', 'Medium Armor'] },
          ],
        },
        race: {},
      };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('counts race starting_proficiency_options for skills', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 2, from: ['Skill: Acrobatics', 'Skill: Stealth'] },
          ],
        },
        race: {
          starting_proficiency_options: {
            choose: 1,
            from: ['Skill: Perception'],
          },
        },
      };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(3);
    });

    it('excludes race starting_proficiency_options non-skills when skills=true', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 2, from: ['Skill: Acrobatics', 'Skill: Stealth'] },
          ],
        },
        race: {
          starting_proficiency_options: {
            choose: 1,
            from: ['Light Armor'],
          },
        },
      };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(2);
    });

    it('counts race starting_proficiency_options for non-skills when skills=false', () => {
      const playerStats = {
        class: {},
        race: {
          starting_proficiency_options: {
            choose: 1,
            from: ['Light Armor'],
          },
        },
      };

      expect(getProficiencyChoiceCount(playerStats, false)).toBe(1);
    });

    it('counts racial trait proficiency choices from subrace', () => {
      const playerStats = {
        class: {},
        race: {
          subrace: {
            racial_traits: [
              {
                proficiency_choices: {
                  choose: 1,
                  from: ['Skill: Survival'],
                },
              },
            ],
          },
        },
      };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(1);
    });

    it('excludes racial trait non-skill choices when skills=true', () => {
      const playerStats = {
        class: {},
        race: {
          subrace: {
            racial_traits: [
              {
                proficiency_choices: {
                  choose: 1,
                  from: ['Light Armor'],
                },
              },
            ],
          },
        },
      };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('sums proficiency choices from multiple sources', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 2, from: ['Skill: Acrobatics', 'Skill: Stealth'] },
            { choose: 1, from: ['Skill: Perception', 'Skill: Athletics'] },
          ],
        },
        race: {
          starting_proficiency_options: {
            choose: 1,
            from: ['Skill: Intimidation'],
          },
          subrace: {
            racial_traits: [
              {
                proficiency_choices: {
                  choose: 1,
                  from: ['Skill: Survival'],
                },
              },
            ],
          },
        },
      };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(5);
    });

    it('handles missing subrace', () => {
      const playerStats = { class: {}, race: {} };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('handles subrace without racial_traits', () => {
      const playerStats = { class: {}, race: { subrace: {} } };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('handles empty racial_traits array', () => {
      const playerStats = {
        class: {},
        race: {
          subrace: {
            racial_traits: [],
          },
        },
      };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('handles racial_trait without proficiency_choices', () => {
      const playerStats = {
        class: {},
        race: {
          subrace: {
            racial_traits: [
              { name: 'Extra HP' },
            ],
          },
        },
      };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('handles multiple racial traits with mixed proficiency_choices', () => {
      const playerStats = {
        class: {},
        race: {
          subrace: {
            racial_traits: [
              {
                proficiency_choices: {
                  choose: 1,
                  from: ['Skill: Survival'],
                },
              },
              {
                proficiency_choices: {
                  choose: 1,
                  from: ['Skill: Athletics'],
                },
              },
            ],
          },
        },
      };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(2);
    });

    it('skips racial traits with non-skill choices when skills=true', () => {
      const playerStats = {
        class: {},
        race: {
          subrace: {
            racial_traits: [
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
        },
      };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(2);
    });
  });
});
