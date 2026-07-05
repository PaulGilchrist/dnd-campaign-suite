// @cleaned-by-ai
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
    it('passes the correct validateFn and slot getters to useWizardConfig', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.validateFn).toBe(validateLanguagesAndFightingStyles);
      expect(config.slots[0].get).toBe(getLanguageLimits);
      expect(config.slots[1].get).toBe(getFightingStyleLimits);
    });

    it('passes formData to useWizardConfig', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.formData).toBe(DEFAULT_FORM_DATA);
    });

    it('does not pass setFormData to useWizardConfig', () => {
      renderLanguages();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config).not.toHaveProperty('setFormData');
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

    it('aliases warnings as languageWarnings, not warnings', () => {
      const { result } = renderLanguages();
      expect(result.current).not.toHaveProperty('warnings');
      expect(result.current).toHaveProperty('languageWarnings');
    });

    it('does not return extra properties', () => {
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

    it('passes through non-empty warnings', () => {
      useWizardConfig.mockReturnValue({
        ...defaultConfigResult(),
        warnings: [{ message: 'Too many languages', type: 'warning' }],
      });
      const { result } = renderLanguages();
      expect(result.current.languageWarnings).toEqual([{ message: 'Too many languages', type: 'warning' }]);
    });
  });

  describe('null handling', () => {
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
  });

  describe('reactivity', () => {
    it('re-calls useWizardConfig when formData changes', () => {
      const { rerender } = renderLanguages();
      expect(useWizardConfig).toHaveBeenCalledTimes(1);
      rerender();
      expect(useWizardConfig).toHaveBeenCalledTimes(2);
    });
  });
});
