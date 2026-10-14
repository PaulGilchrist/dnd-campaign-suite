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
    get: vi.fn(() => null),
  },
}));

vi.mock('../../../../services/automation/common/healingRoll.js', () => ({
  applyHealingDirectly: vi.fn(() => ({ newHp: 30, maxHp: 40, actualHeal: 10 })),
  logHealingToSSE: vi.fn(),
}));

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

    it('updates target count and button label when targets are selected', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      fireEvent.click(getCheckboxByName('Goblin A'));
      expect(screen.getByText(/Targets selected: 1\/3/)).toBeInTheDocument();
    });

    it('enables the apply button and updates label when targets are selected', () => {
      render(<SaveAttackHealModal {...makeProps()} />);
      expect(getApplyButton()).toBeDisabled();
      fireEvent.click(getCheckboxByName('Goblin A'));
      expect(getApplyButton()).toBeEnabled();
      expect(getApplyButton()).toHaveTextContent('Divine Smite (1 target)');
      fireEvent.click(getCheckboxByName('Goblin B'));
      expect(getApplyButton()).toHaveTextContent('Divine Smite (2 targets)');
    });
  });

  // ── No eligible targets ──

  describe('no eligible targets', () => {
    it.each([
      { label: 'empty creatures array', combatSummary: { creatures: [] } },
      { label: 'null combatSummary', combatSummary: null },
      { label: 'undefined creatures array', combatSummary: {} },
    ])('shows "No valid targets in range." when %s', ({ combatSummary }) => {
      render(<SaveAttackHealModal {...makeProps({ combatSummary })} />);
      expect(screen.getByText('No valid targets in range.')).toBeInTheDocument();
    });
  });
});
