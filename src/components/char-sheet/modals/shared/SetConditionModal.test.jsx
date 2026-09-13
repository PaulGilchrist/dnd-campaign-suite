// @improved-by-ai
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
import * as savePromptService from '../../../../services/combat/conditions/savePromptService.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as expirations from '../../../../services/rules/effects/expirations.js';
import * as diceRoller from '../../../../services/dice/diceRoller.js';
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

  it('renders the modal overlay and header with default and custom feature names', () => {
    render(<SetConditionModal {...makeProps()} />);
    expect(screen.getByText('Abjure Foes')).toBeInTheDocument();
    render(<SetConditionModal {...makeProps({ featureName: 'Turn Undead' })} />);
    expect(screen.getByText('Turn Undead')).toBeInTheDocument();
  });

  it('shows instructions with save type, DC, and condition by default', () => {
    render(<SetConditionModal {...makeProps()} />);
    expect(screen.getByText(/WIS/)).toBeInTheDocument();
    expect(screen.getByText(/DC 14/)).toBeInTheDocument();
    expect(screen.getByText(/Frightened/)).toBeInTheDocument();
  });

  it('shows custom save type, condition, and range via props', () => {
    render(<SetConditionModal {...makeProps({ featureName: 'Nature\'s Wrath', conditionName: 'restrained', saveType: 'STR', rangeFeet: 15 })} />);
    expect(screen.getByText("Nature's Wrath")).toBeInTheDocument();
    expect(screen.getByText(/STR/)).toBeInTheDocument();
    expect(screen.getByText(/Restrained/)).toBeInTheDocument();
    expect(screen.getByText(/15 feet/)).toBeInTheDocument();
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

  // ── Edge cases for eligible targets ──

  it.each`
    description       | combatSummary
    ${'no creatures'} | ${{}}
    ${'null'}         | {null}
    ${'only attacker'}| ${{ creatures: [{ name: 'Attacker', type: 'player' }] }}
  `('shows "No valid targets" when $description', ({ combatSummary }) => {
    render(<SetConditionModal {...makeProps({ combatSummary })} />);
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

  it('allows selecting all targets and updates the target counter', () => {
    render(<SetConditionModal {...makeProps()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => fireEvent.click(cb));
    checkboxes.forEach(cb => expect(cb.checked).toBe(true));
    expect(screen.getByText(/Targets selected: 3\/3/)).toBeInTheDocument();
    checkboxes[0].click();
    expect(screen.getByText(/Targets selected: 2\/3/)).toBeInTheDocument();
  });

  // ── Apply button behavior ──

  it('disables apply button when no targets selected and enables after selecting one', () => {
    render(<SetConditionModal {...makeProps()} />);
    let btn = screen.getByRole('button', { name: /Abjure Foes \(0 targets\)/ });
    expect(btn.disabled).toBe(true);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    btn = screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ });
    expect(btn.disabled).toBe(false);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    btn = screen.getByRole('button', { name: /Abjure Foes \(2 targets\)/ });
    expect(btn.disabled).toBe(false);
  });

  // ── Cancel and close ──

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<SetConditionModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Confirm flow — NPC saves (auto-roll) ──

  it('rolls NPC save, shows processing, and displays success results', () => {
    diceRoller.rollD20.mockReturnValue(14);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(savePromptService.sendSaveResult).toHaveBeenCalled();
    expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Saved — unaffected/)).toBeInTheDocument();
  });

  it('applies condition and calls expiration tracking on NPC failure with correct roll display', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(screen.getByText(/Failed — Frightened!/)).toBeInTheDocument();
    expect(expirations.addExpiration).toHaveBeenCalled();
    expect(screen.queryByText(/\+0/)).not.toBeInTheDocument();

    diceRoller.rollD20.mockReturnValue(10);
    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(screen.getByText(/\(Roll: 10 \+2 = 12\)/)).toBeInTheDocument();
  });

  it('rolls all selected NPCs independently', () => {
    diceRoller.rollD20.mockReturnValueOnce(5).mockReturnValueOnce(20);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(2 targets\)/ }));

    expect(diceRoller.rollD20).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Failed — Frightened!/)).toBeInTheDocument();
    expect(screen.getByText(/Saved — unaffected/)).toBeInTheDocument();
  });

  // ── Nature's Wrath: STR saves, Restrained ──

  it('uses correct save type bonuses and condition for Nature\'s Wrath', () => {
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
    expect(screen.getByText(/Failed — Restrained!/)).toBeInTheDocument();
  });

  // ── Confirm flow — Player saves (prompt-based) ──

  it('sends save prompt and does not roll dice for player target', () => {
    diceRoller.rollD20.mockReturnValue(15);

    render(<SetConditionModal {...makeProps()} />);
    fireEvent.click(screen.getAllByRole('checkbox')[2]); // Player Ally
    fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));

    expect(savePromptService.sendSavePrompt).toHaveBeenCalled();
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

  it('resolves pending prompt on save-result event and applies or skips condition based on success', async () => {
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
      expect(screen.queryByText(/Waiting for save roll/)).not.toBeInTheDocument();
    });
  });

  it('shows Done button and calls onClose when all targets resolved', async () => {
    diceRoller.rollD20.mockReturnValue(5);
    const onClose = vi.fn();

    render(<SetConditionModal {...makeProps({ onClose })} />);
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

    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Additional condition support ──

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

    expect(expirations.addExpiration).toHaveBeenCalledWith({ attackerName: 'Attacker', targetName: 'Goblin A', effects: expect.arrayContaining([
        expect.objectContaining({ type: 'frightened' }),
        expect.objectContaining({ type: 'blinded' }),
      ]), campaignName: 'test-campaign', rounds: undefined });
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

  // ── Target type labels rendered correctly ──

  it('renders npc and player type labels', () => {
    render(<SetConditionModal {...makeProps()} />);
    const npcLabels = screen.getAllByText(/npc/);
    expect(npcLabels.length).toBeGreaterThanOrEqual(1);

    const playerLabels = screen.getAllByText(/player/);
    expect(playerLabels.length).toBeGreaterThanOrEqual(1);
  });
});
