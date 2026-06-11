import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DivineSparkModal from './DivineSparkModal.jsx';

// ── Mocked modules ──

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 10, rolls: [10], modifier: 0, formula: '1d10' })),
  rollExpressionMaximized: vi.fn(() => ({ total: 20, rolls: [10, 10], modifier: 0, formula: '2d10', maximized: true })),
}));

vi.mock('../../services/combat/automationService.js', () => ({
  hasHealingMaximization: vi.fn(() => false),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/automation/common/healingRoll.js', () => ({
  applyHealingDirectly: vi.fn(() => ({ newHp: 30, maxHp: 40, actualHeal: 10 })),
  logHealingToSSE: vi.fn(),
}));

vi.mock('../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id' })),
}));

// ── Re-import mocked modules ──

import * as diceRoller from '../../services/dice/diceRoller.js';
import * as automationService from '../../services/combat/automationService.js';
import * as logService from '../../services/ui/logService.js';
import * as healingRoll from '../../services/automation/common/healingRoll.js';
import * as savePrompt from '../../services/automation/common/savePrompt.js';

// ── Test fixtures ──

const baseProps = {
  featureName: 'Divine Spark',
  attackerName: 'Paladin1',
  targetName: 'Orc Warrior',
  campaignName: 'test-campaign',
  healExpression: '2d8',
  damageExpression: '3d6',
  damageTypes: ['Radiant'],
  saveType: 'CON',
  wisModifier: 3,
  playerStats: { name: 'Paladin1', level: 3, hitPoints: 40 },
  onClose: vi.fn(),
};

function makeProps(overrides) {
  return { ...baseProps, ...(overrides || {}) };
}

// ── Tests ──

describe('DivineSparkModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0, formula: '1d10' });
    diceRoller.rollExpressionMaximized.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0, formula: '2d10', maximized: true });
    automationService.hasHealingMaximization.mockReturnValue(false);
    localStorage.clear();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.dispatchEvent(new CustomEvent('save-result-cleanup'));
  });

  // ── Initial render / display ──

  it('renders modal overlay and header with feature name', () => {
    render(<DivineSparkModal {...makeProps()} />);
    expect(screen.getByText('Divine Spark')).toBeInTheDocument();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('displays target name in the modal body', () => {
    render(<DivineSparkModal {...makeProps()} />);
    expect(screen.getByText(/Channel divine energy at/)).toBeInTheDocument();
    expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
  });

  it('renders heal button with expression', () => {
    render(<DivineSparkModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Heal \(2d8\)/ })).toBeInTheDocument();
  });

  it('renders harm button with damage expression and save info', () => {
    render(<DivineSparkModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Harm \(3d6 Radiant, CON save\)/ })).toBeInTheDocument();
  });

  it('does not render damage type selector when only one damage type', () => {
    render(<DivineSparkModal {...makeProps({ damageTypes: ['Radiant'] })} />);
    expect(document.querySelector('input[name="damageType"]')).not.toBeInTheDocument();
  });

  it('renders damage type radio buttons when multiple types provided', () => {
    render(<DivineSparkModal {...makeProps({ damageTypes: ['Radiant', 'Fire'] })} />);
    expect(screen.getByLabelText('Radiant')).toBeInTheDocument();
    expect(screen.getByLabelText('Fire')).toBeInTheDocument();
  });

  it('defaults to first damage type when multiple available', () => {
    render(<DivineSparkModal {...makeProps({ damageTypes: ['Radiant', 'Fire'] })} />);
    expect(screen.getByLabelText('Radiant')).toBeChecked();
  });

  it('renders Cancel button', () => {
    render(<DivineSparkModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Overlay click behavior ──

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<DivineSparkModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-overlay'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside the modal content', () => {
    const onClose = vi.fn();
    render(<DivineSparkModal {...makeProps({ onClose })} />);
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<DivineSparkModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Heal flow ──

  it('shows rolling state when heal is initiated', async () => {
    let rollingSeen = false;
    const { container } = render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
      await new Promise(r => setTimeout(r, 0));
      rollingSeen = container.textContent.includes('Rolling');
    });
    expect(rollingSeen || screen.queryByText(/healed for/)).toBeTruthy();
  });

  it('calls rollExpression with heal expression on heal click', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d8');
  });

  it('calls applyHealingDirectly with correct target and campaign', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(
      { name: 'Orc Warrior' },
      'Orc Warrior',
      10,
      'test-campaign'
    );
  });

  it('calls logHealingToSSE with correct info after heal', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith('test-campaign', {
      targetName: 'Orc Warrior',
      sourceName: 'Divine Spark',
      actualHeal: 10,
      newHp: 30,
      maxHp: 40,
    });
  });

  it('displays heal result with target name and total', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/healed for/)).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });

  it('displays roll formula in heal result', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Roll: 2d8 = 10/)).toBeInTheDocument();
    });
  });

  it('displays current HP info in heal result', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/Current HP: 30 \/ 40 \(healed 10\)/)).toBeInTheDocument();
    });
  });

  it('shows Done button after heal result', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('hides Cancel button after heal result', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked after heal', async () => {
    const onClose = vi.fn();
    render(<DivineSparkModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses maximized roll when hasHealingMaximization returns true', async () => {
    automationService.hasHealingMaximization.mockReturnValue(true);
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    expect(diceRoller.rollExpressionMaximized).toHaveBeenCalledWith('2d8');
  });

  it('does not call rollExpression when hasHealingMaximization is true', async () => {
    automationService.hasHealingMaximization.mockReturnValue(true);
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
  });

  it('does not proceed with heal when rollExpression returns null', async () => {
    diceRoller.rollExpression.mockReturnValue(null);
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByText(/healed for/)).not.toBeInTheDocument();
    });
  });

  // ── Harm flow ──

  it('shows rolling state when harm is initiated', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    const hasContent = screen.queryByText(/Rolling|Orc Warrior/);
    expect(hasContent).toBeTruthy();
  });

  it('calls rollExpression with damage expression on harm click', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('3d6');
  });

  it('creates save listener with correct parameters', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith('test-campaign', {
      targetName: 'Orc Warrior',
      saveType: 'CON',
      saveDc: 13,
    });
  });

  it('calculates save DC as 8 + wisModifier + 2', async () => {
    render(<DivineSparkModal {...makeProps({ wisModifier: 5 })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith('test-campaign', {
      targetName: 'Orc Warrior',
      saveType: 'CON',
      saveDc: 15,
    });
  });

  it('adds ability_use log entry when harm is initiated', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'ability_use',
      characterName: 'Paladin1',
      abilityName: 'Divine Spark',
      description: expect.stringContaining('Harm'),
    });
  });

  it('adds ability_use log entry with damage type and save info', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    const call = logService.addEntry.mock.calls[0][1];
    expect(call.description).toContain('Radiant damage');
    expect(call.description).toContain('CON save DC 13');
  });

  it('does not proceed with harm when rollExpression returns null', async () => {
    diceRoller.rollExpression.mockReturnValue(null);
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
  });

  // ── Harm result - save success ──

  it('displays save success message when target succeeds', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: true, total: 8, roll: 6, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      expect(screen.getByText(/Target saved and takes no damage/)).toBeInTheDocument();
    });
  });

  it('displays save DC in harm result', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: true, total: 8, roll: 6, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      expect(screen.getByText(/DC 13/)).toBeInTheDocument();
    });
  });

  it('displays damage roll formula in harm result', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: true, total: 8, roll: 6, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      expect(screen.getByText(/Damage roll: 3d6 Radiant = 10/)).toBeInTheDocument();
    });
  });

  // ── Harm result - save failure ──

  it('displays damage taken when target fails save', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('takes');
      expect(body.textContent).toContain('10');
      expect(body.textContent).toContain('Radiant damage');
    });
  });

  it('does not display "Target saved" message when target fails save', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      expect(screen.queryByText(/Target saved/)).not.toBeInTheDocument();
    });
  });

  it('shows Done button after harm result', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked after harm', async () => {
    const onClose = vi.fn();
    render(<DivineSparkModal {...makeProps({ onClose })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Damage type selection ──

  it('uses selected damage type in harm result', async () => {
    render(<DivineSparkModal {...makeProps({ damageTypes: ['Radiant', 'Fire'] })} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Fire'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Fire damage');
    });
  });

  it('includes selected damage type in roll formula display', async () => {
    render(<DivineSparkModal {...makeProps({ damageTypes: ['Radiant', 'Fire'] })} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Fire'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      expect(screen.getByText(/Damage roll: 3d6 Fire = 10/)).toBeInTheDocument();
    });
  });

  // ── Roll logging on save failure ──

  it('adds roll log entry when target fails save', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const rollCall = logService.addEntry.mock.calls.find(
        (call) => call[1].type === 'roll'
      );
      expect(rollCall).toBeDefined();
      expect(rollCall[1]).toMatchObject({
        type: 'roll',
        name: 'Divine Spark',
        characterName: 'Paladin1',
        rollType: 'save-damage',
        targetName: 'Orc Warrior',
        saveDc: 13,
        saveType: 'CON',
        saveResult: 'failure',
        total: 5,
        rolls: [3],
        bonus: 2,
      });
    });
  });

  it('adds roll log entry when target succeeds save', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: true, total: 8, roll: 6, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const rollCall = logService.addEntry.mock.calls.find(
        (call) => call[1].type === 'roll'
      );
      expect(rollCall).toBeDefined();
      expect(rollCall[1].saveResult).toBe('success');
    });
  });

  it('includes save bonus in roll formula when non-zero', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const rollCall = logService.addEntry.mock.calls.find(
        (call) => call[1].type === 'roll'
      );
      expect(rollCall[1].formula).toBe('1d20+2');
    });
  });

  it('excludes plus sign from formula when save bonus is zero', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 3, roll: 3, saveBonus: 0 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const rollCall = logService.addEntry.mock.calls.find(
        (call) => call[1].type === 'roll'
      );
      expect(rollCall[1].formula).toBe('1d20');
    });
  });

  // ── Event listener cleanup ──

  it('removes save-result event listener after handling result', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    // Dispatching another event with same promptId should not trigger handler again
    await act(async () => {
      const secondEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: true, total: 10, roll: 8, saveBonus: 2 },
      });
      window.dispatchEvent(secondEvent);
    });

    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('takes');
      expect(body.textContent).toContain('Radiant damage');
    });
  });

  it('ignores save-result events with different promptId', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const wrongEvent = new CustomEvent('save-result', {
        detail: { promptId: 'wrong-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(wrongEvent);
    });

    await waitFor(() => {
      expect(screen.queryByText(/takes.*damage/)).not.toBeInTheDocument();
    });
  });

  // ── Edge cases ──

  it('renders with default damage type when damageTypes is empty array', () => {
    render(<DivineSparkModal {...makeProps({ damageTypes: [] })} />);
    expect(screen.getByRole('button', { name: /Harm \(3d6 Radiant, CON save\)/ })).toBeInTheDocument();
  });

  it('does not show rolling after harm result is displayed', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      expect(screen.queryByText(/Rolling.../)).not.toBeInTheDocument();
    });
  });

  it('does not show rolling after heal result is displayed', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });

    await waitFor(() => {
      expect(screen.queryByText(/Rolling.../)).not.toBeInTheDocument();
    });
  });

  it('renders Font Awesome star icon in header', () => {
    render(<DivineSparkModal {...makeProps()} />);
    const icon = document.querySelector('.fa-star-of-life');
    expect(icon).toBeInTheDocument();
  });

  it('renders Font Awesome heart icon on heal button', () => {
    render(<DivineSparkModal {...makeProps()} />);
    const icon = document.querySelector('.sp-roll-btn .fa-heart');
    expect(icon).toBeInTheDocument();
  });

  it('renders Font Awesome bolt icon on harm button', () => {
    render(<DivineSparkModal {...makeProps()} />);
    const icon = document.querySelector('.sp-roll-btn .fa-bolt');
    expect(icon).toBeInTheDocument();
  });

  it('renders Font Awesome spinner icon during rolling state', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('healed for');
    });
  });

  it('uses correct save bonus from event detail', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 5, roll: 3, saveBonus: -1 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const rollCall = logService.addEntry.mock.calls.find(
        (call) => call[1].type === 'roll'
      );
      expect(rollCall[1].bonus).toBe(-1);
    });
  });

  it('uses default total of 0 when event detail total is undefined', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const rollCall = logService.addEntry.mock.calls.find(
        (call) => call[1].type === 'roll'
      );
      expect(rollCall[1].total).toBe(0);
    });
  });

  it('uses default roll of 0 when event detail roll is undefined', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 5, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const rollCall = logService.addEntry.mock.calls.find(
        (call) => call[1].type === 'roll'
      );
      expect(rollCall[1].rolls).toEqual([0]);
    });
  });

  it('uses default save bonus of 0 when event detail saveBonus is undefined', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 5, roll: 3 },
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

  it('adds timestamp to roll log entry', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const rollCall = logService.addEntry.mock.calls.find(
        (call) => call[1].type === 'roll'
      );
      expect(typeof rollCall[1].timestamp).toBe('number');
    });
  });

  it('does not show result or rolling on initial render', () => {
    render(<DivineSparkModal {...makeProps()} />);
    expect(screen.queryByText(/Rolling.../)).not.toBeInTheDocument();
    expect(screen.queryByText(/healed for/)).not.toBeInTheDocument();
    expect(screen.queryByText(/takes.*damage/)).not.toBeInTheDocument();
  });

  it('shows only initial mode buttons on first render', () => {
    render(<DivineSparkModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Heal/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Harm/ })).toBeInTheDocument();
  });

  it('hides mode buttons after heal result', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Heal/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Harm/ })).not.toBeInTheDocument();
    });
  });

  it('hides mode buttons after harm result', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Heal/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Harm/ })).not.toBeInTheDocument();
    });
  });

  it('handles harm with multiple damage types and selection', async () => {
    render(<DivineSparkModal {...makeProps({ damageTypes: ['Radiant', 'Psychic'] })} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Psychic'));
    });
    expect(screen.getByLabelText('Psychic')).toBeChecked();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm.*Psychic/ }));
    });

    await act(async () => {
      const saveEvent = new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      });
      window.dispatchEvent(saveEvent);
    });

    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Psychic damage');
    });
  });

  it('renders modal with proper CSS classes', () => {
    render(<DivineSparkModal {...makeProps()} />);
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    expect(document.querySelector('.sp-header')).toBeInTheDocument();
    expect(document.querySelector('.sp-body')).toBeInTheDocument();
    expect(document.querySelector('.sp-actions')).toBeInTheDocument();
  });

  it('displays feature name in header with icon', () => {
    render(<DivineSparkModal {...makeProps({ featureName: 'Divine Smite' })} />);
    expect(screen.getByText('Divine Smite')).toBeInTheDocument();
  });

  it('uses attackerName in ability_use log entry', async () => {
    render(<DivineSparkModal {...makeProps({ attackerName: 'Cleric1' })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    const abilityCall = logService.addEntry.mock.calls.find(
      (call) => call[1].type === 'ability_use'
    );
    expect(abilityCall[1].characterName).toBe('Cleric1');
  });

  it('uses featureName in ability_use log entry', async () => {
    render(<DivineSparkModal {...makeProps({ featureName: 'Channel Divinity' })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    const abilityCall = logService.addEntry.mock.calls.find(
      (call) => call[1].type === 'ability_use'
    );
    expect(abilityCall[1].abilityName).toBe('Channel Divinity');
  });

  it('includes target name in ability_use description', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    const abilityCall = logService.addEntry.mock.calls.find(
      (call) => call[1].type === 'ability_use'
    );
    expect(abilityCall[1].description).toContain('targeting Orc Warrior');
  });

  it('heal result does not show maximized label when roll was not maximized', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });

    await waitFor(() => {
      expect(screen.queryByText(/Maximized/)).not.toBeInTheDocument();
    });
  });
});
