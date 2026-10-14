import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as dataLoader from '../ui/dataLoader.js';

vi.mock('../ui/dataLoader.js', () => ({
  fetchClassData: vi.fn(),
  fetchRaceData: vi.fn(),
  fetchBackgroundData: vi.fn(),
  fetchSubraceData: vi.fn(),
  loadFeatData: vi.fn(),
}));

import {
  getFightingStyleLimits,
  getLanguageLimits,
  validateLanguagesAndFightingStyles,
} from './languagesFightingstylesValidation.js';

describe('languagesFightingstylesValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFightingStyleLimits', () => {
    it('should return zero limits when no class name is provided', async () => {
      const result = await getFightingStyleLimits({ rules: '5e', level: 1 });
      expect(result).toEqual({ allowed: 0, preSelected: [], details: 'No class selected' });
    });

    it('should return zero limits when class name is empty string', async () => {
      const result = await getFightingStyleLimits({
        rules: '5e', class: {}, level: 1,
      });
      expect(result).toEqual({ allowed: 0, preSelected: [], details: 'No class selected' });
    });

    it('should return zero limits when class name is undefined', async () => {
      const result = await getFightingStyleLimits({
        rules: '5e', class: { name: undefined }, level: 1,
      });
      expect(result).toEqual({ allowed: 0, preSelected: [], details: 'No class selected' });
    });

    it('should return zero limits when class data fetch returns null', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
      const result = await getFightingStyleLimits({
        rules: '5e', class: { name: 'Unknown' }, level: 1,
      });
      expect(result).toEqual({ allowed: 0, preSelected: [], details: 'No class selected' });
    });

    it('should default level to 1 when level is undefined', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
        ],
      });
      const result = await getFightingStyleLimits({ rules: '5e', class: { name: 'Fighter' } });
      expect(result.allowed).toBe(1);
      expect(result.preSelected).toEqual([]);
    });

    it('should default level to 1 when level is 0', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
        ],
      });
      const result = await getFightingStyleLimits({
        rules: '5e', class: { name: 'Fighter' }, level: 0,
      });
      expect(result.allowed).toBe(1);
    });

    it('should return zero when class has no fighting style feature', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [{ level: 1, features: [{ name: 'Martial Training' }] }],
      });
      const result = await getFightingStyleLimits({
        rules: '5e', class: { name: 'Wizard' }, level: 1,
      });
      expect(result.allowed).toBe(0);
    });

    it('should return zero when class data has no class_levels', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ features: [{ name: 'Martial Training' }] });
      const result = await getFightingStyleLimits({
        rules: '5e', class: { name: 'Rogue' }, level: 1,
      });
      expect(result.allowed).toBe(0);
    });

    it('should return zero when class data is an empty object', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      const result = await getFightingStyleLimits({
        rules: '5e', class: { name: 'Wizard' }, level: 1,
      });
      expect(result.allowed).toBe(0);
    });

    it('should count fighting styles with explicit count from class_levels (5e)', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
        ],
      });
      const result = await getFightingStyleLimits({
        rules: '5e', class: { name: 'Fighter' }, level: 1,
      });
      expect(result.allowed).toBe(1);
    });

    it('should count fighting styles with explicit count from class_levels (2024)', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
        ],
      });
      const result = await getFightingStyleLimits({
        rules: '2024', class: { name: 'Fighter' }, level: 1,
      });
      expect(result.allowed).toBe(1);
    });

    it('should default count to 1 when feature_specific is missing (5e)', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [{ level: 1, features: [{ name: 'Fighting Style' }] }],
      });
      const result = await getFightingStyleLimits({
        rules: '5e', class: { name: 'Fighter' }, level: 1,
      });
      expect(result.allowed).toBe(1);
    });

    it('should default count to 1 when feature_specific is missing (2024)', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [{ level: 1, features: [{ name: 'Fighting Style' }] }],
      });
      const result = await getFightingStyleLimits({
        rules: '2024', class: { name: 'Fighter' }, level: 1,
      });
      expect(result.allowed).toBe(1);
    });

    it('should count Additional Fighting Style from 5e subclass class_levels', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
        ],
        subclasses: [
          {
            name: 'Battle Master',
            class_levels: [{ level: 7, features: [{ name: 'Additional Fighting Style' }] }],
          },
        ],
      });
      const result = await getFightingStyleLimits({
        rules: '5e', class: { name: 'Fighter', subclass: { name: 'Battle Master' } }, level: 7,
      });
      expect(result.allowed).toBe(2);
    });

    it('should count Additional Fighting Style from 5e subclass top-level features', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        subclasses: [
          { name: 'Champion', features: [{ name: 'Additional Fighting Style', level: 6 }] },
        ],
      });
      const result = await getFightingStyleLimits({
        rules: '5e', class: { name: 'Fighter', subclass: { name: 'Champion' } }, level: 6,
      });
      expect(result.allowed).toBe(1);
    });

    it('should count Additional Fighting Style from 2024 subclass/major features', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
        ],
        majors: [
          { name: 'Battle Master', features: [{ level: 7, name: 'Additional Fighting Style' }] },
        ],
      });
      const result = await getFightingStyleLimits({
        rules: '2024', class: { name: 'Fighter', subclass: { name: 'Battle Master' } }, level: 7,
      });
      expect(result.allowed).toBe(2);
    });

    it('should count duplicate Fighting Style features from 2024 class_levels at multiple levels', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
          { level: 9, features: [{ name: 'Additional Fighting Style' }] },
        ],
      });
      const result = await getFightingStyleLimits({
        rules: '2024', class: { name: 'Fighter' }, level: 9,
      });
      expect(result.allowed).toBe(3);
    });

    it('should count fighting styles from 2024 top-level class features', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        features: [
          { name: 'Fighting Style', level: 1, feature_specific: { fighting_style: { count: 1 } } },
          { name: 'Additional Fighting Style', level: 6 },
        ],
      });
      const result = await getFightingStyleLimits({
        rules: '2024', class: { name: 'Fighter' }, level: 6,
      });
      expect(result.allowed).toBe(2);
    });

    it('should pre-select fighting style feats in 2024', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
        ],
      });
      vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
        { name: 'War Caster', prerequisites: { feature: 'Fighting Style' } },
        { name: 'Tough', prerequisites: {} },
      ]);
      const result = await getFightingStyleLimits({
        rules: '2024', class: { name: 'Fighter' }, level: 1, feats: ['War Caster'],
      });
      expect(result.allowed).toBe(1);
      expect(result.preSelected).toContain('War Caster');
      expect(result.preSelected).not.toContain('Tough');
    });

    it('should handle empty or undefined feats without error', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
        ],
      });
      const resultWithEmpty = await getFightingStyleLimits({
        rules: '2024', class: { name: 'Fighter' }, level: 1, feats: [],
      });
      expect(resultWithEmpty).toEqual({ allowed: 1, preSelected: [], details: expect.any(String) });

      const resultUndefined = await getFightingStyleLimits({
        rules: '2024', class: { name: 'Fighter' }, level: 1,
      });
      expect(resultUndefined).toEqual({ allowed: 1, preSelected: [], details: expect.any(String) });
    });

    it('should not count Additional Fighting Style when below level threshold (5e)', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
        ],
        subclasses: [
          { name: 'Champion', features: [{ name: 'Additional Fighting Style', level: 10 }] },
        ],
      });
      const result = await getFightingStyleLimits({
        rules: '5e', class: { name: 'Fighter', subclass: { name: 'Champion' } }, level: 5,
      });
      expect(result.allowed).toBe(1);
    });

    it('should not count Additional Fighting Style when below level threshold (2024)', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
        ],
        majors: [
          { name: 'Battle Master', features: [{ level: 10, name: 'Additional Fighting Style' }] },
        ],
      });
      const result = await getFightingStyleLimits({
        rules: '2024', class: { name: 'Fighter', subclass: { name: 'Battle Master' } }, level: 5,
      });
      expect(result.allowed).toBe(1);
    });
  });

  describe('getLanguageLimits', () => {
    it('should return default 2 background languages when no race data', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);

      const result5e = await getLanguageLimits({
        rules: '5e', race: { name: 'Unknown' }, class: { name: 'Unknown' },
      });
      expect(result5e.allowed).toBe(2);
      expect(result5e.preSelected).toEqual([]);

      const result2024 = await getLanguageLimits({
        rules: '2024', race: { name: 'Unknown' }, class: { name: 'Unknown' },
      });
      expect(result2024.allowed).toBe(2);
    });

    it('should add race languages to preSelected and allowed (5e)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common', 'Elvish'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      const result = await getLanguageLimits({
        rules: '5e', race: { name: 'Elf' }, class: { name: 'Wizard' },
      });
      expect(result.allowed).toBe(4);
      expect(result.preSelected).toContain('Common');
      expect(result.preSelected).toContain('Elvish');
    });

    it('should add race and class languages (2024)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common', 'Elvish'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ languages: ['Dwarvish'] });
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({ languages: ['Gnomish'] });
      const result = await getLanguageLimits({
        rules: '2024', race: { name: 'Elf' }, class: { name: 'Wizard' }, background: 'Sage',
      });
      expect(result.allowed).toBe(4);
      expect(result.preSelected).toContain('Common');
      expect(result.preSelected).toContain('Elvish');
      expect(result.preSelected).toContain('Dwarvish');
      expect(result.preSelected).toContain('Gnomish');
    });

    it('should add default 2 background languages for 2024 when background is null', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
      const result = await getLanguageLimits({
        rules: '2024', race: { name: 'Human' }, class: { name: 'Wizard' },
      });
      expect(result.allowed).toBe(3);
    });

    it('should add language_options choose count from race (5e)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'], language_options: { choose: 1 } });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      const result = await getLanguageLimits({
        rules: '5e', race: { name: 'Elf' }, class: { name: 'Wizard' },
      });
      expect(result.allowed).toBe(4);
    });

    it('should add subrace languages to preSelected (5e)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
      vi.mocked(dataLoader.fetchSubraceData).mockResolvedValue({ languages: ['Sylvan'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      const result = await getLanguageLimits({
        rules: '5e', race: { name: 'Elf', subrace: { name: 'High Elf' } }, class: { name: 'Wizard' },
      });
      expect(result.allowed).toBe(3);
      expect(result.preSelected).toContain('Sylvan');
    });

    it('should parse language count from feature description with digit (5e)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 3, features: [{ name: 'Extra Language', description: 'You gain 2 languages of your choice' }] },
        ],
      });
      const result = await getLanguageLimits({
        rules: '5e', race: { name: 'Human' }, class: { name: 'Rogue' }, level: 3,
      });
      expect(result.allowed).toBe(4);
    });

    it('should parse language count from feature description with spelled-out number (5e)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 3, features: [{ name: 'Language Feature', description: 'You learn 1 language' }] },
        ],
      });
      const result = await getLanguageLimits({
        rules: '5e', race: { name: 'Human' }, class: { name: 'Rogue' }, level: 3,
      });
      expect(result.allowed).toBe(3);
    });

    it('should not parse language count from feature without description property', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [{ level: 3, features: [{ name: 'Extra Language', desc: ['You gain 1 language'] }] }],
      });
      const result = await getLanguageLimits({
        rules: '5e', race: { name: 'Human' }, class: { name: 'Rogue' }, level: 3,
      });
      expect(result.allowed).toBe(2);
    });

    it('should deduplicate preSelected languages', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ languages: ['Common'] });
      const result = await getLanguageLimits({
        rules: '5e', race: { name: 'Human' }, class: { name: 'Wizard' },
      });
      expect(result.preSelected).toEqual(['Common']);
      expect(result.allowed).toBe(4);
    });

    it('should handle null class data while keeping race languages (5e)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
      const result = await getLanguageLimits({
        rules: '5e', race: { name: 'Human' }, class: { name: 'Unknown' },
      });
      expect(result.allowed).toBe(3);
      expect(result.preSelected).toEqual(['Common']);
    });

    it('should handle null class data while keeping race languages (2024)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
      const result = await getLanguageLimits({
        rules: '2024', race: { name: 'Human' }, class: { name: 'Unknown' },
      });
      expect(result.allowed).toBe(3);
      expect(result.preSelected).toEqual(['Common']);
    });

    it('should not include subrace languages in 2024', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
      vi.mocked(dataLoader.fetchSubraceData).mockResolvedValue({ languages: ['Sylvan'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
      const result = await getLanguageLimits({
        rules: '2024', race: { name: 'Elf', subrace: { name: 'High Elf' } }, class: { name: 'Wizard' },
      });
      expect(result.preSelected).not.toContain('Sylvan');
    });

    it('should handle undefined subrace without error (5e)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      const result = await getLanguageLimits({
        rules: '5e', race: { name: 'Elf' }, class: { name: 'Wizard' },
      });
      expect(result.allowed).toBe(3);
    });

    it('should handle empty background languages array (2024)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({ languages: [] });
      const result = await getLanguageLimits({
        rules: '2024', race: { name: 'Human' }, class: { name: 'Wizard' }, background: 'Acolyte',
      });
      expect(result.allowed).toBe(0);
    });

    it('should parse language count from Ranger Deft Explorer feature description (2024)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [] },
          {
            level: 2,
            features: [
              {
                name: 'Deft Explorer',
                description: 'Expertise. Choose one of your skill proficiencies with which you lack Expertise. You gain Expertise in that skill. Languages. You know two languages of your choice from the language tables.',
              },
            ],
          },
        ],
      });
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
      const result = await getLanguageLimits({
        rules: '2024', race: { name: 'Human' }, class: { name: 'Ranger' }, level: 2,
      });
      expect(result.allowed).toBe(4);
    });

    it('should combine race languages + class feature languages for 2024 Ranger (Mountain Dwarf scenario)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common', 'Dwarvish'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        languages: [],
        class_levels: [
          { level: 1, features: [] },
          {
            level: 2,
            features: [
              {
                name: 'Deft Explorer',
                description: 'Expertise. Choose one of your skill proficiencies with which you lack Expertise. You gain Expertise in that skill. Languages. You know two languages of your choice from the language tables.',
              },
            ],
          },
        ],
      });
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
      const result = await getLanguageLimits({
        rules: '2024', race: { name: 'Dwarf' }, class: { name: 'Ranger' }, background: 'Guide', level: 2,
      });
      expect(result.allowed).toBe(6);
      expect(result.preSelected).toContain('Common');
      expect(result.preSelected).toContain('Dwarvish');
    });
  });

  describe('validateLanguagesAndFightingStyles', () => {
    it('should return no warnings when selections are within limits', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      const warnings = await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Human' }, class: { name: 'Wizard' }, languages: ['Common'],
      });
      expect(warnings).toEqual([]);
    });

    it('should warn when too many languages are selected', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      const warnings = await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Human' }, class: { name: 'Wizard' },
        languages: ['Common', 'Elvish', 'Dwarvish', 'Gnomish'],
      });
      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe('warning');
      expect(warnings[0].message).toContain('language');
      expect(warnings[0].message).toContain('Rules allow');
    });

    it('should warn when too many fighting styles are selected', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
        ],
      });
      const warnings = await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Human' }, class: { name: 'Fighter', fightingStyles: ['Defense', 'Dueling'] }, level: 1,
      });
      const styleWarnings = warnings.filter((w) => w.message.includes('fighting style'));
      expect(styleWarnings).toHaveLength(1);
      expect(styleWarnings[0].type).toBe('warning');
      expect(styleWarnings[0].message).toContain('Rules allow');
    });

    it('should warn when pre-selected languages are not chosen', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common', 'Elvish'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      const warnings = await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Elf' }, class: { name: 'Wizard' }, languages: [],
      });
      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe('info');
      expect(warnings[0].message).toContain('grant you these languages');
    });

    it('should not warn when pre-selected languages are all chosen', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common', 'Elvish'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      const warnings = await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Elf' }, class: { name: 'Wizard' }, languages: ['Common', 'Elvish'],
      });
      expect(warnings).toEqual([]);
    });

    it('should warn when fighting style is available but not selected', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
        ],
      });
      const warnings = await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Human' }, class: { name: 'Fighter', fightingStyles: [] }, level: 1,
      });
      const styleWarnings = warnings.filter((w) => w.message.includes('fighting style'));
      expect(styleWarnings).toHaveLength(1);
      expect(styleWarnings[0].type).toBe('info');
      expect(styleWarnings[0].message).toContain('Consider selecting');
    });

    it('should not warn when fighting style is selected', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
        ],
      });
      const warnings = await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Human' }, class: { name: 'Fighter', fightingStyles: ['Defense'] }, level: 1,
      });
      expect(warnings).toEqual([]);
    });

    it('should not warn when fighting style is not available and none selected', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [{ level: 1, features: [{ name: 'Martial Training' }] }],
      });
      const warnings = await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Wizard' }, class: { name: 'Wizard', fightingStyles: [] }, level: 1,
      });
      expect(warnings).toEqual([]);
    });

    it('should warn about missing pre-selected fighting style feats in 2024', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
        ],
      });
      vi.mocked(dataLoader.loadFeatData).mockResolvedValue([
        { name: 'War Caster', prerequisites: { feature: 'Fighting Style' } },
      ]);
      const warnings = await validateLanguagesAndFightingStyles({
        rules: '2024', race: { name: 'Human' }, class: { name: 'Fighter', fightingStyles: [] }, level: 1, feats: ['War Caster'],
      });
      const featWarnings = warnings.filter((w) => w.message.includes('fighting style feats'));
      expect(featWarnings).toHaveLength(1);
      expect(featWarnings[0].type).toBe('info');
      expect(featWarnings[0].message).toContain('War Caster');

      const noWarnings = await validateLanguagesAndFightingStyles({
        rules: '2024', race: { name: 'Human' }, class: { name: 'Fighter', fightingStyles: ['War Caster'] }, level: 1, feats: ['War Caster'],
      });
      expect(noWarnings).toEqual([]);
    });

    it('should warn when languages is undefined and preSelected exists', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      const warnings = await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Human' }, class: { name: 'Wizard' },
      });
      expect(warnings).toHaveLength(1);
      expect(warnings[0].type).toBe('info');
    });

    it('should warn when fightingStyles is undefined and class allows styles', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 1, features: [{ name: 'Fighting Style', feature_specific: { fighting_style: { count: 1 } } }] },
        ],
      });
      const warnings = await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Human' }, class: { name: 'Fighter' }, level: 1,
      });
      const styleWarnings = warnings.filter((w) => w.message.includes('fighting style'));
      expect(styleWarnings).toHaveLength(1);
      expect(styleWarnings[0].type).toBe('info');
      expect(styleWarnings[0].message).toContain('Consider selecting');
    });

    it('should suppress errors without throwing', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockRejectedValue(new Error('network error'));
      const warnings = await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Human' }, class: { name: 'Wizard' }, languages: ['Common'],
      });
      expect(Array.isArray(warnings)).toBe(true);
      expect(warnings).toEqual([]);
    });
  });
});
