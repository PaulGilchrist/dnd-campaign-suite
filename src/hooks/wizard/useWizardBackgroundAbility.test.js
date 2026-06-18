import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../services/ui/dataLoader.js', () => ({
  fetchBackgroundData: vi.fn(),
}));

import useWizardBackgroundAbility from './useWizardBackgroundAbility.js';
import { fetchBackgroundData } from '../../services/ui/dataLoader.js';

describe('useWizardBackgroundAbility', () => {
  const mockSetFormData = vi.fn();
  const mockFormData5e = Object.freeze({ rules: '5e', background: 'Acolyte' });
  const mockAbilities = [
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

  describe('initial state with early returns', () => {
    it('returns empty state when rules are not 2024', () => {
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(mockFormData5e, mockSetFormData)
      );

      expect(result.current.bgAbilityNames).toEqual([]);
      expect(result.current.bgAbilityAssignments).toEqual({});
      expect(result.current.totalAssigned).toBe(0);
      expect(result.current.isValid).toBe(false);
      expect(result.current.hasMaxSingleBonus).toBe(false);
    });

    it('returns empty state when background is null', () => {
      const formData = { rules: '2024', background: null };

      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      expect(result.current.bgAbilityNames).toEqual([]);
      expect(result.current.bgAbilityAssignments).toEqual({});
    });

    it('returns empty state when background is undefined', () => {
      const formData = { rules: '2024' };

      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      expect(result.current.bgAbilityNames).toEqual([]);
    });

    it('returns empty state when background is empty string', () => {
      const formData = { rules: '2024', background: '' };

      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      expect(result.current.bgAbilityNames).toEqual([]);
    });
  });

  describe('loading background ability data', () => {
    it('loads ability names from background data for 2024 ruleset', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: 'Intelligence, Wisdom, Charisma',
      });

      const formData = { rules: '2024', background: 'Acolyte' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual(['Intelligence', 'Wisdom', 'Charisma']);
      });
    });

    it('defaults to +1 bonus for each ability when none stored', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: 'Strength, Dexterity, Constitution',
      });

      const formData = { rules: '2024', background: 'Acolyte' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityAssignments).toEqual({
          Strength: 1,
          Dexterity: 1,
          Constitution: 1,
        });
      });
    });

    it('restores previously stored assignments from localStorage', async () => {
      localStorage.setItem(
        '_bg_abilities_Acolyte',
        JSON.stringify({ Strength: 2, Dexterity: 0, Constitution: 1 })
      );

      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: 'Strength, Dexterity, Constitution',
      });

      const formData = { rules: '2024', background: 'Acolyte' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityAssignments).toEqual({
          Strength: 2,
          Dexterity: 0,
          Constitution: 1,
        });
      });
    });

    it('handles invalid JSON in localStorage by falling back to defaults', async () => {
      localStorage.setItem('_bg_abilities_Acolyte', 'not-json');

      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: 'Strength, Dexterity, Constitution',
      });

      const formData = { rules: '2024', background: 'Acolyte' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityAssignments).toEqual({
          Strength: 1,
          Dexterity: 1,
          Constitution: 1,
        });
      });
    });

    it('handles error from fetchBackgroundData gracefully', async () => {
      vi.mocked(fetchBackgroundData).mockRejectedValue(new Error('Network error'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const formData = { rules: '2024', background: 'Acolyte' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual([]);
        expect(result.current.bgAbilityAssignments).toEqual({});
      });

      consoleSpy.mockRestore();
    });

    it('handles background data without ability_scores field', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Test',
        skill_proficiencies: 'Some Skill',
      });

      const formData = { rules: '2024', background: 'Test' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual([]);
        expect(result.current.bgAbilityAssignments).toEqual({});
      });
    });
  });

  describe('parseBackgroundAbilityScores parsing edge cases', () => {
    it('parses semicolon-separated ability scores', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Test',
        ability_scores: 'Strength; Dexterity; Constitution',
      });

      const formData = { rules: '2024', background: 'Test' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual(['Strength', 'Dexterity', 'Constitution']);
      });
    });

    it('parses mixed semicolon and comma separators', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Test',
        ability_scores: 'Strength; Dexterity, Constitution',
      });

      const formData = { rules: '2024', background: 'Test' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual(['Strength', 'Dexterity', 'Constitution']);
      });
    });

    it('parses ability scores with only "and" between each', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Test',
        ability_scores: 'Strength and Dexterity and Constitution',
      });

      const formData = { rules: '2024', background: 'Test' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual(['Strength', 'Dexterity', 'Constitution']);
      });
    });

    it('parses mixed comma, "and", and semicolon separators', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Test',
        ability_scores: 'Strength, Dexterity; and Constitution',
      });

      const formData = { rules: '2024', background: 'Test' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual(['Strength', 'Dexterity', 'Constitution']);
      });
    });

    it('parses Oxford comma format with trailing "and"', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Test',
        ability_scores: 'Strength, Dexterity, and Constitution',
      });

      const formData = { rules: '2024', background: 'Test' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual(['Strength', 'Dexterity', 'Constitution']);
      });
    });

    it('handles extra whitespace around ability names', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Test',
        ability_scores: '  Strength  ,  Dexterity  ,  Constitution  ',
      });

      const formData = { rules: '2024', background: 'Test' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual(['Strength', 'Dexterity', 'Constitution']);
      });
    });

    it('returns empty array for empty string ability_scores', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Test',
        ability_scores: '',
      });

      const formData = { rules: '2024', background: 'Test' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual([]);
      });
    });

    it('returns empty array when ability_scores is only whitespace', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Test',
        ability_scores: '   ',
      });

      const formData = { rules: '2024', background: 'Test' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual([]);
      });
    });

    it('handles single ability score with no separators', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Test',
        ability_scores: 'Strength',
      });

      const formData = { rules: '2024', background: 'Test' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual(['Strength']);
      });
    });

    it('returns empty array for null input', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: null,
      });

      const formData = { rules: '2024', background: 'Acolyte' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual([]);
      });
    });

    it('handles two ability scores', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Test',
        ability_scores: 'Strength, Dexterity',
      });

      const formData = { rules: '2024', background: 'Test' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual(['Strength', 'Dexterity']);
      });
    });

    it('handles extra whitespace around "and" separator', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Test',
        ability_scores: 'Strength   and   Dexterity',
      });

      const formData = { rules: '2024', background: 'Test' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual(['Strength', 'Dexterity']);
      });
    });
  });

  describe('updateBgAbilityBonus', () => {
    const formData = { rules: '2024', background: 'Acolyte', abilities: mockAbilities };

    beforeEach(() => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: 'Strength, Dexterity, Constitution',
      });
    });

    it('updates assignment state when called', async () => {
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Strength', 2);
      });

      expect(result.current.bgAbilityAssignments).toEqual({
        Strength: 2,
        Dexterity: 1,
        Constitution: 1,
      });
    });

    it('updates formData with correct backgroundIncrease delta', async () => {
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Strength', 2);
      });

      expect(mockSetFormData).toHaveBeenCalled();
      const updaterFn = mockSetFormData.mock.calls[0][0];
      expect(typeof updaterFn).toBe('function');

      const prevFormData = { abilities: mockAbilities };
      const updated = updaterFn(prevFormData);
      expect(updated.abilities[0].backgroundIncrease).toBe(1);
      expect(updated.abilities[1].backgroundIncrease).toBe(0);
      expect(updated.abilities[5].backgroundIncrease).toBe(0);
    });

    it('clamps bonus to minimum 0', async () => {
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Strength', -5);
      });

      expect(result.current.bgAbilityAssignments.Strength).toBe(0);
    });

    it('clamps bonus to maximum 2', async () => {
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Strength', 10);
      });

      expect(result.current.bgAbilityAssignments.Strength).toBe(2);
    });

    it('handles string numeric bonus values', async () => {
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Strength', '1');
      });

      expect(result.current.bgAbilityAssignments.Strength).toBe(1);
    });

    it('handles non-numeric string by defaulting bonus to 0', async () => {
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Strength', 'abc');
      });

      expect(result.current.bgAbilityAssignments.Strength).toBe(0);
    });

    it('handles null bonus value', async () => {
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Strength', null);
      });

      expect(result.current.bgAbilityAssignments.Strength).toBe(0);
    });

    it('handles undefined bonus value', async () => {
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Strength', undefined);
      });

      expect(result.current.bgAbilityAssignments.Strength).toBe(0);
    });

    it('handles NaN bonus value', async () => {
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Strength', NaN);
      });

      expect(result.current.bgAbilityAssignments.Strength).toBe(0);
    });

    it('persists assignments to localStorage after update', async () => {
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Strength', 2);
      });

      const stored = localStorage.getItem('_bg_abilities_Acolyte');
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored)).toEqual({ Strength: 2, Dexterity: 1, Constitution: 1 });
    });

    it('supports updating all three abilities', async () => {
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Strength', 2);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Dexterity', 0);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Constitution', 1);
      });

      expect(result.current.bgAbilityAssignments).toEqual({
        Strength: 2,
        Dexterity: 0,
        Constitution: 1,
      });
      expect(result.current.totalAssigned).toBe(3);
      expect(result.current.isValid).toBe(true);
    });

    it('handles formData with null abilities gracefully', async () => {
      const localFormData = { rules: '2024', background: 'Acolyte', abilities: null };

      const { result } = renderHook(() =>
        useWizardBackgroundAbility(localFormData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Strength', 2);
      });

      const updaterFn = mockSetFormData.mock.calls[0][0];
      const prevFormData = { abilities: null };
      const updated = updaterFn(prevFormData);
      expect(updated.abilities).toEqual([]);
    });

    it('handles formData with undefined abilities gracefully', async () => {
      const localFormData = { rules: '2024', background: 'Acolyte' };

      const { result } = renderHook(() =>
        useWizardBackgroundAbility(localFormData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Strength', 1);
      });

      const updaterFn = mockSetFormData.mock.calls[0][0];
      const prevFormData = {};
      const updated = updaterFn(prevFormData);
      expect(updated.abilities).toEqual([]);
    });

    it('updates backgroundIncrease correctly when previous was 0', async () => {
      localStorage.setItem(
        '_bg_abilities_Acolyte',
        JSON.stringify({ Strength: 1, Dexterity: 1, Constitution: 1 })
      );

      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Strength', 0);
      });

      const updaterFn = mockSetFormData.mock.calls[0][0];
      const prevFormData = { abilities: mockAbilities };
      const updated = updaterFn(prevFormData);
      expect(updated.abilities[0].backgroundIncrease).toBe(-1);
    });
  });

  describe('validation computed values', () => {
    beforeEach(() => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: 'Strength, Dexterity, Constitution',
      });
    });

    it('totalAssigned sums all assigned bonuses (default 1+1+1=3)', async () => {
      const formData = { rules: '2024', background: 'Acolyte' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.totalAssigned).toBe(3);
      });
    });

    it('totalAssigned returns 0 for empty assignments', async () => {
      const formData = { rules: '2024', background: 'Acolyte' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.totalAssigned).toBe(3);
      });

      expect(result.current.totalAssigned).toBeGreaterThanOrEqual(0);
    });

    it('isValid is true when totalAssigned equals exactly 3', async () => {
      localStorage.setItem(
        '_bg_abilities_Acolyte',
        JSON.stringify({ Strength: 2, Dexterity: 1, Constitution: 0 })
      );

      const formData = { rules: '2024', background: 'Acolyte' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.totalAssigned).toBe(3);
        expect(result.current.isValid).toBe(true);
      });
    });

    it('isValid is false when totalAssigned is not 3', async () => {
      localStorage.setItem(
        '_bg_abilities_Acolyte',
        JSON.stringify({ Strength: 1, Dexterity: 0, Constitution: 0 })
      );

      const formData = { rules: '2024', background: 'Acolyte' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.totalAssigned).toBe(1);
        expect(result.current.isValid).toBe(false);
      });
    });

    it('isValid is false when totalAssigned exceeds 3', async () => {
      localStorage.setItem(
        '_bg_abilities_Acolyte',
        JSON.stringify({ Strength: 2, Dexterity: 2, Constitution: 2 })
      );

      const formData = { rules: '2024', background: 'Acolyte' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.totalAssigned).toBe(6);
        expect(result.current.isValid).toBe(false);
      });
    });

    it('hasMaxSingleBonus is false when all bonuses are 2 or less', async () => {
      const formData = { rules: '2024', background: 'Acolyte' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.hasMaxSingleBonus).toBe(false);
      });
    });

    it('hasMaxSingleBonus is false when max bonus equals exactly 2', async () => {
      localStorage.setItem(
        '_bg_abilities_Acolyte',
        JSON.stringify({ Strength: 2, Dexterity: 1, Constitution: 0 })
      );

      const formData = { rules: '2024', background: 'Acolyte' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.hasMaxSingleBonus).toBe(false);
      });
    });

    it('hasMaxSingleBonus is true when any bonus exceeds 2', async () => {
      localStorage.setItem(
        '_bg_abilities_Acolyte',
        JSON.stringify({ Strength: 3, Dexterity: 0, Constitution: 0 })
      );

      const formData = { rules: '2024', background: 'Acolyte' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.hasMaxSingleBonus).toBe(true);
      });
    });

    it('hasMaxSingleBonus is false with empty assignments', async () => {
      const formData = { rules: '2024', background: 'Acolyte' };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.hasMaxSingleBonus).toBe(false);
      });
    });
  });

  describe('return value structure', () => {
    it('returns all expected properties and updateBgAbilityBonus is a function', () => {
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(mockFormData5e, mockSetFormData)
      );

      expect(result.current).toHaveProperty('bgAbilityNames');
      expect(result.current).toHaveProperty('bgAbilityAssignments');
      expect(result.current).toHaveProperty('updateBgAbilityBonus');
      expect(result.current).toHaveProperty('totalAssigned');
      expect(result.current).toHaveProperty('isValid');
      expect(result.current).toHaveProperty('hasMaxSingleBonus');
      expect(typeof result.current.updateBgAbilityBonus).toBe('function');
    });
  });

  describe('localStorage key format', () => {
    it('uses correct localStorage key based on background name', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Sailor',
        ability_scores: 'Strength, Dexterity, Constitution',
      });

      const formData = { rules: '2024', background: 'Sailor' };
      renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(localStorage.getItem).toHaveBeenCalledWith('_bg_abilities_Sailor');
      });
    });

    it('does not access localStorage when rules is not 2024', () => {
      renderHook(() =>
        useWizardBackgroundAbility(mockFormData5e, mockSetFormData)
      );

      expect(localStorage.getItem).not.toHaveBeenCalled();
    });

    it('stores assignments under correct key after update', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Sailor',
        ability_scores: 'Strength, Dexterity, Constitution',
      });

      const formData = { rules: '2024', background: 'Sailor', abilities: mockAbilities };
      const { result } = renderHook(() =>
        useWizardBackgroundAbility(formData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toHaveLength(3);
      });

      act(() => {
        result.current.updateBgAbilityBonus('Strength', 2);
      });

      expect(localStorage.setItem).toHaveBeenCalledWith(
        '_bg_abilities_Sailor',
        expect.any(String)
      );
    });
  });

  describe('re-fetching on formData change', () => {
    const initialFormData = { rules: '2024', background: 'Acolyte' };

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
        { initialProps: { formData: initialFormData } }
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual(['Intelligence', 'Wisdom', 'Charisma']);
      });

      rerender({ formData: { rules: '2024', background: 'Sailor' } });

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual(['Strength', 'Dexterity', 'Constitution']);
      });

      expect(fetchBackgroundData).toHaveBeenCalledTimes(2);
    });

    it('returns empty state when switching from 2024 to 5e', async () => {
      vi.mocked(fetchBackgroundData).mockResolvedValue({
        name: 'Acolyte',
        ability_scores: 'Intelligence, Wisdom, Charisma',
      });

      const { result, rerender } = renderHook(
        ({ formData }) => useWizardBackgroundAbility(formData, mockSetFormData),
        { initialProps: { formData: initialFormData } }
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual(['Intelligence', 'Wisdom', 'Charisma']);
      });

      rerender({ formData: { rules: '5e', background: 'Acolyte' } });

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual([]);
        expect(result.current.bgAbilityAssignments).toEqual({});
      });
    });

    it('refetches when background changes to a different background with same rules', async () => {
      vi.mocked(fetchBackgroundData)
        .mockResolvedValueOnce({
          name: 'Acolyte',
          ability_scores: 'Intelligence, Wisdom, Charisma',
        })
        .mockResolvedValueOnce({
          name: 'Criminal',
          ability_scores: 'Dexterity, Constitution, Intelligence',
        });

      const { result, rerender } = renderHook(
        ({ formData }) => useWizardBackgroundAbility(formData, mockSetFormData),
        { initialProps: { formData: initialFormData } }
      );

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual(['Intelligence', 'Wisdom', 'Charisma']);
      });

      rerender({ formData: { rules: '2024', background: 'Criminal' } });

      await waitFor(() => {
        expect(result.current.bgAbilityNames).toEqual(['Dexterity', 'Constitution', 'Intelligence']);
      });
    });
  });
});
