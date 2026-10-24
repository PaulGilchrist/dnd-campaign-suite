// @maintained-by-ai
/**
 * Level-change confirm seam for useCharacterWizard.handleEditWizardComplete:
 * an EDIT save whose level differs from the persisted level must fire a
 * native window.confirm naming the change BEFORE the save PUT; Cancel aborts
 * the save (no PUT, wizard stays open). Same-level saves keep the existing
 * fast path (no confirm) and the create path never confirms.
 * Fetch-level contract lives in useCharacterWizard.test.jsx; the donning
 * seam lives in useCharacterWizard.donning.test.jsx — not restated here.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCharacterWizard } from './useCharacterWizard.js';

const originalConfirm = window.confirm;
const originalAlert = window.alert;
const originalConsoleError = console.error;

beforeEach(() => {
  global.fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) }));
  window.confirm = vi.fn(() => false);
  window.alert = vi.fn();
  console.error = vi.fn();
});

afterEach(() => {
  window.confirm = originalConfirm;
  window.alert = originalAlert;
  console.error = originalConsoleError;
});

function createWrapper(campaignName) {
  return () => useCharacterWizard(campaignName);
}

function putCalls() {
  return global.fetch.mock.calls.filter(([, opts]) => opts?.method === 'PUT');
}

async function saveEdit(result, originalCharacter, characterData) {
  act(() => {
    result.current.setCharacterCallbacks({ setCharacters: vi.fn(), setActiveCharacter: vi.fn() });
  });
  act(() => {
    result.current.handleEditCharacter(originalCharacter);
  });
  await act(async () => {
    await result.current.handleEditWizardComplete(characterData);
  });
}

describe('useCharacterWizard - level-change confirm', () => {
  it('level 20 → 19 prompts a native confirm naming the change before the PUT fires', async () => {
    const { result } = renderHook(createWrapper('test-campaign'));
    window.confirm.mockReturnValueOnce(true);

    await saveEdit(result, { name: 'TestChar', level: 20 }, { name: 'TestChar', level: 19 });

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(window.confirm.mock.calls[0][0]).toMatch(/20/);
    expect(window.confirm.mock.calls[0][0]).toMatch(/19/);
    // Confirm must precede the save PUT.
    const confirmCall = global.fetch.mock.calls.findIndex(([url, opts]) => opts?.method === 'PUT' && url.includes('TestChar.json'));
    expect(putCalls()).toHaveLength(1);
    expect(confirmCall).toBeGreaterThanOrEqual(0);
    expect(JSON.parse(putCalls()[0][1].body).level).toBe(19);
  });

  it('Cancel on the level-change confirm aborts the save: no PUT, disk untouched, wizard stays open', async () => {
    const { result } = renderHook(createWrapper('test-campaign'));
    window.confirm.mockReturnValueOnce(false);

    await saveEdit(result, { name: 'TestChar', level: 20 }, { name: 'TestChar', level: 19 });

    expect(window.confirm).toHaveBeenCalledTimes(1);
    expect(putCalls()).toHaveLength(0);
    expect(result.current.showEditCharacterWizard).toBe(true);
  });

  it('same-level edit save does not call confirm (fast path unchanged)', async () => {
    const { result } = renderHook(createWrapper('test-campaign'));

    await saveEdit(result, { name: 'TestChar', level: 20 }, { name: 'TestChar', level: 20 });

    expect(window.confirm).not.toHaveBeenCalled();
    expect(putCalls()).toHaveLength(1);
    expect(result.current.showEditCharacterWizard).toBe(false);
  });

  it('edit with no persisted level (legacy char) or cleared level input does not confirm', async () => {
    const { result } = renderHook(createWrapper('test-campaign'));

    // No persisted level → nothing to name in a confirm.
    await saveEdit(result, { name: 'TestChar' }, { name: 'TestChar', level: 5 });
    // Cleared/invalid level input (NaN) → validation gate handles it, not confirm.
    await saveEdit(result, { name: 'TestChar', level: 20 }, { name: 'TestChar', level: NaN });

    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('create flow never confirms a level', async () => {
    const { result } = renderHook(createWrapper('test-campaign'));

    await act(async () => {
      await result.current.handleWizardComplete({ name: 'FreshChar', level: 3 });
    });

    expect(window.confirm).not.toHaveBeenCalled();
  });
});
