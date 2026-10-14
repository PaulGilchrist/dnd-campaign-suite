import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardLanguages from './useWizardLanguages.js';
import useWizardConfig from './useWizardConfig.js';
import {
  getLanguageLimits,
  getFightingStyleLimits,
  validateLanguagesAndFightingStyles,
} from '../../services/character/languagesFightingstylesValidation.js';

vi.mock('./useWizardConfig.js', () => ({
  default: vi.fn(),
}));

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
    setWarnings: vi.fn(),
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
    it('passes validateLanguagesAndFightingStyles as validateFn', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.validateFn).toBe(validateLanguagesAndFightingStyles);
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

    it('passes formData to useWizardConfig', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.formData).toBe(DEFAULT_FORM_DATA);
    });

    it('configures two limit slots with correct state keys', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.slots).toHaveLength(2);
      expect(config.slots[0].state.key).toBe('languageLimits');
      expect(config.slots[1].state.key).toBe('fightingStyleLimits');
      expect(config.slots[0].isLimit).toBe(true);
      expect(config.slots[1].isLimit).toBe(true);
    });

    it('configures preSelectedKey on each slot', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.slots[0].preSelectedKey).toBe('preSelectedLanguages');
      expect(config.slots[1].preSelectedKey).toBe('preSelectedFightingStyles');
    });
  });

  describe('return value', () => {
    it('forwards all properties from useWizardConfig', () => {
      const { result } = renderLanguages();
      expect(result.current.languageLimits).toEqual(defaultConfigResult().languageLimits);
      expect(result.current.fightingStyleLimits).toEqual(defaultConfigResult().fightingStyleLimits);
      expect(result.current.languageWarnings).toEqual(defaultConfigResult().warnings);
      expect(result.current.preSelectedLanguages).toEqual(defaultConfigResult().preSelectedLanguages);
      expect(result.current.preSelectedFightingStyles).toEqual(defaultConfigResult().preSelectedFightingStyles);
    });

    it('aliases warnings from useWizardConfig as languageWarnings', () => {
      useWizardConfig.mockReturnValue({
        ...defaultConfigResult(),
        warnings: [{ message: 'Too many languages', type: 'warning' }],
      });
      const { result } = renderLanguages();
      expect(result.current.languageWarnings).toEqual([{ message: 'Too many languages', type: 'warning' }]);
    });

    it('returns null for limits when useWizardConfig returns null', () => {
      useWizardConfig.mockReturnValue({
        languageLimits: null,
        fightingStyleLimits: null,
        warnings: [],
        preSelectedLanguages: [],
        preSelectedFightingStyles: [],
        setWarnings: vi.fn(),
      });
      const { result } = renderLanguages();
      expect(result.current.languageLimits).toBeNull();
      expect(result.current.fightingStyleLimits).toBeNull();
    });

    it('returns empty arrays when useWizardConfig returns them', () => {
      useWizardConfig.mockReturnValue({
        languageLimits: null,
        fightingStyleLimits: null,
        warnings: [],
        preSelectedLanguages: [],
        preSelectedFightingStyles: [],
        setWarnings: vi.fn(),
      });
      const { result } = renderLanguages();
      expect(result.current.preSelectedLanguages).toEqual([]);
      expect(result.current.preSelectedFightingStyles).toEqual([]);
    });
  });

  describe('getDeps callback', () => {
    it('extracts the correct dependency fields from formData', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      const deps = config.getDeps(DEFAULT_FORM_DATA);
      expect(deps).toEqual([
        DEFAULT_FORM_DATA.languages,
        DEFAULT_FORM_DATA.class.fightingStyles,
        DEFAULT_FORM_DATA.class.name,
        DEFAULT_FORM_DATA.race.name,
        DEFAULT_FORM_DATA.background,
        DEFAULT_FORM_DATA.rules,
        DEFAULT_FORM_DATA.level,
      ]);
    });

    it('returns undefined for missing fields via optional chaining', () => {
      const minimalFormData = {};
      renderLanguages(minimalFormData);
      const config = useWizardConfig.mock.calls[0][0];
      const deps = config.getDeps(minimalFormData);
      expect(deps).toEqual([undefined, undefined, undefined, undefined, undefined, undefined, undefined]);
    });

    it('returns undefined for nested fields when only top-level keys exist', () => {
      const partialFormData = { languages: ['Common'] };
      renderLanguages(partialFormData);
      const config = useWizardConfig.mock.calls[0][0];
      const deps = config.getDeps(partialFormData);
      expect(deps[0]).toEqual(['Common']);
      expect(deps[1]).toBeUndefined();
      expect(deps[2]).toBeUndefined();
      expect(deps[3]).toBeUndefined();
    });
  });
});
