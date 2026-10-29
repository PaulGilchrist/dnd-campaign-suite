// @maintained-by-ai: 2026-10-28
// Hook-contract suite for useReloadGuard (improve 2026-10-28-T backlog): the
// dirty-check the five .ct-* CRUD lanes share. Seed/clear bookkeeping drives
// the deep draft comparison, and confirmDiscardDraft only pays the NAMED
// confirm toll for a modal-open draft that differs from the seed — Cancel
// returns false with zero side effects, clean drafts return true silently.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReloadGuard } from './useReloadGuard.js';

const CONFIRM = 'Reload the quest list and discard your unsaved edits?';

// Props flow through renderHook's rerender so modalOpen/formData changes
// re-run the hook body exactly like the consumer components re-render.
const setup = (initialProps) =>
  renderHook(
    ({ modalOpen, formData }) =>
      useReloadGuard({ modalOpen, formData, confirmMessage: CONFIRM }),
    { initialProps: { modalOpen: true, formData: null, ...initialProps } }
  );

describe('useReloadGuard', () => {
  let confirmSpy;
  beforeEach(() => {
    confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dirty draft (deep-different from the seed): NAMED confirm; Cancel returns false', () => {
    const seed = { name: 'The Lost Artifact', notes: ['a'] };
    const { result, rerender } = setup({ formData: seed });
    act(() => result.current.seedDraft(seed));

    // Nested change on the live draft (form state) vs the seed clone.
    rerender({ modalOpen: true, formData: { ...seed, notes: ['a', 'unsaved'] } });

    expect(result.current.confirmDiscardDraft()).toBe(false);
    expect(confirmSpy).toHaveBeenCalledWith(CONFIRM);
  });

  it('dirty draft + Accept: confirm true lets the reload proceed', () => {
    confirmSpy.mockReturnValue(true);
    const seed = { description: 'seed' };
    const { result, rerender } = setup({ formData: seed });
    act(() => result.current.seedDraft(seed));
    rerender({ modalOpen: true, formData: { description: 'typed' } });

    expect(result.current.confirmDiscardDraft()).toBe(true);
    expect(confirmSpy).toHaveBeenCalledWith(CONFIRM);
  });

  it('clean draft equal to the seed: no confirm, proceeds', () => {
    const seed = { name: 'Q', nested: { a: 1 } };
    const { result } = setup({ formData: { ...seed } });
    act(() => result.current.seedDraft(seed));

    expect(result.current.confirmDiscardDraft()).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('reverted-to-seed draft counts as clean — no confirm', () => {
    const seed = { description: 'old' };
    const { result, rerender } = setup({ formData: seed });
    act(() => result.current.seedDraft(seed));
    rerender({ modalOpen: true, formData: { description: 'wip' } });
    rerender({ modalOpen: true, formData: { description: 'old' } });

    expect(result.current.confirmDiscardDraft()).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it('modal closed, unsaved seed, or missing snapshot: guard is inert (no confirm)', () => {
    const { result, rerender } = setup({ formData: { notes: 'typed' } });
    // Never seeded → nothing to compare against.
    expect(result.current.confirmDiscardDraft()).toBe(true);
    act(() => result.current.seedDraft({ notes: 'seed' }));
    // Editor closed → the reload cannot discard anything.
    rerender({ modalOpen: false, formData: { notes: 'typed' } });
    expect(result.current.confirmDiscardDraft()).toBe(true);
    // Clearing the snapshot (close seam) also disarms the guard.
    rerender({ modalOpen: true, formData: { notes: 'typed' } });
    act(() => result.current.clearDraft());
    expect(result.current.confirmDiscardDraft()).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  // Improve 2026-10-29-V backlog: the ×/Cancel close path reuses this same
  // dirty-check via an optional message override (wizard-precedent named
  // copy) — no argument keeps the reload message, so every pre-existing
  // reload call-site is byte-identical in behavior.
  it('message override: dirty draft confirms with the override copy; clean stays silent', () => {
    const seed = { name: 'The Lost Artifact' };
    const { result, rerender } = setup({ formData: seed });
    act(() => result.current.seedDraft(seed));

    // Dirty + override → the NAMED close copy is what the user sees.
    rerender({ modalOpen: true, formData: { name: 'Renamed Quest' } });
    expect(result.current.confirmDiscardDraft('Discard changes to "Renamed Quest"?')).toBe(false);
    expect(confirmSpy).toHaveBeenCalledWith('Discard changes to "Renamed Quest"?');
    expect(confirmSpy).not.toHaveBeenCalledWith(CONFIRM);

    // Same dirty draft without an override → reload copy (legacy signature).
    result.current.confirmDiscardDraft();
    expect(confirmSpy).toHaveBeenCalledWith(CONFIRM);
    expect(confirmSpy).toHaveBeenCalledTimes(2);

    // Clean draft pays no toll, override or not.
    rerender({ modalOpen: true, formData: seed });
    expect(result.current.confirmDiscardDraft('Discard changes to "The Lost Artifact"?')).toBe(true);
    result.current.confirmDiscardDraft();
    expect(confirmSpy).toHaveBeenCalledTimes(2);
  });
});
