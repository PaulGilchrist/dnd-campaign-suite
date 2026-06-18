// @improved-by-ai
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
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
import * as logService from '../../../../services/ui/logService.js';
import * as storage from '../../../../services/ui/storage.js';
import * as healingRoll from '../../../../services/automation/common/healingRoll.js';
import utils from '../../../../services/ui/utils.js';

// ── Test fixtures ──

import { makeProps, getCheckboxByName } from './SaveAttackHealModal.test-utils.js';

// ── Helpers ──

function getApplyButton() {
  return screen.getByRole('button', { name: /Divine Smite/ });
}

function getHealButton() {
  return screen.getByRole('button', { name: /Heal Selected/ });
}

// ── Tests ──

describe('SaveAttackHealModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0, formula: '1d20' });
    utils.guid.mockReturnValue('test-guid-123');
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders the overlay and modal with header containing feature name and dice icon', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      expect(screen.getByText('Divine Smite')).toBeInTheDocument();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.fa-dice-d20')).toBeInTheDocument();
    });

    it('renders proper CSS structure classes', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
      expect(document.querySelector('.sp-header')).toBeInTheDocument();
      expect(document.querySelector('.sp-body')).toBeInTheDocument();
      expect(document.querySelector('.sp-actions')).toBeInTheDocument();
    });

    it('displays save type and DC in the body instructions', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('CON');
      expect(body.textContent).toContain('saving throw');
      expect(body.textContent).toContain('DC 10');
    });

    it('displays the range in the instructions', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      expect(screen.getByText(/Select creatures within 30 feet/)).toBeInTheDocument();
    });

    it('displays damage expression and type in the warning text', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      expect(screen.getByText(/On a failed save.*4d6.*Radiant.*damage/)).toBeInTheDocument();
    });

    it('displays heal expression in the instruction text', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      expect(screen.getByText(/heal for.*2d8.*HP/)).toBeInTheDocument();
    });

    it('displays target count with initial zero selection', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      expect(screen.getByText(/Targets selected: 0\/3/)).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders apply button with feature name and zero target count', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      expect(getApplyButton()).toHaveTextContent('Divine Smite (0 targets)');
    });

    it('disables the apply button when no targets are selected', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      expect(getApplyButton()).toBeDisabled();
    });

    it('does not display the results list on initial render', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      expect(document.querySelector('.abjure-results-list')).not.toBeInTheDocument();
    });

    it('does not display the processing message on initial render', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      expect(screen.queryByText(/Resolving/)).not.toBeInTheDocument();
    });
  });

  // ── Close behavior ──

  describe('close behavior', () => {
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

    it('calls onClose when Cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<SaveAttackHealModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ── Target selection ──

  describe('target selection', () => {
    it('renders all eligible creatures as checkboxes', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      expect(getCheckboxByName('Goblin A')).toBeInTheDocument();
      expect(getCheckboxByName('Goblin B')).toBeInTheDocument();
      expect(getCheckboxByName('Player One')).toBeInTheDocument();
    });

    it('excludes the attacker from eligible targets', () => {
      render(<SaveAttackHealModal {...makeProps({ attackerName: 'Goblin A' })} />);
      expect(screen.queryByLabelText('Goblin A')).not.toBeInTheDocument();
    });

    it('renders creature type next to each name', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      const types = document.querySelectorAll('.abjure-target-type');
      expect(types.length).toBe(3);
      expect(types[0].textContent).toBe('(npc)');
      expect(types[2].textContent).toBe('(player)');
    });

    it('toggles a checkbox on and off', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      const checkbox = getCheckboxByName('Goblin A');
      expect(checkbox.checked).toBe(false);
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it('adds selected class to the row when checked', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      const row = getCheckboxByName('Goblin A').closest('.abjure-target-row');
      expect(row).toHaveClass('abjure-target-selected');
    });

    it('removes selected class from the row when unchecked', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      const checkbox = getCheckboxByName('Goblin A');
      fireEvent.click(checkbox);
      fireEvent.click(checkbox);
      const row = checkbox.closest('.abjure-target-row');
      expect(row).not.toHaveClass('abjure-target-selected');
    });

    it('updates target count when a checkbox is toggled', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      expect(screen.getByText(/Targets selected: 1\/3/)).toBeInTheDocument();
    });

    it('enables the apply button when at least one target is selected', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      expect(getApplyButton()).toBeEnabled();
    });

    it('shows singular "target" when exactly one is selected', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      expect(getApplyButton()).toHaveTextContent('Divine Smite (1 target)');
    });

    it('shows plural "targets" when multiple are selected', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      fireEvent.click(getCheckboxByName('Goblin B'));
      expect(getApplyButton()).toHaveTextContent('Divine Smite (2 targets)');
    });
  });

  // ── Range filtering ──

  describe('range filtering', () => {
    const baseProps = makeProps({ rangeFeet: 10, mapData: { players: [], placedItems: [] } });

    it('includes targets within range', () => {
      rangeValidation.getDistanceFeet.mockReturnValue(5);
      render(<SaveAttackHealModal {...baseProps} />);
      expect(getCheckboxByName('Goblin A')).toBeInTheDocument();
    });

    it('excludes targets beyond range', () => {
      rangeValidation.getDistanceFeet.mockReturnValue(15);
      render(<SaveAttackHealModal {...baseProps} />);
      expect(screen.queryByLabelText('Goblin A')).not.toBeInTheDocument();
    });

    it('looks up position from placedItems when not in players', () => {
      rangeValidation.getDistanceFeet.mockReturnValue(5);
      render(<SaveAttackHealModal {...makeProps({ rangeFeet: 10, mapData: { players: [], placedItems: [{ name: 'Goblin A', gridX: 2, gridY: 2 }] } })} />);
      expect(getCheckboxByName('Goblin A')).toBeInTheDocument();
    });

    it('includes a target when its position is not found in mapData', () => {
      render(<SaveAttackHealModal {...makeProps({ rangeFeet: 10, mapData: { players: [] } })} />);
      expect(getCheckboxByName('Goblin A')).toBeInTheDocument();
    });

    it('includes a target when mapData is missing', () => {
      render(<SaveAttackHealModal {...makeProps({ mapData: null })} />);
      expect(getCheckboxByName('Goblin A')).toBeInTheDocument();
    });
  });

  // ── No eligible targets ──

  describe('no eligible targets', () => {
    it('shows the no valid targets message when combatSummary has no creatures', () => {
      render(<SaveAttackHealModal {...makeProps({ combatSummary: { creatures: [] } })} />);
      expect(screen.getByText('No valid targets in range.')).toBeInTheDocument();
    });

    it('handles null combatSummary gracefully', () => {
      render(<SaveAttackHealModal {...makeProps({ combatSummary: null })} />);
      expect(screen.getByText('No valid targets in range.')).toBeInTheDocument();
    });

    it('does not render target checkboxes when there are no eligible targets', () => {
      render(<SaveAttackHealModal {...makeProps({ combatSummary: { creatures: [] } })} />);
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(0);
    });

    it('does not render the targets list container when there are no eligible targets', () => {
      render(<SaveAttackHealModal {...makeProps({ combatSummary: { creatures: [] } })} />);
      const list = document.querySelector('.abjure-targets-list');
      expect(list).toBeInTheDocument();
      expect(list.textContent).toContain('No valid targets in range.');
    });
  });

  // ── Apply: NPC saves (automatic resolution) ──

  describe('apply — NPC saves', () => {
    it('rolls dice for NPC targets and shows processing message', async () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(screen.getByText(/Resolving.*saving throws/)).toBeInTheDocument();
      });
    });

    it('calls rollExpression once per NPC target', async () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      fireEvent.click(getCheckboxByName('Goblin B'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      expect(diceRoller.rollExpression).toHaveBeenCalledTimes(2);
    });

    it('calls sendSaveResult for each NPC target', async () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      expect(savePromptService.sendSaveResult).toHaveBeenCalledTimes(1);
      const callArgs = savePromptService.sendSaveResult.mock.calls[0];
      expect(callArgs).toHaveLength(3);
      expect(callArgs[0]).toBe('test-campaign');
      expect(callArgs[1]).toBe('Goblin A');
      expect(callArgs[2].promptId).toBe('test-guid-123');
    });

    it('calls addEntry for each NPC save result', async () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      expect(logService.addEntry).toHaveBeenCalledTimes(1);
      expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'roll',
        name: 'Divine Smite',
        characterName: 'Cleric1',
        rollType: 'save-damage',
        targetName: 'Goblin A',
      }));
    });

    it('calls storage.set with the combat summary', async () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      expect(storage.default.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
    });

    it('renders NPC result with success class when roll meets DC', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        const result = document.querySelector('.abjure-result-success');
        expect(result).toBeInTheDocument();
        expect(result.textContent).toContain('Goblin A');
        expect(result.textContent).toContain('Saved');
      });
    });

    it('renders NPC result with fail class when roll is below DC', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        const result = document.querySelector('.abjure-result-fail');
        expect(result).toBeInTheDocument();
        expect(result.textContent).toContain('Goblin A');
        expect(result.textContent).toContain('Failed');
      });
    });

    it('displays the roll value and bonus in the result text', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        const result = document.querySelector('.abjure-result');
        expect(result.textContent).toContain('Roll: 15');
      });
    });

    it('displays the results list container after applying', async () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(document.querySelector('.abjure-results-list')).toBeInTheDocument();
      });
    });

    it('shows pending status for player targets while waiting for save', async () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Player One'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        const pending = document.querySelector('.abjure-result-pending');
        expect(pending).toBeInTheDocument();
        expect(pending.textContent).toContain('Player One');
        expect(pending.textContent).toContain('Waiting for save roll');
      });
    });

    it('calls sendSavePrompt for player targets', async () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Player One'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      expect(savePromptService.sendSavePrompt).toHaveBeenCalledTimes(1);
      expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        promptId: 'test-guid-123',
        targetName: 'Player One',
        saveType: 'CON',
        saveDc: 10,
        sourceName: 'Cleric1',
      }));
    });
  });

  // ── Apply: mixed NPC and player targets ──

  describe('apply — mixed targets', () => {
    it('resolves NPC saves automatically while keeping player prompts pending', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      fireEvent.click(getCheckboxByName('Player One'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        const success = document.querySelector('.abjure-result-success');
        const pending = document.querySelector('.abjure-result-pending');
        expect(success).toBeInTheDocument();
        expect(pending).toBeInTheDocument();
        expect(success.textContent).toContain('Goblin A');
        expect(pending.textContent).toContain('Player One');
      });
    });

    it('calls storage.set even when some targets are players', async () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      fireEvent.click(getCheckboxByName('Player One'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      expect(storage.default.set).toHaveBeenCalledWith('combatSummary', expect.any(Object), 'test-campaign');
    });
  });

  // ── Save result event (player save response) ──

  describe('save-result event handling', () => {
    it('updates a pending player result to success when the save-result event fires', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Player One'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(document.querySelector('.abjure-result-pending')).toBeInTheDocument();
      });

      await act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', {
          detail: { promptId: 'test-guid-123', success: true, total: 18, roll: 13, saveBonus: 5 },
        }));
      });

      await waitFor(() => {
        const successResult = document.querySelector('.abjure-result-success');
        expect(successResult).toBeInTheDocument();
        expect(successResult.textContent).toContain('Player One');
        expect(successResult.textContent).toContain('Saved');
      });
    });

    it('updates a pending player result to failure when the save-result event fires', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Player One'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(document.querySelector('.abjure-result-pending')).toBeInTheDocument();
      });

      await act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', {
          detail: { promptId: 'test-guid-123', success: false, total: 7, roll: 2, saveBonus: 5 },
        }));
      });

      await waitFor(() => {
        const failResult = document.querySelector('.abjure-result-fail');
        expect(failResult).toBeInTheDocument();
        expect(failResult.textContent).toContain('Player One');
      });
    });

    it('ignores save-result events with an unknown promptId', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Player One'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(document.querySelector('.abjure-result-pending')).toBeInTheDocument();
      });

      await act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', {
          detail: { promptId: 'unknown-id', success: true, total: 20, roll: 15, saveBonus: 5 },
        }));
      });

      await waitFor(() => {
        const pending = document.querySelector('.abjure-result-pending');
        expect(pending).toBeInTheDocument();
        expect(pending.textContent).toContain('Player One');
      });
    });

    it('ignores save-result events with no detail', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Player One'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(document.querySelector('.abjure-result-pending')).toBeInTheDocument();
      });

      await act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', { detail: null }));
      });

      await waitFor(() => {
        const pending = document.querySelector('.abjure-result-pending');
        expect(pending).toBeInTheDocument();
      });
    });

    it('calls addEntry with the resolved player save details', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Player One'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });

      await act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', {
          detail: { promptId: 'test-guid-123', success: true, total: 18, roll: 13, saveBonus: 5 },
        }));
      });

      expect(logService.addEntry).toHaveBeenCalledTimes(2);
      expect(logService.addEntry).toHaveBeenLastCalledWith('test-campaign', expect.objectContaining({
        type: 'roll',
        name: 'Divine Smite',
        targetName: 'Player One',
        saveResult: 'success',
      }));
    });
  });

  // ── All resolved → heal phase ──

  describe('all resolved → heal phase', () => {
    it('shows the heal selection UI when all targets are resolved', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(getHealButton()).toBeInTheDocument();
      });
    });

    it('renders radio buttons for each resolved result as heal targets', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        const radios = document.querySelectorAll('input[type="radio"][name="healTarget"]');
        expect(radios.length).toBe(1);
      });
    });

    it('disables the heal button when no heal target is selected', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(getHealButton()).toBeDisabled();
      });
    });

    it('enables the heal button when a radio is selected', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(getHealButton()).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
      });
      expect(getHealButton()).toBeEnabled();
    });

    it('shows the cancel button during the heal phase', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        const cancelBtns = screen.getAllByRole('button', { name: 'Cancel' });
        expect(cancelBtns.length).toBeGreaterThan(0);
      });
    });

    it('calls onClose when cancel is clicked during the heal phase', async () => {
      const onClose = vi.fn();
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps({ onClose })} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(getHealButton()).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('applies the selected class to the healed radio target row', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(document.querySelector('input[type="radio"][name="healTarget"]')).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
      });
      await waitFor(() => {
        const row = document.querySelector('.abjure-target-row.abjure-target-selected');
        expect(row).toBeInTheDocument();
      });
    });
  });

  // ── Healing ──

  describe('healing', () => {
    it('calls rollExpression with the heal expression when healing', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(getHealButton()).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
      });
      await act(async () => {
        fireEvent.click(getHealButton());
      });
      expect(healingRoll.applyHealingDirectly).toHaveBeenCalledTimes(1);
    });

    it('calls applyHealingDirectly with the correct arguments', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8], modifier: 0, formula: '2d8' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(getHealButton()).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
      });
      await act(async () => {
        fireEvent.click(getHealButton());
      });
      expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Goblin A', hitPoints: 0 }),
        'Goblin A',
        8,
        'test-campaign'
      );
    });

    it('calls logHealingToSSE after healing', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8], modifier: 0, formula: '2d8' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(getHealButton()).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
      });
      await act(async () => {
        fireEvent.click(getHealButton());
      });
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledTimes(1);
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        targetName: 'Goblin A',
        sourceName: 'Divine Smite',
        actualHeal: 10,
      }));
    });

    it('calls addEntry with healing log details', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8], modifier: 0, formula: '2d8' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(getHealButton()).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
      });
      await act(async () => {
        fireEvent.click(getHealButton());
      });
      expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        type: 'roll',
        name: 'Divine Smite',
        rollType: 'healing',
        targetName: 'Goblin A',
        formula: '2d8',
        total: 8,
      }));
    });

    it('dispatches a combat-summary-updated event after healing', async () => {
      diceRoller.rollExpression.mockReturnValue({ total: 8, rolls: [8], modifier: 0, formula: '2d8' });
      const listener = vi.fn();
      window.addEventListener('combat-summary-updated', listener);
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(getHealButton()).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
      });
      await act(async () => {
        fireEvent.click(getHealButton());
      });
      await waitFor(() => {
        expect(listener).toHaveBeenCalledTimes(1);
      });
      window.removeEventListener('combat-summary-updated', listener);
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('does not process when apply is clicked with no targets selected', async () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      expect(screen.queryByText(/Resolving/)).not.toBeInTheDocument();
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    });

    it('skips healing when rollExpression returns null', async () => {
      diceRoller.rollExpression
        .mockReturnValueOnce({ total: 15, rolls: [15], modifier: 0, formula: '1d20' })
        .mockReturnValueOnce(null);
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        expect(getHealButton()).toBeInTheDocument();
      });
      await act(async () => {
        fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
      });
      await act(async () => {
        fireEvent.click(getHealButton());
      });
      // Processing should reset to false, no heal result shown
      await waitFor(() => {
        expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
      });
    });

    it('handles multiple NPC targets with mixed success/failure results', async () => {
      diceRoller.rollExpression
        .mockReturnValueOnce({ total: 15, rolls: [15], modifier: 0, formula: '1d20' })
        .mockReturnValueOnce({ total: 3, rolls: [3], modifier: 0, formula: '1d20' });
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      fireEvent.click(getCheckboxByName('Goblin B'));
      await act(async () => {
        fireEvent.click(getApplyButton());
      });
      await waitFor(() => {
        const success = document.querySelector('.abjure-result-success');
        const fail = document.querySelector('.abjure-result-fail');
        expect(success).toBeInTheDocument();
        expect(fail).toBeInTheDocument();
        expect(success.textContent).toContain('Goblin A');
        expect(fail.textContent).toContain('Goblin B');
      });
    });
  });
});
