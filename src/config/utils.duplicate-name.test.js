// Regression tests for the character-creation wizard duplicate-name gate:
// Step 2 validation must reject names that collide case-insensitively with
// existing campaign characters ("A character with that name already exists"),
// mirroring the NPCs/Quests/Factions client guards, instead of letting the
// wizard POST an overwrite.
import { describe, it, expect, vi, afterEach } from 'vitest';
import * as dataLoader from '../services/ui/dataLoader.js';
import * as utils from './utils.js';

const MOCK_VALIDATION_RULES = {
  level_range: { min: 1, max: 20 },
  point_buy: {
    min_base_score: 8,
    max_base_score: 15,
    max_total_score: 20,
    costs: { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 },
  },
  ability_score_max: { standard: 20, level_20: 24 },
};

describe('character-creation duplicate-name guard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('hasDuplicateCharacterName', () => {
    it('matches existing names case-insensitively and trims whitespace', () => {
      expect(utils.hasDuplicateCharacterName('AasimarTest', ['aasimartest'])).toBe(true);
      expect(utils.hasDuplicateCharacterName('  AasimarTest  ', [' AasimarTest '])).toBe(true);
      expect(utils.hasDuplicateCharacterName('FreshName', ['AasimarTest'])).toBe(false);
    });

    it('never flags empty or whitespace-only names', () => {
      expect(utils.hasDuplicateCharacterName('', ['AasimarTest'])).toBe(false);
      expect(utils.hasDuplicateCharacterName('   ', ['AasimarTest'])).toBe(false);
      expect(utils.hasDuplicateCharacterName(undefined, ['AasimarTest'])).toBe(false);
    });
  });

  describe('validateStep 2 (Basic Information)', () => {
    beforeEach(() => {
      vi.spyOn(dataLoader, 'loadValidationRules').mockResolvedValue(MOCK_VALIDATION_RULES);
    });

    const validFormData = { name: 'AasimarTest', level: 1, alignment: 'Good' };

    it('rejects a duplicate character name with the canonical message', async () => {
      const errors = await utils.validateStep(2, validFormData, {
        racesData: [], classSubtypes: [], ruleset: '5e',
        existingNames: ['ElderPaladin', 'aasimartest'],
      });
      expect(errors).toHaveProperty('name', 'A character with that name already exists');
    });

    it('accepts a unique name', async () => {
      const errors = await utils.validateStep(2, { ...validFormData, name: 'BrandNewHero' }, {
        racesData: [], classSubtypes: [], ruleset: '5e',
        existingNames: ['AasimarTest'],
      });
      expect(errors).toEqual({});
    });

    it('keeps the required-name error precedence over the duplicate error', async () => {
      const errors = await utils.validateStep(2, { name: '   ', level: 1, alignment: 'Good' }, {
        racesData: [], classSubtypes: [], ruleset: '5e',
        existingNames: ['AasimarTest'],
      });
      expect(errors).toHaveProperty('name', 'Character name is required');
    });

    it('works identically for the 2024 ruleset', async () => {
      const errors = await utils.validateStep(2, validFormData, {
        racesData: [], classSubtypes: [], ruleset: '2024',
        existingNames: ['AasimarTest'],
      });
      expect(errors).toHaveProperty('name', 'A character with that name already exists');
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
      const errors = utils.validateFinalFormData(COMPLETE_FORM_DATA, ['AasimarTest']);
      expect(errors).toHaveProperty('name', 'A character with that name already exists');
    });

    it('accepts a unique name on final submit validation', () => {
      const errors = utils.validateFinalFormData(COMPLETE_FORM_DATA, ['ElderPaladin']);
      expect(errors).toEqual({});
    });
  });
});
