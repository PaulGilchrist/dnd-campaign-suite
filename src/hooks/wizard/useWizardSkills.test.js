import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardSkills from './useWizardSkills.js';
import useWizardConfig from './useWizardConfig.js';
import * as skillValidation from '../../services/character/skillValidation.js';

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

function renderSkills(formData = DEFAULT_FORM_DATA, setFormData = MOCK_SET_FORM_DATA, allFeats = null) {
  return renderHook(() => useWizardSkills(formData, setFormData, allFeats));
}

describe('useWizardSkills', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useWizardConfig.mockReturnValue({
      skillLimits: null,
      expertiseLimits: null,
      preSelectedSkills: [],
      warnings: [],
      setWarnings: vi.fn(),
    });
  });

  describe('return value shape', () => {
    it('aliases warnings from useWizardConfig as skillWarnings', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: null,
        expertiseLimits: null,
        preSelectedSkills: [],
        warnings: ['Too many skills'],
        setWarnings: vi.fn(),
      });

      const { result } = renderSkills();
      expect(result.current).toHaveProperty('skillWarnings', ['Too many skills']);
      expect(result.current).not.toHaveProperty('warnings');
    });

    it('forwards all properties from useWizardConfig except warnings', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: { maxSkills: 4 },
        expertiseLimits: { allowed: true, count: 1 },
        preSelectedSkills: ['Athletics', 'Stealth'],
        warnings: ['Warning A'],
        setWarnings: vi.fn(),
      });

      const { result } = renderSkills();
      expect(result.current.skillLimits).toEqual({ maxSkills: 4 });
      expect(result.current.expertiseLimits).toEqual({ allowed: true, count: 1 });
      expect(result.current.preSelectedSkills).toEqual(['Athletics', 'Stealth']);
      expect(result.current.skillWarnings).toEqual(['Warning A']);
      expect(typeof result.current.setWarnings).toBe('function');
    });

    it('returns only the expected properties', () => {
      const { result } = renderSkills();
      const keys = Object.keys(result.current);
      expect(keys).toEqual([
        'skillLimits',
        'expertiseLimits',
        'preSelectedSkills',
        'setWarnings',
        'skillWarnings',
      ]);
    });

    it('returns null/empty defaults when useWizardConfig returns them', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: null,
        expertiseLimits: null,
        preSelectedSkills: [],
        warnings: [],
        setWarnings: vi.fn(),
      });

      const { result } = renderSkills();
      expect(result.current.skillLimits).toBeNull();
      expect(result.current.expertiseLimits).toBeNull();
      expect(result.current.preSelectedSkills).toEqual([]);
      expect(result.current.skillWarnings).toEqual([]);
    });

    it('passes through undefined preSelectedSkills from useWizardConfig', () => {
      useWizardConfig.mockReturnValue({
        skillLimits: null,
        expertiseLimits: null,
        preSelectedSkills: undefined,
        warnings: [],
        setWarnings: vi.fn(),
      });

      const { result } = renderSkills();
      expect(result.current.preSelectedSkills).toBeUndefined();
    });
  });

  describe('reactivity', () => {
    it('re-runs useWizardConfig when formData changes', () => {
      const { rerender } = renderSkills();
      expect(useWizardConfig).toHaveBeenCalledTimes(1);
      rerender();
      expect(useWizardConfig).toHaveBeenCalledTimes(2);
    });

    it('re-runs useWizardConfig when setFormData changes', () => {
      const { rerender } = renderSkills(DEFAULT_FORM_DATA, vi.fn());
      expect(useWizardConfig).toHaveBeenCalledTimes(1);
      rerender();
      expect(useWizardConfig).toHaveBeenCalledTimes(2);
    });
  });

  describe('callback delegation to skillValidation', () => {
    it('validateFn delegates to validateSkills with formData and allFeats', async () => {
      const mockFeats = [{ name: 'Skill Expert', benefits: [] }];
      renderSkills(DEFAULT_FORM_DATA, MOCK_SET_FORM_DATA, mockFeats);
      const config = useWizardConfig.mock.calls[0][0];
      skillValidation.validateSkills.mockResolvedValue(['test warning']);
      await config.validateFn(DEFAULT_FORM_DATA);
      expect(skillValidation.validateSkills).toHaveBeenCalledWith(DEFAULT_FORM_DATA, mockFeats);
    });

    it('slot getSkillLimits delegates with formData and allFeats', async () => {
      const mockFeats = [{ name: 'Skill Expert', benefits: [] }];
      renderSkills(DEFAULT_FORM_DATA, MOCK_SET_FORM_DATA, mockFeats);
      const config = useWizardConfig.mock.calls[0][0];
      skillValidation.getSkillLimits.mockResolvedValue({ allowed: 5, fromClass: { count: 2 } });
      await config.slots[0].get(DEFAULT_FORM_DATA);
      expect(skillValidation.getSkillLimits).toHaveBeenCalledWith(DEFAULT_FORM_DATA, mockFeats);
    });

    it('slot getExpertiseLimits delegates with formData and allFeats', async () => {
      const mockFeats = [{ name: 'Skill Expert', benefits: [] }];
      renderSkills(DEFAULT_FORM_DATA, MOCK_SET_FORM_DATA, mockFeats);
      const config = useWizardConfig.mock.calls[0][0];
      skillValidation.getExpertiseLimits.mockResolvedValue({ allowed: true, count: 2 });
      await config.slots[1].get(DEFAULT_FORM_DATA);
      expect(skillValidation.getExpertiseLimits).toHaveBeenCalledWith(DEFAULT_FORM_DATA, mockFeats);
    });

    it('preSelect getFn delegates to getPreSelectedSkills with formData and allFeats', async () => {
      const mockFeats = [{ name: 'Skill Expert', benefits: [] }];
      renderSkills(DEFAULT_FORM_DATA, MOCK_SET_FORM_DATA, mockFeats);
      const config = useWizardConfig.mock.calls[0][0];
      skillValidation.getPreSelectedSkills.mockResolvedValue(['Athletics', 'Stealth']);
      await config.preSelect.getFn(DEFAULT_FORM_DATA);
      expect(skillValidation.getPreSelectedSkills).toHaveBeenCalledWith(DEFAULT_FORM_DATA, mockFeats);
    });

    it('all callbacks capture the same allFeats from closure', async () => {
      const mockFeats = [
        { name: 'Skill Expert', benefits: [] },
        { name: 'Skilled', benefits: [] },
      ];
      renderSkills(DEFAULT_FORM_DATA, MOCK_SET_FORM_DATA, mockFeats);
      const config = useWizardConfig.mock.calls[0][0];
      skillValidation.validateSkills.mockResolvedValue([]);
      skillValidation.getSkillLimits.mockResolvedValue({ allowed: 3 });
      skillValidation.getExpertiseLimits.mockResolvedValue({ allowed: true, count: 1 });
      skillValidation.getPreSelectedSkills.mockResolvedValue([]);

      await config.validateFn(DEFAULT_FORM_DATA);
      expect(skillValidation.validateSkills).toHaveBeenCalledWith(DEFAULT_FORM_DATA, mockFeats);

      await config.slots[0].get(DEFAULT_FORM_DATA);
      expect(skillValidation.getSkillLimits).toHaveBeenCalledWith(DEFAULT_FORM_DATA, mockFeats);

      await config.slots[1].get(DEFAULT_FORM_DATA);
      expect(skillValidation.getExpertiseLimits).toHaveBeenCalledWith(DEFAULT_FORM_DATA, mockFeats);

      await config.preSelect.getFn(DEFAULT_FORM_DATA);
      expect(skillValidation.getPreSelectedSkills).toHaveBeenCalledWith(DEFAULT_FORM_DATA, mockFeats);
    });

    it('callbacks pass null when allFeats is null', async () => {
      renderSkills(DEFAULT_FORM_DATA, MOCK_SET_FORM_DATA, null);
      const config = useWizardConfig.mock.calls[0][0];
      skillValidation.validateSkills.mockResolvedValue([]);
      skillValidation.getSkillLimits.mockResolvedValue({ allowed: 3 });
      skillValidation.getExpertiseLimits.mockResolvedValue({ allowed: true, count: 1 });
      skillValidation.getPreSelectedSkills.mockResolvedValue([]);

      await config.validateFn(DEFAULT_FORM_DATA);
      expect(skillValidation.validateSkills).toHaveBeenCalledWith(DEFAULT_FORM_DATA, null);

      await config.slots[0].get(DEFAULT_FORM_DATA);
      expect(skillValidation.getSkillLimits).toHaveBeenCalledWith(DEFAULT_FORM_DATA, null);

      await config.slots[1].get(DEFAULT_FORM_DATA);
      expect(skillValidation.getExpertiseLimits).toHaveBeenCalledWith(DEFAULT_FORM_DATA, null);

      await config.preSelect.getFn(DEFAULT_FORM_DATA);
      expect(skillValidation.getPreSelectedSkills).toHaveBeenCalledWith(DEFAULT_FORM_DATA, null);
    });

    it('callbacks pass empty array when allFeats is []', async () => {
      renderSkills(DEFAULT_FORM_DATA, MOCK_SET_FORM_DATA, []);
      const config = useWizardConfig.mock.calls[0][0];
      skillValidation.validateSkills.mockResolvedValue([]);
      skillValidation.getSkillLimits.mockResolvedValue({ allowed: 3 });
      skillValidation.getExpertiseLimits.mockResolvedValue({ allowed: true, count: 1 });
      skillValidation.getPreSelectedSkills.mockResolvedValue([]);

      await config.validateFn(DEFAULT_FORM_DATA);
      expect(skillValidation.validateSkills).toHaveBeenCalledWith(DEFAULT_FORM_DATA, []);

      await config.slots[0].get(DEFAULT_FORM_DATA);
      expect(skillValidation.getSkillLimits).toHaveBeenCalledWith(DEFAULT_FORM_DATA, []);

      await config.slots[1].get(DEFAULT_FORM_DATA);
      expect(skillValidation.getExpertiseLimits).toHaveBeenCalledWith(DEFAULT_FORM_DATA, []);

      await config.preSelect.getFn(DEFAULT_FORM_DATA);
      expect(skillValidation.getPreSelectedSkills).toHaveBeenCalledWith(DEFAULT_FORM_DATA, []);
    });
  });

  describe('preSelect merge behavior', () => {
    it('appends non-duplicate skills to existing skillProficiencies', () => {
      renderSkills();
      const config = useWizardConfig.mock.calls[0][0];
      const prev = { skillProficiencies: ['Athletics'] };
      const items = ['Stealth', 'Athletics'];
      const result = config.preSelect.merge(prev, items);
      expect(result.skillProficiencies).toEqual(['Athletics', 'Stealth']);
    });

    it('does not duplicate skills already in skillProficiencies', () => {
      renderSkills();
      const config = useWizardConfig.mock.calls[0][0];
      const prev = { skillProficiencies: ['Athletics', 'Stealth'] };
      const items = ['Stealth', 'Perception'];
      const result = config.preSelect.merge(prev, items);
      expect(result.skillProficiencies).toEqual(['Athletics', 'Stealth', 'Perception']);
    });

    it('creates skillProficiencies array when prev lacks it', () => {
      renderSkills();
      const config = useWizardConfig.mock.calls[0][0];
      const prev = {};
      const items = ['Athletics'];
      const result = config.preSelect.merge(prev, items);
      expect(result.skillProficiencies).toEqual(['Athletics']);
    });

    it('handles empty items array gracefully', () => {
      renderSkills();
      const config = useWizardConfig.mock.calls[0][0];
      const prev = { skillProficiencies: ['Athletics'] };
      const result = config.preSelect.merge(prev, []);
      expect(result.skillProficiencies).toEqual(['Athletics']);
    });

    it('preserves other properties in prev during merge', () => {
      renderSkills();
      const config = useWizardConfig.mock.calls[0][0];
      const prev = { skillProficiencies: ['Athletics'], name: 'Test' };
      const items = ['Stealth'];
      const result = config.preSelect.merge(prev, items);
      expect(result).toEqual({ skillProficiencies: ['Athletics', 'Stealth'], name: 'Test' });
    });
  });

  describe('integration: end-to-end hook behavior', () => {
    it('returns resolved values from skillValidation callbacks through useWizardConfig', async () => {
      useWizardConfig.mockReturnValue({
        skillLimits: { maxSkills: 5 },
        expertiseLimits: { allowed: true, count: 2 },
        preSelectedSkills: ['Athletics'],
        warnings: ['Expertise warning'],
        setWarnings: vi.fn(),
      });

      const { result } = renderSkills();
      await waitFor(() => {
        expect(result.current.skillLimits).toEqual({ maxSkills: 5 });
        expect(result.current.expertiseLimits).toEqual({ allowed: true, count: 2 });
        expect(result.current.preSelectedSkills).toEqual(['Athletics']);
        expect(result.current.skillWarnings).toEqual(['Expertise warning']);
      });
    });

    it('setWarnings from useWizardConfig is accessible on the result', () => {
      const mockSetWarnings = vi.fn();
      useWizardConfig.mockReturnValue({
        skillLimits: null,
        expertiseLimits: null,
        preSelectedSkills: [],
        warnings: [],
        setWarnings: mockSetWarnings,
      });

      const { result } = renderSkills();
      expect(result.current.setWarnings).toBe(mockSetWarnings);
    });

    it('handles missing optional formData fields gracefully', () => {
      const minimalFormData = { rules: '5e', level: 1 };
      useWizardConfig.mockReturnValue({
        skillLimits: null,
        expertiseLimits: null,
        preSelectedSkills: [],
        warnings: [],
        setWarnings: vi.fn(),
      });

      const { result } = renderSkills(minimalFormData);
      expect(result.current.skillLimits).toBeNull();
      expect(result.current.expertiseLimits).toBeNull();
      expect(result.current.preSelectedSkills).toEqual([]);
      expect(result.current.skillWarnings).toEqual([]);
    });
  });
});
