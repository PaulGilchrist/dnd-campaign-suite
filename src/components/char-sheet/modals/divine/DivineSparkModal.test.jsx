// @cleaned-by-ai
// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DivineSparkModal from './DivineSparkModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 10, rolls: [10], modifier: 0, formula: '1d10' })),
  rollExpressionMaximized: vi.fn(() => ({ total: 20, rolls: [10, 10], modifier: 0, formula: '2d10', maximized: true })),
}));

vi.mock('../../../../services/combat/automation/automationService.js', () => ({
  hasHealingMaximization: vi.fn(() => false),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../../services/automation/common/healingRoll.js', () => ({
  applyHealingDirectly: vi.fn(() => ({ newHp: 30, maxHp: 40, actualHeal: 10 })),
  logHealingToSSE: vi.fn(),
}));

vi.mock('../../../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id' })),
}));

// ── Re-import mocked modules ──

import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as automationService from '../../../../services/combat/automation/automationService.js';
import * as logService from '../../../../services/ui/logService.js';
import * as healingRoll from '../../../../services/automation/common/healingRoll.js';
import * as savePrompt from '../../../../services/automation/common/savePrompt.js';

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

function dispatchSaveResult(success, overrides = {}) {
  return new CustomEvent('save-result', {
    detail: {
      promptId: 'test-prompt-id',
      success,
      total: success ? 8 : 5,
      roll: success ? 6 : 3,
      saveBonus: overrides.saveBonus ?? 2,
      ...overrides,
    },
  });
}

function expectRollLogEntry(expectedFields) {
  const rollCall = logService.addEntry.mock.calls.find(
    (call) => call[1].type === 'roll'
  );
  expect(rollCall).toBeDefined();
  expect(rollCall[1]).toMatchObject(expectedFields);
  return rollCall[1];
}

// ── Tests ──

describe('DivineSparkModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [10], modifier: 0, formula: '1d10' });
    diceRoller.rollExpressionMaximized.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0, formula: '2d10', maximized: true });
    automationService.hasHealingMaximization.mockReturnValue(false);
  });

  // ── Initial render / display ──

  it('renders modal overlay with feature name and target', () => {
    render(<DivineSparkModal {...makeProps()} />);
    expect(screen.getByText('Divine Spark')).toBeInTheDocument();
    expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
  });

  it('renders heal and harm buttons with expressions', () => {
    render(<DivineSparkModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: /Heal \(2d8\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Harm \(3d6 Radiant, CON save\)/ })).toBeInTheDocument();
  });

  it('renders Cancel button', () => {
    render(<DivineSparkModal {...makeProps()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
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

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    const onClose = vi.fn();
    render(<DivineSparkModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Heal flow ──

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

  it('displays heal result with target name, total, and HP info', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    await waitFor(() => {
      expect(screen.getByText(/healed for/)).toBeInTheDocument();
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText(/Roll: 2d8 = 10/)).toBeInTheDocument();
      expect(screen.getByText(/Current HP: 30 \/ 40 \(healed 10\)/)).toBeInTheDocument();
    });
  });

  it('hides mode buttons and Cancel, shows Done after heal result', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Heal/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Harm/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Done' })).toBeInTheDocument();
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
    const abilityCall = logService.addEntry.mock.calls[0][1];
    expect(abilityCall).toMatchObject({
      type: 'ability_use',
      characterName: 'Paladin1',
      abilityName: 'Divine Spark',
    });
    expect(abilityCall.description).toContain('Harm');
    expect(abilityCall.description).toContain('Radiant damage');
    expect(abilityCall.description).toContain('CON save DC 13');
    expect(abilityCall.description).toContain('targeting Orc Warrior');
  });

  it('uses attackerName and featureName from props in ability_use log', async () => {
    render(<DivineSparkModal {...makeProps({ attackerName: 'Cleric1', featureName: 'Channel Divinity' })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    const abilityCall = logService.addEntry.mock.calls[0][1];
    expect(abilityCall.characterName).toBe('Cleric1');
    expect(abilityCall.abilityName).toBe('Channel Divinity');
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
      window.dispatchEvent(dispatchSaveResult(true));
    });
    await waitFor(() => {
      expect(screen.getByText(/Target saved and takes no damage/)).toBeInTheDocument();
    });
  });

  it('displays save DC, damage roll formula, and success status in harm result', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(true));
    });
    await waitFor(() => {
      expect(screen.getByText(/DC 13/)).toBeInTheDocument();
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
      window.dispatchEvent(dispatchSaveResult(false));
    });
    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('takes');
      expect(body.textContent).toContain('10');
      expect(body.textContent).toContain('Radiant damage');
    });
  });

  it('hides mode buttons and Cancel, shows Done after harm result', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(false));
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Heal/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Harm/ })).not.toBeInTheDocument();
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
      window.dispatchEvent(dispatchSaveResult(false));
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
      window.dispatchEvent(dispatchSaveResult(false));
    });
    await waitFor(() => {
      expect(screen.getByText(/Damage roll: 3d6 Fire = 10/)).toBeInTheDocument();
    });
  });

  // ── Roll logging on save failure ──

  it('adds roll log entry with correct fields when target fails save', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(false));
    });

    const entry = expectRollLogEntry({
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
    expect(entry.formula).toBe('1d20+2');
    expect(typeof entry.timestamp).toBe('number');
  });

  it('adds roll log entry when target succeeds save', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(true));
    });

    const entry = expectRollLogEntry({ type: 'roll' });
    expect(entry.saveResult).toBe('success');
  });

  it('handles variable save bonus in roll log entry', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(false, { saveBonus: -1 }));
    });

    const entry = expectRollLogEntry({ type: 'roll' });
    expect(entry.bonus).toBe(-1);
    expect(entry.formula).toBe('1d20+-1');
  });

  it('uses default values when event detail fields are undefined', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    await act(async () => {
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'test-prompt-id', success: false },
      }));
    });

    const entry = expectRollLogEntry({ type: 'roll' });
    expect(entry.total).toBe(0);
    expect(entry.rolls).toEqual([0]);
    expect(entry.bonus).toBe(0);
    expect(entry.formula).toBe('1d20+undefined');
  });

  // ── Event listener cleanup ──

  it('removes save-result event listener after handling result', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(false));
    });

    // Second event with same promptId should be ignored (listener removed)
    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(true));
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
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'wrong-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      }));
    });

    await waitFor(() => {
      expect(screen.queryByText(/takes.*damage/)).not.toBeInTheDocument();
    });
  });

  // ── Multi-damage-type flow ──

  it('handles harm with multiple damage types and selection', async () => {
    render(<DivineSparkModal {...makeProps({ damageTypes: ['Radiant', 'Psychic'] })} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Psychic'));
    });
    expect(screen.getByLabelText('Psychic')).toBeChecked();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(false));
    });

    await waitFor(() => {
      const body = document.querySelector('.sp-body');
      expect(body.textContent).toContain('Psychic damage');
    });
  });
});
