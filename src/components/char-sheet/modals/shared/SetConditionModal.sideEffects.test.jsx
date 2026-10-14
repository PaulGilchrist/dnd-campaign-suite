import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SetConditionModal from './SetConditionModal.jsx';

// ── Mocked modules ──

vi.mock('../../../../services/rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(),
  rangeToFeet: vi.fn(() => 60),
}));

vi.mock('../../../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
}));

vi.mock('../../../../services/combat/automation/automationService.js', () => ({
  playerIsImmuneToCondition: vi.fn().mockReturnValue(false),
}));

vi.mock('../../../../services/ui/utils.js', () => {
  let counter = 0;
  const utilsMock = {
    guid: vi.fn(() => `guid-${++counter}`),
    getAbilityLongName: vi.fn((s) => s),
    getName: vi.fn((name) => name || 'Unknown'),
  };
  return { default: utilsMock };
});

vi.mock('../../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

// ── Re-import mocked modules ──

import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
import * as logService from '../../../../services/ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as automationService from '../../../../services/combat/automation/automationService.js';

// ── Test fixtures ──

const mockCombatSummary = {
  creatures: [
    { name: 'Attacker', type: 'player' },
    { name: 'Goblin A', type: 'npc', conditions: [] },
    { name: 'Goblin B', type: 'npc', conditions: [], saveBonuses: { wis: 2 } },
    { name: 'Player Ally', type: 'player' },
  ],
};

const mockAttackerPos = { gridX: 0, gridY: 0 };

function makeProps(overrides) {
  return {
    combatSummary: mockCombatSummary,
    attackerName: 'Attacker',
    attackerPos: mockAttackerPos,
    saveDc: 14,
    campaignName: 'test-campaign',
    mapData: null,
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

// ── Tests ──

describe('SetConditionModal - Side Effects & Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Immunity handling ──

  it('does not apply condition when player is immune', async () => {
    diceRoller.rollD20.mockReturnValue(15);
    automationService.playerIsImmuneToCondition.mockReturnValue(true);

    const characters = [
      { name: 'Player Ally', computedStats: { name: 'Player Ally' } },
    ];

    render(<SetConditionModal {...makeProps({ characters })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const sentPrompt = savePromptService.sendSavePrompt.mock.calls[0][1];
    window.dispatchEvent(
      new CustomEvent('save-result', {
        detail: { promptId: sentPrompt.promptId, targetName: 'Player Ally', success: false, total: 8, roll: 8, saveBonus: 0 },
      })
    );

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    });
  });

  // ── Channel divinity charges ──

  it('decrements channelDivinityCharges when provided', () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<SetConditionModal {...makeProps({ channelDivinityCharges: 3 })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Attacker',
      'channelDivinityCharges',
      2,
      'test-campaign'
    );
  });

  it('does not decrement channelDivinityCharges when not provided', () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const chargeCalls = useRuntimeState.setRuntimeValue.mock.calls.filter(
      call => call[1] === 'channelDivinityCharges'
    );
    expect(chargeCalls).toHaveLength(0);
  });

  // ── Log condition format ──

  it('logs condition format with additionalCondition', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps({ conditionName: 'frightened', additionalCondition: 'blinded' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const conditionCall = logService.addEntry.mock.calls.find(call => call[1]?.type === 'condition');
    expect(conditionCall).toBeDefined();
    expect(conditionCall[1].condition).toBe('Frightened & Blinded');
  });

  it('logs condition format without additionalCondition', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps({ conditionName: 'frightened' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const conditionCall = logService.addEntry.mock.calls.find(call => call[1]?.type === 'condition');
    expect(conditionCall).toBeDefined();
    expect(conditionCall[1].condition).toBe('Frightened');
  });

  // ── Roll log entry formula ──

  it('logs roll entry with correct formula for NPC with zero bonus', () => {
    diceRoller.rollD20.mockReturnValue(10);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A (no bonus)
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const rollEntries = logService.addEntry.mock.calls
      .map(call => call[1])
      .filter(entry => entry.type === 'roll');
    expect(rollEntries.length).toBeGreaterThan(0);
    const entry = rollEntries[0];
    expect(entry.formula).toBe('1d20');
    expect(entry.rollType).toBe('save-damage');
    expect(entry.saveDc).toBe(14);
    expect(entry.saveType).toBe('WIS');
    expect(entry.characterName).toBe('Attacker');
    expect(entry.targetName).toBe('Goblin A');
  });

  it('logs roll entry with correct formula for NPC with non-zero bonus', () => {
    diceRoller.rollD20.mockReturnValue(10);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]); // Goblin B (wis bonus: 2)
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const rollEntries = logService.addEntry.mock.calls
      .map(call => call[1])
      .filter(entry => entry.type === 'roll');
    const entry = rollEntries[0];
    expect(entry.formula).toBe('1d20+2');
    expect(entry.bonus).toBe(2);
    expect(entry.total).toBe(12);
    expect(entry.saveResult).toBe('failure');
  });

});
