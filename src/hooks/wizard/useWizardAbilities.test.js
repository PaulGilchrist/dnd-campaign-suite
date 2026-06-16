import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardAbilities from './useWizardAbilities.js';

// Mock the utils module
vi.mock('../../config/utils.js', () => ({
  getPointBuyCosts: vi.fn()
}));

import { getPointBuyCosts } from '../../config/utils.js';

const DEFAULT_COSTS = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9
};

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
  const mockUpdateAbility = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getPointBuyCosts.mockResolvedValue(DEFAULT_COSTS);
  });

  describe('validation effect (step 5)', () => {
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

    it('should report error when base score is below 8', async () => {
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

      const setErrorsCall = mockSetErrors.mock.calls[0][0];
      expect(typeof setErrorsCall).toBe('function');

      const errors = setErrorsCall({});
      expect(errors).toHaveProperty('ability_0_baseScore');
    });

    it('should report error when base score exceeds 15', async () => {
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

      const setErrorsCall = mockSetErrors.mock.calls[0][0];
      expect(typeof setErrorsCall).toBe('function');

      const errors = setErrorsCall({});
      expect(errors).toHaveProperty('ability_0_baseScore');
    });

    it('should report error when total score exceeds 20', async () => {
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

      const setErrorsCall = mockSetErrors.mock.calls[0][0];
      expect(typeof setErrorsCall).toBe('function');

      const errors = setErrorsCall({});
      expect(errors).toHaveProperty('ability_0_totalScore');
    });

    it('should report error when points exceed 27 budget', async () => {
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

      const setErrorsCall = mockSetErrors.mock.calls[0][0];
      expect(typeof setErrorsCall).toBe('function');

      const errors = setErrorsCall({});
      expect(errors).toHaveProperty('pointsExceeded');
    });

    it('should include point total in pointsExceeded message', async () => {
      // 6 abilities at 15 = 6 * 9 = 54 points
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

      const setErrorsCall = mockSetErrors.mock.calls[0][0];
      const errors = setErrorsCall({});
      expect(errors.pointsExceeded).toContain('54');
    });

    it('should report error when abilityImprovements is negative', async () => {
      const formDataWithNegativeImprovements = {
        ...mockFormData,
        abilities: [
          { name: 'Strength', baseScore: 15, abilityImprovements: -1, miscBonus: 0 },
          ...mockFormData.abilities.slice(1)
        ]
      };

      renderHook(() =>
        useWizardAbilities(formDataWithNegativeImprovements, 5, mockSetErrors)
      );

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const setErrorsCall = mockSetErrors.mock.calls[0][0];
      expect(typeof setErrorsCall).toBe('function');

      const errors = setErrorsCall({});
      expect(errors).toHaveProperty('ability_0_abilityImprovements');
    });

    it('should report error when miscBonus is negative', async () => {
      const formDataWithNegativeMisc = {
        ...mockFormData,
        abilities: [
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: -2 },
          ...mockFormData.abilities.slice(1)
        ]
      };

      renderHook(() =>
        useWizardAbilities(formDataWithNegativeMisc, 5, mockSetErrors)
      );

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const setErrorsCall = mockSetErrors.mock.calls[0][0];
      expect(typeof setErrorsCall).toBe('function');

      const errors = setErrorsCall({});
      expect(errors).toHaveProperty('ability_0_miscBonus');
    });

    it('should clear stale ability errors from previous validation', async () => {
      renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors)
      );

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const setErrorsCall = mockSetErrors.mock.calls[0][0];
      expect(typeof setErrorsCall).toBe('function');

      // Simulate a previous state with stale ability errors
      const prevErrors = {
        ability_0_baseScore: 'old error',
        ability_3_totalScore: 'old error',
        pointsExceeded: 'old points error',
        unrelatedField: 'should be preserved'
      };

      const errors = setErrorsCall(prevErrors);
      // Old ability errors should be cleared
      expect(errors).not.toHaveProperty('ability_0_baseScore');
      expect(errors).not.toHaveProperty('ability_3_totalScore');
      expect(errors).not.toHaveProperty('pointsExceeded');
      // Unrelated errors should be preserved
      expect(errors).toHaveProperty('unrelatedField');
    });

    it('should pass the ruleset to getPointBuyCosts', async () => {
      renderHook(() =>
        useWizardAbilities({ ...mockFormData, rules: '2024' }, 5, mockSetErrors)
      );

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      expect(getPointBuyCosts).toHaveBeenCalledWith('2024');
    });

    it('should default to 5e when no ruleset is provided', async () => {
      const formDataNoRules = { ...mockFormData, rules: undefined };

      renderHook(() =>
        useWizardAbilities(formDataNoRules, 5, mockSetErrors)
      );

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      expect(getPointBuyCosts).toHaveBeenCalledWith('5e');
    });

    it('should not produce errors for all abilities at minimum (8)', async () => {
      const allEights = {
        ...mockFormData,
        abilities: [
          { name: 'Strength', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Dexterity', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Constitution', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Intelligence', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Wisdom', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Charisma', baseScore: 8, abilityImprovements: 0, miscBonus: 0 }
        ]
      };

      renderHook(() =>
        useWizardAbilities(allEights, 5, mockSetErrors)
      );

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const setErrorsCall = mockSetErrors.mock.calls[0][0];
      const errors = setErrorsCall({});
      // No errors at all — all 8s is valid (0 points, under 27)
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should handle NaN baseScore gracefully (default to 8)', async () => {
      const formDataNaN = {
        ...mockFormData,
        abilities: [
          { name: 'Strength', baseScore: NaN, abilityImprovements: 0, miscBonus: 0 },
          ...mockFormData.abilities.slice(1)
        ]
      };

      renderHook(() =>
        useWizardAbilities(formDataNaN, 5, mockSetErrors)
      );

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const setErrorsCall = mockSetErrors.mock.calls[0][0];
      const errors = setErrorsCall({});
      // NaN becomes 8 which is valid
      expect(errors).not.toHaveProperty('ability_0_baseScore');
    });
  });

  describe('calculateTotalPointsSpent', () => {
    it('should return calculateTotalPointsSpent function', () => {
      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors)
      );

      expect(result.current).toHaveProperty('calculateTotalPointsSpent');
      expect(typeof result.current.calculateTotalPointsSpent).toBe('function');
    });

    it('should calculate total points spent for all abilities', async () => {
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

    it('should return 0 for all abilities at score 8', async () => {
      const allEights = [
        { name: 'Strength', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
        { name: 'Dexterity', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
        { name: 'Constitution', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
        { name: 'Intelligence', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
        { name: 'Wisdom', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
        { name: 'Charisma', baseScore: 8, abilityImprovements: 0, miscBonus: 0 }
      ];

      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors)
      );

      const totalPoints = await result.current.calculateTotalPointsSpent(
        allEights,
        -1,
        null
      );

      expect(totalPoints).toBe(0);
    });

    it('should calculate 54 for all abilities at score 15', async () => {
      const allFifteens = [
        { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
        { name: 'Dexterity', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
        { name: 'Constitution', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
        { name: 'Intelligence', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
        { name: 'Wisdom', baseScore: 15, abilityImprovements: 0, miscBonus: 0 },
        { name: 'Charisma', baseScore: 15, abilityImprovements: 0, miscBonus: 0 }
      ];

      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors)
      );

      const totalPoints = await result.current.calculateTotalPointsSpent(
        allFifteens,
        -1,
        null
      );

      expect(totalPoints).toBe(54);
    });

    it('should replace a specific ability cost when index is provided', async () => {
      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors)
      );

      // Replace index 2 (Constitution, baseScore 12 → cost 4) with baseScore 15 → cost 9
      // Original: 9 (Str) + 7 (Dex) + 4 (Con) + 2 (Int) + 0 (Wis) + 0 (Cha) = 22
      // Replaced: 9 (Str) + 7 (Dex) + 9 (Con) + 2 (Int) + 0 (Wis) + 0 (Cha) = 27
      const totalPoints = await result.current.calculateTotalPointsSpent(
        mockFormData.abilities,
        2,
        15
      );

      expect(totalPoints).toBe(27);
    });

    it('should replace index even when newBaseScore is not in rules table', async () => {
      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors)
      );

      // Replace index 0 (Strength, baseScore 15 → cost 9) with baseScore 7 → not in rules
      const totalPoints = await result.current.calculateTotalPointsSpent(
        mockFormData.abilities,
        0,
        7
      );

      // 0 (Str replaced by 7, no cost) + 7 (Dex) + 4 (Con) + 2 (Int) + 0 (Wis) + 0 (Cha) = 13
      expect(totalPoints).toBe(13);
    });

    it('should handle NaN baseScore entries (default to 8, cost 0)', async () => {
      const abilitiesWithNaN = [
        { name: 'Strength', baseScore: NaN, abilityImprovements: 0, miscBonus: 0 },
        { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0 },
        { name: 'Constitution', baseScore: 12, abilityImprovements: 0, miscBonus: 0 },
        { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
        { name: 'Wisdom', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
        { name: 'Charisma', baseScore: 8, abilityImprovements: 0, miscBonus: 0 }
      ];

      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors)
      );

      const totalPoints = await result.current.calculateTotalPointsSpent(
        abilitiesWithNaN,
        -1,
        null
      );

      // NaN becomes 8 (cost 0) + 7 (14) + 4 (12) + 2 (10) + 0 (8) + 0 (8) = 13
      expect(totalPoints).toBe(13);
    });
  });

  describe('onAbilityBaseScoreChange', () => {
    it('should call updateAbility with parsed value', () => {
      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors, mockUpdateAbility)
      );

      result.current.onAbilityBaseScoreChange(2, '15');

      expect(mockUpdateAbility).toHaveBeenCalledWith(2, 'baseScore', 15);
    });

    it('should default to 8 when value is not a valid number', () => {
      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors, mockUpdateAbility)
      );

      result.current.onAbilityBaseScoreChange(3, 'abc');

      expect(mockUpdateAbility).toHaveBeenCalledWith(3, 'baseScore', 8);
    });

    it('should default to 8 when value is empty string', () => {
      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors, mockUpdateAbility)
      );

      result.current.onAbilityBaseScoreChange(4, '');

      expect(mockUpdateAbility).toHaveBeenCalledWith(4, 'baseScore', 8);
    });
  });

  describe('onAbilityImprovementChange', () => {
    it('should call updateAbility with valid improvements', () => {
      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors, mockUpdateAbility)
      );

      result.current.onAbilityImprovementChange(0, '4');

      // Strength: baseScore 15 + improvements 4 + misc 0 = 19 (<= 20)
      expect(mockUpdateAbility).toHaveBeenCalledWith(0, 'abilityImprovements', 4);
    });

    it('should not update when improvements are negative', () => {
      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors, mockUpdateAbility)
      );

      result.current.onAbilityImprovementChange(1, '-1');

      expect(mockUpdateAbility).not.toHaveBeenCalled();
    });

    it('should not update when total score would exceed 20', () => {
      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors, mockUpdateAbility)
      );

      // Strength: baseScore 15 + improvements 6 + misc 0 = 21 (> 20)
      result.current.onAbilityImprovementChange(0, '6');

      expect(mockUpdateAbility).not.toHaveBeenCalled();
    });

    it('should default to 0 when value is not a valid number', () => {
      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors, mockUpdateAbility)
      );

      result.current.onAbilityImprovementChange(2, 'abc');

      // NaN → 0, total = 12 + 0 + 0 = 12, valid
      expect(mockUpdateAbility).toHaveBeenCalledWith(2, 'abilityImprovements', 0);
    });

    it('should handle NaN baseScore in formData (default to 8)', () => {
      const formWithNaN = {
        ...mockFormData,
        abilities: [
          { name: 'Strength', baseScore: NaN, abilityImprovements: 0, miscBonus: 0 },
          ...mockFormData.abilities.slice(1)
        ]
      };

      const { result } = renderHook(() =>
        useWizardAbilities(formWithNaN, 5, mockSetErrors, mockUpdateAbility)
      );

      // NaN baseScore → parseInt returns NaN → || 8 → baseScore = 8
      // improvements 10 + baseScore 8 + misc 0 = 18 (<= 20), valid
      result.current.onAbilityImprovementChange(0, '10');
      expect(mockUpdateAbility).toHaveBeenCalledWith(0, 'abilityImprovements', 10);
    });

    it('should allow improvements up to but not exceeding 20 total with misc bonus', () => {
      const formWithMisc = {
        ...mockFormData,
        abilities: [
          { name: 'Strength', baseScore: 15, abilityImprovements: 0, miscBonus: 2 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Constitution', baseScore: 12, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Wisdom', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Charisma', baseScore: 8, abilityImprovements: 0, miscBonus: 0 }
        ]
      };

      const { result } = renderHook(() =>
        useWizardAbilities(formWithMisc, 5, mockSetErrors, mockUpdateAbility)
      );

      // Strength: baseScore 15 + misc 2 = 17, improvements 3 → total 20, valid
      result.current.onAbilityImprovementChange(0, '3');
      expect(mockUpdateAbility).toHaveBeenCalledWith(0, 'abilityImprovements', 3);

      // Strength: baseScore 15 + misc 2 = 17, improvements 4 → total 21, blocked
      result.current.onAbilityImprovementChange(0, '4');
      expect(mockUpdateAbility).toHaveBeenCalledTimes(1); // still only the first call
    });
  });

  describe('onAbilityMiscBonusChange', () => {
    it('should call updateAbility with valid misc bonus', () => {
      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors, mockUpdateAbility)
      );

      result.current.onAbilityMiscBonusChange(0, '2');

      // Strength: baseScore 15 + improvements 0 + misc 2 = 17 (<= 20)
      expect(mockUpdateAbility).toHaveBeenCalledWith(0, 'miscBonus', 2);
    });

    it('should not update when misc bonus is negative', () => {
      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors, mockUpdateAbility)
      );

      result.current.onAbilityMiscBonusChange(2, '-3');

      expect(mockUpdateAbility).not.toHaveBeenCalled();
    });

    it('should not update when total score would exceed 20', () => {
      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors, mockUpdateAbility)
      );

      // Strength: baseScore 15 + improvements 0 + misc 6 = 21 (> 20)
      result.current.onAbilityMiscBonusChange(0, '6');

      expect(mockUpdateAbility).not.toHaveBeenCalled();
    });

    it('should default to 0 when value is not a valid number', () => {
      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors, mockUpdateAbility)
      );

      result.current.onAbilityMiscBonusChange(4, 'abc');

      // NaN → 0, total = 8 + 0 + 0 = 8, valid
      expect(mockUpdateAbility).toHaveBeenCalledWith(4, 'miscBonus', 0);
    });

    it('should handle NaN baseScore in formData (default to 8)', () => {
      const formWithNaN = {
        ...mockFormData,
        abilities: [
          { name: 'Strength', baseScore: NaN, abilityImprovements: 0, miscBonus: 0 },
          ...mockFormData.abilities.slice(1)
        ]
      };

      const { result } = renderHook(() =>
        useWizardAbilities(formWithNaN, 5, mockSetErrors, mockUpdateAbility)
      );

      // NaN baseScore → parseInt returns NaN → || 8 → baseScore = 8
      // misc 10 + baseScore 8 + improvements 0 = 18 (<= 20), valid
      result.current.onAbilityMiscBonusChange(0, '10');
      expect(mockUpdateAbility).toHaveBeenCalledWith(0, 'miscBonus', 10);
    });

    it('should allow misc bonus up to but not exceeding 20 total with improvements', () => {
      const formWithImprovements = {
        ...mockFormData,
        abilities: [
          { name: 'Strength', baseScore: 15, abilityImprovements: 3, miscBonus: 0 },
          { name: 'Dexterity', baseScore: 14, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Constitution', baseScore: 12, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Intelligence', baseScore: 10, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Wisdom', baseScore: 8, abilityImprovements: 0, miscBonus: 0 },
          { name: 'Charisma', baseScore: 8, abilityImprovements: 0, miscBonus: 0 }
        ]
      };

      const { result } = renderHook(() =>
        useWizardAbilities(formWithImprovements, 5, mockSetErrors, mockUpdateAbility)
      );

      // Strength: baseScore 15 + improvements 3 = 18, misc 2 → total 20, valid
      result.current.onAbilityMiscBonusChange(0, '2');
      expect(mockUpdateAbility).toHaveBeenCalledWith(0, 'miscBonus', 2);

      // Strength: baseScore 15 + improvements 3 = 18, misc 3 → total 21, blocked
      result.current.onAbilityMiscBonusChange(0, '3');
      expect(mockUpdateAbility).toHaveBeenCalledTimes(1); // still only the first call
    });
  });

  describe('2024 ruleset', () => {
    it('should pass ruleset to getPointBuyCosts in calculateTotalPointsSpent', async () => {
      const { result } = renderHook(() =>
        useWizardAbilities({ ...mockFormData, rules: '2024' }, 5, mockSetErrors)
      );

      await result.current.calculateTotalPointsSpent(mockFormData.abilities, -1, null);

      expect(getPointBuyCosts).toHaveBeenCalledWith('2024');
    });

    it('should default to 5e when no ruleset is provided in calculateTotalPointsSpent', async () => {
      const formDataNoRules = { ...mockFormData, rules: undefined };

      const { result } = renderHook(() =>
        useWizardAbilities(formDataNoRules, 5, mockSetErrors)
      );

      await result.current.calculateTotalPointsSpent(mockFormData.abilities, -1, null);

      expect(getPointBuyCosts).toHaveBeenCalledWith('5e');
    });
  });

  describe('return value shape', () => {
    it('should return all expected functions', () => {
      const { result } = renderHook(() =>
        useWizardAbilities(mockFormData, 5, mockSetErrors)
      );

      expect(result.current).toHaveProperty('calculateTotalPointsSpent');
      expect(result.current).toHaveProperty('onAbilityBaseScoreChange');
      expect(result.current).toHaveProperty('onAbilityImprovementChange');
      expect(result.current).toHaveProperty('onAbilityMiscBonusChange');
      expect(typeof result.current.calculateTotalPointsSpent).toBe('function');
      expect(typeof result.current.onAbilityBaseScoreChange).toBe('function');
      expect(typeof result.current.onAbilityImprovementChange).toBe('function');
      expect(typeof result.current.onAbilityMiscBonusChange).toBe('function');
    });
  });
});
