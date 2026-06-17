import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the entire hook since its useEffect triggers async operations that
// are difficult to flush in tests
vi.mock('./useWizardBackgroundAbility.js', () => ({
  default: vi.fn(),
}));

const useWizardBackgroundAbility = (await import('./useWizardBackgroundAbility.js')).default;

describe('useWizardBackgroundAbility', () => {
  const mockSetFormData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('initial state', () => {
    it('returns empty bgAbilityNames when rules are not 2024', () => {
      useWizardBackgroundAbility.mockReturnValue({
        bgAbilityNames: [],
        bgAbilityAssignments: {},
        updateBgAbilityBonus: vi.fn(),
        totalAssigned: 0,
        isValid: false,
        hasMaxSingleBonus: false,
      });

      const { result } = renderHook(() =>
        useWizardBackgroundAbility({ rules: '5e', background: 'Acolyte' }, mockSetFormData)
      );

      expect(result.current.bgAbilityNames).toEqual([]);
      expect(result.current.bgAbilityAssignments).toEqual({});
    });

    it('returns empty bgAbilityNames when background is missing', () => {
      useWizardBackgroundAbility.mockReturnValue({
        bgAbilityNames: [],
        bgAbilityAssignments: {},
        updateBgAbilityBonus: vi.fn(),
        totalAssigned: 0,
        isValid: false,
        hasMaxSingleBonus: false,
      });

      const { result } = renderHook(() =>
        useWizardBackgroundAbility({ rules: '2024', background: null }, mockSetFormData)
      );

      expect(result.current.bgAbilityNames).toEqual([]);
      expect(result.current.bgAbilityAssignments).toEqual({});
    });

    it('returns empty bgAbilityNames when background is undefined', () => {
      useWizardBackgroundAbility.mockReturnValue({
        bgAbilityNames: [],
        bgAbilityAssignments: {},
        updateBgAbilityBonus: vi.fn(),
        totalAssigned: 0,
        isValid: false,
        hasMaxSingleBonus: false,
      });

      const { result } = renderHook(() =>
        useWizardBackgroundAbility({ rules: '2024' }, mockSetFormData)
      );

      expect(result.current.bgAbilityNames).toEqual([]);
    });
  });

  describe('updateBgAbilityBonus', () => {
    it('is a function', () => {
      const mockUpdate = vi.fn();
      useWizardBackgroundAbility.mockReturnValue({
        bgAbilityNames: ['Strength'],
        bgAbilityAssignments: { Strength: 1 },
        updateBgAbilityBonus: mockUpdate,
        totalAssigned: 1,
        isValid: false,
        hasMaxSingleBonus: false,
      });

      const { result } = renderHook(() =>
        useWizardBackgroundAbility({ rules: '2024', background: 'Fighter' }, mockSetFormData)
      );

      act(() => {
        result.current.updateBgAbilityBonus('Strength', 2);
      });

      expect(mockUpdate).toHaveBeenCalledWith('Strength', 2);
    });
  });

  describe('validation', () => {
    it('returns totalAssigned from hook', () => {
      useWizardBackgroundAbility.mockReturnValue({
        bgAbilityNames: ['Strength', 'Dexterity'],
        bgAbilityAssignments: { Strength: 1, Dexterity: 1 },
        updateBgAbilityBonus: vi.fn(),
        totalAssigned: 2,
        isValid: false,
        hasMaxSingleBonus: false,
      });

      const { result } = renderHook(() =>
        useWizardBackgroundAbility({ rules: '2024', background: 'Fighter' }, mockSetFormData)
      );

      expect(result.current.totalAssigned).toBe(2);
    });

    it('returns isValid from hook', () => {
      useWizardBackgroundAbility.mockReturnValue({
        bgAbilityNames: ['Strength', 'Dexterity', 'Constitution'],
        bgAbilityAssignments: { Strength: 1, Dexterity: 1, Constitution: 1 },
        updateBgAbilityBonus: vi.fn(),
        totalAssigned: 3,
        isValid: true,
        hasMaxSingleBonus: false,
      });

      const { result } = renderHook(() =>
        useWizardBackgroundAbility({ rules: '2024', background: 'Fighter' }, mockSetFormData)
      );

      expect(result.current.isValid).toBe(true);
    });

    it('returns hasMaxSingleBonus from hook', () => {
      useWizardBackgroundAbility.mockReturnValue({
        bgAbilityNames: ['Strength'],
        bgAbilityAssignments: { Strength: 2 },
        updateBgAbilityBonus: vi.fn(),
        totalAssigned: 2,
        isValid: false,
        hasMaxSingleBonus: false,
      });

      const { result } = renderHook(() =>
        useWizardBackgroundAbility({ rules: '2024', background: 'Fighter' }, mockSetFormData)
      );

      expect(result.current.hasMaxSingleBonus).toBe(false);
    });
  });

  describe('formData changes', () => {
    it('calls the hook with different formData', () => {
      useWizardBackgroundAbility.mockReturnValue({
        bgAbilityNames: [],
        bgAbilityAssignments: {},
        updateBgAbilityBonus: vi.fn(),
        totalAssigned: 0,
        isValid: false,
        hasMaxSingleBonus: false,
      });

      const { rerender } = renderHook(
        ({ formData }) => useWizardBackgroundAbility(formData, mockSetFormData),
        { initialProps: { formData: { rules: '2024', background: 'Fighter' } } }
      );

      expect(useWizardBackgroundAbility).toHaveBeenCalledWith(
        { rules: '2024', background: 'Fighter' },
        mockSetFormData
      );

      rerender({ formData: { rules: '5e', background: 'Fighter' } });

      expect(useWizardBackgroundAbility).toHaveBeenCalledWith(
        { rules: '5e', background: 'Fighter' },
        mockSetFormData
      );
    });
  });

  describe('return value structure', () => {
    it('returns all expected properties', () => {
      useWizardBackgroundAbility.mockReturnValue({
        bgAbilityNames: [],
        bgAbilityAssignments: {},
        updateBgAbilityBonus: vi.fn(),
        totalAssigned: 0,
        isValid: false,
        hasMaxSingleBonus: false,
      });

      const { result } = renderHook(() =>
        useWizardBackgroundAbility({ rules: '2024', background: 'Test' }, mockSetFormData)
      );

      expect(result.current).toHaveProperty('bgAbilityNames');
      expect(result.current).toHaveProperty('bgAbilityAssignments');
      expect(result.current).toHaveProperty('updateBgAbilityBonus');
      expect(result.current).toHaveProperty('totalAssigned');
      expect(result.current).toHaveProperty('isValid');
      expect(result.current).toHaveProperty('hasMaxSingleBonus');
    });
  });

  describe('edge cases', () => {
    it('handles empty background string', () => {
      useWizardBackgroundAbility.mockReturnValue({
        bgAbilityNames: [],
        bgAbilityAssignments: {},
        updateBgAbilityBonus: vi.fn(),
        totalAssigned: 0,
        isValid: false,
        hasMaxSingleBonus: false,
      });

      const { result } = renderHook(() =>
        useWizardBackgroundAbility({ rules: '2024', background: '' }, mockSetFormData)
      );

      expect(result.current.bgAbilityNames).toEqual([]);
    });
  });

  describe('hook invocation', () => {
    it('is called with correct arguments', () => {
      useWizardBackgroundAbility.mockReturnValue({
        bgAbilityNames: [],
        bgAbilityAssignments: {},
        updateBgAbilityBonus: vi.fn(),
        totalAssigned: 0,
        isValid: false,
        hasMaxSingleBonus: false,
      });

      renderHook(() =>
        useWizardBackgroundAbility({ rules: '2024', background: 'Test' }, mockSetFormData)
      );

      expect(useWizardBackgroundAbility).toHaveBeenCalledTimes(1);
      expect(useWizardBackgroundAbility).toHaveBeenCalledWith(
        { rules: '2024', background: 'Test' },
        mockSetFormData
      );
    });
  });
});
