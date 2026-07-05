// @cleaned-by-ai
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardFeats from './useWizardFeats.js';

vi.mock('../../services/character/featValidation.js', () => ({
  getPreSelectedFeats: vi.fn()
}));

import { getPreSelectedFeats } from '../../services/character/featValidation.js';

describe('useWizardFeats', () => {
  const mockFormData = {
    background: 'Soldier',
    feats: [],
    rules: '5e'
  };
  const mockSetFormData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getPreSelectedFeats.mockResolvedValue([]);
  });

  describe('initial state and loading', () => {
    it('initializes with empty pre-selected feats', () => {
      const { result } = renderHook(() =>
        useWizardFeats(mockFormData, mockSetFormData)
      );
      expect(result.current.preSelectedFeats).toEqual([]);
    });

    it('loads pre-selected feats from the validation service', async () => {
      getPreSelectedFeats.mockResolvedValue(['Tough', 'Resilient']);

      const { result } = renderHook(() =>
        useWizardFeats(mockFormData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.preSelectedFeats).toEqual(['Tough', 'Resilient']);
      });
    });

    it('does not call setFormData when pre-selected feats are empty', async () => {
      getPreSelectedFeats.mockResolvedValue([]);

      renderHook(() =>
        useWizardFeats(mockFormData, mockSetFormData)
      );

      await new Promise((r) => setTimeout(r, 50));
      expect(mockSetFormData).not.toHaveBeenCalled();
    });
  });

  describe('merging', () => {
    it('merges new pre-selected feats into form data via setFormData callback', async () => {
      getPreSelectedFeats.mockResolvedValue(['Tough', 'Resilient']);

      renderHook(() =>
        useWizardFeats(mockFormData, mockSetFormData)
      );

      await waitFor(() => {
        expect(mockSetFormData).toHaveBeenCalled();
      });

      const setFormDataCall = mockSetFormData.mock.calls[0][0];
      expect(typeof setFormDataCall).toBe('function');

      const updatedData = setFormDataCall(mockFormData);
      expect(updatedData.feats).toEqual(['Tough', 'Resilient']);
    });

    it('merges new feats without duplicating existing ones', async () => {
      const formDataWithFeats = {
        ...mockFormData,
        feats: ['Tough']
      };
      getPreSelectedFeats.mockResolvedValue(['Tough', 'Resilient']);

      renderHook(() =>
        useWizardFeats(formDataWithFeats, mockSetFormData)
      );

      await waitFor(() => {
        expect(mockSetFormData).toHaveBeenCalled();
      });

      const setFormDataCall = mockSetFormData.mock.calls[0][0];
      const updatedData = setFormDataCall(formDataWithFeats);
      expect(updatedData.feats).toEqual(['Tough', 'Resilient']);
    });
  });

  describe('error handling', () => {
    it('keeps empty pre-selected feats when the service fails', async () => {
      getPreSelectedFeats.mockRejectedValue(new Error('Fetch error'));

      const { result } = renderHook(() =>
        useWizardFeats(mockFormData, mockSetFormData)
      );

      await waitFor(() => {
        expect(result.current.preSelectedFeats).toEqual([]);
      });
    });
  });
});
