// @maintained-by-ai: 2026-10-14
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

// Only the fields utils.js actually reads from rules-validation.json
// (matches the shape of public/data/2024/rules-validation.json per ruleset).
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
  beforeEach(() => {
    vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(MOCK_VALIDATION_RULES);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPointBuyCosts', () => {
    it('resolves the costs carried by the loaded rules for the requested ruleset', async () => {
      const costs = await utils.getPointBuyCosts('2024');
      expect(dataLoader.loadValidationRules).toHaveBeenCalledWith('2024');
      // Distinct from DEFAULT_POINT_BUY_COSTS (has the extra 16 tier), so this
      // fails if the loader result is ignored in favor of the fallback.
      expect(costs).toEqual(POINT_BUY_COSTS_FROM_RULES);
    });

    it('falls back to the standard costs when rules are empty or lack point_buy.costs', async () => {
      for (const rules of [{}, { point_buy: {} }, { point_buy: { costs: null } }]) {
        dataLoader.loadValidationRules.mockResolvedValueOnce(rules);
        await expect(utils.getPointBuyCosts('5e')).resolves.toEqual(DEFAULT_POINT_BUY_COSTS);
      }
    });
  });

  describe('getPointBuyCostsSync', () => {
    it('returns the cached costs verbatim, querying the requested ruleset', () => {
      const cached = { 8: 0, 9: 2, 10: 4 };
      const cachedSpy = vi.spyOn(dataLoader, 'getCachedPointBuyCosts').mockReturnValue(cached);
      expect(utils.getPointBuyCostsSync('2024')).toEqual(cached);
      expect(cachedSpy).toHaveBeenCalledWith('2024');
    });

    it('falls back to the standard costs while the cache is unpopulated (null or undefined)', () => {
      const cachedSpy = vi.spyOn(dataLoader, 'getCachedPointBuyCosts').mockReturnValue(null);
      expect(utils.getPointBuyCostsSync('5e')).toEqual(DEFAULT_POINT_BUY_COSTS);
      cachedSpy.mockReturnValue(undefined);
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

    it('accepts a complete form, and accepts a null/undefined form (nothing to validate yet)', () => {
      expect(utils.validateFinalFormData(COMPLETE_FORM_DATA)).toEqual({});
      expect(utils.validateFinalFormData(null)).toEqual({});
      expect(utils.validateFinalFormData(undefined)).toEqual({});
    });

    it('reports exactly the required name/level/alignment/race/class/expertSkills fields when the form is empty, treating whitespace-only strings as missing', () => {
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
      expect(utils.validateFinalFormData({ ...COMPLETE_FORM_DATA, name: '   ' }))
        .toEqual({ name: 'name is required' });
    });

    it('never flags the deliberately-skipped fields abilities, inventory or skillProficiencies', () => {
      const form = { ...COMPLETE_FORM_DATA, abilities: undefined, inventory: undefined, skillProficiencies: undefined };
      expect(utils.validateFinalFormData(form)).toEqual({});
    });
  });

  describe('validateLevel', () => {
    it('accepts levels inside the range (numeric strings from text inputs included) and rejects missing, zero, and out-of-range levels', async () => {
      for (const level of [1, 10, 20, '1', '10', '20']) {
        await expect(utils.validateLevel(level, '5e')).resolves.toEqual({});
      }
      for (const level of [null, undefined, '', NaN, false, 0, -1, 21, '0', '25']) {
        await expect(utils.validateLevel(level, '5e')).resolves.toEqual({ level: LEVEL_1_20_ERROR });
      }
    });

    it('respects a custom min/max from the rules, falling back to 1-20 when level_range is omitted', async () => {
      dataLoader.loadValidationRules.mockResolvedValue({ level_range: { min: 1, max: 10 } });
      await expect(utils.validateLevel(1, '5e')).resolves.toEqual({});
      await expect(utils.validateLevel(10, '5e')).resolves.toEqual({});
      await expect(utils.validateLevel(11, '5e')).resolves.toEqual({ level: 'Level must be between 1 and 10' });
      await expect(utils.validateLevel(0, '5e')).resolves.toEqual({ level: 'Level must be between 1 and 10' });

      dataLoader.loadValidationRules.mockResolvedValue({});
      await expect(utils.validateLevel(20, '5e')).resolves.toEqual({});
      await expect(utils.validateLevel(21, '5e')).resolves.toEqual({ level: LEVEL_1_20_ERROR });
      await expect(utils.validateLevel(0, '5e')).resolves.toEqual({ level: LEVEL_1_20_ERROR });
    });
  });

  describe('validateAbility', () => {
    it('gates base scores at the point-buy boundaries, naming the violated limit', async () => {
      for (const [baseScore, expected] of [
        [8, {}],
        [10, {}],
        [15, {}],
        [7, { baseScore: MIN_BASE_ERROR }],
        [16, { baseScore: MAX_BASE_ERROR }],
      ]) {
        await expect(utils.validateAbility(ability({ baseScore }), 0, '5e', 1)).resolves.toEqual(expected);
      }
    });

    it('caps totals at 20 below level 20 and 24 at level 20, whichever increase source pushed it over', async () => {
      for (const source of ['featIncrease', 'backgroundIncrease', 'miscIncrease']) {
        await expect(utils.validateAbility(ability({ baseScore: 15, [source]: 6 }), 0, '5e', 1))
          .resolves.toEqual({ totalScore: TOTAL_20_ERROR });
      }
      await expect(utils.validateAbility(ability({ baseScore: 15, featIncrease: 6 }), 0, '5e', 19))
        .resolves.toEqual({ totalScore: TOTAL_20_ERROR });
      await expect(utils.validateAbility(ability({ baseScore: 15, featIncrease: 9 }), 0, '5e', 20)).resolves.toEqual({});
      await expect(utils.validateAbility(ability({ baseScore: 15, featIncrease: 10 }), 0, '5e', 20))
        .resolves.toEqual({ totalScore: 'Total score (base + improvements + misc) cannot exceed 24' });
    });

    it('flags negative miscIncrease (numeric or string), coerces numeric strings, and treats unparseable values as safe defaults', async () => {
      for (const miscIncrease of [-1, '-2']) {
        await expect(utils.validateAbility(ability({ miscIncrease }), 0, '5e', 1)).resolves.toEqual({ miscIncrease: MISC_ERROR });
      }
      for (const miscIncrease of [0, '0']) {
        await expect(utils.validateAbility(ability({ miscIncrease }), 0, '5e', 1)).resolves.toEqual({});
      }
      await expect(utils.validateAbility(ability({ baseScore: '10', featIncrease: '2' }), 0, '5e', 1)).resolves.toEqual({});
      // Unparseable everything → score falls back to the minimum legal 8/0/0/0.
      await expect(utils.validateAbility({
        baseScore: 'invalid',
        featIncrease: 'x',
        miscIncrease: 'y',
        backgroundIncrease: 'z',
      }, 0, '5e', 1)).resolves.toEqual({});
    });

    it('honors custom point-buy limits and a custom level-20 cap, falling back to the standard 8/15/20 limits when rules omit them', async () => {
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

      dataLoader.loadValidationRules.mockResolvedValue({});
      await expect(utils.validateAbility(ability({ baseScore: 7 }), 0, '5e', 1)).resolves.toEqual({ baseScore: MIN_BASE_ERROR });
      await expect(utils.validateAbility(ability({ baseScore: 16 }), 0, '5e', 1)).resolves.toEqual({ baseScore: MAX_BASE_ERROR });
      await expect(utils.validateAbility(ability({ baseScore: 15, miscIncrease: 5 }), 0, '5e', 1)).resolves.toEqual({});
      await expect(utils.validateAbility(ability({ baseScore: 15, miscIncrease: 6 }), 0, '5e', 1))
        .resolves.toEqual({ totalScore: TOTAL_20_ERROR });
    });
  });

  describe('validateStep', () => {
    const validBasics = { name: 'Test', level: 1, alignment: 'Good' };

    it('step 2 accepts valid basics and bubbles up the shared level validator on invalid levels', async () => {
      await expect(utils.validateStep(2, validBasics, stepContext())).resolves.toEqual({});
      for (const level of [0, 21]) {
        await expect(utils.validateStep(2, { ...validBasics, level }, stepContext()))
          .resolves.toEqual({ level: LEVEL_1_20_ERROR });
      }
    });

    it('step 2 flags a missing or whitespace-only name and a missing alignment', async () => {
      await expect(utils.validateStep(2, { level: 1 }, stepContext())).resolves.toEqual({
        name: NAME_REQUIRED_STEP,
        alignment: 'Alignment is required',
      });
      await expect(utils.validateStep(2, { ...validBasics, name: '   ' }, stepContext()))
        .resolves.toEqual({ name: NAME_REQUIRED_STEP });
    });

    // Steps 3/6 and 4/7 share the same require-a-named-entity shape; tabled once.
    const parentNameCases = [
      {
        step: 3, key: 'race', error: 'Race is required', named: { name: 'Elf' },
        context: stepContext({ racesData: [{ name: 'Elf', subraces: [{ name: 'High Elf' }] }] }),
      },
      {
        step: 6, key: 'class', error: 'Class is required', named: { name: 'Fighter' },
        context: stepContext({ classSubtypes: [{ className: 'Fighter', subtypes: [{ name: 'Champion' }] }] }),
      },
    ];

    it('steps 3/6 require only a named race/class — an available subrace/subclass is never demanded at this step', async () => {
      for (const { step, key, error, named, context } of parentNameCases) {
        await expect(utils.validateStep(step, {}, context)).resolves.toEqual({ [key]: error });
        await expect(utils.validateStep(step, { [key]: {} }, context)).resolves.toEqual({ [key]: error });
        await expect(utils.validateStep(step, { [key]: named }, context)).resolves.toEqual({});
        await expect(utils.validateStep(step, { [key]: named })).resolves.toEqual({});
      }
    });

    const childChoiceCases = [
      {
        step: 4, parentKey: 'race', childKey: 'subrace', error: 'Subrace is required',
        parent: { name: 'Elf' }, child: { name: 'High Elf' },
        withChildren: [{ name: 'Elf', subraces: [{ name: 'High Elf' }, { name: 'Wood Elf' }] }],
        ctxKey: 'racesData',
      },
      {
        step: 7, parentKey: 'class', childKey: 'subclass', error: 'Subclass is required',
        parent: { name: 'Fighter' }, child: { name: 'Champion' },
        withChildren: [{ className: 'Fighter', subtypes: [{ name: 'Champion' }, { name: 'Battle Master' }] }],
        ctxKey: 'classSubtypes',
      },
    ];

    it('steps 4/7 require a subrace/subclass when the selected parent offers one', async () => {
      for (const { step, parentKey, childKey, error, parent, withChildren, ctxKey } of childChoiceCases) {
        await expect(utils.validateStep(step, { [parentKey]: parent }, stepContext({ [ctxKey]: withChildren })))
          .resolves.toEqual({ [childKey]: error });
      }
    });

    it('steps 4/7 skip the requirement once selected, when the parent offers none, is unknown, or is absent', async () => {
      for (const { step, parentKey, childKey, parent, child, withChildren, ctxKey } of childChoiceCases) {
        const forms = [
          { [parentKey]: { ...parent, [childKey]: child } }, // selected
          { [parentKey]: {} },                                 // parent offers none / absent
          { [parentKey]: { name: 'Gnome' } },               // unknown parent
        ];
        for (const context of [stepContext({ [ctxKey]: withChildren }), stepContext({ [ctxKey]: [] })]) {
          for (const form of forms) {
            await expect(utils.validateStep(step, form, context)).resolves.toEqual({});
          }
        }
      }
    });

    it('step 5 requires a background only for the 2024 ruleset', async () => {
      await expect(utils.validateStep(5, validBasics, stepContext({ ruleset: '2024' })))
        .resolves.toEqual({ background: 'Background is required' });
      await expect(utils.validateStep(5, validBasics, stepContext({ ruleset: '5e' }))).resolves.toEqual({});
      await expect(utils.validateStep(5, { ...validBasics, background: 'Soldier' }, stepContext({ ruleset: '2024' })))
        .resolves.toEqual({});
    });

    it('step 9 (FT-001) delegates to validateAbilityTotals under an index-keyed error', async () => {
      // Wisdom 18 + 2 feat + 1 background = 21 at index 4, cap 20 below level 20.
      const abilities = [
        ability({ name: 'Strength', baseScore: 8 }),
        ability({ name: 'Dexterity', baseScore: 14 }),
        ability({ name: 'Constitution', baseScore: 14 }),
        ability({ name: 'Intelligence', baseScore: 8, backgroundIncrease: 1 }),
        ability({ name: 'Wisdom', baseScore: 18, featIncrease: 2, backgroundIncrease: 1 }),
        ability({ name: 'Charisma', baseScore: 16, backgroundIncrease: 1 }),
      ];
      await expect(utils.validateStep(9, { level: 8, rules: '2024', abilities }, stepContext({ ruleset: '2024' })))
        .resolves.toEqual({ ability_4_totalScore: 'Wisdom total 21 exceeds the maximum of 20' });
    });

    it('accepts unrecognized step numbers (nothing to validate)', async () => {
      for (const step of [undefined, 0, 1, 8, 99]) {
        await expect(utils.validateStep(step, {}, stepContext())).resolves.toEqual({});
      }
    });
  });

  describe('validateAbilityTotals', () => {
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
      // Shape matches public/data/2024/feats.json (ability_score_increase.max_value).
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
      computeRaceBuffs.mockReset().mockReturnValue({ abilityScoreIncreases: [] });
    });

    const dwarf = { name: 'Hill Dwarf' };
    const wisdom18 = ability({ name: 'Wisdom', baseScore: 18 });
    const formData = { level: 4, rules: '5e', race: dwarf, abilities: [wisdom18] };

    it('folds 5e racial bonuses into the gated total (at-cap accepted, over-cap flagged)', async () => {
      computeRaceBuffs.mockReturnValue({ abilityScoreIncreases: [{ name: 'Wisdom', amount: 2 }] });
      await expect(utils.validateAbilityTotals(formData, { racesData: [dwarf], ruleset: '5e' })).resolves.toEqual({}); // 18 + 2 = 20 = cap

      computeRaceBuffs.mockReturnValue({ abilityScoreIncreases: [{ name: 'Wisdom', amount: 3 }] });
      await expect(utils.validateAbilityTotals(formData, { racesData: [dwarf], ruleset: '5e' }))
        .resolves.toEqual({ ability_0_totalScore: 'Wisdom total 21 exceeds the maximum of 20' }); // 18 + 3 = 21 > 20
      expect(computeRaceBuffs).toHaveBeenCalled();
    });

    it('stacks subrace increases on top of race increases', async () => {
      const elf = { name: 'Elf', subrace: { name: 'High Elf' } };
      computeRaceBuffs
        .mockReturnValueOnce({ abilityScoreIncreases: [{ name: 'Wisdom', amount: 2 }] })
        .mockReturnValueOnce({ abilityScoreIncreases: [{ name: 'Wisdom', amount: 1 }] });
      await expect(utils.validateAbilityTotals({ level: 4, rules: '5e', race: elf, abilities: [wisdom18] }, {
        racesData: [{ name: 'Elf', subraces: [{ name: 'High Elf' }] }],
        ruleset: '5e',
      })).resolves.toEqual({ ability_0_totalScore: 'Wisdom total 21 exceeds the maximum of 20' }); // 18 + 2 + 1 = 21
      expect(computeRaceBuffs).toHaveBeenCalledTimes(2);
    });

    it('ignores racial bonuses for 2024, unknown races, and no race selected — never consulting the races service', async () => {
      computeRaceBuffs.mockReturnValue({ abilityScoreIncreases: [{ name: 'Wisdom', amount: 5 }] });
      await expect(utils.validateAbilityTotals({ ...formData, rules: '2024' },
        { racesData: [dwarf], ruleset: '2024' })).resolves.toEqual({});
      await expect(utils.validateAbilityTotals({ ...formData, race: { name: 'Gnome' } },
        { racesData: [dwarf], ruleset: '5e' })).resolves.toEqual({});
      await expect(utils.validateAbilityTotals({ level: 4, rules: '5e', abilities: [wisdom18] },
        { racesData: [dwarf], ruleset: '5e' })).resolves.toEqual({});
      expect(computeRaceBuffs).not.toHaveBeenCalled();
    });
  });
});
