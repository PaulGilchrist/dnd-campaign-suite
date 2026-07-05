// @cleaned-by-ai
// @improved-by-ai
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

function makeAbility(name, baseScore, featIncrease = 0, miscIncrease = 0, backgroundIncrease = 0) {
  return { name, baseScore, featIncrease, miscIncrease, backgroundIncrease };
}

function makeFormData(abilities, rules = '5e') {
  return { abilities, rules };
}

function defaultAbilities() {
  return [
    makeAbility('Strength', 15),
    makeAbility('Dexterity', 14),
    makeAbility('Constitution', 12),
    makeAbility('Intelligence', 10),
    makeAbility('Wisdom', 8),
    makeAbility('Charisma', 8)
  ];
}

function renderWizardAbilities(formData, currentStep, setErrors, updateAbility) {
  return renderHook(() =>
    useWizardAbilities(formData ?? makeFormData(defaultAbilities()), currentStep, setErrors, updateAbility)
  );
}

describe('useWizardAbilities', () => {
  const mockSetErrors = vi.fn();
  const mockUpdateAbility = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getPointBuyCosts.mockResolvedValue(DEFAULT_COSTS);
  });

  describe('validation (step 5)', () => {
    it('should skip validation when not on step 5', () => {
      renderWizardAbilities(makeFormData(defaultAbilities()), 4, mockSetErrors);

      expect(mockSetErrors).not.toHaveBeenCalled();
    });

    it('should run validation when on step 5', async () => {
      renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors);

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });
    });

    it('should error when base score is below 8', async () => {
      const formData = makeFormData([
        makeAbility('Strength', 7),
        ...defaultAbilities().slice(1)
      ]);

      renderWizardAbilities(formData, 5, mockSetErrors);

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const errors = mockSetErrors.mock.calls[0][0]({});
      expect(errors.ability_0_baseScore).toBeDefined();
    });

    it('should error when base score exceeds 15', async () => {
      const formData = makeFormData([
        makeAbility('Strength', 16),
        ...defaultAbilities().slice(1)
      ]);

      renderWizardAbilities(formData, 5, mockSetErrors);

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const errors = mockSetErrors.mock.calls[0][0]({});
      expect(errors.ability_0_baseScore).toBeDefined();
    });

    it('should error when total score (base + improvements) exceeds 20', async () => {
      const formData = makeFormData([
        makeAbility('Strength', 15, 6),
        ...defaultAbilities().slice(1)
      ]);

      renderWizardAbilities(formData, 5, mockSetErrors);

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const errors = mockSetErrors.mock.calls[0][0]({});
      expect(errors.ability_0_totalScore).toBeDefined();
    });

    it('should error when point buy exceeds 27', async () => {
      const formData = makeFormData(defaultAbilities().map(() => makeAbility('Stat', 15)));

      renderWizardAbilities(formData, 5, mockSetErrors);

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const errors = mockSetErrors.mock.calls[0][0]({});
      expect(errors.pointsExceeded).toBeDefined();
    });

    it('should error when miscIncrease is negative', async () => {
      const formData = makeFormData([
        makeAbility('Strength', 15, 0, -2),
        ...defaultAbilities().slice(1)
      ]);

      renderWizardAbilities(formData, 5, mockSetErrors);

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const errors = mockSetErrors.mock.calls[0][0]({});
      expect(errors.ability_0_miscIncrease).toBeDefined();
    });

    it('should not error for negative featIncrease', async () => {
      const formData = makeFormData([
        makeAbility('Strength', 15, -1),
        ...defaultAbilities().slice(1)
      ]);

      renderWizardAbilities(formData, 5, mockSetErrors);

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const errors = mockSetErrors.mock.calls[0][0]({});
      expect(errors.ability_0_featIncrease).toBeUndefined();
    });

    it('should clear stale ability errors from previous validation', async () => {
      renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors);

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const prevErrors = {
        ability_0_baseScore: 'old error',
        ability_3_totalScore: 'old error',
        pointsExceeded: 'old points error',
        unrelatedField: 'should be preserved'
      };

      const errors = mockSetErrors.mock.calls[0][0](prevErrors);
      expect(errors.ability_0_baseScore).toBeUndefined();
      expect(errors.ability_3_totalScore).toBeUndefined();
      expect(errors.pointsExceeded).toBeUndefined();
      expect(errors.unrelatedField).toBe('should be preserved');
    });

    it('should not produce errors for all abilities at minimum (8)', async () => {
      const allEights = defaultAbilities().map(() => makeAbility('Stat', 8));
      renderWizardAbilities(makeFormData(allEights), 5, mockSetErrors);

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const errors = mockSetErrors.mock.calls[0][0]({});
      expect(Object.keys(errors)).toHaveLength(0);
    });

    it('should treat NaN baseScore as 8 (valid)', async () => {
      const formData = makeFormData([
        { name: 'Strength', baseScore: NaN, featIncrease: 0, miscIncrease: 0, backgroundIncrease: 0 },
        ...defaultAbilities().slice(1)
      ]);

      renderWizardAbilities(formData, 5, mockSetErrors);

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const errors = mockSetErrors.mock.calls[0][0]({});
      expect(errors.ability_0_baseScore).toBeUndefined();
    });

    it('should use ruleset from formData for point cost lookup', async () => {
      renderWizardAbilities(makeFormData(defaultAbilities(), '2024'), 5, mockSetErrors);

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      expect(getPointBuyCosts).toHaveBeenCalledWith('2024');
    });
  });

  describe('calculateTotalPointsSpent', () => {
    it('should return a function', () => {
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors);

      expect(typeof result.current.calculateTotalPointsSpent).toBe('function');
    });

    it('should calculate total points for default abilities (22)', async () => {
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors);

      const total = await result.current.calculateTotalPointsSpent(defaultAbilities(), -1, null);

      // 9 + 7 + 4 + 2 + 0 + 0 = 22
      expect(total).toBe(22);
    });

    it('should return 0 for all abilities at score 8', async () => {
      const allEights = defaultAbilities().map(() => makeAbility('Stat', 8));
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors);

      const total = await result.current.calculateTotalPointsSpent(allEights, -1, null);

      expect(total).toBe(0);
    });

    it('should return 54 for all abilities at score 15', async () => {
      const allFifteens = defaultAbilities().map(() => makeAbility('Stat', 15));
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors);

      const total = await result.current.calculateTotalPointsSpent(allFifteens, -1, null);

      expect(total).toBe(54);
    });

    it('should replace cost for a specific ability by index', async () => {
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors);

      // Constitution (index 2) changes from 12 (cost 4) to 15 (cost 9): 22 - 4 + 9 = 27
      const total = await result.current.calculateTotalPointsSpent(defaultAbilities(), 2, 15);

      expect(total).toBe(27);
    });

    it('should treat unknown baseScore as cost 0', async () => {
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors);

      // Replace index 0 (cost 9) with 7 (not in table, cost 0): 22 - 9 + 0 = 13
      const total = await result.current.calculateTotalPointsSpent(defaultAbilities(), 0, 7);

      expect(total).toBe(13);
    });

    it('should use 2024 ruleset when configured', async () => {
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities(), '2024'), 5, mockSetErrors);

      await result.current.calculateTotalPointsSpent(defaultAbilities(), -1, null);

      expect(getPointBuyCosts).toHaveBeenCalledWith('2024');
    });
  });

  describe('onAbilityBaseScoreChange', () => {
    it('should call updateAbility with parsed integer value', () => {
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors, mockUpdateAbility);

      result.current.onAbilityBaseScoreChange(2, '15');

      expect(mockUpdateAbility).toHaveBeenCalledWith(2, 'baseScore', 15);
    });

    it('should default to 8 when value is not a valid number', () => {
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors, mockUpdateAbility);

      result.current.onAbilityBaseScoreChange(3, 'abc');

      expect(mockUpdateAbility).toHaveBeenCalledWith(3, 'baseScore', 8);
    });

    it('should default to 8 when value is empty string', () => {
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors, mockUpdateAbility);

      result.current.onAbilityBaseScoreChange(4, '');

      expect(mockUpdateAbility).toHaveBeenCalledWith(4, 'baseScore', 8);
    });

    it('should not perform any validation — delegates to updateAbility only', () => {
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors, mockUpdateAbility);

      // Setting a score above 15 should still call updateAbility (validation is separate)
      result.current.onAbilityBaseScoreChange(0, '20');

      expect(mockUpdateAbility).toHaveBeenCalledWith(0, 'baseScore', 20);
      expect(mockSetErrors).not.toHaveBeenCalled();
    });
  });

  describe('onAbilityMiscIncreaseChange', () => {
    it('should call updateAbility with valid misc bonus', () => {
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors, mockUpdateAbility);

      result.current.onAbilityMiscIncreaseChange(0, '2');

      expect(mockUpdateAbility).toHaveBeenCalledWith(0, 'miscIncrease', 2);
    });

    it('should reject negative misc bonus', () => {
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors, mockUpdateAbility);

      result.current.onAbilityMiscIncreaseChange(2, '-3');

      expect(mockUpdateAbility).not.toHaveBeenCalled();
    });

    it('should reject misc bonus that would push total above 20', () => {
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors, mockUpdateAbility);

      // Strength: 15 + 0 + 0 + 6 = 21 > 20
      result.current.onAbilityMiscIncreaseChange(0, '6');

      expect(mockUpdateAbility).not.toHaveBeenCalled();
    });

    it('should default to 0 when value is not a valid number', () => {
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors, mockUpdateAbility);

      result.current.onAbilityMiscIncreaseChange(4, 'abc');

      // Charisma: 8 + 0 + 0 + 0 = 8, valid
      expect(mockUpdateAbility).toHaveBeenCalledWith(4, 'miscIncrease', 0);
    });

    it('should account for featIncrease when checking total cap', () => {
      const formWithImprovements = makeFormData([
        makeAbility('Strength', 15, 3),
        ...defaultAbilities().slice(1)
      ]);

      const { result } = renderWizardAbilities(formWithImprovements, 5, mockSetErrors, mockUpdateAbility);

      // 15 + 3 + 0 + 2 = 20, valid
      result.current.onAbilityMiscIncreaseChange(0, '2');
      expect(mockUpdateAbility).toHaveBeenCalledWith(0, 'miscIncrease', 2);

      // 15 + 3 + 0 + 3 = 21, blocked
      result.current.onAbilityMiscIncreaseChange(0, '3');
      expect(mockUpdateAbility).toHaveBeenCalledTimes(1);
    });
  });
});
