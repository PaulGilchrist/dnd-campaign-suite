// @maintained-by-ai — deterministic contract tests for useWizardSpells'
// dependency-array recomputation, ref identity, and rejection handling.
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

  it('fetches pre-selected spells with the current formData on mount', async () => {
    const formData = { name: 'Test', level: 1 };
    getPreSelectedSpells.mockResolvedValue(['Fire Bolt', 'Magic Missile', 'Shield']);

    const { result } = renderHook(() => useWizardSpells(formData));

    await act(async () => {
      await Promise.resolve();
    });

    expect(getPreSelectedSpells).toHaveBeenCalledWith(formData);
    expect(result.current.preSelectedSpells).toEqual(['Fire Bolt', 'Magic Missile', 'Shield']);
  });

  it('re-fetches when any tracked dependency changes', async () => {
    getPreSelectedSpells.mockResolvedValue([]);

    const formData = { name: 'Test', level: 1, class: { subclass: { name: 'Evocation' } } };
    const { rerender } = renderHook(
      ({ data }) => useWizardSpells(data),
      { initialProps: { data: formData } },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(getPreSelectedSpells).toHaveBeenCalledTimes(1);
    getPreSelectedSpells.mockClear();

    // Each cumulative patch changes exactly one entry of the hook's dependency array.
    const trackedDepPatches = [
      ['class.subclass.name', { class: { subclass: { name: 'Transmutation' } } }],
      ['race.name', { race: { name: 'Elf' } }],
      ['race.subrace.name', { race: { name: 'Elf', subrace: { name: 'High Elf' } } }],
      ['feats', { feats: ['Fey Touched'] }],
      ['rules', { rules: '2024' }],
      ['level', { level: 10 }],
    ];

    let latest = formData;
    for (const [dep, patch] of trackedDepPatches) {
      latest = { ...latest, ...patch };
      rerender({ data: latest });
      await act(async () => {
        await Promise.resolve();
      });
      expect(getPreSelectedSpells, `expected re-fetch on ${dep} change`).toHaveBeenCalledTimes(1);
      getPreSelectedSpells.mockClear();
    }
  });

  it('does not re-fetch when formData changes identity but tracked deps are unchanged', async () => {
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

    // Same tracked dependency values — the effect must not re-run.
    rerender({ data: formData2 });
    await act(async () => {
      await Promise.resolve();
    });
    expect(getPreSelectedSpells).toHaveBeenCalledTimes(1);
  });

  it('leaves preSelectedSpells empty when the service rejects', async () => {
    let rejectPromise = null;
    const failingPromise = new Promise((_, reject) => { rejectPromise = reject; });
    getPreSelectedSpells.mockReturnValue(failingPromise);

    // The hook fire-and-forgets its internal fetch(), so its rejection is never
    // attached downstream; register a listener so vitest doesn't report it unhandled.
    const handler = vi.fn();
    process.on('unhandledRejection', handler);

    const { result } = renderHook(() => useWizardSpells({ name: 'Test', level: 1 }));
    rejectPromise(new Error('Network failure'));

    await act(async () => {
      await Promise.resolve();
    });

    process.off('unhandledRejection', handler);

    expect(result.current.preSelectedSpells).toEqual([]);
  });

  it('handles null/undefined nested properties without crashing', async () => {
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
