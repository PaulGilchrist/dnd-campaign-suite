// @maintained-by-ai
// SavePromptModal — dismiss hygiene (backlog 2026-11-03 save-prompt-queue-
// dismiss-orphan). Locks the drained-queue contract mirroring the
// concentration/death-save lanes:
//  • every queue item remembers the change-data key it ARRIVED on
//    (per-promptId `savePrompt-<Target>-<promptId>` or legacy bare
//    `savePrompt-<Target>`) and clearing targets exactly that key — never a
//    guessed sibling shape (the dead-route 404 class);
//  • dismissing an un-rolled prompt also drops its pendingSavePrompts/
//    pendingSaveListenerPrompts bucket rows via dropPendingSavePrompt;
//  • a key already DELETEd this session is never re-DELETEd while a sibling
//    still shares it (reroll→Done double-clear), and a fresh value echo
//    revives the key (re-POST is a legitimately new prompt);
//  • cleared-key (null) echoes evict exactly the matching un-adjudicated
//    prompt (per-prompt suffix) or the target's whole un-adjudicated set
//    (legacy bare-target clear) — an adjudicated head survives until Done.
// Queue copy/rendering lives in .rendering/.actions — not re-tested here.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';
import * as savePromptService from '../../services/combat/conditions/savePromptService.js';
import { dropPendingSavePrompt } from '../../services/automation/common/savePrompt.js';

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
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
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

vi.mock('../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    isCircleOfPowerActive: vi.fn(() => false),
  };
});

// Test-event feeder: buttons dispatch SSE-shaped events through the real
// handleEvent — the key SUFFIX is explicit per trigger so the queue's
// arrival-key memory (per-promptId vs bare legacy) is under test, not
// derived from the payload.
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const fire = (testId, keySuffix, data) =>
      React.createElement('button', {
        'data-testid': testId,
        onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-${keySuffix}`, data }),
      });
    const p1 = { promptId: 'p-1', targetName: 'testTarget', saveType: 'str', saveDc: 17, disadvantage: false, sourceName: 'Shield Bash' };
    const p2 = { promptId: 'p-2', targetName: 'testTarget', saveType: 'dex', saveDc: 12, disadvantage: false, sourceName: 'Second Hit' };
    const dupeA = { promptId: 'dupe-a', targetName: 'dupeTarget', saveType: 'con', saveDc: 11, disadvantage: false };
    const dupeB = { promptId: 'dupe-b', targetName: 'dupeTarget', saveType: 'con', saveDc: 11, disadvantage: false };
    return React.createElement('div', { 'data-testid': 'subscriber' },
      // Per-promptId arrivals (post-fix sheet lane): key '<Target>-<promptId>'.
      fire('trigger-p1', 'testTarget-p-1', p1),
      fire('trigger-p2', 'testTarget-p-2', p2),
      // Legacy/staged arrival: bare target key with a promptId in the body.
      fire('trigger-bare', 'testTarget', p1),
      // Producer collapse face: two prompts, one shared bare key.
      fire('trigger-dupe-a', 'dupeTarget', dupeA),
      fire('trigger-dupe-b', 'dupeTarget', dupeB),
      // Cleared-key (null) echoes.
      fire('trigger-null-p1', 'testTarget-p-1', null),
      fire('trigger-null-bare', 'testTarget', null),
    );
  }
  return { default: MockSubscriber };
});

// ── Helpers ──

function renderModal(props = {}) {
  return render(
    <SavePromptModal campaignName="test-campaign" characters={[]} activeMapName={null} {...props} />
  );
}

async function clickTestId(testId) {
  fireEvent.click(screen.getByTestId(testId));
}

async function openPrompt(testId = 'trigger-p1') {
  await clickTestId(testId);
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
}

async function dismiss() {
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
}

async function rollAndWaitForResult() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => {
    expect(screen.getByText(/Total:/i)).toBeInTheDocument();
  });
}

describe('SavePromptModal — dismiss hygiene', () => {
  beforeEach(() => setupDefaults(rollD20, computeAuraBonus, getRuntimeValue));
  afterEach(cleanupDefaults);

  it('dismisses a per-promptId prompt by its arrival key and drops its bucket rows', async () => {
    renderModal();
    await openPrompt('trigger-p1');

    await dismiss();

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
    // Exactly the key this prompt arrived on — not the bare target (which a
    // sibling owns) and not a guessed shape (the 404 class).
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledTimes(1);
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledWith('test-campaign', 'testTarget-p-1');
    // Server-truth bucket hygiene: the dismissed prompt's pendingSavePrompts
    // /pendingSaveListenerPrompts rows are swept by the dropper.
    expect(dropPendingSavePrompt).toHaveBeenCalledTimes(1);
    expect(dropPendingSavePrompt).toHaveBeenCalledWith('test-campaign', 'p-1');
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
  });

  it('mid-queue dismissal advances to the sibling and clears each arrival key exactly once', async () => {
    renderModal();
    await openPrompt('trigger-p1');
    await clickTestId('trigger-p2');
    await waitFor(() => {
      expect(screen.getByText('(1 of 2)')).toBeInTheDocument();
    });

    await dismiss();

    // Next prompt shows; only the dismissed prompt's key was cleared.
    await waitFor(() => {
      expect(screen.getByText(/Source: Second Hit/)).toBeInTheDocument();
    });
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledTimes(1);
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledWith('test-campaign', 'testTarget-p-1');
    expect(dropPendingSavePrompt).toHaveBeenCalledWith('test-campaign', 'p-1');

    await dismiss();

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
    // Drained queue: two distinct clears, no re-DELETE of a swept key,
    // every dismissed promptId dropped from the buckets.
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledTimes(2);
    expect(savePromptService.clearSavePrompt).toHaveBeenNthCalledWith(2, 'test-campaign', 'testTarget-p-2');
    expect(dropPendingSavePrompt).toHaveBeenCalledTimes(2);
    expect(dropPendingSavePrompt).toHaveBeenNthCalledWith(2, 'test-campaign', 'p-2');
  });

  it('dismisses a legacy bare-key (staged) prompt by the bare target key, never a per-prompt guess', async () => {
    renderModal();
    await openPrompt('trigger-bare');

    await dismiss();

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
    // The rig POSTed `savePrompt-<Target>`; that is the only key that exists
    // — clearing `savePrompt-<Target>-<promptId>` here would be the 404.
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledTimes(1);
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledWith('test-campaign', 'testTarget');
    expect(dropPendingSavePrompt).toHaveBeenCalledWith('test-campaign', 'p-1');
  });

  it('never re-DELETEs an already-swept key while a prompt sharing it is still queued', async () => {
    renderModal();
    await openPrompt('trigger-dupe-a');
    await clickTestId('trigger-dupe-b');
    await waitFor(() => {
      expect(screen.getByText('(1 of 2)')).toBeInTheDocument();
    });

    await dismiss();
    // Queue advanced to the sibling (indicator drops, modal still open).
    await waitFor(() => {
      expect(screen.queryByText(/\(\d+ of \d+\)/)).not.toBeInTheDocument();
    });
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledWith('test-campaign', 'dupeTarget');

    await dismiss();

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
    // Second dismissal of the SAME key is inert on the wire (key already
    // gone — a re-DELETE would honest-404) but the bucket row still drops.
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledTimes(1);
    expect(dropPendingSavePrompt).toHaveBeenCalledTimes(2);
    expect(dropPendingSavePrompt).toHaveBeenNthCalledWith(2, 'test-campaign', 'dupe-b');
  });

  it('revives a cleared key when a fresh value echo re-POSTs it (new prompt may clear again)', async () => {
    renderModal();
    await openPrompt('trigger-bare');
    await dismiss();
    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledTimes(1);

    // Producer re-arms the same bare key (e.g. a new radiance pulse) — the
    // next dismissal must clear it again, guard notwithstanding.
    await openPrompt('trigger-bare');
    await dismiss();
    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledTimes(2);
  });

  it('null echo on a per-prompt key evicts exactly that un-adjudicated prompt', async () => {
    renderModal();
    await openPrompt('trigger-p1');
    await clickTestId('trigger-p2');
    await waitFor(() => {
      expect(screen.getByText('(1 of 2)')).toBeInTheDocument();
    });

    await clickTestId('trigger-null-p1');

    // p-1 was answered elsewhere — its exact key's null echo drops only it.
    await waitFor(() => {
      expect(screen.getByText(/Source: Second Hit/)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Source: Shield Bash/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\(\d+ of \d+\)/)).not.toBeInTheDocument();
    // An echo is informational: nothing is cleared or submitted locally.
    expect(savePromptService.clearSavePrompt).not.toHaveBeenCalled();
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
  });

  it('bare-target null echo is a target-wide clear for un-adjudicated prompts but keeps the rolled head', async () => {
    renderModal();
    await openPrompt('trigger-bare');

    await rollAndWaitForResult();
    fireEvent.click(screen.getByTestId('trigger-p2'));
    await waitFor(() => {
      expect(screen.getByText('(1 of 2)')).toBeInTheDocument();
    });

    await clickTestId('trigger-null-bare');

    // Head carries a result (this client adjudicated it) — it survives until
    // Done (acting-tab asymmetry, concentration doctrine). The un-rolled
    // sibling shares the bare key and is server-gone with it → evicted.
    await waitFor(() => {
      expect(screen.getByText('SAVE FAILURE')).toBeInTheDocument();
    });
    expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    expect(screen.queryByText(/Source: Second Hit/)).not.toBeInTheDocument();

    // Done submits the head and clears the bare key it arrived on.
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'p-1',
    }));
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledWith('test-campaign', 'testTarget');
  });

  it('Done on a per-promptId prompt clears its own arrival key (Roll Save → Done leaves no key residue)', async () => {
    renderModal();
    await openPrompt('trigger-p1');
    await rollAndWaitForResult();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'p-1',
      success: false,
      roll: 15,
      total: 15,
    }));
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledTimes(1);
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledWith('test-campaign', 'testTarget-p-1');
    // The adjudicated save's own bucket row is swept even on a tab without
    // the creating listener (valuesEqual makes it a no-op when the listener
    // already wrote the removal).
    expect(dropPendingSavePrompt).toHaveBeenCalledWith('test-campaign', 'p-1');
  });
});
