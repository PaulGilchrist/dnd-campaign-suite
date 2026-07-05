// @cleaned-by-ai
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
    { name: 'Skeleton A', type: 'npc', conditions: [] },
    { name: 'Zombie B', type: 'npc', conditions: [], saveBonuses: { wis: 2 } },
    { name: 'Player Ally', type: 'player' },
    { name: 'Goblin C', type: 'npc', conditions: [] },
  ],
};

const mockMonsters = [
  { name: 'Skeleton A', type: 'Undead' },
  { name: 'Zombie B', type: 'undead' },
  { name: 'Goblin C', type: 'Humanoid' },
  { name: 'Player Ally', type: 'Undead' },
];

const mockAttackerPos = { gridX: 0, gridY: 0 };

function makeProps(overrides) {
  return {
    combatSummary: mockCombatSummary,
    attackerName: 'Attacker',
    attackerPos: mockAttackerPos,
    saveDc: 14,
    campaignName: 'test-campaign',
    mapData: null,
    monsters: mockMonsters,
    onClose: vi.fn(),
    ...(overrides || {}),
  };
}

function interceptTurnUndeadEvents(props) {
  const customEvents = [];
  const originalDispatch = window.dispatchEvent.bind(window);
  window.dispatchEvent = (event) => {
    customEvents.push(event);
    return originalDispatch(event);
  };
  render(<SetConditionModal {...props} />);
  return { customEvents, restore: () => { window.dispatchEvent = originalDispatch; } };
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

  // ── Target eligibility ──

  it('only shows undead creatures as eligible targets for Turn Undead', () => {
    render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);

    const labels = checkboxes.map(cb => cb.nextSibling?.textContent);
    expect(labels).toContain('Skeleton A');
    expect(labels).toContain('Zombie B');
    expect(labels).toContain('Player Ally');
    expect(labels).not.toContain('Goblin C');
  });

  it('does NOT filter by undead type for non-Turn Undead features', () => {
    render(<SetConditionModal {...makeProps({ featureName: 'Abjure Foes' })} />);

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(4);

    const labels = checkboxes.map(cb => cb.nextSibling?.textContent);
    expect(labels).toContain('Skeleton A');
    expect(labels).toContain('Zombie B');
    expect(labels).toContain('Player Ally');
    expect(labels).toContain('Goblin C');
  });

  it('shows no undead message and disabled button when no undead exist', () => {
    const noUndeadCombatSummary = {
      creatures: [
        { name: 'Attacker', type: 'player' },
        { name: 'Goblin A', type: 'npc', conditions: [] },
      ],
    };
    const noUndeadMonsters = [
      { name: 'Goblin A', type: 'Humanoid' },
    ];

    render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead', combatSummary: noUndeadCombatSummary, monsters: noUndeadMonsters })} />);

    expect(screen.getByText('No undead creatures found within range.')).toBeInTheDocument();
    const checkboxes = screen.queryAllByRole('checkbox');
    expect(checkboxes).toHaveLength(0);
    const applyButton = screen.getByRole('button', { name: /Turn Undead/ });
    expect(applyButton).toBeDisabled();
  });

  // ── turn-undead-result event dispatch ──

  it('dispatches turn-undead-result with single failed target', async () => {
    diceRoller.rollD20.mockReturnValue(5);

    const { customEvents, restore } = interceptTurnUndeadEvents(makeProps({ featureName: 'Turn Undead' }));

    render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Skeleton A
    fireEvent.click(screen.getByRole('button', { name: /Turn Undead \(1 target\)/ }));

    await waitFor(() => {
      const turnUndeadEvent = customEvents.find(e => e.type === 'turn-undead-result');
      expect(turnUndeadEvent).toBeDefined();
      expect(turnUndeadEvent.detail.failedTargets).toContain('Skeleton A');
      expect(turnUndeadEvent.detail.attackerName).toBe('Attacker');
      expect(turnUndeadEvent.detail.saveDc).toBe(14);
      expect(turnUndeadEvent.detail.saveType).toBe('WIS');
      expect(turnUndeadEvent.detail.campaignName).toBe('test-campaign');
    });

    restore();
  });

  it('dispatches turn-undead-result with multiple failed targets', async () => {
    diceRoller.rollD20.mockReturnValueOnce(5).mockReturnValueOnce(3);

    const { customEvents, restore } = interceptTurnUndeadEvents(makeProps({ featureName: 'Turn Undead' }));

    render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Skeleton A
    fireEvent.click(screen.getAllByRole('checkbox')[1]); // Zombie B
    fireEvent.click(screen.getByRole('button', { name: /Turn Undead \(2 targets\)/ }));

    await waitFor(() => {
      const turnUndeadEvent = customEvents.find(e => e.type === 'turn-undead-result');
      expect(turnUndeadEvent).toBeDefined();
      expect(turnUndeadEvent.detail.failedTargets).toContain('Skeleton A');
      expect(turnUndeadEvent.detail.failedTargets).toContain('Zombie B');
      expect(turnUndeadEvent.detail.failedTargets).toHaveLength(2);
    });

    restore();
  });

  it('does NOT dispatch turn-undead-result when all targets succeed', async () => {
    diceRoller.rollD20.mockReturnValue(20);

    const { customEvents, restore } = interceptTurnUndeadEvents(makeProps({ featureName: 'Turn Undead' }));

    render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Skeleton A
    fireEvent.click(screen.getByRole('button', { name: /Turn Undead \(1 target\)/ }));

    await waitFor(() => {
      const turnUndeadEvent = customEvents.find(e => e.type === 'turn-undead-result');
      expect(turnUndeadEvent).toBeUndefined();
    });

    restore();
  });

  it('does NOT dispatch turn-undead-result when feature name does not include "turn undead"', async () => {
    diceRoller.rollD20.mockReturnValue(5);

    const { customEvents, restore } = interceptTurnUndeadEvents(makeProps({ featureName: 'Abjure Foes' }));

    render(<SetConditionModal {...makeProps({ featureName: 'Abjure Foes' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[4]); // Goblin C
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    await waitFor(() => {
      const turnUndeadEvent = customEvents.find(e => e.type === 'turn-undead-result');
      expect(turnUndeadEvent).toBeUndefined();
    });

    restore();
  });

  // ── Player save resolution ──

  it('dispatches turn-undead-result after player save resolves with failure', async () => {
    diceRoller.rollD20.mockReturnValue(5);

    const { customEvents, restore } = interceptTurnUndeadEvents(makeProps({ featureName: 'Turn Undead' }));

    render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Skeleton A (undead)
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
      expect(turnUndeadEvent.detail.failedTargets).toContain('Skeleton A');
      expect(turnUndeadEvent.detail.failedTargets).toContain('Player Ally');
    });

    restore();
  });

  it('does NOT dispatch turn-undead-result if player save succeeds', async () => {
    diceRoller.rollD20.mockReturnValue(5);

    const { customEvents, restore } = interceptTurnUndeadEvents(makeProps({ featureName: 'Turn Undead' }));

    render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Skeleton A (undead)
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

    restore();
  });
});
