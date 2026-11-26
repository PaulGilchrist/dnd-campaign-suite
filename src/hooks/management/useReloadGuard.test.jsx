// @maintained-by-ai 2026-11-24: 2026-11-24
// Hook-contract suite for useReloadGuard (improve 2026-10-28-T backlog;
// QA backlog 2026-11-24 native-dialog sweep): the dirty-check the six .ct-*
// CRUD lanes share. Seed/clear bookkeeping drives the deep draft comparison,
// and confirmDiscardDraft only pays a toll for a modal-open draft that differs
// from the seed. The toll is NO LONGER a native window.confirm: a dirty ask
// arms the shared DeleteConfirmModal role="dialog" tier (DiscardDraftDialog)
// and resolves asynchronously — Cancel/Escape/backdrop (Keep) resolve false
// with the draft untouched, `Yes, Discard` resolves true, clean drafts resolve
// true silently with no dialog mounted. A native confirm that FIRES anywhere
// on this path is a regression — the suite forbids it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useState, act } from 'react';
import { renderHook, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useReloadGuard } from './useReloadGuard.js';

const CONFIRM = 'Reload the quest list and discard your unsaved edits?';

function forbidNativeConfirm() {
  return vi.spyOn(window, 'confirm').mockImplementation(() => {
    throw new Error('native window.confirm fired on the reload-guard path');
  });
}

// Module-scope bridge (NOT window globals — the server-first lint lane
// reserves window for the browser APIs the hook itself touches): the guard
// handle + pending verdict live OUTSIDE the render cycle, exactly like the
// hosts' refs do in the six CRUD lanes.
let guardRef = null;
let verdict = null;

// Host that mounts the hook's dialog element exactly like the six lanes do and
// exposes the pending verdict (null while open, then true/false) so
// assertions can wait on it.
function Host({ modalOpen, seed, form: initialForm }) {
  const [formData, setFormData] = useState(initialForm ?? seed);
  const guard = useReloadGuard({ modalOpen, formData, confirmMessage: CONFIRM });
  guardRef = { ...guard, setFormData };
  return <div data-testid="host">{guard.discardDialog}</div>;
}

function ask(message) {
  verdict = 'pending';
  guardRef.confirmDiscardDraft(message).then(v => { verdict = v; });
}

const setup = (props) => renderHook(
  ({ modalOpen, formData }) =>
    useReloadGuard({ modalOpen, formData, confirmMessage: CONFIRM }),
  { initialProps: { modalOpen: true, formData: null, ...props } }
);

const dirtyHost = (seed, draft) => {
  const utils = render(<Host modalOpen seed={seed} form={draft} />);
  act(() => guardRef.seedDraft(seed));
  return utils;
};

const SEED = { description: 'seed' };
const DIRTY = { description: 'typed' };
const dialog = () => screen.getByRole('dialog', { name: 'Discard Changes?' });
const discardBtn = () => screen.getByRole('button', { name: 'Yes, Discard' });
const keepBtn = () => screen.getByRole('button', { name: 'Cancel' });

describe('useReloadGuard — silent fast paths (no dialog, resolves true)', () => {
  beforeEach(() => { forbidNativeConfirm(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('clean draft equal to the seed proceeds with no dialog', async () => {
    const seed = { name: 'Q', nested: { a: 1 } };
    const { result } = setup({ formData: { ...seed } });
    act(() => result.current.seedDraft(seed));
    await expect(result.current.confirmDiscardDraft()).resolves.toBe(true);
  });

  it('reverted-to-seed draft counts as clean', async () => {
    const seed = { description: 'old' };
    const { result, rerender } = setup({ formData: seed });
    result.current.seedDraft(seed);
    rerender({ modalOpen: true, formData: { description: 'wip' } });
    rerender({ modalOpen: true, formData: { description: 'old' } });
    await expect(result.current.confirmDiscardDraft()).resolves.toBe(true);
  });

  it('modal closed, never seeded, or cleared snapshot: guard is inert', async () => {
    const { result, rerender } = setup({ formData: { notes: 'typed' } });
    await expect(result.current.confirmDiscardDraft()).resolves.toBe(true);
    result.current.seedDraft({ notes: 'seed' });
    rerender({ modalOpen: false, formData: { notes: 'typed' } });
    await expect(result.current.confirmDiscardDraft()).resolves.toBe(true);
    rerender({ modalOpen: true, formData: { notes: 'typed' } });
    result.current.clearDraft();
    await expect(result.current.confirmDiscardDraft()).resolves.toBe(true);
  });

  it('isDraftDirty reports the verdict WITHOUT arming the toll (music lane)', () => {
    render(<Host modalOpen seed={SEED} form={DIRTY} />);
    act(() => guardRef.seedDraft(SEED));
    act(() => guardRef.setFormData({ description: 'typed' }));
    expect(guardRef.isDraftDirty()).toBe(true);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('useReloadGuard — the in-app keep/discard toll', () => {
  beforeEach(() => { forbidNativeConfirm(); });
  afterEach(() => {
    vi.restoreAllMocks();
    verdict = null;
    guardRef = null;
  });

  it('dirty draft: dialog names the loss, initial focus lands on Keep (the inert default)', async () => {
    dirtyHost(SEED, DIRTY);
    act(() => ask('Discard changes to "The Lost Artifact"?'));

    await screen.findByRole('dialog', { name: 'Discard Changes?' });
    expect(dialog()).toHaveTextContent('Discard changes to "The Lost Artifact"?');
    expect(keepBtn()).toHaveFocus();
    expect(screen.queryByText(CONFIRM)).toBeNull();
  });

  it('no override rides the lane reload copy; Keep (Cancel) answers false, dialog gone, host intact', async () => {
    dirtyHost(SEED, DIRTY);
    act(() => ask());
    await screen.findByRole('dialog', { name: 'Discard Changes?' });
    expect(dialog()).toHaveTextContent(CONFIRM);

    fireEvent.click(keepBtn());
    await waitFor(() => expect(verdict).toBe(false));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('host')).toBeInTheDocument();
  });

  it('Yes, Discard answers true — the caller proceeds with the reload/close', async () => {
    dirtyHost(SEED, DIRTY);
    act(() => ask());
    await screen.findByRole('dialog', { name: 'Discard Changes?' });

    fireEvent.click(discardBtn());
    await waitFor(() => expect(verdict).toBe(true));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ESCAPE answers Keep (zero discard)', async () => {
    dirtyHost(SEED, DIRTY);
    act(() => ask());
    await screen.findByRole('dialog', { name: 'Discard Changes?' });
    fireEvent.keyDown(keepBtn(), { key: 'Escape' });
    await waitFor(() => expect(verdict).toBe(false));
  });

  it('BACKDROP click answers Keep and the host (editor stand-in) survives', async () => {
    dirtyHost(SEED, DIRTY);
    act(() => ask());
    await screen.findByRole('dialog', { name: 'Discard Changes?' });
    fireEvent.click(document.querySelector('.modal-shell-overlay'));
    await waitFor(() => expect(verdict).toBe(false));
    expect(screen.getByTestId('host')).toBeInTheDocument();
  });

  it('re-entrant ask answers the pending toll Keep (last ask wins, none stranded)', async () => {
    dirtyHost(SEED, DIRTY);
    act(() => ask('First ask?'));
    await screen.findByText('First ask?');
    guardRef.confirmDiscardDraft('Second ask?');
    await screen.findByText('Second ask?');
    // The first promise was answered false by the re-arm.
    await waitFor(() => expect(verdict).toBe(false));
    fireEvent.click(discardBtn());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('clearDraft while a toll is open answers Keep (a vanished draft never proceeds)', async () => {
    dirtyHost(SEED, DIRTY);
    act(() => ask());
    await screen.findByRole('dialog', { name: 'Discard Changes?' });
    act(() => guardRef.clearDraft());
    await waitFor(() => expect(verdict).toBe(false));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('unmounting mid-toll answers Keep (a view-switch never strands a proceed)', async () => {
    const { unmount } = dirtyHost(SEED, DIRTY);
    act(() => ask());
    await screen.findByRole('dialog', { name: 'Discard Changes?' });
    unmount();
    await waitFor(() => expect(verdict).toBe(false));
  });
});
