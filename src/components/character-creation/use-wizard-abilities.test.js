import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardAbilities from './use-wizard-abilities.js';

// Mock the utils module
vi.mock('../../config/utils.js', () => ({
  getPointBuyCosts: vi.fn()
}));

import { getPointBuyCosts } from '../../config/utils.js';

describe('useWizardAbilities', () => {
  const mockFormData = {
    abilities: [
         { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
         { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0 },
         { name: 'Constitution', baseScore: 12, abilityImprovements: 0, miscBonus: 0 },
         { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
         { name: 'Wisdom', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
         { name: 'Charisma', baseScore: 8, abilityImprovements: 0, miscBonus: 0 }
        ],
    rules: '5e'
      };
  const mockSetErrors = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getPointBuyCosts.mockResolvedValue({
       8: 0,
       9: 1,
       10: 2,
       11: 3,
       12: 4,
       13: 5,
       14: 7,
       15: 9
        });
       });

  it('should not validate when not on step 5', async () => {
    const { result } = renderHook(() =>
      useWizardAbilities(mockFormData, 4, mockSetErrors)
        );

    await waitFor(() => {
          // Wait for useEffect to run
      expect(result.current).toHaveProperty('calculateTotalPointsSpent');
        });

         // Should not have called setErrors for validation
    expect(mockSetErrors).not.toHaveBeenCalled();
      });

  it('should validate abilities when on step 5', async () => {
    renderHook(() =>
      useWizardAbilities(mockFormData, 5, mockSetErrors)
        );

    await waitFor(() => {
      expect(mockSetErrors).toHaveBeenCalled();
      });
       });

  it('should return calculateTotalPointsSpent function', () => {
    const { result } = renderHook(() =>
      useWizardAbilities(mockFormData, 5, mockSetErrors)
        );

    expect(result.current).toHaveProperty('calculateTotalPointsSpent');
    expect(typeof result.current.calculateTotalPointsSpent).toBe('function');
      });

  it('should calculate total points spent', async () => {
    const { result } = renderHook(() =>
      useWizardAbilities(mockFormData, 5, mockSetErrors)
        );

    const totalPoints = await result.current.calculateTotalPointsSpent(
      mockFormData.abilities,
      -1,
      null
       );

         // 15 (9) + 14 (7) + 12 (4) + 10 (2) + 8 (0) + 8 (0) = 22
    expect(totalPoints).toBe(22);
      });

  it('should handle ability score below 8', async () => {
    const formDataWithLowScore = {
        ...mockFormData,
      abilities: [
           { name: 'Strength', baseScore: 7, abilityImprovements: 0, miscBonus: 0 },
           ...mockFormData.abilities.slice(1)
           ]
         };

     renderHook(() =>
      useWizardAbilities(formDataWithLowScore, 5, mockSetErrors)
        );

    await waitFor(() => {
      expect(mockSetErrors).toHaveBeenCalled();
        });

          // Check that errors include the base score validation
          // The setErrors is called with a function, so we need to call it to get the errors
    const setErrorsCall = mockSetErrors.mock.calls[0][0];
    expect(typeof setErrorsCall).toBe('function');
    
    // Call the function with an empty object to get the errors
    const errors = setErrorsCall({});
    expect(errors).toHaveProperty('ability_0_baseScore');
       });

  it('should handle ability score above 15', async () => {
    const formDataWithHighScore = {
         ...mockFormData,
      abilities: [
           { name: 'Strength', baseScore: 16, abilityImprovements: 0, miscBonus: 0 },
           ...mockFormData.abilities.slice(1)
           ]
         };

     renderHook(() =>
      useWizardAbilities(formDataWithHighScore, 5, mockSetErrors)
        );

    await waitFor(() => {
      expect(mockSetErrors).toHaveBeenCalled();
        });

          // Check that errors include the base score validation
          // The setErrors is called with a function, so we need to call it to get the errors
    const setErrorsCall = mockSetErrors.mock.calls[0][0];
    expect(typeof setErrorsCall).toBe('function');
    
    // Call the function with an empty object to get the errors
    const errors = setErrorsCall({});
    expect(errors).toHaveProperty('ability_0_baseScore');
       });

  it('should handle total score exceeding 20', async () => {
      const formDataWithHighTotal = {
             ...mockFormData,
        abilities: [
              { name: 'Strength', baseScore: 15, abilityImprovements: 6, miscBonus: 0 },
              ...mockFormData.abilities.slice(1)
              ]
            };

       renderHook(() =>
        useWizardAbilities(formDataWithHighTotal, 5, mockSetErrors)
            );

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
            });

             // Check that errors include the total score validation
             // The setErrors is called with a function, so we need to call it to get the errors
      const setErrorsCall = mockSetErrors.mock.calls[0][0];
      expect(typeof setErrorsCall).toBe('function');
    
       // Call the function with an empty object to get the errors
      const errors = setErrorsCall({});
      expect(errors).toHaveProperty('ability_0_totalScore');
          });

  it('should handle points exceeding budget', async () => {
    const formDataWithExcessPoints = {
         ...mockFormData,
      abilities: [
           { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
           { name: 'Dexterity', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
           { name: 'Constitution', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
           { name: 'Intelligence', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
           { name: 'Wisdom', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
           { name: 'Charisma', baseScore: 15, abilityImprovements: 0, miscBonus: 0 }
           ]
         };

     renderHook(() =>
      useWizardAbilities(formDataWithExcessPoints, 5, mockSetErrors)
        );

    await waitFor(() => {
      expect(mockSetErrors).toHaveBeenCalled();
        });

          // Check that errors include the points exceeded validation
          // The setErrors is called with a function, so we need to call it to get the errors
    const setErrorsCall = mockSetErrors.mock.calls[0][0];
    expect(typeof setErrorsCall).toBe('function');
    
    // Call the function with an empty object to get the errors
    const errors = setErrorsCall({});
    expect(errors).toHaveProperty('pointsExceeded');
       });
});
