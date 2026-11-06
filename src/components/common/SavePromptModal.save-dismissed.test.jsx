// @maintained-by-ai
// SavePromptModal — producer abandonment notice (divine-spark dismiss-softlock,
// 2026-11-05). Dismissing an UN-ROLLED prompt never dispatched any outcome, so
// producers parked on a raw `save-result` window listener stranded their modals
// forever ("Rolling…" with zero buttons). The un-rolled Dismiss branch must now
// broadcast a dedicated `save-dismissed` CustomEvent carrying the promptId —
// dedicated (NOT a save-result) because the createSaveListener `.promise`
// consumers read a falsy `success` as "save failed → apply damage".
// Locks:
//  • un-rolled Dismiss dispatches EXACTLY ONE save-dismissed with
//    { promptId, targetName } and still dispatches NO save-result;
//  • a rolled prompt dismissed through submitResultAndClear resolves via
//    save-result only — no save-dismissed;
//  • mid-queue dismissal names only the dismissed head's promptId.
// Queue hygiene (arrival-key clears, bucket drops) is owned by
// .dismiss-hygiene — not re-tested here.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';
import * as savePromptService from '../../services/combat/conditions/savePromptService.js';

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
// handleEvent (same rig as .dismiss-hygiene).
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const fire = (testId, keySuffix, data) =>
      React.createElement('button', {
        'data-testid': testId,
        onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-${keySuffix}`, data }),
      });
    const p1 = { promptId: 'p-1', targetName: 'testTarget', saveType: 'str', saveDc: 17, disadvantage: false, sourceName: 'Shield Bash' };
    const p2 = { promptId: 'p-2', targetName: 'testTarget', saveType: 'dex', saveDc: 12, disadvantage: false, sourceName: 'Second Hit' };
    return React.createElement('div', { 'data-testid': 'subscriber' },
      fire('trigger-p1', 'testTarget-p-1', p1),
      fire('trigger-p2', 'testTarget-p-2', p2),
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

async function openPrompt(testId = 'trigger-p1') {
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
}

function windowEvents(name) {
  const seen = [];
  const listener = (event) => seen.push(event.detail);
  window.addEventListener(name, listener);
  return { seen, off: () => window.removeEventListener(name, listener) };
}

describe('SavePromptModal — save-dismissed broadcast', () => {
  let dismissedEvents;
  let resultEvents;

  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    dismissedEvents = windowEvents('save-dismissed');
    resultEvents = windowEvents('save-result');
  });

  afterEach(() => {
    dismissedEvents.off();
    resultEvents.off();
    cleanupDefaults();
  });

  it('un-rolled Dismiss broadcasts save-dismissed with the promptId and target, and never a save-result', async () => {
    renderModal();
    await openPrompt();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() => {
      expect(dismissedEvents.seen).toHaveLength(1);
    });
    expect(dismissedEvents.seen[0]).toEqual({ promptId: 'p-1', targetName: 'testTarget' });
    // The abandonment notice is NOT a save-result — a dispatched outcome here
    // would read as a resolved (failed) save to `.promise` consumers.
    expect(resultEvents.seen).toHaveLength(0);
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
  });

  it('mid-queue Dismiss names only the dismissed head promptId', async () => {
    renderModal();
    await openPrompt();
    fireEvent.click(screen.getByTestId('trigger-p2'));
    await waitFor(() => {
      expect(screen.getByText('(1 of 2)')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() => {
      expect(screen.getByText(/Source: Second Hit/)).toBeInTheDocument();
    });
    expect(dismissedEvents.seen).toEqual([{ promptId: 'p-1', targetName: 'testTarget' }]);

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => {
      expect(dismissedEvents.seen).toHaveLength(2);
    });
    expect(dismissedEvents.seen[1]).toEqual({ promptId: 'p-2', targetName: 'testTarget' });
  });

  it('rolled-then-Done prompt resolves via save-result only — no save-dismissed', async () => {
    renderModal();
    await openPrompt();

    fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
    await waitFor(() => {
      expect(screen.getByText(/Total:/i)).toBeInTheDocument();
    });

    // Post-roll the footer swaps to Done — an adjudicated save submits its
    // result, the abandonment notice must not accompany it.
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      expect(resultEvents.seen).toHaveLength(1);
    });
    expect(resultEvents.seen[0].promptId).toBe('p-1');
    expect(dismissedEvents.seen).toHaveLength(0);
  });
});
