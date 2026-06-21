// @improved-by-ai
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardResistances from './useWizardResistances.js';

vi.mock('../../services/character/resistancesValidation.js', () => ({
  getPreSelectedResistances: vi.fn(),
  validateResistances: vi.fn(),
}));

import { getPreSelectedResistances, validateResistances } from '../../services/character/resistancesValidation.js';

describe('useWizardResistances', () => {
  const baseFormData = {
    class: { name: 'Fighter' },
    race: { name: 'Dwarf', subrace: { name: 'Hill Dwarf' } },
    background: 'Soldier',
    resistances: [],
    immunities: [],
    rules: '5e',
    level: 1,
  };

  const mockSetFormData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    validateResistances.mockResolvedValue([]);
    getPreSelectedResistances.mockResolvedValue({ resistances: [], immunities: [] });
  });

  function renderHookWithResistances(formData = baseFormData, setFn = mockSetFormData) {
    return renderHook(() => useWizardResistances(formData, setFn));
  }

  describe('initial state', () => {
    it('returns empty resistanceWarnings array', () => {
      const { result } = renderHookWithResistances();
      expect(result.current.resistanceWarnings).toEqual([]);
    });

    it('returns empty preSelectedResistancesList with resistances and immunities arrays', () => {
      const { result } = renderHookWithResistances();
      expect(result.current.preSelectedResistancesList).toEqual({ resistances: [], immunities: [] });
    });

    it('returns setResistanceWarnings as a function', () => {
      const { result } = renderHookWithResistances();
      expect(typeof result.current.setResistanceWarnings).toBe('function');
    });
  });

  describe('resistance warnings from validation', () => {
    it('loads validation warnings from validateResistances result', async () => {
      const warnings = ['Invalid resistance'];
      validateResistances.mockResolvedValue(warnings);

      const { result } = renderHookWithResistances();
      await waitFor(() => {
        expect(result.current.resistanceWarnings).toEqual(warnings);
      });
    });

    it('handles validation returning multiple warnings', async () => {
      const warnings = [
        { message: 'Warning 1', type: 'warning' },
        { message: 'Warning 2', type: 'info' },
      ];
      validateResistances.mockResolvedValue(warnings);

      const { result } = renderHookWithResistances();
      await waitFor(() => {
        expect(result.current.resistanceWarnings).toEqual(warnings);
      });
    });

    it('handles validation errors gracefully without crashing', async () => {
      validateResistances.mockRejectedValue(new Error('Validation error'));
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHookWithResistances();
      await waitFor(() => {
        expect(result.current.resistanceWarnings).toEqual([]);
      });

      expect(mockConsoleError).toHaveBeenCalled();
      mockConsoleError.mockRestore();
    });
  });

  describe('pre-selected resistances', () => {
    it('loads pre-selected resistances from getPreSelectedResistances', async () => {
      getPreSelectedResistances.mockResolvedValue({
        resistances: ['Poison'],
        immunities: ['Disease'],
      });

      const { result } = renderHookWithResistances();
      await waitFor(() => {
        expect(result.current.preSelectedResistancesList).toEqual({
          resistances: ['Poison'],
          immunities: ['Disease'],
        });
      });
    });

    it('handles pre-select errors gracefully without crashing', async () => {
      getPreSelectedResistances.mockRejectedValue(new Error('Fetch error'));
      const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHookWithResistances();
      await waitFor(() => {
        expect(result.current.preSelectedResistancesList).toEqual({ resistances: [], immunities: [] });
      });

      expect(mockConsoleError).toHaveBeenCalled();
      mockConsoleError.mockRestore();
    });

    it('merges missing pre-selected resistances into form data', async () => {
      getPreSelectedResistances.mockResolvedValue({
        resistances: ['Poison', 'Cold'],
        immunities: ['Disease'],
      });

      renderHookWithResistances();

      await waitFor(() => {
        expect(mockSetFormData).toHaveBeenCalledWith(expect.any(Function));
      });

      const mergeFn = mockSetFormData.mock.calls[0][0];
      const merged = mergeFn({ ...baseFormData, resistances: ['Poison'], immunities: [] });

      // Should add 'Cold' (not already present) but not duplicate 'Poison'
      expect(merged.resistances).toContain('Poison');
      expect(merged.resistances).toContain('Cold');
      expect(merged.resistances.length).toBe(2);
      expect(merged.immunities).toContain('Disease');
    });

    it('does not duplicate resistances already in form data', async () => {
      getPreSelectedResistances.mockResolvedValue({
        resistances: ['Poison'],
        immunities: ['Disease'],
      });

      const existingResistances = {
        ...baseFormData,
        resistances: ['Poison'],
        immunities: ['Disease'],
      };

      renderHookWithResistances(existingResistances);

      await waitFor(() => {
        expect(mockSetFormData).toHaveBeenCalled();
      });

      const mergeFn = mockSetFormData.mock.calls[0][0];
      const merged = mergeFn(existingResistances);

      expect(merged).toEqual(existingResistances);
    });

    it('handles pre-selected immunities merge correctly', async () => {
      getPreSelectedResistances.mockResolvedValue({
        resistances: [],
        immunities: ['Fire', 'Cold'],
      });

      renderHookWithResistances();

      await waitFor(() => {
        expect(mockSetFormData).toHaveBeenCalled();
      });

      const mergeFn = mockSetFormData.mock.calls[0][0];
      const merged = mergeFn({ ...baseFormData, immunities: ['Fire'] });

      expect(merged.immunities).toContain('Fire');
      expect(merged.immunities).toContain('Cold');
      expect(merged.immunities.length).toBe(2);
    });
  });

  describe('setResistanceWarnings', () => {
    it('updates resistanceWarnings when called', () => {
      const { result } = renderHookWithResistances();

      act(() => {
        result.current.setResistanceWarnings(['New warning']);
      });

      expect(result.current.resistanceWarnings).toEqual(['New warning']);
    });

    it('replaces all warnings with a new array', () => {
      const { result } = renderHookWithResistances();

      act(() => {
        result.current.setResistanceWarnings(['Warning A', 'Warning B', 'Warning C']);
      });

      expect(result.current.resistanceWarnings).toEqual(['Warning A', 'Warning B', 'Warning C']);
    });
  });

  describe('edge cases', () => {
    it('handles formData with missing optional fields', () => {
      const minimalFormData = { resistances: [], immunities: [], rules: '5e', level: 1 };
      const { result } = renderHookWithResistances(minimalFormData);

      expect(result.current.resistanceWarnings).toEqual([]);
      expect(result.current.preSelectedResistancesList).toEqual({ resistances: [], immunities: [] });
    });

    it('handles formData with null race/class', () => {
      const nullRaceFormData = {
        ...baseFormData,
        class: null,
        race: null,
      };
      const { result } = renderHookWithResistances(nullRaceFormData);

      expect(result.current.resistanceWarnings).toEqual([]);
      expect(result.current.preSelectedResistancesList).toEqual({ resistances: [], immunities: [] });
    });

    it('handles preSelect.merge with undefined prev resistances/immunities', async () => {
      getPreSelectedResistances.mockResolvedValue({
        resistances: ['Fire'],
        immunities: ['Cold'],
      });

      const noArraysFormData = {
        class: { name: 'Fighter' },
        race: { name: 'Human' },
        resistances: undefined,
        immunities: undefined,
        rules: '5e',
        level: 1,
      };

      renderHookWithResistances(noArraysFormData);

      await waitFor(() => {
        expect(mockSetFormData).toHaveBeenCalled();
      });

      const mergeFn = mockSetFormData.mock.calls[0][0];
      const merged = mergeFn(noArraysFormData);

      expect(merged.resistances).toEqual(['Fire']);
      expect(merged.immunities).toEqual(['Cold']);
    });
  });
});
