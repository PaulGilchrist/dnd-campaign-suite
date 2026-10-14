import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SaveAttackHealModal from './SaveAttackHealModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 10),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 10, rolls: [10], modifier: 0, formula: '1d20' })),
}));

vi.mock('../../../../services/ui/utils.js', () => {
  let counter = 0;
  return {
    default: {
      guid: vi.fn(() => `test-guid-${++counter}`),
    },
  };
});

vi.mock('../../../../services/ui/storage.js', () => ({
  default: {
    set: vi.fn(),
    get: vi.fn(() => null),
  },
}));

vi.mock('../../../../services/automation/common/healingRoll.js', () => ({
  applyHealingDirectly: vi.fn(() => ({ newHp: 30, maxHp: 40, actualHeal: 10 })),
  logHealingToSSE: vi.fn(),
}));

vi.mock('../../../../services/encounters/combatData.js', () => ({
  setCombatSummaryCache: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
import * as logService from '../../../../services/ui/logService.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as applyDamage from '../../../../services/rules/combat/applyDamage.js';
import * as combatData from '../../../../services/encounters/combatData.js';
import storage from '../../../../services/ui/storage.js';

// ── Test fixtures ──

import { makeProps, getCheckboxByName } from './SaveAttackHealModal.test-utils.js';

// ── Helpers ──

/**
 * Select the given target name(s) and click the apply button.
 * Returns the rendered result for further queries.
 */
async function applySaves(getByRole, targetNames) {
  for (const name of targetNames) {
    fireEvent.click(getCheckboxByName(name));
  }
  await act(async () => {
    fireEvent.click(getByRole('button', { name: /Divine Smite/ }));
  });
}

// ── Tests ──

describe('SaveAttackHealModal — save flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0, formula: '1d20' });
  });

  // ── Apply saves flow: NPC vs player routing ──

  it('sends save result for NPC targets and save prompt for player targets', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Goblin A', 'Player One']);
    expect(savePromptService.sendSaveResult).toHaveBeenCalledTimes(1);
    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
  });

  it('sends save prompt for all player targets when multiple are selected', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps({
      combatSummary: {
        creatures: [
          { name: 'Player One', type: 'player' },
          { name: 'Player Two', type: 'player' },
        ],
      },
    })} />);
    await applySaves(getByRole, ['Player One', 'Player Two']);
    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(2);
  });

  // ── Apply saves flow: processing state & UI changes ──

  it('sets processing state, hides checkboxes and apply button, shows cancel after apply', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Goblin A']);
    expect(screen.getByText(/Resolving.*CON.*saving throws/)).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(0);
    expect(screen.queryByRole('button', { name: /Divine Smite/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Apply saves flow: dice rolling & service calls ──

  it('rolls dice for both save and damage per NPC target', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d20' });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps({
      combatSummary: { creatures: [{ name: 'Goblin A', type: 'npc', saveBonuses: { con: 0 } }, { name: 'Goblin B', type: 'npc', saveBonuses: { con: 0 } }] },
    })} />);
    await applySaves(getByRole, ['Goblin A', 'Goblin B']);
    expect(diceRoller.rollExpression).toHaveBeenCalledTimes(4);
  });

  it('does not call rollExpression for player targets', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Player One']);
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
  });

  it('calls sendSaveResult with correct campaign name, target name, promptId, and saveBonus', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps({
      combatSummary: { creatures: [{ name: 'Goblin A', type: 'npc', saveBonuses: { con: 3 } }] },
    })} />);
    await applySaves(getByRole, ['Goblin A']);
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith(
      'test-campaign',
      'Goblin A',
      expect.objectContaining({
        promptId: expect.stringMatching(/test-guid-\d+/),
        saveBonus: 3,
      })
    );
  });

  it('calls sendSaveResult with correct target name per target', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Goblin A', 'Goblin B']);
    const calledTargets = savePromptService.sendSaveResult.mock.calls.map(c => c[1]);
    expect(calledTargets).toContain('Goblin A');
    expect(calledTargets).toContain('Goblin B');
  });

  it.each([
    { label: 'success', roll: 12, expectedSuccess: true },
    { label: 'failure', roll: 5, expectedSuccess: false },
  ])('calls sendSaveResult with %s when roll is %s', async ({ roll, expectedSuccess }) => {
    diceRoller.rollExpression.mockReturnValue({ total: roll, rolls: [roll], modifier: 0, formula: '1d20' });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Goblin A']);
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith(
      'test-campaign',
      'Goblin A',
      expect.objectContaining({ success: expectedSuccess, total: roll })
    );
  });

  it('calls sendSavePrompt with correct parameters for player targets', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Player One']);
    expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({
        promptId: expect.stringMatching(/test-guid-\d+/),
        targetName: 'Player One',
        saveType: 'CON',
        saveDc: 10,
        sourceName: 'Cleric1',
      })
    );
  });

  // ── Apply saves flow: log entries ──

  it('adds a roll log entry for NPC save result with saveResult, saveDc, and timestamp', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d20' });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Goblin A']);
    const rollCall = logService.addEntry.mock.calls.find(c => c[1].type === 'roll' && c[1].targetName === 'Goblin A');
    expect(rollCall[1]).toEqual(expect.objectContaining({
      type: 'roll',
      name: 'Divine Smite',
      characterName: 'Cleric1',
      rollType: 'save-damage',
      targetName: 'Goblin A',
      saveDc: 10,
      saveResult: 'failure',
      timestamp: expect.any(Number),
    }));
  });

  it('does not log save entry for pending player targets', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Player One']);
    const rollCalls = logService.addEntry.mock.calls.filter(c => c[1].type === 'roll' && c[1].targetName === 'Player One');
    expect(rollCalls).toHaveLength(0);
  });

  it('adds one log entry per NPC target', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Goblin A', 'Goblin B']);
    const rollEntries = logService.addEntry.mock.calls.filter(c => c[1].type === 'roll');
    // 2 save entries + 2 damage entries = 4 (damage rolled for all targets)
    expect(rollEntries).toHaveLength(4);
  });

  // ── NPC save results display ──

  it.each([
    { label: 'success', roll: 15, expectedText: ['Saved', 'halved'] },
    { label: 'failure', roll: 5, expectedText: ['Failed'] },
  ])('displays NPC save %s with roll details', async ({ roll, expectedText }) => {
    diceRoller.rollExpression.mockReturnValue({ total: roll, rolls: [roll], modifier: 0, formula: '1d20' });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Goblin A']);
    await waitFor(() => {
      const resultsList = document.querySelector('.abjure-results-list');
      expect(resultsList.textContent).toContain('Goblin A');
      expect(resultsList.textContent).toContain(`rolled ${roll}`);
      for (const text of expectedText) {
        expect(resultsList.textContent).toContain(text);
      }
    });
  });

  it('displays save bonus in roll display when non-zero', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 17, rolls: [17], modifier: 0, formula: '1d20' });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps({
      combatSummary: { creatures: [{ name: 'Goblin A', type: 'npc', saveBonuses: { con: 2 } }] },
    })} />);
    await applySaves(getByRole, ['Goblin A']);
    await waitFor(() => {
      expect(screen.getByText(/takes 8/)).toBeInTheDocument();
      expect(screen.getByText(/rolled 17/)).toBeInTheDocument();
    });
  });

  it('displays pending status for player targets', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Player One']);
    await waitFor(() => {
      expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument();
    });
  });

  it('shows both NPC results and pending player prompts together', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [12], modifier: 0, formula: '1d20' });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Goblin A', 'Player One']);
    await waitFor(() => {
      const resultsList = document.querySelector('.abjure-results-list');
      expect(resultsList.textContent).toContain('Goblin A');
      expect(resultsList.textContent).toContain('Saved');
      expect(resultsList.textContent).toContain('Player One');
      expect(resultsList.textContent).toContain('Waiting for save roll');
    });
  });

  // ── Save result event handling (player saves) ──

  it.each([
    { label: 'success', success: true, expectedText: 'Saved', expectNoWaiting: true },
    { label: 'failure', success: false, expectedText: 'Failed', expectNoWaiting: false },
  ])('handles save-result event for pending player target with %s', async ({ success, expectedText, expectNoWaiting }) => {
    const spy = vi.spyOn(applyDamage, 'applyDamageToTarget').mockReturnValue({ finalDamage: 0 });

    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Player One']);

    const promptId = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId, success, total: success ? 12 : 5, roll: success ? 10 : 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const resultsList = document.querySelector('.abjure-results-list');
      expect(resultsList.textContent).toContain('Player One');
      expect(resultsList.textContent).toContain(expectedText);
      if (expectNoWaiting) {
        expect(screen.queryByText(/Waiting for save roll/)).not.toBeInTheDocument();
      }
    });

    const rollCall = logService.addEntry.mock.calls.find(c => c[1].targetName === 'Player One' && c[1].saveResult === (success ? 'success' : 'failure'));
    expect(rollCall).toBeDefined();
    if (!success) {
      expect(rollCall[1].rollType).toBe('save-damage');
    }

    spy.mockRestore();
  });

  it('adds roll log entry when save-result event is received for success', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Player One']);

    const promptId = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId, success: true, total: 12, roll: 10, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const resultsList = document.querySelector('.abjure-results-list');
      expect(resultsList.textContent).toContain('Player One');
    });
    const rollCall = logService.addEntry.mock.calls.find(c => c[1].targetName === 'Player One' && c[1].saveResult === 'success');
    expect(rollCall).toBeDefined();
  });

  it('ignores save-result event with unknown promptId', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Player One']);

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'wrong-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const resultsList = document.querySelector('.abjure-results-list');
      expect(resultsList.textContent).toContain('Waiting for save roll');
    });
  });

  // ── Save result event storage dispatch ──

  it('saves combatSummary and dispatches event on apply and save-result event', async () => {
    const listener = vi.fn();
    window.addEventListener('combat-summary-updated', listener);
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Goblin A']);
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
    expect(combatData.setCombatSummaryCache).toHaveBeenCalled();
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('combat-summary-updated', listener);

    // Also verify storage/event on save-result event
    vi.clearAllMocks();
    const { getByRole: getByRole2 } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole2, ['Player One']);

    const promptId = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId, success: true, total: 12, roll: 10, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
    window.removeEventListener('combat-summary-updated', listener);
  });

  // ── Save result edge cases ──

  it('treats creature with no type as player (pending) rather than NPC', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps({
      combatSummary: { creatures: [{ name: 'Mystery Creature' }] },
    })} />);
    await applySaves(getByRole, ['Mystery Creature']);
    await waitFor(() => {
      expect(screen.getByText(/Mystery Creature/)).toBeInTheDocument();
      expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument();
    });
  });

  it('shows pending status when not all player targets have responded', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps({
      combatSummary: {
        creatures: [
          { name: 'Player One', type: 'player' },
          { name: 'Player Two', type: 'player' },
        ],
      },
    })} />);
    await applySaves(getByRole, ['Player One', 'Player Two']);

    const promptId1 = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: promptId1, success: true, total: 12, roll: 10, saveBonus: 2 },
      }));
    });

    // One target responded, the other is still pending
    await waitFor(() => {
      expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument();
    });
  });

  it('shows all resolved message when a single player target responds', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applySaves(getByRole, ['Player One']);

    const promptId = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId, success: true, total: 12, roll: 10, saveBonus: 2 },
      }));
    });

    await waitFor(() => {
      expect(screen.getByText('All targets resolved.')).toBeInTheDocument();
    });
  });
});
