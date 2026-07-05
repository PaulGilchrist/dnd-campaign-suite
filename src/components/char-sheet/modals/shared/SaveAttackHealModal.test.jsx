// @cleaned-by-ai
import { render, screen, fireEvent } from '@testing-library/react';
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

// ── Test fixtures ──

import { makeProps, getCheckboxByName } from './SaveAttackHealModal.test-utils.js';

// ── Helpers ──

function getApplyButton() {
  return screen.getByRole('button', { name: /Divine Smite/ });
}

// ── Tests ──

describe('SaveAttackHealModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Initial render / display ──

  describe('initial render', () => {
    it('renders the overlay, modal header with feature name and dice icon', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      expect(screen.getByText('Divine Smite')).toBeInTheDocument();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(document.querySelector('.fa-dice-d20')).toBeInTheDocument();
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

    it('toggles a checkbox on and off', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      const checkbox = getCheckboxByName('Goblin A');
      expect(checkbox.checked).toBe(false);
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
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
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('does not process when apply is clicked with no targets selected', async () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      await vi.waitFor(() => {
        fireEvent.click(getApplyButton());
      });
      expect(screen.queryByText(/Resolving/)).not.toBeInTheDocument();
    });
  });
});
