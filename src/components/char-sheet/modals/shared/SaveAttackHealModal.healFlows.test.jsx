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

import * as logService from '../../../../services/ui/logService.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import utils from '../../../../services/ui/utils.js';
import * as healingRoll from '../../../../services/automation/common/healingRoll.js';

// ── Test fixtures ──

import { makeProps, getCheckboxByName } from './SaveAttackHealModal.test-utils.js';

// ── Tests ──

describe('SaveAttackHealModal — heal flows', () => {
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

  // ── Default total display ──

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
});
