// @maintained-by-ai 2026-11-27 — divine spark heal/harm chooser modal surface lane
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DivineSparkModal from './DivineSparkModal.jsx';

// ── Ownership ──
// This file owns the heal/harm choice modal UI in isolation: verbatim header
// (charge readout incl. singular grammar and non-numeric-prop omission),
// prompt line, and button labels; damage-type radio gating and selection flow
// through every channel; the roll→range→choke-point seams emitting EXACT args
// (identity-pinned frozen combatContext into applyHealingToTarget/
// applyDamageToTarget); the full-shape save prompt payload (CLA-092 damage
// transport, CLA-063 corona disadvantage flag); save-DC derivation (real
// proficiency read, sheet spell save DC wins); pay-at-CONFIRM charge economy
// (exactly one decrement write + exact ability_use row + header countdown per
// confirm; zero-spend witnesses on every abort/refusal/Cancel lane); the
// save-result listener lifecycle (promptId match, single-shot, detail
// defaults); exact result-view text; Done/Cancel close lanes; overlay
// inertness. The component holds all display state locally and only WRITEs
// the Channel Divinity decrement through the mocked runtime-store seam.
// useOverlayEntranceFocus is intentionally REAL (not mocked): its capture/
// pull/stranded-restore tier is benign UI focus behavior with a single 0ms
// restore timer and no game-state effect.
// Deferred to owners:
// - DivineSparkModal.save-dismissed.test.jsx — the save-dismissed refusal
//   lane (matching/mismatched promptId, both-direction listener detach,
//   post-dismiss decremented header).
// - CharActionModals.SecondaryModals.jsx render site (+ its
//   secondary-targets/async-confirm-handlers tests, which mock this component)
//   — onClose → setModalState({ divineSparkModal: null }) wiring.
// - useCharActionsAutomation.js simpleModal('divineSparkModal') — open state
//   seeding of healExpression/damageExpression/saveType/wisModifier props.
// - divineSparkHandler.js — the automation lane that launches this modal.
// - savePrompt.js createSaveListener / applyHealing.js / applyDamage.js /
//   healingRoll.js internals — SSE broadcast, real HP writes, resistance
//   resolution; consumed here only as mocked seams with exact-arg pins.

// ── Hoisted fixtures ──
// Frozen so the identity pins below prove the component forwards the SAME
// combat-context object from getCombatContext to the heal/damage choke
// points, unmutated. Roll results are destructured by the component, so
// their identity is not observable — freezing guards fixture integrity only.
// promptSeq makes every createSaveListener arming mint a UNIQUE promptId so
// leaked listeners from earlier harm clicks (defect 4) stay inert via the
// component's promptId-mismatch guard — and dispatch helpers below pin the
// id actually handed to the component rather than hardcoding one.
const { combatContext, promptSeq } = vi.hoisted(() => ({
  combatContext: Object.freeze({
    creatures: [
      Object.freeze({ name: 'Orc Warrior', type: 'npc', currentHp: 20, maxHp: 40 }),
    ],
  }),
  promptSeq: { n: 0 },
}));

// ── Mocked modules ──
// Factory keys audited against the component's CURRENT import list (12
// modules; the 11 service seams below are mocked, useOverlayEntranceFocus is
// real): every imported name has a key, and no factory carries a key the
// component never imports — the old savePrompt factory exported a phantom
// `logSaveDismissed` (imported nowhere in this tree) that was purged here.

vi.mock('../../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../../../services/combat/automation/automationService.js', () => ({
  hasHealingMaximization: vi.fn(),
}));

vi.mock('../../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));

vi.mock('../../../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(),
}));

vi.mock('../../../../services/combat/auras/coronaAuraUtils.js', () => ({
  getCoronaSaveDisadvantage: vi.fn(),
}));

// CLA-092: canonical choke points — clamping heal + typed damage application mocks.
vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../../../services/rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

// Pay-at-CONFIRM (2026-11-05): the modal now writes the Channel Divinity
// decrement to the runtime store itself — pin the write through the mock.
vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  setRuntimeValue: vi.fn(),
}));

// ── Re-import mocked modules ──

import * as diceRoller from '../../../../services/dice/diceRoller.js';
import * as automationService from '../../../../services/combat/automation/automationService.js';
import * as logService from '../../../../services/ui/logService.js';
import * as healingRoll from '../../../../services/automation/common/healingRoll.js';
import * as savePrompt from '../../../../services/automation/common/savePrompt.js';
import * as corona from '../../../../services/combat/auras/coronaAuraUtils.js';
import * as damageUtils from '../../../../services/rules/combat/damageUtils.js';
import * as applyHealing from '../../../../services/rules/combat/applyHealing.js';
import * as applyDamage from '../../../../services/rules/combat/applyDamage.js';
import * as rangeCheck from '../../../../services/rules/combat/rangeCheck.js';
import * as useRuntimeState from '../../../../hooks/runtime/useRuntimeState.js';

// ── Fixtures & helpers ──

const defaultPlayerStats = Object.freeze({ name: 'Paladin1', level: 3, proficiency: 2, hitPoints: 40 });

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
  playerStats: defaultPlayerStats,
});

// Fresh onClose per call — no cross-test mock residue.
function makeProps(overrides = {}) {
  return { ...baseProps, onClose: vi.fn(), ...overrides };
}

function renderModal(overrides) {
  return render(<DivineSparkModal {...makeProps(overrides)} />);
}

const healBtn = () => screen.getByRole('button', { name: 'Heal (2d8)' });
const harmBtn = () => screen.getByRole('button', { name: 'Harm (3d6 Radiant, CON save)' });

// Result paragraphs interleave <strong> children, which split getByText's
// default per-element text — pin the EXACT full line via textContent.
function paragraphWithText(text) {
  return screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === text);
}

function lastPromptId() {
  const results = savePrompt.createSaveListener.mock.results;
  expect(results, 'test dispatched a save-result before the modal armed a prompt').not.toHaveLength(0);
  return results[results.length - 1].value.promptId;
}

// Pin the promptId the component was actually issued (unique per arming —
// see promptSeq) rather than a hardcoded constant.
function dispatchSaveResult(success, overrides = {}) {
  return new CustomEvent('save-result', {
    detail: {
      promptId: lastPromptId(),
      success,
      total: success ? 8 : 5,
      roll: success ? 6 : 3,
      saveBonus: overrides.saveBonus ?? 2,
      ...overrides,
    },
  });
}

function findLogEntry(type, calls = logService.addEntry.mock.calls) {
  return calls.find((call) => call[1].type === type);
}

const spendCalls = () => logService.addEntry.mock.calls.filter((c) => c[1]?.type === 'ability_use');
const rollCalls = () => logService.addEntry.mock.calls.filter((c) => c[1]?.type === 'roll');

// NOTE — flagged product defects (divine-lane audit), NOT fixed here:
// 1. Dead guard: handleHarm's `damageTypes.length > 1 && !damageType` can
//    never fire — damageType initialises to damageTypes[0] || 'Radiant' and
//    the radio onChange only ever sets non-empty strings.
// 2. Dead branch: DivineSparkResultView's `(Maximized)` suffix never renders
//    — handleHeal's setResult omits the `maximized` flag (pinned below).
// 3. Unguarded awaits: handleHeal/handleHarm await isWithinRange and
//    getCombatContext with no try/catch — a rejection leaves the modal stuck
//    on "Rolling..." forever (Cancel is not rendered while mode/rolling are
//    set). Same for applyHarmDamage inside the save-result listener: the
//    listener is already removed, so a rejection there strands the UI.
// 4. Listener leak: the window 'save-result'/'save-dismissed' listeners have
//    no unmount cleanup — closing the modal with a pending prompt leaves them
//    armed. Tests survive this only because the unique-per-arming promptId
//    makes leaked listeners inert via the mismatch guard (see promptSeq).
// 5. Formula defect: `'+' + event.detail.saveBonus` with an undefined bonus
//    logs '1d20+undefined' (pinned below; fix: `?? 0`).
// 6. Heal/harm roll dice BEFORE the 30 ft range check — refused actions
//    still consume a roll (pinned in the refusal tests).

// ── Tests ──

describe('DivineSparkModal', () => {
  beforeEach(() => {
    // Re-baseline EVERY overridable stub on entry: mockReset drops leftover
    // mockReturnValueOnce queues, then each stub's baseline is re-stamped
    // explicitly (clearAllMocks would keep stale mockReturnValue overrides).
    for (const fn of [
      diceRoller.rollExpression,
      diceRoller.rollExpressionMaximized,
      automationService.hasHealingMaximization,
      logService.addEntry,
      healingRoll.logHealingToSSE,
      savePrompt.createSaveListener,
      corona.getCoronaSaveDisadvantage,
      damageUtils.getCombatContext,
      applyHealing.applyHealingToTarget,
      applyDamage.applyDamageToTarget,
      rangeCheck.isWithinRange,
      useRuntimeState.setRuntimeValue,
    ]) {
      fn.mockReset();
    }
    diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [4, 6], modifier: 0 });
    diceRoller.rollExpressionMaximized.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0, maximized: true });
    automationService.hasHealingMaximization.mockReturnValue(false);
    logService.addEntry.mockImplementation(() => Promise.resolve());
    savePrompt.createSaveListener.mockImplementation(() => ({ promptId: `test-prompt-${++promptSeq.n}` }));
    corona.getCoronaSaveDisadvantage.mockResolvedValue({ disadvantage: false });
    damageUtils.getCombatContext.mockResolvedValue(combatContext);
    applyHealing.applyHealingToTarget.mockImplementation((cs, targetName, amount) => {
      const creature = cs?.creatures?.find((c) => c.name === targetName);
      const maxHp = creature?.maxHp ?? 40;
      const currentHp = creature?.currentHp ?? 20;
      const newHp = Math.min(maxHp, currentHp + amount);
      return { newHp, oldHp: currentHp, maxHp, actualHeal: newHp - currentHp };
    });
    applyDamage.applyDamageToTarget.mockImplementation(async (cs, targetName, rawDamage) => ({
      finalDamage: rawDamage,
      oldHp: 20,
      newHp: Math.max(0, 20 - rawDamage),
    }));
    rangeCheck.isWithinRange.mockResolvedValue(true);
  });

  // ── Rendering & close lanes ──

  it('renders the overlay, header, prompt line, and enabled Heal/Harm/Cancel exactly', () => {
    renderModal();
    expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    // Header carries the charge readout — split-text: pin via container.
    expect(document.querySelector('.sp-header')).toHaveTextContent('Divine Spark');
    expect(screen.getByText('2 charges remaining')).toBeInTheDocument();
    expect(paragraphWithText('Channel divine energy at Orc Warrior.')).toBeInTheDocument();
    expect(healBtn()).toBeEnabled();
    expect(harmBtn()).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByText(/Rolling/)).not.toBeInTheDocument();
  });

  it.each([
    {
      label: 'multiple damage types',
      damageTypes: Object.freeze(['Radiant', 'Fire']),
      hasRadios: true,
    },
    {
      label: 'a single damage type',
      damageTypes: Object.freeze(['Radiant']),
      hasRadios: false,
    },
  ])('shows radio gating for $label', ({ damageTypes, hasRadios }) => {
    renderModal({ damageTypes });
    if (hasRadios) {
      expect(screen.getAllByRole('radio')).toHaveLength(2);
      expect(screen.getByRole('radio', { name: 'Radiant' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Fire' })).not.toBeChecked();
    } else {
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    }
    // Harm label always names the currently selected type once, not each.
    expect(harmBtn()).toBeInTheDocument();
  });

  it('closes only via Cancel, and Cancel is a full zero-action witness at every seam', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    // Overlay backdrop and modal container clicks stay inert — no close.
    fireEvent.click(document.querySelector('.sp-overlay'));
    fireEvent.click(document.querySelector('.sp-modal'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(diceRoller.rollExpressionMaximized).not.toHaveBeenCalled();
    expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
    expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    expect(corona.getCoronaSaveDisadvantage).not.toHaveBeenCalled();
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
    // Pay-at-confirm: Cancel is the leak this move closes — no spend row,
    // no decrement write.
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  // ── Heal flow ──

  describe('heal seam', () => {
    it('rolls 2d8 once, routes through the canonical choke points with exact args, and renders the exact result lines (CLA-092)', async () => {
      renderModal();

      await act(async () => {
        fireEvent.click(healBtn());
      });

      expect(automationService.hasHealingMaximization).toHaveBeenCalledWith(defaultPlayerStats);
      expect(diceRoller.rollExpression).toHaveBeenCalledTimes(1);
      expect(diceRoller.rollExpression).toHaveBeenCalledWith('2d8');
      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('Paladin1', 'Orc Warrior', 30);
      expect(damageUtils.getCombatContext).toHaveBeenCalledTimes(1);
      expect(damageUtils.getCombatContext).toHaveBeenCalledWith('test-campaign');
      // Identity pin: the exact frozen context object, never the fake-playerStats lane.
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalledTimes(1);
      expect(applyHealing.applyHealingToTarget).toHaveBeenCalledWith(combatContext, 'Orc Warrior', 10, 'test-campaign');
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith('test-campaign', {
        targetName: 'Orc Warrior',
        sourceName: 'Divine Spark',
        actualHeal: 10,
        newHp: 30,
        maxHp: 40,
      });
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(paragraphWithText('Orc Warrior healed for 10 HP.')).toBeInTheDocument();
      expect(screen.getByText('Roll: 2d8 = 10')).toBeInTheDocument();
      expect(screen.getByText('Current HP: 30 / 40 (healed 10)')).toBeInTheDocument();
      expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    });

    it('propagates the clamped choke-point values (not the raw roll) into the SSE row and result view (CLA-092)', async () => {
      applyHealing.applyHealingToTarget.mockImplementationOnce((cs, targetName, amount) => {
        const maxHp = cs.creatures.find((c) => c.name === targetName).maxHp;
        const currentHp = 38;
        const newHp = Math.min(maxHp, currentHp + amount);
        return { newHp, oldHp: currentHp, maxHp, actualHeal: newHp - currentHp };
      });
      renderModal();

      await act(async () => {
        fireEvent.click(healBtn());
      });

      // Roll total 10, clamp leaves actualHeal 2 — both channels must carry
      // the clamped values.
      expect(paragraphWithText('Orc Warrior healed for 10 HP.')).toBeInTheDocument();
      expect(screen.getByText('Current HP: 40 / 40 (healed 2)')).toBeInTheDocument();
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith('test-campaign', {
        targetName: 'Orc Warrior',
        sourceName: 'Divine Spark',
        actualHeal: 2,
        newHp: 40,
        maxHp: 40,
      });
    });

    it('refuses, logs, and spends nothing when the heal choke point returns null', async () => {
      applyHealing.applyHealingToTarget.mockImplementationOnce(() => null);
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      renderModal();

      await act(async () => {
        fireEvent.click(healBtn());
      });

      expect(errorSpy).toHaveBeenCalledWith('[DivineSparkModal] applyHealingToTarget returned null for', 'Orc Warrior');
      expect(paragraphWithText('Orc Warrior was not found in combat — no healing applied.')).toBeInTheDocument();
      expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
      const refusal = findLogEntry('automation');
      expect(refusal).toBeDefined();
      expect(refusal[1]).toEqual({
        type: 'automation',
        characterName: 'Paladin1',
        abilityName: 'Divine Spark',
        automationType: 'divine_spark',
        automationDetail: 'divine_spark_refused',
        reason: 'Orc Warrior was not found in combat — no healing applied.',
        description: 'Divine Spark refused — Orc Warrior was not found in combat — no healing applied.',
        timestamp: expect.any(Number),
      });
      // Zero-spend witness: refusal keeps the charge.
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(spendCalls()).toHaveLength(0);
      errorSpy.mockRestore();
    });

    it('refuses an out-of-range heal before touching combat state and spends nothing (CLA-092)', async () => {
      rangeCheck.isWithinRange.mockResolvedValueOnce(false);
      renderModal();

      await act(async () => {
        fireEvent.click(healBtn());
      });

      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('Paladin1', 'Orc Warrior', 30);
      expect(paragraphWithText('Orc Warrior is out of range for Divine Spark (30 ft).')).toBeInTheDocument();
      expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
      expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
      expect(healingRoll.logHealingToSSE).not.toHaveBeenCalled();
      // NOTE defect 6: the roll is consumed BEFORE the range check — wastes dice on refusal.
      expect(diceRoller.rollExpression).toHaveBeenCalledTimes(1);
      const refusal = findLogEntry('automation');
      expect(refusal).toBeDefined();
      expect(refusal[1]).toEqual({
        type: 'automation',
        characterName: 'Paladin1',
        abilityName: 'Divine Spark',
        automationType: 'divine_spark',
        automationDetail: 'divine_spark_refused',
        reason: 'Orc Warrior is out of range for Divine Spark (30 ft).',
        description: 'Divine Spark refused — Orc Warrior is out of range for Divine Spark (30 ft).',
        timestamp: expect.any(Number),
      });
      // Zero-spend witness: refusal keeps the charge.
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(spendCalls()).toHaveLength(0);
    });

    it('uses the maximized roll when healing maximization applies', async () => {
      automationService.hasHealingMaximization.mockReturnValue(true);
      renderModal();

      await act(async () => {
        fireEvent.click(healBtn());
      });

      expect(diceRoller.rollExpressionMaximized).toHaveBeenCalledTimes(1);
      expect(diceRoller.rollExpressionMaximized).toHaveBeenCalledWith('2d8');
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(paragraphWithText('Orc Warrior healed for 20 HP.')).toBeInTheDocument();
      expect(screen.getByText('Roll: 2d8 = 20')).toBeInTheDocument();
      expect(screen.getByText('Current HP: 40 / 40 (healed 20)')).toBeInTheDocument();
      // NOTE defect 2: the (Maximized) suffix never renders — setResult omits the flag.
      expect(screen.queryByText(/\(Maximized\)/)).not.toBeInTheDocument();
    });
  });

  // ── Roll abort (null roll) ──

  it.each([
    { mode: 'heal', button: 'Heal (2d8)' },
    { mode: 'harm', button: 'Harm (3d6 Radiant, CON save)' },
  ])('aborts $mode with no side effects and zero spend when rollExpression returns null', ({ mode, button }) => {
    diceRoller.rollExpression.mockReturnValue(null);
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: button }));

    expect(diceRoller.rollExpression).toHaveBeenCalledWith(mode === 'heal' ? '2d8' : '3d6');
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
    // Zero-spend witness: the aborted branch never decrements.
    expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(screen.getByText('2 charges remaining')).toBeInTheDocument();
    // Mode resets: action buttons and Cancel are back, no result shown.
    expect(screen.getByRole('button', { name: 'Heal (2d8)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });

  // ── Harm initiation + pay-at-CONFIRM spend ──

  describe('harm seam', () => {
    it('rolls 3d6 once and arms the save prompt with the exact full payload (CLA-092)', async () => {
      renderModal();

      await act(async () => {
        fireEvent.click(harmBtn());
      });

      expect(diceRoller.rollExpression).toHaveBeenCalledTimes(1);
      expect(diceRoller.rollExpression).toHaveBeenCalledWith('3d6');
      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('Paladin1', 'Orc Warrior', 30);
      expect(corona.getCoronaSaveDisadvantage).toHaveBeenCalledWith({
        targetName: 'Orc Warrior',
        damageType: 'Radiant',
        campaignName: 'test-campaign',
      });
      // CLA-063/CLA-092: the prompt payload is the machine-truth channel
      // consumed by SavePromptModal — full shape, no omissions.
      expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
      expect(savePrompt.createSaveListener).toHaveBeenCalledWith('test-campaign', {
        targetName: 'Orc Warrior',
        attackerName: 'Paladin1',
        saveType: 'CON',
        saveDc: 13,
        disadvantage: false,
        sourceName: 'Divine Spark',
        damageFormula: '3d6 Radiant',
        damageType: 'Radiant',
        rawDamage: 10,
      });
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
      expect(diceRoller.rollExpressionMaximized).not.toHaveBeenCalled();
    });

    it('spends atomically at harm confirm: one decrement write, exact ability_use row, header decremented through the Rolling face', async () => {
      renderModal({ channelDivinityCharges: 3 });
      expect(screen.getByText('3 charges remaining')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(harmBtn());
      });

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Paladin1', 'channelDivinityCharges', 2, 'test-campaign',
      );
      // The spend row is atomic with the write and its remaining-tail agrees.
      expect(spendCalls()).toHaveLength(1);
      expect(spendCalls()[0][1]).toEqual({
        type: 'ability_use',
        characterName: 'Paladin1',
        abilityName: 'Divine Spark',
        description: 'Divine Spark (Harm) — targeting Orc Warrior, Radiant damage, CON save DC 13. Channel Divinity: 2 remaining.',
      });
      // Header-freeze regression (2026-11-06 DA): on the harm lane spendCharge
      // is the last statement, so the header must re-render to the decremented
      // count immediately — while the "Rolling…" face is up.
      expect(screen.getByText(/Rolling/i)).toBeInTheDocument();
      expect(screen.getByText('2 charges remaining')).toBeInTheDocument();
      expect(screen.queryByText('3 charges remaining')).not.toBeInTheDocument();
    });

    // CLA-092: never a hardcoded +2 — real proficiency read, sheet DC override.
    // Baseline 8+3+2=13 is already pinned by the full-payload test above; the
    // two legs here pin the two derivation branches uniquely.
    it.each([
      {
        label: 'reads playerStats.proficiency: lv8 WIS +4 PB +3 gets 15, not 14',
        wisModifier: 4,
        playerStats: Object.freeze({ name: 'War_Cleric', level: 8, proficiency: 3 }),
        saveDc: 15,
      },
      {
        label: 'sheet spell save DC wins',
        wisModifier: 4,
        playerStats: Object.freeze({ name: 'War_Cleric', level: 8, proficiency: 3, spellAbilities: { saveDc: 19 } }),
        saveDc: 19,
      },
    ])('arms the prompt with $label', async ({ wisModifier, playerStats, saveDc }) => {
      renderModal({ wisModifier, playerStats });

      await act(async () => {
        fireEvent.click(harmBtn());
      });

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith('test-campaign', {
        targetName: 'Orc Warrior',
        attackerName: 'Paladin1',
        saveType: 'CON',
        saveDc,
        disadvantage: false,
        sourceName: 'Divine Spark',
        damageFormula: '3d6 Radiant',
        damageType: 'Radiant',
        rawDamage: 10,
      });
    });

    // CLA-063: Corona of Light — Radiant/Fire saves vs a sunlit enemy arm
    // with disadvantage on the payload flag.
    it('threads corona sunlight disadvantage onto the save prompt payload (CLA-063)', async () => {
      corona.getCoronaSaveDisadvantage.mockResolvedValue({ disadvantage: true, source: 'War_Cleric' });
      renderModal();

      await act(async () => {
        fireEvent.click(harmBtn());
      });

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith('test-campaign', {
        targetName: 'Orc Warrior',
        attackerName: 'Paladin1',
        saveType: 'CON',
        saveDc: 13,
        disadvantage: true,
        sourceName: 'Divine Spark',
        damageFormula: '3d6 Radiant',
        damageType: 'Radiant',
        rawDamage: 10,
      });
    });

    it('refuses an out-of-range harm before arming the save prompt and spends nothing (CLA-092)', async () => {
      rangeCheck.isWithinRange.mockResolvedValueOnce(false);
      renderModal();

      await act(async () => {
        fireEvent.click(harmBtn());
      });

      expect(paragraphWithText('Orc Warrior is out of range for Divine Spark (30 ft).')).toBeInTheDocument();
      expect(corona.getCoronaSaveDisadvantage).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
      // NOTE defect 6: the damage dice are rolled BEFORE the range check.
      expect(diceRoller.rollExpression).toHaveBeenCalledTimes(1);
      // Zero-spend witness.
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      expect(spendCalls()).toHaveLength(0);
    });
  });

  // ── Save result — failed save ──

  it('applies typed damage through the canonical resolver with exact args, logs the exact full roll row, and renders the failed-save lines (CLA-092)', async () => {
    renderModal();

    await act(async () => {
      fireEvent.click(harmBtn());
    });
    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(false));
    });

    expect(damageUtils.getCombatContext).toHaveBeenCalledTimes(1);
    expect(damageUtils.getCombatContext).toHaveBeenCalledWith('test-campaign');
    // Identity pin: same frozen context; no player-type creatures in it.
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(combatContext, 'Orc Warrior', 10, ['Radiant'], {
      campaignName: 'test-campaign',
      characters: [],
      ignoreResistance: false,
      attackerName: 'Paladin1',
    });
    const entry = findLogEntry('roll');
    expect(entry).toBeDefined();
    expect(entry[1]).toEqual({
      type: 'roll',
      name: 'Divine Spark',
      characterName: 'Paladin1',
      rollType: 'save-damage',
      targetName: 'Orc Warrior',
      saveDc: 13,
      saveType: 'CON',
      saveResult: 'failure',
      total: 5,
      rolls: [3],
      bonus: 2,
      formula: '1d20+2',
      damageFormula: '3d6 Radiant',
      damageType: 'Radiant',
      rawDamage: 10,
      finalDamage: 10,
      timestamp: expect.any(Number),
    });
    expect(paragraphWithText('Orc Warrior — CON save (DC 13): Failed')).toBeInTheDocument();
    expect(paragraphWithText('Orc Warrior takes 10 Radiant damage.')).toBeInTheDocument();
    expect(screen.getByText('Damage roll: 3d6 Radiant = 10')).toBeInTheDocument();
  });

  it('emits the bare 1d20 formula when the save bonus is exactly 0', async () => {
    renderModal();

    await act(async () => {
      fireEvent.click(harmBtn());
    });
    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(false, { saveBonus: 0 }));
    });

    const entry = findLogEntry('roll');
    expect(entry).toBeDefined();
    const { bonus, formula } = entry[1];
    expect({ bonus, formula }).toEqual({ bonus: 0, formula: '1d20' });
  });

  it('renders 0 damage and logs finalDamage 0 when the resolver returns null', async () => {
    applyDamage.applyDamageToTarget.mockImplementationOnce(async () => null);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderModal();

    await act(async () => {
      fireEvent.click(harmBtn());
    });
    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(false));
    });

    expect(errorSpy).toHaveBeenCalledWith('[DivineSparkModal] applyDamageToTarget returned null for', 'Orc Warrior');
    expect(paragraphWithText('Orc Warrior takes 0 Radiant damage.')).toBeInTheDocument();
    const entry = findLogEntry('roll');
    expect(entry).toBeDefined();
    const { rawDamage, finalDamage } = entry[1];
    expect({ rawDamage, finalDamage }).toEqual({ rawDamage: 10, finalDamage: 0 });
    errorSpy.mockRestore();
  });

  // ── Save result — successful save ──

  it('applies nothing, renders the success lines, and logs the success roll (CLA-092)', async () => {
    renderModal();

    await act(async () => {
      fireEvent.click(harmBtn());
    });
    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(true));
    });

    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    expect(damageUtils.getCombatContext).not.toHaveBeenCalled();
    expect(paragraphWithText('Orc Warrior — CON save (DC 13): Success')).toBeInTheDocument();
    expect(screen.getByText('Target saved and takes no damage.')).toBeInTheDocument();
    expect(screen.getByText('Damage roll: 3d6 Radiant = 10')).toBeInTheDocument();
    const entry = findLogEntry('roll');
    expect(entry).toBeDefined();
    expect(entry[1]).toEqual({
      type: 'roll',
      name: 'Divine Spark',
      characterName: 'Paladin1',
      rollType: 'save-damage',
      targetName: 'Orc Warrior',
      saveDc: 13,
      saveType: 'CON',
      saveResult: 'success',
      total: 8,
      rolls: [6],
      bonus: 2,
      formula: '1d20+2',
      damageFormula: '3d6 Radiant',
      damageType: 'Radiant',
      rawDamage: 10,
      finalDamage: 0,
      timestamp: expect.any(Number),
    });
  });

  // ── Damage type selection ──

  it('routes a selected Fire type through label, corona check, prompt payload, log, and result view', async () => {
    renderModal({ damageTypes: Object.freeze(['Radiant', 'Fire']) });

    fireEvent.click(screen.getByRole('radio', { name: 'Fire' }));
    const fireHarmBtn = screen.getByRole('button', { name: 'Harm (3d6 Fire, CON save)' });
    expect(fireHarmBtn).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Harm (3d6 Radiant, CON save)' })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(fireHarmBtn);
    });
    expect(corona.getCoronaSaveDisadvantage).toHaveBeenCalledWith({
      targetName: 'Orc Warrior',
      damageType: 'Fire',
      campaignName: 'test-campaign',
    });
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      damageFormula: '3d6 Fire',
      damageType: 'Fire',
      rawDamage: 10,
    }));
    const abilityCall = spendCalls()[0];
    expect(abilityCall).toBeDefined();
    expect(abilityCall[1].description).toBe('Divine Spark (Harm) — targeting Orc Warrior, Fire damage, CON save DC 13. Channel Divinity: 1 remaining.');

    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(false));
    });
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledWith(combatContext, 'Orc Warrior', 10, ['Fire'], expect.objectContaining({
      campaignName: 'test-campaign',
      attackerName: 'Paladin1',
    }));
    expect(paragraphWithText('Orc Warrior takes 10 Fire damage.')).toBeInTheDocument();
    expect(screen.getByText('Damage roll: 3d6 Fire = 10')).toBeInTheDocument();
  });

  // ── Save-result listener lifecycle ──

  it('ignores a mismatched promptId, handles the first matching event once, and drops duplicates', async () => {
    renderModal();

    await act(async () => {
      fireEvent.click(harmBtn());
    });
    // Mismatched id — inert, and the listener stays armed.
    await act(async () => {
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: 'wrong-id', success: false, total: 5, roll: 3, saveBonus: 2 },
      }));
    });
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
    expect(rollCalls()).toHaveLength(0);
    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();

    // Matching id — handled exactly once.
    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(false));
    });
    expect(rollCalls()).toHaveLength(1);
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(paragraphWithText('Orc Warrior takes 10 Radiant damage.')).toBeInTheDocument();

    // Duplicate for the same promptId — the listener detached after handling.
    await act(async () => {
      window.dispatchEvent(dispatchSaveResult(true));
    });
    expect(rollCalls()).toHaveLength(1);
    expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Target saved and takes no damage.')).not.toBeInTheDocument();
  });

  // ── Save-result detail defaults ──

  it('defaults total/rolls/bonus to 0 for a minimal event detail', async () => {
    renderModal();

    await act(async () => {
      fireEvent.click(harmBtn());
    });
    await act(async () => {
      window.dispatchEvent(new CustomEvent('save-result', {
        detail: { promptId: lastPromptId(), success: false },
      }));
    });

    const entry = findLogEntry('roll');
    expect(entry).toBeDefined();
    expect(entry[1]).toEqual({
      type: 'roll',
      name: 'Divine Spark',
      characterName: 'Paladin1',
      rollType: 'save-damage',
      targetName: 'Orc Warrior',
      saveDc: 13,
      saveType: 'CON',
      saveResult: 'failure',
      total: 0,
      rolls: [0],
      bonus: 0,
      // NOTE defect 5: '+' + undefined bonus stringifies to '1d20+undefined' —
      // pinned current behavior; fix should default with `?? 0`.
      formula: '1d20+undefined',
      damageFormula: '3d6 Radiant',
      damageType: 'Radiant',
      rawDamage: 10,
      finalDamage: 10,
      timestamp: expect.any(Number),
    });
  });

  // ── Done button ──

  it('replaces Heal/Harm/Cancel with Done once a result exists and closes exactly once', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await act(async () => {
      fireEvent.click(healBtn());
    });

    const done = screen.getByRole('button', { name: 'Done' });
    expect(screen.queryByRole('button', { name: 'Heal (2d8)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Harm/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    fireEvent.click(done);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // ── Channel Divinity charge economy (pay-at-CONFIRM, 2026-11-05) ──
  // Handler row-click no longer spends; the charge write + ability_use spend
  // row move atomically into branch-confirm (SetConditionModal.handleApplyOverride
  // pattern, playbook §166). Harm confirm, every refusal/abort lane, and Cancel
  // zero-spend witnesses live inside their flow tests above; what remains here
  // is the readout grammar/absence branches and the heal-lane atomicity.

  describe('charge economy', () => {
    it('renders the header charge readout with singular grammar', () => {
      renderModal({ channelDivinityCharges: 1 });
      expect(screen.getByText('1 charge remaining')).toBeInTheDocument();
      expect(screen.queryByText(/1 charges/)).not.toBeInTheDocument();
    });

    it('omits the header readout when the charges prop is not a number', () => {
      renderModal({ channelDivinityCharges: undefined });
      expect(document.querySelector('.sp-header')).toHaveTextContent('Divine Spark');
      expect(screen.queryByText(/charge(s)? remaining/)).not.toBeInTheDocument();
    });

    it('spends atomically at heal confirm: decrement write, exact ability_use row, singular decremented header in the result view', async () => {
      renderModal({ channelDivinityCharges: 2 });

      await act(async () => {
        fireEvent.click(healBtn());
      });

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Paladin1', 'channelDivinityCharges', 1, 'test-campaign',
      );
      expect(spendCalls()).toHaveLength(1);
      expect(spendCalls()[0][1]).toEqual({
        type: 'ability_use',
        characterName: 'Paladin1',
        abilityName: 'Divine Spark',
        description: 'Divine Spark (Heal) — targeting Orc Warrior, healed 10 HP. Channel Divinity: 1 remaining.',
      });
      // 2 charges → spent → singular '1 charge remaining', never plural.
      expect(screen.getByText('1 charge remaining')).toBeInTheDocument();
      expect(screen.queryByText(/1 charges/)).not.toBeInTheDocument();
      expect(screen.queryByText('2 charges remaining')).not.toBeInTheDocument();
    });

    it('logs the spend row without a decrement write when the charges prop is not a number', async () => {
      renderModal({ channelDivinityCharges: undefined });

      await act(async () => {
        fireEvent.click(healBtn());
      });

      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();
      const abilityCall = spendCalls()[0];
      expect(abilityCall).toBeDefined();
      expect(abilityCall[1].description).toBe('Divine Spark (Heal) — targeting Orc Warrior, healed 10 HP.');
    });

    it('never spends when a branch aborts on a null roll; the later confirm spends exactly once and never respends', async () => {
      diceRoller.rollExpression.mockReturnValueOnce(null);
      renderModal();

      // Aborted heal branch leaves the ref guard untripped.
      fireEvent.click(healBtn());
      expect(useRuntimeState.setRuntimeValue).not.toHaveBeenCalled();

      await act(async () => {
        fireEvent.click(harmBtn());
      });

      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Paladin1', 'channelDivinityCharges', 1, 'test-campaign',
      );

      // Double-commit detector: resolving the save must not re-spend.
      await act(async () => {
        window.dispatchEvent(dispatchSaveResult(false));
      });
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledTimes(1);
      expect(spendCalls()).toHaveLength(1);
    });
  });
});
