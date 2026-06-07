import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardResistances from './useWizardResistances.js';

// Mock the resistances validation service
vi.mock('../services/character/resistancesValidation.js', () => ({
  getPreSelectedResistances: vi.fn(),
  validateResistances: vi.fn()
}));

import {
  getPreSelectedResistances,
  validateResistances
} from '../services/character/resistancesValidation.js';

describe('useWizardResistances', () => {
  const mockFormData = {
    class: { name: 'Fighter' },
    race: { name: 'Dwarf', subrace: { name: 'Hill Dwarf' } },
    background: 'Soldier',
    resistances: [],
    immunities: [],
    rules: '5e',
    level: 1
       };
  const mockSetFormData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    validateResistances.mockResolvedValue([]);
    getPreSelectedResistances.mockResolvedValue({ resistances: [], immunities: [] });
       });

  it('should initialize with empty arrays', () => {
    const { result } = renderHook(() =>
      useWizardResistances(mockFormData, mockSetFormData)
         );

    expect(result.current.resistanceWarnings).toEqual([]);
    expect(result.current.preSelectedResistancesList).toEqual({ resistances: [], immunities: [] });
       });

  it('should load resistance warnings', async () => {
    validateResistances.mockResolvedValue(['Invalid resistance']);

    const { result } = renderHook(() =>
      useWizardResistances(mockFormData, mockSetFormData)
         );

    await waitFor(() => {
      expect(result.current.resistanceWarnings.length).toBeGreaterThan(0);
         });

    expect(result.current.resistanceWarnings).toEqual(['Invalid resistance']);
       });

  it('should load pre-selected resistances and immunities', async () => {
    getPreSelectedResistances.mockResolvedValue({
      resistances: ['Poison'],
      immunities: ['Disease']
       });

    const { result } = renderHook(() =>
      useWizardResistances(mockFormData, mockSetFormData)
         );

    await waitFor(() => {
      expect(result.current.preSelectedResistancesList.resistances.length).toBeGreaterThan(0);
         });

    expect(result.current.preSelectedResistancesList).toEqual({
      resistances: ['Poison'],
      immunities: ['Disease']
       });
       });

  it('should add missing pre-selected resistances to form data', async () => {
    getPreSelectedResistances.mockResolvedValue({
      resistances: ['Poison'],
      immunities: ['Disease']
        });

    renderHook(() =>
      useWizardResistances(mockFormData, mockSetFormData)
          );

    await waitFor(() => {
      expect(mockSetFormData).toHaveBeenCalled();
         });

    expect(mockSetFormData).toHaveBeenCalledWith(expect.any(Function));
       });

  it('should not add resistances that are already in form data', async () => {
      const formDataWithResistances = {
            ...mockFormData,
        resistances: ['Poison'],
        immunities: ['Disease']
              };
      getPreSelectedResistances.mockResolvedValue({
        resistances: ['Poison'],
        immunities: ['Disease']
            });

      const { result } = renderHook(() =>
        useWizardResistances(formDataWithResistances, mockSetFormData)
              );

      await waitFor(() => {
                // Wait for pre-select to run
        expect(result.current.preSelectedResistancesList.resistances.length).toBeGreaterThan(0);
              });

              // setFormData is called but with an identity function that returns prev unchanged
              // because all resistances are already present
      expect(mockSetFormData).toHaveBeenCalled();
      const setFormDataCall = mockSetFormData.mock.calls[0][0];
      expect(typeof setFormDataCall).toBe('function');
    
      // Call the function with the current form data to verify it returns unchanged data
      const returnedData = setFormDataCall(formDataWithResistances);
      expect(returnedData).toEqual(formDataWithResistances);
            });

  it('should handle validation errors gracefully', async () => {
    validateResistances.mockRejectedValue(new Error('Validation error'));
    console.error = vi.fn();

    const { result } = renderHook(() =>
      useWizardResistances(mockFormData, mockSetFormData)
         );

    await waitFor(() => {
           // Should still have empty warnings even on error
      expect(result.current.resistanceWarnings).toEqual([]);
         });
       });

  it('should handle pre-select errors gracefully', async () => {
    getPreSelectedResistances.mockRejectedValue(new Error('Fetch error'));
    console.error = vi.fn();

    const { result } = renderHook(() =>
      useWizardResistances(mockFormData, mockSetFormData)
         );

    await waitFor(() => {
           // Should still have empty preSelectedResistancesList even on error
      expect(result.current.preSelectedResistancesList).toEqual({ resistances: [], immunities: [] });
         });
       });

  it('should return all expected properties', () => {
    const { result } = renderHook(() =>
      useWizardResistances(mockFormData, mockSetFormData)
         );

    expect(result.current).toHaveProperty('resistanceWarnings');
    expect(result.current).toHaveProperty('preSelectedResistancesList');
    expect(result.current).toHaveProperty('setResistanceWarnings');
       });

  it('should allow setting resistance warnings', () => {
    const { result } = renderHook(() =>
      useWizardResistances(mockFormData, mockSetFormData)
         );

    act(() => {
      result.current.setResistanceWarnings(['New warning']);
         });

    expect(result.current.resistanceWarnings).toEqual(['New warning']);
       });
});
