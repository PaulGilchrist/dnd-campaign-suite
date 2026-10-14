// @maintained-by-ai: 2026-10-14
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

describe('character-creation duplicate-name guard', () => {
  describe('hasDuplicateCharacterName', () => {
    it('matches existing names case- and whitespace-insensitively', () => {
      for (const name of ['AasimarTest', 'aasimartest', '  AASIMARTEST  ']) {
        expect(utils.hasDuplicateCharacterName(name, ['  AasimarTest '])).toBe(true);
      }
      expect(utils.hasDuplicateCharacterName('FreshName', ['AasimarTest'])).toBe(false);
    });

    it('tolerates blank names and blank list entries: never flags without a real collision', () => {
      for (const name of ['', '   ', undefined, null, 0]) {
        expect(utils.hasDuplicateCharacterName(name, ['AasimarTest'])).toBe(false);
      }
      expect(utils.hasDuplicateCharacterName('AasimarTest')).toBe(false);
      expect(utils.hasDuplicateCharacterName('FreshName', [null, undefined, '', '   '])).toBe(false);
      expect(utils.hasDuplicateCharacterName('AasimarTest', [null, undefined, '', 'AasimarTest'])).toBe(true);
    });
  });

  describe('validateStep 2 (Basic Information)', () => {
    // Step 2 only reads level_range (via validateLevel); mocking exactly
    // that (matching rules-validation.json) keeps the duplicate guard
    // hermetic and shows it is rules-independent.
    beforeEach(() => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue({
        level_range: { min: 1, max: 20 },
      });
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    const validFormData = { name: 'AasimarTest', level: 1, alignment: 'Good' };
    const stepContext = (overrides = {}) => ({ ruleset: '5e', ...overrides });

    it('rejects a duplicate name with the canonical error and no unrelated errors, for both rulesets', async () => {
      const errors = await utils.validateStep(2, validFormData, stepContext({
        existingNames: ['ElderPaladin', '  aasimarTEST  '],
      }));
      expect(errors).toEqual({ name: DUPLICATE_ERROR });
      const errors2024 = await utils.validateStep(2, validFormData, stepContext({
        ruleset: '2024',
        existingNames: ['AasimarTest'],
      }));
      expect(errors2024).toEqual({ name: DUPLICATE_ERROR });
    });

    it('accepts a unique name, with, without, or amid existing characters', async () => {
      const unique = { ...validFormData, name: 'BrandNewHero' };
      await expect(utils.validateStep(2, unique)).resolves.toEqual({});
      for (const ctx of [{}, { existingNames: [] }, { existingNames: ['AasimarTest'] }]) {
        await expect(utils.validateStep(2, unique, stepContext(ctx))).resolves.toEqual({});
      }
    });

    it('keeps the required-name error precedence over the duplicate error, even if blank strings are in the list', async () => {
      const errors = await utils.validateStep(2, { name: '   ', level: 1, alignment: 'Good' }, stepContext({
        existingNames: ['   ', 'AasimarTest'],
      }));
      expect(errors).toEqual({ name: REQUIRED_NAME_ERROR });
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

    it('rejects a duplicate name case- and whitespace-insensitively on final submit', () => {
      expect(utils.validateFinalFormData(COMPLETE_FORM_DATA, ['aasimartest'])).toEqual({ name: DUPLICATE_ERROR });
      expect(utils.validateFinalFormData({ ...COMPLETE_FORM_DATA, name: '  AASIMARTEST ' }, ['AasimarTest']))
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
