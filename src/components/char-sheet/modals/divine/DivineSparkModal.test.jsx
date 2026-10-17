// @maintained-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import DivineSparkModal from './DivineSparkModal.jsx';

// ── Ownership ──
// This file owns the heal/harm choice modal UI in isolation: verbatim header,
// prompt, and button labels; damage-type radio gating and selection flow; the
// roll→range→choke-point seams emitting EXACT args (identity-pinned frozen
// combatContext into applyHealingToTarget/applyDamageToTarget, exact save
// prompt payload incl. CLA-092 damage transport and CLA-063 corona
// disadvantage); save-DC derivation (8 + WIS + PB, sheet spell save DC wins);
// refusal paths (out of range, target missing, null roll/apply results);
// save-result event handling (promptId match, single-shot listener, detail
// defaults); exact result-view text; Cancel/Done close; overlay inertness.
// The component holds all state locally — no runtime-store reads, no
// sanitize.js import, so no live stores, no module-mocked sanitizer
// (sanitizer inertness pin is N/A in this lane).
// Deferred to owners:
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
  createSaveListener: vi.fn(() => ({ promptId: `test-prompt-${++promptSeq.n}` })),
}));

vi.mock('../../../../services/combat/auras/coronaAuraUtils.js', () => ({
  getCoronaSaveDisadvantageSync: vi.fn(() => ({ disadvantage: false })),
}));

// CLA-092: canonical choke points — clamping heal + typed damage application mocks.
vi.mock('../../../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(async () => combatContext),
}));

vi.mock('../../../../services/rules/combat/applyHealing.js', () => ({
  applyHealingToTarget: vi.fn((cs, targetName, amount) => {
    const creature = cs?.creatures?.find(c => c.name === targetName);
    const maxHp = creature?.maxHp ?? 40;
    const currentHp = creature?.currentHp ?? 20;
    const newHp = Math.min(maxHp, currentHp + amount);
    return { newHp, oldHp: currentHp, maxHp, actualHeal: newHp - currentHp };
  }),
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
  playerStats: defaultPlayerStats,
});

// Fresh onClose per call — no cross-test mock residue, no clearAllMocks.
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
// 4. Listener leak: the window 'save-result' listener has no unmount
//    cleanup — closing the modal with a pending prompt leaves it armed.
//    Tests survive this only because the unique-per-arming promptId makes
//    leaked listeners inert via the mismatch guard (see promptSeq); without
//    unique ids, one dispatch fires every stale handler (observed: 10×
//    getCombatContext calls polluting a later test).
// 5. Formula defect: `'+' + event.detail.saveBonus` with an undefined bonus
//    logs '1d20+undefined' (pinned below; fix: `?? 0`).
// 6. Heal/harm roll dice BEFORE the 30 ft range check — refused actions
//    still consume a roll (pinned in the refusal tests).

// ── Tests ──

describe('DivineSparkModal', () => {
  beforeEach(() => {
    diceRoller.rollExpression.mockReturnValue({ total: 10, rolls: [4, 6], modifier: 0 });
    diceRoller.rollExpressionMaximized.mockReturnValue({ total: 20, rolls: [10, 10], modifier: 0, maximized: true });
    automationService.hasHealingMaximization.mockReturnValue(false);
  });

  afterEach(() => {
    // Per-mock reset (no resetAllMocks): bare vi.fn()s clear to undefined,
    // factory-impl mocks (addEntry, createSaveListener, corona, choke
    // points, range) restore their factory impls under Vitest 4.
    diceRoller.rollExpression.mockReset();
    diceRoller.rollExpressionMaximized.mockReset();
    automationService.hasHealingMaximization.mockReset();
    logService.addEntry.mockReset();
    healingRoll.logHealingToSSE.mockReset();
    savePrompt.createSaveListener.mockReset();
    corona.getCoronaSaveDisadvantageSync.mockReset();
    damageUtils.getCombatContext.mockReset();
    applyHealing.applyHealingToTarget.mockReset();
    applyDamage.applyDamageToTarget.mockReset();
    rangeCheck.isWithinRange.mockReset();
  });

  // ── Rendering ──

  describe('rendering', () => {
    it('renders the overlay, header, prompt line, and enabled Heal/Harm/Cancel exactly', () => {
      renderModal();
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
      expect(screen.getByText('Divine Spark')).toBeInTheDocument();
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

    it('stays inert when the overlay or modal container is clicked', () => {
      const onClose = vi.fn();
      renderModal({ onClose });

      fireEvent.click(document.querySelector('.sp-overlay'));
      fireEvent.click(document.querySelector('.sp-modal'));

      expect(onClose).not.toHaveBeenCalled();
      expect(diceRoller.rollExpression).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(screen.getAllByRole('button')).toHaveLength(3);
    });
  });

  // ── Cancel ──

  it('closes exactly once and touches no roll, prompt, application, or log seam when Cancel is clicked', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(diceRoller.rollExpression).not.toHaveBeenCalled();
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
  });

  // ── Heal flow ──

  describe('heal seam', () => {
    it('rolls 2d8 once and routes through the canonical choke points with exact args (CLA-092)', async () => {
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
    });

    it('renders the heal result with exact finite lines and no NaN (CLA-092)', async () => {
      renderModal();

      await act(async () => {
        fireEvent.click(healBtn());
      });

      expect(paragraphWithText('Orc Warrior healed for 10 HP.')).toBeInTheDocument();
      expect(screen.getByText('Roll: 2d8 = 10')).toBeInTheDocument();
      expect(screen.getByText('Current HP: 30 / 40 (healed 10)')).toBeInTheDocument();
      expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    });

    it('clamps healing at target max HP without corrupting state (CLA-092)', async () => {
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

      expect(paragraphWithText('Orc Warrior healed for 10 HP.')).toBeInTheDocument();
      expect(screen.getByText('Current HP: 40 / 40 (healed 2)')).toBeInTheDocument();
      expect(healingRoll.logHealingToSSE).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
        actualHeal: 2,
        newHp: 40,
        maxHp: 40,
      }));
    });

    it('refuses and logs when the heal choke point returns null', async () => {
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
      errorSpy.mockRestore();
    });

    it('refuses an out-of-range heal before touching combat state (CLA-092)', async () => {
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
  ])('aborts $mode with no side effects when rollExpression returns null', ({ mode, button }) => {
    diceRoller.rollExpression.mockReturnValue(null);
    renderModal();

    fireEvent.click(screen.getByRole('button', { name: button }));

    expect(diceRoller.rollExpression).toHaveBeenCalledWith(mode === 'heal' ? '2d8' : '3d6');
    expect(applyHealing.applyHealingToTarget).not.toHaveBeenCalled();
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(rangeCheck.isWithinRange).not.toHaveBeenCalled();
    // Mode resets: action buttons and Cancel are back, no result shown.
    expect(screen.getByRole('button', { name: 'Heal (2d8)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByText('Done')).not.toBeInTheDocument();
  });

  // ── Harm initiation ──

  describe('harm seam', () => {
    it('rolls 3d6 once and arms the save prompt with the exact payload (CLA-092)', async () => {
      renderModal();

      await act(async () => {
        fireEvent.click(harmBtn());
      });

      expect(diceRoller.rollExpression).toHaveBeenCalledTimes(1);
      expect(diceRoller.rollExpression).toHaveBeenCalledWith('3d6');
      expect(rangeCheck.isWithinRange).toHaveBeenCalledWith('Paladin1', 'Orc Warrior', 30);
      expect(corona.getCoronaSaveDisadvantageSync).toHaveBeenCalledWith({
        targetName: 'Orc Warrior',
        damageType: 'Radiant',
        campaignName: 'test-campaign',
        skipRangeCheck: true,
      });
      // CLA-063: prompt payload is the machine-truth channel consumed by SavePromptModal.
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

    it.each([
      {
        label: 'default names',
        overrides: {},
        entry: {
          type: 'ability_use',
          characterName: 'Paladin1',
          abilityName: 'Divine Spark',
          description: 'Divine Spark (Harm) — targeting Orc Warrior, Radiant damage, CON save DC 13.',
        },
      },
      {
        label: 'overridden names',
        overrides: { attackerName: 'Cleric1', featureName: 'Channel Divinity' },
        entry: {
          type: 'ability_use',
          characterName: 'Cleric1',
          abilityName: 'Channel Divinity',
          description: 'Channel Divinity (Harm) — targeting Orc Warrior, Radiant damage, CON save DC 13.',
        },
      },
    ])('logs ability_use with the exact description ($label)', async ({ overrides, entry }) => {
      renderModal(overrides);

      await act(async () => {
        fireEvent.click(harmBtn());
      });

      const abilityCall = findLogEntry('ability_use');
      expect(abilityCall).toBeDefined();
      expect(abilityCall[1]).toEqual(entry);
    });

    // CLA-092: never a hardcoded +2 — 8 + WIS + PB, sheet spell save DC wins.
    it.each([
      { label: 'WIS +0, PB +2', wisModifier: 0, playerStats: undefined, saveDc: 10 },
      { label: 'WIS −2, PB +2', wisModifier: -2, playerStats: undefined, saveDc: 8 },
      { label: 'WIS +5, PB +2', wisModifier: 5, playerStats: undefined, saveDc: 15 },
      {
        label: 'lv8 WIS +4 PB +3 gets 15, not 14',
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
    ])('derives saveDc $saveDc for $label', async ({ wisModifier, playerStats, saveDc }) => {
      renderModal(playerStats ? { wisModifier, playerStats } : { wisModifier });

      await act(async () => {
        fireEvent.click(harmBtn());
      });

      expect(savePrompt.createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({ saveDc }));
    });

    // CLA-063: Corona of Light — Radiant/Fire saves vs a sunlit enemy arm
    // with disadvantage on the payload flag.
    it('threads corona sunlight disadvantage onto the save prompt payload (CLA-063)', async () => {
      corona.getCoronaSaveDisadvantageSync.mockReturnValue({ disadvantage: true, source: 'War_Cleric' });
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

    it('refuses an out-of-range harm before arming the save prompt (CLA-092)', async () => {
      rangeCheck.isWithinRange.mockResolvedValueOnce(false);
      renderModal();

      await act(async () => {
        fireEvent.click(harmBtn());
      });

      expect(paragraphWithText('Orc Warrior is out of range for Divine Spark (30 ft).')).toBeInTheDocument();
      expect(corona.getCoronaSaveDisadvantageSync).not.toHaveBeenCalled();
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
      expect(findLogEntry('ability_use')).toBeUndefined();
      // NOTE defect 6: the damage dice are rolled BEFORE the range check.
      expect(diceRoller.rollExpression).toHaveBeenCalledTimes(1);
    });
  });

  // ── Save result — failed save ──

  describe('failed save', () => {
    it('applies typed damage through the canonical resolver with exact args and renders the failed-save lines (CLA-092)', async () => {
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
      expect(paragraphWithText('Orc Warrior — CON save (DC 13): Failed')).toBeInTheDocument();
      expect(paragraphWithText('Orc Warrior takes 10 Radiant damage.')).toBeInTheDocument();
      expect(screen.getByText('Damage roll: 3d6 Radiant = 10')).toBeInTheDocument();
    });

    it('logs the save-damage roll entry with the exact full shape', async () => {
      renderModal();

      await act(async () => {
        fireEvent.click(harmBtn());
      });
      await act(async () => {
        window.dispatchEvent(dispatchSaveResult(false));
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
    });

    it('derives the save formula with a negative save bonus', async () => {
      renderModal();

      await act(async () => {
        fireEvent.click(harmBtn());
      });
      await act(async () => {
        window.dispatchEvent(dispatchSaveResult(false, { saveBonus: -1 }));
      });

      const entry = findLogEntry('roll');
      expect(entry).toBeDefined();
      expect(entry[1]).toMatchObject({ bonus: -1, formula: '1d20+-1' });
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
      expect(entry[1]).toMatchObject({ rawDamage: 10, finalDamage: 0 });
      errorSpy.mockRestore();
    });
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
    expect(corona.getCoronaSaveDisadvantageSync).toHaveBeenCalledWith({
      targetName: 'Orc Warrior',
      damageType: 'Fire',
      campaignName: 'test-campaign',
      skipRangeCheck: true,
    });
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      damageFormula: '3d6 Fire',
      damageType: 'Fire',
      rawDamage: 10,
    }));
    const abilityCall = findLogEntry('ability_use');
    expect(abilityCall).toBeDefined();
    expect(abilityCall[1].description).toBe('Divine Spark (Harm) — targeting Orc Warrior, Fire damage, CON save DC 13.');

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

  describe('save-result listener lifecycle', () => {
    it('handles the first matching event once and ignores duplicates', async () => {
      renderModal();

      await act(async () => {
        fireEvent.click(harmBtn());
      });
      await act(async () => {
        window.dispatchEvent(dispatchSaveResult(false));
      });
      // Second event, same promptId — listener was removed after handling.
      await act(async () => {
        window.dispatchEvent(dispatchSaveResult(true));
      });

      expect(rollCalls()).toHaveLength(1);
      expect(applyDamage.applyDamageToTarget).toHaveBeenCalledTimes(1);
      expect(paragraphWithText('Orc Warrior takes 10 Radiant damage.')).toBeInTheDocument();
      expect(screen.queryByText('Target saved and takes no damage.')).not.toBeInTheDocument();
    });

    it('ignores a mismatched promptId but stays armed for the matching one', async () => {
      renderModal();

      await act(async () => {
        fireEvent.click(harmBtn());
      });
      await act(async () => {
        window.dispatchEvent(new CustomEvent('save-result', {
          detail: { promptId: 'wrong-id', success: false, total: 5, roll: 3, saveBonus: 2 },
        }));
      });

      expect(screen.queryByText('Done')).not.toBeInTheDocument();
      expect(rollCalls()).toHaveLength(0);

      await act(async () => {
        window.dispatchEvent(dispatchSaveResult(true));
      });

      expect(screen.getByText('Target saved and takes no damage.')).toBeInTheDocument();
      expect(rollCalls()).toHaveLength(1);
    });
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
    expect(entry[1]).toMatchObject({ total: 0, rolls: [0], bonus: 0 });
    // NOTE defect 5: '+' + undefined bonus stringifies to '1d20+undefined' —
    // pinned current behavior; fix should be `'1d20' + (saveBonus ? ... )` with ?? 0.
    expect(entry[1].formula).toBe('1d20+undefined');
  });

  // ── Done button ──

  it.each([
    {
      label: 'after heal',
      open: async () => {
        await act(async () => {
          fireEvent.click(healBtn());
        });
      },
    },
    {
      label: 'after harm failure',
      open: async () => {
        await act(async () => {
          fireEvent.click(harmBtn());
        });
        await act(async () => {
          window.dispatchEvent(dispatchSaveResult(false));
        });
      },
    },
    {
      label: 'after harm success',
      open: async () => {
        await act(async () => {
          fireEvent.click(harmBtn());
        });
        await act(async () => {
          window.dispatchEvent(dispatchSaveResult(true));
        });
      },
    },
  ])('replaces Heal/Harm/Cancel with Done after $label and closes exactly once', async ({ open }) => {
    const onClose = vi.fn();
    renderModal({ onClose });
    await open();

    const done = await screen.findByRole('button', { name: 'Done' });
    expect(screen.queryByRole('button', { name: 'Heal (2d8)' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Harm/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    fireEvent.click(done);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
