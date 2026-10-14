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

  function renderWithResistances(formData = baseFormData, setFn = mockSetFormData) {
    return renderHook(({ form }) => useWizardResistances(form, setFn), {
      initialProps: { form: formData },
    });
  }

  describe('return shape', () => {
    it('returns preSelectedResistancesList, resistanceWarnings, and setResistanceWarnings', () => {
      const { result } = renderWithResistances();
      expect(result.current).toHaveProperty('preSelectedResistancesList');
      expect(result.current).toHaveProperty('resistanceWarnings');
      expect(result.current).toHaveProperty('setResistanceWarnings');
      expect(typeof result.current.setResistanceWarnings).toBe('function');
    });

    it('returns empty arrays for preSelectedResistancesList and resistanceWarnings initially', () => {
      const { result } = renderWithResistances();
      expect(result.current.resistanceWarnings).toEqual([]);
      expect(result.current.preSelectedResistancesList).toEqual({ resistances: [], immunities: [] });
    });
  });

  describe('validation warnings', () => {
    it('loads validation warnings from validateResistances', async () => {
      const warnings = [
        { message: 'Invalid resistance', type: 'warning' },
        { message: 'Missing immunity', type: 'info' },
      ];
      validateResistances.mockResolvedValue(warnings);

      const { result } = renderWithResistances();
      await waitFor(
        () => {
          expect(result.current.resistanceWarnings).toEqual(warnings);
        },
        { timeout: 2000 }
      );
    });

    it('sets empty warnings when validation encounters an error', async () => {
      validateResistances.mockRejectedValue(new Error('Validation error'));
      const { result } = renderWithResistances();
      await waitFor(
        () => {
          expect(result.current.resistanceWarnings).toEqual([]);
        },
        { timeout: 2000 }
      );
    });

    it('updates warnings when formData dependencies change', async () => {
      validateResistances
        .mockResolvedValueOnce([{ message: 'Warning A', type: 'warning' }])
        .mockResolvedValueOnce([{ message: 'Warning B', type: 'info' }]);

      const { result, rerender } = renderWithResistances(baseFormData);

      await waitFor(
        () => {
          expect(validateResistances).toHaveBeenCalledTimes(1);
        },
        { timeout: 2000 }
      );

      const newFormData = { ...baseFormData, class: { name: 'Elf' } };
      act(() => {
        rerender({ form: newFormData });
      });

      await waitFor(
        () => {
          expect(result.current.resistanceWarnings).toEqual([{ message: 'Warning B', type: 'info' }]);
        },
        { timeout: 2000 }
      );
    });
  });

  describe('pre-selected resistances', () => {
    it('loads pre-selected resistances and immunities from the service', async () => {
      getPreSelectedResistances.mockResolvedValue({
        resistances: ['Poison'],
        immunities: ['Disease'],
      });

      const { result } = renderWithResistances();
      await waitFor(
        () => {
          expect(result.current.preSelectedResistancesList).toEqual({
            resistances: ['Poison'],
            immunities: ['Disease'],
          });
        },
        { timeout: 2000 }
      );
    });

    it('handles pre-select errors gracefully with empty defaults', async () => {
      getPreSelectedResistances.mockRejectedValue(new Error('Fetch error'));
      const { result } = renderWithResistances();
      await waitFor(
        () => {
          expect(result.current.preSelectedResistancesList).toEqual({ resistances: [], immunities: [] });
        },
        { timeout: 2000 }
      );
    });

    it('merges pre-selected resistances into form data, avoiding duplicates', async () => {
      getPreSelectedResistances.mockResolvedValue({
        resistances: ['Poison', 'Cold'],
        immunities: ['Disease'],
      });

      const existingFormData = {
        ...baseFormData,
        resistances: ['Poison'],
        immunities: [],
      };

      renderWithResistances(existingFormData);

      await waitFor(
        () => {
          expect(mockSetFormData).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      const mergeFn = mockSetFormData.mock.calls[0][0];
      const merged = mergeFn(existingFormData);
      expect(merged.resistances).toEqual(['Poison', 'Cold']);
      expect(merged.immunities).toEqual(['Disease']);
    });

    it('does not add resistances already present in form data', async () => {
      getPreSelectedResistances.mockResolvedValue({
        resistances: ['Poison'],
        immunities: ['Disease'],
      });

      const existingFormData = {
        ...baseFormData,
        resistances: ['Poison'],
        immunities: ['Disease'],
      };

      renderWithResistances(existingFormData);

      await waitFor(
        () => {
          expect(mockSetFormData).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      const mergeFn = mockSetFormData.mock.calls[0][0];
      const merged = mergeFn(existingFormData);
      expect(merged.resistances).toEqual(['Poison']);
      expect(merged.immunities).toEqual(['Disease']);
    });

    it('handles missing resistances/immunities in form data (undefined)', async () => {
      getPreSelectedResistances.mockResolvedValue({
        resistances: ['Fire'],
        immunities: ['Psychic'],
      });

      const formDataNoArrays = {
        ...baseFormData,
        resistances: undefined,
        immunities: undefined,
      };

      renderWithResistances(formDataNoArrays);

      await waitFor(
        () => {
          expect(mockSetFormData).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      const mergeFn = mockSetFormData.mock.calls[0][0];
      const merged = mergeFn(formDataNoArrays);
      expect(merged.resistances).toEqual(['Fire']);
      expect(merged.immunities).toEqual(['Psychic']);
    });

    it('handles null resistances/immunities in form data', async () => {
      getPreSelectedResistances.mockResolvedValue({
        resistances: ['Lightning'],
        immunities: ['Force'],
      });

      const formDataNull = {
        ...baseFormData,
        resistances: null,
        immunities: null,
      };

      renderWithResistances(formDataNull);

      await waitFor(
        () => {
          expect(mockSetFormData).toHaveBeenCalled();
        },
        { timeout: 2000 }
      );

      const mergeFn = mockSetFormData.mock.calls[0][0];
      const merged = mergeFn(formDataNull);
      expect(merged.resistances).toEqual(['Lightning']);
      expect(merged.immunities).toEqual(['Force']);
    });

    it('does not call setFormData when pre-selected items are empty', async () => {
      getPreSelectedResistances.mockResolvedValue({ resistances: [], immunities: [] });

      renderWithResistances();

      await waitFor(
        () => {
          expect(mockSetFormData).not.toHaveBeenCalled();
        },
        { timeout: 2000 }
      );
    });
  });

  describe('setResistanceWarnings', () => {
    it('updates resistanceWarnings when called', () => {
      const { result } = renderWithResistances();
      act(() => {
        result.current.setResistanceWarnings(['New warning']);
      });
      expect(result.current.resistanceWarnings).toEqual(['New warning']);
    });

    it('replaces all warnings with a new array', () => {
      const { result } = renderWithResistances();
      act(() => {
        result.current.setResistanceWarnings(['Warning 1', 'Warning 2']);
      });
      expect(result.current.resistanceWarnings).toEqual(['Warning 1', 'Warning 2']);

      act(() => {
        result.current.setResistanceWarnings(['Replaced']);
      });
      expect(result.current.resistanceWarnings).toEqual(['Replaced']);
    });
  });

  describe('reactivity to formData changes', () => {
    it('re-validates when formData class changes', async () => {
      validateResistances
        .mockResolvedValueOnce([{ message: 'Fighter warning', type: 'info' }])
        .mockResolvedValueOnce([{ message: 'Wizard warning', type: 'info' }]);

      const { result, rerender } = renderWithResistances({ ...baseFormData, class: { name: 'Fighter' } });

      await waitFor(
        () => {
          expect(result.current.resistanceWarnings).toEqual([{ message: 'Fighter warning', type: 'info' }]);
        },
        { timeout: 2000 }
      );

      act(() => {
        rerender({ form: { ...baseFormData, class: { name: 'Wizard' } } });
      });

      await waitFor(
        () => {
          expect(result.current.resistanceWarnings).toEqual([{ message: 'Wizard warning', type: 'info' }]);
        },
        { timeout: 2000 }
      );
    });

    it('re-validates when formData race changes', async () => {
      validateResistances
        .mockResolvedValueOnce([{ message: 'Dwarf warning', type: 'info' }])
        .mockResolvedValueOnce([{ message: 'Elf warning', type: 'info' }]);

      const { result, rerender } = renderWithResistances({ ...baseFormData, race: { name: 'Dwarf', subrace: { name: 'Hill Dwarf' } } });

      await waitFor(
        () => {
          expect(result.current.resistanceWarnings).toEqual([{ message: 'Dwarf warning', type: 'info' }]);
        },
        { timeout: 2000 }
      );

      act(() => {
        rerender({ form: { ...baseFormData, race: { name: 'Elf' } } });
      });

      await waitFor(
        () => {
          expect(result.current.resistanceWarnings).toEqual([{ message: 'Elf warning', type: 'info' }]);
        },
        { timeout: 2000 }
      );
    });

    it('re-validates when formData level changes', async () => {
      validateResistances
        .mockResolvedValueOnce([{ message: 'Level 1', type: 'info' }])
        .mockResolvedValueOnce([{ message: 'Level 10', type: 'info' }]);

      const { result, rerender } = renderWithResistances({ ...baseFormData, level: 1 });

      await waitFor(
        () => {
          expect(result.current.resistanceWarnings).toEqual([{ message: 'Level 1', type: 'info' }]);
        },
        { timeout: 2000 }
      );

      act(() => {
        rerender({ form: { ...baseFormData, level: 10 } });
      });

      await waitFor(
        () => {
          expect(result.current.resistanceWarnings).toEqual([{ message: 'Level 10', type: 'info' }]);
        },
        { timeout: 2000 }
      );
    });

    it('re-validates when formData rules changes', async () => {
      validateResistances
        .mockResolvedValueOnce([{ message: '5e', type: 'info' }])
        .mockResolvedValueOnce([{ message: '2024', type: 'info' }]);

      const { result, rerender } = renderWithResistances({ ...baseFormData, rules: '5e' });

      await waitFor(
        () => {
          expect(result.current.resistanceWarnings).toEqual([{ message: '5e', type: 'info' }]);
        },
        { timeout: 2000 }
      );

      act(() => {
        rerender({ form: { ...baseFormData, rules: '2024' } });
      });

      await waitFor(
        () => {
          expect(result.current.resistanceWarnings).toEqual([{ message: '2024', type: 'info' }]);
        },
        { timeout: 2000 }
      );
    });
  });

  describe('edge cases', () => {
    it('handles formData with minimal fields', () => {
      const minimalFormData = { resistances: [], immunities: [], rules: '5e', level: 1 };
      const { result } = renderWithResistances(minimalFormData);
      expect(result.current.resistanceWarnings).toEqual([]);
      expect(result.current.preSelectedResistancesList).toEqual({ resistances: [], immunities: [] });
    });

    it('handles formData with null race and class', () => {
      const nullRaceFormData = { ...baseFormData, class: null, race: null };
      const { result } = renderWithResistances(nullRaceFormData);
      expect(result.current.resistanceWarnings).toEqual([]);
      expect(result.current.preSelectedResistancesList).toEqual({ resistances: [], immunities: [] });
    });

    it('handles formData with missing optional fields', () => {
      const sparseFormData = { level: 5 };
      const { result } = renderWithResistances(sparseFormData);
      expect(result.current.resistanceWarnings).toEqual([]);
      expect(result.current.preSelectedResistancesList).toEqual({ resistances: [], immunities: [] });
    });
  });
});
