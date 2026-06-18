import { describe, it, expect, vi } from 'vitest';

vi.mock('../../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([])
}));

import rules from '../rules.js';

describe('rules', () => {
  describe('getLanguages', () => {
    it('should include race languages', () => {
      const playerStats = {
        race: {
          languages: ['Common', 'Elvish']
        },
        class: {
          languages: []
        },
        level: 1
      };

      const [_languagesAllowed, languages] = rules.getLanguages(playerStats);
      void _languagesAllowed;

      expect(languages).toContain('Common');
      expect(languages).toContain('Elvish');
    });

    it('should include class languages', () => {
      const playerStats = {
        race: {
          languages: ['Common']
        },
        class: {
          languages: ['Druidic']
        },
        level: 1
      };

      const [_languagesAllowed, languages] = rules.getLanguages(playerStats);
      void _languagesAllowed;

      expect(languages).toContain('Common');
      expect(languages).toContain('Druidic');
    });

    it('should add 2 backstory languages', () => {
      const playerStats = {
        race: {
          languages: ['Common']
        },
        class: {
          languages: []
        },
        level: 1
      };

      const [languagesAllowed] = rules.getLanguages(playerStats);

      expect(languagesAllowed).toBeGreaterThanOrEqual(2);
    });

    it('should include player languages', () => {
      const playerStats = {
        race: {
          languages: ['Common']
        },
        class: {
          languages: []
        },
        languages: ['Dwarvish'],
        level: 1
      };

      const [_languagesAllowed, languages] = rules.getLanguages(playerStats);
      void _languagesAllowed;

      expect(languages).toContain('Common');
      expect(languages).toContain('Dwarvish');
    });

    it('should deduplicate languages', () => {
      const playerStats = {
        race: {
          languages: ['Common']
        },
        class: {
          languages: ['Common']
        },
        languages: ['Common'],
        level: 1
      };

      const [_languagesAllowed, languages] = rules.getLanguages(playerStats);
      void _languagesAllowed;

      expect(languages.filter(l => l === 'Common')).toHaveLength(1);
    });

    it('should return sorted languages', () => {
      const playerStats = {
        race: {
          languages: ['Zebrian', 'Common']
        },
        class: {
          languages: []
        },
        level: 1
      };

      const [_languagesAllowed, languages] = rules.getLanguages(playerStats);
      void _languagesAllowed;

      expect(languages[0]).toBe('Common');
    });

    it('should handle race language choices', () => {
      const playerStats = {
        race: {
          languages: ['Common'],
          language_choices: {
            choose: 2,
            options: ['Dwarvish', 'Elvish', 'Gnomish']
          }
        },
        class: {
          languages: []
        },
        level: 1
      };

      const [languagesAllowed] = rules.getLanguages(playerStats);

      expect(languagesAllowed).toBeGreaterThanOrEqual(4); // 1 base + 2 backstory + 2 choices
    });

    it('should handle Ranger bonus languages at level 6+', () => {
      const playerStats = {
        race: {
          languages: ['Common']
        },
        class: {
          name: 'Ranger',
          languages: ['Druidic'],
          language_choices: {
            choose: 1
          }
        },
        level: 6
      };

      const [languagesAllowed] = rules.getLanguages(playerStats);

      expect(languagesAllowed).toBeGreaterThan(4);
    });

    it('should handle Ranger bonus languages at level 14+', () => {
      const playerStats = {
        race: {
          languages: ['Common']
        },
        class: {
          name: 'Ranger',
          languages: ['Druidic'],
          language_choices: {
            choose: 1
          }
        },
        level: 14
      };

      const [languagesAllowed] = rules.getLanguages(playerStats);

      expect(languagesAllowed).toBeGreaterThan(5);
    });
  });

  describe('2024 ruleset dispatch / getLanguages', () => {
    it('should use class.major.language_choices in 2024 mode', () => {
      const playerStats = {
        rules: '2024',
        race: { languages: ['Common'] },
        class: { languages: [], major: { language_choices: { choose: 3 } } },
        level: 1
      };
      const [languagesAllowed] = rules.getLanguages(playerStats);
      expect(languagesAllowed).toBeGreaterThanOrEqual(5); // 1 + 2 (background) + 3 (major)
    });

    it('should use class.subclass.language_choices in 5e mode', () => {
      const playerStats = {
        race: { languages: ['Common'] },
        class: {
          languages: [],
          subclass: { language_choices: { choose: 2 } }
        },
        level: 1
      };
      const [languagesAllowed] = rules.getLanguages(playerStats);
      expect(languagesAllowed).toBeGreaterThanOrEqual(4); // 1 + 2 (background) + 2 (subclass)
    });
  });
});
