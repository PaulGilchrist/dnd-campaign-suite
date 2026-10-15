// @maintained-by-ai
// useWizardConfig is a stable, generic engine hook: config-driven slot fetching,
// validation, and pre-select auto-merge. Every test here uses pure mocks and is
// deterministic and order-independent (fresh mocks per test, unique preSelect stateKeys
// to isolate the module-level prevPreSelectedMap), so it should not churn as the app changes.
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useWizardConfig from './useWizardConfig.js';

describe('useWizardConfig', () => {
  const mockFormData = {
    name: 'Test Character',
    class: { name: 'Fighter' },
  };

  let mockValidateFn;
  let mockSetFormData;
  let mockGetDeps;
  let mockSlots;

  beforeEach(() => {
    mockValidateFn = vi.fn().mockResolvedValue([]);
    mockSetFormData = vi.fn();
    mockGetDeps = vi.fn().mockReturnValue([mockFormData]);
    mockSlots = [
      {
        state: { key: 'subclass', initial: null },
        get: vi.fn().mockResolvedValue({ value: 'Spell Sniper', preSelected: [] }),
      },
      {
        state: { key: 'hitPoints', initial: 10 },
        get: vi.fn().mockResolvedValue({ value: 12, preSelected: null }),
      },
    ];
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function renderConfig(configOverrides = {}) {
    const config = {
      formData: mockFormData,
      validateFn: mockValidateFn,
      slots: mockSlots,
      getDeps: mockGetDeps,
      preSelect: undefined,
      setFormData: mockSetFormData,
      ...configOverrides,
    };
    return renderHook(() => useWizardConfig(config));
  }

  describe('initial state and warnings', () => {
    it('exposes empty warnings and a setWarnings function', () => {
      const { result } = renderConfig({ slots: [] });
      expect(result.current.warnings).toEqual([]);
      expect(typeof result.current.setWarnings).toBe('function');
    });

    it('returns initial slot values from slot state defaults before async results land', () => {
      const { result } = renderConfig();
      expect(result.current.subclass).toBeNull();
      expect(result.current.hitPoints).toBe(10);
    });

    it('updates and replaces warnings when setWarnings is called', async () => {
      const { result } = renderConfig();

      act(() => {
        result.current.setWarnings(['Warning 1', 'Warning 2']);
      });
      expect(result.current.warnings).toEqual(['Warning 1', 'Warning 2']);

      act(() => {
        result.current.setWarnings(['Replaced warning']);
      });
      expect(result.current.warnings).toEqual(['Replaced warning']);
    });
  });

  describe('validation + slot fetching effect', () => {
    it('calls validateFn and getDeps with formData', async () => {
      renderConfig();
      await waitFor(() => {
        expect(mockValidateFn).toHaveBeenCalledWith(mockFormData);
      });
      expect(mockGetDeps).toHaveBeenCalledWith(mockFormData);
    });

    it('sets warnings from validateFn result', async () => {
      const mockWarnings = ['Field A is required', 'Field B is invalid'];
      mockValidateFn.mockResolvedValue(mockWarnings);

      const { result } = renderConfig();
      await waitFor(() => {
        expect(result.current.warnings).toEqual(mockWarnings);
      });
    });

    it('normalises a null validateFn result to empty warnings', async () => {
      mockValidateFn.mockResolvedValue(null);

      const { result } = renderConfig();
      await waitFor(() => {
        expect(result.current.warnings).toEqual([]);
      });
    });

    it('resolves slot state from slot.get results', async () => {
      mockSlots[0].get.mockResolvedValue({ value: 'Thief', preSelected: null });
      mockSlots[1].get.mockResolvedValue({ value: 15, preSelected: null });

      const { result } = renderConfig();
      await waitFor(() => {
        expect(result.current.subclass).toEqual({ value: 'Thief', preSelected: null });
        expect(result.current.hitPoints).toEqual({ value: 15, preSelected: null });
      });
    });

    it('populates slot preSelectedKey state when slot.get returns preSelected items', async () => {
      mockSlots = [
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

      const { result } = renderConfig();
      await waitFor(() => {
        expect(result.current.subclass).toEqual({ value: 'Thief', preSelected: ['Skill1'] });
        expect(result.current.hitPoints).toEqual({ value: 12, preSelected: null });
        expect(result.current.subclassPreselected).toEqual(['Skill1']);
      });
    });

    it('logs and keeps initial values when slot.get rejects', async () => {
      const error = new Error('Failed to fetch slot');
      mockSlots[0].get.mockRejectedValue(error);

      const { result } = renderConfig();
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith('Wizard config validation error:', error);
      });
      expect(result.current.subclass).toBeNull();
      expect(result.current.hitPoints).toBe(10);
      expect(result.current.warnings).toEqual([]);
    });

    it('keeps initial slot values when validateFn rejects even though slots resolved', async () => {
      mockValidateFn.mockRejectedValue(new Error('Validation failed'));

      const { result } = renderConfig();
      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          'Wizard config validation error:',
          expect.any(Error)
        );
      });
      // Slots resolved successfully but state must not be applied because validation failed
      expect(mockSlots[0].get).toHaveBeenCalled();
      expect(result.current.subclass).toBeNull();
      expect(result.current.hitPoints).toBe(10);
      expect(result.current.warnings).toEqual([]);
    });
  });

  describe('pre-select auto-merge effect', () => {
    it('does not run when preSelect is absent', async () => {
      renderConfig({ preSelect: undefined });
      await waitFor(() => {
        expect(mockValidateFn).toHaveBeenCalled();
      });
      expect(mockSetFormData).not.toHaveBeenCalled();
    });

    it('calls getFn with formData and exposes items under stateKey', async () => {
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

    it('does not call setFormData when merge is falsey', async () => {
      renderConfig({
        preSelect: {
          stateKey: 'noMerge',
          getFn: vi.fn().mockResolvedValue(['Feature A']),
          deps: () => [],
          merge: false,
        },
      });

      await waitFor(() => {
        expect(mockValidateFn).toHaveBeenCalled();
      });
      expect(mockSetFormData).not.toHaveBeenCalled();
    });

    it('does not merge when the default hasItems sees an empty array', async () => {
      const mockMerge = vi.fn();

      renderConfig({
        preSelect: {
          stateKey: 'emptyItems',
          getFn: vi.fn().mockResolvedValue([]),
          deps: () => [],
          merge: mockMerge,
        },
      });

      await waitFor(() => {
        expect(mockValidateFn).toHaveBeenCalled();
      });
      expect(mockMerge).not.toHaveBeenCalled();
      expect(mockSetFormData).not.toHaveBeenCalled();
    });

    it('uses custom hasItems and skips merge when it returns false', async () => {
      const items = 'singleString';
      const mockHasItems = vi.fn().mockReturnValue(false);

      renderConfig({
        preSelect: {
          stateKey: 'customHasItems',
          getFn: vi.fn().mockResolvedValue(items),
          deps: () => [],
          merge: vi.fn(),
          hasItems: mockHasItems,
        },
      });

      await waitFor(() => {
        expect(mockHasItems).toHaveBeenCalledWith(items);
      });
      expect(mockSetFormData).not.toHaveBeenCalled();
    });

    it('merges via setFormData(prev, items, prevItems) when items exist', async () => {
      const items = ['Feature A'];
      const mockMerge = vi.fn().mockReturnValue({ merged: true });
      // Invoke the updater so the merge callback is actually exercised
      mockSetFormData.mockImplementation((updater) => updater({ prev: true }));

      renderConfig({
        preSelect: {
          stateKey: 'mergeHappyPath',
          getFn: vi.fn().mockResolvedValue(items),
          deps: () => [],
          merge: mockMerge,
        },
      });

      await waitFor(() => {
        expect(mockSetFormData).toHaveBeenCalled();
      });
      // First merge for this stateKey: no previous items recorded
      expect(mockMerge).toHaveBeenCalledWith({ prev: true }, items, []);
    });

    it('does not expose state under an unknown key when preSelect has no stateKey', async () => {
      const items = ['Feature A'];
      const mockMerge = vi.fn();
      mockSetFormData.mockImplementation((updater) => updater({ prev: true }));

      const { result } = renderConfig({
        preSelect: {
          getFn: vi.fn().mockResolvedValue(items),
          deps: () => [],
          merge: mockMerge,
        },
      });

      await waitFor(() => {
        expect(mockMerge).toHaveBeenCalledWith({ prev: true }, items, []);
      });
      expect(result.current).not.toHaveProperty('features');
    });

    it('logs preSelect.getFn errors without crashing', async () => {
      const error = new Error('Pre-select fetch failed');

      renderConfig({
        preSelect: {
          stateKey: 'failingGetFn',
          getFn: vi.fn().mockRejectedValue(error),
          deps: () => [],
          merge: vi.fn(),
        },
      });

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith('Pre-select error:', error);
      });
      expect(mockSetFormData).not.toHaveBeenCalled();
    });
  });

  describe('pre-select state initial values', () => {
    it('initializes preSelect stateKey with stateInitial when provided', () => {
      const { result } = renderConfig({
        preSelect: {
          stateKey: 'preloaded',
          stateInitial: ['Default A', 'Default B'],
          getFn: vi.fn().mockResolvedValue([]),
          deps: () => [],
        },
      });

      expect(result.current.preloaded).toEqual(['Default A', 'Default B']);
    });

    it('initializes preSelect stateKey with empty array when stateInitial is not provided', () => {
      const { result } = renderConfig({
        preSelect: {
          stateKey: 'preloaded',
          getFn: vi.fn().mockResolvedValue([]),
          deps: () => [],
        },
      });

      expect(result.current.preloaded).toEqual([]);
    });

    it('initializes slot preSelectedKey with empty array when slot.preSelectedKey is set', () => {
      mockSlots = [
        {
          state: { key: 'subclass', initial: null },
          get: vi.fn().mockResolvedValue({ value: 'Thief', preSelected: null }),
          preSelectedKey: 'subclassPreselected',
        },
      ];

      const { result } = renderConfig();

      expect(result.current.subclassPreselected).toEqual([]);
    });
  });
});
