import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardConfig from './useWizardConfig.js';

describe('useWizardConfig', () => {
  const mockFormData = { class: { name: 'Fighter' }, race: { name: 'Human' } };
  const mockSetFormData = vi.fn();
  const mockValidateFn = vi.fn().mockResolvedValue([]);
  const mockGetDeps = vi.fn(() => []);

  const mockSlot1 = {
    state: { key: 'skills', initial: [] },
    get: vi.fn().mockResolvedValue({ items: ['Athletics'] }),
  };

  const mockSlot2 = {
    state: { key: 'feats', initial: [] },
    get: vi.fn().mockResolvedValue({ items: ['Tough'] }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateFn.mockResolvedValue([]);
    mockSlot1.get.mockResolvedValue({ items: ['Athletics'] });
    mockSlot2.get.mockResolvedValue({ items: ['Tough'] });
    mockSetFormData.mockClear();
  });

  it('should initialize with initial slot values, empty preSelected, and empty warnings', () => {
    const { result } = renderHook(() =>
      useWizardConfig({
        formData: mockFormData,
        validateFn: mockValidateFn,
        slots: [mockSlot1, mockSlot2],
        getDeps: mockGetDeps,
        setFormData: mockSetFormData,
      })
    );

    expect(result.current.skills).toEqual([]);
    expect(result.current.feats).toEqual([]);
    expect(result.current.warnings).toEqual([]);
  });

  it('should load slot values after effects run', async () => {
    const { result } = renderHook(() =>
      useWizardConfig({
        formData: mockFormData,
        validateFn: mockValidateFn,
        slots: [mockSlot1, mockSlot2],
        getDeps: mockGetDeps,
        setFormData: mockSetFormData,
      })
    );

    await waitFor(() => {
      expect(result.current.skills).toEqual({ items: ['Athletics'] });
      expect(result.current.feats).toEqual({ items: ['Tough'] });
    });
  });

  it('should load warnings from validateFn', async () => {
    mockValidateFn.mockResolvedValue(['Too many skills', 'Invalid feat']);
    const { result } = renderHook(() =>
      useWizardConfig({
        formData: mockFormData,
        validateFn: mockValidateFn,
        slots: [mockSlot1],
        getDeps: mockGetDeps,
        setFormData: mockSetFormData,
      })
    );

    await waitFor(() => {
      expect(result.current.warnings).toEqual(['Too many skills', 'Invalid feat']);
    });
  });

  it('should extract preSelected from slots when preSelectedKey is provided', async () => {
    const slotWithPreSelected = {
      state: { key: 'skills', initial: [] },
      preSelectedKey: 'preSelectedSkills',
      get: vi.fn().mockResolvedValue({
        items: ['Athletics'],
        preSelected: ['Athletics', 'Intimidation'],
      }),
    };
    void slotWithPreSelected;

    const { result } = renderHook(() =>
      useWizardConfig({
        formData: mockFormData,
        validateFn: mockValidateFn,
        slots: [mockSlot1],
        getDeps: mockGetDeps,
        setFormData: mockSetFormData,
      })
    );

    expect(result.current.preSelectedSkills).toEqual([]);

    await waitFor(() => {
      expect(result.current.preSelectedSkills).toEqual(['Athletics', 'Intimidation']);
    });
  });

  it('should pre-select auto-merge when preSelect config is provided', async () => {
    const preSelectItems = ['Darkvision'];
    const mockGetFn = vi.fn().mockResolvedValue(preSelectItems);
    const mockMerge = vi.fn().mockReturnValue({ merged: true });

    const { result } = renderHook(() =>
      useWizardConfig({
        formData: mockFormData,
        validateFn: mockValidateFn,
        slots: [mockSlot1],
        getDeps: mockGetDeps,
        setFormData: mockSetFormData,
        preSelect: {
          getFn: mockGetFn,
          merge: mockMerge,
          stateKey: 'preSelectedTraits',
          deps: () => [],
          },
        })
      );

    await waitFor(() => {
      expect(result.current.preSelectedTraits).toEqual(preSelectItems);
      expect(mockSetFormData).toHaveBeenCalled();
      });

    expect(mockGetFn).toHaveBeenCalledWith(mockFormData);
    expect(mockSetFormData).toHaveBeenCalledWith(expect.any(Function));
    const setFormDataCallback = mockSetFormData.mock.calls[0][0];
    const mergedResult = setFormDataCallback(mockFormData);
    expect(mockMerge).toHaveBeenCalledWith(mockFormData, preSelectItems);
    expect(mergedResult).toEqual({ merged: true });
    });

  it('should respect hasItems and not call setFormData when hasItems returns false', async () => {
    const mockGetFn = vi.fn().mockResolvedValue([]);
    const mockMerge = vi.fn();

    renderHook(() =>
      useWizardConfig({
        formData: mockFormData,
        validateFn: mockValidateFn,
        slots: [mockSlot1],
        getDeps: mockGetDeps,
        setFormData: mockSetFormData,
        preSelect: {
          getFn: mockGetFn,
          merge: mockMerge,
          stateKey: 'preSelectedTraits',
          hasItems: (x) => Array.isArray(x) && x.length > 0,
          deps: () => [],
        },
      })
    );

    await waitFor(() => {
      expect(mockGetFn).toHaveBeenCalled();
    });

    expect(mockMerge).not.toHaveBeenCalled();
    expect(mockSetFormData).not.toHaveBeenCalled();
  });

  it('should handle validateFn errors gracefully', async () => {
    const mockError = new Error('Validation failed');
    mockValidateFn.mockRejectedValue(mockError);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const initialGet = vi.fn().mockResolvedValue({ items: [] });
    void initialGet;

    const { result } = renderHook(() =>
      useWizardConfig({
        formData: mockFormData,
        validateFn: mockValidateFn,
        slots: [mockSlot1],
        getDeps: mockGetDeps,
        setFormData: mockSetFormData,
      })
    );

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    expect(result.current.warnings).toEqual([]);

    consoleSpy.mockRestore();
  });

  it('should handle pre-select errors gracefully', async () => {
    const mockError = new Error('Pre-select fetch failed');
    const mockGetFn = vi.fn().mockRejectedValue(mockError);
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result: _result } = renderHook(() =>
      useWizardConfig({
        formData: mockFormData,
        validateFn: mockValidateFn,
        slots: [mockSlot1],
        getDeps: mockGetDeps,
        setFormData: mockSetFormData,
        preSelect: {
          getFn: mockGetFn,
          merge: vi.fn(),
          stateKey: 'preSelectedTraits',
          deps: () => [],
        },
      })
    );
    void _result;

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it('should return setWarnings that updates warnings', async () => {
    const { result } = renderHook(() =>
      useWizardConfig({
        formData: mockFormData,
        validateFn: mockValidateFn,
        slots: [mockSlot1],
        getDeps: mockGetDeps,
        setFormData: mockSetFormData,
        })
      );

    expect(result.current.setWarnings).toBeDefined();

    await waitFor(() => {
      expect(result.current.skills).toEqual({ items: ['Athletics'] });
      });

    act(() => {
      result.current.setWarnings(['Manual warning']);
      });

    expect(result.current.warnings).toEqual(['Manual warning']);
    });

  it('should not run pre-select effect when preSelect is undefined', async () => {
    const mockMerge = vi.fn();

    const { result } = renderHook(() =>
      useWizardConfig({
        formData: mockFormData,
        validateFn: mockValidateFn,
        slots: [mockSlot1],
        getDeps: mockGetDeps,
        setFormData: mockSetFormData,
      })
    );

    await waitFor(() => {
      expect(result.current.skills).toEqual({ items: ['Athletics'] });
    });

    expect(mockMerge).not.toHaveBeenCalled();
  });
});
