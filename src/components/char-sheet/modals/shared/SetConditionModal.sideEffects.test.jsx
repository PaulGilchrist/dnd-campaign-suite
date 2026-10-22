// @maintained-by-ai
// Lane: SetConditionModal side effects only — immunity denial, Channel Divinity
// charge spend, and the roll/condition/expiration log seams. Render, target
// filtering, and Turn Undead behavior live in the sibling test files.
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

// Apply seam mocked so denial vs application is observable at the modal boundary;
// addCondition internals are pinned in the conditionSaveService suites.
vi.mock('../../../../services/combat/conditions/conditionSaveService.js', () => ({
  addCondition: vi.fn(),
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
import * as expirations from '../../../../services/rules/effects/expirations.js';
import * as conditionSaveService from '../../../../services/combat/conditions/conditionSaveService.js';

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
function selectAndConfirm(index) {
  fireEvent.click(screen.getAllByRole('checkbox')[index]);
  fireEvent.click(screen.getByRole('button', { name: /Abjure Foes \(1 target\)/ }));
}

const entriesOf = (type) =>
  logService.addEntry.mock.calls.map(call => call[1]).filter(e => e?.type === type);

const chargeWrites = () =>
  useRuntimeState.setRuntimeValue.mock.calls.filter(call => call[1] === 'channelDivinityCharges');

// ── Tests ──

describe('SetConditionModal - Side Effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Immunity denial on the player-prompt seam ──

  it('denies the condition to an immune player but applies it to a non-immune control', async () => {
    automationService.playerIsImmuneToCondition.mockReturnValue(true);
    const characters = [{ name: 'Player Ally', computedStats: { name: 'Player Ally' } }];

    const view = render(<SetConditionModal {...makeProps({ characters })} />);
    selectAndConfirm(2); // Player Ally goes through the prompt lane — no auto-roll

    expect(savePromptService.sendSavePrompt).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      promptId: expect.any(String),
      targetName: 'Player Ally',
      saveType: 'WIS',
      saveDc: 14,
      sourceName: 'Attacker',
      condition: 'frightened',
    }));
    const promptId = savePromptService.sendSavePrompt.mock.calls[0][1].promptId;
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId, targetName: 'Player Ally', success: false, total: 8, roll: 8, saveBonus: 0 },
    }));

    // The prompt fully resolves…
    await waitFor(() => expect(screen.queryByText(/Waiting for save roll/)).not.toBeInTheDocument());
    // …yet immunity means the condition never reaches the apply seam.
    expect(conditionSaveService.addCondition).not.toHaveBeenCalled();
    // Denied conditions mint no ledger: no expiration clock, no 'applied' log —
    // only the honest immunity advisory (phantom pin, bug ledger SetConditionModal:144-147).
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(entriesOf('condition')).toHaveLength(0);
    expect(logService.addEntry.mock.calls.map(c => c[1]).filter(e => e?.action === 'applied')).toHaveLength(0);
    expect(logService.addEntry).toHaveBeenCalledWith('test-campaign', {
      type: 'automation',
      automationType: 'condition_immune_advisory',
      characterName: 'Player Ally',
      sourceName: 'Attacker',
      abilityName: 'Abjure Foes',
      description: 'Player Ally failed WIS save against Abjure Foes but is immune to Frightened — condition not applied.',
      timestamp: expect.any(Number),
    });
    view.unmount();

    // Positive leg gating the denial above: same failed prompt, not immune → applied once.
    vi.clearAllMocks();
    automationService.playerIsImmuneToCondition.mockReturnValue(false);
    render(<SetConditionModal {...makeProps({ characters })} />);
    selectAndConfirm(2);
    window.dispatchEvent(new CustomEvent('save-result', {
      detail: { promptId: savePromptService.sendSavePrompt.mock.calls[0][1].promptId, targetName: 'Player Ally', success: false, total: 8, roll: 8, saveBonus: 0 },
    }));

    await waitFor(() => expect(conditionSaveService.addCondition).toHaveBeenCalledTimes(1));
    expect(conditionSaveService.addCondition).toHaveBeenCalledWith(expect.objectContaining({
      creatureName: 'Player Ally',
      conditionDef: { key: 'frightened', label: 'Frightened' },
      dc: 14,
      ability: 'WIS',
      campaignName: 'test-campaign',
    }));
    // Applied leg keeps the full ledger: one expiration clock, one 'applied' log, no advisory.
    expect(expirations.addExpiration).toHaveBeenCalledTimes(1);
    expect(expirations.addExpiration).toHaveBeenCalledWith(expect.objectContaining({
      attackerName: 'Attacker',
      targetName: 'Player Ally',
      effects: [{ type: 'frightened', condition: 'frightened' }],
    }));
    const appliedLogs = entriesOf('condition');
    expect(appliedLogs).toHaveLength(1);
    expect(appliedLogs[0]).toEqual(expect.objectContaining({
      action: 'applied',
      characterName: 'Player Ally',
      condition: 'Frightened',
      dc: 14,
      sourceName: 'Attacker',
    }));
    expect(entriesOf('automation')).toHaveLength(0);
  });

  // ── Channel Divinity charge spend ──

  it('spends exactly one Channel Divinity charge with a spend log, and writes nothing when the prop is absent', () => {
    diceRoller.rollD20.mockReturnValue(15); // Goblin A saves — the charge write is the only side effect

    const view = render(<SetConditionModal {...makeProps({ channelDivinityCharges: 3 })} />);
    selectAndConfirm(0);

    expect(chargeWrites()).toEqual([['Attacker', 'channelDivinityCharges', 2, 'test-campaign']]);
    const abilityLogs = entriesOf('ability_use');
    expect(abilityLogs).toHaveLength(1);
    expect(abilityLogs[0]).toEqual(expect.objectContaining({
      characterName: 'Attacker',
      abilityName: 'Abjure Foes',
      description: expect.stringContaining('Channel Divinity: 2 remaining'),
    }));
    view.unmount();

    // Positive-leg-gated absence: no charge prop → no charge write, no spend log.
    vi.clearAllMocks();
    diceRoller.rollD20.mockReturnValue(15);
    render(<SetConditionModal {...makeProps()} />);
    selectAndConfirm(0);
    expect(chargeWrites()).toHaveLength(0);
    expect(entriesOf('ability_use')).toHaveLength(0);
  });

  // ── NPC auto-roll seam: roll log, application, expiry rounds, condition log ──

  it.each([
    {
      label: 'flat failure (no save bonus)',
      target: 'Goblin A', targetIdx: 0, roll: 10, bonus: 0, additionalCondition: null,
      applied: [{ key: 'frightened', label: 'Frightened' }],
    },
    {
      label: 'failure with +2 and an additional condition',
      target: 'Goblin B', targetIdx: 1, roll: 5, bonus: 2, additionalCondition: 'blinded',
      applied: [{ key: 'frightened', label: 'Frightened' }, { key: 'blinded', label: 'Blinded' }],
    },
    {
      label: 'success with +2 applies nothing',
      target: 'Goblin B', targetIdx: 1, roll: 13, bonus: 2, additionalCondition: null,
      applied: [],
    },
  ])('logs and applies on $label', ({ target, targetIdx, roll, bonus, additionalCondition, applied }) => {
    diceRoller.rollD20.mockReturnValue(roll);
    const total = roll + bonus;
    const saved = total >= 14;

    render(<SetConditionModal {...makeProps({ additionalCondition, durationRounds: 4 })} />);
    selectAndConfirm(targetIdx);

    expect(diceRoller.rollD20).toHaveBeenCalledTimes(1);
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', target, expect.objectContaining({
      success: saved,
      roll,
      total,
      saveBonus: bonus,
    }));

    // Honest roll log: formula reflects the lowercase-keyed saveBonuses fold ({wis} → +2 / +0 omitted).
    const rollLogs = entriesOf('roll');
    expect(rollLogs).toHaveLength(1);
    expect(rollLogs[0]).toEqual(expect.objectContaining({
      type: 'roll',
      rollType: 'save-damage',
      saveDc: 14,
      saveType: 'WIS',
      characterName: 'Attacker',
      targetName: target,
      formula: `1d20${bonus !== 0 ? '+' + bonus : ''}`,
      bonus,
      total,
      saveResult: saved ? 'success' : 'failure',
    }));

    // Apply + expiry + condition log fire exactly for the failed saves.
    expect(conditionSaveService.addCondition.mock.calls.map(c => [c[0].creatureName, c[0].conditionDef.key, c[0].dc]))
      .toEqual(applied.map(a => [target, a.key, 14]));

    const conditionLogs = entriesOf('condition');
    if (applied.length > 0) {
      expect(expirations.addExpiration).toHaveBeenCalledTimes(1);
      expect(expirations.addExpiration).toHaveBeenCalledWith(expect.objectContaining({
        attackerName: 'Attacker',
        targetName: target,
        rounds: 4,
        effects: expect.arrayContaining(applied.map(a => expect.objectContaining({ type: a.key }))),
      }));
      expect(expirations.addExpiration.mock.calls[0][0].effects).toHaveLength(applied.length);
      expect(conditionLogs).toHaveLength(1);
      expect(conditionLogs[0]).toEqual(expect.objectContaining({
        action: 'applied',
        characterName: target,
        condition: applied.map(a => a.label).join(' & '),
        dc: 14,
        sourceName: 'Attacker',
      }));
    } else {
      expect(expirations.addExpiration).not.toHaveBeenCalled();
      expect(conditionLogs).toHaveLength(0);
    }
  });
});
