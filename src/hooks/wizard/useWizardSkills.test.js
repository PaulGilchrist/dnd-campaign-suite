// @improved-by-ai
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardSkills from './useWizardSkills.js';
import useWizardConfig from './useWizardConfig.js';
import {
  validateSkills,
  getSkillLimits,
  getExpertiseLimits,
  getPreSelectedSkills,
} from '../../services/character/skillValidation.js';

// Mock useWizardConfig so we test useWizardSkills as a unit,
// not the internals of useWizardConfig (which has its own test suite).
vi.mock('./useWizardConfig.js', () => ({
  default: vi.fn(),
}));

// Mock the validation service so we verify the correct functions are imported.
vi.mock('../../services/character/skillValidation.js', () => ({
  validateSkills: vi.fn(),
  getSkillLimits: vi.fn(),
  getExpertiseLimits: vi.fn(),
  getPreSelectedSkills: vi.fn(),
}));

const DEFAULT_FORM_DATA = {
  class: { name: 'Fighter' },
  race: { name: 'Human' },
  background: 'Soldier',
  skillProficiencies: ['Athletics'],
  expertSkills: [],
  rules: '5e',
  level: 1,
};

function defaultConfigResult() {
  return {
    skillLimits: null,
    expertiseLimits: null,
    preSelectedSkills: [],
    warnings: [],
  };
}

const MOCK_SET_FORM_DATA = vi.fn();

function renderSkills(formData = DEFAULT_FORM_DATA, setFormData = MOCK_SET_FORM_DATA) {
  return renderHook(() => useWizardSkills(formData, setFormData));
}

describe('useWizardSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWizardConfig.mockReturnValue(defaultConfigResult());
  });

  describe('delegation to useWizardConfig', () => {
    it('calls useWizardConfig with the correct configuration shape', () => {
      renderSkills();

      expect(useWizardConfig).toHaveBeenCalledTimes(1);
      const config = useWizardConfig.mock.calls[0][0];

      expect(config.formData).toBe(DEFAULT_FORM_DATA);
      expect(config.setFormData).toBe(MOCK_SET_FORM_DATA);
      expect(typeof config.validateFn).toBe('function');
      expect(typeof config.getDeps).toBe('function');
      expect(typeof config.preSelect).toBe('object');
      expect(Array.isArray(config.slots)).toBe(true);
      expect(config.slots).toHaveLength(2);
    });

    it('passes validateSkills as validateFn', () => {
      renderSkills();

      expect(useWizardConfig).toHaveBeenCalledTimes(1);
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.validateFn).toBe(validateSkills);
    });

    it('passes getSkillLimits as the first slot getter', () => {
      renderSkills();

      const config = useWizardConfig.mock.calls[0][0];
      expect(config.slots).toHaveLength(2);
      expect(config.slots[0].get).toBe(getSkillLimits);
    });

    it('passes getExpertiseLimits as the second slot getter', () => {
      renderSkills();

      const config = useWizardConfig.mock.calls[0][0];
      expect(config.slots).toHaveLength(2);
      expect(config.slots[1].get).toBe(getExpertiseLimits);
    });

    it('configures the first slot with skillLimits key and isLimit flag', () => {
      renderSkills();

      const config = useWizardConfig.mock.calls[0][0];
      expect(config.slots[0].state.key).toBe('skillLimits');
      expect(config.slots[0].state.initial).toBeNull();
      expect(config.slots[0].isLimit).toBe(true);
    });

    it('configures the second slot with expertiseLimits key and isLimit flag', () => {
      renderSkills();

      const config = useWizardConfig.mock.calls[0][0];
      expect(config.slots[1].state.key).toBe('expertiseLimits');
      expect(config.slots[1].state.initial).toBeNull();
      expect(config.slots[1].isLimit).toBe(true);
    });

    it('passes getPreSelectedSkills in the preSelect config', () => {
      renderSkills();

      const config = useWizardConfig.mock.calls[0][0];
      expect(config.preSelect.getFn).toBe(getPreSelectedSkills);
      expect(typeof config.preSelect.getFn).toBe('function');
    });

    it('configures preSelect with the correct stateKey', () => {
      renderSkills();

      const config = useWizardConfig.mock.calls[0][0];
      expect(config.preSelect.stateKey).toBe('preSelectedSkills');
    });

    it('configures preSelect.merge to append new skills without duplicates', () => {
      renderSkills();

      const config = useWizardConfig.mock.calls[0][0];
      expect(typeof config.preSelect.merge).toBe('function');

      const merge = config.preSelect.merge;
      const prev = { skillProficiencies: ['Athletics'] };
      const items = ['Athletics', 'Stealth'];

      const result = merge(prev, items);

      expect(result.skillProficiencies).toEqual(['Athletics', 'Stealth']);
    });

    it('preSelect.merge does not add duplicate skills', () => {
      renderSkills();

      const config = useWizardConfig.mock.calls[0][0];
      const merge = config.preSelect.merge;
      const prev = { skillProficiencies: ['Athletics', 'Stealth'] };
      const items = ['Athletics'];

      const result = merge(prev, items);

      expect(result.skillProficiencies).toEqual(['Athletics', 'Stealth']);
    });

    it('preSelect.merge handles null prev.skillProficiencies', () => {
      renderSkills();

      const config = useWizardConfig.mock.calls[0][0];
      const merge = config.preSelect.merge;
      const prev = {};
      const items = ['Athletics', 'Stealth'];

      const result = merge(prev, items);

      expect(result.skillProficiencies).toEqual(['Athletics', 'Stealth']);
    });

    it('preSelect.merge handles empty items array', () => {
      renderSkills();

      const config = useWizardConfig.mock.calls[0][0];
      const merge = config.preSelect.merge;
      const prev = { skillProficiencies: ['Athletics'] };
      const items = [];

      const result = merge(prev, items);

      expect(result.skillProficiencies).toEqual(['Athletics']);
    });

    it('passes the correct dependency arrays via getDeps', () => {
      renderSkills();

      const config = useWizardConfig.mock.calls[0][0];
      const deps = config.getDeps(DEFAULT_FORM_DATA);

      expect(deps).toContainEqual(DEFAULT_FORM_DATA.skillProficiencies);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.expertSkills);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.class?.name);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.race?.name);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.background);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.rules);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.level);
      expect(deps).toHaveLength(7);
    });

    it('passes the correct preSelect deps (background, race, class, rules)', () => {
      renderSkills();

      const config = useWizardConfig.mock.calls[0][0];
      const deps = config.preSelect.deps(DEFAULT_FORM_DATA);

      expect(deps).toContainEqual(DEFAULT_FORM_DATA.background);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.race?.name);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.class?.name);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.rules);
      expect(deps).toHaveLength(4);
    });
  });

  describe('return value', () => {
    it('forwards skillLimits from useWizardConfig', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: { maxSkills: 4 },
        expertiseLimits: { maxExpertise: 0 },
        preSelectedSkills: [],
        warnings: [],
      });

      const { result } = renderSkills();

      expect(result.current.skillLimits).toEqual({ maxSkills: 4 });
    });

    it('forwards expertiseLimits from useWizardConfig', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: { maxSkills: 4 },
        expertiseLimits: { allowed: true, count: 1 },
        preSelectedSkills: [],
        warnings: [],
      });

      const { result } = renderSkills();

      expect(result.current.expertiseLimits).toEqual({ allowed: true, count: 1 });
    });

    it('forwards preSelectedSkills from useWizardConfig', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: null,
        expertiseLimits: null,
        preSelectedSkills: ['Athletics', 'Stealth'],
        warnings: [],
      });

      const { result } = renderSkills();

      expect(result.current.preSelectedSkills).toEqual(['Athletics', 'Stealth']);
    });

    it('aliases warnings as skillWarnings', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: { maxSkills: 4 },
        expertiseLimits: null,
        preSelectedSkills: [],
        warnings: ['Warning A', 'Warning B'],
      });

      const { result } = renderSkills();

      expect(result.current.skillWarnings).toEqual(['Warning A', 'Warning B']);
    });

    it('does not expose warnings as a separate key (only as skillWarnings)', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: { maxSkills: 4 },
        expertiseLimits: null,
        preSelectedSkills: [],
        warnings: ['Warning A'],
      });

      const { result } = renderSkills();

      expect(result.current).not.toHaveProperty('warnings');
      expect(result.current).toHaveProperty('skillWarnings');
    });

    it('does not return extra properties beyond the four expected keys', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: null,
        expertiseLimits: null,
        preSelectedSkills: [],
        warnings: [],
      });

      const { result } = renderSkills();

      const keys = Object.keys(result.current);
      expect(keys).toEqual([
        'skillLimits',
        'expertiseLimits',
        'preSelectedSkills',
        'skillWarnings',
      ]);
    });

    it('passes through non-empty warnings from useWizardConfig', () => {
      const mockWarnings = [
        { message: 'Too many skills selected', type: 'warning' },
        { message: 'Consider selecting more skills', type: 'info' },
      ];
      useWizardConfig.mockReturnValue({
        skillLimits: null,
        expertiseLimits: null,
        preSelectedSkills: [],
        warnings: mockWarnings,
      });

      const { result } = renderSkills();
      expect(result.current.skillWarnings).toEqual(mockWarnings);
    });
  });

  describe('formData reactivity', () => {
    it('re-runs when formData changes', () => {
      const { rerender } = renderSkills();

      expect(useWizardConfig).toHaveBeenCalledTimes(1);

      rerender();

      expect(useWizardConfig).toHaveBeenCalledTimes(2);
    });

    it('passes the updated formData to useWizardConfig on rerender', () => {
      const { rerender } = renderSkills(DEFAULT_FORM_DATA);

      expect(useWizardConfig).toHaveBeenCalledTimes(1);

      rerender();

      expect(useWizardConfig).toHaveBeenCalledTimes(2);
      expect(useWizardConfig.mock.calls[1][0].formData).toBe(DEFAULT_FORM_DATA);
    });
  });

  describe('ruleset support', () => {
    it('works with 2024 ruleset', () => {
      const formData2024 = { ...DEFAULT_FORM_DATA, rules: '2024' };

      useWizardConfig.mockReturnValue({
        skillLimits: { maxSkills: 3 },
        expertiseLimits: { allowed: true, count: 1 },
        preSelectedSkills: [],
        warnings: [],
      });

      const { result } = renderSkills(formData2024);

      expect(result.current.skillLimits).toEqual({ maxSkills: 3 });
      expect(result.current.expertiseLimits).toEqual({ allowed: true, count: 1 });
      expect(useWizardConfig.mock.calls[0][0].formData.rules).toBe('2024');
    });

    it('works with 5e ruleset', () => {
      const formData5e = { ...DEFAULT_FORM_DATA, rules: '5e' };

      useWizardConfig.mockReturnValue({
        skillLimits: { maxSkills: 2 },
        expertiseLimits: { allowed: false, count: 0 },
        preSelectedSkills: [],
        warnings: [],
      });

      const { result } = renderSkills(formData5e);

      expect(result.current.skillLimits).toEqual({ maxSkills: 2 });
      expect(result.current.expertiseLimits).toEqual({ allowed: false, count: 0 });
      expect(useWizardConfig.mock.calls[0][0].formData.rules).toBe('5e');
    });
  });

  describe('error resilience', () => {
    it('handles missing class/race gracefully', () => {
      const minimalData = {
        class: null,
        race: null,
        background: '',
        skillProficiencies: [],
        expertSkills: [],
        rules: '5e',
        level: 1,
      };

      useWizardConfig.mockReturnValue({
        skillLimits: null,
        expertiseLimits: null,
        preSelectedSkills: [],
        warnings: [],
      });

      const { result } = renderSkills(minimalData);

      expect(result.current.skillLimits).toBeNull();
      expect(result.current.expertiseLimits).toBeNull();
      expect(result.current.skillWarnings).toEqual([]);
      expect(result.current.preSelectedSkills).toEqual([]);
    });

    it('handles null formData values for optional fields', () => {
      const formData = {
        class: null,
        race: null,
        background: null,
        skillProficiencies: null,
        expertSkills: null,
        rules: '5e',
        level: null,
      };

      useWizardConfig.mockReturnValue({
        skillLimits: null,
        expertiseLimits: null,
        preSelectedSkills: [],
        warnings: [],
      });

      const { result } = renderSkills(formData);

      expect(result.current.skillLimits).toBeNull();
      expect(result.current.expertiseLimits).toBeNull();
      expect(result.current.skillWarnings).toEqual([]);
    });

    it('handles empty skillProficiencies array', () => {
      const formData = {
        ...DEFAULT_FORM_DATA,
        skillProficiencies: [],
        expertSkills: [],
      };

      useWizardConfig.mockReturnValue({
        skillLimits: { allowed: 2 },
        expertiseLimits: { allowed: false, count: 0 },
        preSelectedSkills: [],
        warnings: [],
      });

      const { result } = renderSkills(formData);

      expect(result.current.skillLimits).toEqual({ allowed: 2 });
      expect(result.current.expertiseLimits).toEqual({ allowed: false, count: 0 });
    });

    it('handles empty preSelectedSkills array', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: null,
        expertiseLimits: null,
        preSelectedSkills: [],
        warnings: [],
      });

      const { result } = renderSkills();

      expect(result.current.preSelectedSkills).toEqual([]);
    });
  });

  describe('null and undefined handling', () => {
    it('returns null for limits when useWizardConfig returns null', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: null,
        expertiseLimits: null,
        preSelectedSkills: [],
        warnings: [],
      });

      const { result } = renderSkills();
      expect(result.current.skillLimits).toBeNull();
      expect(result.current.expertiseLimits).toBeNull();
    });

    it('returns empty arrays for pre-selected values when useWizardConfig returns them', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: { maxSkills: 2 },
        expertiseLimits: { maxExpertise: 0 },
        preSelectedSkills: [],
        warnings: [],
      });

      const { result } = renderSkills();
      expect(result.current.preSelectedSkills).toEqual([]);
    });

    it('passes undefined warnings through as skillWarnings when useWizardConfig returns undefined', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: null,
        expertiseLimits: null,
        preSelectedSkills: [],
        warnings: undefined,
      });

      const { result } = renderSkills();
      expect(result.current.skillWarnings).toBeUndefined();
    });
  });

  describe('formData variations', () => {
    it('passes formData with all skills selected', () => {
      const formData = {
        ...DEFAULT_FORM_DATA,
        skillProficiencies: ['Athletics', 'Stealth', 'Perception', 'Insight'],
      };

      useWizardConfig.mockReturnValue({
        skillLimits: { maxSkills: 4 },
        expertiseLimits: { allowed: false, count: 0 },
        preSelectedSkills: [],
        warnings: [],
      });

      renderSkills(formData);
      expect(useWizardConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: formData,
        })
      );
    });

    it('passes formData with expertise skills', () => {
      const formData = {
        ...DEFAULT_FORM_DATA,
        skillProficiencies: ['Athletics'],
        expertSkills: ['Athletics'],
      };

      useWizardConfig.mockReturnValue({
        skillLimits: { maxSkills: 2 },
        expertiseLimits: { allowed: true, count: 2 },
        preSelectedSkills: [],
        warnings: [],
      });

      renderSkills(formData);
      expect(useWizardConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          formData: formData,
        })
      );
    });

    it('passes formData with different background', () => {
      const formData = {
        ...DEFAULT_FORM_DATA,
        background: 'Acolyte',
      };

      useWizardConfig.mockReturnValue(defaultConfigResult());

      renderSkills(formData);
      expect(useWizardConfig.mock.calls[0][0].formData.background).toBe('Acolyte');
    });
  });
});
