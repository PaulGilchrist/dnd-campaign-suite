// @maintained-by-ai
// Deterministic contract tests for the 2024-wizard background-ability hook:
// parsing, clamping, localStorage persistence, and validation with dataLoader
// mocked. No timers, no network, no DOM — stable as the app evolves.
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

    for (const { label, formData } of [
      { label: 'missing', formData: { rules: '2024' } },
      { label: 'null', formData: { rules: '2024', background: null } },
      { label: 'empty string', formData: { rules: '2024', background: '' } },
    ]) {
      it(`returns empty state when background is ${label}`, () => {
        const { result } = renderHookWithDefaults(formData);

        expect(result.current.backgroundAbilityNames).toEqual([]);
        expect(result.current.backgroundAbilityAssignments).toEqual({});
      });
    }
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

    for (const { label, data } of [
      { label: 'no ability_scores field', data: { name: 'Test', skill_proficiencies: 'Some Skill' } },
      { label: 'null ability_scores', data: { name: 'Test', ability_scores: null } },
      { label: 'empty ability_scores', data: { name: 'Test', ability_scores: '' } },
    ]) {
      it(`handles background data with ${label}`, async () => {
        vi.mocked(fetchBackgroundData).mockResolvedValue(data);

        const { result } = renderHookWithDefaults({ rules: '2024', background: 'Test' });

        await waitFor(() => {
          expect(result.current.backgroundAbilityNames).toEqual([]);
          expect(result.current.backgroundAbilityAssignments).toEqual({});
        });
      });
    }
  });

  describe('parsing ability score strings', () => {
    const parseTestCases = [
      { input: 'Strength, Dexterity, Constitution', expected: ['Strength', 'Dexterity', 'Constitution'] },
      { input: 'Strength; Dexterity; Constitution', expected: ['Strength', 'Dexterity', 'Constitution'] },
      { input: 'Strength and Dexterity and Constitution', expected: ['Strength', 'Dexterity', 'Constitution'] },
      { input: 'Strength, Dexterity; and Constitution', expected: ['Strength', 'Dexterity', 'Constitution'] },
      { input: '  Strength  ,  Dexterity  ,  Constitution  ', expected: ['Strength', 'Dexterity', 'Constitution'] },
      { input: 'Strength', expected: ['Strength'] },
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

    it('clamps values to the 0-2 range and coerces non-numeric input to 0', async () => {
      const { result } = renderHookWithDefaults(formData);

      await waitFor(() => {
        expect(result.current.backgroundAbilityNames).toHaveLength(3);
      });

      const cases = [
        [-5, 0],
        [10, 2],
        ['abc', 0],
        [null, 0],
        [undefined, 0],
        ['2', 2],
      ];
      for (const [input, expected] of cases) {
        act(() => {
          result.current.updateBackgroundIncrease('Strength', input);
        });

        expect(result.current.backgroundAbilityAssignments.Strength).toBe(expected);
        // Sibling assignments are never disturbed by an out-of-range input
        expect(result.current.backgroundAbilityAssignments.Dexterity).toBe(1);
        expect(result.current.backgroundAbilityAssignments.Constitution).toBe(1);
      }
    });

    it('merges sequential updates across abilities', async () => {
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

      expect(result.current.backgroundAbilityAssignments).toEqual({
        Strength: 2,
        Dexterity: 0,
        Constitution: 1,
      });
      expect(result.current.totalAssigned).toBe(3);
      expect(result.current.isValid).toBe(true);
      expect(mockSetFormData).toHaveBeenCalled();
      const stored = JSON.parse(localStorage.getItem('_background_abilities_Acolyte'));
      expect(stored).toEqual({ Strength: 2, Dexterity: 0, Constitution: 1 });
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

    for (const { assignments, valid, total } of [
      { assignments: { Strength: 2, Dexterity: 1, Constitution: 0 }, valid: true, total: 3 },
      { assignments: { Strength: 1, Dexterity: 0, Constitution: 0 }, valid: false, total: 1 },
      { assignments: { Strength: 2, Dexterity: 2, Constitution: 2 }, valid: false, total: 6 },
    ]) {
      it(`is ${valid ? 'valid' : 'invalid'} when stored total is ${total}`, async () => {
        localStorage.setItem('_background_abilities_Acolyte', JSON.stringify(assignments));

        const { result } = renderHookWithDefaults({ rules: '2024', background: 'Acolyte' });

        await waitFor(() => {
          expect(result.current.totalAssigned).toBe(total);
          expect(result.current.isValid).toBe(valid);
        });
      });
    }

    it('hasMaxSingleBonus is true when a stored bonus exceeds 2 (localStorage bypass)', async () => {
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
  });
});
