// @improved-by-ai
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useWizardFeats from './useWizardFeats.js';

// Mock the feat validation service
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

  afterEach(() => {
    // Restore console.error if any test replaced it
    if (console.error.mockRestore) {
      console.error.mockRestore();
    }
  });

  it('should initialize with empty pre-selected feats', () => {
    const { result } = renderHook(() =>
      useWizardFeats(mockFormData, mockSetFormData)
    );

    expect(result.current.preSelectedFeats).toEqual([]);
  });

  it('should load pre-selected feats from the validation service', async () => {
    getPreSelectedFeats.mockResolvedValue(['Tough', 'Resilient']);

    const { result } = renderHook(() =>
      useWizardFeats(mockFormData, mockSetFormData)
    );

    await waitFor(() => {
      expect(result.current.preSelectedFeats).toEqual(['Tough', 'Resilient']);
    });
  });

  it('should merge new pre-selected feats into form data via setFormData callback', async () => {
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

  it('should deduplicate feats already present in form data', async () => {
    const formDataWithFeats = {
      ...mockFormData,
      feats: ['Tough', 'Resilient']
    };
    getPreSelectedFeats.mockResolvedValue(['Tough', 'Resilient']);

    const { result } = renderHook(() =>
      useWizardFeats(formDataWithFeats, mockSetFormData)
    );

    await waitFor(() => {
      expect(result.current.preSelectedFeats).toEqual(['Tough', 'Resilient']);
    });

    expect(mockSetFormData).toHaveBeenCalled();
    const setFormDataCall = mockSetFormData.mock.calls[0][0];
    const returnedData = setFormDataCall(formDataWithFeats);
    expect(returnedData).toEqual(formDataWithFeats);
  });

  it('should not duplicate feats that partially overlap with form data', async () => {
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

  it('should handle errors gracefully and keep empty pre-selected feats', async () => {
    getPreSelectedFeats.mockRejectedValue(new Error('Fetch error'));
    const originalConsoleError = console.error;
    console.error = vi.fn();

    const { result } = renderHook(() =>
      useWizardFeats(mockFormData, mockSetFormData)
    );

    await waitFor(() => {
      expect(result.current.preSelectedFeats).toEqual([]);
    });

    expect(console.error).toHaveBeenCalledWith('Pre-select error:', expect.any(Error));

    console.error = originalConsoleError;
  });

  it('should not call setFormData when pre-selected feats are empty', async () => {
    getPreSelectedFeats.mockResolvedValue([]);

    renderHook(() =>
      useWizardFeats(mockFormData, mockSetFormData)
    );

    // Give the effect time to run
    await new Promise((r) => setTimeout(r, 50));

    expect(mockSetFormData).not.toHaveBeenCalled();
  });
});
