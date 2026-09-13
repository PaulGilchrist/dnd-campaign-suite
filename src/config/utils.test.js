// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
// @improved-by-ai
// @cleaned-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as dataLoader from '../services/ui/dataLoader.js';
import * as utils from './utils.js';
import { REQUIRED_FIELDS } from './constants.js';

const DEFAULT_POINT_BUY_COSTS = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

const MOCK_VALIDATION_RULES = {
  level_range: { min: 1, max: 20 },
  point_buy: {
    total_points: 27,
    min_base_score: 8,
    max_base_score: 15,
    max_total_score: 20,
    max_total_score_level_20: 24,
    costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }
  },
  ability_score_max: { standard: 20, level_20: 24 }
};

const BASE_ABILITY = { baseScore: 10, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 };

const COMPLETE_FORM_DATA = {
  name: 'Test Character',
  level: 1,
  alignment: 'Lawful Good',
  race: { name: 'Human' },
  class: { name: 'Wizard' },
  expertSkills: []
};

describe('character-creation/utils', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPointBuyCosts', () => {
    beforeEach(() => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(MOCK_VALIDATION_RULES);
    });

    it('returns the costs defined in the loaded rules', async () => {
      const costs = await utils.getPointBuyCosts('5e');
      expect(costs).toEqual(MOCK_VALIDATION_RULES.point_buy.costs);
    });

    it('falls back to default costs when rules are empty or lack point_buy.costs', async () => {
      dataLoader.loadValidationRules.mockResolvedValue({});
      await expect(utils.getPointBuyCosts('5e')).resolves.toEqual(DEFAULT_POINT_BUY_COSTS);

      dataLoader.loadValidationRules.mockResolvedValue({ point_buy: {} });
      await expect(utils.getPointBuyCosts('5e')).resolves.toEqual(DEFAULT_POINT_BUY_COSTS);

      dataLoader.loadValidationRules.mockResolvedValue({ point_buy: { costs: null } });
      await expect(utils.getPointBuyCosts('5e')).resolves.toEqual(DEFAULT_POINT_BUY_COSTS);
    });
  });

  describe('getPointBuyCostsSync', () => {
    it('returns default costs when the cache is empty (null or undefined)', () => {
      vi.spyOn(dataLoader, 'getCachedPointBuyCosts').mockReturnValue(null);
      expect(utils.getPointBuyCostsSync('5e')).toEqual(DEFAULT_POINT_BUY_COSTS);

      vi.spyOn(dataLoader, 'getCachedPointBuyCosts').mockReturnValue(undefined);
      expect(utils.getPointBuyCostsSync('5e')).toEqual(DEFAULT_POINT_BUY_COSTS);
    });

    it('returns the cached costs when available', () => {
      const cachedCosts = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 6, 15: 8 };
      vi.spyOn(dataLoader, 'getCachedPointBuyCosts').mockReturnValue(cachedCosts);
      expect(utils.getPointBuyCostsSync('5e')).toEqual(cachedCosts);
    });
  });

  describe('validateFinalFormData', () => {
    it('returns no errors when all required fields are present', () => {
      expect(utils.validateFinalFormData(COMPLETE_FORM_DATA)).toEqual({});
    });

    it('returns an error when name is absent or whitespace-only', () => {
      expect(utils.validateFinalFormData({ ...COMPLETE_FORM_DATA, name: undefined })).toHaveProperty('name');
      expect(utils.validateFinalFormData({ ...COMPLETE_FORM_DATA, name: null })).toHaveProperty('name');
      expect(utils.validateFinalFormData({ ...COMPLETE_FORM_DATA, name: '   ' })).toHaveProperty('name');
      expect(utils.validateFinalFormData({ ...COMPLETE_FORM_DATA, name: '' })).toHaveProperty('name');
    });

    it('returns an error for every non-excluded required field when all are missing', () => {
      const errors = utils.validateFinalFormData({});
      // REQUIRED_FIELDS includes abilities, inventory, skillProficiencies which are explicitly skipped
      const excludedFields = ['abilities', 'inventory', 'skillProficiencies'];
      const expectedErrorFields = REQUIRED_FIELDS.filter(f => !excludedFields.includes(f));
      for (const field of expectedErrorFields) {
        expect(errors).toHaveProperty(field);
      }
    });

    it('returns an empty errors object when formData is null or undefined', () => {
      expect(utils.validateFinalFormData(null)).toEqual({});
      expect(utils.validateFinalFormData(undefined)).toEqual({});
    });
  });

  describe('validateLevel', () => {
    beforeEach(() => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(MOCK_VALIDATION_RULES);
    });

    it('accepts valid levels at the boundaries and mid-range', async () => {
      expect(await utils.validateLevel(1, '5e')).toEqual({});
      expect(await utils.validateLevel(10, '5e')).toEqual({});
      expect(await utils.validateLevel(20, '5e')).toEqual({});
    });

    it('rejects levels outside the min/max range', async () => {
      expect((await utils.validateLevel(0, '5e')).level).toBeDefined();
      expect((await utils.validateLevel(-1, '5e')).level).toBeDefined();
      expect((await utils.validateLevel(21, '5e')).level).toBeDefined();
    });

    it('rejects falsy or non-numeric level values', async () => {
      const falsyValues = [null, undefined, '', NaN, false, 0];
      for (const level of falsyValues) {
        const errors = await utils.validateLevel(level, '5e');
        expect(errors).toHaveProperty('level');
      }
    });

    it('rejects string level values that parse to numbers outside range', async () => {
      expect((await utils.validateLevel('0', '5e')).level).toBeDefined();
      expect((await utils.validateLevel('25', '5e')).level).toBeDefined();
    });

    it('respects a custom min/max from the validation rules', async () => {
      dataLoader.loadValidationRules.mockResolvedValue({ level_range: { min: 1, max: 10 } });
      expect((await utils.validateLevel(11, '5e')).level).toBeDefined();
      expect(await utils.validateLevel(10, '5e')).toEqual({});
      expect(await utils.validateLevel(1, '5e')).toEqual({});
      expect((await utils.validateLevel(0, '5e')).level).toBeDefined();
    });

    it('falls back to a 1-20 range when level_range is missing', async () => {
      dataLoader.loadValidationRules.mockResolvedValue({});
      expect(await utils.validateLevel(1, '5e')).toEqual({});
      expect(await utils.validateLevel(20, '5e')).toEqual({});
      expect((await utils.validateLevel(21, '5e')).level).toBeDefined();
      expect((await utils.validateLevel(0, '5e')).level).toBeDefined();
    });
  });

  describe('validateAbility', () => {
    beforeEach(() => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(MOCK_VALIDATION_RULES);
    });

    it('accepts a valid base score with no increases', async () => {
      expect(await utils.validateAbility(BASE_ABILITY, 0, '5e', 1)).toEqual({});
    });

    it('accepts base scores at the point buy boundaries', async () => {
      expect(await utils.validateAbility({ ...BASE_ABILITY, baseScore: 8 }, 0, '5e', 1)).toEqual({});
      expect(await utils.validateAbility({ ...BASE_ABILITY, baseScore: 15 }, 0, '5e', 1)).toEqual({});
    });

    it('rejects base scores below the allowed minimum', async () => {
      expect((await utils.validateAbility({ ...BASE_ABILITY, baseScore: 7 }, 0, '5e', 1)).baseScore).toBeDefined();
    });

    it('rejects base scores above the point buy maximum', async () => {
      expect((await utils.validateAbility({ ...BASE_ABILITY, baseScore: 16 }, 0, '5e', 1)).baseScore).toBeDefined();
    });

    it('rejects a total score above the level 1 cap', async () => {
      const cases = [
        { baseScore: 15, featIncrease: 6 },
        { baseScore: 15, backgroundIncrease: 6 },
        { baseScore: 15, miscIncrease: 6 }
      ];
      for (const increases of cases) {
        const errors = await utils.validateAbility({ ...BASE_ABILITY, ...increases }, 0, '5e', 1);
        expect(errors).toHaveProperty('totalScore');
      }
    });

    it('applies the higher total cap only at level 20', async () => {
      expect((await utils.validateAbility({ ...BASE_ABILITY, baseScore: 15, featIncrease: 6 }, 0, '5e', 19))).toHaveProperty('totalScore');
      expect(await utils.validateAbility({ ...BASE_ABILITY, baseScore: 15, featIncrease: 9 }, 0, '5e', 20)).toEqual({});
      expect((await utils.validateAbility({ ...BASE_ABILITY, baseScore: 15, featIncrease: 10 }, 0, '5e', 20))).toHaveProperty('totalScore');
    });

    it('rejects a negative miscIncrease (numeric and string)', async () => {
      expect((await utils.validateAbility({ ...BASE_ABILITY, miscIncrease: -1 }, 0, '5e', 1))).toHaveProperty('miscIncrease');
      expect((await utils.validateAbility({ ...BASE_ABILITY, miscIncrease: '-2' }, 0, '5e', 1))).toHaveProperty('miscIncrease');
    });

    it('accepts a zero miscIncrease', async () => {
      expect(await utils.validateAbility({ ...BASE_ABILITY, miscIncrease: 0 }, 0, '5e', 1)).toEqual({});
      expect(await utils.validateAbility({ ...BASE_ABILITY, miscIncrease: '0' }, 0, '5e', 1)).toEqual({});
    });

    it('coerces string base scores via parseInt', async () => {
      const errors = await utils.validateAbility({ ...BASE_ABILITY, baseScore: '10' }, 0, '5e', 1);
      expect(errors).toEqual({});
    });

    it('treats unparseable values as defaults (baseScore 8, increases 0)', async () => {
      const errors = await utils.validateAbility({
        baseScore: 'invalid',
        featIncrease: 'x',
        miscIncrease: 'y',
        backgroundIncrease: 'z'
      }, 0, '5e', 1);
      expect(errors).toEqual({});
    });

    it('uses custom point buy limits from the validation rules', async () => {
      dataLoader.loadValidationRules.mockResolvedValue({
        point_buy: { min_base_score: 10, max_base_score: 14, max_total_score: 18 },
        ability_score_max: {}
      });
      expect((await utils.validateAbility({ ...BASE_ABILITY, baseScore: 9 }, 0, '5e', 1))).toHaveProperty('baseScore');
      expect((await utils.validateAbility({ ...BASE_ABILITY, baseScore: 15 }, 0, '5e', 1))).toHaveProperty('baseScore');
      expect(await utils.validateAbility({ ...BASE_ABILITY, baseScore: 14 }, 0, '5e', 1)).toEqual({});
      expect((await utils.validateAbility({ ...BASE_ABILITY, baseScore: 14, miscIncrease: 5 }, 0, '5e', 1))).toHaveProperty('totalScore');
    });

    it('uses default limits when rules omit the point buy config', async () => {
      dataLoader.loadValidationRules.mockResolvedValue({});
      expect((await utils.validateAbility({ ...BASE_ABILITY, baseScore: 7 }, 0, '5e', 1))).toHaveProperty('baseScore');
      expect((await utils.validateAbility({ ...BASE_ABILITY, baseScore: 16 }, 0, '5e', 1))).toHaveProperty('baseScore');
      expect((await utils.validateAbility({ ...BASE_ABILITY, baseScore: 15, miscIncrease: 5 }, 0, '5e', 1))).toEqual({});
      expect((await utils.validateAbility({ ...BASE_ABILITY, baseScore: 15, miscIncrease: 6 }, 0, '5e', 1))).toHaveProperty('totalScore');
    });
  });

  describe('validateStep', () => {
    beforeEach(() => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(MOCK_VALIDATION_RULES);
    });

    describe('Step 2: Basic Information', () => {
      const validFormData = { name: 'Test', level: 1, alignment: 'Good' };

      it('returns no errors when all required fields are present', async () => {
        expect(await utils.validateStep(2, validFormData, { racesData: [], classSubtypes: [], ruleset: '5e' })).toEqual({});
      });

      it('bubbles up invalid level values through the shared level validator', async () => {
        expect(await utils.validateStep(2, { ...validFormData, level: 0 }, { racesData: [], classSubtypes: [], ruleset: '5e' })).toHaveProperty('level');
        expect(await utils.validateStep(2, { ...validFormData, level: 21 }, { racesData: [], classSubtypes: [], ruleset: '5e' })).toHaveProperty('level');
      });

      it('rejects missing or whitespace-only name and missing alignment', async () => {
        const errors = await utils.validateStep(2, { level: 1 }, { racesData: [], classSubtypes: [], ruleset: '5e' });
        expect(errors).toHaveProperty('name');
        expect(errors).toHaveProperty('alignment');
      });
    });

    describe('Step 3: Race', () => {
      it('returns an error when race is missing or has no name, and accepts a valid race', async () => {
        expect(await utils.validateStep(3, {}, { racesData: [], classSubtypes: [], ruleset: '5e' })).toHaveProperty('race');
        expect(await utils.validateStep(3, { race: {} }, { racesData: [], classSubtypes: [], ruleset: '5e' })).toHaveProperty('race');
        expect(await utils.validateStep(3, { race: { name: 'Human' } }, { racesData: [], classSubtypes: [], ruleset: '5e' })).toEqual({});
      });
    });

    describe('Step 4: Subrace', () => {
      it('requires a subrace when the race has subraces, accepts a selected subrace, and skips when the race has none or is not found', async () => {
        const racesWithSubraces = [{ name: 'Elf', subraces: [{ name: 'High Elf' }, { name: 'Wood Elf' }] }];
        const racesWithoutSubraces = [{ name: 'Human', subraces: [] }];
        const formData = { race: { name: 'Elf' } };
        const formDataWithSubrace = { race: { name: 'Elf', subrace: { name: 'High Elf' } } };
        const noRaceForm = { race: {} };

        let errors = await utils.validateStep(4, formData, { racesData: racesWithSubraces, classSubtypes: [], ruleset: '5e' });
        expect(errors).toHaveProperty('subrace');

        errors = await utils.validateStep(4, formDataWithSubrace, { racesData: racesWithSubraces, classSubtypes: [], ruleset: '5e' });
        expect(errors).not.toHaveProperty('subrace');

        errors = await utils.validateStep(4, formData, { racesData: racesWithoutSubraces, classSubtypes: [], ruleset: '5e' });
        expect(errors).not.toHaveProperty('subrace');

        errors = await utils.validateStep(4, noRaceForm, { racesData: racesWithSubraces, classSubtypes: [], ruleset: '5e' });
        expect(errors).not.toHaveProperty('subrace');

        errors = await utils.validateStep(4, { race: { name: 'Gnome' } }, { racesData: [], classSubtypes: [], ruleset: '5e' });
        expect(errors).not.toHaveProperty('subrace');
      });
    });

    describe('Step 5: Background', () => {
      const validFormData = { name: 'Test', level: 1, alignment: 'Good' };

      it('requires a background for 2024 but not 5e, and accepts a present background for 2024', async () => {
        expect(await utils.validateStep(5, validFormData, { racesData: [], classSubtypes: [], ruleset: '2024' })).toHaveProperty('background');
        expect(await utils.validateStep(5, validFormData, { racesData: [], classSubtypes: [], ruleset: '5e' })).not.toHaveProperty('background');
        expect(await utils.validateStep(5, { ...validFormData, background: 'Fighter' }, { racesData: [], classSubtypes: [], ruleset: '2024' })).not.toHaveProperty('background');
      });
    });

    describe('Step 6: Class', () => {
      it('returns an error when class is missing or has no name, and does not require a subclass', async () => {
        expect(await utils.validateStep(6, {}, { racesData: [], classSubtypes: [], ruleset: '5e' })).toHaveProperty('class');
        expect(await utils.validateStep(6, { class: {} }, { racesData: [], classSubtypes: [], ruleset: '5e' })).toHaveProperty('class');
        const classSubtypes = [{ className: 'Fighter', subtypes: [{ name: 'Champion' }] }];
        const formData = { class: { name: 'Fighter' } };
        const errors = await utils.validateStep(6, formData, { racesData: [], classSubtypes, ruleset: '5e' });
        expect(errors).not.toHaveProperty('subclass');
      });
    });

    describe('Step 7: Subclass', () => {
      it('requires a subclass when the class has subclasses, accepts a selected subclass, and skips when the class has none, is not found, or is missing', async () => {
        const classSubtypesWithSubclasses = [{ className: 'Fighter', subtypes: [{ name: 'Champion' }, { name: 'Battle Master' }] }];
        const classSubtypesEmpty = [{ className: 'Fighter', subtypes: [] }];
        const formData = { class: { name: 'Fighter' } };
        const formDataWithSubclass = { class: { name: 'Fighter', subclass: { name: 'Champion' } } };
        const noClassForm = { class: {} };

        let errors = await utils.validateStep(7, formData, { racesData: [], classSubtypes: classSubtypesWithSubclasses, ruleset: '5e' });
        expect(errors).toHaveProperty('subclass');

        errors = await utils.validateStep(7, formDataWithSubclass, { racesData: [], classSubtypes: classSubtypesWithSubclasses, ruleset: '5e' });
        expect(errors).not.toHaveProperty('subclass');

        errors = await utils.validateStep(7, formData, { racesData: [], classSubtypes: classSubtypesEmpty, ruleset: '5e' });
        expect(errors).not.toHaveProperty('subclass');

        errors = await utils.validateStep(7, { class: { name: 'Rogue' } }, { racesData: [], classSubtypes: [], ruleset: '5e' });
        expect(errors).not.toHaveProperty('subclass');

        errors = await utils.validateStep(7, noClassForm, { racesData: [], classSubtypes: classSubtypesWithSubclasses, ruleset: '5e' });
        expect(errors).not.toHaveProperty('subclass');
      });
    });

    describe('Unhandled steps', () => {
      it('returns no errors for unrecognized step numbers', async () => {
        expect(await utils.validateStep(99, {}, { racesData: [], classSubtypes: [], ruleset: '5e' })).toEqual({});
        expect(await utils.validateStep(1, {}, { racesData: [], classSubtypes: [], ruleset: '5e' })).toEqual({});
        expect(await utils.validateStep(8, {}, { racesData: [], classSubtypes: [], ruleset: '5e' })).toEqual({});
      });
    });
  });
});
