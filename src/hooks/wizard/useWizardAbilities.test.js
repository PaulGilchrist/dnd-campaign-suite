import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardAbilities from './useWizardAbilities.js';

// Mock the utils module
vi.mock('../../config/utils.js', () => ({
  getPointBuyCosts: vi.fn(),
  getPointBuyCostsSync: vi.fn(() => ({ 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 }))
}));

// Mock race buff service
vi.mock('../../services/character/raceBuffService.js', () => ({
  computeRaceBuffs: vi.fn(() => ({ abilityScoreIncreases: [] }))
}));

// Mock data loader
vi.mock('../../services/ui/dataLoader.js', () => ({
  loadValidationRules: vi.fn(() => Promise.resolve({ point_buy: { total_points: 27 } }))
}));

import { getPointBuyCosts } from '../../config/utils.js';
import { computeRaceBuffs } from '../../services/character/raceBuffService.js';
import { loadValidationRules } from '../../services/ui/dataLoader.js';

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

function makeAbility(name, baseScore, featIncrease = 0, miscIncrease = 0, backgroundIncrease = 0, racialIncrease = 0) {
  return { name, baseScore, featIncrease, miscIncrease, backgroundIncrease, racialIncrease };
}

function makeFormData(abilities, rules = '5e', race = null) {
  return { abilities, rules, race };
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
    computeRaceBuffs.mockReturnValue({ abilityScoreIncreases: [] });
    loadValidationRules.mockResolvedValue({ point_buy: { total_points: 27 } });
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
      const lowCostAbilities = [
        makeAbility('Strength', 8),
        makeAbility('Dexterity', 8),
        makeAbility('Constitution', 8),
        makeAbility('Intelligence', 8),
        makeAbility('Wisdom', 8),
        makeAbility('Charisma', 8)
      ];
      const { result } = renderWizardAbilities(makeFormData(lowCostAbilities), 5, mockSetErrors, mockUpdateAbility);

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

    it('should reject base scores above 15', () => {
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors, mockUpdateAbility);

      result.current.onAbilityBaseScoreChange(0, '20');

      expect(mockUpdateAbility).not.toHaveBeenCalled();
    });

    it('should reject base scores below 8', () => {
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors, mockUpdateAbility);

      result.current.onAbilityBaseScoreChange(0, '5');

      expect(mockUpdateAbility).not.toHaveBeenCalled();
    });

    it('should reject base score change when total points would exceed 27', () => {
      const highCostAbilities = [
        makeAbility('Strength', 15),
        makeAbility('Dexterity', 15),
        makeAbility('Constitution', 15),
        makeAbility('Intelligence', 15),
        makeAbility('Wisdom', 15),
        makeAbility('Charisma', 15)
      ];
      const { result } = renderWizardAbilities(makeFormData(highCostAbilities), 5, mockSetErrors, mockUpdateAbility);

      // All at 15 = 54 points total. Changing index 0 from 15 to 14 costs 7 instead of 9:
      // new total = 7 + 9 + 9 + 9 + 9 + 9 = 52, still exceeds 27
      result.current.onAbilityBaseScoreChange(0, '14');

      expect(mockUpdateAbility).not.toHaveBeenCalled();
    });

    it('should accept base score change when total points stay within 27', () => {
      const { result } = renderWizardAbilities(makeFormData(defaultAbilities()), 5, mockSetErrors, mockUpdateAbility);

      // Dexterity: 14 (cost 7) -> 15 (cost 9): 22 - 7 + 9 = 24, within limit
      result.current.onAbilityBaseScoreChange(1, '15');

      expect(mockUpdateAbility).toHaveBeenCalledWith(1, 'baseScore', 15);
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

    it('should account for racial increase when checking total cap', () => {
      computeRaceBuffs.mockReturnValue({
        abilityScoreIncreases: [{ name: 'Strength', amount: 2 }]
      });

      const formData = makeFormData(
        defaultAbilities(),
        '5e',
        { name: 'Mountain Dwarf', subrace: null }
      );

      const { result } = renderWizardAbilities(formData, 5, mockSetErrors, mockUpdateAbility);

      const initialCallCount = mockUpdateAbility.mock.calls.length;

      // Strength: 15 + 2 (racial) = 17, so miscIncrease of 3 is valid (17+3=20)
      result.current.onAbilityMiscIncreaseChange(0, '3');
      expect(mockUpdateAbility).toHaveBeenCalledWith(0, 'miscIncrease', 3);

      // miscIncrease of 4 would make 17+4=21, blocked
      result.current.onAbilityMiscIncreaseChange(0, '4');
      // Only one additional call for the valid miscIncrease (the blocked one should not call)
      expect(mockUpdateAbility).toHaveBeenCalledTimes(initialCallCount + 1);
    });

    it('should account for subrace racial increase in onAbilityMiscIncreaseChange', () => {
      const raceBuffResult = { abilityScoreIncreases: [{ name: 'Strength', amount: 1 }] };
      computeRaceBuffs.mockReturnValue(raceBuffResult);

      const formData = makeFormData(
        defaultAbilities(),
        '5e',
        { name: 'Custom Dragonborn', subrace: { name: 'Azure Dragon' } }
      );

      const { result } = renderWizardAbilities(formData, 5, mockSetErrors, mockUpdateAbility);

      const initialCallCount = mockUpdateAbility.mock.calls.length;

      // With mock returning Strength:1 for both race and subrace, racialIncrease = 2
      // Strength: 15 + 2 = 17, so miscIncrease of 3 is valid (17+3=20)
      result.current.onAbilityMiscIncreaseChange(0, '3');
      expect(mockUpdateAbility).toHaveBeenCalledWith(0, 'miscIncrease', 3);

      // miscIncrease of 4 would make 17+4=21, blocked
      result.current.onAbilityMiscIncreaseChange(0, '4');
      expect(mockUpdateAbility).toHaveBeenCalledTimes(initialCallCount + 1);
    });
  });

  describe('race buffs sync (first useEffect)', () => {
    it('should skip race buffs sync when ruleset is not 5e', () => {
      const formData = makeFormData(
        defaultAbilities(),
        '2024',
        { name: 'Mountain Dwarf', subrace: null }
      );

      renderWizardAbilities(formData, 5, mockSetErrors, mockUpdateAbility);

      expect(computeRaceBuffs).not.toHaveBeenCalled();
    });

    it('should skip race buffs sync when no race is selected', () => {
      const formData = makeFormData(defaultAbilities(), '5e');

      renderWizardAbilities(formData, 5, mockSetErrors, mockUpdateAbility);

      expect(computeRaceBuffs).not.toHaveBeenCalled();
    });

    it('should skip race buffs sync when race has no name', () => {
      const formData = makeFormData(
        defaultAbilities(),
        '5e',
        { name: null, subrace: null }
      );

      renderWizardAbilities(formData, 5, mockSetErrors, mockUpdateAbility);

      expect(computeRaceBuffs).not.toHaveBeenCalled();
    });

    it('should update racialIncrease when race provides ability bonuses', () => {
      computeRaceBuffs.mockReturnValue({
        abilityScoreIncreases: [
          { name: 'Strength', amount: 2 },
          { name: 'Constitution', amount: 2 }
        ]
      });

      const formData = makeFormData(
        defaultAbilities(),
        '5e',
        { name: 'Mountain Dwarf', subrace: null }
      );

      renderWizardAbilities(formData, 5, mockSetErrors, mockUpdateAbility);

      expect(mockUpdateAbility).toHaveBeenCalledWith(0, 'racialIncrease', 2);
      expect(mockUpdateAbility).toHaveBeenCalledWith(2, 'racialIncrease', 2);
    });

    it('should combine race and subrace racial bonuses for the same ability', () => {
      computeRaceBuffs
        .mockReturnValueOnce({
          abilityScoreIncreases: [{ name: 'Intelligence', amount: 1 }]
        })
        .mockReturnValueOnce({
          abilityScoreIncreases: [{ name: 'Intelligence', amount: 1 }]
        });

      const formData = makeFormData(
        defaultAbilities(),
        '5e',
        { name: 'Custom Dragonborn', subrace: { name: 'Azure Dragon' } }
      );

      renderWizardAbilities(formData, 5, mockSetErrors, mockUpdateAbility);

      expect(mockUpdateAbility).toHaveBeenCalledWith(3, 'racialIncrease', 2);
    });

    it('should not update racialIncrease if it already matches', () => {
      computeRaceBuffs.mockReturnValue({
        abilityScoreIncreases: [{ name: 'Strength', amount: 2 }]
      });

      const abilities = [
        makeAbility('Strength', 15, 0, 0, 0, 2),
        makeAbility('Dexterity', 14, 0, 0, 0, 0),
        makeAbility('Constitution', 12, 0, 0, 0, 0),
        makeAbility('Intelligence', 10, 0, 0, 0, 0),
        makeAbility('Wisdom', 8, 0, 0, 0, 0),
        makeAbility('Charisma', 8, 0, 0, 0, 0)
      ];

      const formData = makeFormData(abilities, '5e', { name: 'Mountain Dwarf', subrace: null });

      renderWizardAbilities(formData, 5, mockSetErrors, mockUpdateAbility);

      expect(mockUpdateAbility).not.toHaveBeenCalled();
    });

    it('should update racialIncrease when it differs from current value', () => {
      computeRaceBuffs.mockReturnValue({
        abilityScoreIncreases: [{ name: 'Strength', amount: 2 }]
      });

      const abilities = [
        makeAbility('Strength', 15, 0, 0, 0, 0),
        makeAbility('Dexterity', 14, 0, 0, 0, 0),
        makeAbility('Constitution', 12, 0, 0, 0, 0),
        makeAbility('Intelligence', 10, 0, 0, 0, 0),
        makeAbility('Wisdom', 8, 0, 0, 0, 0),
        makeAbility('Charisma', 8, 0, 0, 0, 0)
      ];

      const formData = makeFormData(abilities, '5e', { name: 'Mountain Dwarf', subrace: null });

      renderWizardAbilities(formData, 5, mockSetErrors, mockUpdateAbility);

      expect(mockUpdateAbility).toHaveBeenCalledWith(0, 'racialIncrease', 2);
    });
  });

  describe('validation with race/subrace', () => {
    it('should include racial increase in total score during validation', async () => {
      computeRaceBuffs.mockReturnValue({
        abilityScoreIncreases: [{ name: 'Strength', amount: 2 }]
      });

      const formData = makeFormData(
        [makeAbility('Strength', 15), ...defaultAbilities().slice(1)],
        '5e',
        { name: 'Mountain Dwarf', subrace: null }
      );

      renderWizardAbilities(formData, 5, mockSetErrors, mockUpdateAbility);

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const errors = mockSetErrors.mock.calls[0][0]({});
      expect(errors.ability_0_totalScore).toBeUndefined();
    });

    it('should include subrace racial increase in total score during validation', async () => {
      const racialBuffResult = { abilityScoreIncreases: [{ name: 'Strength', amount: 1 }] };
      computeRaceBuffs
        .mockReturnValueOnce(racialBuffResult)
        .mockReturnValueOnce(racialBuffResult)
        .mockReturnValueOnce(racialBuffResult)
        .mockReturnValueOnce(racialBuffResult);

      const formData = makeFormData(
        [makeAbility('Strength', 15), ...defaultAbilities().slice(1)],
        '5e',
        { name: 'Custom Dragonborn', subrace: { name: 'Azure Dragon' } }
      );

      renderWizardAbilities(formData, 5, mockSetErrors, mockUpdateAbility);

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const errors = mockSetErrors.mock.calls[0][0]({});
      expect(errors.ability_0_totalScore).toBeUndefined();
    });

    it('should error when race + subrace racial increases push total above 20', async () => {
      const racialBuffResult = { abilityScoreIncreases: [{ name: 'Strength', amount: 3 }] };
      computeRaceBuffs
        .mockReturnValueOnce(racialBuffResult)
        .mockReturnValueOnce(racialBuffResult)
        .mockReturnValueOnce(racialBuffResult)
        .mockReturnValueOnce(racialBuffResult);

      const formData = makeFormData(
        [makeAbility('Strength', 15), ...defaultAbilities().slice(1)],
        '5e',
        { name: 'Mountain Dwarf', subrace: { name: 'Azure Dragon' } }
      );

      renderWizardAbilities(formData, 5, mockSetErrors, mockUpdateAbility);

      await waitFor(() => {
        expect(mockSetErrors).toHaveBeenCalled();
      });

      const errors = mockSetErrors.mock.calls[0][0]({});
      expect(errors.ability_0_totalScore).toBe('Total score (base + feat + background + racial + misc) cannot exceed 20');
    });
  });
});
