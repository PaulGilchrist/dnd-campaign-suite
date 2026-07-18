// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';

import rules from '../rules.js';

vi.mock('../ui/dataLoader.js', () => ({
  loadWildMagicSurgeTable: vi.fn(async () => []),
  loadSkills: vi.fn(),
  loadPassiveSkills: vi.fn(),
  loadFeatData: vi.fn().mockResolvedValue([]),
}));

describe('rules.getLanguages', () => {
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
