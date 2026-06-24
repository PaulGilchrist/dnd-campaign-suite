// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

import rules from '../rules.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([]),
}));

describe('rules.getLanguages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseStats = {
    race: { languages: ['Common'] },
    class: { languages: [] },
    level: 1,
  };

  describe('5e ruleset', () => {
    it('returns [languagesAllowed, sortedLanguages] tuple', () => {
      const result = rules.getLanguages(
        { ...baseStats, languages: [] },
        {},
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(typeof result[0]).toBe('number');
      expect(Array.isArray(result[1])).toBe(true);
    });

    it('returns race languages in the list', () => {
      const stats = {
        ...baseStats,
        race: { languages: ['Common', 'Elvish'] },
        languages: [],
      };
      const [, languages] = rules.getLanguages(stats, {});
      expect(languages).toEqual(['Common', 'Elvish']);
    });

    it('includes class languages in the list', () => {
      const stats = {
        ...baseStats,
        class: { languages: ['Druidic'] },
        languages: [],
      };
      const [, languages] = rules.getLanguages(stats, {});
      expect(languages).toContain('Druidic');
    });

    it('includes player-chosen languages', () => {
      const stats = {
        ...baseStats,
        languages: ['Dwarvish'],
      };
      const [, languages] = rules.getLanguages(stats, {});
      expect(languages).toContain('Dwarvish');
    });

    it('deduplicates languages across all sources', () => {
      const stats = {
        ...baseStats,
        race: { languages: ['Common'] },
        class: { languages: ['Common'] },
        languages: ['Common'],
      };
      const [, languages] = rules.getLanguages(stats, {});
      expect(languages).toEqual(['Common']);
    });

    it('returns languages sorted alphabetically', () => {
      const stats = {
        ...baseStats,
        race: { languages: ['Zebrian', 'Abyssal', 'Common'] },
        languages: [],
      };
      const [, languages] = rules.getLanguages(stats, {});
      expect(languages).toEqual(['Abyssal', 'Common', 'Zebrian']);
    });

    it('adds 2 background languages to the allowed count', () => {
      const stats = {
        ...baseStats,
        race: { languages: [] },
        class: { languages: [] },
        languages: [],
      };
      const [languagesAllowed] = rules.getLanguages(stats, {});
      expect(languagesAllowed).toBe(2);
    });

    it('includes subrace languages in the list', () => {
      const stats = {
        ...baseStats,
        race: {
          languages: ['Common'],
          subrace: {
            languages: ['Elvish'],
            language_options: { choose: 0 },
          },
        },
        languages: [],
      };
      const [, languages] = rules.getLanguages(stats, {});
      expect(languages).toContain('Elvish');
    });

    it('adds subrace choose count to languagesAllowed', () => {
      const stats = {
        ...baseStats,
        race: {
          languages: ['Common'],
          subrace: {
            languages: [],
            language_options: { choose: 3 },
          },
        },
        class: { languages: [] },
        languages: [],
      };
      const [languagesAllowed] = rules.getLanguages(stats, {});
      // 1 (race) + 2 (background) + 3 (subrace choose) = 6
      expect(languagesAllowed).toBe(6);
    });

    it('adds race language_choices choose count', () => {
      const stats = {
        ...baseStats,
        race: {
          languages: ['Common'],
          language_choices: { choose: 2 },
        },
        class: { languages: [] },
        languages: [],
      };
      const [languagesAllowed] = rules.getLanguages(stats, {});
      // 1 (race) + 2 (background) + 2 (race language_choices) = 5
      expect(languagesAllowed).toBe(5);
    });

    it('adds subclass language_choices choose count', () => {
      const stats = {
        ...baseStats,
        class: {
          languages: [],
          subclass: { language_choices: { choose: 2 } },
        },
        languages: [],
      };
      const [languagesAllowed] = rules.getLanguages(stats, {});
      // 1 (race) + 2 (background) + 2 (subclass) = 5
      expect(languagesAllowed).toBe(5);
    });

    it('adds Ranger level >5 bonus language', () => {
      const stats = {
        ...baseStats,
        class: {
          name: 'Ranger',
          languages: [],
          language_choices: { choose: 0 },
        },
        level: 6,
        languages: [],
      };
      const [languagesAllowed] = rules.getLanguages(stats, {});
      // 1 (race) + 2 (background) + 1 (ranger level>5) = 4
      expect(languagesAllowed).toBe(4);
    });

    it('adds Ranger level >13 bonus language', () => {
      const stats = {
        ...baseStats,
        class: {
          name: 'Ranger',
          languages: [],
          language_choices: { choose: 0 },
        },
        level: 14,
        languages: [],
      };
      const [languagesAllowed] = rules.getLanguages(stats, {});
      // 1 (race) + 2 (background) + 1 (ranger level>5) + 1 (ranger level>13) = 5
      expect(languagesAllowed).toBe(5);
    });

    it('does not add Ranger bonus at level 5 or below', () => {
      const stats = {
        ...baseStats,
        class: {
          name: 'Ranger',
          languages: [],
          language_choices: { choose: 0 },
        },
        level: 5,
        languages: [],
      };
      const [languagesAllowed] = rules.getLanguages(stats, {});
      // 1 (race) + 2 (background) = 3
      expect(languagesAllowed).toBe(3);
    });

    it('does not add Ranger bonus at level 13', () => {
      const stats = {
        ...baseStats,
        class: {
          name: 'Ranger',
          languages: [],
          language_choices: { choose: 0 },
        },
        level: 13,
        languages: [],
      };
      const [languagesAllowed] = rules.getLanguages(stats, {});
      // 1 (race) + 2 (background) + 1 (ranger level>5) = 4
      expect(languagesAllowed).toBe(4);
    });

    it('combines all language sources', () => {
      const stats = {
        rules: '5e',
        race: {
          languages: ['Common'],
          language_choices: { choose: 1 },
        },
        class: {
          name: 'Ranger',
          languages: ['Druidic'],
          language_choices: { choose: 0 },
        },
        languages: ['Giant'],
        level: 8,
      };
      const [languagesAllowed, languages] = rules.getLanguages(stats, {});
      // languages: Common, Druidic, Giant (sorted)
      expect(languages).toEqual(['Common', 'Druidic', 'Giant']);
      // 1 (race) + 2 (background) + 1 (race language_choices) + 1 (ranger level>5) = 5
      expect(languagesAllowed).toBe(5);
    });

    it('throws when class is undefined', () => {
      const stats = {
        ...baseStats,
        class: undefined,
        languages: [],
      };
      expect(() => rules.getLanguages(stats, {})).toThrow();
    });

    it('handles empty race languages', () => {
      const stats = {
        ...baseStats,
        race: { languages: [] },
        class: { languages: [] },
        languages: [],
      };
      const [, languages] = rules.getLanguages(stats, {});
      expect(languages).toEqual([]);
    });
  });

  describe('2024 ruleset', () => {
    it('uses class.major.language_choices instead of subclass', () => {
      const stats = {
        rules: '2024',
        race: { languages: ['Common'] },
        class: {
          languages: [],
          major: { language_choices: { choose: 3 } },
        },
        languages: [],
      };
      const [languagesAllowed, languages] = rules.getLanguages(stats, {});
      // languages: Common
      expect(languages).toEqual(['Common']);
      // 1 (race) + 2 (background) + 3 (major) = 6
      expect(languagesAllowed).toBe(6);
    });

    it('ignores class.subclass.language_choices in 2024 mode', () => {
      const stats = {
        rules: '2024',
        race: { languages: ['Common'] },
        class: {
          languages: [],
          subclass: { language_choices: { choose: 5 } },
        },
        languages: [],
      };
      const [languagesAllowed] = rules.getLanguages(stats, {});
      // 2024 should NOT count subclass language_choices
      // 1 (race) + 2 (background) = 3
      expect(languagesAllowed).toBe(3);
    });

    it('supports both major and subclass language_choices in 2024', () => {
      const stats = {
        rules: '2024',
        race: { languages: ['Common'] },
        class: {
          languages: [],
          major: { language_choices: { choose: 1 } },
          subclass: { language_choices: { choose: 2 } },
        },
        languages: [],
      };
      const [languagesAllowed] = rules.getLanguages(stats, {});
      // Only major counts in 2024
      // 1 (race) + 2 (background) + 1 (major) = 4
      expect(languagesAllowed).toBe(4);
    });

    it('handles missing major in 2024 mode', () => {
      const stats = {
        rules: '2024',
        race: { languages: ['Common'] },
        class: { languages: [] },
        languages: [],
      };
      const [, languages] = rules.getLanguages(stats, {});
      expect(languages).toEqual(['Common']);
    });
  });
});
