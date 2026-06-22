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

describe('SetConditionModal - Turn Undead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dispatches turn-undead-result event when feature name includes "turn undead" and there are failed targets', () => {
    diceRoller.rollD20.mockReturnValue(5);

    const customEvents = [];
    const originalDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = (event) => {
      customEvents.push(event);
      return originalDispatch(event);
    };

    render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getByRole('button', { name: /Turn Undead \(1 target\)/ }));

    const turnUndeadEvent = customEvents.find(e => e.type === 'turn-undead-result');
    expect(turnUndeadEvent).toBeDefined();
    expect(turnUndeadEvent.detail.failedTargets).toContain('Goblin A');
    expect(turnUndeadEvent.detail.attackerName).toBe('Attacker');
    expect(turnUndeadEvent.detail.saveDc).toBe(14);
    expect(turnUndeadEvent.detail.saveType).toBe('WIS');
    expect(turnUndeadEvent.detail.campaignName).toBe('test-campaign');

    window.dispatchEvent = originalDispatch;
  });

  it('does NOT dispatch turn-undead-result when all targets succeed', () => {
    diceRoller.rollD20.mockReturnValue(20);

    const customEvents = [];
    const originalDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = (event) => {
      customEvents.push(event);
      return originalDispatch(event);
    };

    render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getByRole('button', { name: /Turn Undead \(1 target\)/ }));

    const turnUndeadEvent = customEvents.find(e => e.type === 'turn-undead-result');
    expect(turnUndeadEvent).toBeUndefined();

    window.dispatchEvent = originalDispatch;
  });

  it('does NOT dispatch turn-undead-result when feature name does not include "turn undead"', () => {
    diceRoller.rollD20.mockReturnValue(5);

    const customEvents = [];
    const originalDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = (event) => {
      customEvents.push(event);
      return originalDispatch(event);
    };

    render(<SetConditionModal {...makeProps({ featureName: 'Abjure Foes' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const turnUndeadEvent = customEvents.find(e => e.type === 'turn-undead-result');
    expect(turnUndeadEvent).toBeUndefined();

    window.dispatchEvent = originalDispatch;
  });

  it('dispatches turn-undead-result with multiple failed targets', () => {
    diceRoller.rollD20.mockReturnValueOnce(5).mockReturnValueOnce(3);

    const customEvents = [];
    const originalDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = (event) => {
      customEvents.push(event);
      return originalDispatch(event);
    };

    render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getAllByRole('checkbox')[1]); // Goblin B
    fireEvent.click(screen.getByRole('button', { name: /Turn Undead \(2 targets\)/ }));

    const turnUndeadEvent = customEvents.find(e => e.type === 'turn-undead-result');
    expect(turnUndeadEvent).toBeDefined();
    expect(turnUndeadEvent.detail.failedTargets).toContain('Goblin A');
    expect(turnUndeadEvent.detail.failedTargets).toContain('Goblin B');
    expect(turnUndeadEvent.detail.failedTargets).toHaveLength(2);

    window.dispatchEvent = originalDispatch;
  });

  it('does NOT dispatch turn-undead-result when player targets are pending', () => {
    diceRoller.rollD20.mockReturnValue(5);

    const customEvents = [];
    const originalDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = (event) => {
      customEvents.push(event);
      return originalDispatch(event);
    };

    render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A (NPC)
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally
    fireEvent.click(screen.getByRole('button', { name: /Turn Undead \(2 targets\)/ }));

    // At this point the NPC failed but the player is pending, so allResolved is false
    const turnUndeadEvent = customEvents.find(e => e.type === 'turn-undead-result');
    expect(turnUndeadEvent).toBeUndefined();

    window.dispatchEvent = originalDispatch;
  });

  it('dispatches turn-undead-result after player save resolves with failure', async () => {
    diceRoller.rollD20.mockReturnValue(5);

    const customEvents = [];
    const originalDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = (event) => {
      customEvents.push(event);
      return originalDispatch(event);
    };

    render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally
    fireEvent.click(screen.getByRole('button', { name: /Turn Undead \(2 targets\)/ }));

    const sentPrompt = savePromptService.sendSavePrompt.mock.calls[0][1];

    window.dispatchEvent(
      new CustomEvent('save-result', {
        detail: { promptId: sentPrompt.promptId, targetName: 'Player Ally', success: false },
      })
    );

    await waitFor(() => {
      const turnUndeadEvent = customEvents.find(e => e.type === 'turn-undead-result');
      expect(turnUndeadEvent).toBeDefined();
      expect(turnUndeadEvent.detail.failedTargets).toContain('Goblin A');
      expect(turnUndeadEvent.detail.failedTargets).toContain('Player Ally');
    });

    window.dispatchEvent = originalDispatch;
  });

  it('does NOT dispatch turn-undead-result if player save succeeds', async () => {
    diceRoller.rollD20.mockReturnValue(5);

    const customEvents = [];
    const originalDispatch = window.dispatchEvent.bind(window);
    window.dispatchEvent = (event) => {
      customEvents.push(event);
      return originalDispatch(event);
    };

    render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally
    fireEvent.click(screen.getByRole('button', { name: /Turn Undead \(2 targets\)/ }));

    const sentPrompt = savePromptService.sendSavePrompt.mock.calls[0][1];

    window.dispatchEvent(
      new CustomEvent('save-result', {
        detail: { promptId: sentPrompt.promptId, targetName: 'Player Ally', success: true },
      })
    );

    await waitFor(() => {
      const turnUndeadEvent = customEvents.find(e => e.type === 'turn-undead-result');
      expect(turnUndeadEvent).toBeUndefined();
    });

    window.dispatchEvent = originalDispatch;
  });
});
