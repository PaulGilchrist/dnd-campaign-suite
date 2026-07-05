// @cleaned-by-ai
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

vi.mock('./useWizardConfig.js', () => ({
  default: vi.fn(),
}));

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

const MOCK_SET_FORM_DATA = vi.fn();

function renderSkills(formData = DEFAULT_FORM_DATA, setFormData = MOCK_SET_FORM_DATA) {
  return renderHook(() => useWizardSkills(formData, setFormData));
}

describe('useWizardSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWizardConfig.mockReturnValue({
      skillLimits: null,
      expertiseLimits: null,
      preSelectedSkills: [],
      warnings: [],
    });
  });

  describe('delegation to useWizardConfig', () => {
    it('passes the correct validateFn, slot getters, and preSelect config', () => {
      renderSkills();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.validateFn).toBe(validateSkills);
      expect(config.slots[0].get).toBe(getSkillLimits);
      expect(config.slots[1].get).toBe(getExpertiseLimits);
      expect(config.preSelect.getFn).toBe(getPreSelectedSkills);
    });

    it('passes formData and setFormData to useWizardConfig', () => {
      renderSkills();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.formData).toBe(DEFAULT_FORM_DATA);
      expect(config.setFormData).toBe(MOCK_SET_FORM_DATA);
    });

    it('configures two slots with isLimit flag', () => {
      renderSkills();
      const config = useWizardConfig.mock.calls[0][0];
      expect(config.slots).toHaveLength(2);
      expect(config.slots[0].isLimit).toBe(true);
      expect(config.slots[1].isLimit).toBe(true);
    });
  });

  describe('return value', () => {
    it('forwards all properties from useWizardConfig', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: { maxSkills: 4 },
        expertiseLimits: { allowed: true, count: 1 },
        preSelectedSkills: ['Athletics', 'Stealth'],
        warnings: ['Warning A'],
      });

      const { result } = renderSkills();
      expect(result.current.skillLimits).toEqual({ maxSkills: 4 });
      expect(result.current.expertiseLimits).toEqual({ allowed: true, count: 1 });
      expect(result.current.preSelectedSkills).toEqual(['Athletics', 'Stealth']);
      expect(result.current.skillWarnings).toEqual(['Warning A']);
    });

    it('aliases warnings as skillWarnings, not warnings', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: null,
        expertiseLimits: null,
        preSelectedSkills: [],
        warnings: ['Warning A'],
      });

      const { result } = renderSkills();
      expect(result.current).not.toHaveProperty('warnings');
      expect(result.current).toHaveProperty('skillWarnings');
    });

    it('does not return extra properties', () => {
      const { result } = renderSkills();
      const keys = Object.keys(result.current);
      expect(keys).toEqual([
        'skillLimits',
        'expertiseLimits',
        'preSelectedSkills',
        'skillWarnings',
      ]);
    });
  });

  describe('reactivity', () => {
    it('re-runs when formData changes', () => {
      const { rerender } = renderSkills();
      expect(useWizardConfig).toHaveBeenCalledTimes(1);
      rerender();
      expect(useWizardConfig).toHaveBeenCalledTimes(2);
    });
  });

  describe('null handling', () => {
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
  });
});
