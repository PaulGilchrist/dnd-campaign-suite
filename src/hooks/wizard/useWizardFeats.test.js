// @maintained-by-ai
// useWizardFeats is a thin config wrapper over useWizardConfig (whose engine
// behaviour is covered by useWizardConfig.test.js). This file keeps only what
// it owns: the wiring smoke test, the preSelectedFeats pass-through, and the
// feats-specific preSelect merge logic. Pure mocks, synchronous, deterministic —
// no churn expected as the app changes.
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardFeats from './useWizardFeats.js';

vi.mock('./useWizardConfig.js', () => ({
  default: vi.fn(),
}));

vi.mock('../../services/character/featValidation.js', () => ({
  getPreSelectedFeats: vi.fn(),
}));

import useWizardConfig from './useWizardConfig.js';
import { getPreSelectedFeats } from '../../services/character/featValidation.js';

const mockFormData = {
  background: 'Soldier',
  feats: [],
  rules: '5e',
};

describe('useWizardFeats', () => {
  const mockSetFormData = vi.fn();

  function renderFeats(formData = mockFormData, setFormDataFn = mockSetFormData, overrideConfig) {
    if (overrideConfig !== undefined) {
      useWizardConfig.mockReturnValue(overrideConfig);
    }
    return renderHook(() => useWizardFeats(formData, setFormDataFn));
  }

  function getConfig() {
    return useWizardConfig.mock.calls[0][0];
  }

  beforeEach(() => {
    vi.clearAllMocks();
    getPreSelectedFeats.mockResolvedValue([]);
    useWizardConfig.mockReturnValue({
      preSelectedFeats: [],
      warnings: [],
      setWarnings: vi.fn(),
    });
  });

  describe('useWizardConfig wiring', () => {
    it('passes the feats config (formData, setFormData, empty slots, background/rules deps, getPreSelectedFeats pre-select) to useWizardConfig', () => {
      renderFeats(mockFormData, mockSetFormData);
      const config = getConfig();

      expect(config.formData).toBe(mockFormData);
      expect(config.setFormData).toBe(mockSetFormData);
      expect(config.slots).toEqual([]);
      expect(config.validateFn(mockFormData)).toEqual([]);
      expect(config.getDeps(mockFormData)).toEqual(['Soldier', '5e']);

      expect(config.preSelect.getFn).toBe(getPreSelectedFeats);
      expect(config.preSelect.stateKey).toBe('preSelectedFeats');
      expect(config.preSelect.deps(mockFormData)).toEqual(['Soldier', '5e']);
    });

    it('returns the preSelectedFeats value passed through from useWizardConfig', () => {
      const expectedFeats = ['Tough', 'Resilient'];
      const { result } = renderFeats(mockFormData, mockSetFormData, {
        preSelectedFeats: expectedFeats,
        warnings: [],
        setWarnings: vi.fn(),
      });
      expect(result.current.preSelectedFeats).toEqual(expectedFeats);
    });
  });

  describe('preSelect merge', () => {
    function getMerge() {
      renderFeats();
      return getConfig().preSelect.merge;
    }

    it('adds new pre-selected feats without duplicating, preserving user feats and other form fields', () => {
      const merge = getMerge();

      const prev = { background: 'Soldier', rules: '5e', feats: ['Tough'] };
      const result = merge(prev, ['Tough', 'Resilient'], []);

      expect(result.feats).toEqual(['Tough', 'Resilient']);
      expect(result.background).toBe('Soldier');
      expect(result.rules).toBe('5e');
    });

    it('removes previously pre-selected feats that are no longer provided', () => {
      const merge = getMerge();

      const prev = { background: 'Soldier', feats: ['Healer', 'Tough'] };
      const result = merge(prev, ['Resilient'], ['Healer']);

      expect(result.feats).toEqual(['Tough', 'Resilient']);
    });

    it('handles prev state without any feats', () => {
      const merge = getMerge();

      const result = merge({ background: 'Soldier' }, ['Tough'], []);

      expect(result.feats).toEqual(['Tough']);
    });
  });
});
