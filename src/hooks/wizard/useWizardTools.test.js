// @maintained-by-ai
// Seam (test-suite trim, 2026-10):
// - Engine `useWizardConfig.test.js` owns generic config behaviour (slot state,
//   warnings, preSelect auto-merge mechanics, error logging).
// - `useWizardTools.integration.test.js` owns the real-engine smoke (2024
//   end-to-end + 5e short-circuit through the real toolValidation service).
// - THIS file owns the mock-engine lane: the exact config object the wrapper
//   passes to useWizardConfig (service-function identities, slot declaration,
//   dep tuples, preSelect keys) and unit behaviour of the preSelect merge
//   closure. Deterministic pure-shape assertions — no engine, no data loads.
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./useWizardConfig.js', () => ({
  default: vi.fn(),
}));

import useWizardTools from './useWizardTools.js';
import useWizardConfig from './useWizardConfig.js';
import {
  validateTools,
  getToolLimitsByCategory,
} from '../../services/character/toolValidation.js';

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
  let mockSetFormData;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSetFormData = vi.fn();
  });

  function renderTools(formData = mockFormData2024, configOverride = null) {
    useWizardConfig.mockReturnValue(configOverride ?? {
      toolLimits: new Map(),
      warnings: [],
      preSelectedTools: [],
    });
    return renderHook(() => useWizardTools(formData, mockSetFormData));
  }

  function getConfigArg() {
    renderTools();
    return useWizardConfig.mock.calls[0][0];
  }

  describe('return envelope', () => {
    it('returns toolLimits, warnings renamed to toolWarnings, and preSelectedTools unchanged', () => {
      const { result } = renderTools(mockFormData2024, {
        toolLimits: new Map([['bard', 3]]),
        warnings: ['Too many tools'],
        preSelectedTools: ["Cook's Utensils"],
      });
      expect(Object.keys(result.current).sort()).toEqual([
        'preSelectedTools',
        'toolLimits',
        'toolWarnings',
      ]);
      expect(result.current.toolLimits.get('bard')).toBe(3);
      expect(result.current.toolWarnings).toEqual(['Too many tools']);
      expect(result.current.preSelectedTools).toEqual(["Cook's Utensils"]);
    });
  });

  describe('useWizardConfig config shape', () => {
    it('passes formData and setFormData through unchanged', () => {
      renderTools(mockFormData2024);
      const callConfig = useWizardConfig.mock.calls[0][0];
      expect(callConfig.formData).toBe(mockFormData2024);
      expect(callConfig.setFormData).toBe(mockSetFormData);
    });

    it('passes the toolValidation service functions as validateFn and slot.get', () => {
      const callConfig = getConfigArg();
      expect(callConfig.validateFn).toBe(validateTools);
      expect(callConfig.slots).toHaveLength(1);
      expect(callConfig.slots[0].get).toBe(getToolLimitsByCategory);
    });

    it('declares a single toolLimits slot with isLimit flag', () => {
      const callConfig = getConfigArg();
      expect(callConfig.slots[0].state).toEqual({ initial: null, key: 'toolLimits' });
      expect(callConfig.slots[0].isLimit).toBe(true);
    });

    it('getDeps extracts the exact dependency tuple, null-safe for class/race', () => {
      const { getDeps } = getConfigArg();
      expect(getDeps({ ...mockFormData2024, toolProficiencies: ['Bagpipes'] })).toEqual([
        ['Bagpipes'], 'Bard', undefined, undefined, 'Human',
        'Acolyte', '2024', ['Skilled'], 1,
      ]);
      expect(getDeps({ ...mockFormData2024, class: null, race: null })).toEqual([
        mockFormData2024.toolProficiencies, undefined, undefined, undefined, undefined,
        'Acolyte', '2024', ['Skilled'], 1,
      ]);
    });

    it('preSelect exposes getFn, merge, deps and the preSelectedTools state key', () => {
      const { preSelect } = getConfigArg();
      expect(typeof preSelect.getFn).toBe('function');
      expect(typeof preSelect.merge).toBe('function');
      expect(typeof preSelect.deps).toBe('function');
      expect(preSelect.stateKey).toBe('preSelectedTools');
    });

    it('preSelect.deps extracts background, class, feats, and rules', () => {
      const { preSelect } = getConfigArg();
      expect(preSelect.deps(mockFormData2024)).toEqual(['Acolyte', 'Bard', ['Skilled'], '2024']);
    });
  });

  describe('preSelect merge closure', () => {
    function getMerge() {
      return getConfigArg().preSelect.merge;
    }

    it('appends only new tools, preserving existing selections and other prev fields', () => {
      const merge = getMerge();
      const result = merge(
        { name: 'Test', toolProficiencies: ['Herbalism Kit', "Cook's Utensils"] },
        ["Cook's Utensils", "Thieves' Tools"],
        []
      );
      expect(result.name).toBe('Test');
      expect(result.toolProficiencies).toEqual(['Herbalism Kit', "Cook's Utensils", "Thieves' Tools"]);
    });

    it('defaults toolProficiencies when prev has none', () => {
      const merge = getMerge();
      expect(merge({}, ["Cook's Utensils"], []).toolProficiencies).toEqual(["Cook's Utensils"]);
    });
  });
});
