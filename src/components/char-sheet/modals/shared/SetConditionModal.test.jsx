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
  };
  return { default: utilsMock };
});

vi.mock('../../../../services/ui/storage.js', () => ({
  default: { set: vi.fn() },
}));

// ── Re-import mocked modules ──
import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../../services/rules/effects/expirations.js';
import * as logService from '../../../../services/ui/logService.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as automationService from '../../../../services/combat/automation/automationService.js';
import * as rangeValidation from '../../../../services/rules/combat/rangeValidation.js';

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

describe('SetConditionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Render / initial state ──

  it('renders the modal overlay and header with default feature name', () => {
    render(<SetConditionModal {...makeProps()} />);
    expect(screen.getByText('Abjure Foes')).toBeInTheDocument();
  });

  it('renders the modal overlay and header with custom feature name', () => {
    render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    expect(screen.getByText('Turn Undead')).toBeInTheDocument();
  });

  it('shows instructions with WIS save reference and DC info by default', () => {
    render(<SetConditionModal {...makeProps()} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/WIS/);
    expect(bodyDiv.textContent).toMatch(/DC 14/);
  });

  it('shows custom save type, condition, and range via props', () => {
    render(<SetConditionModal {...makeProps({ featureName: 'Nature\'s Wrath', conditionName: 'restrained', saveType: 'STR', rangeFeet: 15 })} />);
    expect(screen.getByText("Nature's Wrath")).toBeInTheDocument();
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/STR/);
    expect(bodyDiv.textContent).toMatch(/Restrained/);
    expect(bodyDiv.textContent).toMatch(/15 feet/);
  });

  it('shows Frightened condition warning by default', () => {
    render(<SetConditionModal {...makeProps()} />);
    expect(screen.getByText(/Frightened/)).toBeInTheDocument();
  });

  it('displays eligible target names but not the attacker', () => {
    render(<SetConditionModal {...makeProps()} />);
    expect(screen.queryByText(/Goblin A/)).toBeInTheDocument();
    expect(screen.queryByText(/Goblin B/)).toBeInTheDocument();
    expect(screen.queryByText(/Player Ally/)).toBeInTheDocument();
    expect(screen.queryByText(/Attacker/)).not.toBeInTheDocument();
  });

  it('renders checkboxes for each eligible target', () => {
    render(<SetConditionModal {...makeProps()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
  });

  it('shows target selection counter starting at 0', () => {
    render(<SetConditionModal {...makeProps()} />);
    expect(screen.getByText(/Targets selected: 0\/3/)).toBeInTheDocument();
  });

  // ── Edge cases for eligible targets ──

  it('shows "No valid targets" when combatSummary has no creatures', () => {
    const emptyProps = makeProps({ combatSummary: {} });
    render(<SetConditionModal {...emptyProps} />);
    expect(screen.getByText(/No valid targets in range/)).toBeInTheDocument();
  });

  it('shows "No valid targets" when combatSummary is null', () => {
    const nullProps = makeProps({ combatSummary: null });
    render(<SetConditionModal {...nullProps} />);
    expect(screen.getByText(/No valid targets in range/)).toBeInTheDocument();
  });

  it('excludes attacker from eligible targets', () => {
    const onlyAttackerSummary = { creatures: [{ name: 'Attacker', type: 'player' }] };
    const props = makeProps({ combatSummary: onlyAttackerSummary });
    render(<SetConditionModal {...props} />);
    expect(screen.getByText(/No valid targets in range/)).toBeInTheDocument();
  });

  it('excludes targets beyond range when mapData is provided', () => {
    const farAwaySummary = {
      creatures: [
        { name: 'Attacker', type: 'player' },
        { name: 'Distant Goblin', type: 'npc', conditions: [] },
      ],
    };
    const farAwayPos = { gridX: 20, gridY: 20 };
    rangeValidation.getDistanceFeet.mockReturnValue(141);
    const props = makeProps({
      combatSummary: farAwaySummary,
      mapData: { players: [{ name: 'Attacker', gridX: 0, gridY: 0 }, { name: 'Distant Goblin', gridX: 20, gridY: 20 }], placedItems: [] },
      attackerPos: farAwayPos,
      rangeFeet: 30,
    });
    render(<SetConditionModal {...props} />);
    expect(screen.getByText(/No valid targets in range/)).toBeInTheDocument();
  });

  it('includes targets within range when mapData is provided', () => {
    const nearbySummary = {
      creatures: [
        { name: 'Attacker', type: 'player' },
        { name: 'Near Goblin', type: 'npc', conditions: [] },
      ],
    };
    const nearbyPos = { gridX: 1, gridY: 1 };
    rangeValidation.getDistanceFeet.mockReturnValue(5);
    const props = makeProps({
      combatSummary: nearbySummary,
      mapData: { players: [{ name: 'Attacker', gridX: 0, gridY: 0 }, { name: 'Near Goblin', gridX: 1, gridY: 1 }], placedItems: [] },
      attackerPos: nearbyPos,
      rangeFeet: 30,
    });
    render(<SetConditionModal {...props} />);
    expect(screen.getByText(/Near Goblin/)).toBeInTheDocument();
  });

  // ── Checkbox interactions ──

  it('toggles target selection on checkbox click', () => {
    render(<SetConditionModal {...makeProps()} />);
    const checkbox = screen.getAllByRole('checkbox')[0];
    expect(checkbox.checked).toBe(false);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('deselects target on second click', () => {
    render(<SetConditionModal {...makeProps()} />);
    const checkbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(checkbox);
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('allows selecting all targets', () => {
    render(<SetConditionModal {...makeProps()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => fireEvent.click(cb));
    checkboxes.forEach(cb => expect(cb.checked).toBe(true));
  });

  it('updates target counter when targets selected', () => {
    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByText(/Targets selected: 1\/3/)).toBeInTheDocument();
  });

  it('updates target counter after deselecting a target', () => {
    render(<SetConditionModal {...makeProps()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => fireEvent.click(cb));
    expect(screen.getByText(/Targets selected: 3\/3/)).toBeInTheDocument();
    checkboxes[0].click();
    expect(screen.getByText(/Targets selected: 2\/3/)).toBeInTheDocument();
  });

  // ── Apply button behavior ──

  it('disables apply button when no targets selected', () => {
    render(<SetConditionModal {...makeProps()} />);
    const btn = screen.getByRole('button', { name: /Abjure Foes \(0 targets\)/ });
    expect(btn.disabled).toBe(true);
  });

  it('enables apply button after selecting a target', () => {
    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    const btn = screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ });
    expect(btn.disabled).toBe(false);
  });

  it('shows singular "target" when count is 1', () => {
    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ })).toBeInTheDocument();
  });

  it('shows plural "targets" when count exceeds 1', () => {
    render(<SetConditionModal {...makeProps()} />);
    const boxes = screen.getAllByRole('checkbox');
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    expect(screen.getByRole('button', { name: /Abjure Foes \(2 targets\)/ })).toBeInTheDocument();
  });

  it('disables apply button when all targets are filtered out by range', () => {
    const noTargetsSummary = { creatures: [{ name: 'Attacker', type: 'player' }] };
    const props = makeProps({ combatSummary: noTargetsSummary });
    render(<SetConditionModal {...props} />);
    const btn = screen.getByRole('button', { name: /Abjure Foes \(0 targets\)/ });
    expect(btn.disabled).toBe(true);
  });

  // ── Cancel and close ──

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<SetConditionModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking the overlay background', () => {
    const onClose = vi.fn();
    render(<SetConditionModal {...makeProps({ onClose })} />);
    const overlay = document.querySelector('.sp-overlay');
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT close when clicking inside the modal body', () => {
    const onClose = vi.fn();
    render(<SetConditionModal {...makeProps({ onClose })} />);
    const modal = document.querySelector('.sp-modal');
    fireEvent.click(modal);
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── Confirm flow — NPC saves (auto-roll) ──

  it('rolls NPC save and shows processing state on confirm', () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(savePromptService.sendSaveResult).toHaveBeenCalled();
    expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/Resolving WIS saving throws/);
  });

  it('NPC succeeds when roll total >= saveDc', () => {
    diceRoller.rollD20.mockReturnValue(14);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(screen.getByText(/Saved — unaffected/)).toBeInTheDocument();
  });

  it('NPC fails and shows Frightened when roll < DC', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(screen.getByText(/Failed — Frightened!/)).toBeInTheDocument();
  });

  it('NPC failure calls turn expiration tracking', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(expirations.addExpiration).toHaveBeenCalled();
  });

  it('NPC success does not call setRuntimeValue for conditions', () => {
    diceRoller.rollD20.mockReturnValue(20);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('NPC failure with bonus shows correct total in roll display', () => {
    diceRoller.rollD20.mockReturnValue(10); // roll=10 saveBonus=2 → total=12 < 14 → fail

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(screen.getByText(/\(Roll: 10 \+2 = 12\)/)).toBeInTheDocument();
  });

  it('NPC success with bonus shows correct total in roll display', () => {
    diceRoller.rollD20.mockReturnValue(14); // roll=14 + 2 = 16 >= 14 → success

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(screen.getByText(/\(Roll: 14 \+2 = 16\)/)).toBeInTheDocument();
  });

  it('uses saveBonus of 0 when creature has no saveBonuses', () => {
    diceRoller.rollD20.mockReturnValue(10);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith(
      'test-campaign',
      'Goblin A',
      expect.objectContaining({ total: 10, saveBonus: 0 })
    );
  });

  it('does not show roll result when bonus is 0', () => {
    diceRoller.rollD20.mockReturnValue(10);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    // Goblin A has no saveBonuses, so the roll display should not include "+0"
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).not.toMatch(/\+0/);
  });

  it('rolls all selected NPCs independently', () => {
    diceRoller.rollD20.mockReturnValueOnce(5).mockReturnValueOnce(20);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getAllByRole('checkbox')[1]); // Goblin B
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(2 targets\)/ }));

    expect(diceRoller.rollD20).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Failed — Frightened!/)).toBeInTheDocument();
    expect(screen.getByText(/Saved — unaffected/)).toBeInTheDocument();
  });

  // ── Nature's Wrath: STR saves, Restrained ──

  it('uses STR save bonuses for Nature\'s Wrath', () => {
    const natureSummary = {
      creatures: [
        { name: 'Attacker', type: 'player' },
        { name: 'Goblin A', type: 'npc', conditions: [], saveBonuses: { str: 3 } },
      ],
    };
    diceRoller.rollD20.mockReturnValue(10);

    render(<SetConditionModal {...makeProps({ combatSummary: natureSummary, featureName: 'Nature\'s Wrath', conditionName: 'restrained', saveType: 'STR' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Nature's Wrath \(1 target\)/ }));

    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith(
      'test-campaign',
      'Goblin A',
      expect.objectContaining({ total: 13, saveBonus: 3 })
    );
  });

  it('shows Restrained condition for Nature\'s Wrath on save failure', () => {
    const natureSummary = {
      creatures: [
        { name: 'Attacker', type: 'player' },
        { name: 'Goblin A', type: 'npc', conditions: [] },
      ],
    };
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps({ combatSummary: natureSummary, featureName: 'Nature\'s Wrath', conditionName: 'restrained', saveType: 'STR' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Nature's Wrath \(1 target\)/ }));

    expect(screen.getByText(/Failed — Restrained!/)).toBeInTheDocument();
  });

  // ── Confirm flow — Player saves (prompt-based) ──

  it('sends save prompt for player creature on confirm', () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(savePromptService.sendSavePrompt).toHaveBeenCalled();
  });

  it('does not roll dice for player targets', () => {
    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally only
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(diceRoller.rollD20).not.toHaveBeenCalled();
    expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument();
  });

  // ── Confirm flow — mixed NPC and Player selection ──

  it('shows both NPC results and pending player prompts', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A (NPC)
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(2 targets\)/ }));

    expect(screen.getByText(/Failed — Frightened!/)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument();
  });

  // ── Player save result event handling ──

  it('resolves pending prompt when save-result event arrives', async () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const sentPrompt = savePromptService.sendSavePrompt.mock.calls[0][1];
    window.dispatchEvent(
      new CustomEvent('save-result', {
        detail: { promptId: sentPrompt.promptId, targetName: 'Player Ally', success: true, total: 18, roll: 14, saveBonus: 4 },
      })
    );

    await waitFor(() => {
      expect(screen.queryByText(/Waiting for save roll/)).not.toBeInTheDocument();
    });
  });

  it('applies condition when player save fails via event', async () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const sentPrompt = savePromptService.sendSavePrompt.mock.calls[0][1];
    window.dispatchEvent(
      new CustomEvent('save-result', {
        detail: { promptId: sentPrompt.promptId, targetName: 'Player Ally', success: false, total: 8, roll: 8, saveBonus: 0 },
      })
    );

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalled();
    });
  });

  it('does not apply condition when player save succeeds via event', async () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const sentPrompt = savePromptService.sendSavePrompt.mock.calls[0][1];
    window.dispatchEvent(
      new CustomEvent('save-result', {
        detail: { promptId: sentPrompt.promptId, targetName: 'Player Ally', success: true, total: 20, roll: 16, saveBonus: 4 },
      })
    );

    await waitFor(() => {
      expect(screen.queryByText(/Waiting for save roll/)).not.toBeInTheDocument();
    });
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('ignores save-result event with unknown promptId', async () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // NPC
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    window.dispatchEvent(
      new CustomEvent('save-result', {
        detail: { promptId: 'nonexistent-id', targetName: 'Unknown', success: false },
      })
    );

    await waitFor(() => {
      expect(screen.getByText(/Failed — Frightened!/)).toBeInTheDocument();
      expect(screen.queryByText(/Unknown/)).not.toBeInTheDocument();
    });
  });

  it('shows "All targets resolved" when everything is processed', async () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // NPC
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(2 targets\)/ }));

    const sentPrompt = savePromptService.sendSavePrompt.mock.calls[0][1];
    window.dispatchEvent(
      new CustomEvent('save-result', {
        detail: { promptId: sentPrompt.promptId, targetName: 'Player Ally', success: false },
      })
    );

    await waitFor(() => {
      expect(screen.getByText(/All targets resolved/)).toBeInTheDocument();
    });
  });

  it('shows Done button when all targets resolved', async () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // NPC
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(2 targets\)/ }));

    const sentPrompt = savePromptService.sendSavePrompt.mock.calls[0][1];
    window.dispatchEvent(
      new CustomEvent('save-result', { detail: { promptId: sentPrompt.promptId, targetName: 'Player Ally', success: false } })
    );

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  it('calls onClose when Done button is clicked', async () => {
    diceRoller.rollD20.mockReturnValue(5);
    const onClose = vi.fn();

    render(<SetConditionModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // NPC
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(2 targets\)/ }));

    const sentPrompt = savePromptService.sendSavePrompt.mock.calls[0][1];
    window.dispatchEvent(
      new CustomEvent('save-result', { detail: { promptId: sentPrompt.promptId, targetName: 'Player Ally', success: true } })
    );

    await waitFor(() => {
      expect(screen.getByText('Done')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not show Done button while pending prompts remain', () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player only → pending
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });

  // ── Additional condition support ──

  it('shows both conditions when additionalCondition is provided', () => {
    render(<SetConditionModal {...makeProps({ conditionName: 'frightened', additionalCondition: 'blinded' })} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/Frightened/);
    expect(bodyDiv.textContent).toMatch(/Blinded/);
  });

  it('shows both conditions on NPC failure when additionalCondition is provided', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps({ conditionName: 'frightened', additionalCondition: 'blinded' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(screen.getByText(/Failed — Frightened & Blinded!/)).toBeInTheDocument();
  });

  it('calls addExpiration with both conditions on NPC failure', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps({ conditionName: 'frightened', additionalCondition: 'blinded' })} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(expirations.addExpiration).toHaveBeenCalledWith(
      'Attacker',
      'Goblin A',
      expect.arrayContaining([
        expect.objectContaining({ type: 'frightened' }),
        expect.objectContaining({ type: 'blinded' }),
      ]),
      'test-campaign',
      undefined
    );
  });

  // ── Custom range in instruction text ──

  it('shows custom range in instruction text', () => {
    render(<SetConditionModal {...makeProps({ rangeFeet: 15 })} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/15 feet/);
  });

  // ── Side-effects on confirm ──

  it('persists combatSummary after confirm via storage mock', () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // NPC
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(savePromptService.sendSaveResult).toHaveBeenCalled();
  });

  it('logs roll entry for NPC target via addEntry service', () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(logService.addEntry).toHaveBeenCalled();
  });

  it('calls fetch for condition logging when NPC save fails', () => {
    diceRoller.rollD20.mockReturnValue(5); // fail

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A no bonuses
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const conditionCall = logService.addEntry.mock.calls.find(call => call[1]?.type === 'condition');
    expect(conditionCall).toBeDefined();
  });

  it('does not log condition for NPC save success', () => {
    diceRoller.rollD20.mockReturnValue(20); // auto-success

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // Goblin A
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    const conditionCall = logService.addEntry.mock.calls.find(call => call[1]?.type === 'condition');
    expect(conditionCall).toBeUndefined();
  });

  // ── Edge case: confirm with no targets selected is a no-op ──

  it('is a no-op when clicking confirm with no targets selected', () => {
    render(<SetConditionModal {...makeProps()} />);
    const btn = screen.getByRole('button', { name: /Abjure Foes \(0 targets\)/ });
    fireEvent.click(btn);

    expect(diceRoller.rollD20).not.toHaveBeenCalled();
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
    expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();
    expect(screen.queryByText(/Resolving WIS/)).not.toBeInTheDocument();
  });

  // ── Cleanup of event listener on unmount ──

  it('does not throw after unmount when save-result fires', () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(() => {
      window.dispatchEvent(
        new CustomEvent('save-result', { detail: { promptId: 'nonexistent' } })
      );
    }).not.toThrow();
  });

  // ── Only NPC targets selected → resolved immediately (no pending) ──

  it('shows resolved state with only NPC targets and no pending prompts', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]); // NPC only
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(screen.queryByText(/Waiting for save roll/)).not.toBeInTheDocument();
  });

  // ── Target type labels rendered correctly ──

  it('renders npc and player type labels', () => {
    render(<SetConditionModal {...makeProps()} />);
    const npcLabels = screen.getAllByText(/npc/);
    expect(npcLabels.length).toBeGreaterThanOrEqual(1);

    const playerLabels = screen.getAllByText(/player/);
    expect(playerLabels.length).toBeGreaterThanOrEqual(1);
  });

  // ── Immunity handling ──

  it('skips immune player targets and does not apply condition', async () => {
    automationService.playerIsImmuneToCondition.mockReturnValue(true);
    diceRoller.rollD20.mockReturnValue(15);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(savePromptService.sendSavePrompt).toHaveBeenCalled();
  });

  // ── Duration rounds display ──

  it('shows duration in instruction text when durationRounds is provided', () => {
    render(<SetConditionModal {...makeProps({ durationRounds: 3 })} />);
    const bodyDiv = document.querySelector('.sp-body');
    expect(bodyDiv.textContent).toMatch(/for 1 minute/);
  });
});
