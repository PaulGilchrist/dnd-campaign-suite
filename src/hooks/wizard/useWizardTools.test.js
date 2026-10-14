import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./useWizardConfig.js', () => ({
  default: vi.fn(),
}));

import useWizardTools from './useWizardTools.js';
import useWizardConfig from './useWizardConfig.js';

const mockFormData2024 = {
  name: 'Test Character',
  rules: '2024',
  class: { name: 'Bard' },
  race: { name: 'Human' },
  background: 'Acolyte',
  feats: ['Skilled'],
  level: 1,
  toolProficiencies: [],
};

describe('useWizardTools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWizardConfig.mockClear();
  });

  function renderTools(formData, _configOverride) {
    const mockSetFormData = vi.fn();
    useWizardConfig.mockReturnValue(
      _configOverride ?? {
        toolLimits: new Map(),
        warnings: [],
        preSelectedTools: [],
      }
    );
    return renderHook(() => useWizardTools(formData, mockSetFormData));
  }

  describe('return values', () => {
    it('returns toolLimits, toolWarnings, and preSelectedTools from useWizardConfig', () => {
      const { result } = renderTools(mockFormData2024);
      expect(result.current).toHaveProperty('toolLimits');
      expect(result.current).toHaveProperty('toolWarnings');
      expect(result.current).toHaveProperty('preSelectedTools');
    });

    it('returns the values passed through useWizardConfig unchanged', () => {
      const { result } = renderTools(mockFormData2024, {
        toolLimits: new Map([['bard', 3]]),
        warnings: ['Too many tools'],
        preSelectedTools: ["Cook's Utensils"],
      });
      expect(result.current.toolLimits.get('bard')).toBe(3);
      expect(result.current.toolWarnings).toEqual(['Too many tools']);
      expect(result.current.preSelectedTools).toEqual(["Cook's Utensils"]);
    });

    it('returns empty values when useWizardConfig provides empty results', () => {
      const { result } = renderTools(mockFormData2024, {
        toolLimits: new Map(),
        warnings: [],
        preSelectedTools: [],
      });
      expect(result.current.toolWarnings).toEqual([]);
      expect(result.current.preSelectedTools).toEqual([]);
    });
  });

  describe('useWizardConfig delegation', () => {
    it('passes formData and a setFormData function to useWizardConfig', () => {
      renderTools(mockFormData2024, null);
      const callConfig = useWizardConfig.mock.calls[0][0];
      expect(callConfig.formData).toBe(mockFormData2024);
      expect(typeof callConfig.setFormData).toBe('function');
    });

    it('passes validateTools as validateFn', () => {
      renderTools(mockFormData2024, null);
      const callConfig = useWizardConfig.mock.calls[0][0];
      expect(typeof callConfig.validateFn).toBe('function');
    });

    it('passes a single slot for toolLimits with isLimit flag', () => {
      renderTools(mockFormData2024, null);
      const callConfig = useWizardConfig.mock.calls[0][0];
      expect(callConfig.slots).toHaveLength(1);
      expect(callConfig.slots[0].state.key).toBe('toolLimits');
      expect(callConfig.slots[0].isLimit).toBe(true);
    });

    it('passes getDeps that extracts all formData dependency fields', () => {
      renderTools(mockFormData2024, null);
      const callConfig = useWizardConfig.mock.calls[0][0];
      const deps = callConfig.getDeps(mockFormData2024);
      expect(deps).toContain(mockFormData2024.toolProficiencies);
      expect(deps).toContain(mockFormData2024.class?.name);
      expect(deps).toContain(mockFormData2024.race?.name);
      expect(deps).toContain(mockFormData2024.background);
      expect(deps).toContain(mockFormData2024.rules);
      expect(deps).toContain(mockFormData2024.feats);
      expect(deps).toContain(mockFormData2024.level);
    });

    it('passes getDeps that handles null/undefined class and race', () => {
      const minimalData = { ...mockFormData2024, class: null, race: null };
      renderTools(minimalData, null);
      const callConfig = useWizardConfig.mock.calls[0][0];
      const deps = callConfig.getDeps(minimalData);
      expect(deps).toContain(undefined);
      expect(deps).toContain(minimalData.background);
      expect(deps).toContain(minimalData.rules);
    });

    it('passes preSelect configuration with all required keys', () => {
      renderTools(mockFormData2024, null);
      const callConfig = useWizardConfig.mock.calls[0][0];
      expect(typeof callConfig.preSelect.getFn).toBe('function');
      expect(typeof callConfig.preSelect.merge).toBe('function');
      expect(typeof callConfig.preSelect.deps).toBe('function');
      expect(callConfig.preSelect.stateKey).toBe('preSelectedTools');
    });

    it('passes preSelect.deps that extracts background, class, feats, and rules', () => {
      renderTools(mockFormData2024, null);
      const callConfig = useWizardConfig.mock.calls[0][0];
      const deps = callConfig.preSelect.deps(mockFormData2024);
      expect(deps).toContain(mockFormData2024.background);
      expect(deps).toContain(mockFormData2024.class?.name);
      expect(deps).toContain(mockFormData2024.feats);
      expect(deps).toContain(mockFormData2024.rules);
    });
  });

  describe('preSelect merge function behavior', () => {
    function getMerge() {
      renderTools(mockFormData2024, null);
      return useWizardConfig.mock.calls[0][0].preSelect.merge;
    }

    it('merges pre-selected tools into toolProficiencies without duplicates', () => {
      const merge = getMerge();
      const prev = { toolProficiencies: ["Cook's Utensils"] };
      const items = ["Cook's Utensils"];
      const result = merge(prev, items, []);
      expect(result.toolProficiencies).toEqual(["Cook's Utensils"]);
    });

    it('adds new pre-selected tools to existing toolProficiencies', () => {
      const merge = getMerge();
      const prev = { toolProficiencies: ['Herbalism Kit'] };
      const items = ["Cook's Utensils"];
      const result = merge(prev, items, []);
      expect(result.toolProficiencies).toContain('Herbalism Kit');
      expect(result.toolProficiencies).toContain("Cook's Utensils");
      expect(result.toolProficiencies).toHaveLength(2);
    });

    it('handles undefined toolProficiencies in prev', () => {
      const merge = getMerge();
      const prev = {};
      const items = ["Cook's Utensils"];
      const result = merge(prev, items, []);
      expect(result.toolProficiencies).toEqual(["Cook's Utensils"]);
    });

    it('handles empty items array by preserving existing tools', () => {
      const merge = getMerge();
      const prev = { toolProficiencies: ['Herbalism Kit'] };
      const items = [];
      const result = merge(prev, items, []);
      expect(result.toolProficiencies).toEqual(['Herbalism Kit']);
    });

    it('spreads existing properties from prev into the result', () => {
      const merge = getMerge();
      const prev = { name: 'Test' };
      const items = ["Cook's Utensils"];
      const result = merge(prev, items, []);
      expect(result.name).toBe('Test');
      expect(result.toolProficiencies).toEqual(["Cook's Utensils"]);
    });
  });

  describe('setFormData passthrough', () => {
    it('passes setFormData to useWizardConfig for preSelect merge', () => {
      renderTools(mockFormData2024, null);
      const callConfig = useWizardConfig.mock.calls[0][0];
      expect(typeof callConfig.setFormData).toBe('function');
    });
  });
});
