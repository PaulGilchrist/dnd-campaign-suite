import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardSkills from './useWizardSkills.js';

// Mock the skill validation services
vi.mock('../services/character/skillValidation.js', () => ({
  validateSkills: vi.fn(),
  getSkillLimits: vi.fn(),
  getExpertiseLimits: vi.fn(),
  getPreSelectedSkills: vi.fn()
}));

import {
  validateSkills,
  getSkillLimits,
  getExpertiseLimits,
  getPreSelectedSkills
} from '../services/character/skillValidation.js';

describe('useWizardSkills', () => {
  const mockFormData = {
    class: { name: 'Fighter' },
    race: { name: 'Human' },
    background: 'Soldier',
    skillProficiencies: ['Athletics'],
    expertSkills: [],
    rules: '5e',
    level: 1
     };
  const mockSetFormData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    validateSkills.mockResolvedValue([]);
    getSkillLimits.mockResolvedValue({ maxSkills: 4 });
    getExpertiseLimits.mockResolvedValue({ maxExpertise: 0 });
    getPreSelectedSkills.mockResolvedValue([]);
     });

  it('should initialize with null limits and empty arrays', () => {
    const { result } = renderHook(() =>
      useWizardSkills(mockFormData, mockSetFormData)
       );

    expect(result.current.skillLimits).toBe(null);
    expect(result.current.expertiseLimits).toBe(null);
    expect(result.current.skillWarnings).toEqual([]);
    expect(result.current.preSelectedSkills).toEqual([]);
     });

  it('should load skill limits and warnings', async () => {
    const { result } = renderHook(() =>
      useWizardSkills(mockFormData, mockSetFormData)
       );

    await waitFor(() => {
      expect(result.current.skillLimits).not.toBe(null);
       });

    expect(result.current.skillLimits).toEqual({ maxSkills: 4 });
    expect(result.current.expertiseLimits).toEqual({ maxExpertise: 0 });
     });

  it('should load pre-selected skills', async () => {
    getPreSelectedSkills.mockResolvedValue(['Athletics', 'Intimidation']);

    const { result } = renderHook(() =>
      useWizardSkills(mockFormData, mockSetFormData)
       );

    await waitFor(() => {
      expect(result.current.preSelectedSkills.length).toBeGreaterThan(0);
       });

    expect(result.current.preSelectedSkills).toEqual(['Athletics', 'Intimidation']);
     });

  it('should add missing pre-selected skills to form data', async () => {
    getPreSelectedSkills.mockResolvedValue(['Athletics', 'Intimidation']);

    renderHook(() =>
      useWizardSkills(mockFormData, mockSetFormData)
        );

    await waitFor(() => {
      expect(mockSetFormData).toHaveBeenCalled();
       });

    expect(mockSetFormData).toHaveBeenCalledWith(expect.any(Function));
     });

  it('should not add skills that are already in form data', async () => {
      const formDataWithAllSkills = {
          ...mockFormData,
        skillProficiencies: ['Athletics', 'Intimidation']
            };
      getPreSelectedSkills.mockResolvedValue(['Athletics', 'Intimidation']);

      const { result } = renderHook(() =>
        useWizardSkills(formDataWithAllSkills, mockSetFormData)
            );

      await waitFor(() => {
            // Wait for pre-select to run
        expect(result.current.preSelectedSkills.length).toBeGreaterThan(0);
            });

          // setFormData is called but with an identity function that returns prev unchanged
          // because all skills are already present
      expect(mockSetFormData).toHaveBeenCalled();
      const setFormDataCall = mockSetFormData.mock.calls[0][0];
      expect(typeof setFormDataCall).toBe('function');
    
      // Call the function with the current form data to verify it returns unchanged data
      const returnedData = setFormDataCall(formDataWithAllSkills);
      expect(returnedData).toEqual(formDataWithAllSkills);
          });

  it('should handle validation errors gracefully', async () => {
    validateSkills.mockRejectedValue(new Error('Validation error'));
    console.error = vi.fn();

    const { result } = renderHook(() =>
      useWizardSkills(mockFormData, mockSetFormData)
       );

    await waitFor(() => {
        // Should still have empty warnings even on error
      expect(result.current.skillWarnings).toEqual([]);
       });
     });

  it('should return all expected properties', () => {
    const { result } = renderHook(() =>
      useWizardSkills(mockFormData, mockSetFormData)
       );

    expect(result.current).toHaveProperty('skillLimits');
    expect(result.current).toHaveProperty('expertiseLimits');
    expect(result.current).toHaveProperty('skillWarnings');
    expect(result.current).toHaveProperty('preSelectedSkills');
     });
});
