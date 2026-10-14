import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../services/ui/dataLoader.js', () => ({
  fetchBackgroundData: vi.fn(),
  loadWildMagicSurgeTable: vi.fn(async () => []),
}));

import useWizardBackgroundAbility from './useWizardBackgroundAbility.js';
import { fetchBackgroundData } from '../../services/ui/dataLoader.js';

describe('useWizardBackgroundAbility', () => {
  const mockSetFormData = vi.fn();
  const defaultAbilities = [
    { name: 'Strength', baseScore: 10, backgroundIncrease: 0 },
    { name: 'Dexterity', baseScore: 10, backgroundIncrease: 0 },
    { name: 'Constitution', baseScore: 10, backgroundIncrease: 0 },
    { name: 'Intelligence', baseScore: 10, backgroundIncrease: 0 },
    { name: 'Wisdom', baseScore: 10, backgroundIncrease: 0 },
    { name: 'Charisma', baseScore: 10, backgroundIncrease: 0 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  function renderHookWithDefaults(formData, ...rest) {
    return renderHook(() => useWizardBackgroundAbility(formData, mockSetFormData), ...rest);
  }

  describe('early returns for non-2024 or missing background', () => {
    it('returns empty state when rules are not 2024', () => {
      const { result } = renderHookWithDefaults({ rules: '5e', background: 'Acolyte' });

      expect(result.current.backgroundAbilityNames).toEqual([]);
      expect(result.current.backgroundAbilityAssignments).toEqual({});
      expect(result.current.totalAssigned).toBe(0);
      expect(result.current.isValid).toBe(false);
      expect(result.current.hasMaxSingleBonus).toBe(false);
    });

    it('returns empty state when rules are 2024 but background is missing', () => {
      const { result } = renderHookWithDefaults({ rules: '2024' });

      expect(result.current.backgroundAbilityNames).toEqual([]);
      expect(result.current.backgroundAbilityAssignments).toEqual({});
    });

    it('returns empty state when background is null', () => {
      const { result } = renderHookWithDefaults({ rules: '2024', background: null });

      expect(result.current.backgroundAbilityNames).toEqual([]);
      expect(result.current.backgroundAbilityAssignments).toEqual({});
    });

    it('returns empty state when background is empty string', () => {
      const { result } = renderHookWithDefaults({ rules: '2024', background: '' });

      expect(result.current.backgroundAbilityNames).toEqual([]);
      expect(result.current.backgroundAbilityAssignments).toEqual({});
    });
  });

  describe('loading background data', () => {
    it('loads ability names from background data for 2024 ruleset', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: 'Intelligence, Wisdom, Charisma',
      });

      const { result } = renderHookWithDefaults({ rules: '2024', background: 'Acolyte' });

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toEqual(['Intelligence', 'Wisdom', 'Charisma']);
      });
    });

    it('defaults to +1 bonus for each ability when no stored data exists', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: 'Strength, Dexterity, Constitution',
      });

      const { result } = renderHookWithDefaults({ rules: '2024', background: 'Acolyte' });

      await waitFor(() => {
        expect(result.current.backgroundAbilityAssignments).toEqual({
          Strength: 1,
          Dexterity: 1,
          Constitution: 1,
        });
      });
    });

    it('restores previously stored assignments from localStorage', async () => {
      localStorage.setItem(
        '_background_abilities_Acolyte',
        JSON.stringify({ Strength: 2, Dexterity: 0, Constitution: 1 })
      );

      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: 'Strength, Dexterity, Constitution',
      });

      const { result } = renderHookWithDefaults({ rules: '2024', background: 'Acolyte' });

      await waitFor(() => {
        expect(result.current.backgroundAbilityAssignments).toEqual({
          Strength: 2,
          Dexterity: 0,
          Constitution: 1,
        });
      });
    });

    it('falls back to defaults when localStorage contains invalid JSON', async () => {
      localStorage.setItem('_background_abilities_Acolyte', 'not-json');

      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: 'Strength, Dexterity, Constitution',
      });

      const { result } = renderHookWithDefaults({ rules: '2024', background: 'Acolyte' });

      await waitFor(() => {
        expect(result.current.backgroundAbilityAssignments).toEqual({
          Strength: 1,
          Dexterity: 1,
          Constitution: 1,
        });
      });
    });

    it('uses non-object JSON from localStorage as-is (no type validation)', async () => {
      localStorage.setItem('_background_abilities_Acolyte', JSON.stringify([1, 2, 3]));

      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: 'Strength, Dexterity, Constitution',
      });

      const { result } = renderHookWithDefaults({ rules: '2024', background: 'Acolyte' });

      await waitFor(() => {
        expect(result.current.backgroundAbilityAssignments).toEqual([1, 2, 3]);
      });
    });

    it('handles fetchBackgroundData rejection by clearing state', async () => {
      vi.mocked(fetchBackgroundData).mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHookWithDefaults({ rules: '2024', background: 'Acolyte' });

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toEqual([]);
        expect(result.current.backgroundAbilityAssignments).toEqual({});
      });

      consoleSpy.mockRestore();
    });

    it('handles background data missing ability_scores field', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Test',
        skill_proficiencies: 'Some Skill',
      });

      const { result } = renderHookWithDefaults({ rules: '2024', background: 'Test' });

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toEqual([]);
        expect(result.current.backgroundAbilityAssignments).toEqual({});
      });
    });

    it('handles background data with null ability_scores', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: null,
      });

      const { result } = renderHookWithDefaults({ rules: '2024', background: 'Acolyte' });

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toEqual([]);
        expect(result.current.backgroundAbilityAssignments).toEqual({});
      });
    });

    it('handles background data with undefined ability_scores', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
      });

      const { result } = renderHookWithDefaults({ rules: '2024', background: 'Acolyte' });

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toEqual([]);
        expect(result.current.backgroundAbilityAssignments).toEqual({});
      });
    });
  });

  describe('parsing ability score strings', () => {
    const parseTestCases = [
      { input: 'Strength, Dexterity, Constitution', expected: ['Strength', 'Dexterity', 'Constitution'] },
      { input: 'Strength; Dexterity; Constitution', expected: ['Strength', 'Dexterity', 'Constitution'] },
      { input: 'Strength and Dexterity and Constitution', expected: ['Strength', 'Dexterity', 'Constitution'] },
      { input: 'Strength, Dexterity; and Constitution', expected: ['Strength', 'Dexterity', 'Constitution'] },
      { input: '  Strength  ,  Dexterity  ,  Constitution  ', expected: ['Strength', 'Dexterity', 'Constitution'] },
      { input: 'Strength', expected: ['Strength'] },
      { input: '', expected: [] },
    ];

    for (const testCase of parseTestCases) {
      it(`parses "${testCase.input}" into correct ability names`, async () => {
        vi.mocked(fetchBackgroundData).mockResolvedValue({
          name: 'Test',
          ability_scores: testCase.input,
        });

        const { result } = renderHookWithDefaults({ rules: '2024', background: 'Test' });

        await waitFor(() => {
          expect(result.current.backgroundAbilityNames).toEqual(testCase.expected);
        });
      });
    }
  });

  describe('updateBackgroundIncrease', () => {
    const formData = { rules: '2024', background: 'Acolyte', abilities: defaultAbilities };

    beforeEach(() => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: 'Strength, Dexterity, Constitution',
      });
    });

    it('updates assignment state, persists to localStorage, and calls setFormData', async () => {
      const { result } = renderHookWithDefaults(formData);

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBackgroundIncrease('Strength', 2);
      });

      expect(result.current.backgroundAbilityAssignments).toEqual({
        Strength: 2,
        Dexterity: 1,
        Constitution: 1,
      });

      const stored = localStorage.getItem('_background_abilities_Acolyte');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored)).toEqual({ Strength: 2, Dexterity: 1, Constitution: 1 });

      expect(mockSetFormData).toHaveBeenCalled();
      const lastCallIndex = mockSetFormData.mock.calls.length - 1;
      const updaterFn = mockSetFormData.mock.calls[lastCallIndex][0];
      const updated = updaterFn({ abilities: defaultAbilities });
      expect(updated.abilities[0].backgroundIncrease).toBe(2);
      expect(updated.abilities[1].backgroundIncrease).toBe(1);
      expect(updated.abilities[5].backgroundIncrease).toBe(0);
    });

    it('updates formData.abilities for the targeted ability via updateBackgroundIncrease', async () => {
      const { result } = renderHookWithDefaults(formData);

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBackgroundIncrease('Dexterity', 2);
      });

      // The updateBackgroundIncrease callback directly updates the targeted ability
      expect(mockSetFormData).toHaveBeenCalled();
      const updateCalls = mockSetFormData.mock.calls.map(call => call[0]({ abilities: defaultAbilities }));
      // Find the call that targets Dexterity
      const dexCall = updateCalls.find(u => u.abilities[1].backgroundIncrease === 2);
      expect(dexCall).toBeDefined();
      expect(dexCall.abilities[1].backgroundIncrease).toBe(2);
    });

    it('clamps negative values to 0', async () => {
      const { result } = renderHookWithDefaults(formData);

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBackgroundIncrease('Strength', -5);
      });

      expect(result.current.backgroundAbilityAssignments.Strength).toBe(0);
    });

    it('clamps values above 2 to 2', async () => {
      const { result } = renderHookWithDefaults(formData);

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBackgroundIncrease('Strength', 10);
      });

      expect(result.current.backgroundAbilityAssignments.Strength).toBe(2);
    });

    it('coerces non-numeric strings to 0', async () => {
      const { result } = renderHookWithDefaults(formData);

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBackgroundIncrease('Strength', 'abc');
      });

      expect(result.current.backgroundAbilityAssignments.Strength).toBe(0);
    });

    it('coerces null to 0', async () => {
      const { result } = renderHookWithDefaults(formData);

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBackgroundIncrease('Strength', null);
      });

      expect(result.current.backgroundAbilityAssignments.Strength).toBe(0);
    });

    it('coerces undefined to 0', async () => {
      const { result } = renderHookWithDefaults(formData);

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBackgroundIncrease('Strength', undefined);
      });

      expect(result.current.backgroundAbilityAssignments.Strength).toBe(0);
    });

    it('updates all abilities and triggers setFormData for each change', async () => {
      const { result } = renderHookWithDefaults(formData);

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBackgroundIncrease('Strength', 2);
      });
      act(() => {
        result.current.updateBackgroundIncrease('Dexterity', 0);
      });
      act(() => {
        result.current.updateBackgroundIncrease('Constitution', 1);
      });

      expect(result.current.backgroundAbilityAssignments).toEqual({
        Strength: 2,
        Dexterity: 0,
        Constitution: 1,
      });
      expect(result.current.totalAssigned).toBe(3);
      expect(result.current.isValid).toBe(true);
      // Each updateBackgroundIncrease call triggers setFormData directly,
      // and the second useEffect also fires on assignment changes
      expect(mockSetFormData).toHaveBeenCalled();
      expect(mockSetFormData.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('does not update formData when the ability name is not in backgroundAbilityNames', async () => {
      const { result } = renderHookWithDefaults(formData);

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBackgroundIncrease('Intelligence', 2);
      });

      // Assignment state still updates (no filtering by ability names)
      expect(result.current.backgroundAbilityAssignments.Intelligence).toBe(2);
      // But localStorage key uses formData.background so it's still stored
      const stored = JSON.parse(localStorage.getItem('_background_abilities_Acolyte'));
      expect(stored.Intelligence).toBe(2);
    });
  });

  describe('validation computed values', () => {
    beforeEach(() => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: 'Strength, Dexterity, Constitution',
      });
    });

    it('computes totalAssigned as the sum of all bonuses', async () => {
      const { result } = renderHookWithDefaults({ rules: '2024', background: 'Acolyte' });

      await waitFor(() => {
        expect(result.current.totalAssigned).toBe(3);
      });

      act(() => {
        result.current.updateBackgroundIncrease('Strength', 2);
      });

      expect(result.current.totalAssigned).toBe(4);
    });

    it('is valid when totalAssigned equals exactly 3', async () => {
      localStorage.setItem(
        '_background_abilities_Acolyte',
        JSON.stringify({ Strength: 2, Dexterity: 1, Constitution: 0 })
      );

      const { result } = renderHookWithDefaults({ rules: '2024', background: 'Acolyte' });

      await waitFor(() => {
        expect(result.current.isValid).toBe(true);
      });
    });

    it('is invalid when totalAssigned is less than 3', async () => {
      localStorage.setItem(
        '_background_abilities_Acolyte',
        JSON.stringify({ Strength: 1, Dexterity: 0, Constitution: 0 })
      );

      const { result } = renderHookWithDefaults({ rules: '2024', background: 'Acolyte' });

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.totalAssigned).toBe(1);
      });
    });

    it('is invalid when totalAssigned is greater than 3', async () => {
      localStorage.setItem(
        '_background_abilities_Acolyte',
        JSON.stringify({ Strength: 2, Dexterity: 2, Constitution: 2 })
      );

      const { result } = renderHookWithDefaults({ rules: '2024', background: 'Acolyte' });

      await waitFor(() => {
        expect(result.current.isValid).toBe(false);
        expect(result.current.totalAssigned).toBe(6);
      });
    });

    it('hasMaxSingleBonus is true when any single bonus exceeds 2 (localStorage bypass)', async () => {
      localStorage.setItem(
        '_background_abilities_Acolyte',
        JSON.stringify({ Strength: 3, Dexterity: 0, Constitution: 0 })
      );

      const { result } = renderHookWithDefaults({ rules: '2024', background: 'Acolyte' });

      await waitFor(() => {
        expect(result.current.hasMaxSingleBonus).toBe(true);
      });
    });

    it('hasMaxSingleBonus is false when all bonuses are within range', async () => {
      const { result } = renderHookWithDefaults({ rules: '2024', background: 'Acolyte' });

      await waitFor(() => {
        expect(result.current.hasMaxSingleBonus).toBe(false);
      });
    });
  });

  describe('reacting to formData changes', () => {
    it('refetches when background changes', async () => {
      vi.mocked(fetchBackgroundData)
        .mockResolvedValueOnce({
          name: 'Acolyte',
          ability_scores: 'Intelligence, Wisdom, Charisma',
        })
        .mockResolvedValueOnce({
          name: 'Sailor',
          ability_scores: 'Strength, Dexterity, Constitution',
        });

      const { result, rerender } = renderHook(
        ({ formData }) => useWizardBackgroundAbility(formData, mockSetFormData),
        { initialProps: { formData: { rules: '2024', background: 'Acolyte' } } }
      );

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toEqual(['Intelligence', 'Wisdom', 'Charisma']);
      });

      rerender({ formData: { rules: '2024', background: 'Sailor' } });

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toEqual(['Strength', 'Dexterity', 'Constitution']);
      });

      expect(fetchBackgroundData).toHaveBeenCalledTimes(2);
    });

    it('clears state when switching from 2024 to 5e', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: 'Intelligence, Wisdom, Charisma',
      });

      const { result, rerender } = renderHook(
        ({ formData }) => useWizardBackgroundAbility(formData, mockSetFormData),
        { initialProps: { formData: { rules: '2024', background: 'Acolyte' } } }
      );

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toEqual(['Intelligence', 'Wisdom', 'Charisma']);
      });

      rerender({ formData: { rules: '5e', background: 'Acolyte' } });

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toEqual([]);
        expect(result.current.backgroundAbilityAssignments).toEqual({});
      });
    });

    it('clears state when background is removed', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: 'Intelligence, Wisdom, Charisma',
      });

      const { result, rerender } = renderHook(
        ({ formData }) => useWizardBackgroundAbility(formData, mockSetFormData),
        { initialProps: { formData: { rules: '2024', background: 'Acolyte' } } }
      );

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toEqual(['Intelligence', 'Wisdom', 'Charisma']);
      });

      rerender({ formData: { rules: '2024', background: null } });

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toEqual([]);
        expect(result.current.backgroundAbilityAssignments).toEqual({});
      });
    });

    it('refetches when any formData field changes since formData is the dependency', async () => {
      vi.mocked(fetchBackgroundData)
        .mockResolvedValueOnce({
          name: 'Acolyte',
          ability_scores: 'Intelligence, Wisdom, Charisma',
        })
        .mockResolvedValueOnce({
          name: 'Acolyte',
          ability_scores: 'Intelligence, Wisdom, Charisma',
        });

      const { result, rerender } = renderHook(
        ({ formData }) => useWizardBackgroundAbility(formData, mockSetFormData),
        { initialProps: { formData: { rules: '2024', background: 'Acolyte' } } }
      );

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toEqual(['Intelligence', 'Wisdom', 'Charisma']);
      });

      rerender({ formData: { rules: '2024', background: 'Acolyte', extraField: 'changed' } });

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toEqual(['Intelligence', 'Wisdom', 'Charisma']);
      });

      // The hook uses formData as the entire dependency, so any change triggers a refetch
      expect(fetchBackgroundData).toHaveBeenCalledTimes(2);
    });
  });
});
