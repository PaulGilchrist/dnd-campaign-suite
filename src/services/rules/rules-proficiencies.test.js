import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([])
}));

vi.mock('../character/proficiencyUtils2024.js', () => ({
  getProficiencyChoiceCount: vi.fn(),
  getProficiencies: vi.fn()
}));

import rules from './rules.js';
import * as proficiencyUtils2024 from '../character/proficiencyUtils2024.js';

describe('rules', () => {
  describe('getProficiencyChoiceCount', () => {
    it('should count skill proficiency choices from class', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 2, from: ['Skill: Arcana', 'Skill: History'] }
          ]
        },
        race: {
          starting_proficiency_options: null
        }
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(2);
    });

    it('should count non-skill proficiency choices from class', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 1, from: ['Tool: Carpenter Tools'] }
          ]
        },
        race: {
          starting_proficiency_options: null
        }
      };

      const result = rules.getProficiencyChoiceCount(playerStats, false);

      expect(result).toBe(1);
    });

    it('should include race proficiency choices', () => {
      const playerStats = {
        class: {
          proficiency_choices: []
        },
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

    it('should include subrace racial trait proficiency choices', () => {
      const playerStats = {
        class: {
          proficiency_choices: []
        },
        race: {
          starting_proficiency_options: null,
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

    it('should sum all proficiency choices', () => {
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

    it('should handle missing proficiency_choices', () => {
      const playerStats = {
        class: {},
        race: {}
      };

      const result = rules.getProficiencyChoiceCount(playerStats, true);

      expect(result).toBe(0);
    });
  });

  describe('getProficiencies', () => {
    it('should return skill proficiencies when skill=true', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Arcana', 'Skill: History', 'Tool: Carpenter Tools']
        },
        race: {
          starting_proficiencies: ['Skill: Stealth'],
          traits: [],
          subrace: null
        },
        skillProficiencies: ['Religion']
      };

      const [_allowed, proficiencies] = rules.getProficiencies(playerStats, true);
      void _allowed;

      expect(proficiencies).toContain('Arcana');
      expect(proficiencies).toContain('History');
      expect(proficiencies).toContain('Stealth');
      expect(proficiencies).toContain('Religion');
      expect(proficiencies).not.toContain('Carpenter Tools');
    });

    it('should return non-skill proficiencies when skill=false', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Arcana', 'Tool: Carpenter Tools', 'Armor: Light Armor']
        },
        race: {
          starting_proficiencies: ['Tool: Thief Tools'],
          traits: [],
          subrace: null
        },
        proficiencies: ['Armor: Medium Armor']
      };

      const [_allowed, proficiencies] = rules.getProficiencies(playerStats, false);
      void _allowed;

      expect(proficiencies).toContain('Tool: Carpenter Tools');
      expect(proficiencies).toContain('Tool: Thief Tools');
      expect(proficiencies).toContain('Armor: Light Armor');
      expect(proficiencies).toContain('Armor: Medium Armor');
      expect(proficiencies).not.toContain('Arcana');
    });

    it('should deduplicate proficiencies', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Arcana']
        },
        race: {
          starting_proficiencies: ['Skill: Arcana'],
          traits: [],
          subrace: null
        },
        skillProficiencies: []
      };

      const [_allowed, proficiencies] = rules.getProficiencies(playerStats, true);
      void _allowed;

      expect(proficiencies.filter(p => p === 'Arcana')).toHaveLength(1);
    });

    it('should return sorted proficiencies', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Zebrian', 'Skill: Arcana']
        },
        race: {
          starting_proficiencies: [],
          traits: [],
          subrace: null
        },
        skillProficiencies: []
      };

      const [_allowed, proficiencies] = rules.getProficiencies(playerStats, true);
      void _allowed;

      expect(proficiencies[0]).toBe('Arcana');
    });

    it('should include subclass skill proficiencies', () => {
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

      const [allowed] = rules.getProficiencies(playerStats, true);

      expect(allowed).toBeGreaterThanOrEqual(4); // 2 backstory + 2 subclass bonus
    });

    it('should include subclass tool proficiencies', () => {
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

      const [_allowed, proficiencies] = rules.getProficiencies(playerStats, false);
      void _allowed;

      expect(proficiencies).toContain('Armor: Medium Armor');
    });
  });

  describe('2024 ruleset dispatch / getProficiencyChoiceCount', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should dispatch to 2024 proficiencyUtils via getSubModules', () => {
      proficiencyUtils2024.getProficiencyChoiceCount.mockReturnValue(5);
      const playerStats = { rules: '2024', class: {}, race: {} };
      const result = rules.getProficiencyChoiceCount(playerStats, true);
      expect(result).toBe(5);
      expect(proficiencyUtils2024.getProficiencyChoiceCount).toHaveBeenCalled();
    });

    it('should use 5e when rules is missing (default)', () => {
      const playerStats = {
        class: {
          proficiency_choices: [
            { choose: 3, from: ['Skill: Arcana'] }
          ]
        },
        race: { starting_proficiency_options: null }
      };
      const result = rules.getProficiencyChoiceCount(playerStats, true);
      expect(result).toBe(3);
    });
  });

  describe('2024 ruleset dispatch / getProficiencies', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should dispatch to 2024 and use class.major as bonusSource', () => {
      proficiencyUtils2024.getProficiencies.mockReturnValue([5, ['Arcana', 'History']]);
      const playerStats = {
        rules: '2024',
        class: { major: { name: 'Evocation' } },
        race: { traits: [], starting_proficiencies: [] },
        proficiencies: []
      };
      const [, proficiencies] = rules.getProficiencies(playerStats, true);
      expect(proficiencies).toContain('Arcana');
      expect(proficiencyUtils2024.getProficiencies).toHaveBeenCalled();
    });

    it('should use 5e with race trait and subrace proficiencies', () => {
      const playerStats = {
        class: {
          proficiencies: ['Skill: Arcana'],
          subclass: { name: 'Lore' }
        },
        race: {
          starting_proficiencies: [],
          traits: [
            { proficiencies: ['Skill: Nature'] }
          ],
          subrace: {
            starting_proficiencies: ['Skill: Religion'],
            racial_traits: [
              { proficiencies: ['Skill: History'] }
            ]
          }
        },
        skillProficiencies: []
      };
      const [, proficiencies] = rules.getProficiencies(playerStats, true);
      expect(proficiencies).toContain('Nature');
      expect(proficiencies).toContain('Religion');
      expect(proficiencies).toContain('History');
    });
  });
});
