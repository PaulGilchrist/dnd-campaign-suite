// @maintained-by-ai
// SavePromptModal — active-save-prompt testid contract (backlog 2026-11-11 IE).
// The ACTIVE save prompt's `.sp-modal` carries data-testid="active-save-prompt"
// across BOTH stages (Roll Save → Done) so harnesses never play `.sp-modal`
// class-order archaeology: after a monster AoE confirm the dispatched picker
// (CreatureSelectionModal) stays mounted DISABLED ahead of the prompt in DOM
// order, and a first-match `.sp-modal` probe reads its dead confirm button.
// Face pinned here: SINGLE-ACTIVE — SavePromptModal renders only the queue
// front (prompts[0]), so the testid appears EXACTLY ONCE per document, on the
// live prompt lane only; the picker never carries it, and it matches nothing
// while no prompt is mounted (pre-mount and post-evict). Roll math, bonus
// routing, dismissal hygiene, evasion flows stay owned by the sibling lanes.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import SavePromptModal from './SavePromptModal.jsx';
import CreatureSelectionModal from '../char-sheet/modals/shared/CreatureSelectionModal.jsx';

const TESTID = '[data-testid="active-save-prompt"]';

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

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 0),
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

// Test-event feeder: SSE-shaped prompt echoes through the real handleEvent
// (bare-target arrival keys, as the legacy producers dispatch them).
vi.mock('./Subscriber.jsx', () => {
  const promptEvent = (handleEvent, testId, campaign, data) =>
    React.createElement('button', {
      'data-testid': testId,
      onClick: () => handleEvent({ key: `change-${campaign}-savePrompt-${data.targetName}`, data }),
    });
  function MockSubscriber({ handleEvent, campaignName }) {
    return React.createElement('div', { 'data-testid': 'subscriber', 'data-campaign': campaignName },
      promptEvent(handleEvent, 'trigger-stack', campaignName, {
        promptId: 'sp-stack', targetName: 'StackTarget', saveType: 'con', saveDc: 12,
        disadvantage: false, sourceName: 'Beguiling Song',
      }),
      promptEvent(handleEvent, 'trigger-queue', campaignName, {
        promptId: 'sp-queue', targetName: 'QueueTarget', saveType: 'dex', saveDc: 12,
        disadvantage: false, sourceName: 'Beguiling Song',
      }),
    );
  }
  return { default: MockSubscriber };
});

// ── Re-import mocked modules ──

import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';

// ── Helpers ──

function renderModal(props = {}) {
  return render(
    <SavePromptModal campaignName="test-campaign" characters={[]} activeMapName={null} {...props} />
  );
}

// The REAL dispatched-latch picker: CreatureSelectionModal mounted BEFORE the
// SavePromptModal root in document.body order, with its confirm disabled
// exactly as SaveAttackAoeModal leaves it after the cast dispatches
// (confirmDisabled={dispatched}, selection pre-kept → "<action> (1)").
function mountDispatchedPicker() {
  const host = document.createElement('div');
  document.body.insertBefore(host, document.body.firstChild);
  render(
    <CreatureSelectionModal
      title="Beguiling Song"
      icon="fa-bomb"
      targets={[{ name: 'StackTarget', type: 'player' }]}
      description="Choose targets"
      confirmLabel="Beguiling Song"
      confirmDisabled
      defaultSelected={['StackTarget']}
      onConfirm={vi.fn()}
      onSkip={vi.fn()}
    />,
    { container: host },
  );
  return host;
}

async function openPrompt(testId = 'trigger-stack') {
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
}

function activePromptMatches() {
  return Array.from(document.querySelectorAll(TESTID));
}

describe('SavePromptModal — active-save-prompt testid', () => {
  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  });
  afterEach(cleanupDefaults);

  // ── Criterion 3: no prompt mounted → no testid match ──

  it('matches nothing while no prompt is mounted, even beside a dispatched picker', () => {
    renderModal();
    expect(activePromptMatches()).toHaveLength(0);

    const pickerHost = mountDispatchedPicker();
    // The picker overlay exists and is a .sp-modal… but never carries the
    // active-prompt testid (no stale attr on the picker lane).
    expect(pickerHost.querySelector('.sp-modal')).not.toBeNull();
    expect(pickerHost.querySelector(TESTID)).toBeNull();
    expect(activePromptMatches()).toHaveLength(0);
  });

  // ── Criteria 1 + 2 + 5: adversarial stacked face ──

  it('exposes the live prompt via the testid while the dead picker owns the first .sp-modal match', async () => {
    const pickerHost = mountDispatchedPicker();
    renderModal();
    await openPrompt();

    // The old trap reproduced: FIRST `.sp-modal` DOM match is the disabled
    // picker, which carries no Roll Save/Done leaf.
    const firstModal = document.querySelector('.sp-modal');
    expect(pickerHost.contains(firstModal)).toBe(true);
    expect(within(firstModal).queryByRole('button', { name: /Roll Save/ })).toBeNull();
    expect(within(firstModal).queryByRole('button', { name: 'Done' })).toBeNull();
    expect(firstModal.hasAttribute('data-testid')).toBe(false);

    // The testid query IS the live prompt — exactly one match, single-active
    // face (the queue front renders; the picker never carries the attr).
    const matches = activePromptMatches();
    expect(matches).toHaveLength(1);
    const prompt = matches[0];
    expect(prompt).not.toBe(firstModal);
    expect(prompt.classList.contains('sp-modal')).toBe(true);
    expect(prompt.classList.contains('sp-overlay')).toBe(false);
    expect(within(prompt).getByText('StackTarget')).toBeInTheDocument();
    expect(within(prompt).getByRole('button', { name: 'Roll Save' })).toBeInTheDocument();
  });

  it('keeps the testid on the prompt through the post-roll Done stage and drops it on evict', async () => {
    const pickerHost = mountDispatchedPicker();
    renderModal();
    await openPrompt();

    const prompt = activePromptMatches()[0];
    fireEvent.click(within(prompt).getByRole('button', { name: 'Roll Save' }));
    await waitFor(() => {
      expect(within(prompt).getByText('SAVE SUCCESS')).toBeInTheDocument();
    });

    // Done stage: same element, same single match, live leaf reachable.
    expect(activePromptMatches()).toEqual([prompt]);
    expect(within(prompt).getByRole('button', { name: 'Done' })).toBeInTheDocument();
    // The dead picker still shadows the first `.sp-modal` match — the trap
    // never un-arms; only the testid query stays honest.
    const firstModal = document.querySelector('.sp-modal');
    expect(pickerHost.contains(firstModal)).toBe(true);
    expect(within(firstModal).queryByRole('button', { name: 'Done' })).toBeNull();

    // Drain: Done clears the queue → the testid matches nothing again, and
    // the lingering picker never gains the attribute.
    fireEvent.click(within(prompt).getByRole('button', { name: 'Done' }));
    await waitFor(() => {
      expect(activePromptMatches()).toHaveLength(0);
    });
    expect(pickerHost.querySelector(TESTID)).toBeNull();
  });

  // ── Criterion 2: queue face stays single-active ──

  it('moves the single testid match to the next queued prompt after Next Save', async () => {
    renderModal();
    await openPrompt('trigger-stack');
    fireEvent.click(screen.getByTestId('trigger-queue'));

    // Two queued prompts, one rendered face: exactly one match showing "1 of 2".
    expect(activePromptMatches()).toHaveLength(1);
    let prompt = activePromptMatches()[0];
    expect(within(prompt).getByText('(1 of 2)')).toBeInTheDocument();

    fireEvent.click(within(prompt).getByRole('button', { name: 'Roll Save' }));
    await waitFor(() => {
      expect(within(prompt).getByText('SAVE SUCCESS')).toBeInTheDocument();
    });
    const next = within(prompt).getByRole('button', { name: 'Next Save' });

    fireEvent.click(next);
    await waitFor(() => {
      prompt = activePromptMatches()[0];
      expect(within(prompt).getByText('QueueTarget')).toBeInTheDocument();
    });
    // Still single-active on the second front — and only the second prompt's
    // identity remains queryable.
    expect(activePromptMatches()).toHaveLength(1);
  });
});
