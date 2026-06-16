import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

  it('should initialize with empty pre-selected feats', () => {
    const { result } = renderHook(() =>
      useWizardFeats(mockFormData, mockSetFormData)
        );

    expect(result.current.preSelectedFeats).toEqual([]);
      });

  it('should load pre-selected feats', async () => {
    getPreSelectedFeats.mockResolvedValue(['Tough', 'Resilient']);

    const { result } = renderHook(() =>
      useWizardFeats(mockFormData, mockSetFormData)
        );

    await waitFor(() => {
      expect(result.current.preSelectedFeats.length).toBeGreaterThan(0);
        });

    expect(result.current.preSelectedFeats).toEqual(['Tough', 'Resilient']);
      });

  it('should add missing pre-selected feats to form data', async () => {
    getPreSelectedFeats.mockResolvedValue(['Tough', 'Resilient']);

    renderHook(() =>
      useWizardFeats(mockFormData, mockSetFormData)
        );

    await waitFor(() => {
      expect(mockSetFormData).toHaveBeenCalled();
        });

    expect(mockSetFormData).toHaveBeenCalledWith(expect.any(Function));
      });

  it('should not add feats that are already in form data', async () => {
      const formDataWithFeats = {
             ...mockFormData,
        feats: ['Tough', 'Resilient']
             };
      getPreSelectedFeats.mockResolvedValue(['Tough', 'Resilient']);

      const { result } = renderHook(() =>
        useWizardFeats(formDataWithFeats, mockSetFormData)
             );

      await waitFor(() => {
               // Wait for pre-select to run
        expect(result.current.preSelectedFeats.length).toBeGreaterThan(0);
             });

              // setFormData is called but with an identity function that returns prev unchanged
              // because all feats are already present
      expect(mockSetFormData).toHaveBeenCalled();
      const setFormDataCall = mockSetFormData.mock.calls[0][0];
      expect(typeof setFormDataCall).toBe('function');
    
      // Call the function with the current form data to verify it returns unchanged data
      const returnedData = setFormDataCall(formDataWithFeats);
      expect(returnedData).toEqual(formDataWithFeats);
           });

  it('should handle errors gracefully', async () => {
    getPreSelectedFeats.mockRejectedValue(new Error('Fetch error'));
    console.error = vi.fn();

    const { result } = renderHook(() =>
      useWizardFeats(mockFormData, mockSetFormData)
        );

    await waitFor(() => {
          // Should still have empty preSelectedFeats even on error
      expect(result.current.preSelectedFeats).toEqual([]);
        });
      });

  it('should return preSelectedFeats property', () => {
    const { result } = renderHook(() =>
      useWizardFeats(mockFormData, mockSetFormData)
        );

    expect(result.current).toHaveProperty('preSelectedFeats');
      });
});
