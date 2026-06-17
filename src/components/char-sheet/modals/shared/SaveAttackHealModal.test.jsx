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
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import utils from '../../../../services/ui/utils.js';

// ── Test fixtures ──

import { makeProps, getCheckboxByName } from './SaveAttackHealModal.test-utils.js';

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
