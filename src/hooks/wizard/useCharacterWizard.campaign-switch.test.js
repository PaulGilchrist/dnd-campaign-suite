// @maintained-by-ai
/**
 * Campaign-switch seam contract for useCharacterWizard (2026-11-20 reattach bug):
 * the wizard open-flags live on the never-unmounted App, so leaving and
 * re-entering a campaign resurrected a stale session — and the edit wizard,
 * bound to the LIVE activeCharacter, silently re-seeded from the new campaign
 * load (first roster entry). Pins:
 *  - handleEditCharacter captures editingCharacter (the captured edit-session
 *    seed the wizard renders from — never the live active character);
 *  - closeWizards() closes BOTH lanes and drops the captured seed (the seam
 *    App.jsx handleCampaignSelect / back-to-Campaigns invoke);
 *  - handleEditWizardCancel / a successful save also drop the seed;
 *  - a FAILED save keeps the session (flag + seed) intact.
 * Fetch-level contract lives in useCharacterWizard.test.js; the level-confirm
 * seam in useCharacterWizard.level-confirm.test.js — not restated here.
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

describe('useCharacterWizard - campaign-switch seam (wizard reset + captured edit seed)', () => {
  it('handleEditCharacter captures editingCharacter; opening never touches the live active character', () => {
    const { result } = renderHook(createWrapper('test-campaign'));

    expect(result.current.editingCharacter).toBeNull();
    expect(result.current.showEditCharacterWizard).toBe(false);

    act(() => {
      result.current.handleEditCharacter({ name: 'War_Cleric' });
    });

    expect(result.current.showEditCharacterWizard).toBe(true);
    expect(result.current.editingCharacter).toMatchObject({ name: 'War_Cleric' });
  });

  it('closeWizards() closes create + edit lanes and drops the captured seed', () => {
    const { result } = renderHook(createWrapper('test-campaign'));

    act(() => {
      result.current.handleAddCharacter();
    });
    act(() => {
      result.current.handleEditCharacter({ name: 'War_Cleric' });
    });
    expect(result.current.showCharacterWizard).toBe(true);
    expect(result.current.showEditCharacterWizard).toBe(true);

    act(() => {
      result.current.closeWizards();
    });

    expect(result.current.showCharacterWizard).toBe(false);
    expect(result.current.showEditCharacterWizard).toBe(false);
    expect(result.current.editingCharacter).toBeNull();
  });

  it('handleEditWizardCancel drops the captured seed (a closed session leaves no re-seedable binding)', () => {
    const { result } = renderHook(createWrapper('test-campaign'));

    act(() => {
      result.current.handleEditCharacter({ name: 'War_Cleric' });
    });
    act(() => {
      result.current.handleEditWizardCancel();
    });

    expect(result.current.showEditCharacterWizard).toBe(false);
    expect(result.current.editingCharacter).toBeNull();
  });

  it('a successful edit save closes the session and drops the seed', async () => {
    const { result } = renderHook(createWrapper('test-campaign'));

    act(() => {
      result.current.setCharacterCallbacks({ setCharacters: vi.fn(), setActiveCharacter: vi.fn() });
    });
    act(() => {
      result.current.handleEditCharacter({ name: 'War_Cleric', level: 8 });
    });
    await act(async () => {
      await result.current.handleEditWizardComplete({ name: 'War_Cleric', level: 8 });
    });

    expect(result.current.showEditCharacterWizard).toBe(false);
    expect(result.current.editingCharacter).toBeNull();
  });

  it('a failed edit save keeps the open flag AND the captured seed (session stays bound to its target)', async () => {
    const { result } = renderHook(createWrapper('test-campaign'));
    global.fetch = vi.fn(async () => ({ ok: false, status: 404, statusText: 'Not Found' }));

    act(() => {
      result.current.setCharacterCallbacks({ setCharacters: vi.fn(), setActiveCharacter: vi.fn() });
    });
    act(() => {
      result.current.handleEditCharacter({ name: 'War_Cleric', level: 8 });
    });
    await act(async () => {
      await result.current.handleEditWizardComplete({ name: 'War_Cleric', level: 8 });
    });

    expect(result.current.showEditCharacterWizard).toBe(true);
    expect(result.current.editingCharacter).toMatchObject({ name: 'War_Cleric' });
    // Item 7: the failure now rides the in-app Save Failed dialog (never a
    // native alert); the message carries the service prefix exactly once.
    expect(result.current.wizardDialog).not.toBeNull();
    expect(result.current.wizardDialog.props.title).toBe('Save Failed');
    expect(result.current.wizardDialog.props.children).toBe('Failed to update character: Not Found');
  });

  it('re-editing a different character rebinds the seed to the new target (no stale binding)', () => {
    const { result } = renderHook(createWrapper('test-campaign'));

    act(() => {
      result.current.handleEditCharacter({ name: 'War_Cleric' });
    });
    act(() => {
      result.current.handleEditCharacter({ name: 'AasimarTest' });
    });

    expect(result.current.editingCharacter).toMatchObject({ name: 'AasimarTest' });
  });
});
