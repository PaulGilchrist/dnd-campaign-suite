// @maintained-by-ai 2026-10-24
/**
 * Level-change confirm seam for useCharacterWizard.handleEditWizardComplete:
 * an EDIT save whose level differs from the persisted level arms the IN-APP
 * DeleteConfirmModal toll (Item 7 native-dialog retirement — a native
 * window.confirm blocks automated drivers while open) naming the change
 * BEFORE the save PUT fires; Cancel aborts the save (no PUT, wizard stays
 * open). Same-level saves keep the fast path (no toll) and the create path
 * never confirms.
 * Fetch-level contract lives in useCharacterWizard.test.js; the donning seam
 * lives in useCharacterWizard.donning.test.js — not restated here.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCharacterWizard } from './useCharacterWizard.js';

const originalConsoleError = console.error;

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
  console.error = vi.fn();
});

afterEach(() => {
  console.error = originalConsoleError;
});

function createWrapper(campaignName) {
  return () => useCharacterWizard(campaignName);
}

function putCalls() {
  return global.fetch.mock.calls.filter(([, opts]) => opts?.method === 'PUT');
}

// Run the dialog element's action prop (the host mounts wizardDialog; in a
// hook-level test the props ARE the dialog buttons' handlers).
function answerToll(result, verdict) {
  const dialog = result.current.wizardDialog;
  expect(dialog, 'expected the level-change toll to be armed').not.toBeNull();
  act(() => {
    (verdict === 'confirm' ? dialog.props.onConfirm : dialog.props.onCancel)();
  });
}

async function saveEdit(result, originalCharacter, characterData) {
  act(() => {
    result.current.setCharacterCallbacks({ setCharacters: vi.fn(), setActiveCharacter: vi.fn() });
  });
  act(() => {
    result.current.handleEditCharacter(originalCharacter);
  });
  // Fire the save WITHOUT awaiting it: the handler parks on the toll promise
  // until the test answers it (a null toll resolves immediately).
  act(() => {
    result.current.handleEditWizardComplete(characterData);
  });
  // Let the handler's synchronous arm land in result before answering.
  await act(async () => {});
}

describe('useCharacterWizard - level-change toll (in-app)', () => {
  it('level 20 → 19 arms a named toll BEFORE the PUT fires; answering Change saves', async () => {
    const { result } = renderHook(createWrapper('test-campaign'));

    await saveEdit(result, { name: 'TestChar', level: 20 }, { name: 'TestChar', level: 19 });

    const dialog = result.current.wizardDialog;
    expect(dialog).not.toBeNull();
    expect(dialog.props.title).toBe('Change Level?');
    expect(dialog.props.children).toMatch(/20/);
    expect(dialog.props.children).toMatch(/19/);
    // The PUT has NOT fired while the toll is open.
    expect(putCalls()).toHaveLength(0);

    answerToll(result, 'confirm');
    await act(async () => {});
    expect(result.current.wizardDialog).toBeNull();
    expect(putCalls()).toHaveLength(1);
    expect(JSON.parse(putCalls()[0][1].body).level).toBe(19);
  });

  it('Cancel on the toll aborts the save: no PUT, disk untouched, wizard stays open', async () => {
    const { result } = renderHook(createWrapper('test-campaign'));

    await saveEdit(result, { name: 'TestChar', level: 20 }, { name: 'TestChar', level: 19 });
    answerToll(result, 'cancel');
    await act(async () => {});

    expect(putCalls()).toHaveLength(0);
    expect(result.current.showEditCharacterWizard).toBe(true);
  });

  it('same-level edit save does not arm the toll (fast path unchanged)', async () => {
    const { result } = renderHook(createWrapper('test-campaign'));

    await saveEdit(result, { name: 'TestChar', level: 20 }, { name: 'TestChar', level: 20 });
    await act(async () => {});

    expect(result.current.wizardDialog).toBeNull();
    expect(putCalls()).toHaveLength(1);
    expect(result.current.showEditCharacterWizard).toBe(false);
  });

  it('edit with no persisted level (legacy char) or cleared level input does not toll', async () => {
    const { result } = renderHook(createWrapper('test-campaign'));

    // No persisted level → nothing to name in a toll.
    await saveEdit(result, { name: 'TestChar' }, { name: 'TestChar', level: 5 });
    expect(result.current.wizardDialog).toBeNull();
    // Cleared/invalid level input (NaN) → validation gate handles it, not the toll.
    await saveEdit(result, { name: 'TestChar', level: 20 }, { name: 'TestChar', level: NaN });
    expect(result.current.wizardDialog).toBeNull();
  });

  it('create flow never tolls a level', async () => {
    const { result } = renderHook(createWrapper('test-campaign'));
    // Give create a clean run (POST + refresh list + one file) so the only
    // way wizardDialog can be non-null is a level toll — the point of the test.
    global.fetch = vi.fn(async (url, opts) => ({
      ok: true,
      status: 200,
      json: async () =>
        opts?.method === 'POST'
          ? { character: { name: 'FreshChar', level: 3 } }
          : { files: [] },
    }));
    act(() => {
      result.current.setCharacterCallbacks({ setCharacters: vi.fn(), setActiveCharacter: vi.fn() });
    });

    await act(async () => {
      await result.current.handleWizardComplete({ name: 'FreshChar', level: 3 });
    });

    expect(result.current.wizardDialog).toBeNull();
  });
});
