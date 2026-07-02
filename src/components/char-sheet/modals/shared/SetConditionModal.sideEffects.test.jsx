// @improved-by-ai
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
import * as storage from '../../../../services/ui/storage.js';
import * as logService from '../../../../services/ui/logService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';

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

  // ── Combat summary persistence ──

  it('persists combatSummary via storage.set after NPC save', () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(storage.default.set).toHaveBeenCalledWith('combatSummary', mockCombatSummary, 'test-campaign');
  });

  it('persists combatSummary via storage.set after player save prompt', () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(storage.default.set).toHaveBeenCalledWith('combatSummary', mockCombatSummary, 'test-campaign');
  });

  it('persists combatSummary after player save result event', async () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const sentPrompt = savePromptService.sendSavePrompt.mock.calls[0][1];
    storage.default.set.mockClear();

    window.dispatchEvent(
      new CustomEvent('save-result', {
        detail: { promptId: sentPrompt.promptId, targetName: 'Player Ally', success: false },
      })
    );

    await waitFor(() => {
      expect(storage.default.set).toHaveBeenCalledWith('combatSummary', mockCombatSummary, 'test-campaign');
    });
  });

  // ── Window event dispatch for combat-summary-updated ──

  it('dispatches combat-summary-updated event after NPC save', () => {
    diceRoller.rollD20.mockReturnValue(15);

    const events = [];
    const originalDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = (event) => {
      events.push(event);
      return originalDispatch(event);
    };

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const updatedEvent = events.find(e => e.type === 'combat-summary-updated');
    expect(updatedEvent).toBeDefined();

    window.dispatchEvent = originalDispatch;
  });

  // ── NPC conditions mutation ──

  it('sets NPC conditions via setRuntimeValue on failure with proper structure', () => {
    diceRoller.rollD20.mockReturnValue(5);

    const summary = {
      creatures: [
        { name: 'Attacker', type: 'player' },
        { name: 'Orc', type: 'npc', conditions: [] },
      ],
    };

    render(<SetConditionModal {...makeProps({ combatSummary: summary })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Orc
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Orc',
      'activeConditions',
      expect.arrayContaining(['frightened']),
      'test-campaign'
    );
  });

  it('replaces existing condition of same type on NPC via setRuntimeValue', () => {
    diceRoller.rollD20.mockReturnValue(5);

    const summary = {
      creatures: [
        { name: 'Attacker', type: 'player' },
        { name: 'Orc', type: 'npc', conditions: [{ key: 'frightened', id: 'old-id' }] },
      ],
    };

    useRuntimeState.getRuntimeValue.mockReturnValue(['frightened']);

    render(<SetConditionModal {...makeProps({ combatSummary: summary })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Orc
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Orc',
      'activeConditions',
      ['frightened'],
      'test-campaign'
    );
  });

  it('does not mutate NPC conditions on success', () => {
    diceRoller.rollD20.mockReturnValue(20);

    const summary = {
      creatures: [
        { name: 'Attacker', type: 'player' },
        { name: 'Orc', type: 'npc', conditions: [] },
      ],
    };

    render(<SetConditionModal {...makeProps({ combatSummary: summary })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Orc
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const orcConditions = summary.creatures.find(c => c.name === 'Orc').conditions;
    expect(orcConditions).toHaveLength(0);
  });

  // ── Player activeConditions mutation ──

  it('calls setRuntimeValue with activeConditions on player failure', async () => {
    diceRoller.rollD20.mockReturnValue(15);

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
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Player Ally',
        'activeConditions',
        expect.arrayContaining(['frightened']),
        'test-campaign'
      );
    });
  });

  it('removes existing condition of same type before adding on player failure', async () => {
    useRuntimeState.getRuntimeValue.mockReturnValueOnce(['frightened']);

    diceRoller.rollD20.mockReturnValue(15);

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
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Player Ally',
        'activeConditions',
        ['frightened'],
        'test-campaign'
      );
    });
  });

  // ── Additional condition with different DC types ──

  it('applies both conditions with correct ability type to NPC via setRuntimeValue', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps({ conditionName: 'frightened', additionalCondition: 'blinded', saveType: 'WIS' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    // The component calls setRuntimeValue twice (once for each condition)
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(2);
    const calls = useRuntimeState.setRuntimeValue.mock.calls;
    expect(calls[0][0]).toBe('Goblin A');
    expect(calls[0][1]).toBe('activeConditions');
    expect(calls[0][2]).toContain('frightened');
    expect(calls[1][0]).toBe('Goblin A');
    expect(calls[1][1]).toBe('activeConditions');
    expect(calls[1][2]).toContain('blinded');
  });

  // ── Log condition fetch body validation ──

  it('logs correct condition format when additionalCondition is provided', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps({ conditionName: 'frightened', additionalCondition: 'blinded' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const conditionCall = logService.addEntry.mock.calls.find(call => call[1]?.type === 'condition');
    expect(conditionCall).toBeDefined();
    const logBody = conditionCall[1];
    expect(logBody.condition).toBe('Frightened & Blinded');
    expect(logBody.type).toBe('condition');
    expect(logBody.action).toBe('applied');
    expect(logBody.characterName).toBe('Goblin A');
    expect(logBody.dc).toBe(14);
    expect(logBody.ability).toBe('WIS');
    expect(logBody.sourceName).toBe('Attacker');
  });

  it('logs correct condition format without additionalCondition', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps({ conditionName: 'frightened' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const conditionCall = logService.addEntry.mock.calls.find(call => call[1]?.type === 'condition');
    expect(conditionCall).toBeDefined();
    const logBody = conditionCall[1];
    expect(logBody.condition).toBe('Frightened');
  });

  // ── Roll log entry validation ──

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
