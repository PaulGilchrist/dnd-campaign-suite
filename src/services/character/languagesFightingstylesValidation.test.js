// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Fixtures mirror disk rows from public/data/classes.json, races.json,
// 2024/classes.json, 2024/feats.json, 2024/backgrounds.json (verified 2026-10-16):
// - Fighting Style features carry NO feature-level feature_specific.fighting_style.count
//   on disk, so the count always flows through the `|| 1` default.
// - Additional Fighting Style lives in 5e Champion class_levels@10 and
//   2024 Fighter majors Champion@7 — never on Battle Master, never at the
//   subclass/class top level.
// - 5e: Paladin gains Fighting Style at level 2; Human has languages
//   ['Common'] + language_options.choose 1; Elf ['Common','Elvish'];
//   Druid class languages ['Druidic']; fetchSubraceData('High Elf','5e')
//   resolves null (no top-level subrace entries on disk).
// - 2024: background rows have NO languages key (backgrounds grant no
//   languages); Ranger is top-level languages [] with Deft Explorer@2
//   granting "two languages" spelled out; Defense has prerequisites
//   { feature: 'Fighting Style' }, Tough has none.

const FIGHTER_5E = {
  name: 'Fighter',
  class_levels: [{ level: 1, features: [{ name: 'Fighting Style', level: 1 }] }],
};
const CHAMPION_SUB_5E = {
  name: 'Champion',
  class_levels: [{ level: 10, features: [{ name: 'Additional Fighting Style' }] }],
};
const FIGHTER_2024 = {
  name: 'Fighter',
  class_levels: [{ level: 1, features: [{ name: 'Fighting Style', level: 1 }] }],
  majors: [{ name: 'Champion', features: [{ level: 7, name: 'Additional Fighting Style' }] }],
};
const HUMAN_5E = { name: 'Human', languages: ['Common'], language_options: { choose: 1 } };
const ELF_5E = { name: 'Elf', languages: ['Common', 'Elvish'] };
const HUMAN_2024 = { name: 'Human', languages: ['Common'] };
const DWARF_2024 = { name: 'Dwarf', languages: ['Common', 'Dwarvish'] };
const DRUID_LANGS = { name: 'Druid', languages: ['Druidic'] };
const DEFENSE_FEAT_2024 = { name: 'Defense', prerequisites: { feature: 'Fighting Style' } };
const TOUGH_FEAT_2024 = { name: 'Tough', prerequisites: null };
const ACOLYTE_2024 = { name: 'Acolyte' }; // disk row — no languages key
const DEFST_EXPLORER_DESC = 'Expertise. Choose one of your skill proficiencies with which you lack Expertise. You gain Expertise in that skill. Languages. You know two languages of your choice from the language tables.';
const LANG_5E_DETAILS = 'In 5e rules, languages come from your race, class, and background (2 additional from backstory).';

describe('languagesFightingstylesValidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getFightingStyleLimits', () => {
    it('returns "No class selected" without fetching when class is unresolved', async () => {
      const expected = { allowed: 0, preSelected: [], details: 'No class selected' };
      expect(await getFightingStyleLimits({ rules: '5e', level: 1 })).toEqual(expected);
      expect(await getFightingStyleLimits({ rules: '5e', class: { name: undefined }, level: 1 })).toEqual(expected);
      expect(dataLoader.fetchClassData).not.toHaveBeenCalled();

      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
      expect(await getFightingStyleLimits({ rules: '5e', class: { name: 'Unknown' }, level: 1 })).toEqual(expected);
    });

    it('counts Fighter level-1 Fighting Style once (default count, level defaults to 1)', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(FIGHTER_5E);
      const noLevel = await getFightingStyleLimits({ rules: '5e', class: { name: 'Fighter' } });
      const zeroLevel = await getFightingStyleLimits({ rules: '5e', class: { name: 'Fighter' }, level: 0 });
      expect(noLevel.allowed).toBe(1);
      expect(zeroLevel.allowed).toBe(1);
      expect(noLevel.preSelected).toEqual([]);
      expect(noLevel.details).toContain('Fighter');
    });

    it('gates class-level styles by level — Paladin gains Fighting Style at 2', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        name: 'Paladin',
        class_levels: [{ level: 2, features: [{ name: 'Fighting Style', level: 2 }] }],
      });
      expect((await getFightingStyleLimits({ rules: '5e', class: { name: 'Paladin' }, level: 1 })).allowed).toBe(0);
      expect((await getFightingStyleLimits({ rules: '5e', class: { name: 'Paladin' }, level: 2 })).allowed).toBe(1);
    });

    it('returns zero for classes without fighting style features', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      expect((await getFightingStyleLimits({ rules: '5e', class: { name: 'Wizard' }, level: 1 })).allowed).toBe(0);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [{ level: 1, features: [{ name: 'Martial Training' }] }],
      });
      expect((await getFightingStyleLimits({ rules: '5e', class: { name: 'Rogue' }, level: 1 })).allowed).toBe(0);
    });

    it('counts 5e Champion Additional Fighting Style from subclass class_levels at 10', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        ...FIGHTER_5E,
        subclasses: [CHAMPION_SUB_5E],
      });
      const at9 = await getFightingStyleLimits({
        rules: '5e', class: { name: 'Fighter', subclass: { name: 'Champion' } }, level: 9,
      });
      const at10 = await getFightingStyleLimits({
        rules: '5e', class: { name: 'Fighter', subclass: { name: 'Champion' } }, level: 10,
      });
      expect(at9.allowed).toBe(1);
      expect(at10.allowed).toBe(2);
    });

    it('counts 2024 Champion Additional Fighting Style from majors at 7', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(FIGHTER_2024);
      const at6 = await getFightingStyleLimits({
        rules: '2024', class: { name: 'Fighter', subclass: { name: 'Champion' } }, level: 6,
      });
      const at7 = await getFightingStyleLimits({
        rules: '2024', class: { name: 'Fighter', subclass: { name: 'Champion' } }, level: 7,
      });
      expect(at6.allowed).toBe(1);
      expect(at7.allowed).toBe(2);
    });

    it('pre-selects 2024 fighting style feats (Defense) and excludes unrelated feats', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(FIGHTER_2024);
      vi.mocked(dataLoader.loadFeatData).mockResolvedValue([DEFENSE_FEAT_2024, TOUGH_FEAT_2024]);
      const result = await getFightingStyleLimits({
        rules: '2024', class: { name: 'Fighter' }, level: 1, feats: ['Defense', 'Tough'],
      });
      expect(result).toEqual({
        allowed: 1,
        preSelected: ['Defense'],
        details: 'In 2024 rules, Fighter characters may get fighting styles from class features or feats.',
      });
    });

    it('skips feat loading entirely when no feats are selected', async () => {
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(FIGHTER_2024);
      expect((await getFightingStyleLimits({ rules: '2024', class: { name: 'Fighter' }, level: 1, feats: [] })).preSelected).toEqual([]);
      expect((await getFightingStyleLimits({ rules: '2024', class: { name: 'Fighter' }, level: 1 })).preSelected).toEqual([]);
      expect(dataLoader.loadFeatData).not.toHaveBeenCalled();
    });
  });

  describe('getLanguageLimits', () => {
    it('falls back to 2 backstory languages for unknown race and class (both rulesets)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);

      const result5e = await getLanguageLimits({ rules: '5e', race: { name: 'Unknown' }, class: { name: 'Unknown' } });
      expect(result5e.allowed).toBe(2); // rules-validation.json background_languages: 2
      expect(result5e.preSelected).toEqual([]);
      expect((await getLanguageLimits({ rules: '2024', race: { name: 'Unknown' }, class: { name: 'Unknown' } })).allowed).toBe(2);
    });

    it('counts 5e Elf race languages plus 2 backstory languages', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(ELF_5E);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      const result = await getLanguageLimits({ rules: '5e', race: { name: 'Elf' }, class: { name: 'Wizard' } });
      expect(result.allowed).toBe(4);
      expect(result.preSelected).toEqual(['Common', 'Elvish']);
      expect(result.details).toBe(LANG_5E_DETAILS);
    });

    it('adds 5e Human racial language choice (language_options.choose)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(HUMAN_5E);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      const result = await getLanguageLimits({ rules: '5e', race: { name: 'Human' }, class: { name: 'Wizard' } });
      expect(result.allowed).toBe(4); // 1 race + 1 chosen + 2 backstory
      expect(result.preSelected).toEqual(['Common']);
    });

    it('adds 5e class languages (Druidic) and deduplicates preSelected', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(HUMAN_5E);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(DRUID_LANGS);
      const druid = await getLanguageLimits({ rules: '5e', race: { name: 'Human' }, class: { name: 'Druid' } });
      expect(druid.allowed).toBe(5); // 1 race + 1 choice + 1 Druidic + 2 backstory
      expect(druid.preSelected).toEqual(['Common', 'Druidic']);

      // synthetic: no disk row overlaps race+class languages — pins the dedupe pass
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({ languages: ['Common'] });
      const dup = await getLanguageLimits({ rules: '5e', race: { name: 'Human' }, class: { name: 'Wizard' } });
      expect(dup.preSelected).toEqual(['Common']);
    });

    it('adds nothing for 5e subrace (High Elf resolves null — no top-level subrace rows on disk)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(ELF_5E);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchSubraceData).mockResolvedValue(null);
      const result = await getLanguageLimits({
        rules: '5e', race: { name: 'Elf', subrace: { name: 'High Elf' } }, class: { name: 'Wizard' },
      });
      expect(dataLoader.fetchSubraceData).toHaveBeenCalledWith('High Elf', '5e');
      expect(result.allowed).toBe(4);
      expect(result.preSelected).toEqual(['Common', 'Elvish']);
    });

    it('keeps race languages when class fetch returns null (both rulesets)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({ languages: ['Common'] });
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(null);
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
      const result5e = await getLanguageLimits({ rules: '5e', race: { name: 'Human' }, class: { name: 'Unknown' } });
      expect(result5e.allowed).toBe(3);
      expect(result5e.preSelected).toEqual(['Common']);
      const result2024 = await getLanguageLimits({ rules: '2024', race: { name: 'Human' }, class: { name: 'Unknown' } });
      expect(result2024.allowed).toBe(3);
      expect(result2024.preSelected).toEqual(['Common']);
    });

    it('parses digit language counts from 5e class feature descriptions (synthetic — no 5e disk row hits this lane)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [
          { level: 3, features: [{ name: 'Extra Language', description: 'You gain 2 languages of your choice' }] },
        ],
      });
      const withDesc = await getLanguageLimits({ rules: '5e', race: { name: 'Human' }, class: { name: 'Rogue' }, level: 3 });
      expect(withDesc.allowed).toBe(4); // 2 parsed + 2 backstory

      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        class_levels: [{ level: 3, features: [{ name: 'Extra Language', desc: ['You gain 1 language'] }] }],
      });
      const noDesc = await getLanguageLimits({ rules: '5e', race: { name: 'Human' }, class: { name: 'Rogue' }, level: 3 });
      expect(noDesc.allowed).toBe(2);
    });

    it('applies 2024 background semantics: null grants default 2, disk rows grant none', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(HUMAN_2024);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
      const noBg = await getLanguageLimits({ rules: '2024', race: { name: 'Human' }, class: { name: 'Wizard' } });
      expect(noBg.allowed).toBe(3); // 1 race + 2 default
      expect(dataLoader.fetchSubraceData).not.toHaveBeenCalled(); // 2024 never consults subraces

      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(ACOLYTE_2024);
      const withBg = await getLanguageLimits({ rules: '2024', race: { name: 'Human' }, class: { name: 'Wizard' }, background: 'Acolyte' });
      expect(withBg.allowed).toBe(1); // 2024 background rows on disk carry no languages
      expect(withBg.preSelected).toEqual(['Common']);

      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(DRUID_LANGS);
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue(null);
      const druid = await getLanguageLimits({ rules: '2024', race: { name: 'Human' }, class: { name: 'Druid' } });
      expect(druid.allowed).toBe(4);
      expect(druid.preSelected).toEqual(['Common', 'Druidic']);
    });

    it('counts 2024 Ranger Deft Explorer spelled-out languages (disk text)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(DWARF_2024);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({
        name: 'Ranger',
        languages: [],
        class_levels: [
          { level: 1, features: [] },
          { level: 2, features: [{ name: 'Deft Explorer', description: DEFST_EXPLORER_DESC }] },
        ],
      });
      vi.mocked(dataLoader.fetchBackgroundData).mockResolvedValue({ name: 'Guide' });
      const result = await getLanguageLimits({
        rules: '2024', race: { name: 'Dwarf' }, class: { name: 'Ranger' }, background: 'Guide', level: 2,
      });
      expect(result.allowed).toBe(4); // 2 race + 0 background + 2 Deft Explorer
      expect(result.preSelected).toEqual(['Common', 'Dwarvish']);
    });
  });

  describe('validateLanguagesAndFightingStyles', () => {
    it('returns no warnings when all granted languages and styles are selected', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(ELF_5E);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      const warnings = await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Elf' }, class: { name: 'Wizard' }, languages: ['Common', 'Elvish'],
      });
      expect(warnings).toEqual([]);
    });

    it('warns with full message when too many languages are selected', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(HUMAN_5E);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      const warnings = await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Human' }, class: { name: 'Wizard' },
        languages: ['Common', 'Elvish', 'Dwarvish', 'Gnomish', 'Orc'],
      });
      expect(warnings).toEqual([{
        message: `Rules allow 4 language(s). You have selected 5. (${LANG_5E_DETAILS})`,
        type: 'warning',
      }]);
    });

    it('info-warns listing unchosen pre-selected languages for empty or undefined selection', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(ELF_5E);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      const expected = [{
        message: 'Your race, class, and background grant you these languages: Common, Elvish. Consider selecting them.',
        type: 'info',
      }];
      expect(await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Elf' }, class: { name: 'Wizard' }, languages: [],
      })).toEqual(expected);
      expect(await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Elf' }, class: { name: 'Wizard' },
      })).toEqual(expected);
    });

    it('warns with full message when too many fighting styles are selected', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(HUMAN_5E);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(FIGHTER_5E);
      const warnings = await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Human' },
        class: { name: 'Fighter', fightingStyles: ['Defense', 'Dueling'] },
        level: 1, languages: ['Common'],
      });
      expect(warnings).toEqual([{
        message: 'Rules allow 1 fighting style(s). You have selected 2. (Fighter may get fighting styles from class features. may grant additional styles at higher levels.)',
        type: 'warning',
      }]);
    });

    it('info-warns when a style slot is available but unselected (empty or undefined)', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(HUMAN_5E);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(FIGHTER_5E);
      const expected = [{
        message: 'Your class allows 1 fighting style(s). Consider selecting one.',
        type: 'info',
      }];
      expect(await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Human' },
        class: { name: 'Fighter', fightingStyles: [] }, level: 1, languages: ['Common'],
      })).toEqual(expected);
      expect(await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Human' },
        class: { name: 'Fighter' }, level: 1, languages: ['Common'],
      })).toEqual(expected);
    });

    it('stays silent when a style is selected or the class grants none', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(HUMAN_5E);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(FIGHTER_5E);
      expect(await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Human' },
        class: { name: 'Fighter', fightingStyles: ['Defense'] }, level: 1, languages: ['Common'],
      })).toEqual([]);

      vi.mocked(dataLoader.fetchClassData).mockResolvedValue({});
      expect(await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Human' },
        class: { name: 'Wizard', fightingStyles: [] }, level: 1, languages: ['Common'],
      })).toEqual([]);
    });

    it('2024: info-warns about unchosen fighting style feats, silent once selected', async () => {
      vi.mocked(dataLoader.fetchRaceData).mockResolvedValue(HUMAN_2024);
      vi.mocked(dataLoader.fetchClassData).mockResolvedValue(FIGHTER_2024);
      vi.mocked(dataLoader.loadFeatData).mockResolvedValue([DEFENSE_FEAT_2024]);

      const warnings = await validateLanguagesAndFightingStyles({
        rules: '2024', race: { name: 'Human' },
        class: { name: 'Fighter', fightingStyles: [] }, level: 1,
        languages: ['Common'], feats: ['Defense'],
      });
      expect(warnings).toEqual([
        { message: 'Your class allows 1 fighting style(s). Consider selecting one.', type: 'info' },
        { message: 'You have selected fighting style feats: Defense. These should be pre-selected.', type: 'info' },
      ]);

      const selected = await validateLanguagesAndFightingStyles({
        rules: '2024', race: { name: 'Human' },
        class: { name: 'Fighter', fightingStyles: ['Defense'] }, level: 1,
        languages: ['Common'], feats: ['Defense'],
      });
      expect(selected).toEqual([]);
    });

    it('logs and returns empty warnings when a data fetch rejects', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(dataLoader.fetchRaceData).mockRejectedValue(new Error('network error'));
      const warnings = await validateLanguagesAndFightingStyles({
        rules: '5e', race: { name: 'Human' }, class: { name: 'Wizard' }, languages: ['Common'],
      });
      expect(warnings).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error validating languages and fighting styles:',
        expect.any(Error),
      );
    });
  });
});
