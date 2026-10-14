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

    describe('skill proficiencies (skill=true)', () => {
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

        expect(proficiencies).toEqual(['Athletics', 'Perception', 'Survival']);
        expect(allowed).toBe(5);
      });

      it('excludes non-skill proficiencies from skill pool', () => {
        const playerStats = {
          class: {
            proficiencies: ['Light Armor', 'Medium Armor', 'Skill: Athletics'],
          },
          race: {
            starting_proficiencies: ['Darkvision'],
          },
          skillProficiencies: [],
        };

        const getChoiceCount = () => 0;
        const [allowed, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, defaultConfig);

        expect(proficiencies).toEqual(['Athletics']);
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

        expect(proficiencies).toEqual(['Athletics', 'Perception', 'Stealth']);
      });

      it('does not merge proficiencies array into skill pool', () => {
        const playerStats = {
          class: {
            proficiencies: ['Skill: Athletics'],
          },
          race: {
            starting_proficiencies: [],
          },
          proficiencies: ['Skill: Stealth'],
        };

        const getChoiceCount = () => 0;
        const [, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, defaultConfig);

        expect(proficiencies).toEqual(['Athletics']);
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

        expect(proficiencies).toEqual(['Athletics', 'Perception']);
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

        expect(proficiencies).toEqual(['Athletics', 'Intimidation']);
      });

      it('throws when raceProficiencies returns null', () => {
        const config = {
          raceProficiencies: () => null,
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
        expect(() => getProficiencies(playerStats, true, getChoiceCount, config)).toThrow(TypeError);
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

      it('adds zero bonus skill proficiencies when bonus_skill_proficiencies is 0', () => {
        const config = {
          raceProficiencies: () => [],
          bonusSource: { bonus_skill_proficiencies: 0 },
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

      it('merges proficiency_choices from bonusSource into skill pool', () => {
        const config = {
          raceProficiencies: () => [],
          bonusSource: {
            proficiency_choices: [
              { choose: 1, from: ['Skill: History', 'Skill: Insight'] },
            ],
          },
        };

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
        const [allowed, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, config);

        expect(proficiencies).toEqual(['History', 'Insight']);
        expect(allowed).toBe(4);
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

        expect(skillProfs).toContain('Acrobatics');
        expect(skillProfs).toContain('Athletics');
        expect(skillProfs).not.toContain('Tool: Smith Tools');
      });

      it('merges Skill: prefixed bonus_proficiencies as fixed skill grants (CLA-181 Implements of Mercy)', () => {
        const config = {
          raceProficiencies: () => [],
          bonusSource: {
            bonus_proficiencies: ['Skill: Insight', 'Skill: Medicine', 'Herbalism Kit'],
          },
        };

        const playerStats = {
          class: {
            proficiencies: [],
          },
          race: {
            starting_proficiencies: [],
          },
          skillProficiencies: ['Religion'],
        };

        const getChoiceCount = () => 0;
        const [allowed, proficiencies] = getProficiencies(playerStats, true, getChoiceCount, config);

        expect(proficiencies).toEqual(['Insight', 'Medicine', 'Religion']);
        // Fixed grants must not inflate the selectable allowance
        expect(allowed).toBe(2);
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
    });

    describe('non-skill proficiencies (skill=false)', () => {
      it('excludes skill proficiencies from non-skill pool', () => {
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

        expect(proficiencies).toEqual(['Darkvision', 'Light Armor', 'Medium Armor']);
        expect(allowed).toBe(3);
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

        expect(proficiencies).toEqual(['Light Armor', 'Shields']);
      });

      it('adds bonus proficiencies from subclass bonus_proficiencies', () => {
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

        expect(proficiencies).toEqual(['Heavy Armor', 'Light Armor', 'Martial Weapons']);
        expect(allowed).toBe(3);
      });

      it('excludes Skill: prefixed bonus_proficiencies from non-skill pool (CLA-181 Implements of Mercy)', () => {
        const config = {
          raceProficiencies: () => [],
          bonusSource: {
            bonus_proficiencies: ['Skill: Insight', 'Skill: Medicine', 'Herbalism Kit'],
          },
        };

        const playerStats = {
          class: {
            proficiencies: ['Light Martial Weapons', 'Simple Weapons'],
          },
          race: {
            starting_proficiencies: [],
          },
          proficiencies: [],
        };

        const getChoiceCount = () => 0;
        const [, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, config);

        expect(proficiencies).toEqual(['Herbalism Kit', 'Light Martial Weapons', 'Simple Weapons']);
      });

      it('adds class-based non-skill proficiency choices to the allowed count', () => {
        const playerStats = {
          class: {
            proficiencies: ['Light Armor'],
            proficiency_choices: [
              { choose: 1, from: ['Heavy Armor', 'Martial Weapons'] },
            ],
          },
          race: {
            starting_proficiencies: [],
          },
          proficiencies: [],
        };

        const getChoiceCount = () => 1;
        const [allowed] = getProficiencies(playerStats, false, getChoiceCount, defaultConfig);

        expect(allowed).toBe(2);
      });

      it('merges background tool proficiencies', () => {
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

        expect(proficiencies).toContain('Tool: Cook\'s Supplies');
      });

      it('merges background tool proficiency choices and counts them', () => {
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
        expect(allowed).toBe(4);
      });

      it('treats choose=0 as choose=1 in background tool choices', () => {
        const config = {
          ...defaultConfig,
          backgroundToolProficiencyChoices: () => [
            { choose: 0, from: ['Tool: Alchemist Supplies', 'Tool: Brewer Supplies'] },
          ],
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

        expect(proficiencies).toContain('Tool: Alchemist Supplies');
        expect(proficiencies).toContain('Tool: Brewer Supplies');
        expect(allowed).toBe(3);
      });

      it('merges proficiency_choices from bonusSource into non-skill pool', () => {
        const config = {
          raceProficiencies: () => [],
          bonusSource: {
            proficiency_choices: [
              { choose: 1, from: ['Tool: Alchemist Supplies', 'Tool: Brewer Supplies'] },
            ],
          },
        };

        const playerStats = {
          class: {
            proficiencies: [],
          },
          race: {
            starting_proficiencies: [],
          },
          proficiencies: [],
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
        const [, toolProfs] = getProficiencies(playerStats, false, getChoiceCount, config);

        expect(toolProfs).toContain('Tool: Smith Tools');
        expect(toolProfs).not.toContain('Acrobatics');
      });

      it('handles empty proficiencies from all sources', () => {
        const playerStats = {
          class: {
            proficiencies: [],
          },
          race: {
            starting_proficiencies: [],
          },
          proficiencies: [],
        };

        const getChoiceCount = () => 0;
        const [allowed, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, defaultConfig);

        expect(proficiencies).toEqual([]);
        expect(allowed).toBe(0);
      });

      it('deduplicates proficiencies from all sources', () => {
        const playerStats = {
          class: {
            proficiencies: ['Light Armor', 'Medium Armor'],
          },
          race: {
            starting_proficiencies: ['Light Armor'],
          },
          proficiencies: ['Medium Armor'],
        };

        const getChoiceCount = () => 0;
        const [, proficiencies] = getProficiencies(playerStats, false, getChoiceCount, defaultConfig);

        expect(proficiencies).toEqual(['Light Armor', 'Medium Armor']);
      });
    });

    describe('error handling', () => {
      it('throws TypeError when playerStats has no class property', () => {
        const playerStats = {
          skillProficiencies: [],
        };

        const getChoiceCount = () => 0;
        expect(() => getProficiencies(playerStats, true, getChoiceCount, defaultConfig)).toThrow(TypeError);
      });

      it('throws TypeError when class property is undefined', () => {
        const playerStats = {
          class: undefined,
          race: { starting_proficiencies: [] },
          skillProficiencies: [],
        };

        const getChoiceCount = () => 0;
        expect(() => getProficiencies(playerStats, true, getChoiceCount, defaultConfig)).toThrow(TypeError);
      });
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

    it('throws when proficiency_choices has empty from array', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 2, from: [] },
          ],
        },
        race: {},
      };

      expect(() => getProficiencyChoiceCount(playerStats, true)).toThrow(TypeError);
    });

    it('throws when proficiency_choices has missing from property', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 2 },
          ],
        },
        race: {},
      };

      expect(() => getProficiencyChoiceCount(playerStats, true)).toThrow(TypeError);
    });

    it('throws when proficiency_choices has undefined from[0]', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 2, from: [undefined] },
          ],
        },
        race: {},
      };

      expect(() => getProficiencyChoiceCount(playerStats, true)).toThrow(TypeError);
    });

    it('handles proficiency_choices with choose=0', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 0, from: ['Skill: Acrobatics'] },
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

    it('counts racial trait non-skill choices when skills=false', () => {
      const playerStats = {
        class: {},
        race: {
          subrace: {
            racial_traits: [
              {
                proficiency_choices: {
                  choose: 2,
                  from: ['Heavy Armor', 'Martial Weapons'],
                },
              },
            ],
          },
        },
      };

      expect(getProficiencyChoiceCount(playerStats, false)).toBe(2);
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

    it('throws when racial traits have empty from array', () => {
      const playerStats = {
        class: {},
        race: {
          subrace: {
            racial_traits: [
              {
                proficiency_choices: {
                  choose: 1,
                  from: [],
                },
              },
            ],
          },
        },
      };

      expect(() => getProficiencyChoiceCount(playerStats, true)).toThrow(TypeError);
    });

    it('throws when racial traits have missing from property', () => {
      const playerStats = {
        class: {},
        race: {
          subrace: {
            racial_traits: [
              {
                proficiency_choices: {
                  choose: 1,
                },
              },
            ],
          },
        },
      };

      expect(() => getProficiencyChoiceCount(playerStats, true)).toThrow(TypeError);
    });

    it('throws when racial traits have undefined from[0]', () => {
      const playerStats = {
        class: {},
        race: {
          subrace: {
            racial_traits: [
              {
                proficiency_choices: {
                  choose: 1,
                  from: [undefined],
                },
              },
            ],
          },
        },
      };

      expect(() => getProficiencyChoiceCount(playerStats, true)).toThrow(TypeError);
    });
  });
});
