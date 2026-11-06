// @maintained-by-ai
// DivineSparkModal — dismiss-softlock regression (bug 2026-11-05). The Harm
// branch parks the modal on the `save-result` window event; a GM Dismiss on
// the un-rolled save prompt never dispatches one (dismiss doctrine — a
// dismissed save never resolves), which used to strand the modal at
// "Rolling…" with ZERO buttons (both Cancel and Done are hidden while
// `rolling === true && !result`) until a page reload. The queue now broadcasts
// a dedicated `save-dismissed` event and the modal opts in: it must refuse via
// the existing refuse() helper (divine_spark_refused automation log row +
// refusal result view with a working Done button).
// Harness mirrors DivineSparkModal.test.jsx (same mocked seams, unique
// per-arming promptIds keep leaked listeners inert).

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DivineSparkModal from './DivineSparkModal.jsx';

const { combatContext, promptSeq } = vi.hoisted(() => ({
  combatContext: Object.freeze({
    creatures: [
      Object.freeze({ name: 'Orc Warrior', type: 'npc', currentHp: 20, maxHp: 40 }),
    ],
  }),
  promptSeq: { n: 0 },
}));

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
  logHealingToSSE: vi.fn(),
}));

vi.mock('../../../../services/automation/common/savePrompt.js', () => ({
  // save-dismissed sweep (2026-11-05): components under test may now import the shared dismissal log helper.
  logSaveDismissed: vi.fn(() => Promise.resolve()),
  createSaveListener: vi.fn(() => ({ promptId: `test-prompt-${++promptSeq.n}` })),
}));

vi.mock('../../../../services/combat/auras/coronaAuraUtils.js', () => ({
  getCoronaSaveDisadvantage: vi.fn(async () => ({ disadvantage: false })),
}));

vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(async () => combatContext),
}));

vi.mock('../../../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(async (cs, targetName, rawDamage) => ({
    finalDamage: rawDamage,
    oldHp: 20,
    newHp: Math.max(0, 20 - rawDamage),
  })),
}));

vi.mock('../../../../services/rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => true),
}));

// Pay-at-CONFIRM: the modal writes the charge decrement itself; pin the seam.
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
}));

import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as automationService from '../../../../services/combat/automation/automationService.js';
import * as logService from '../../../../services/ui/logService.js';
import * as savePrompt from '../../../../services/automation/common/savePrompt.js';
import * as applyDamage from '../../../../services/rules/combat/applyDamage.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';

const baseProps = Object.freeze({
  featureName: 'Divine Spark',
  attackerName: 'Paladin1',
  targetName: 'Orc Warrior',
  campaignName: 'test-campaign',
  healExpression: '2d8',
  damageExpression: '3d6',
  damageTypes: Object.freeze(['Radiant']),
  saveType: 'CON',
  wisModifier: 3,
  channelDivinityCharges: 2,
  playerStats: Object.freeze({ name: 'Paladin1', level: 3, proficiency: 2, hitPoints: 40 }),
});

function renderModal(overrides = {}) {
  return render(<DivineSparkModal {...baseProps} onClose={vi.fn()} {...overrides} />);
}

const harmBtn = () => screen.getByRole('button', { name: 'Harm (3d6 Radiant, CON save)' });

function lastPromptId() {
  const results = savePrompt.createSaveListener.mock.results;
  expect(results, 'test dispatched before the modal armed a prompt').not.toHaveLength(0);
  return results[results.length - 1].value.promptId;
}

async function armHarmPrompt() {
  fireEvent.click(harmBtn());
  await waitFor(() => {
    expect(screen.getByText(/Rolling/i)).toBeInTheDocument();
  });
  // Let the async corona await settle so the listener is registered.
  await waitFor(() => {
    expect(savePrompt.createSaveListener).toHaveBeenCalled();
  });
}

function dispatch(name, overrides = {}) {
  window.dispatchEvent(new CustomEvent(name, {
    detail: { promptId: lastPromptId(), ...overrides },
  }));
}

const rollCalls = () => logService.addEntry.mock.calls.filter((c) => c[1]?.type === 'roll');
const refusalCalls = () => logService.addEntry.mock.calls.filter(
  (c) => c[1]?.automationDetail === 'divine_spark_refused'
);

describe('DivineSparkModal — dismissed save prompt', () => {
  beforeEach(() => {
    diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [4, 6], modifier: 0 });
    automationService.hasHealingMaximization.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('a matching save-dismissed refuses the cast: result view with reason + working Done, no damage, refusal log row', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await armHarmPrompt();

    dispatch('save-dismissed', { targetName: 'Orc Warrior' });

    // Modal escapes "Rolling…" and shows the refusal with a Done button —
    // the softlock was exactly this state (zero buttons, forever).
    await waitFor(() => {
      expect(screen.queryByText(/Rolling/i)).not.toBeInTheDocument();
    });
    expect(screen.getByText('save was dismissed — no damage dealt')).toBeInTheDocument();

    // Header-freeze regression (2026-11-06): the charge was legitimately spent
    // at harm-confirm, so the after-spend refusal view must show the
    // decremented count (2 charges → spent → 1), never the open-time value.
    expect(screen.getByText('1 charge remaining')).toBeInTheDocument();
    expect(screen.queryByText('2 charges remaining')).not.toBeInTheDocument();

    const done = screen.getByRole('button', { name: 'Done' });
    fireEvent.click(done);
    expect(onClose).toHaveBeenCalledTimes(1);

    // Refusal is logged (divine_spark_refused) and no damage/roll row fires.
    expect(refusalCalls()).toHaveLength(1);
    expect(refusalCalls()[0][1]).toMatchObject({
      type: 'automation',
      characterName: 'Paladin1',
      abilityName: 'Divine Spark',
      automationDetail: 'divine_spark_refused',
      reason: 'save was dismissed — no damage dealt',
    });
    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    expect(rollCalls()).toHaveLength(0);
    // Pay-at-confirm (criterion 6): the charge was legitimately spent at
    // harm-confirm BEFORE the prompt; Dismiss must keep it spent exactly once
    // — the refusal row adds no further decrement.
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
    expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
      'Paladin1', 'channelDivinityCharges', 1, 'test-campaign',
    );
  });

  it('a save-dismissed for a different promptId stays inert (mismatch guard)', async () => {
    renderModal();
    await armHarmPrompt();

    window.dispatchEvent(new CustomEvent('save-dismissed', {
      detail: { promptId: 'not-my-prompt' },
    }));

    expect(screen.getByText(/Rolling/i)).toBeInTheDocument();
    expect(refusalCalls()).toHaveLength(0);
  });

  it('dismissed handling is single-shot: a late save-result for the same promptId never applies damage', async () => {
    renderModal();
    await armHarmPrompt();

    dispatch('save-dismissed');
    await waitFor(() => {
      expect(screen.getByText('save was dismissed — no damage dealt')).toBeInTheDocument();
    });

    dispatch('save-result', { success: false, total: 5, roll: 3, saveBonus: 2 });

    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    expect(rollCalls()).toHaveLength(0);
    expect(screen.getByText('save was dismissed — no damage dealt')).toBeInTheDocument();
  });

  it('a normally-resolved save removes the dismissed listener: a trailing save-dismissed cannot overwrite the harm result', async () => {
    renderModal();
    await armHarmPrompt();

    dispatch('save-result', { success: false, total: 5, roll: 3, saveBonus: 2 });
    await waitFor(() => {
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalled();
    });

    dispatch('save-dismissed');

    expect(refusalCalls()).toHaveLength(0);
    // Harm result survives untouched: no refusal copy, Done still closes.
    expect(screen.queryByText('save was dismissed — no damage dealt')).not.toBeInTheDocument();
    expect(rollCalls()).toHaveLength(1);
  });
});
