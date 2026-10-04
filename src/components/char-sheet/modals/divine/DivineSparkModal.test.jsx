// @improved-by-ai
// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DivineSparkModal from './DivineSparkModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../../../services/combat/automation/automationService.js', () => ({
  hasHealingMaximization: vi.fn(),
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

vi.mock('../../../../services/combat/auras/coronaAuraUtils.js', () => ({
  getCoronaSaveDisadvantageSync: vi.fn(() => ({ disadvantage: false })),
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

function findLogEntry(type, calls) {
  return (calls || logService.addEntry.mock.calls).find(
    (call) => call[1].type === type
  );
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

  it('renders modal overlay with feature name, target, and buttons', () => {
    render(<DivineSparkModal {...makeProps()} />);
    expect(screen.getByText('Divine Spark')).toBeInTheDocument();
    expect(screen.getByText('Orc Warrior')).toBeInTheDocument();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Heal \(2d8\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Harm \(3d6 Radiant, CON save\)/ })).toBeInTheDocument();
  });

  it('renders damage type radio buttons when multiple types provided', () => {
    render(<DivineSparkModal {...makeProps({ damageTypes: ['Radiant', 'Fire'] })} />);
    expect(screen.getByLabelText('Radiant')).toBeInTheDocument();
    expect(screen.getByLabelText('Fire')).toBeInTheDocument();
  });

  it('renders harm button with single damage type without repeating it in label', () => {
    render(<DivineSparkModal {...makeProps({ damageTypes: ['Radiant'] })} />);
    expect(screen.getByRole('button', { name: /Harm \(3d6 Radiant, CON save\)/ })).toBeInTheDocument();
  });

  // ── Cancel button ──

  it('calls onClose when Cancel button is clicked', () => {
    render(<DivineSparkModal {...makeProps()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(healingRoll.applyHealingDirectly).not.toHaveBeenCalled();
  });

  // ── Heal flow ──

  it('rolls dice and applies healing when heal button is clicked', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d8');
    expect(healingRoll.applyHealingDirectly).toHaveBeenCalledWith(
      { name: 'Orc Warrior' },
      'Orc Warrior',
      10,
      'test-campaign'
    );
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

  it('replaces mode buttons and Cancel with Done after heal result', async () => {
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

  it('uses maximized roll when hasHealingMaximization returns true', async () => {
    automationService.hasHealingMaximization.mockReturnValue(true);
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Heal/ }));
    });
    expect(diceRoller.rollExpressionMaximized).toHaveBeenCalledWith('2d8');
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
  });

  it('aborts harm when rollExpression returns null', async () => {
    diceRoller.rollExpression.mockReturnValue(null);
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
  });

  // ── Harm flow ──

  it('rolls damage dice and creates save listener when harm button is clicked', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    expect(diceRoller.rollExpression).toHaveBeenCalledWith('3d6');
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith('test-campaign', {
      targetName: 'Orc Warrior',
      saveType: 'CON',
      saveDc: 13,
      disadvantage: false,
    });
  });

  // CLA-063: Corona of Light — Radiant save vs a listed enemy must arm the
  // prompt with disadvantage (machine-truth payload channel).
  it('CLA-063: threads corona sunlight_aura disadvantage onto the save prompt payload', async () => {
    const corona = await import('../../../../services/combat/auras/coronaAuraUtils.js');
    corona.getCoronaSaveDisadvantageSync.mockReturnValue({ disadvantage: true, source: 'War_Cleric' });

    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    expect(corona.getCoronaSaveDisadvantageSync).toHaveBeenCalledWith(expect.objectContaining({
      targetName: 'Orc Warrior',
      damageType: 'Radiant',
      skipRangeCheck: true,
    }));
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      targetName: 'Orc Warrior',
      disadvantage: true,
    }));
    corona.getCoronaSaveDisadvantageSync.mockReturnValue({ disadvantage: false });
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
      disadvantage: false,
    });
  });

  it('logs ability_use entry when harm is initiated', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    const abilityCall = findLogEntry('ability_use');
    expect(abilityCall).toBeDefined();
    expect(abilityCall[1]).toMatchObject({
      type: 'ability_use',
      characterName: 'Paladin1',
      abilityName: 'Divine Spark',
    });
    expect(abilityCall[1].description).toContain('Harm');
    expect(abilityCall[1].description).toContain('Radiant damage');
    expect(abilityCall[1].description).toContain('CON save DC 13');
    expect(abilityCall[1].description).toContain('targeting Orc Warrior');
  });

  it('uses attackerName and featureName from props in ability_use log', async () => {
    render(<DivineSparkModal {...makeProps({ attackerName: 'Cleric1', featureName: 'Channel Divinity' })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    const abilityCall = findLogEntry('ability_use');
    expect(abilityCall[1].characterName).toBe('Cleric1');
    expect(abilityCall[1].abilityName).toBe('Channel Divinity');
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

  it('replaces mode buttons and Cancel with Done after harm result', async () => {
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

  it('uses selected damage type in ability_use log description', async () => {
    render(<DivineSparkModal {...makeProps({ damageTypes: ['Radiant', 'Fire'] })} />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText('Fire'));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    const abilityCall = findLogEntry('ability_use');
    expect(abilityCall[1].description).toContain('Fire damage');
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

    const entry = findLogEntry('roll');
    expect(entry[1]).toMatchObject({
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
    expect(entry[1].formula).toBe('1d20+2');
    expect(typeof entry[1].timestamp).toBe('number');
  });

  it('adds roll log entry when target succeeds save', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(true));
    });

    const entry = findLogEntry('roll');
    expect(entry[1].saveResult).toBe('success');
  });

  it('handles variable save bonus in roll log entry', async () => {
    render(<DivineSparkModal {...makeProps()} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });

    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(false, { saveBonus: -1 }));
    });

    const entry = findLogEntry('roll');
    expect(entry[1].bonus).toBe(-1);
    expect(entry[1].formula).toBe('1d20+-1');
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

    const entry = findLogEntry('roll');
    expect(entry[1].total).toBe(0);
    expect(entry[1].rolls).toEqual([0]);
    expect(entry[1].bonus).toBe(0);
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

  // ── Edge cases ──

  it('calculates correct save DC with zero wisModifier', async () => {
    render(<DivineSparkModal {...makeProps({ wisModifier: 0 })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith('test-campaign', {
      targetName: 'Orc Warrior',
      saveType: 'CON',
      saveDc: 10,
      disadvantage: false,
    });
  });

  it('calculates correct save DC with negative wisModifier', async () => {
    render(<DivineSparkModal {...makeProps({ wisModifier: -2 })} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Harm/ }));
    });
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith('test-campaign', {
      targetName: 'Orc Warrior',
      saveType: 'CON',
      saveDc: 8,
      disadvantage: false,
    });
  });

  // ── Done button closes modal (consolidated from 3 separate tests) ──
  // Each scenario previously had its own test; consolidated into one parameterized test.

  it.each([
    { name: 'after heal', setup: async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Heal/ })); }); } },
    { name: 'after harm failure', setup: async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Harm/ })); }); await act(async () => { window.dispatchEvent(dispatchSaveResult(false)); }); } },
    { name: 'after harm success', setup: async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Harm/ })); }); await act(async () => { window.dispatchEvent(dispatchSaveResult(true)); }); } },
  ])('closes modal when Done is clicked $name', async ({ setup }) => {
    const onClose = vi.fn();
    render(<DivineSparkModal {...makeProps({ onClose })} />);
    await setup();
    await waitFor(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
