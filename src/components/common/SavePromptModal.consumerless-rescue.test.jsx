// @maintained-by-ai
// SavePromptModal — consumerless-replay rescue wiring
// (bug-shieldbash-save-resolved-after-reload-is-a-dead-end). The row-writing
// + FT-082 restore contract lives in savePrompt.js
// (.consumerless-resolution.test.js); this file pins only the MODAL seam:
//  • Done on a rolled result calls resolveConsumerlessSavePrompt BEFORE the
//    queue advances, carrying the front prompt + the rolled outcome fields
//    (the lane decides orphan-vs-live by the page-local registry/bucket);
//  • an un-rolled Dismiss calls it with a null detail (lapse-without-roll
//    copy, never a fabricated save_result);
//  • the local save-result / save-dismissed dispatches stay byte-unchanged
//    (live-chain consumers must keep receiving them).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults, createCharacter } from './SavePromptModal.test-utils.jsx';
import { resolveConsumerlessSavePrompt } from '../../services/automation/common/savePrompt.js';

// ── Mocks ──

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    getName: (name) => name || 'Unknown',
  },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
  dropPendingSavePrompt: vi.fn(),
  resolveConsumerlessSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => -1),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    set: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(null)),
  },
}));

// Replay-shaped prompt: the post-reload queue entry (per-promptId arrival key,
// Shield Bash payload fields as stored on the savePrompt-* change-data key).
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const data = {
      promptId: 'orphan-prompt-1',
      targetName: 'Goblin',
      attackerName: 'EvasiveFighter',
      saveType: 'STR',
      saveDc: 17,
      dcSuccess: false,
      sourceName: 'Shield Bash',
    };
    const trigger = (testId, event) =>
      React.createElement('button', { 'data-testid': testId, onClick: () => handleEvent(event) });
    return React.createElement('div', { 'data-testid': 'subscriber' },
      trigger('subscriber-trigger', { key: `change-${campaignName}-savePrompt-Goblin-orphan-prompt-1`, data }),
    );
  }
  return { default: MockSubscriber };
});

// ── Helpers ──

function renderModal() {
  return render(
    <SavePromptModal campaignName="test-campaign" characters={[createCharacter('Goblin')]} activeMapName={null} />
  );
}

async function openPrompt() {
  fireEvent.click(screen.getByTestId('subscriber-trigger'));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
}

beforeEach(() => {
  setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  rollD20.mockReturnValue(7); // 7 + (-1) = 6 vs DC 17 → SAVE FAILURE
});

afterEach(() => {
  cleanupDefaults();
});

describe('SavePromptModal — consumerless-replay rescue seam', () => {
  it('Done on a rolled result hands the lane the front prompt + outcome detail', async () => {
    renderModal();
    await openPrompt();

    fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
    await waitFor(() => {
      expect(screen.getByText(/SAVE FAILURE/)).toBeInTheDocument();
    });
    expect(resolveConsumerlessSavePrompt).not.toHaveBeenCalled();

    let dispatched = null;
    window.addEventListener('save-result', (e) => { dispatched = e.detail; });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(resolveConsumerlessSavePrompt).toHaveBeenCalledTimes(1);
    const [campaign, prompt, detail] = resolveConsumerlessSavePrompt.mock.calls[0];
    expect(campaign).toBe('test-campaign');
    expect(prompt).toMatchObject({
      promptId: 'orphan-prompt-1',
      targetName: 'Goblin',
      attackerName: 'EvasiveFighter',
      saveType: 'STR',
      saveDc: 17,
      sourceName: 'Shield Bash',
      result: { success: false },
    });
    expect(detail).toMatchObject({
      promptId: 'orphan-prompt-1',
      targetName: 'Goblin',
      success: false,
      roll: 7,
      total: 6,
      saveBonus: -1,
    });
    // Live-chain dispatch contract unchanged: the local save-result event still
    // rides the adjudication (the rescue lane never replaces it).
    expect(dispatched).toMatchObject({ promptId: 'orphan-prompt-1', success: false });
  });

  it('un-rolled Dismiss calls the lane with a null detail (no fabricated roll)', async () => {
    renderModal();
    await openPrompt();

    let dismissed = null;
    window.addEventListener('save-dismissed', (e) => { dismissed = e.detail; });
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(resolveConsumerlessSavePrompt).toHaveBeenCalledTimes(1);
    const [campaign, prompt, detail] = resolveConsumerlessSavePrompt.mock.calls[0];
    expect(campaign).toBe('test-campaign');
    expect(prompt).toMatchObject({ promptId: 'orphan-prompt-1', sourceName: 'Shield Bash' });
    expect(detail).toBeNull();
    expect(dismissed).toMatchObject({ promptId: 'orphan-prompt-1' });
  });
});
