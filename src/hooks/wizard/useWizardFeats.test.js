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

  beforeEach(() => {
    vi.clearAllMocks();
    getPreSelectedFeats.mockResolvedValue([]);
    useWizardConfig.mockReturnValue({
      preSelectedFeats: [],
      warnings: [],
      setWarnings: vi.fn(),
    });
  });

  describe('return values', () => {
    it('returns preSelectedFeats as an array from useWizardConfig', () => {
      const { result } = renderFeats();
      expect(Array.isArray(result.current.preSelectedFeats)).toBe(true);
    });

    it('returns the preSelectedFeats value passed through useWizardConfig', () => {
      const expectedFeats = ['Tough', 'Resilient'];
      useWizardConfig.mockReturnValue({
        preSelectedFeats: expectedFeats,
        warnings: [],
        setWarnings: vi.fn(),
      });

      const { result } = renderFeats();
      expect(result.current.preSelectedFeats).toEqual(expectedFeats);
    });
  });

  describe('useWizardConfig delegation', () => {
    it('passes formData to useWizardConfig', () => {
      renderFeats(mockFormData);
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.formData).toBe(mockFormData);
    });

    it('passes setFormData to useWizardConfig', () => {
      renderFeats(mockFormData, mockSetFormData);
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.setFormData).toBe(mockSetFormData);
    });

    it('passes a validateFn function to useWizardConfig', () => {
      renderFeats();
      const config = useWizardConfig.mock.calls[0][0];
      expect(typeof config.validateFn).toBe('function');
    });

    it('passes an empty slots array to useWizardConfig', () => {
      renderFeats();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.slots).toEqual([]);
    });

    it('passes getDeps that extracts background and rules from formData', () => {
      renderFeats(mockFormData);
      const config = useWizardConfig.mock.calls[0][0];
      expect(typeof config.getDeps).toBe('function');
      const deps = config.getDeps(mockFormData);
      expect(deps).toContain(mockFormData.background);
      expect(deps).toContain(mockFormData.rules);
    });

    it('passes preSelect configuration with getFn, merge, deps, and stateKey', () => {
      renderFeats();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.preSelect).toBeDefined();
      expect(typeof config.preSelect.getFn).toBe('function');
      expect(typeof config.preSelect.merge).toBe('function');
      expect(typeof config.preSelect.deps).toBe('function');
      expect(config.preSelect.stateKey).toBe('preSelectedFeats');
    });
  });

  describe('preSelect getFn', () => {
    it('exposes getPreSelectedFeats as the getFn', () => {
      renderFeats();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.preSelect.getFn).toBe(getPreSelectedFeats);
    });
  });

  describe('preSelect deps', () => {
    it('returns [background, rules] as dependency values', () => {
      renderFeats(mockFormData);
      const config = useWizardConfig.mock.calls[0][0];
      const deps = config.preSelect.deps(mockFormData);
      expect(deps).toEqual([mockFormData.background, mockFormData.rules]);
    });
  });

  describe('preSelect merge function', () => {
    it('merges new feats into existing feats without duplicating', () => {
      renderFeats();
      const config = useWizardConfig.mock.calls[0][0];
      const merge = config.preSelect.merge;

      const prev = { background: 'Soldier', feats: ['Tough'] };
      const items = ['Tough', 'Resilient'];
      const result = merge(prev, items, []);

      expect(result.feats).toEqual(['Tough', 'Resilient']);
    });

    it('adds new feats to existing ones', () => {
      renderFeats();
      const config = useWizardConfig.mock.calls[0][0];
      const merge = config.preSelect.merge;

      const prev = { background: 'Soldier', feats: ['Tough'] };
      const items = ['Resilient'];
      const result = merge(prev, items, []);

      expect(result.feats).toContain('Tough');
      expect(result.feats).toContain('Resilient');
      expect(result.feats).toHaveLength(2);
    });

    it('handles undefined feats in prev', () => {
      renderFeats();
      const config = useWizardConfig.mock.calls[0][0];
      const merge = config.preSelect.merge;

      const prev = { background: 'Soldier' };
      const items = ['Tough'];
      const result = merge(prev, items, []);

      expect(result.feats).toEqual(['Tough']);
    });

    it('handles empty items array', () => {
      renderFeats();
      const config = useWizardConfig.mock.calls[0][0];
      const merge = config.preSelect.merge;

      const prev = { background: 'Soldier', feats: ['Tough'] };
      const items = [];
      const result = merge(prev, items, []);

      expect(result.feats).toEqual(['Tough']);
    });

    it('removes old pre-selected feats when no longer in new list', () => {
      renderFeats();
      const config = useWizardConfig.mock.calls[0][0];
      const merge = config.preSelect.merge;

      const prev = { background: 'Soldier', feats: ['Healer', 'Tough'] };
      const items = ['Resilient'];
      const prevItems = ['Healer'];
      const result = merge(prev, items, prevItems);

      expect(result.feats).toContain('Resilient');
      expect(result.feats).toContain('Tough');
      expect(result.feats).not.toContain('Healer');
    });

    it('returns merged result with all spread properties from prev', () => {
      renderFeats();
      const config = useWizardConfig.mock.calls[0][0];
      const merge = config.preSelect.merge;

      const prev = { background: 'Soldier', rules: '5e', feats: ['Tough'] };
      const items = ['Resilient'];
      const result = merge(prev, items, []);

      expect(result.background).toBe('Soldier');
      expect(result.rules).toBe('5e');
      expect(result.feats).toContain('Tough');
      expect(result.feats).toContain('Resilient');
    });
  });

  describe('behavior with different rulesets', () => {
    it('works with 5e ruleset', () => {
      const formData5e = { ...mockFormData, rules: '5e' };
      useWizardConfig.mockReturnValue({
        preSelectedFeats: ['Tough'],
        warnings: [],
        setWarnings: vi.fn(),
      });

      const { result } = renderFeats(formData5e);
      expect(result.current.preSelectedFeats).toEqual(['Tough']);
    });

    it('works with 2024 ruleset', () => {
      const formData2024 = { ...mockFormData, rules: '2024' };
      useWizardConfig.mockReturnValue({
        preSelectedFeats: ['Magic Initiate'],
        warnings: [],
        setWarnings: vi.fn(),
      });

      const { result } = renderFeats(formData2024);
      expect(result.current.preSelectedFeats).toEqual(['Magic Initiate']);
    });
  });
});
