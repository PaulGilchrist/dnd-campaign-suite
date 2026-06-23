// @improved-by-ai
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardLanguages from './useWizardLanguages.js';
import useWizardConfig from './useWizardConfig.js';

// Mock useWizardConfig so we test useWizardLanguages as a unit,
// not the internals of useWizardConfig (which has its own test suite).
vi.mock('./useWizardConfig.js', () => ({
  default: vi.fn(),
}));

describe('useWizardLanguages', () => {
  const mockFormData = {
    class: { name: 'Fighter', fightingStyles: ['Defense'] },
    race: { name: 'Human' },
    background: 'Soldier',
    languages: ['Common'],
    rules: '5e',
    level: 1,
  };

  const mockConfigReturn = {
    languageLimits: { maxLanguages: 2, preSelected: ['Common'] },
    fightingStyleLimits: { maxStyles: 1, preSelected: [] },
    warnings: [],
    preSelectedLanguages: ['Common'],
    preSelectedFightingStyles: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useWizardConfig.mockReturnValue(mockConfigReturn);
  });

  function renderLanguages(formData) {
    return renderHook(() => useWizardLanguages(formData ?? mockFormData));
  }

  describe('return value', () => {
    it('returns languageLimits from useWizardConfig', () => {
      const { result } = renderLanguages();
      expect(result.current.languageLimits).toEqual(mockConfigReturn.languageLimits);
    });

    it('returns fightingStyleLimits from useWizardConfig', () => {
      const { result } = renderLanguages();
      expect(result.current.fightingStyleLimits).toEqual(mockConfigReturn.fightingStyleLimits);
    });

    it('returns languageWarnings as the warnings array from useWizardConfig', () => {
      const { result } = renderLanguages();
      expect(result.current.languageWarnings).toEqual(mockConfigReturn.warnings);
    });

    it('returns preSelectedLanguages from useWizardConfig', () => {
      const { result } = renderLanguages();
      expect(result.current.preSelectedLanguages).toEqual(mockConfigReturn.preSelectedLanguages);
    });

    it('returns preSelectedFightingStyles from useWizardConfig', () => {
      const { result } = renderLanguages();
      expect(result.current.preSelectedFightingStyles).toEqual(mockConfigReturn.preSelectedFightingStyles);
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

    it('passes through non-empty warnings from useWizardConfig', () => {
      const mockWarnings = [
        { message: 'Too many languages selected', type: 'warning' },
        { message: 'Consider selecting a fighting style', type: 'info' },
      ];
      useWizardConfig.mockReturnValue({
        ...mockConfigReturn,
        warnings: mockWarnings,
      });

      const { result } = renderLanguages();
      expect(result.current.languageWarnings).toEqual(mockWarnings);
    });
  });

  describe('useWizardConfig integration', () => {
    it('calls useWizardConfig with the formData argument', () => {
      renderLanguages();
      expect(useWizardConfig).toHaveBeenCalledWith(expect.objectContaining({ formData: mockFormData }));
    });

    it('passes a validateFn to useWizardConfig', () => {
      renderLanguages();
      const configArg = useWizardConfig.mock.calls[0][0];
      expect(typeof configArg.validateFn).toBe('function');
    });

    it('passes a slots array to useWizardConfig', () => {
      renderLanguages();
      const configArg = useWizardConfig.mock.calls[0][0];
      expect(Array.isArray(configArg.slots)).toBe(true);
      expect(configArg.slots).toHaveLength(2);
    });

    it('passes a getDeps function to useWizardConfig', () => {
      renderLanguages();
      const configArg = useWizardConfig.mock.calls[0][0];
      expect(typeof configArg.getDeps).toBe('function');
    });

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
      const configArg = useWizardConfig.mock.calls[0][0];
      expect(configArg.formData.rules).toBe('2024');
    });

    it('handles missing optional formData fields', () => {
      const minimalFormData = { class: {}, race: {}, languages: [], rules: '5e', level: 1 };
      renderLanguages(minimalFormData);
      const configArg = useWizardConfig.mock.calls[0][0];
      expect(configArg.formData).toEqual(minimalFormData);
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
      const configArg = useWizardConfig.mock.calls[0][0];
      expect(configArg.formData.class.fightingStyles).toBeUndefined();
    });
  });
});
