import { describe, it, expect } from 'vitest';
import { getProficiencies, getProficiencyChoiceCount } from './proficiencyUtils.js';

describe('proficiencyUtils', () => {
  describe('getProficiencies', () => {
    const defaultConfig = {
      raceProficiencies: () => [],
      bonusSource: null,
    };

    it('should return base class and race proficiencies for skills', () => {
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
      expect(allowed).toBe(5); // 3 base + 2 from background
    });

    it('should return non-skill proficiencies', () => {
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
      const [, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, defaultConfig);

      expect(proficiencies).toContain('Light Armor');
      expect(proficiencies).toContain('Medium Armor');
      expect(proficiencies).not.toContain('Athletics');
      expect(proficiencies).not.toContain('Skill: Athletics');
    });

    it('should merge skillProficiencies into the list', () => {
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

    it('should merge existing non-skill proficiencies', () => {
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

    it('should add bonus skill proficiencies from subclass', () => {
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

      expect(allowed).toBe(5); // 1 base + 2 background + 2 bonus
    });

    it('should add bonus non-skill proficiencies from subclass', () => {
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

    it('should add class-based skill proficiency choices', () => {
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

      const getChoiceCount = (ps, skills) => {
        let count = 0;
        (ps.class.proficiency_choices || []).forEach(p => {
          if ((skills && p.from[0].startsWith('Skill: ')) || (!skills && !p.from[0].startsWith('Skill: '))) {
            count += p.choose;
          }
        });
        return count;
      };

      const [allowed] = getProficiencies(playerStats, true, getChoiceCount, defaultConfig);

      expect(allowed).toBe(5); // 1 base + 2 background + 2 choices
    });

    it('should deduplicate proficiencies', () => {
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

    it('should sort proficiencies alphabetically', () => {
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

      const skillProfs = proficiencies.filter(p => ['Athletics', 'Perception', 'Stealth'].includes(p));
      expect(skillProfs).toEqual(['Athletics', 'Perception', 'Stealth']);
    });

    it('should handle race proficiencies from config', () => {
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

    it('should handle empty proficiencies', () => {
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
      expect(allowed).toBe(2); // 0 base + 2 background
    });
  });

  describe('getProficiencyChoiceCount', () => {
    it('should return 0 when class has no proficiency_choices', () => {
      const playerStats = {
        class: {},
        race: {},
      };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
      expect(getProficiencyChoiceCount(playerStats, false)).toBe(0);
    });

    it('should count skill proficiency choices', () => {
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

    it('should count non-skill proficiency choices', () => {
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

    it('should not count skill choices when skills=false', () => {
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

    it('should not count non-skill choices when skills=true', () => {
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

    it('should add race starting_proficiency_options for skills', () => {
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

    it('should not add race starting_proficiency_options for non-skills when skills=true', () => {
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

    it('should add race starting_proficiency_options for non-skills when skills=false', () => {
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

    it('should handle racial trait proficiency choices', () => {
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

    it('should not count racial trait non-skill choices when skills=true', () => {
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

    it('should handle multiple proficiency choice sources', () => {
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

    it('should handle missing subrace', () => {
      const playerStats = {
        class: {},
        race: {},
      };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });

    it('should handle subrace without racial_traits', () => {
      const playerStats = {
        class: {},
        race: {
          subrace: {},
        },
      };

      expect(getProficiencyChoiceCount(playerStats, true)).toBe(0);
    });
  });
});
