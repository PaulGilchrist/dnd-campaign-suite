// @improved-by-ai
import { describe, it, expect } from 'vitest';

import rules from '../rules.js';

describe('rules.getProficiencyChoiceCount', () => {
  describe('5e ruleset', () => {
    it('should count skill proficiency choices from class proficiency_choices', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 2, from: ['Skill: Arcana', 'Skill: History'] }
          ]
        },
        race: {}
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(2);
    });

    it('should count non-skill proficiency choices from class proficiency_choices', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 1, from: ['Tool: Carpenter Tools'] }
          ]
        },
        race: {}
      };

      const result = rules.getProficiencyChoiceCount(playerStats, false);

      expect(result).toBe(1);
    });

    it('should filter out non-matching type choices (skill=false ignores Skill: entries)', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 3, from: ['Skill: Arcana', 'Skill: History', 'Skill: Nature'] }
          ]
        },
        race: {}
      };

      const result = rules.getProficiencyChoiceCount(playerStats, false);

      expect(result).toBe(0);
    });

    it('should include race starting_proficiency_options when type matches', () => {
      const playerStats = {
        class: {},
        race: {
          starting_proficiency_options: {
            choose: 1,
            from: ['Skill: Stealth']
          }
        }
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(1);
    });

    it('should exclude race starting_proficiency_options when type does not match', () => {
      const playerStats = {
        class: {},
        race: {
          starting_proficiency_options: {
            choose: 2,
            from: ['Tool: Smith\'s Tools']
          }
        }
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(0);
    });

    it('should include subrace racial_trait proficiency_choices when type matches', () => {
      const playerStats = {
        class: {},
        race: {
          subrace: {
            racial_traits: [
              { proficiency_choices: { choose: 1, from: ['Skill: Nature'] } }
            ]
          }
        }
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(1);
    });

    it('should exclude subrace racial_trait proficiency_choices when type does not match', () => {
      const playerStats = {
        class: {},
        race: {
          subrace: {
            racial_traits: [
              { proficiency_choices: { choose: 1, from: ['Armor: Light Armor'] } }
            ]
          }
        }
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(0);
    });

    it('should sum matching choices from class, race, and subrace', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 2, from: ['Skill: Arcana', 'Skill: History'] }
          ]
        },
        race: {
          starting_proficiency_options: {
            choose: 1,
            from: ['Skill: Stealth']
          },
          subrace: {
            racial_traits: [
              { proficiency_choices: { choose: 1, from: ['Skill: Nature'] } }
            ]
          }
        }
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(4);
    });

    it('should sum non-skill choices from class, race, and subrace', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 1, from: ['Tool: Carpenter Tools'] }
          ]
        },
        race: {
          starting_proficiency_options: {
            choose: 2,
            from: ['Tool: Smith\'s Tools', 'Tool: Brewer\'s Tools']
          },
          subrace: {
            racial_traits: [
              { proficiency_choices: { choose: 1, from: ['Armor: Medium Armor'] } }
            ]
          }
        }
      };

      const result = rules.getProficiencyChoiceCount(playerStats, false);

      expect(result).toBe(4);
    });

    it('should return 0 when class.proficiency_choices is undefined', () => {
      const playerStats = {
        class: {},
        race: {}
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(0);
    });

    it('should return 0 when race.starting_proficiency_options is null', () => {
      const playerStats = {
        class: {},
        race: {
          starting_proficiency_options: null
        }
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(0);
    });

    it('should return 0 when race.subrace is null', () => {
      const playerStats = {
        class: {},
        race: {
          subrace: null,
          racial_traits: []
        }
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(0);
    });

    it('should handle multiple proficiency_choices entries in class', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 2, from: ['Skill: Arcana', 'Skill: History'] },
            { choose: 1, from: ['Skill: Religion'] }
          ]
        },
        race: {}
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(3);
    });

    it('should handle multiple racial_traits with proficiency_choices', () => {
      const playerStats = {
        class: {},
        race: {
          subrace: {
            racial_traits: [
              { proficiency_choices: { choose: 1, from: ['Skill: Nature'] } },
              { proficiency_choices: { choose: 2, from: ['Skill: Arcana', 'Skill: History'] } }
            ]
          }
        }
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(3);
    });

    it('should throw when race_trait proficiency_choices.from is empty (source bug)', () => {
      const playerStats = {
        class: {},
        race: {
          subrace: {
            racial_traits: [
              { proficiency_choices: { choose: 5, from: [] } }
            ]
          }
        }
      };

      expect(() => rules.getProficiencyChoiceCount(playerStats, true)).toThrow();
    });
  });

  describe('2024 ruleset dispatch', () => {
    it('should delegate to proficiencyUtils2024 when rules is "2024"', () => {
      const playerStats = {
        rules: '2024',
        class: {
          skill_proficiency_choices: 'Choose 3 from any 3 skills',
          major: {
            proficiency_choices: [
              { choose: 2, from: ['Skill: Stealth', 'Skill: Deception'] }
            ]
          }
        },
        race: {
          starting_proficiency_options: {
            choose: 1,
            from: ['Skill: Insight']
          },
          traits: [
            { proficiency_choices: { choose: 1, from: ['Skill: Medicine'] } }
          ]
        }
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);
      expect(result).toBe(7);
    });

    it('should count 2024 race trait proficiency_choices for non-skill', () => {
      const playerStats = {
        rules: '2024',
        class: {},
        race: {
          starting_proficiency_options: {
            choose: 1,
            from: ['Tool: Carpenter\'s Tools']
          },
          traits: [
            { proficiency_choices: { choose: 2, from: ['Tool: Smith\'s Tools', 'Tool: Brewer\'s Tools'] } }
          ]
        }
      };

      const result = rules.getProficiencyChoiceCount(playerStats, false);
      expect(result).toBe(3);
    });

    it('should count 2024 subclass/major proficiency_choices', () => {
      const playerStats = {
        rules: '2024',
        class: {
          major: {
            proficiency_choices: [
              { choose: 2, from: ['Skill: Arcana', 'Skill: History'] }
            ]
          }
        },
        race: {}
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);
      expect(result).toBe(2);
    });

    it('should fall back to 5e when rules is missing', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 3, from: ['Skill: Arcana', 'Skill: History', 'Skill: Nature'] }
          ]
        },
        race: {}
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);
      expect(result).toBe(3);
    });

    it('should use 5e when rules is "5e"', () => {
      const playerStats = {
        rules: '5e',
        class: {
          proficiency_choices: [
            { choose: 2, from: ['Skill: Stealth', 'Skill: Sleight of Hand'] }
          ]
        },
        race: {}
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);
      expect(result).toBe(2);
    });
  });
});

describe('rules.getProficiencies', () => {
  describe('5e ruleset', () => {
    it('should return skill proficiencies filtered and prefixed-stripped when skill=true', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Arcana', 'Skill: History', 'Tool: Carpenter Tools'],
          subclass: {}
        },
        race: {
          starting_proficiencies: ['Skill: Stealth'],
          traits: [],
          subrace: null
        },
        skillProficiencies: ['Religion']
      };

      const [allowed, proficiencies] = rules.getProficiencies(playerStats, true);

      expect(allowed).toBe(5);
      expect(proficiencies).toEqual(['Arcana', 'History', 'Religion', 'Stealth']);
    });

    it('should return non-skill proficiencies when skill=false', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Arcana', 'Tool: Carpenter Tools', 'Armor: Light Armor'],
          subclass: {}
        },
        race: {
          starting_proficiencies: ['Tool: Thief Tools'],
          traits: [],
          subrace: null
        },
        proficiencies: ['Armor: Medium Armor']
      };

      const [, proficiencies] = rules.getProficiencies(playerStats, false);

      expect(proficiencies).toEqual(['Armor: Light Armor', 'Armor: Medium Armor', 'Tool: Carpenter Tools', 'Tool: Thief Tools']);
      expect(proficiencies).not.toContain('Arcana');
    });

    it('should deduplicate across class, race, and selected proficiencies', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Arcana'],
          subclass: {}
        },
        race: {
          starting_proficiencies: ['Skill: Arcana'],
          traits: [],
          subrace: null
        },
        skillProficiencies: ['Arcana']
      };

      const [, proficiencies] = rules.getProficiencies(playerStats, true);

      expect(proficiencies).toEqual(['Arcana']);
      expect(proficiencies.filter(p => p === 'Arcana')).toHaveLength(1);
    });

    it('should return sorted proficiencies', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Zebrian', 'Skill: Arcana'],
          subclass: {}
        },
        race: {
          starting_proficiencies: [],
          traits: [],
          subrace: null
        },
        skillProficiencies: []
      };

      const [, proficiencies] = rules.getProficiencies(playerStats, true);

      expect(proficiencies).toEqual(['Arcana', 'Zebrian']);
    });

    it('should include subclass bonus_skill_proficiencies in allowed count', () => {
      const playerStats = {
        class: {
          proficiencies: [],
          subclass: {
            name: 'Lore',
            bonus_skill_proficiencies: 2
          }
        },
        race: {
          starting_proficiencies: [],
          traits: [],
          subrace: null
        },
        skillProficiencies: []
      };

      const [allowed, proficiencies] = rules.getProficiencies(playerStats, true);

      // 2 (background) + 2 (subclass bonus) = 4
      expect(allowed).toBe(4);
      expect(proficiencies).toEqual([]);
    });

    it('should include subclass bonus_proficiencies for non-skill', () => {
      const playerStats = {
        class: {
          proficiencies: [],
          subclass: {
            name: 'Valor',
            bonus_proficiencies: ['Armor: Medium Armor']
          }
        },
        race: {
          starting_proficiencies: [],
          traits: [],
          subrace: null
        },
        proficiencies: []
      };

      const [, proficiencies] = rules.getProficiencies(playerStats, false);

      expect(proficiencies).toContain('Armor: Medium Armor');
    });

    it('should include race trait proficiencies via raceProficiencies callback', () => {
      const playerStats = {
        class: {
          proficiencies: [],
          subclass: {}
        },
        race: {
          starting_proficiencies: [],
          traits: [
            { proficiencies: ['Skill: Nature'] }
          ],
          subrace: null
        },
        skillProficiencies: []
      };

      const [allowed, proficiencies] = rules.getProficiencies(playerStats, true);

      expect(proficiencies).toContain('Nature');
      expect(allowed).toBe(3); // 2 background + 1 trait
    });

    it('should include subrace starting_proficiencies and racial_trait proficiencies', () => {
      const playerStats = {
        class: {
          proficiencies: [],
          subclass: {}
        },
        race: {
          starting_proficiencies: [],
          traits: [],
          subrace: {
            starting_proficiencies: ['Skill: Religion'],
            racial_traits: [
              { proficiencies: ['Skill: History'] }
            ]
          }
        },
        skillProficiencies: []
      };

      const [allowed, proficiencies] = rules.getProficiencies(playerStats, true);

      expect(proficiencies).toContain('Religion');
      expect(proficiencies).toContain('History');
      expect(allowed).toBe(4); // 2 background + 1 subrace starting + 1 racial_trait
    });

    it('should include subclass proficiency_choices in the proficiencies list', () => {
      const playerStats = {
        class: {
          proficiencies: [],
          subclass: {
            proficiency_choices: [
              { choose: 2, from: ['Skill: Arcana', 'Skill: History'] }
            ]
          }
        },
        race: {
          starting_proficiencies: [],
          traits: [],
          subrace: null
        },
        skillProficiencies: []
      };

      const [allowed, proficiencies] = rules.getProficiencies(playerStats, true);

      expect(proficiencies).toContain('Arcana');
      expect(proficiencies).toContain('History');
      expect(allowed).toBe(4); // 2 background + 2 subclass choices
    });

    it('should handle empty arrays gracefully', () => {
      const playerStats = {
        class: {
          proficiencies: [],
          subclass: {}
        },
        race: {
          starting_proficiencies: [],
          traits: [],
          subrace: null
        },
        skillProficiencies: []
      };

      const [allowed, proficiencies] = rules.getProficiencies(playerStats, true);

      expect(proficiencies).toEqual([]);
      expect(allowed).toBe(2); // only background
    });

    it('should handle missing proficiencies arrays', () => {
      const playerStats = {
        class: {
          subclass: {}
        },
        race: {
          traits: [],
          subrace: null
        }
      };

      const [allowed, proficiencies] = rules.getProficiencies(playerStats, true);

      expect(proficiencies).toEqual([]);
      expect(allowed).toBe(2);
    });

    it('should merge skillProficiencies with class and race proficiencies', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Arcana'],
          subclass: {}
        },
        race: {
          starting_proficiencies: ['Skill: History'],
          traits: [],
          subrace: null
        },
        skillProficiencies: ['Religion', 'Stealth']
      };

      const [, proficiencies] = rules.getProficiencies(playerStats, true);

      expect(proficiencies).toEqual(['Arcana', 'History', 'Religion', 'Stealth']);
    });

    it('should merge proficiencies for non-skill including playerStats.proficiencies', () => {
      const playerStats = {
        class: {
          proficiencies: ['Armor: Light Armor'],
          subclass: {}
        },
        race: {
          starting_proficiencies: ['Tool: Smith\'s Tools'],
          traits: [],
          subrace: null
        },
        proficiencies: ['Armor: Medium Armor']
      };

      const [, proficiencies] = rules.getProficiencies(playerStats, false);

      expect(proficiencies).toEqual(['Armor: Light Armor', 'Armor: Medium Armor', "Tool: Smith's Tools"]);
    });
  });

  describe('2024 ruleset dispatch', () => {
    it('should delegate to proficiencyUtils2024 when rules is "2024"', () => {
      const playerStats = {
        rules: '2024',
        class: { major: { name: 'Evocation' } },
        race: { traits: [], starting_proficiencies: [] },
        proficiencies: [],
        skillProficiencies: []
      };

      const [allowed, proficiencies] = rules.getProficiencies(playerStats, true);

      // Should return default 2 background skill proficiencies
      expect(allowed).toBe(2);
      expect(proficiencies).toEqual([]);
    });

    it('should include 2024 race trait proficiencies from description parsing', () => {
      const playerStats = {
        rules: '2024',
        class: { major: { name: 'Fighter' } },
        race: {
          traits: [
            { description: 'You have proficiency in the Medicine and Survival skills' }
          ],
          starting_proficiencies: []
        },
        proficiencies: [],
        skillProficiencies: []
      };

      const [, proficiencies] = rules.getProficiencies(playerStats, true);

      expect(proficiencies).toContain('Medicine');
      expect(proficiencies).toContain('Survival');
    });

    it('should include 2024 subclass major bonus_proficiencies', () => {
      const playerStats = {
        rules: '2024',
        class: { major: { name: 'Bard', bonus_proficiencies: ['Tool: Musical Instrument'] } },
        race: { traits: [], starting_proficiencies: [] },
        proficiencies: []
      };

      const [, proficiencies] = rules.getProficiencies(playerStats, false);

      expect(proficiencies).toContain('Tool: Musical Instrument');
    });

    it('should fall back to 5e when rules is missing', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Arcana'],
          subclass: {}
        },
        race: {
          starting_proficiencies: [],
          traits: [],
          subrace: null
        },
        skillProficiencies: []
      };

      const [allowed, proficiencies] = rules.getProficiencies(playerStats, true);

      expect(proficiencies).toContain('Arcana');
      expect(allowed).toBe(3);
    });

    it('should handle 2024 with race trait proficiency_choices counted in allowed', () => {
      const playerStats = {
        rules: '2024',
        class: { major: { name: 'Rogue' } },
        race: {
          traits: [
            {
              proficiency_choices: {
                choose: 2,
                from: ['Skill: Arcana', 'Skill: History']
              }
            }
          ],
          starting_proficiencies: []
        },
        proficiencies: [],
        skillProficiencies: []
      };

      const [allowed, proficiencies] = rules.getProficiencies(playerStats, true);

      // proficiency_choices from traits are counted in allowed but not added to the list
      // (they represent choices the player makes, not pre-selected proficiencies)
      expect(proficiencies).toEqual([]);
      expect(allowed).toBe(4); // 2 background + 2 from trait choice
    });
  });
});
