import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
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
  const utilsMock = {
    guid: vi.fn(() => 'test-guid'),
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
import { setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../../../services/ui/logService.js';

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

function getModalChecks(container) {
  return within(container).queryAllByRole('checkbox');
}

function getCheckboxByCreature(container, creatureName) {
  const checkboxes = getModalChecks(container);
  return checkboxes.find(cb =>
    cb.closest('label')?.textContent.includes(creatureName)
  );
}

function findTurnUndeadEvent(events) {
  return events.find(e => e.type === 'turn-undead-result');
}

// ── Tests ──

describe('SetConditionModal - Turn Undead', () => {
  let originalDispatch;

  beforeEach(() => {
    originalDispatch = window.dispatchEvent.bind(window);
    vi.spyOn(window, 'dispatchEvent').mockImplementation((event) => originalDispatch(event));
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
    savePromptService.sendSavePrompt.mockReturnValue({ promptId: 'test-prompt-id' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Target eligibility ──

  it('only shows undead creatures as eligible targets for Turn Undead', () => {
    const { container } = render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);

    const checkboxes = getModalChecks(container);
    expect(checkboxes).toHaveLength(3);

    expect(getCheckboxByCreature(container, 'Skeleton A')).toBeInTheDocument();
    expect(getCheckboxByCreature(container, 'Zombie B')).toBeInTheDocument();
    expect(getCheckboxByCreature(container, 'Player Ally')).toBeInTheDocument();
    expect(getCheckboxByCreature(container, 'Goblin C')).toBeUndefined();
  });

  it('does NOT filter by undead type for non-Turn Undead features', () => {
    const { container } = render(<SetConditionModal {...makeProps({ featureName: 'Abjure Foes' })} />);

    const checkboxes = getModalChecks(container);
    expect(checkboxes).toHaveLength(4);

    expect(getCheckboxByCreature(container, 'Skeleton A')).toBeInTheDocument();
    expect(getCheckboxByCreature(container, 'Zombie B')).toBeInTheDocument();
    expect(getCheckboxByCreature(container, 'Player Ally')).toBeInTheDocument();
    expect(getCheckboxByCreature(container, 'Goblin C')).toBeInTheDocument();
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

    const { container } = render(<SetConditionModal {...makeProps({
      featureName: 'Turn Undead',
      combatSummary: noUndeadCombatSummary,
      monsters: noUndeadMonsters,
    })} />);

    expect(screen.getByText('No undead creatures found within range.')).toBeInTheDocument();
    expect(getModalChecks(container)).toHaveLength(0);
    const applyButton = screen.getByRole('button', { name: /Turn Undead/ });
    expect(applyButton).toBeDisabled();
  });

  // ── CLA-303: EB suffixed names + CD spend ──

  it('CLA-303: makes EB suffixed creatures eligible via monsterType carried at join, excludes dead', () => {
    const combatSummary = {
      creatures: [
        { name: 'Attacker', type: 'player' },
        { name: 'Skeleton 1', type: 'npc', monsterType: 'Undead', currentHp: 13, maxHp: 13 },
        { name: 'Zombie 1', type: 'npc', monsterType: 'Undead', currentHp: 15, maxHp: 15 },
        { name: 'Thug 1', type: 'npc', monsterType: 'Humanoid', currentHp: 15, maxHp: 15 },
        { name: 'Skeleton 2', type: 'npc', monsterType: 'Undead', currentHp: 0, maxHp: 13 },
      ],
    };

    const { container } = render(<SetConditionModal {...makeProps({
      featureName: 'Turn Undead',
      combatSummary,
      monsters: [],
    })} />);

    expect(getCheckboxByCreature(container, 'Skeleton 1')).toBeInTheDocument();
    expect(getCheckboxByCreature(container, 'Zombie 1')).toBeInTheDocument();
    expect(getCheckboxByCreature(container, 'Thug 1')).toBeUndefined();
    expect(getCheckboxByCreature(container, 'Skeleton 2')).toBeUndefined();
  });

  it('CLA-303: spends 1 Channel Divinity charge on apply and logs the spend', async () => {
    diceRoller.rollD20.mockReturnValue(5);

    const { container } = render(<SetConditionModal {...makeProps({
      featureName: 'Turn Undead',
      channelDivinityCharges: 3,
    })} />);
    fireEvent.click(getCheckboxByCreature(container, 'Skeleton A'));
    fireEvent.click(screen.getByRole('button', { name: /Turn Undead \(1 target\)/ }));

    await waitFor(() => {
      expect(setRuntimeValue).toHaveBeenCalledWith('Attacker', 'channelDivinityCharges', 2, 'test-campaign');
    });
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'ability_use',
      description: expect.stringContaining('spent 1 Channel Divinity charge to use Turn Undead'),
    }));
  });

  it('CLA-303: unlimited maxTargets renders without a numeric cap', () => {
    render(<SetConditionModal {...makeProps({
      featureName: 'Turn Undead',
      maxTargets: Infinity,
    })} />);
    expect(screen.getByText(/Targets selected: 0\/3 \(all undead in range\)/)).toBeInTheDocument();
  });

  // ── turn-undead-result event dispatch ──

  it.each`
    description              | targetsToSelect              | expectedRolls      | expectedFailedTargets
    ${'single failed NPC'}   | ${['Skeleton A']}             | ${[5]}             | ${['Skeleton A']}
    ${'multiple failed NPCs'}| ${['Skeleton A', 'Zombie B']} | ${[5, 3]}          | ${['Skeleton A', 'Zombie B']}
  `('dispatches turn-undead-result with $description', async ({ targetsToSelect, expectedRolls, expectedFailedTargets }) => {
    expectedRolls.forEach(roll => diceRoller.rollD20.mockReturnValue(roll));

    const { container } = render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    targetsToSelect.forEach(name => fireEvent.click(getCheckboxByCreature(container, name)));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`Turn Undead \\(${targetsToSelect.length} target`) }));

    await waitFor(() => {
      const turnUndeadEvent = findTurnUndeadEvent(window.dispatchEvent.mock.calls.map(c => c[0]));
      expect(turnUndeadEvent).toBeDefined();
      const detail = turnUndeadEvent.detail;
      expectedFailedTargets.forEach(t => expect(detail.failedTargets).toContain(t));
      expect(detail.attackerName).toBe('Attacker');
      expect(detail.saveDc).toBe(14);
      expect(detail.saveType).toBe('WIS');
      expect(detail.campaignName).toBe('test-campaign');
    });
  });

  it('does NOT dispatch turn-undead-result when all targets succeed', async () => {
    diceRoller.rollD20.mockReturnValue(20);

    const { container } = render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(getCheckboxByCreature(container, 'Skeleton A'));
    fireEvent.click(screen.getByRole('button', { name: /Turn Undead \(1 target\)/ }));

    await waitFor(() => {
      const turnUndeadEvent = findTurnUndeadEvent(window.dispatchEvent.mock.calls.map(c => c[0]));
      expect(turnUndeadEvent).toBeUndefined();
    });
  });

  // ── Player save resolution ──

  it('dispatches turn-undead-result after player save fails, including the player in failed targets', async () => {
    diceRoller.rollD20.mockReturnValue(5);

    const { container } = render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(getCheckboxByCreature(container, 'Skeleton A'));
    fireEvent.click(getCheckboxByCreature(container, 'Player Ally'));
    fireEvent.click(screen.getByRole('button', { name: /Turn Undead \(2 targets\)/ }));

    const sentPrompt = savePromptService.sendSavePrompt.mock.calls[0][1];

    window.dispatchEvent(
      new CustomEvent('save-result', {
        detail: { promptId: sentPrompt.promptId, targetName: 'Player Ally', success: false },
      })
    );

    await waitFor(() => {
      const turnUndeadEvent = findTurnUndeadEvent(window.dispatchEvent.mock.calls.map(c => c[0]));
      expect(turnUndeadEvent).toBeDefined();
      const detail = turnUndeadEvent.detail;
      expect(detail.failedTargets).toContain('Skeleton A');
      expect(detail.failedTargets).toContain('Player Ally');
    });
  });

  it('calls sendSavePrompt with correct parameters for player targets', async () => {
    diceRoller.rollD20.mockReturnValue(5);

    const { container } = render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    fireEvent.click(getCheckboxByCreature(container, 'Skeleton A'));
    fireEvent.click(getCheckboxByCreature(container, 'Player Ally'));
    fireEvent.click(screen.getByRole('button', { name: /Turn Undead \(2 targets\)/ }));

    expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith(
      'test-campaign',
      expect.objectContaining({
        targetName: 'Player Ally',
        saveType: 'WIS',
        saveDc: 14,
        sourceName: 'Attacker',
        condition: 'frightened',
      })
    );
  });
});
