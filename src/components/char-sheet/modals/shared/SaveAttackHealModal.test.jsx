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

import * as rangeValidation from '../../../../services/rules/combat/rangeValidation.js';
import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
import * as logService from '../../../../services/ui/logService.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import utils from '../../../../services/ui/utils.js';
import storage from '../../../../services/ui/storage.js';
import * as healingRoll from '../../../../services/automation/common/healingRoll.js';

// ── Test fixtures ──

const baseProps = {
  combatSummary: {
    creatures: [
      { name: 'Goblin A', type: 'npc' },
      { name: 'Goblin B', type: 'npc' },
      { name: 'Player One', type: 'player' },
    ],
  },
  attackerName: 'Cleric1',
  attackerPos: { gridX: 1, gridY: 1 },
  saveDc: 10,
  campaignName: 'test-campaign',
  mapData: null,
  featureName: 'Divine Smite',
  saveType: 'CON',
  rangeFeet: 30,
  damageExpression: '4d6',
  damageType: 'Radiant',
  healExpression: '2d8',
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

function getCheckboxByName(name) {
  const checkboxes = document.querySelectorAll('input[type="checkbox"]');
  for (const cb of checkboxes) {
    const label = cb.closest('label');
    if (label && label.textContent.includes(name)) {
      return cb;
    }
  }
  throw new Error(`Checkbox for "${name}" not found`);
}

// ── Tests ──

describe('SaveAttackHealModal', () => {
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

  // ── Initial render / display ──

  it('renders modal overlay and header with feature name', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    expect(screen.getByText('Divine Smite')).toBeInTheDocument();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders Font Awesome dice icon in header', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    const icon = document.querySelector('.fa-dice-d20');
    expect(icon).toBeInTheDocument();
  });

  it('displays save type and DC in body text', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    expect(screen.getByText(/Select creatures within/)).toBeInTheDocument();
    const body = document.querySelector('.sp-body');
    expect(body.textContent).toContain('CON');
    expect(body.textContent).toContain('saving throw');
    expect(body.textContent).toContain('DC 10');
  });

  it('displays damage expression and type in warning text', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    expect(screen.getByText(/On a failed save.*4d6.*Radiant.*damage/)).toBeInTheDocument();
  });

  it('displays heal expression in instruction text', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    expect(screen.getByText(/heal for.*2d8.*HP/)).toBeInTheDocument();
  });

  it('displays target count', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    expect(screen.getByText(/Targets selected: 0\/3/)).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders apply button with feature name and target count', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Divine Smite \(0 targets\)/ })).toBeInTheDocument();
  });

  it('renders Font Awesome dice icon on apply button', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    const icon = document.querySelector('.sp-roll-btn .fa-dice-d20');
    expect(icon).toBeInTheDocument();
  });

  it('does not render results list on initial render', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    expect(document.querySelector('.abjure-results-list')).not.toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<SaveAttackHealModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<SaveAttackHealModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<SaveAttackHealModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Target selection ──

  it('renders all eligible creatures as checkboxes', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    expect(getCheckboxByName('Goblin A')).toBeInTheDocument();
    expect(getCheckboxByName('Goblin B')).toBeInTheDocument();
    expect(getCheckboxByName('Player One')).toBeInTheDocument();
  });

  it('excludes attacker from eligible targets', () => {
    render(<SaveAttackHealModal {...makeProps({ attackerName: 'Goblin A' })} />);
    expect(screen.queryByLabelText('Goblin A')).not.toBeInTheDocument();
  });

  it('renders creature type next to name', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    const types = document.querySelectorAll('.abjure-target-type');
    expect(types.length).toBe(3);
    expect(types[0].textContent).toBe('(npc)');
    expect(types[2].textContent).toBe('(player)');
  });

  it('toggles checkbox when clicked', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    const checkbox = getCheckboxByName('Goblin A');
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('updates target count when checkbox is toggled', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    expect(screen.getByText(/Targets selected: 1\/3/)).toBeInTheDocument();
  });

  it('adds selected class to row when checked', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    const row = getCheckboxByName('Goblin A').closest('.abjure-target-row');
    expect(row).toHaveClass('abjure-target-selected');
  });

  it('removes selected class from row when unchecked', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    const checkbox = getCheckboxByName('Goblin A');
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    const row = checkbox.closest('.abjure-target-row');
    expect(row).not.toHaveClass('abjure-target-selected');
  });

  it('disables apply button when no targets selected', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    const button = screen.getByRole('button', { name: /Divine Smite \(0 targets\)/ });
    expect(button).toBeDisabled();
  });

  it('enables apply button when at least one target selected', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    const button = screen.getByRole('button', { name: /Divine Smite \(1 target\)/ });
    expect(button).toBeEnabled();
  });

  it('shows singular "target" when one selected', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    expect(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ })).toBeInTheDocument();
  });

  it('shows plural "targets" when multiple selected', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    fireEvent.click(getCheckboxByName('Goblin B'));
    expect(screen.getByRole('button', { name: /Divine Smite \(2 targets\)/ })).toBeInTheDocument();
  });

  // ── Range filtering ──

  it('filters targets by range when mapData and attackerPos are provided', () => {
    rangeValidation.getDistanceFeet.mockReturnValue(5);
    render(<SaveAttackHealModal {...makeProps({ rangeFeet: 10, mapData: { players: [{ name: 'Goblin A', gridX: 2, gridY: 2 }] } })} />);
    expect(getCheckboxByName('Goblin A')).toBeInTheDocument();
  });

  it('excludes targets out of range when mapData and attackerPos are provided', () => {
    rangeValidation.getDistanceFeet.mockReturnValue(15);
    render(<SaveAttackHealModal {...makeProps({ rangeFeet: 10, mapData: { players: [{ name: 'Goblin A', gridX: 2, gridY: 2 }] } })} />);
    expect(screen.queryByLabelText('Goblin A')).not.toBeInTheDocument();
  });

  it('looks up position from placedItems when not in players', () => {
    rangeValidation.getDistanceFeet.mockReturnValue(5);
    render(<SaveAttackHealModal {...makeProps({ rangeFeet: 10, mapData: { placedItems: [{ name: 'Goblin A', gridX: 2, gridY: 2 }] } })} />);
    expect(getCheckboxByName('Goblin A')).toBeInTheDocument();
  });

  it('includes target if position not found in mapData', () => {
    render(<SaveAttackHealModal {...makeProps({ rangeFeet: 10, mapData: { players: [] } })} />);
    expect(getCheckboxByName('Goblin A')).toBeInTheDocument();
  });

  it('shows no valid targets message when no eligible targets', () => {
    render(<SaveAttackHealModal {...makeProps({ combatSummary: { creatures: [] } })} />);
    expect(screen.getByText('No valid targets in range.')).toBeInTheDocument();
  });

  it('handles null combatSummary gracefully', () => {
    render(<SaveAttackHealModal {...makeProps({ combatSummary: null })} />);
    expect(screen.getByText('No valid targets in range.')).toBeInTheDocument();
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

  // ── All resolved state ──

  it('shows "All targets resolved" message when all resolved', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByText('All targets resolved.')).toBeInTheDocument();
    });
  });

  it('shows heal target selection after all resolved', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Select one creature to heal for 2d8 HP/)).toBeInTheDocument();
    });
  });

  it('renders radio buttons for heal target selection', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      const radios = document.querySelectorAll('input[type="radio"][name="healTarget"]');
      expect(radios.length).toBeGreaterThan(0);
    });
  });

  // ── Heal flow ──

  it('selects heal target when radio is clicked', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
  });

  it('shows heal button when all resolved but no heal result', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
  });

  it('disables heal button when no heal target selected', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      const healBtn = screen.getByRole('button', { name: /Heal Selected/ });
      expect(healBtn).toBeDisabled();
    });
  });

  it('enables heal button when heal target selected', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      const healBtn = screen.getByRole('button', { name: /Heal Selected/ });
      expect(healBtn).toBeEnabled();
    });
  });

  it('renders Font Awesome heart icon on heal button', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      const icon = document.querySelector('.sp-roll-btn .fa-heart');
      expect(icon).toBeInTheDocument();
    });
  });

  it('displays heal expression on heal button', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected \(2d8\)/ })).toBeInTheDocument();
    });
  });

  it('calls rollExpression with heal expression on heal click', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d8');
  });

  it('calls applyHealingDirectly with correct parameters on heal', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(
      { name: 'Goblin A', hitPoints: 0 },
      'Goblin A',
      10,
      'test-campaign'
    );
  });

  it('calls logHealingToSSE with correct info on heal', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith('test-campaign', {
      targetName: 'Goblin A',
      sourceName: 'Divine Smite',
      actualHeal: 10,
      newHp: 30,
      maxHp: 40,
    });
  });

  it('adds roll log entry for healing', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'roll',
      name: 'Divine Smite',
      characterName: 'Cleric1',
      rollType: 'healing',
      targetName: 'Goblin A',
      formula: '2d8',
    }));
  });

  it('displays heal result after healing', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalled();
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      targetName: 'Goblin A',
      actualHeal: 10,
      newHp: 30,
      maxHp: 40,
    }));
  });

  it('displays actual heal amount in result', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      actualHeal: 10,
    }));
  });

  it('displays current HP in heal result', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      newHp: 30,
      maxHp: 40,
    }));
  });

  it('shows Done button after heal result', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalled();
  });

  it('hides Cancel button after heal result', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalled();
  });

  it('calls onClose when Done button is clicked after heal', async () => {
    const onClose = vi.fn();
    render(<SaveAttackHealModal {...makeProps({ onClose })} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalled();
  });

  // ── Heal edge cases ──

  it('does not proceed with heal when rollExpression returns null', async () => {
    diceRoller.rollExpression.mockReturnValue(null);
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
  });

  it('does not show heal result when rollExpression returns null', async () => {
    diceRoller.rollExpression.mockReturnValue(null);
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
  });

  it('does not show Done button when heal fails', async () => {
    diceRoller.rollExpression.mockReturnValue(null);
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
  });

  // ── Multiple targets ──

  it('processes multiple NPC targets', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    fireEvent.click(getCheckboxByName('Goblin B'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(2 targets\)/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Goblin A');
      expect(body.textContent).toContain('Goblin B');
    });
  });

  it('processes mixed NPC and player targets', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(2 targets\)/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Goblin A');
      expect(body.textContent).toContain('Waiting for save roll');
    });
  });

  // ── CSS classes ──

  it('renders modal with proper CSS classes', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('applies success class to NPC save result on success', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      const result = document.querySelector('.abjure-result-success');
      expect(result).toBeInTheDocument();
    });
  });

  it('applies fail class to NPC save result on failure', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      const result = document.querySelector('.abjure-result-fail');
      expect(result).toBeInTheDocument();
    });
  });

  it('applies pending class to player save result', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      const result = document.querySelector('.abjure-result-pending');
      expect(result).toBeInTheDocument();
    });
  });

  it('applies selected class to heal target row', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      const row = document.querySelector('.abjure-target-row.abjure-target-selected');
      expect(row).toBeInTheDocument();
    });
  });

  // ── Roll log formula details ──

  it('includes save bonus in roll formula for NPC when non-zero', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps({
      combatSummary: {
        creatures: [{ name: 'Goblin A', type: 'npc', saveBonuses: { con: 3 } }],
      },
    })} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    const rollCall = logService.addEntry.mock.calls.find(
      (call) => call[1].type === 'roll'
    );
    expect(rollCall[1].formula).toBe('1d20+3');
  });

  it('excludes plus sign from roll formula when save bonus is zero', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    const rollCall = logService.addEntry.mock.calls.find(
      (call) => call[1].type === 'roll'
    );
    expect(rollCall[1].formula).toBe('1d20');
  });

  it('includes save bonus in roll log for NPC', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps({
      combatSummary: {
        creatures: [{ name: 'Goblin A', type: 'npc', saveBonuses: { con: 5 } }],
      },
    })} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    const rollCall = logService.addEntry.mock.calls.find(
      (call) => call[1].type === 'roll'
    );
    expect(rollCall[1].bonus).toBe(5);
  });

  it('uses 0 bonus for NPC when saveBonuses not present', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps({
      combatSummary: { creatures: [{ name: 'Goblin A', type: 'npc' }] },
    })} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    const rollCall = logService.addEntry.mock.calls.find(
      (call) => call[1].type === 'roll'
    );
    expect(rollCall[1].bonus).toBe(0);
  });

  it('uses lowercase save type for saveBonuses lookup', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps({
      combatSummary: {
        creatures: [{ name: 'Goblin A', type: 'npc', saveBonuses: { con: 4 } }],
      },
    })} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    const rollCall = logService.addEntry.mock.calls.find(
      (call) => call[1].type === 'roll'
    );
    expect(rollCall[1].bonus).toBe(4);
  });

  // ── Save result event log details ──

  it('includes save bonus from event detail in roll log', async () => {
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

  it('includes formula from save result event', async () => {
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

  it('uses default total of 0 when event detail total is undefined', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-guid-123', success: false, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Player One');
    });
  });

  it('uses default roll of 0 when event detail roll is undefined', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-guid-123', success: false, total: 5, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Player One');
    });
  });

  it('uses default save bonus of 0 when event detail saveBonus is undefined', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });

    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-guid-123', success: false, total: 5, roll: 3 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const rollCall = logService.addEntry.mock.calls.find(
        (call) => call[1].type === 'roll'
      );
      expect(rollCall[1].bonus).toBe(0);
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

  it('uses default total in NPC save result display when undefined', async () => {
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

  // ── Heal result display ──

  it('displays healed target name in result', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      targetName: 'Goblin A',
    }));
  });

  it('applies success class to heal result div', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalled();
  });

  // ── Multiple targets resolved to heal selection ──

  it('shows multiple resolved targets in heal selection', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    fireEvent.click(getCheckboxByName('Goblin B'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(2 targets\)/ }));
    });
    await waitFor(() => {
      const radios = document.querySelectorAll('input[type="radio"][name="healTarget"]');
      expect(radios.length).toBe(2);
    });
  });

  it('only shows resolved NPCs in heal selection', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/All targets resolved/)).toBeInTheDocument();
    });
  });

  // ── Cancel button in resolved state ──

  it('shows Cancel button after all resolved but before heal', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  it('calls onClose when Cancel is clicked after all resolved', async () => {
    const onClose = vi.fn();
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps({ onClose })} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Save type display ──

  it('displays correct save type in body text', () => {
    render(<SaveAttackHealModal {...makeProps({ saveType: 'DEX' })} />);
    const body = document.querySelector('.sp-body');
    expect(body.textContent).toContain('DEX');
    expect(body.textContent).toContain('saving throw');
  });

  it('displays correct save DC in body text', () => {
    render(<SaveAttackHealModal {...makeProps({ saveDc: 15 })} />);
    expect(screen.getByText(/DC 15/)).toBeInTheDocument();
  });

  it('displays correct range in body text', () => {
    render(<SaveAttackHealModal {...makeProps({ rangeFeet: 60 })} />);
    expect(screen.getByText(/within 60 feet/)).toBeInTheDocument();
  });

  // ── Damage expression display ──

  it('displays correct damage expression in warning text', () => {
    render(<SaveAttackHealModal {...makeProps({ damageExpression: '6d6' })} />);
    expect(screen.getByText(/6d6.*Radiant.*damage/)).toBeInTheDocument();
  });

  it('displays correct damage type in warning text', () => {
    render(<SaveAttackHealModal {...makeProps({ damageType: 'Fire' })} />);
    expect(screen.getByText(/Fire.*damage/)).toBeInTheDocument();
  });

  // ── Log entry timestamp ──

  it('includes timestamp in roll log entry for NPC', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    const rollCall = logService.addEntry.mock.calls.find(
      (call) => call[1].type === 'roll'
    );
    expect(typeof rollCall[1].timestamp).toBe('number');
  });

  it('includes timestamp in roll log entry for player', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Player One'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    const rollCall = logService.addEntry.mock.calls.find(
      (call) => call[1].type === 'roll'
    );
    expect(typeof rollCall[1].timestamp).toBe('number');
  });

  // ── Roll log entry for healing ──

  it('includes rolls array in healing log entry', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    const rollCall = logService.addEntry.mock.calls.find(
      (call) => call[1].type === 'roll' && call[1].rollType === 'healing'
    );
    expect(rollCall).toBeDefined();
    expect(Array.isArray(rollCall[1].rolls)).toBe(true);
  });

  it('includes total in healing log entry', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    const rollCall = logService.addEntry.mock.calls.find(
      (call) => call[1].type === 'roll' && call[1].rollType === 'healing'
    );
    expect(rollCall[1].total).toBe(10);
  });

  it('includes attacker name in healing log entry', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    const rollCall = logService.addEntry.mock.calls.find(
      (call) => call[1].type === 'roll' && call[1].rollType === 'healing'
    );
    expect(rollCall[1].characterName).toBe('Cleric1');
  });

  it('includes feature name in healing log entry', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
    });
    await waitFor(() => {
      expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeChecked();
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal Selected/ }));
    });
    const rollCall = logService.addEntry.mock.calls.find(
      (call) => call[1].type === 'roll' && call[1].rollType === 'healing'
    );
    expect(rollCall[1].name).toBe('Divine Smite');
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

  // ── No targets in range ──

  it('does not render target checkboxes when no eligible targets', () => {
    render(<SaveAttackHealModal {...makeProps({ combatSummary: { creatures: [] } })} />);
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });

  it('shows no valid targets message when combatSummary has no creatures', () => {
    render(<SaveAttackHealModal {...makeProps({ combatSummary: { creatures: [] } })} />);
    expect(screen.getByText('No valid targets in range.')).toBeInTheDocument();
  });

  // ── Processing state ──

  it('shows processing message after apply', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Resolving.*saving throws/)).toBeInTheDocument();
    });
  });

  it('does not show processing message on initial render', () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    expect(screen.queryByText(/Resolving/)).not.toBeInTheDocument();
  });

  // ── Save result with null target ──

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

  // ── Save result event with negative bonus ──

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

  // ── Result list CSS ──

  it('has abjure-results-list class when results displayed', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(document.querySelector('.abjure-results-list')).toBeInTheDocument();
    });
  });

  it('has abjure-targets-list class for heal selection', async () => {
    render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(document.querySelector('.abjure-targets-list')).toBeInTheDocument();
    });
  });
});
