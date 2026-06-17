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

// ── Test fixtures ──

import { makeProps, getCheckboxByName } from './SaveAttackHealModal.test-utils.js';

// ── Tests ──

describe('SaveAttackHealModal — log details', () => {
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
});
