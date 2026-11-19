// @maintained-by-ai
// SavePromptModal — header honesty across faces (backlog QE 2026-11-19).
// The ARMED face (Roll Save/Dismiss) keeps the existing "Saving Throw Required"
// copy and the legitimate "(x of N)" queue counter unchanged; the RESOLVED
// face (SAVE SUCCESS/FAILURE, Next Save/Done) must drop "Required" and its
// counter must reflect only STILL-PENDING heads — "(N remaining)" with a real
// backlog, nothing at all once the answered head is the last one.
// Face plumbing (queue dedupe, submission hygiene, roll math) is owned by the
// sibling suites — not re-tested here.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults } from './SavePromptModal.test-utils.jsx';

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

// Test-event feeder: each button dispatches one SSE-shaped event through the
// real handleEvent the modal passes down (campaign-scoped keys, as production
// Subscriber delivers them).
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const promptEvent = (testId, data) =>
      React.createElement('button', {
        'data-testid': testId,
        onClick: () => handleEvent({ key: `change-${campaignName}-savePrompt-${data.targetName}`, data }),
      });
    return React.createElement('div', { 'data-testid': 'subscriber' },
      promptEvent('subscriber-trigger', {
        promptId: 'test-prompt-1', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false,
      }),
      promptEvent('subscriber-trigger-second', {
        promptId: 'test-prompt-2', targetName: 'testTarget2', saveType: 'dex', saveDc: 15, disadvantage: false,
      }),
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

async function openPrompt(testId = 'subscriber-trigger') {
  fireEvent.click(screen.getByTestId(testId));
  await waitFor(() => {
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
  });
}

async function rollHeadAndWaitForResult() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => {
    expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
  });
}

const headerText = () => document.querySelector('.sp-header').textContent.trim();

describe('SavePromptModal — resolved-face header honesty', () => {
  beforeEach(() => setupDefaults(rollD20, computeAuraBonus, getRuntimeValue));
  afterEach(cleanupDefaults);

  // ── Criterion 1: armed face unchanged ──

  it('armed single-head face keeps "Saving Throw Required" with no counter', async () => {
    renderModal();
    await openPrompt();

    expect(headerText()).toBe('Saving Throw Required');
    expect(screen.queryByText(/\(\d+ (of|remaining)\)/)).not.toBeInTheDocument();
  });

  it('armed multi-head face keeps "Saving Throw Required (1 of 2)" unchanged', async () => {
    renderModal();
    await openPrompt();
    fireEvent.click(screen.getByTestId('subscriber-trigger-second'));

    await waitFor(() => {
      expect(screen.getByText('(1 of 2)')).toBeInTheDocument();
    });
    expect(headerText()).toBe('Saving Throw Required (1 of 2)');
  });

  // ── Criterion 2: resolved face drops "Required" and the stale counter ──

  it('resolved single-head face drops "Required" and renders no counter', async () => {
    renderModal();
    await openPrompt();
    await rollHeadAndWaitForResult();

    expect(headerText()).toBe('Saving Throw');
    expect(screen.queryByText(/Required/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\(\d+ (of|remaining)\)/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });

  // ── Criterion 3: multi-head counter decrements honestly ──

  it('resolved face of a queued head reads "(1 remaining)" — never the frozen "(1 of 2)"', async () => {
    renderModal();
    await openPrompt();
    fireEvent.click(screen.getByTestId('subscriber-trigger-second'));
    await waitFor(() => {
      expect(screen.getByText('(1 of 2)')).toBeInTheDocument();
    });

    await rollHeadAndWaitForResult();

    expect(headerText()).toBe('Saving Throw (1 remaining)');
    expect(screen.queryByText(/\(\d+ of \d+\)/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next Save' })).toBeInTheDocument();
  });

  it('after Next Save the revealed head re-arms "Saving Throw Required" and its own resolve drops the copy again', async () => {
    renderModal();
    await openPrompt();
    fireEvent.click(screen.getByTestId('subscriber-trigger-second'));
    await waitFor(() => {
      expect(screen.getByText('(1 of 2)')).toBeInTheDocument();
    });
    await rollHeadAndWaitForResult();

    fireEvent.click(screen.getByRole('button', { name: 'Next Save' }));
    await waitFor(() => {
      expect(screen.getByText('testTarget2')).toBeInTheDocument();
    });
    // Head 2 is now the only pending prompt: armed copy restored, no counter.
    expect(headerText()).toBe('Saving Throw Required');

    await rollHeadAndWaitForResult();
    expect(headerText()).toBe('Saving Throw');
    expect(screen.queryByText(/\(\d+ (of|remaining)\)/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
  });
});
