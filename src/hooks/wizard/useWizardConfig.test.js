// @cleaned-by-ai
// @improved-by-ai
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardConfig from './useWizardConfig.js';

describe('useWizardConfig', () => {
  const mockFormData = {
    name: 'Test Character',
    class: { name: 'Fighter' },
  };
  const mockValidateFn = vi.fn().mockResolvedValue([]);
  const mockSetFormData = vi.fn();

  const mockSlots = [
    {
      state: { key: 'subclass', initial: null },
      get: vi.fn().mockResolvedValue({ value: 'Spell Sniper', preSelected: [] }),
    },
    {
      state: { key: 'hitPoints', initial: 10 },
      get: vi.fn().mockResolvedValue({ value: 12, preSelected: null }),
    },
  ];

  const mockGetDeps = vi.fn().mockReturnValue([mockFormData]);

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateFn.mockResolvedValue([]);
    mockSetFormData.mockClear();
  });

  function renderConfig(configOverrides = {}) {
    const defaultConfig = {
      formData: mockFormData,
      validateFn: mockValidateFn,
      slots: mockSlots,
      getDeps: mockGetDeps,
      preSelect: undefined,
      setFormData: mockSetFormData,
      ...configOverrides,
    };
    return renderHook(() => useWizardConfig(defaultConfig));
  }

  describe('initial state', () => {
    it('returns warnings as empty array', () => {
      const { result } = renderConfig();
      expect(result.current.warnings).toEqual([]);
    });

    it('returns setWarnings as a function', () => {
      const { result } = renderConfig();
      expect(typeof result.current.setWarnings).toBe('function');
    });

    it('returns initial slot values from slot state defaults', () => {
      const { result } = renderConfig();
      expect(result.current.subclass).toBeNull();
      expect(result.current.hitPoints).toBe(10);
    });

    it('returns warnings and setWarnings properties', () => {
      const { result } = renderConfig();
      expect(result.current).toHaveProperty('warnings');
      expect(result.current).toHaveProperty('setWarnings');
    });
  });

  describe('validation effect', () => {
    it('calls validateFn with formData', async () => {
      renderConfig();
      await waitFor(() => {
        expect(mockValidateFn).toHaveBeenCalledWith(mockFormData);
      });
    });

    it('sets warnings from validateFn result', async () => {
      const mockWarnings = ['Field A is required', 'Field B is invalid'];
      mockValidateFn.mockResolvedValue(mockWarnings);

      const { result } = renderConfig();
      await waitFor(() => {
        expect(result.current.warnings).toEqual(mockWarnings);
      });
    });

    it('sets empty warnings when validateFn returns null or undefined', async () => {
      mockValidateFn.mockResolvedValue(null);

      const { result } = renderConfig();
      await waitFor(() => {
        expect(result.current.warnings).toEqual([]);
      });
    });

    it('sets slot state from slot.get results', async () => {
      mockSlots[0].get.mockResolvedValue({ value: 'Thief', preSelected: [] });
      mockSlots[1].get.mockResolvedValue({ value: 15, preSelected: null });

      const { result } = renderConfig();
      await waitFor(() => {
        expect(result.current.subclass).toEqual({ value: 'Thief', preSelected: [] });
        expect(result.current.hitPoints).toEqual({ value: 15, preSelected: null });
      });
    });

    it('uses slot initial value when slot.get result is not in slotState', () => {
      const { result } = renderConfig();
      expect(result.current.subclass).toBeNull();
      expect(result.current.hitPoints).toBe(10);
    });

    it('handles slot.get error without crashing', async () => {
      const error = new Error('Failed to fetch slot');
      mockSlots[0].get.mockRejectedValue(error);
      console.error = vi.fn();

      const { result } = renderConfig();
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          'Wizard config validation error:',
          error
        );
      });

      // Slot state should remain at initial values
      expect(result.current.subclass).toBeNull();
      expect(result.current.hitPoints).toBe(10);
    });

    it('handles validateFn error without crashing', async () => {
      mockValidateFn.mockRejectedValue(new Error('Validation failed'));
      console.error = vi.fn();

      const { result } = renderConfig();
      await waitFor(() => {
        expect(console.error).toHaveBeenCalled();
      });

      expect(result.current.warnings).toEqual([]);
    });
  });

  describe('pre-select auto-merge effect', () => {
    it('does not run pre-select effect when preSelect is absent', async () => {
      renderConfig({ preSelect: undefined });
      await waitFor(() => {
        expect(mockSetFormData).not.toHaveBeenCalled();
      });
    });

    it('calls preSelect.getFn with formData and sets state', async () => {
      const mockGetFn = vi.fn().mockResolvedValue(['Feature A', 'Feature B']);

      const { result } = renderConfig({
        preSelect: {
          stateKey: 'features',
          getFn: mockGetFn,
          deps: () => [],
          merge: vi.fn(),
        },
      });

      await waitFor(() => {
        expect(mockGetFn).toHaveBeenCalledWith(mockFormData);
        expect(result.current.features).toEqual(['Feature A', 'Feature B']);
      });
    });

    it('does not call merge when preSelect.merge is falsey', async () => {
      const mockGetFn = vi.fn().mockResolvedValue(['Feature A']);

      renderConfig({
        preSelect: {
          stateKey: 'features',
          getFn: mockGetFn,
          deps: () => [],
          merge: false,
        },
      });

      await waitFor(() => {
        expect(mockSetFormData).not.toHaveBeenCalled();
      });
    });

    it('does not call merge when preSelect.getFn returns empty array', async () => {
      const mockGetFn = vi.fn().mockResolvedValue([]);
      const mockMerge = vi.fn();

      renderConfig({
        preSelect: {
          stateKey: 'features',
          getFn: mockGetFn,
          deps: () => [],
          merge: mockMerge,
        },
      });

      await waitFor(() => {
        expect(mockMerge).not.toHaveBeenCalled();
      });
    });

    it('calls merge via setFormData when items exist', async () => {
      const items = ['Feature A'];
      const mockGetFn = vi.fn().mockResolvedValue(items);
      const mockMerge = vi.fn();

      renderConfig({
        preSelect: {
          stateKey: 'features',
          getFn: mockGetFn,
          deps: () => [],
          merge: mockMerge,
        },
      });

      await waitFor(() => {
        expect(mockSetFormData).toHaveBeenCalled();
      });
    });

    it('uses custom hasItems when provided', async () => {
      const mockGetFn = vi.fn().mockResolvedValue('singleString');
      const mockMerge = vi.fn();
      const mockHasItems = vi.fn().mockReturnValue(false);

      renderConfig({
        preSelect: {
          stateKey: 'features',
          getFn: mockGetFn,
          deps: () => [],
          merge: mockMerge,
          hasItems: mockHasItems,
        },
      });

      await waitFor(() => {
        expect(mockHasItems).toHaveBeenCalled();
      });
    });

    it('handles preSelect.getFn error without crashing', async () => {
      const error = new Error('Pre-select fetch failed');
      const mockGetFn = vi.fn().mockRejectedValue(error);
      console.error = vi.fn();

      renderConfig({
        preSelect: {
          stateKey: 'features',
          getFn: mockGetFn,
          deps: () => [],
          merge: vi.fn(),
        },
      });

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith('Pre-select error:', error);
      });
    });

    it('handles preSelect without stateKey - still calls merge', async () => {
      const mockGetFn = vi.fn().mockResolvedValue(['Feature A']);

      const { result } = renderConfig({
        preSelect: {
          getFn: mockGetFn,
          deps: () => [],
          merge: vi.fn(),
        },
      });

      await waitFor(() => {
        expect(mockSetFormData).toHaveBeenCalled();
      });

      // Should not have any preSelectedState keys since no stateKey
      expect(result.current).not.toHaveProperty('features');
    });
  });

  describe('preSelect state initial values', () => {
    it('initializes preSelect stateKey with stateInitial when provided', async () => {
      const { result } = renderConfig({
        preSelect: {
          stateKey: 'preloaded',
          stateInitial: ['Default A', 'Default B'],
          getFn: vi.fn().mockResolvedValue([]),
          deps: () => [],
        },
      });

      await waitFor(() => {
        expect(result.current.preloaded).toEqual(['Default A', 'Default B']);
      });
    });

    it('initializes preSelect stateKey with empty array when stateInitial is not provided', async () => {
      const { result } = renderConfig({
        preSelect: {
          stateKey: 'preloaded',
          getFn: vi.fn().mockResolvedValue([]),
          deps: () => [],
        },
      });

      await waitFor(() => {
        expect(result.current.preloaded).toEqual([]);
      });
    });

    it('initializes slot preSelectedKey with empty array when slot.preSelectedKey is set', async () => {
      const slotsWithPreSelected = [
        {
          state: { key: 'subclass', initial: null },
          get: vi.fn().mockResolvedValue({ value: 'Thief', preSelected: null }),
          preSelectedKey: 'subclassPreselected',
        },
      ];

      const { result } = renderConfig({ slots: slotsWithPreSelected });

      await waitFor(() => {
        expect(result.current.subclassPreselected).toEqual([]);
      });
    });
  });

  describe('slot configuration edge cases', () => {
    it('handles empty slots array', () => {
      const { result } = renderConfig({ slots: [] });
      expect(result.current.warnings).toEqual([]);
      expect(result.current).toHaveProperty('warnings');
      expect(result.current).toHaveProperty('setWarnings');
    });

    it('handles slots with both preSelected and normal values', async () => {
      const slotsMixed = [
        {
          state: { key: 'subclass', initial: null },
          get: vi.fn().mockResolvedValue({ value: 'Thief', preSelected: ['Skill1'] }),
          preSelectedKey: 'subclassPreselected',
        },
        {
          state: { key: 'hitPoints', initial: 10 },
          get: vi.fn().mockResolvedValue({ value: 12, preSelected: null }),
        },
      ];

      const { result } = renderConfig({ slots: slotsMixed });
      await waitFor(() => {
        expect(result.current.subclass).toEqual({ value: 'Thief', preSelected: ['Skill1'] });
        expect(result.current.hitPoints).toEqual({ value: 12, preSelected: null });
        expect(result.current.subclassPreselected).toEqual(['Skill1']);
      });
    });
  });

  describe('setWarnings', () => {
    it('updates warnings when called', async () => {
      const { result } = renderConfig();

      await waitFor(() => {
        expect(result.current.warnings).toEqual([]);
      });

      act(() => {
        result.current.setWarnings(['New warning']);
      });

      await waitFor(() => {
        expect(result.current.warnings).toEqual(['New warning']);
      });
    });

    it('replaces all warnings when called with new array', async () => {
      const { result } = renderConfig();
      await waitFor(() => {
        expect(result.current.warnings).toEqual([]);
      });

      act(() => {
        result.current.setWarnings(['Warning 1', 'Warning 2']);
      });

      await waitFor(() => {
        expect(result.current.warnings).toEqual(['Warning 1', 'Warning 2']);
      });

      act(() => {
        result.current.setWarnings(['Replaced warning']);
      });

      await waitFor(() => {
        expect(result.current.warnings).toEqual(['Replaced warning']);
      });
    });
  });

  describe('getDeps usage', () => {
    it('calls getDeps with formData for effect dependencies', () => {
      renderConfig();
      expect(mockGetDeps).toHaveBeenCalledWith(mockFormData);
    });
  });
});
