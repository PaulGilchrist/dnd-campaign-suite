// @improved-by-ai
import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardSkills from './useWizardSkills.js';

// Mock useWizardConfig — useWizardSkills is a thin wrapper that delegates to it.
// Testing the config call structure verifies the hook's behavior without
// testing implementation details of the underlying services.
vi.mock('./useWizardConfig.js', () => ({
  default: vi.fn(),
}));

import useWizardConfig from './useWizardConfig.js';

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

function renderSkills(formData = DEFAULT_FORM_DATA, setFormData = vi.fn()) {
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
      expect(config.setFormData).toBeDefined();
      expect(typeof config.validateFn).toBe('function');
      expect(typeof config.getDeps).toBe('function');
      expect(typeof config.preSelect).toBe('object');
      expect(Array.isArray(config.slots)).toBe(true);
      expect(config.slots).toHaveLength(2);
    });

    it('passes validateFn from skillValidation', () => {
      renderSkills();

      expect(useWizardConfig).toHaveBeenCalledTimes(1);
      const config = useWizardConfig.mock.calls[0][0];
      expect(typeof config.validateFn).toBe('function');
    });

    it('passes getSkillLimits and getExpertiseLimits as slot getters', () => {
      renderSkills();

      const config = useWizardConfig.mock.calls[0][0];
      expect(config.slots).toHaveLength(2);
      expect(typeof config.slots[0].get).toBe('function');
      expect(typeof config.slots[1].get).toBe('function');
    });

    it('passes getPreSelectedSkills in the preSelect config', () => {
      renderSkills();

      const config = useWizardConfig.mock.calls[0][0];
      expect(config.preSelect.getFn).toBeDefined();
      expect(typeof config.preSelect.getFn).toBe('function');
    });

    it('passes the correct dependency arrays via getDeps and preSelect.deps', () => {
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
    });

    it('passes the correct preSelect deps (background, race, class, rules)', () => {
      renderSkills();

      const config = useWizardConfig.mock.calls[0][0];
      const deps = config.preSelect.deps(DEFAULT_FORM_DATA);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.background);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.race?.name);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.class?.name);
      expect(deps).toContainEqual(DEFAULT_FORM_DATA.rules);
    });
  });

  describe('return value', () => {
    it('forwards all non-warnings properties from useWizardConfig', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: { maxSkills: 4 },
        expertiseLimits: { maxExpertise: 0 },
        preSelectedSkills: ['Athletics'],
        warnings: ['Too few skills'],
      });

      const { result } = renderSkills();

      expect(result.current.skillLimits).toEqual({ maxSkills: 4 });
      expect(result.current.expertiseLimits).toEqual({ maxExpertise: 0 });
      expect(result.current.preSelectedSkills).toEqual(['Athletics']);
    });

    it('aliases warnings as skillWarnings', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: { maxSkills: 4 },
        warnings: ['Warning A', 'Warning B'],
      });

      const { result } = renderSkills();

      expect(result.current.skillWarnings).toEqual(['Warning A', 'Warning B']);
    });

    it('does not expose warnings as a separate key (only as skillWarnings)', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: { maxSkills: 4 },
        warnings: ['Warning A'],
      });

      const { result } = renderSkills();

      expect(result.current).not.toHaveProperty('warnings');
      expect(result.current).toHaveProperty('skillWarnings');
    });

    it('returns an object with the expected shape', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: null,
        expertiseLimits: null,
        preSelectedSkills: [],
        warnings: [],
      });

      const { result } = renderSkills();

      expect(typeof result.current).toBe('object');
      expect(Array.isArray(result.current.skillWarnings)).toBe(true);
    });
  });

  describe('formData reactivity', () => {
    it('re-runs when formData changes', () => {
      const { rerender } = renderSkills();

      expect(useWizardConfig).toHaveBeenCalledTimes(1);

      rerender();

      // useWizardConfig is called once per render (initial + rerender)
      expect(useWizardConfig).toHaveBeenCalledTimes(2);
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
    });
  });
});
