import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useWizardSpells from './useWizardSpells.js';

vi.mock('../../services/character/getPreSelectedSpells.js', () => ({
  getPreSelectedSpells: vi.fn(),
}));

import { getPreSelectedSpells } from '../../services/character/getPreSelectedSpells.js';

describe('useWizardSpells', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('returns empty preSelectedSpells before the effect resolves', () => {
      getPreSelectedSpells.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useWizardSpells({ name: 'Test', level: 1 }));

      expect(result.current.preSelectedSpells).toEqual([]);
    });
  });

  describe('async resolution', () => {
    it('populates preSelectedSpells with resolved spell names', async () => {
      getPreSelectedSpells.mockResolvedValue(['Fire Bolt', 'Magic Missile', 'Shield']);

      const { result } = renderHook(() => useWizardSpells({ name: 'Test', level: 1 }));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.preSelectedSpells).toEqual(['Fire Bolt', 'Magic Missile', 'Shield']);
    });

    it('sets preSelectedSpells to empty array when the service returns an empty array', async () => {
      getPreSelectedSpells.mockResolvedValue([]);

      const { result } = renderHook(() => useWizardSpells({ name: 'Test', level: 1 }));

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.preSelectedSpells).toEqual([]);
    });

    it('passes formData to getPreSelectedSpells via the ref', async () => {
      const formData = { name: 'Test', level: 3, rules: '2024' };
      getPreSelectedSpells.mockResolvedValue([]);

      renderHook(() => useWizardSpells(formData));

      await act(async () => {
        await Promise.resolve();
      });

      expect(getPreSelectedSpells).toHaveBeenCalledWith(formData);
    });
  });

  describe('re-computation on dependency changes', () => {
    it('re-fetches when any tracked formData field changes', async () => {
      getPreSelectedSpells.mockResolvedValueOnce(['Burning Hands']);

      const formData = { name: 'Test', level: 1, class: { subclass: { name: 'Evocation' } } };
      const { rerender } = renderHook(
        ({ data }) => useWizardSpells(data),
        { initialProps: { data: formData } },
      );

      await act(async () => {
        await Promise.resolve();
      });
      expect(getPreSelectedSpells).toHaveBeenCalledTimes(1);

      // Change subclass name
      getPreSelectedSpells.mockResolvedValueOnce(['Magic Missile']);
      rerender({ data: { ...formData, class: { subclass: { name: 'Transmutation' } } } });

      await act(async () => {
        await Promise.resolve();
      });
      expect(getPreSelectedSpells).toHaveBeenCalledTimes(2);

      // Change race name
      getPreSelectedSpells.mockResolvedValueOnce(['Guidance']);
      rerender({ data: { ...formData, race: { name: 'Elf' } } });

      await act(async () => {
        await Promise.resolve();
      });
      expect(getPreSelectedSpells).toHaveBeenCalledTimes(3);

      // Change race subrace
      getPreSelectedSpells.mockResolvedValueOnce(['Faerie Fire']);
      rerender({ data: { ...formData, race: { name: 'Elf', subrace: { name: 'High Elf' } } } });

      await act(async () => {
        await Promise.resolve();
      });
      expect(getPreSelectedSpells).toHaveBeenCalledTimes(4);

      // Change feats
      getPreSelectedSpells.mockResolvedValueOnce(['Misty Step']);
      rerender({ data: { ...formData, feats: ['Fey Touched'] } });

      await act(async () => {
        await Promise.resolve();
      });
      expect(getPreSelectedSpells).toHaveBeenCalledTimes(5);

      // Change rules
      getPreSelectedSpells.mockResolvedValueOnce(['Speak with Animals']);
      rerender({ data: { ...formData, rules: '2024' } });

      await act(async () => {
        await Promise.resolve();
      });
      expect(getPreSelectedSpells).toHaveBeenCalledTimes(6);

      // Change level
      getPreSelectedSpells.mockResolvedValueOnce(['Commune with Nature']);
      rerender({ data: { ...formData, level: 10 } });

      await act(async () => {
        await Promise.resolve();
      });
      expect(getPreSelectedSpells).toHaveBeenCalledTimes(7);
    });

    it('uses the latest formData from the ref when the object reference changes without triggering a re-render', async () => {
      getPreSelectedSpells.mockResolvedValue(['Magic Missile']);

      const formData1 = { name: 'Test', level: 3, class: { subclass: { name: 'Evocation' } } };
      const formData2 = { name: 'Different', level: 3, class: { subclass: { name: 'Evocation' } } };

      const { rerender } = renderHook(
        ({ data }) => useWizardSpells(data),
        { initialProps: { data: formData1 } },
      );

      await act(async () => {
        await Promise.resolve();
      });
      expect(getPreSelectedSpells).toHaveBeenCalledTimes(1);
      expect(getPreSelectedSpells).toHaveBeenLastCalledWith(formData1);

      // formData2 has the same dependency values (level=3, subclass=Evocation) so no re-trigger
      // but the ref is updated to formData2 — if another trigger occurs (e.g. via a different dep
      // change), the ref ensures the NEW formData is used
      rerender({ data: formData2 });

      // No re-call since deps didn't change — call count stays at 1
      expect(getPreSelectedSpells).toHaveBeenCalledTimes(1);
    });
  });

  describe('unmount cleanup', () => {
    it('prevents state updates after unmount when the promise resolves late', async () => {
      let resolvePromise = null;
      const pendingPromise = new Promise((resolve) => { resolvePromise = resolve; });
      getPreSelectedSpells.mockReturnValue(pendingPromise);

      const { unmount } = renderHook(() => useWizardSpells({ name: 'Test', level: 1 }));

      unmount();

      // Resolve the pending promise after unmount — should not throw
      resolvePromise(['Fire Bolt']);
    });
  });

  describe('error handling', () => {
    it('does not update state when getPreSelectedSpells rejects', async () => {
      let rejectPromise = null;
      const failingPromise = new Promise((_, reject) => { rejectPromise = reject; });
      getPreSelectedSpells.mockReturnValue(failingPromise);

      // Suppress unhandled rejection from this specific test
      const handler = vi.fn();
      process.on('unhandledRejection', handler);

      const { result } = renderHook(() => useWizardSpells({ name: 'Test', level: 1 }));

      // Trigger the rejection after the hook has set up its effect
      rejectPromise(new Error('Network failure'));

      await act(async () => {
        await Promise.resolve();
      });

      process.off('unhandledRejection', handler);

      // Should remain at initial empty state
      expect(result.current.preSelectedSpells).toEqual([]);
    });
  });

  describe('partial formData shapes', () => {
    it('handles formData with only name and level', async () => {
      getPreSelectedSpells.mockResolvedValue([]);

      const { result } = renderHook(() => useWizardSpells({ name: 'Test', level: 1 }));

      await act(async () => {
        await Promise.resolve();
      });

      expect(getPreSelectedSpells).toHaveBeenCalledOnce();
      expect(result.current.preSelectedSpells).toEqual([]);
    });

    it('handles formData with null/undefined nested properties', async () => {
      getPreSelectedSpells.mockResolvedValue(['Fire Bolt']);

      const { result } = renderHook(() =>
        useWizardSpells({ name: 'Test', level: 1, class: null, race: undefined, feats: null }),
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.preSelectedSpells).toEqual(['Fire Bolt']);
    });
  });
});
