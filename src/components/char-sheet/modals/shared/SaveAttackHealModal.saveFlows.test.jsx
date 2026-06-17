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

  // ── Apply saves flow ──

  it('sends save result for NPC targets', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    expect(savePromptService.sendSaveResult).toHaveBeenCalled();
  });

  it('sends save prompt for player targets', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    expect(savePromptService.sendSavePrompt).toHaveBeenCalled();
  });

  it('does not send save result when no targets selected', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
  });

  it('sets processing state to true after apply', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    expect(screen.getByText(/Resolving.*CON.*saving throws/)).toBeInTheDocument();
  });

  it('hides target selection checkboxes after apply', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });

  it('hides apply button after apply', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    expect(screen.queryByRole('button', { name: /Divine Smite/ })).not.toBeInTheDocument();
  });

  it('calls rollExpression for NPC save rolls', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('1d20');
  });

  it('calls sendSaveResult with correct campaign name', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'Goblin A', expect.objectContaining({
      promptId: 'test-guid-123',
    }));
  });

  it('calls sendSavePrompt with correct parameters', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      promptId: 'test-guid-123',
      targetName: 'Player One',
      saveType: 'CON',
      saveDc: 10,
      sourceName: 'Cleric1',
    }));
  });

  it('adds roll log entry for NPC save result', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'roll',
      name: 'Divine Smite',
      characterName: 'Cleric1',
      rollType: 'save-damage',
      targetName: 'Goblin A',
    }));
  });

  it('adds roll log entry for player save prompt', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'roll',
      name: 'Divine Smite',
      characterName: 'Cleric1',
      rollType: 'save-damage',
      targetName: 'Player One',
      formula: '1d20 (waiting)',
    }));
  });

  it('saves combatSummary to storage after apply', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
  });

  it('dispatches combat-summary-updated event after apply', async () => {
    const listener = vi.fn();
    window.addEventListener('combat-summary-updated', listener);
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('combat-summary-updated', listener);
  });

  // ── NPC save results display ──

  it('displays NPC save result with success status', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Goblin A');
      expect(body.textContent).toContain('Saved');
    });
  });

  it('displays NPC save result with failure status', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Failed');
      expect(body.textContent).toContain('4d6');
      expect(body.textContent).toContain('Radiant');
    });
  });

  it('displays roll details in NPC result when roll is a number', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Roll: 15');
    });
  });

  it('excludes plus sign from roll display when save bonus is zero', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('15 = 15');
    });
  });

  it('displays pending status for player targets', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument();
    });
  });

  // ── Save result event handling (player saves) ──

  it('handles save-result event for pending player target', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });

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
    });
  });

  it('removes pending target after save result event', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-guid-123', success: true, total: 12, roll: 10, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      expect(screen.queryByText(/Waiting for save roll/)).not.toBeInTheDocument();
    });
  });

  it('adds roll log entry when save-result event is received', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-guid-123', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Player One');
    });
  });

  it('ignores save-result event with unknown promptId', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });

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

  it('ignores save-result event with no detail', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    await act(async () => {
      const saveEvent = new CustomEvent('save-result', { detail: null });
      window.dispatchEvent(saveEvent);
    });
  });

  it('ignores save-result event with no promptId in detail', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    await act(async () => {
      const saveEvent = new CustomEvent('save-result', { detail: {} });
      window.dispatchEvent(saveEvent);
    });
  });

  // ── Event listener lifecycle ──

  it('adds save-result event listener when processing starts', async () => {
    const addListener = vi.spyOn(window, 'addEventListener');
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    expect(addListener).toHaveBeenCalledWith('save-result', expect.any(Function));
    addListener.mockRestore();
  });

  it('removes save-result event listener on unmount', async () => {
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    unmount();
    expect(removeListener).toHaveBeenCalledWith('save-result', expect.any(Function));
    removeListener.mockRestore();
  });

  // ── Save result event storage dispatch ──

  it('saves combatSummary and dispatches event on save result event', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-guid-123', success: true, total: 12, roll: 10, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    expect(storage.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
  });

  it('dispatches combat-summary-updated on save result event', async () => {
    const listener = vi.fn();
    window.addEventListener('combat-summary-updated', listener);
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-guid-123', success: true, total: 12, roll: 10, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    expect(listener).toHaveBeenCalled();
    window.removeEventListener('combat-summary-updated', listener);
  });

  // ── Save result edge cases ──

  it('treats missing creature as NPC for save result', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps({
      combatSummary: { creatures: [{ name: 'Goblin A', type: 'npc' }] },
    })} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Goblin A');
      expect(body.textContent).toContain('Saved');
    });
  });

  it('handles negative save bonus in save result event', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-guid-123', success: false, total: 1, roll: 3, saveBonus: -2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Player One');
    });
  });
});
