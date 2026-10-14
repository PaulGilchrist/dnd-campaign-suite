// @improved-by-ai
// Unit tests for the character-creation validation utils (src/config/utils.js).
//
// Seam policy:
// - dataLoader.loadValidationRules / getCachedPointBuyCosts are mocked: they are
//   thin JSON-fetch/cache wrappers. These tests pin the rules → verdict contract,
//   including the documented fallbacks when the loaded rules are partial.
// - raceBuffService.computeRaceBuffs is mocked to pin HOW validateAbilityTotals
//   consumes racial increases (race+subrace accumulation, ruleset gating). Its own
//   computation lives in the raceBuffService suite.
// - Duplicate-name gating is covered by utils.duplicate-name.test.js and the step-10
//   skill cap by utils.skill-cap.test.js — deliberately NOT re-tested here.
//
// User-facing error messages are pinned as literals (never imported or derived), so
// accidental rewording breaks these tests on purpose.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../services/character/raceBuffService.js', () => ({
  computeRaceBuffs: vi.fn(() => ({ abilityScoreIncreases: [] })),
}));

import * as dataLoader from '../services/ui/dataLoader.js';
import * as utils from './utils.js';
import { computeRaceBuffs } from '../services/character/raceBuffService.js';

// Pinned literal fallback (mirrors utils.js DEFAULT_POINT_BUY_COSTS but is written
// out independently so a change to the constant without a rules update breaks tests).
const DEFAULT_POINT_BUY_COSTS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

// Costs served inside MOCK_VALIDATION_RULES below deliberately DIFFER from the
// defaults (extra 16 tier) so "returns what the rules said" is distinguishable
// from "returned the fallback" — a pass-through that silently never happened.
const POINT_BUY_COSTS_FROM_RULES = { ...DEFAULT_POINT_BUY_COSTS, 16: 11 };

// Only the fields utils.js actually reads from rules-validation.json.
const MOCK_VALIDATION_RULES = {
  level_range: { min: 1, max: 20 },
  point_buy: {
    min_base_score: 8,
    max_base_score: 15,
    max_total_score: 20,
    costs: POINT_BUY_COSTS_FROM_RULES,
  },
  ability_score_max: { level_20: 24 },
};

// Canonical error messages (pinned literals).
const MIN_BASE_ERROR = 'Base score must be at least 8';
const MAX_BASE_ERROR = 'Base score cannot exceed 15 (point buy max)';
const TOTAL_20_ERROR = 'Total score (base + improvements + misc) cannot exceed 20';
const MISC_ERROR = 'Misc bonus must be 0 or above';
const LEVEL_1_20_ERROR = 'Level must be between 1 and 20';
const NAME_REQUIRED_STEP = 'Character name is required';

const ability = (overrides = {}) => ({
  baseScore: 10,
  featIncrease: 0,
  backgroundIncrease: 0,
  miscIncrease: 0,
  ...overrides,
});

const stepContext = (overrides = {}) => ({
  racesData: [],
  classSubtypes: [],
  ruleset: '5e',
  ...overrides,
});

describe('character-creation/utils', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPointBuyCosts', () => {
    it('resolves the costs carried by the loaded rules for the requested ruleset', async () => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(MOCK_VALIDATION_RULES);
      const costs = await utils.getPointBuyCosts('2024');
      expect(dataLoader.loadValidationRules).toHaveBeenCalledWith('2024');
      // Distinct from DEFAULT_POINT_BUY_COSTS (has the extra 16 tier), so this
      // fails if the loader result is ignored in favor of the fallback.
      expect(costs).toEqual(POINT_BUY_COSTS_FROM_RULES);
    });

    it('falls back to the standard costs when rules are empty or lack point_buy.costs', async () => {
      for (const rules of [{}, { point_buy: {} }, { point_buy: { costs: null } }]) {
        vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(rules);
        await expect(utils.getPointBuyCosts('5e')).resolves.toEqual(DEFAULT_POINT_BUY_COSTS);
        vi.restoreAllMocks();
      }
    });
  });

  describe('getPointBuyCostsSync', () => {
    it('returns the cached costs verbatim, querying the requested ruleset', () => {
      const cached = vi.spyOn(dataLoader, 'getCachedPointBuyCosts').mockReturnValue({ 8: 0, 9: 2, 10: 4 });
      expect(utils.getPointBuyCostsSync('2024')).toEqual({ 8: 0, 9: 2, 10: 4 });
      expect(cached).toHaveBeenCalledWith('2024');
    });

    it('falls back to the standard costs while the cache is unpopulated (null or undefined)', () => {
      vi.spyOn(dataLoader, 'getCachedPointBuyCosts').mockReturnValue(null);
      expect(utils.getPointBuyCostsSync('5e')).toEqual(DEFAULT_POINT_BUY_COSTS);

      dataLoader.getCachedPointBuyCosts.mockReturnValue(undefined);
      expect(utils.getPointBuyCostsSync('5e')).toEqual(DEFAULT_POINT_BUY_COSTS);
    });
  });

  describe('validateFinalFormData', () => {
    const COMPLETE_FORM_DATA = {
      name: 'Test Character',
      level: 1,
      alignment: 'Lawful Good',
      race: { name: 'Human' },
      class: { name: 'Wizard' },
      expertSkills: [],
    };

    it('accepts a complete form with no existing-name collisions', () => {
      expect(utils.validateFinalFormData(COMPLETE_FORM_DATA)).toEqual({});
    });

    it('reports exactly the required name/level/alignment/race/class/expertSkills fields when the form is empty', () => {
      // Contract pinned as a literal set: REQUIRED_FIELDS minus the three
      // explicitly-skipped fields. Pinning it here (rather than re-deriving the
      // exclusion list from REQUIRED_FIELDS) means a shared drift between the
      // implementation and this test can no longer hide a silently-dropped field.
      expect(utils.validateFinalFormData({})).toEqual({
        name: 'name is required',
        level: 'level is required',
        alignment: 'alignment is required',
        race: 'race is required',
        class: 'class is required',
        expertSkills: 'expertSkills is required',
      });
    });

    it('never flags the deliberately-skipped fields abilities, inventory or skillProficiencies', () => {
      const form = { ...COMPLETE_FORM_DATA, abilities: undefined, inventory: undefined, skillProficiencies: undefined };
      expect(utils.validateFinalFormData(form)).toEqual({});
    });

    it('rejects a missing or whitespace-only name as required', () => {
      for (const name of [undefined, null, '', '   ']) {
        expect(utils.validateFinalFormData({ ...COMPLETE_FORM_DATA, name })).toEqual({ name: 'name is required' });
      }
    });

    it('accepts a null or undefined form (nothing to validate yet)', () => {
      expect(utils.validateFinalFormData(null)).toEqual({});
      expect(utils.validateFinalFormData(undefined)).toEqual({});
    });
  });

  describe('validateLevel', () => {
    beforeEach(() => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(MOCK_VALIDATION_RULES);
    });

    it('accepts levels inside the range, including numeric strings from text inputs', async () => {
      for (const level of [1, 10, 20, '1', '10', '20']) {
        await expect(utils.validateLevel(level, '5e')).resolves.toEqual({});
      }
    });

    it('rejects missing, zero, and out-of-range levels with the range message', async () => {
      for (const level of [null, undefined, '', NaN, false, 0, -1, 21, '0', '25']) {
        await expect(utils.validateLevel(level, '5e')).resolves.toEqual({ level: LEVEL_1_20_ERROR });
      }
    });

    it('respects a custom min/max from the validation rules', async () => {
      dataLoader.loadValidationRules.mockResolvedValue({ level_range: { min: 1, max: 10 } });
      await expect(utils.validateLevel(1, '5e')).resolves.toEqual({});
      await expect(utils.validateLevel(10, '5e')).resolves.toEqual({});
      await expect(utils.validateLevel(11, '5e')).resolves.toEqual({ level: 'Level must be between 1 and 10' });
      await expect(utils.validateLevel(0, '5e')).resolves.toEqual({ level: 'Level must be between 1 and 10' });
    });

    it('falls back to a 1-20 range when the rules omit level_range', async () => {
      dataLoader.loadValidationRules.mockResolvedValue({});
      await expect(utils.validateLevel(1, '5e')).resolves.toEqual({});
      await expect(utils.validateLevel(20, '5e')).resolves.toEqual({});
      await expect(utils.validateLevel(21, '5e')).resolves.toEqual({ level: LEVEL_1_20_ERROR });
      await expect(utils.validateLevel(0, '5e')).resolves.toEqual({ level: LEVEL_1_20_ERROR });
    });
  });

  describe('validateAbility', () => {
    beforeEach(() => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(MOCK_VALIDATION_RULES);
    });

    it('accepts base scores at and within the point-buy boundaries (8-15)', async () => {
      for (const baseScore of [8, 10, 15]) {
        await expect(utils.validateAbility(ability({ baseScore }), 0, '5e', 1)).resolves.toEqual({});
      }
    });

    it('flags base scores just outside the boundaries, naming the violated limit', async () => {
      await expect(utils.validateAbility(ability({ baseScore: 7 }), 0, '5e', 1)).resolves.toEqual({ baseScore: MIN_BASE_ERROR });
      await expect(utils.validateAbility(ability({ baseScore: 16 }), 0, '5e', 1)).resolves.toEqual({ baseScore: MAX_BASE_ERROR });
    });

    it('flags totals above the level-1 cap regardless of which increase source pushed it over', async () => {
      for (const source of ['featIncrease', 'backgroundIncrease', 'miscIncrease']) {
        await expect(utils.validateAbility(ability({ baseScore: 15, [source]: 6 }), 0, '5e', 1))
          .resolves.toEqual({ totalScore: TOTAL_20_ERROR });
      }
    });

    it('applies the higher cap of 24 only at level 20', async () => {
      await expect(utils.validateAbility(ability({ baseScore: 15, featIncrease: 6 }), 0, '5e', 19))
        .resolves.toEqual({ totalScore: TOTAL_20_ERROR });
      await expect(utils.validateAbility(ability({ baseScore: 15, featIncrease: 9 }), 0, '5e', 20)).resolves.toEqual({});
      await expect(utils.validateAbility(ability({ baseScore: 15, featIncrease: 10 }), 0, '5e', 20))
        .resolves.toEqual({ totalScore: 'Total score (base + improvements + misc) cannot exceed 24' });
    });

    it('flags negative miscIncrease (numeric or string) and accepts zero miscIncrease', async () => {
      for (const miscIncrease of [-1, '-2']) {
        await expect(utils.validateAbility(ability({ miscIncrease }), 0, '5e', 1)).resolves.toEqual({ miscIncrease: MISC_ERROR });
      }
      for (const miscIncrease of [0, '0']) {
        await expect(utils.validateAbility(ability({ miscIncrease }), 0, '5e', 1)).resolves.toEqual({});
      }
    });

    it('treats numeric strings as numbers and unparseable values as safe defaults', async () => {
      await expect(utils.validateAbility(ability({ baseScore: '10', featIncrease: '2' }), 0, '5e', 1)).resolves.toEqual({});
      // Unparseable everything → score falls back to the minimum legal 8/0/0/0.
      await expect(utils.validateAbility({
        baseScore: 'invalid',
        featIncrease: 'x',
        miscIncrease: 'y',
        backgroundIncrease: 'z',
      }, 0, '5e', 1)).resolves.toEqual({});
    });

    it('honors custom point-buy limits and a custom level-20 cap from the rules', async () => {
      dataLoader.loadValidationRules.mockResolvedValue({
        point_buy: { min_base_score: 10, max_base_score: 14, max_total_score: 18 },
        ability_score_max: { level_20: 27 },
      });
      await expect(utils.validateAbility(ability({ baseScore: 9 }), 0, '5e', 1))
        .resolves.toEqual({ baseScore: 'Base score must be at least 10' });
      await expect(utils.validateAbility(ability({ baseScore: 15 }), 0, '5e', 1))
        .resolves.toEqual({ baseScore: 'Base score cannot exceed 14 (point buy max)' });
      await expect(utils.validateAbility(ability({ baseScore: 14, miscIncrease: 5 }), 0, '5e', 1))
        .resolves.toEqual({ totalScore: 'Total score (base + improvements + misc) cannot exceed 18' });
      await expect(utils.validateAbility(ability({ baseScore: 14, featIncrease: 13 }), 0, '5e', 20)).resolves.toEqual({});
      await expect(utils.validateAbility(ability({ baseScore: 14, featIncrease: 14 }), 0, '5e', 20))
        .resolves.toEqual({ totalScore: 'Total score (base + improvements + misc) cannot exceed 27' });
    });

    it('falls back to the standard 8/15/20 limits when rules omit the point buy config', async () => {
      dataLoader.loadValidationRules.mockResolvedValue({});
      await expect(utils.validateAbility(ability({ baseScore: 7 }), 0, '5e', 1)).resolves.toEqual({ baseScore: MIN_BASE_ERROR });
      await expect(utils.validateAbility(ability({ baseScore: 16 }), 0, '5e', 1)).resolves.toEqual({ baseScore: MAX_BASE_ERROR });
      await expect(utils.validateAbility(ability({ baseScore: 15, miscIncrease: 5 }), 0, '5e', 1)).resolves.toEqual({});
      await expect(utils.validateAbility(ability({ baseScore: 15, miscIncrease: 6 }), 0, '5e', 1))
        .resolves.toEqual({ totalScore: TOTAL_20_ERROR });
    });
  });

  describe('validateStep', () => {
    beforeEach(() => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(MOCK_VALIDATION_RULES);
    });

    describe('Step 2: Basic Information', () => {
      const validFormData = { name: 'Test', level: 1, alignment: 'Good' };

      it('accepts valid basics', async () => {
        await expect(utils.validateStep(2, validFormData, stepContext())).resolves.toEqual({});
      });

      it('bubbles up the shared level validator on invalid levels', async () => {
        await expect(utils.validateStep(2, { ...validFormData, level: 0 }, stepContext()))
          .resolves.toEqual({ level: LEVEL_1_20_ERROR });
        await expect(utils.validateStep(2, { ...validFormData, level: 21 }, stepContext()))
          .resolves.toEqual({ level: LEVEL_1_20_ERROR });
      });

      it('flags a missing name and missing alignment together, and a whitespace name alone', async () => {
        await expect(utils.validateStep(2, { level: 1 }, stepContext())).resolves.toEqual({
          name: NAME_REQUIRED_STEP,
          alignment: 'Alignment is required',
        });
        await expect(utils.validateStep(2, { ...validFormData, name: '   ' }, stepContext()))
          .resolves.toEqual({ name: NAME_REQUIRED_STEP });
      });
    });

    describe('Step 3: Race', () => {
      it('requires a race with a name, works without a context object, and accepts a valid race', async () => {
        await expect(utils.validateStep(3, {}, stepContext())).resolves.toEqual({ race: 'Race is required' });
        await expect(utils.validateStep(3, { race: {} }, stepContext())).resolves.toEqual({ race: 'Race is required' });
        await expect(utils.validateStep(3, { race: { name: 'Human' } }, stepContext())).resolves.toEqual({});
        await expect(utils.validateStep(3, { race: { name: 'Human' } })).resolves.toEqual({});
      });
    });

    describe('Step 4: Subrace', () => {
      const racesWithSubraces = [{ name: 'Elf', subraces: [{ name: 'High Elf' }, { name: 'Wood Elf' }] }];

      it('requires a subrace when the selected race offers one', async () => {
        await expect(utils.validateStep(4, { race: { name: 'Elf' } }, stepContext({ racesData: racesWithSubraces })))
          .resolves.toEqual({ subrace: 'Subrace is required' });
      });

      it('skips the subrace requirement once selected, when the race offers none, is unknown, or no race is selected', async () => {
        await expect(utils.validateStep(4, { race: { name: 'Elf', subrace: { name: 'High Elf' } } }, stepContext({ racesData: racesWithSubraces })))
          .resolves.toEqual({});
        const contexts = [
          stepContext({ racesData: [{ name: 'Human', subraces: [] }] }),
          stepContext({ racesData: [] }),
        ];
        const forms = [
          { race: { name: 'Elf', subrace: { name: 'High Elf' } } },
          { race: { name: 'Human' } },
          { race: {} },
          { race: { name: 'Gnome' } },
        ];
        for (const form of forms) {
          for (const context of contexts) {
            await expect(utils.validateStep(4, form, context)).resolves.toEqual({});
          }
        }
      });
    });

    describe('Step 5: Background', () => {
      const validFormData = { name: 'Test', level: 1, alignment: 'Good' };

      it('requires a background only for the 2024 ruleset', async () => {
        await expect(utils.validateStep(5, validFormData, stepContext({ ruleset: '2024' })))
          .resolves.toEqual({ background: 'Background is required' });
        await expect(utils.validateStep(5, validFormData, stepContext({ ruleset: '5e' }))).resolves.toEqual({});
        await expect(utils.validateStep(5, { ...validFormData, background: 'Soldier' }, stepContext({ ruleset: '2024' })))
          .resolves.toEqual({});
      });
    });

    describe('Step 6: Class', () => {
      it('requires a class with a name but never demands a subclass at this step', async () => {
        await expect(utils.validateStep(6, {}, stepContext())).resolves.toEqual({ class: 'Class is required' });
        await expect(utils.validateStep(6, { class: {} }, stepContext())).resolves.toEqual({ class: 'Class is required' });
        await expect(utils.validateStep(6, { class: { name: 'Fighter' } }, stepContext({
          classSubtypes: [{ className: 'Fighter', subtypes: [{ name: 'Champion' }] }],
        }))).resolves.toEqual({});
      });
    });

    describe('Step 7: Subclass', () => {
      const classSubtypesWithSubclasses = [{ className: 'Fighter', subtypes: [{ name: 'Champion' }, { name: 'Battle Master' }] }];

      it('requires a subclass when the selected class offers one', async () => {
        await expect(utils.validateStep(7, { class: { name: 'Fighter' } }, stepContext({ classSubtypes: classSubtypesWithSubclasses })))
          .resolves.toEqual({ subclass: 'Subclass is required' });
      });

      it('skips the subclass requirement once selected, when the class offers none, is unknown, or no class is selected', async () => {
        await expect(utils.validateStep(7, { class: { name: 'Fighter', subclass: { name: 'Champion' } } }, stepContext({ classSubtypes: classSubtypesWithSubclasses })))
          .resolves.toEqual({});
        const contexts = [
          stepContext({ classSubtypes: [{ className: 'Fighter', subtypes: [] }] }),
          stepContext({ classSubtypes: [] }),
        ];
        const forms = [
          { class: { name: 'Fighter', subclass: { name: 'Champion' } } },
          { class: {} },
          { class: { name: 'Rogue' } },
        ];
        for (const form of forms) {
          for (const context of contexts) {
            await expect(utils.validateStep(7, form, context)).resolves.toEqual({});
          }
        }
      });
    });

    describe('Step 9: Abilities (FT-001 total cap)', () => {
      const abilities2024 = [
        ability({ name: 'Strength', baseScore: 8 }),
        ability({ name: 'Dexterity', baseScore: 14 }),
        ability({ name: 'Constitution', baseScore: 14 }),
        ability({ name: 'Intelligence', baseScore: 8, backgroundIncrease: 1 }),
        ability({ name: 'Wisdom', baseScore: 18, featIncrease: 2, backgroundIncrease: 1 }),
        ability({ name: 'Charisma', baseScore: 16, backgroundIncrease: 1 }),
      ];
      const step9Form = (abilities) => ({ level: 8, rules: '2024', abilities });

      it('blocks an over-cap allocation under an index-keyed error', async () => {
        // Wisdom 18 + 2 feat + 1 background = 21 at index 4, cap 20 below level 20.
        await expect(utils.validateStep(9, step9Form(abilities2024), stepContext({ ruleset: '2024' })))
          .resolves.toEqual({ ability_4_totalScore: 'Wisdom total 21 exceeds the maximum of 20' });
      });

      it('accepts a legal allocation exactly at the cap', async () => {
        const legal = abilities2024.map(a => (a.name === 'Wisdom' ? { ...a, featIncrease: 1 } : a));
        await expect(utils.validateStep(9, step9Form(legal), stepContext({ ruleset: '2024' }))).resolves.toEqual({});
      });
    });

    describe('steps without a registered validator', () => {
      it('accepts unrecognized step numbers (nothing to validate)', async () => {
        for (const step of [undefined, 0, 1, 8, 99]) {
          await expect(utils.validateStep(step, {}, stepContext())).resolves.toEqual({});
        }
      });
    });
  });

  describe('validateAbilityTotals', () => {
    beforeEach(() => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(MOCK_VALIDATION_RULES);
    });

    const wisdom18 = ability({ name: 'Wisdom', baseScore: 18 });
    const wisdom21 = { ...wisdom18, featIncrease: 2, backgroundIncrease: 1 }; // 18 + 2 + 1 = 21

    it('accepts an empty abilities list or a missing form', async () => {
      await expect(utils.validateAbilityTotals({ abilities: [] })).resolves.toEqual({});
      await expect(utils.validateAbilityTotals({})).resolves.toEqual({});
      await expect(utils.validateAbilityTotals(null)).resolves.toEqual({});
    });

    it('flags each over-cap ability under its own index-keyed error', async () => {
      const abilities = [
        wisdom21,                                                                 // 21 → flagged
        ability({ name: 'Strength', baseScore: 12 }),                             // 12 → clean
        ability({ name: 'Dexterity', baseScore: 20, featIncrease: 2 }),         // 22 → flagged
      ];
      await expect(utils.validateAbilityTotals({ level: 8, rules: '2024', abilities }))
        .resolves.toEqual({
          ability_0_totalScore: 'Wisdom total 21 exceeds the maximum of 20',
          ability_2_totalScore: 'Dexterity total 22 exceeds the maximum of 20',
        });
    });

    it('applies the level-20 cap of 24', async () => {
      await expect(utils.validateAbilityTotals({ level: 20, rules: '2024', abilities: [wisdom21] }))
        .resolves.toEqual({});
      await expect(utils.validateAbilityTotals({
        level: 20,
        rules: '2024',
        abilities: [{ ...wisdom21, featIncrease: 6 }], // 18 + 6 + 1 = 25 > 24
      })).resolves.toEqual({ ability_0_totalScore: 'Wisdom total 25 exceeds the maximum of 24' });
    });

    it('honors a 2024 Epic Boon cap only while it is selected (string or object entry)', async () => {
      const boon = { name: 'Boon Of Fortitude', ability_score_increase: { max_value: 30 } };
      const formData = { level: 20, rules: '2024', abilities: [{ ...wisdom21, featIncrease: 11 }], feats: ['Boon Of Fortitude'] }; // 18 + 11 + 1 = 30 = cap
      await expect(utils.validateAbilityTotals(formData, { allFeats: [boon] })).resolves.toEqual({});
      await expect(utils.validateAbilityTotals({ ...formData, feats: [{ name: 'Boon Of Fortitude' }] }, { allFeats: [boon] }))
        .resolves.toEqual({});
      await expect(utils.validateAbilityTotals({ ...formData, feats: [] }, { allFeats: [boon] }))
        .resolves.toEqual({ ability_0_totalScore: 'Wisdom total 30 exceeds the maximum of 24' });
    });

    it('honors a 5e cap raise (maximum of 30) declared in the feat description', async () => {
      const feat = { name: 'Improvement', description: 'Increase your Wisdom score by 2, to a maximum of 30.' };
      const formData = { level: 8, rules: '5e', abilities: [wisdom21], feats: ['Improvement'] }; // 21 > 20 without the feat
      await expect(utils.validateAbilityTotals(formData, { allFeats: [feat] })).resolves.toEqual({});
      await expect(utils.validateAbilityTotals({ ...formData, feats: [] }, { allFeats: [feat] }))
        .resolves.toEqual({ ability_0_totalScore: 'Wisdom total 21 exceeds the maximum of 20' });
    });

    it('keeps the cap-raise channel ruleset-specific: 5e ignores the 2024 max_value field', async () => {
      const boon = { name: 'Boon Of Fortitude', ability_score_increase: { max_value: 30 }, description: 'You are hard to kill.' };
      const formData = { level: 8, rules: '5e', abilities: [wisdom21], feats: ['Boon Of Fortitude'] };
      await expect(utils.validateAbilityTotals(formData, { allFeats: [boon] }))
        .resolves.toEqual({ ability_0_totalScore: 'Wisdom total 21 exceeds the maximum of 20' });
    });
  });

  describe('validateAbilityTotals with racial bonuses (computeRaceBuffs seam)', () => {
    beforeEach(() => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(MOCK_VALIDATION_RULES);
      computeRaceBuffs.mockReset().mockReturnValue({ abilityScoreIncreases: [] });
    });

    const dwarf = { name: 'Hill Dwarf' };
    const wisdom18 = ability({ name: 'Wisdom', baseScore: 18 });

    it('adds 5e racial bonuses into the gated total', async () => {
      computeRaceBuffs.mockReturnValue({ abilityScoreIncreases: [{ name: 'Wisdom', amount: 3 }] });
      const formData = { level: 4, rules: '5e', race: dwarf, abilities: [wisdom18] }; // 18 + 3 = 21 > 20
      await expect(utils.validateAbilityTotals(formData, { racesData: [dwarf], ruleset: '5e' }))
        .resolves.toEqual({ ability_0_totalScore: 'Wisdom total 21 exceeds the maximum of 20' });
      expect(computeRaceBuffs).toHaveBeenCalled();
    });

    it('accepts a total that reaches the cap only thanks to the racial bonus', async () => {
      computeRaceBuffs.mockReturnValue({ abilityScoreIncreases: [{ name: 'Wisdom', amount: 2 }] });
      const formData = { level: 4, rules: '5e', race: dwarf, abilities: [wisdom18] }; // 18 + 2 = 20 = cap
      await expect(utils.validateAbilityTotals(formData, { racesData: [dwarf], ruleset: '5e' })).resolves.toEqual({});
    });

    it('stacks subrace increases on top of race increases', async () => {
      const elf = { name: 'Elf', subrace: { name: 'High Elf' } };
      computeRaceBuffs
        .mockReturnValueOnce({ abilityScoreIncreases: [{ name: 'Wisdom', amount: 2 }] })
        .mockReturnValueOnce({ abilityScoreIncreases: [{ name: 'Wisdom', amount: 1 }] });
      const formData = { level: 4, rules: '5e', race: elf, abilities: [wisdom18] }; // 18 + 2 + 1 = 21
      await expect(utils.validateAbilityTotals(formData, {
        racesData: [{ name: 'Elf', subraces: [{ name: 'High Elf' }] }],
        ruleset: '5e',
      })).resolves.toEqual({ ability_0_totalScore: 'Wisdom total 21 exceeds the maximum of 20' });
      expect(computeRaceBuffs).toHaveBeenCalledTimes(2);
    });

    it('ignores racial bonuses for 2024, unknown races, and no race selected — never consulting the races service', async () => {
      computeRaceBuffs.mockReturnValue({ abilityScoreIncreases: [{ name: 'Wisdom', amount: 5 }] });
      await expect(utils.validateAbilityTotals({ level: 4, rules: '2024', race: dwarf, abilities: [wisdom18] },
        { racesData: [dwarf], ruleset: '2024' })).resolves.toEqual({});
      await expect(utils.validateAbilityTotals({ level: 4, rules: '5e', race: { name: 'Gnome' }, abilities: [wisdom18] },
        { racesData: [dwarf], ruleset: '5e' })).resolves.toEqual({});
      await expect(utils.validateAbilityTotals({ level: 4, rules: '5e', abilities: [wisdom18] },
        { racesData: [dwarf], ruleset: '5e' })).resolves.toEqual({});
      expect(computeRaceBuffs).not.toHaveBeenCalled();
    });
  });
});
