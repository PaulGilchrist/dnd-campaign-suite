// @maintained-by-ai
// SavePromptModal — duplicate same-kind overlay mounts (backlog 2026-11-07 DJ).
// A single dispatch must mount exactly ONE save-prompt overlay in the
// dispatching tab. Locks the identity gate in appendSavePrompt:
//  • the same promptId delivered twice (local write echo racing the SSE echo
//    of the same savePrompt-<Target>-<promptId> key) appends ONE queue entry —
//    no '(1 of 2)' face, and one Dismiss/Roll+Done drains the queue (no
//    stranded stale twin over an already-DELETEd server key);
//  • an echo on an ARRIVAL KEY already in the queue whose payload lacks the
//    queued promptId (identity drift) is suppressed by arrival-key identity —
//    the server key holds exactly one live prompt;
//  • with promptId unknown on both sides, DIFFERENT arrival keys still stack
//    (the old `undefined === undefined` equality cross-suppressed distinct
//    legacy bare-target prompts);
//  • genuine multi-prompt behavior unchanged: two DIFFERENT promptIds for the
//    same target still stack as "Saving Throw Required (1 of 2)";
//  • a cleared-key (null) echo still evicts the un-adjudicated prompt.
// Key-shape memory of the queue (arrival suffixes, drain-to-evict, re-DELETE
// hygiene) is owned by .dismiss-hygiene — not repeated here.

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
// handleEvent with EXPLICIT arrival-key suffixes so the queue's identity gate
// is under test, not derived from the payload. Duplicate-delivery triggers
// fire the same (key, payload) pair twice in one click, mirroring the
// local-write-echo-races-SSE-echo double delivery of one server value.
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const fire = (testId, keySuffixes, datas) =>
      React.createElement('button', {
        'data-testid': testId,
        onClick: () => datas.forEach((data, i) =>
          handleEvent({ key: `change-${campaignName}-savePrompt-${keySuffixes[i]}`, data })),
      });
    const p1 = { promptId: 'dup-1', targetName: 'testTarget', saveType: 'str', saveDc: 17, disadvantage: false, sourceName: 'Shield Bash' };
    const p1Echo = { ...p1 };
    const p2 = { promptId: 'dup-2', targetName: 'testTarget', saveType: 'dex', saveDc: 12, disadvantage: false, sourceName: 'Second Hit' };
    // Identity drift: same arrival key, payload without the queued promptId
    // (e.g. a legacy/staged re-POST overwriting the same server slot).
    const p1NoPid = { targetName: 'testTarget', saveType: 'str', saveDc: 17, disadvantage: false, sourceName: 'Shield Bash' };
    // PromptId unknown on BOTH sides, distinct bare targets.
    const bareA = { targetName: 'alphaTarget', saveType: 'con', saveDc: 11, disadvantage: false };
    const bareB = { targetName: 'betaTarget', saveType: 'con', saveDc: 11, disadvantage: false };
    return React.createElement('div', { 'data-testid': 'subscriber' },
      // Same promptId delivered twice over one dispatch.
      fire('trigger-double-pid', ['testTarget-dup-1', 'testTarget-dup-1'], [p1, p1Echo]),
      // Queued keyed prompt + echo of the same arrival key without promptId.
      fire('trigger-pid-then-keyed-echo', ['testTarget-dup-1', 'testTarget-dup-1'], [p1, p1NoPid]),
      // pid-unknown on both sides, DIFFERENT bare arrival keys → must stack.
      fire('trigger-bare-alpha-beta', ['alphaTarget', 'betaTarget'], [bareA, bareB]),
      // Genuine multi-prompt: two different promptIds for one target.
      fire('trigger-p1', ['testTarget-dup-1'], [p1]),
      fire('trigger-p2', ['testTarget-dup-2'], [p2]),
      // Cleared-key (null) echo for the first prompt's arrival key.
      fire('trigger-null-p1', ['testTarget-dup-1'], [null]),
    );
  }
  return { default: MockSubscriber };
});

// ── Helpers ──

function renderModal() {
  return render(
    <SavePromptModal campaignName="test-campaign" characters={[]} activeMapName={null} />
  );
}

async function openPrompt(testId) {
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
}

describe('SavePromptModal — duplicate same-kind overlay mounts', () => {
  beforeEach(() => setupDefaults(rollD20, computeAuraBonus, getRuntimeValue));
  afterEach(cleanupDefaults);

  it('a same-promptId double delivery mounts exactly ONE overlay (no queue twin)', async () => {
    renderModal();
    await openPrompt('trigger-double-pid');

    // Both append passes ran through the real handleEvent; the queue holds
    // one entry: no stacking indicator, one overlay in the DOM.
    expect(screen.queryByText(/\(\d+ of \d+\)/)).not.toBeInTheDocument();
    expect(document.querySelectorAll('.sp-overlay')).toHaveLength(1);
  });

  it('a same-promptId double delivery drains with ONE Dismiss (stale twin cannot strand)', async () => {
    renderModal();
    await openPrompt('trigger-double-pid');

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
    // Exactly one prompt was popped for one real dispatch — a drained twin
    // would have left a second overlay open here.
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledTimes(1);
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledWith('test-campaign', 'testTarget-dup-1');
  });

  it('an echo on a queued arrival key without the promptId is suppressed (identity-drift face)', async () => {
    renderModal();
    await openPrompt('trigger-pid-then-keyed-echo');

    // The keyed prompt queued first; the pid-less echo of the SAME server key
    // (one slot, one live prompt) must not append a twin that a Roll+Done on
    // the head would strand over an already-DELETEd key.
    expect(screen.queryByText(/\(\d+ of \d+\)/)).not.toBeInTheDocument();
    expect(document.querySelectorAll('.sp-overlay')).toHaveLength(1);
  });

  it('pid-unknown prompts on DIFFERENT bare arrival keys still stack (no cross-target false dedupe)', async () => {
    renderModal();
    await openPrompt('trigger-bare-alpha-beta');

    // The old promptId-only equality (undefined === undefined) suppressed the
    // second target's prompt entirely; arrival-key identity keeps both.
    await waitFor(() => {
      expect(screen.getByText('(1 of 2)')).toBeInTheDocument();
    });
  });

  it('two DIFFERENT promptIds for the same target still stack "(1 of 2)"', async () => {
    renderModal();
    await openPrompt('trigger-p1');
    fireEvent.click(screen.getByTestId('trigger-p2'));

    await waitFor(() => {
      expect(screen.getByText('(1 of 2)')).toBeInTheDocument();
    });
    expect(document.querySelectorAll('.sp-overlay')).toHaveLength(1);
  });

  it('a cleared-key (null) echo still evicts the queued prompt', async () => {
    renderModal();
    await openPrompt('trigger-p1');

    fireEvent.click(screen.getByTestId('trigger-null-p1'));

    // Answered on another client — the null echo drops the un-adjudicated
    // prompt; nothing is cleared or submitted locally.
    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
    expect(savePromptService.clearSavePrompt).not.toHaveBeenCalled();
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
  });
});
