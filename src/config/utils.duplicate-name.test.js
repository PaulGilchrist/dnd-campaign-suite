// @improved-by-ai
// Regression tests for the character-creation wizard duplicate-name gate:
// Step 2 validation and final-submit validation must reject names that
// collide case-insensitively (and whitespace-insensitively) with existing
// campaign characters ("A character with that name already exists"),
// mirroring the NPCs/Quests/Factions client guards, instead of letting the
// wizard POST an overwrite. The error text is pinned as a literal (never
// imported) so accidentally changing the message breaks these tests.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as dataLoader from '../services/ui/dataLoader.js';
import * as utils from './utils.js';

const DUPLICATE_ERROR = 'A character with that name already exists';
const REQUIRED_NAME_ERROR = 'Character name is required';

// Step 2 only reads level_range (via validateLevel); keeping the mock to
// exactly that makes it explicit the duplicate guard is rules-independent.
const MOCK_VALIDATION_RULES = {
  level_range: { min: 1, max: 20 },
};

const stepContext = (overrides = {}) => ({
  racesData: [],
  classSubtypes: [],
  ruleset: '5e',
  ...overrides,
});

describe('character-creation duplicate-name guard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hasDuplicateCharacterName', () => {
    it('matches existing names case-insensitively and trims whitespace on both sides', () => {
      expect(utils.hasDuplicateCharacterName('AasimarTest', ['aasimartest'])).toBe(true);
      expect(utils.hasDuplicateCharacterName('  aasimarTEST  ', ['AasimarTest'])).toBe(true);
      expect(utils.hasDuplicateCharacterName('  AasimarTest  ', [' AasimarTest '])).toBe(true);
      expect(utils.hasDuplicateCharacterName('FreshName', ['AasimarTest'])).toBe(false);
    });

    it('never flags empty, whitespace-only, or falsy names against a populated list', () => {
      for (const name of ['', '   ', undefined, null, 0]) {
        expect(utils.hasDuplicateCharacterName(name, ['AasimarTest'])).toBe(false);
      }
    });

    it('never flags a name when no existing names are supplied and tolerates blank entries in the list', () => {
      expect(utils.hasDuplicateCharacterName('AasimarTest')).toBe(false);
      expect(utils.hasDuplicateCharacterName('AasimarTest', [])).toBe(false);
      expect(utils.hasDuplicateCharacterName('AasimarTest', [null, undefined, '', 'AasimarTest'])).toBe(true);
      expect(utils.hasDuplicateCharacterName('FreshName', [null, undefined, '', '   '])).toBe(false);
    });
  });

  describe('validateStep 2 (Basic Information)', () => {
    beforeEach(() => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(MOCK_VALIDATION_RULES);
    });

    const validFormData = { name: 'AasimarTest', level: 1, alignment: 'Good' };

    it('rejects a duplicate character name with the canonical message and no unrelated errors', async () => {
      const errors = await utils.validateStep(2, validFormData, stepContext({
        existingNames: ['ElderPaladin', 'aasimartest'],
      }));
      expect(errors).toEqual({ name: DUPLICATE_ERROR });
    });

    it('flags a duplicate that only collides after case-folding and trimming', async () => {
      const errors = await utils.validateStep(2, { ...validFormData, name: '  aasimarTEST  ' }, stepContext({
        existingNames: ['AasimarTest'],
      }));
      expect(errors).toEqual({ name: DUPLICATE_ERROR });
    });

    it('accepts a unique name while other fields stay valid', async () => {
      const errors = await utils.validateStep(2, { ...validFormData, name: 'BrandNewHero' }, stepContext({
        existingNames: ['AasimarTest'],
      }));
      expect(errors).toEqual({});
    });

    it('accepts any valid name when the campaign has no existing characters (names omitted or empty)', async () => {
      await expect(utils.validateStep(2, validFormData, stepContext({ existingNames: [] }))).resolves.toEqual({});
      await expect(utils.validateStep(2, validFormData, stepContext())).resolves.toEqual({});
      await expect(utils.validateStep(2, validFormData)).resolves.toEqual({});
    });

    it('keeps the required-name error precedence over the duplicate error, even if blank strings are in the list', async () => {
      const errors = await utils.validateStep(2, { name: '   ', level: 1, alignment: 'Good' }, stepContext({
        existingNames: ['   ', 'AasimarTest'],
      }));
      expect(errors).toEqual({ name: REQUIRED_NAME_ERROR });
    });

    it('gates duplicates identically for the 2024 ruleset', async () => {
      const errors = await utils.validateStep(2, validFormData, stepContext({
        ruleset: '2024',
        existingNames: ['AasimarTest'],
      }));
      expect(errors).toEqual({ name: DUPLICATE_ERROR });
    });
  });

  describe('validateFinalFormData', () => {
    const COMPLETE_FORM_DATA = {
      name: 'AasimarTest',
      level: 1,
      alignment: 'Lawful Good',
      race: { name: 'Human' },
      class: { name: 'Wizard' },
      expertSkills: [],
    };

    it('rejects a duplicate name on final submit validation', () => {
      const errors = utils.validateFinalFormData(COMPLETE_FORM_DATA, ['aasimartest']);
      expect(errors).toEqual({ name: DUPLICATE_ERROR });
    });

    it('matches duplicates case- and whitespace-insensitively on final submit', () => {
      expect(utils.validateFinalFormData({ ...COMPLETE_FORM_DATA, name: '  AASIMARTEST ' }, ['AasimarTest']))
        .toEqual({ name: DUPLICATE_ERROR });
      expect(utils.validateFinalFormData(COMPLETE_FORM_DATA, ['  aasimarTest ']))
        .toEqual({ name: DUPLICATE_ERROR });
    });

    it('accepts a unique name, including when no existing names are supplied', () => {
      expect(utils.validateFinalFormData(COMPLETE_FORM_DATA, ['ElderPaladin'])).toEqual({});
      expect(utils.validateFinalFormData(COMPLETE_FORM_DATA)).toEqual({});
      expect(utils.validateFinalFormData(COMPLETE_FORM_DATA, [])).toEqual({});
    });

    it('reports the required-name error (not a duplicate) for a blank name, even against blank existing names', () => {
      const errors = utils.validateFinalFormData({ ...COMPLETE_FORM_DATA, name: '   ' }, ['   ', 'AasimarTest']);
      expect(errors).toHaveProperty('name', 'name is required');
    });

    it('surfaces the duplicate error alongside other missing required fields without shadowing them', () => {
      const formWithoutAlignment = { ...COMPLETE_FORM_DATA };
      delete formWithoutAlignment.alignment;
      const errors = utils.validateFinalFormData(formWithoutAlignment, ['AasimarTest']);
      expect(errors).toHaveProperty('name', DUPLICATE_ERROR);
      expect(errors).toHaveProperty('alignment');
    });
  });
});
