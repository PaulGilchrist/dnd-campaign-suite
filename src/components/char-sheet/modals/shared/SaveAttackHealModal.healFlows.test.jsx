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

import * as logService from '../../../../services/ui/logService.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import utils from '../../../../services/ui/utils.js';
import * as healingRoll from '../../../../services/automation/common/healingRoll.js';

// ── Test fixtures ──

import { makeProps, getCheckboxByName } from './SaveAttackHealModal.test-utils.js';

// ── Helpers ──

/**
 * Resolve the modal through the full flow to the heal-selection phase.
 * Selects the given target names, applies the feature, and waits for
 * radio buttons to appear.
 */
async function resolveToHealSelection(getByRole, targetNames) {
  for (const name of targetNames) {
    fireEvent.click(getCheckboxByName(name));
  }
  await act(async () => {
    const applyBtn = getByRole('button', { name: /Divine Smite/ });
    fireEvent.click(applyBtn);
  });
  await waitFor(() => {
    expect(screen.getByText(/Select one creature to heal for 2d8 HP/)).toBeInTheDocument();
  });
}

/**
 * Select the first available heal radio button.
 */
async function selectFirstHealRadio() {
  await act(async () => {
    fireEvent.click(document.querySelector('input[type="radio"][name="healTarget"]'));
  });
}

/**
 * Click the heal button and assert it is enabled.
 */
async function clickHealButton() {
  await act(async () => {
    const healBtn = screen.getByRole('button', { name: /Heal Selected/ });
    expect(healBtn).toBeEnabled();
    fireEvent.click(healBtn);
  });
}

// ── Tests ──

describe('SaveAttackHealModal — heal flows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0, formula: '1d20' });
    utils.guid.mockReturnValue('test-guid-123');
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Resolve phase ──

  it('shows heal prompt after all targets resolve', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByText('All targets resolved.')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/Select one creature to heal for 2d8 HP/)).toBeInTheDocument();
    });
    const radios = document.querySelectorAll('input[type="radio"][name="healTarget"]');
    expect(radios.length).toBeGreaterThan(0);
  });

  // ── Heal selection ──

  it('disables heal button when no heal target is selected', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await resolveToHealSelection(getByRole, ['Goblin A']);
    expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeDisabled();
  });

  it('enables heal button after a heal target radio is selected', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await resolveToHealSelection(getByRole, ['Goblin A']);
    await selectFirstHealRadio();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Heal Selected/ })).toBeEnabled();
    });
  });

  // ── Full heal execution ──

  it('calls rollExpression with the heal expression when heal is triggered', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await resolveToHealSelection(getByRole, ['Goblin A']);
    await selectFirstHealRadio();
    await clickHealButton();
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d8');
  });

  it('calls applyHealingDirectly with the healed target and amount', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await resolveToHealSelection(getByRole, ['Goblin A']);
    await selectFirstHealRadio();
    await clickHealButton();
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(
      { name: 'Goblin A', hitPoints: 82 },
      'Goblin A',
      10,
      'test-campaign',
      82
    );
  });

  it('calls logHealingToSSE with correct healing info', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await resolveToHealSelection(getByRole, ['Goblin A']);
    await selectFirstHealRadio();
    await clickHealButton();
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith('test-campaign', {
      targetName: 'Goblin A',
      sourceName: 'Divine Smite',
      actualHeal: 10,
      newHp: 30,
      maxHp: 40,
    });
  });

  it('adds a roll log entry for healing', async () => {
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await resolveToHealSelection(getByRole, ['Goblin A']);
    await selectFirstHealRadio();
    await clickHealButton();
    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'roll',
      name: 'Divine Smite',
      characterName: 'Cleric1',
      rollType: 'healing',
      targetName: 'Goblin A',
      formula: '2d8',
    }));
  });

  it('does not call applyHealingDirectly when rollExpression returns null', async () => {
    diceRoller.rollExpression.mockReturnValue(null);
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    await resolveToHealSelection(getByRole, ['Goblin A']);
    await selectFirstHealRadio();
    await clickHealButton();
    expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
    expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
  });

  // ── Multiple targets ──

  it('shows all resolved NPCs as heal candidates', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    fireEvent.click(getCheckboxByName('Goblin B'));
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /Divine Smite \(2 targets\)/ }));
    });
    await waitFor(() => {
      const radios = document.querySelectorAll('input[type="radio"][name="healTarget"]');
      expect(radios.length).toBe(2);
    });
  });

  it('shows multiple resolved targets in the heal selection list', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    fireEvent.click(getCheckboxByName('Goblin B'));
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /Divine Smite \(2 targets\)/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Goblin A');
      expect(body.textContent).toContain('Goblin B');
    });
  });

  it('shows Cancel button in resolved state before healing', async () => {
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps()} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });
  });

  it('calls onClose when Cancel is clicked after all targets resolve', async () => {
    const onClose = vi.fn();
    diceRoller.rollExpression.mockReturnValue({ total: 15, rolls: [15], modifier: 0, formula: '1d20' });
    const { getByRole } = render(<SaveAttackHealModal {...makeProps({ onClose })} />);
    fireEvent.click(getCheckboxByName('Goblin A'));
    await act(async () => {
      fireEvent.click(getByRole('button', { name: /Divine Smite \(1 target\)/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
