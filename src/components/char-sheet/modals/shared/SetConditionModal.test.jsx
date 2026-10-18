// @maintained-by-ai
// Lane: SetConditionModal base render / selection / confirm — header & instruction text,
// target rows & counter, NPC auto-roll vs player-prompt result rows, and save-result
// resolution. Side effects (immunity denial, Channel Divinity spend, roll/condition/expiry
// log payloads) live in SetConditionModal.sideEffects.test.jsx; Turn Undead eligibility and
// events live in SetConditionModal.turnUndead.test.jsx; base-component filtering, listener
// lifecycle, and renderTargetList internals live in AreaEffectTargetModalBase.*.test.jsx.
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

// Checkbox order follows combatSummary minus the attacker: [Goblin A, Goblin B, Player Ally]
function selectTargets(...indexes) {
  const checkboxes = screen.getAllByRole('checkbox');
  indexes.forEach(i => fireEvent.click(checkboxes[i]));
}

function confirm(feature = 'Abjure Foes', count = 1) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`${feature} \\(${count} targets?\\)`) }));
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

  // ── Render / instruction text ──

  it.each([
    { label: 'defaults', props: {}, name: 'Abjure Foes', saveType: 'WIS', condition: 'Frightened', range: 60 },
    {
      label: 'custom props',
      props: { featureName: 'Nature\'s Wrath', conditionName: 'restrained', saveType: 'STR', rangeFeet: 15 },
      name: 'Nature\'s Wrath', saveType: 'STR', condition: 'Restrained', range: 15,
    },
  ])('renders header and instruction line with $label', ({ props, name, saveType, condition, range }) => {
    render(<SetConditionModal {...makeProps(props)} />);
    expect(screen.getByText(name)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`within ${range} feet`))).toBeInTheDocument();
    expect(screen.getByText(saveType)).toBeInTheDocument();
    expect(screen.getByText(/\(DC 14\)/)).toBeInTheDocument();
    expect(screen.getByText(condition)).toBeInTheDocument();
  });

  it('renders one checked-off row with name and type per non-attacker target', () => {
    render(<SetConditionModal {...makeProps()} />);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getByText('Goblin A')).toBeInTheDocument();
    expect(screen.getByText('Goblin B')).toBeInTheDocument();
    expect(screen.getByText('Player Ally')).toBeInTheDocument();
    expect(screen.getAllByText('(npc)')).toHaveLength(2);
    expect(screen.getAllByText('(player)')).toHaveLength(1);
    expect(screen.queryByText(/Attacker/)).not.toBeInTheDocument();
  });

  it('shows no-valid-targets and a disabled confirm when combatSummary is missing', () => {
    render(<SetConditionModal {...makeProps({ combatSummary: null })} />);
    expect(screen.getByText(/No valid targets in range/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Abjure Foes \(0 targets\)/ })).toBeDisabled();
  });

  it('wires mapData/rangeFeet to target filtering: in-range kept, out-of-range dropped', () => {
    const summary = {
      creatures: [
        { name: 'Attacker', type: 'player' },
        { name: 'Near Goblin', type: 'npc', conditions: [] },
        { name: 'Far Goblin', type: 'npc', conditions: [] },
      ],
    };
    // Filter order: Near Goblin asked first, Far Goblin second.
    rangeValidation.getDistanceFeet
      .mockReturnValueOnce(5)
      .mockReturnValueOnce(141);
    render(<SetConditionModal {...makeProps({
      combatSummary: summary,
      mapData: { players: [{ name: 'Near Goblin', gridX: 1, gridY: 1 }, { name: 'Far Goblin', gridX: 20, gridY: 20 }], placedItems: [] },
      rangeFeet: 30,
    })} />);
    expect(screen.getByText('Near Goblin')).toBeInTheDocument();
    expect(screen.queryByText('Far Goblin')).not.toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
  });

  // ── Selection ──

  it('updates the target counter as targets are toggled', () => {
    render(<SetConditionModal {...makeProps()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    checkboxes.forEach(cb => fireEvent.click(cb));
    checkboxes.forEach(cb => expect(cb).toBeChecked());
    expect(screen.getByText(/Targets selected: 3\/3/)).toBeInTheDocument();
    fireEvent.click(checkboxes[0]);
    expect(screen.getByText(/Targets selected: 2\/3/)).toBeInTheDocument();
  });

  it('disables confirm until a target is selected, and the 0-target confirm is inert', () => {
    render(<SetConditionModal {...makeProps()} />);
    const btn = screen.getByRole('button', { name: /Abjure Foes \(0 targets\)/ });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(diceRoller.rollD20).not.toHaveBeenCalled();
    expect(savePromptService.sendSavePrompt).not.toHaveBeenCalled();
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
    expect(screen.queryByText(/Resolving WIS/)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ })).toBeEnabled();
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(<SetConditionModal {...makeProps({ onClose })} />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Confirm — NPC auto-roll results ──

  it.each([
    { roll: 14, success: true, row: 'Saved — unaffected' },   // exactly DC 14 — saves
    { roll: 5, success: false, row: 'Failed — Frightened!' },
  ])('auto-rolls NPC save: roll $roll vs DC 14 shows "$row" and omits +0', ({ roll, success, row }) => {
    diceRoller.rollD20.mockReturnValue(roll);

    render(<SetConditionModal {...makeProps()} />);
    selectTargets(0); // Goblin A, no save bonus
    confirm();

    expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'Goblin A', expect.objectContaining({
      success, roll, total: roll, saveBonus: 0,
    }));
    expect(screen.getByText(/Resolving WIS saving throws \(DC 14\)/)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(`${row} \\(Roll: ${roll} = ${roll}\\)`))).toBeInTheDocument();
    expect(screen.queryByText(/\+0/)).not.toBeInTheDocument();

    // Runtime write only happens for failed saves.
    if (success) {
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    } else {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Goblin A', 'activeConditions', ['frightened'], 'test-campaign');
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Goblin A', 'activeConditionMeta', { frightened: { dc: 14, ability: 'WIS' } }, 'test-campaign');
    }
  });

  it('rolls each selected NPC independently and shows per-target result rows', () => {
    diceRoller.rollD20.mockReturnValueOnce(5).mockReturnValueOnce(20);

    render(<SetConditionModal {...makeProps()} />);
    selectTargets(0, 1);
    confirm('Abjure Foes', 2);

    expect(diceRoller.rollD20).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/Failed — Frightened! \(Roll: 5 = 5\)/)).toBeInTheDocument();
    expect(screen.getByText(/Saved — unaffected \(Roll: 20 \+2 = 22\)/)).toBeInTheDocument();
    expect(screen.getByText(/All targets resolved/)).toBeInTheDocument();
  });

  it('uses STR save bonuses (lowercase keys) and Restrained for Nature\'s Wrath', () => {
    const natureSummary = {
      creatures: [
        { name: 'Attacker', type: 'player' },
        { name: 'Goblin A', type: 'npc', conditions: [], saveBonuses: { str: 3 } },
      ],
    };
    diceRoller.rollD20.mockReturnValue(10);

    render(<SetConditionModal {...makeProps({ combatSummary: natureSummary, featureName: 'Nature\'s Wrath', conditionName: 'restrained', saveType: 'STR' })} />);
    selectTargets(0);
    confirm('Nature\'s Wrath');

    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'Goblin A', expect.objectContaining({
      success: false, roll: 10, total: 13, saveBonus: 3,
    }));
    expect(screen.getByText(/Failed — Restrained! \(Roll: 10 \+3 = 13\)/)).toBeInTheDocument();
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Goblin A', 'activeConditions', ['restrained'], 'test-campaign');
  });

  it('shows both conditions in the label when additionalCondition is set', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps({ conditionName: 'frightened', additionalCondition: 'blinded' })} />);
    expect(screen.getByText('Frightened & Blinded')).toBeInTheDocument(); // instruction bold label
    selectTargets(0);
    confirm();

    expect(screen.getByText(/Failed — Frightened & Blinded!/)).toBeInTheDocument();
  });

  // ── Confirm — player prompts ──

  it('prompts player targets without rolling dice', () => {
    render(<SetConditionModal {...makeProps()} />);
    selectTargets(2); // Player Ally
    confirm();

    expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      promptId: expect.any(String),
      targetName: 'Player Ally',
      saveType: 'WIS',
      saveDc: 14,
      sourceName: 'Attacker',
      condition: 'frightened',
    }));
    expect(diceRoller.rollD20).not.toHaveBeenCalled();
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
    expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument();
  });

  it('shows resolved NPC rows and pending player prompts together on mixed selection', () => {
    diceRoller.rollD20.mockReturnValue(5);

    render(<SetConditionModal {...makeProps()} />);
    selectTargets(0, 2); // Goblin A (NPC) + Player Ally
    confirm('Abjure Foes', 2);

    expect(screen.getByText(/Failed — Frightened!/)).toBeInTheDocument();
    expect(screen.getByText(/Waiting for save roll/)).toBeInTheDocument();
    expect(screen.queryByText('Done')).not.toBeInTheDocument(); // not resolved while a prompt is pending
  });

  it('resolves player prompts: failed save writes the condition, successful save writes nothing', async () => {
    const view = render(<SetConditionModal {...makeProps()} />);
    selectTargets(2);
    confirm();
    const failedPromptId = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: failedPromptId, targetName: 'Player Ally', success: false, total: 8, roll: 8, saveBonus: 0 },
    }));

    await waitFor(() => expect(screen.queryByText(/Waiting for save roll/)).not.toBeInTheDocument());
    expect(screen.getByText(/Failed — Frightened!/)).toBeInTheDocument();
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith('Player Ally', 'activeConditions', ['frightened'], 'test-campaign');
    view.unmount();

    // Positive-leg-gated denial: same prompt flow, save succeeds → no condition write.
    vi.clearAllMocks();
    render(<SetConditionModal {...makeProps()} />);
    selectTargets(2);
    confirm();
    const savedPromptId = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;

    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: savedPromptId, targetName: 'Player Ally', success: true, total: 15, roll: 15, saveBonus: 0 },
    }));

    await waitFor(() => expect(screen.getByText(/Saved — unaffected/)).toBeInTheDocument());
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('shows Done once every NPC result and player prompt has resolved, and Done closes the modal', async () => {
    diceRoller.rollD20.mockReturnValue(5);
    const onClose = vi.fn();

    render(<SetConditionModal {...makeProps({ onClose })} />);
    selectTargets(0, 2);
    confirm('Abjure Foes', 2);

    const promptId = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId, targetName: 'Player Ally', success: false, total: 8, roll: 8, saveBonus: 0 },
    }));

    await waitFor(() => expect(screen.getByText('Done')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
