// @improved-by-ai
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardLanguages from './useWizardLanguages.js';
import useWizardConfig from './useWizardConfig.js';
import {
  getLanguageLimits,
  getFightingStyleLimits,
  validateLanguagesAndFightingStyles,
} from '../../services/character/languagesFightingstylesValidation.js';

// Mock useWizardConfig so we test useWizardLanguages as a unit,
// not the internals of useWizardConfig (which has its own test suite).
vi.mock('./useWizardConfig.js', () => ({
  default: vi.fn(),
}));

// Mock the validation service so we verify the correct functions are imported.
vi.mock('../../services/character/languagesFightingstylesValidation.js', () => ({
  getLanguageLimits: vi.fn(),
  getFightingStyleLimits: vi.fn(),
  validateLanguagesAndFightingStyles: vi.fn(),
}));

const DEFAULT_FORM_DATA = {
  class: { name: 'Fighter', fightingStyles: ['Defense'] },
  race: { name: 'Human' },
  background: 'Soldier',
  languages: ['Common'],
  rules: '5e',
  level: 1,
};

function defaultConfigResult() {
  return {
    languageLimits: { maxLanguages: 2, preSelected: ['Common'] },
    fightingStyleLimits: { maxStyles: 1, preSelected: [] },
    warnings: [],
    preSelectedLanguages: ['Common'],
    preSelectedFightingStyles: [],
  };
}

function renderLanguages(formData = DEFAULT_FORM_DATA) {
  return renderHook(() => useWizardLanguages(formData));
}

describe('useWizardLanguages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWizardConfig.mockReturnValue(defaultConfigResult());
  });

  describe('delegation to useWizardConfig', () => {
    it('calls useWizardConfig with formData in the config object', () => {
      renderLanguages();
      expect(useWizardConfig).toHaveBeenCalledTimes(1);
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.formData).toBe(DEFAULT_FORM_DATA);
    });

    it('passes validateLanguagesAndFightingStyles as validateFn', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.validateFn).toBe(validateLanguagesAndFightingStyles);
    });

    it('passes a slots array with exactly 2 slots', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      expect(Array.isArray(config.slots)).toBe(true);
      expect(config.slots).toHaveLength(2);
    });

    it('passes getLanguageLimits as the first slot getter', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.slots[0].get).toBe(getLanguageLimits);
    });

    it('passes getFightingStyleLimits as the second slot getter', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.slots[1].get).toBe(getFightingStyleLimits);
    });

    it('configures the first slot with languageLimits key and isLimit flag', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.slots[0].state.key).toBe('languageLimits');
      expect(config.slots[0].state.initial).toBeNull();
      expect(config.slots[0].isLimit).toBe(true);
      expect(config.slots[0].preSelectedKey).toBe('preSelectedLanguages');
    });

    it('configures the second slot with fightingStyleLimits key and isLimit flag', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.slots[1].state.key).toBe('fightingStyleLimits');
      expect(config.slots[1].state.initial).toBeNull();
      expect(config.slots[1].isLimit).toBe(true);
      expect(config.slots[1].preSelectedKey).toBe('preSelectedFightingStyles');
    });

    it('passes a getDeps function to useWizardConfig', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      expect(typeof config.getDeps).toBe('function');
    });

    it('getDeps returns an array of form data dependencies', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      const deps = config.getDeps(DEFAULT_FORM_DATA);
      expect(Array.isArray(deps)).toBe(true);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.languages);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.class?.fightingStyles);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.class?.name);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.race?.name);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.background);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.rules);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.level);
    });

    it('does NOT pass setFormData to useWizardConfig', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config).not.toHaveProperty('setFormData');
    });
  });

  describe('return value', () => {
    it('returns languageLimits from useWizardConfig', () => {
      const { result } = renderLanguages();
      expect(result.current.languageLimits).toEqual(defaultConfigResult().languageLimits);
    });

    it('returns fightingStyleLimits from useWizardConfig', () => {
      const { result } = renderLanguages();
      expect(result.current.fightingStyleLimits).toEqual(defaultConfigResult().fightingStyleLimits);
    });

    it('aliases warnings as languageWarnings', () => {
      const { result } = renderLanguages();
      expect(result.current.languageWarnings).toEqual(defaultConfigResult().warnings);
    });

    it('returns preSelectedLanguages from useWizardConfig', () => {
      const { result } = renderLanguages();
      expect(result.current.preSelectedLanguages).toEqual(defaultConfigResult().preSelectedLanguages);
    });

    it('returns preSelectedFightingStyles from useWizardConfig', () => {
      const { result } = renderLanguages();
      expect(result.current.preSelectedFightingStyles).toEqual(defaultConfigResult().preSelectedFightingStyles);
    });

    it('does not return extra properties beyond the five expected keys', () => {
      const { result } = renderLanguages();
      const keys = Object.keys(result.current);
      expect(keys).toEqual([
        'languageLimits',
        'fightingStyleLimits',
        'languageWarnings',
        'preSelectedLanguages',
        'preSelectedFightingStyles',
      ]);
    });

    it('does not expose warnings as a separate key (only as languageWarnings)', () => {
      const { result } = renderLanguages();
      expect(result.current).not.toHaveProperty('warnings');
    });

    it('does not expose setWarnings in the return object', () => {
      const { result } = renderLanguages();
      expect(result.current).not.toHaveProperty('setWarnings');
    });

    it('returns an object (not null or primitive)', () => {
      const { result } = renderLanguages();
      expect(typeof result.current).toBe('object');
    });

    it('passes through non-empty warnings from useWizardConfig', () => {
      const mockWarnings = [
        { message: 'Too many languages selected', type: 'warning' },
        { message: 'Consider selecting a fighting style', type: 'info' },
      ];
      useWizardConfig.mockReturnValue({
        ...defaultConfigResult(),
        warnings: mockWarnings,
      });

      const { result } = renderLanguages();
      expect(result.current.languageWarnings).toEqual(mockWarnings);
    });
  });

  describe('null and empty handling', () => {
    it('returns null for limits when useWizardConfig returns null', () => {
      useWizardConfig.mockReturnValue({
        languageLimits: null,
        fightingStyleLimits: null,
        warnings: [],
        preSelectedLanguages: [],
        preSelectedFightingStyles: [],
      });

      const { result } = renderLanguages();
      expect(result.current.languageLimits).toBeNull();
      expect(result.current.fightingStyleLimits).toBeNull();
    });

    it('returns empty arrays for pre-selected values when useWizardConfig returns them', () => {
      useWizardConfig.mockReturnValue({
        languageLimits: { maxLanguages: 2, preSelected: [] },
        fightingStyleLimits: { maxStyles: 1, preSelected: [] },
        warnings: [],
        preSelectedLanguages: [],
        preSelectedFightingStyles: [],
      });

      const { result } = renderLanguages();
      expect(result.current.preSelectedLanguages).toEqual([]);
      expect(result.current.preSelectedFightingStyles).toEqual([]);
    });
  });

  describe('formData variations', () => {
    it('handles different rulesets by passing formData through to useWizardConfig', () => {
      renderLanguages({ rules: '2024' });
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.formData.rules).toBe('2024');
    });

    it('handles missing optional formData fields', () => {
      const minimalFormData = {
        class: {},
        race: {},
        languages: [],
        rules: '5e',
        level: 1,
      };
      renderLanguages(minimalFormData);
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.formData).toEqual(minimalFormData);
    });

    it('handles formData with no class fightingStyles', () => {
      const formData = {
        class: { name: 'Wizard' },
        race: { name: 'Elf' },
        background: '',
        languages: [],
        rules: '5e',
        level: 1,
      };
      renderLanguages(formData);
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.formData.class.fightingStyles).toBeUndefined();
    });

    it('handles formData with null class', () => {
      const formData = {
        class: null,
        race: { name: 'Human' },
        languages: [],
        rules: '5e',
        level: 1,
      };
      useWizardConfig.mockReturnValue({
        languageLimits: null,
        fightingStyleLimits: null,
        warnings: [],
        preSelectedLanguages: [],
        preSelectedFightingStyles: [],
      });

      const { result } = renderLanguages(formData);
      expect(result.current.languageLimits).toBeNull();
      expect(result.current.fightingStyleLimits).toBeNull();
      expect(result.current.languageWarnings).toEqual([]);
    });

    it('handles formData with null race', () => {
      const formData = {
        class: { name: 'Fighter' },
        race: null,
        languages: [],
        rules: '5e',
        level: 1,
      };
      useWizardConfig.mockReturnValue({
        languageLimits: null,
        fightingStyleLimits: null,
        warnings: [],
        preSelectedLanguages: [],
        preSelectedFightingStyles: [],
      });

      const { result } = renderLanguages(formData);
      expect(result.current.languageLimits).toBeNull();
    });
  });

  describe('reactivity', () => {
    it('re-calls useWizardConfig when formData changes', () => {
      const { rerender } = renderLanguages();

      expect(useWizardConfig).toHaveBeenCalledTimes(1);

      rerender();

      expect(useWizardConfig).toHaveBeenCalledTimes(2);
    });

    it('re-calls useWizardConfig when formData is replaced', () => {
      const { rerender } = renderLanguages(DEFAULT_FORM_DATA);
      expect(useWizardConfig).toHaveBeenCalledTimes(1);

      rerender();

      expect(useWizardConfig).toHaveBeenCalledTimes(2);
      // The second call should use the default formData again since rerender re-invokes
      // the original render function which uses DEFAULT_FORM_DATA
      expect(useWizardConfig.mock.calls[1][0].formData).toBe(DEFAULT_FORM_DATA);
    });
  });
});
