// @maintained-by-ai
// @improved-by-ai
// SavePromptModal — actions
// Behavioral contract for save prompt interactions: queueing (dedupe, campaign
// scoping, SSE clearing), result submission (posted only on Done/Dismiss-after-
// roll, never on roll alone), the local `save-result` dispatch consumers read,
// queue advancement, and the Leading Evasion chooser's gating of Apply.
//
// Rendering/copy lives in SavePromptModal.rendering.test.jsx, roll math in
// .rolling/.bonuses/.rerolls, CLA-211 stamping/skip in .cla211-leading-evasion,
// lastAttack persistence in .special-handlers — not re-tested here.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults, createCharacter } from './SavePromptModal.test-utils.jsx';
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

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
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
    const trigger = (testId, event) =>
      React.createElement('button', { 'data-testid': testId, onClick: () => handleEvent(event) });
    const promptEvent = (testId, campaign, data) =>
      trigger(testId, { key: `change-${campaign}-savePrompt-${data.targetName}`, data });
    const clearedEvent = (testId, campaign, promptId) =>
      trigger(testId, { key: `change-${campaign}-savePromptCleared-testTarget`, data: { promptId } });
    return React.createElement('div', { 'data-testid': 'subscriber' },
      promptEvent('subscriber-trigger', campaignName, {
        promptId: 'test-prompt-1', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false,
      }),
      promptEvent('subscriber-trigger-second', campaignName, {
        promptId: 'test-prompt-2', targetName: 'testTarget2', saveType: 'dex', saveDc: 15, disadvantage: true, dcSuccess: 'half',
      }),
      promptEvent('subscriber-trigger-other-campaign', 'other-campaign', {
        promptId: 'test-prompt-foreign', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false,
      }),
      clearedEvent('subscriber-trigger-cleared', campaignName, 'test-prompt-1'),
      clearedEvent('subscriber-trigger-cleared-other', campaignName, 'a-different-prompt'),
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

async function rollAndWaitForResult() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => {
    expect(screen.getByText(/Total:/i)).toBeInTheDocument();
  });
}

describe('SavePromptModal — actions', () => {
  // Capture every local save-result dispatch; consumers (damage appliers) read detail.
  let saveResults = [];
  const collectSaveResult = (event) => saveResults.push(event.detail);

  beforeEach(() => {
    saveResults = [];
    window.addEventListener('save-result', collectSaveResult);
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  });

  afterEach(() => {
    window.removeEventListener('save-result', collectSaveResult);
    cleanupDefaults();
  });

  // ── Queueing & dismissal ──

  it('dismisses an unrolled prompt without submitting a fabricated result', async () => {
    renderModal();
    await openPrompt();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledWith('test-campaign', 'testTarget');
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
  });

  it('ignores save-prompt events from other campaigns', async () => {
    renderModal();

    fireEvent.click(screen.getByTestId('subscriber-trigger-other-campaign'));

    expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();

    // Control: an own-campaign event still opens the modal, so the rejection
    // above is campaign scoping, not a broken subscriber wiring.
    await openPrompt();
    expect(screen.getByText('testTarget')).toBeInTheDocument();
  });

  it('does not add duplicate prompts with the same promptId', async () => {
    renderModal();
    await openPrompt();

    fireEvent.click(screen.getByTestId('subscriber-trigger'));

    // No queue indicator, and submitting the first prompt closes the modal
    // entirely — proving the queue held exactly one prompt.
    expect(screen.queryByText(/\(\d+ of \d+\)/)).not.toBeInTheDocument();

    await rollAndWaitForResult();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
    expect(savePromptService.sendSaveResult).toHaveBeenCalledTimes(1);
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-1',
    }));
  });

  it('removes prompt when savePromptCleared event is received', async () => {
    renderModal();
    await openPrompt();

    fireEvent.click(screen.getByTestId('subscriber-trigger-cleared'));

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
  });

  it('keeps the prompt when savePromptCleared names a different promptId', async () => {
    renderModal();
    await openPrompt();

    fireEvent.click(screen.getByTestId('subscriber-trigger-cleared-other'));

    // handleClearedEvent filters by promptId — a foreign clear must not
    // silently drop the pending adjudication.
    expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    expect(screen.getByText('testTarget')).toBeInTheDocument();
  });

  // ── Result submission ──

  it('submits the rolled result and clears the prompt when Done is clicked', async () => {
    renderModal();
    await openPrompt();
    await rollAndWaitForResult();

    expect(screen.getByText(/SAVE SUCCESS/)).toBeInTheDocument();
    // Rolling swaps Dismiss for the single submit button.
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      expect(screen.queryByText(/must make a/i)).not.toBeInTheDocument();
    });
    // rollD20 → 15, no bonus sources, DC 12.
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-1',
      roll: 15,
      total: 15,
      success: true,
    }));
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledWith('test-campaign', 'testTarget');
  });

  it('holds the result locally after rolling and submits it only on Done', async () => {
    renderModal({ characters: ['testTarget', createCharacter('otherChar')] });
    await openPrompt();

    await rollAndWaitForResult();
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-1',
      roll: 15,
      success: true,
    }));
  });

  it('dispatches save-result custom event with full adjudication detail', async () => {
    renderModal();
    await openPrompt();
    await rollAndWaitForResult();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      expect(saveResults).toHaveLength(1);
    });
    expect(saveResults[0]).toEqual(expect.objectContaining({
      promptId: 'test-prompt-1',
      targetName: 'testTarget',
      saveType: 'con',
      saveDc: 12,
      success: true,
      roll: 15,
      total: 15,
      mode: 'normal',
      evasionActive: false,
    }));
    expect(saveResults[0].rawRolls).toEqual([15, 15]);
  });

  // ── Queue advancement ──

  it('submits the first result and advances to the second prompt on Next Save', async () => {
    renderModal();
    await openPrompt();

    fireEvent.click(screen.getByTestId('subscriber-trigger-second'));
    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    });

    await rollAndWaitForResult();

    fireEvent.click(screen.getByRole('button', { name: 'Next Save' }));

    await waitFor(() => {
      expect(screen.getByText('testTarget2')).toBeInTheDocument();
      expect(screen.getByText('DEX')).toBeInTheDocument();
      expect(screen.getByText('DC 15')).toBeInTheDocument();
    });
    // Advancing must not skip submission of the finished prompt, and must not
    // submit the freshly revealed one.
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expect.objectContaining({
      promptId: 'test-prompt-1',
    }));
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalledWith('test-campaign', 'testTarget2', expect.anything());
    expect(screen.getByRole('button', { name: 'Roll Save' })).toBeInTheDocument();
  });

  // ── Leading Evasion chooser ──

  it('presents the Leading Evasion chooser with Apply disabled until an ally is selected', async () => {
    // A shareable DEX evasion held by a non-target triggers the chooser for
    // the second prompt (DEX save, dcSuccess 'half').
    const paladin = createCharacter('Paladin', undefined, [{ saveType: 'DEX', shareable: true, shareRange: 10 }]);
    renderModal({ characters: ['testTarget2', paladin] });

    fireEvent.click(screen.getByTestId('subscriber-trigger-second'));
    await waitFor(() => {
      expect(screen.getByText(/Leading Evasion — Choose Allies/)).toBeInTheDocument();
    });

    // The creature making the save is offered as an (initially unticked) row
    // in the chooser list (scoped there — the name also shows in the prompt).
    const row = document.querySelector('.sp-overlay--evasion .secondary-target-row');
    expect(row).toHaveTextContent('testTarget2');
    expect(within(row).getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Apply Evasion \(0\)/ })).toBeDisabled();
  });
});
