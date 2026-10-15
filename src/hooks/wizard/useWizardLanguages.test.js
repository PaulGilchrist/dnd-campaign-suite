// @maintained-by-ai
// useWizardLanguages is a thin config wrapper over useWizardConfig (whose engine
// behaviour — validateFn/getDeps invocation, slot resolution, preSelectedKey
// population, warnings — is owned by useWizardConfig.test.js). That engine is MOCKED
// here, so engine round-trips (null/empty pass-through) run nothing and are omitted.
// This file keeps only what it owns: the languages+fighting-styles wiring contract
// (two limit slots, getter identity, deps selector) and the one return-key rename
// (warnings → languageWarnings). Pure mocks, synchronous, deterministic — no churn
// expected as the app changes.
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

function renderLanguages(formData = DEFAULT_FORM_DATA) {
  return renderHook(() => useWizardLanguages(formData));
}

function getConfig() {
  return useWizardConfig.mock.calls[0][0];
}

describe('useWizardLanguages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWizardConfig.mockReturnValue({
      languageLimits: { maxLanguages: 2, preSelected: ['Common'] },
      fightingStyleLimits: { maxStyles: 1, preSelected: [] },
      warnings: [],
      preSelectedLanguages: ['Common'],
      preSelectedFightingStyles: [],
      setWarnings: vi.fn(),
    });
  });

  describe('useWizardConfig wiring', () => {
    it('passes the languages config (formData, validateFn, two limit slots with getter/state-key/preSelectedKey, deps selector) to useWizardConfig', () => {
      renderLanguages();
      const config = getConfig();

      expect(config.formData).toBe(DEFAULT_FORM_DATA);
      expect(config.validateFn).toBe(validateLanguagesAndFightingStyles);

      expect(config.slots).toHaveLength(2);
      expect(config.slots[0].get).toBe(getLanguageLimits);
      expect(config.slots[0].state).toEqual({ initial: null, key: 'languageLimits' });
      expect(config.slots[0].isLimit).toBe(true);
      expect(config.slots[0].preSelectedKey).toBe('preSelectedLanguages');

      expect(config.slots[1].get).toBe(getFightingStyleLimits);
      expect(config.slots[1].state).toEqual({ initial: null, key: 'fightingStyleLimits' });
      expect(config.slots[1].isLimit).toBe(true);
      expect(config.slots[1].preSelectedKey).toBe('preSelectedFightingStyles');

      expect(config.getDeps(DEFAULT_FORM_DATA)).toEqual([
        ['Common'],
        ['Defense'],
        'Fighter',
        'Human',
        'Soldier',
        '5e',
        1,
      ]);
    });
  });

  describe('return value', () => {
    it('returns the engine values, renaming warnings to languageWarnings', () => {
      useWizardConfig.mockReturnValue({
        languageLimits: { maxLanguages: 2, preSelected: ['Common'] },
        fightingStyleLimits: { maxStyles: 1, preSelected: ['Defense'] },
        warnings: [{ message: 'Too many languages', type: 'warning' }],
        preSelectedLanguages: ['Common'],
        preSelectedFightingStyles: ['Defense'],
        setWarnings: vi.fn(),
      });
      const { result } = renderLanguages();
      expect(Object.keys(result.current)).toEqual([
        'languageLimits',
        'fightingStyleLimits',
        'languageWarnings',
        'preSelectedLanguages',
        'preSelectedFightingStyles',
      ]);
      // The only transformation this hook performs: warnings → languageWarnings.
      expect(result.current.languageWarnings).toEqual([{ message: 'Too many languages', type: 'warning' }]);
      expect(result.current.languageLimits).toEqual({ maxLanguages: 2, preSelected: ['Common'] });
      expect(result.current.fightingStyleLimits).toEqual({ maxStyles: 1, preSelected: ['Defense'] });
      expect(result.current.preSelectedLanguages).toEqual(['Common']);
      expect(result.current.preSelectedFightingStyles).toEqual(['Defense']);
    });
  });

  describe('getDeps deps selector', () => {
    it('guards missing nested class/race fields via optional chaining (no throw, undefined slots)', () => {
      renderLanguages({});
      expect(getConfig().getDeps({})).toEqual([
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ]);

      // Present top-level languages is preserved while absent nested fields stay undefined.
      expect(getConfig().getDeps({ languages: ['Common'] })).toEqual([
        ['Common'],
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ]);
    });
  });
});
