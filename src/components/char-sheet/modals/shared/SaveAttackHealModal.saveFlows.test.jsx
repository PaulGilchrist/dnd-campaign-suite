// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

vi.mock('../../../../services/ui/utils.js', () => ({
  default: {
    guid: vi.fn(() => 'test-guid-123'),
  },
}));

vi.mock('../../../../services/ui/storage.js', () => ({
  default: {
    set: vi.fn(),
  },
}));

vi.mock('../../../../services/automation/common/healingRoll.js', () => ({
  applyHealingDirectly: vi.fn(() => ({ newHp: 30, maxHp: 40, actualHeal: 10 })),
  logHealingToSSE: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
import * as logService from '../../../../services/ui/logService.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import utils from '../../../../services/ui/utils.js';
import storage from '../../../../services/ui/storage.js';

// ── Test fixtures ──

import { makeProps, getCheckboxByName } from './SaveAttackHealModal.test-utils.js';

// ── Helpers ──

/**
 * Select the given target name(s) and click the apply button.
 * Returns the rendered result for further queries.
 */
async function applyFeature(getByRole, targetNames) {
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
    utils.guid.mockReturnValue('test-guid-123');
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Apply saves flow: NPC vs player routing ──

  it('sends save result for NPC targets and save prompt for player targets', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Goblin A', 'Player One']);
    expect(savePromptService.sendSaveResult).toHaveBeenCalledTimes(1);
    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
  });

  it('sends save result for all NPC targets when multiple are selected', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Goblin A', 'Goblin B']);
    expect(savePromptService.sendSaveResult).toHaveBeenCalledTimes(2);
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
    await applyFeature(getByRole, ['Player One', 'Player Two']);
    expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(2);
  });

  it('does not send any save result or prompt when no targets selected', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
    expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();
  });

  // ── Apply saves flow: processing state & UI changes ──

  it('sets processing state, hides checkboxes and apply button, shows cancel after apply', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Goblin A']);
    expect(screen.getByText(/Resolving.*CON.*saving throws/)).toBeInTheDocument();
    expect(document.querySelectorAll('input[type="checkbox"]').length).toBe(0);
    expect(screen.queryByRole('button', { name: /Divine Smite/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('shows target count in initial apply button label', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    fireEvent.click(getCheckboxByName('Goblin B'));
    expect(screen.getByRole('button', { name: /Divine Smite \(2 targets\)/ })).toBeInTheDocument();
  });

  // ── Apply saves flow: dice rolling & service calls ──

  it('calls rollExpression twice per NPC target (once for save, once for damage)', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d20' });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps({
      combatSummary: { creatures: [{ name: 'Goblin A', type: 'npc', saveBonuses: { con: 0 } }, { name: 'Goblin B', type: 'npc', saveBonuses: { con: 0 } }] },
    })} />);
    await applyFeature(getByRole, ['Goblin A', 'Goblin B']);
    // 2 save rolls + 2 damage rolls = 4 total (all fail save with roll 5 < DC 10)
    expect(diceRoller.rollExpression).toHaveBeenCalledTimes(4);
  });

  it('does not call rollExpression for player targets', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Player One']);
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
  });

  it('calls sendSaveResult with correct campaign name, target name, and promptId', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Goblin A']);
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'Goblin A', expect.objectContaining({
      promptId: 'test-guid-123',
    }));
  });

  it('calls sendSaveResult with correct target name per target', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Goblin A', 'Goblin B']);
    const calledTargets = savePromptService.sendSaveResult.mock.calls.map(c => c[1]);
    expect(calledTargets).toContain('Goblin A');
    expect(calledTargets).toContain('Goblin B');
  });

  it('calls sendSaveResult with success when roll meets DC', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [12], modifier: 0, formula: '1d20' });
    await applyFeature(getByRole, ['Goblin A']);
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith(
      'test-campaign',
      'Goblin A',
      expect.objectContaining({ success: true, total: 12 })
    );
  });

  it('calls sendSaveResult with failure when roll is below DC', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d20' });
    await applyFeature(getByRole, ['Goblin A']);
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith(
      'test-campaign',
      'Goblin A',
      expect.objectContaining({ success: false, total: 5 })
    );
  });

  it('calls sendSavePrompt with correct parameters for player targets', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Player One']);
    expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      promptId: 'test-guid-123',
      targetName: 'Player One',
      saveType: 'CON',
      saveDc: 10,
      sourceName: 'Cleric1',
    }));
  });

  // ── Apply saves flow: log entries ──

  it('adds a roll log entry for NPC save result with saveResult, saveDc, and timestamp', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d20' });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Goblin A']);
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
    await applyFeature(getByRole, ['Player One']);
    const rollCalls = logService.addEntry.mock.calls.filter(c => c[1].type === 'roll' && c[1].targetName === 'Player One');
    expect(rollCalls).toHaveLength(0);
  });

  it('adds one log entry per NPC target', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Goblin A', 'Goblin B']);
    const rollEntries = logService.addEntry.mock.calls.filter(c => c[1].type === 'roll');
    // 2 save entries + 2 damage entries = 4 (damage rolled for all targets)
    expect(rollEntries).toHaveLength(4);
  });

  // ── Apply saves flow: storage & events ──

  it('saves combatSummary to storage and dispatches event after apply', async () => {
    const listener = vi.fn();
    window.addEventListener('combat-summary-updated', listener);
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Goblin A']);
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('combat-summary-updated', listener);
  });

  // ── NPC save results display ──

  it('displays NPC save result with success or failure status and roll details', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Goblin A']);
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Goblin A');
      expect(body.textContent).toContain('takes 7');
      expect(body.textContent).toContain('rolled 15');
      expect(body.textContent).toContain('halved');
    });
  });

  it('displays NPC save failure with damage expression and type', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d20' });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Goblin A']);
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Failed');
      expect(body.textContent).toContain('5');
      expect(body.textContent).toContain('Radiant');
    });
  });

  it('displays save bonus in roll display when non-zero', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 17, rolls: [17], modifier: 0, formula: '1d20' });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps({
      combatSummary: { creatures: [{ name: 'Goblin A', type: 'npc', saveBonuses: { con: 2 } }] },
    })} />);
    await applyFeature(getByRole, ['Goblin A']);
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('takes 8');
      expect(body.textContent).toContain('rolled 17');
    });
  });

  it('displays pending status for player targets', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Player One']);
    await waitFor(() => {
      expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument();
    });
  });

  it('shows both NPC results and pending player prompts together', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 12, rolls: [12], modifier: 0, formula: '1d20' });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Goblin A', 'Player One']);
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Goblin A');
      expect(body.textContent).toContain('Saved');
      expect(body.textContent).toContain('Player One');
      expect(body.textContent).toContain('Waiting for save roll');
    });
  });

  // ── Save result event handling (player saves) ──

  it('handles save-result event for pending player target with success or failure', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Player One']);

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-guid-123', success: true, total: 12, roll: 10, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Player One');
      expect(body.textContent).toContain('Saved');
      expect(screen.queryByText(/Waiting for save roll/)).not.toBeInTheDocument();
    });
  });

  it('adds roll log entry when save-result event is received', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Player One']);

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-guid-123', success: true, total: 12, roll: 10, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Player One');
    });
    const rollCall = logService.addEntry.mock.calls.find(c => c[1].targetName === 'Player One' && c[1].saveResult === 'success');
    expect(rollCall).toBeDefined();
  });

  it('ignores save-result event with unknown promptId', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Player One']);

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'wrong-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).not.toContain('takes');
    });
  });

  // ── Save result event storage dispatch ──

  it('saves combatSummary and dispatches event on save-result event', async () => {
    const listener = vi.fn();
    window.addEventListener('combat-summary-updated', listener);
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Player One']);

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-guid-123', success: true, total: 12, roll: 10, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('combat-summary-updated', listener);
  });

  // ── Save result edge cases ──

  it('treats creature with no type as player (pending) rather than NPC', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps({
      combatSummary: { creatures: [{ name: 'Mystery Creature' }] },
    })} />);
    await applyFeature(getByRole, ['Mystery Creature']);
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Mystery Creature');
      expect(body.textContent).toContain('Waiting for save roll');
    });
  });

  it('shows all resolved targets as "All targets resolved" when all players respond', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await applyFeature(getByRole, ['Player One']);

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-guid-123', success: true, total: 12, roll: 10, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      expect(screen.getByText('All targets resolved.')).toBeInTheDocument();
    });
  });
});
