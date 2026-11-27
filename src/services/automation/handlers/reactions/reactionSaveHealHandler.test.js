// @maintained-by-ai 2026-11-27 — commit-census lane over reactionSaveHealHandler.handle()
// (Relentless Rage save-then-heal reaction). LIVE: automation/index.js
// `reaction_save_heal` → handleReactionSaveHeal; fed by public/data/classes.json:277
// (healExpression 1) + 2024/classes.json:488 ('2 * barbarian_level'); whitelisted in
// combat/automation/automationRouter.js:232.
//
// THIS lane owns: gate-ORDERED refusals with exact read-channel censuses (Rage
// stance name-match → combat context → 0-HP → uses-exhausted), the trigger-commit
// census (createSaveListener args + ability_use trigger log + full-shape popup +
// uses-key derivation via the REAL getRuntimeUsesKey), HP-resolution branch legs,
// the save-outcome commit censuses (HP write → success log → dispatch → uses
// spend, exact ordered arrays; failure half: log → death-prompt → uses spend,
// zero HP write), the death-save slot machine + prompt gates, the heal-expression
// table (this handler writes currentHitPoints DIRECTLY — it never calls
// applyHealing, so healing batch laws live in applyHealing.test.js but THIS
// evaluator is owned here), and addEntry-rejection resilience.
//
// SEAM MAP: relentlessRageService.js (rules/features/) is a DISTINCT parallel
// module intercepted by applyDamage.js — its five *.test.js lanes own that
// surface. boonOfRecoveryHandler owns the survive_and_heal direct-write lane;
// reactionDebuffHandler.uses owns keyed-budget router math (this lane's budget
// is a hardcoded maxUses=1). No heal helper is mocked because none exists.
//
// DEAD KNOBS (not pinned): `ragePoints` is never read by the source — the
// exact read-key census ['activeBuffs', ...] in every refusal/commit row proves
// absence. `dcScaling` is inert: currentUses is always 0 at DC-calc time because
// currentUses>=1 refuses upstream, so baseDc + 0*scaling ≡ baseDc.
//
// SOURCE QUIRK PINNED AS BEHAVIOR: a '<n> * <unknown_field>' expression matches
// the generic numeric multiplier regex, looks up nothing, and heals 0 (see
// 'multiplier on an unknown field' row) — a same-source pattern in live data
// ('3 * monk_level') would yield 0 IF ever routed to this handler type.
//
// HARNESS: bare vi.fn factories with ALL implementations re-installed in
// beforeEach after vi.resetAllMocks (no clearAllMocks residue: the old file let
// mockRejectedValue leak across tests). The mocked createSaveListener returns a
// CONSTANT promptId, and the handler registers self-removing window save-result/
// death-save-result listeners — tests that pass the guards but never fire a save
// would otherwise leak live listeners into later tests (run2#1832 double-fire
// bomb). window.addEventListener is therefore spied and every save/death/
// combat-summary listener registered during a test is removed in afterEach.
// Fixture healExpression mirrors live 2024 data ('2 * barbarian_level'), NOT the
// retired misleading 'barbarian_level + 4' string that silently evaluated to the
// level-fallback leg.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  createSaveListener: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

vi.mock('../../../combat/conditions/savePromptService.js', () => ({
  sendDeathSavePrompt: vi.fn(),
}));

vi.mock('../../../ui/utils.js', () => ({
  default: { guid: vi.fn() },
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './reactionSaveHealHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as damageUtils from '../../../rules/combat/damageUtils.js';
import { sendDeathSavePrompt } from '../../../combat/conditions/savePromptService.js';
import utils from '../../../ui/utils.js';

const campaignName = 'test-campaign';
const P = 'TestBarbarian';

// ── Fixture builders ───────────────────────────────────────────

function makePlayerStats(overrides = {}) {
  return { name: P, level: 5, ...overrides };
}

function makeAction(automation = {}, name = 'Relentless Rage') {
  return {
    name,
    automation: { saveType: 'CON', saveDc: 12, healExpression: '2 * barbarian_level', ...automation },
  };
}

// Expected shapes derived from the action (single derivation point).
const featureOf = (action) => action.name || 'Relentless Rage';
const saveTypeOf = (action) => action.automation.saveType || 'CON';
const dcOf = (action) => action.automation.saveDc || 10;

const commitPopup = (action) => ({
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: featureOf(action),
    targetName: P,
    description: `${P} must make a ${saveTypeOf(action)} saving throw (DC ${dcOf(action)}).`,
    automation: action.automation,
  },
});

const refusalPopup = (action, description) => ({
  type: 'popup',
  payload: {
    type: 'automation_info',
    name: featureOf(action),
    description,
    automation: action.automation,
  },
});

const triggerLog = (action) => ({
  type: 'ability_use',
  characterName: P,
  abilityName: featureOf(action),
  description: `${featureOf(action)} triggered — ${P} must make ${saveTypeOf(action)} save (DC ${dcOf(action)})`,
  source: featureOf(action),
  promptId: 'prompt-123',
});

// ── Shared event trigger helpers ───────────────────────────────

function triggerSaveResult(success, extra = {}) {
  window.dispatchEvent(new CustomEvent('save-result', {
    detail: {
      promptId: 'prompt-123',
      success,
      roll: success ? 15 : 8,
      saveBonus: 7,
      total: success ? 22 : 15,
      ...extra,
    },
  }));
}

function triggerDeathSaveResult(extra = {}) {
  window.dispatchEvent(new CustomEvent('death-save-result', {
    detail: {
      promptId: 'death-prompt-123',
      success: true,
      isNat20: false,
      roll: 15,
      ...extra,
    },
  }));
}

const readKeys = () => runtimeState.getRuntimeValue.mock.calls.map((c) => c[1]);

// Drive a failed feature save to the post-commit seam (uses spent, death
// listener registered by the caller flow if HP gate passes).
async function driveFailedSave(action = makeAction()) {
  await handle(action, makePlayerStats(), campaignName, null);
  triggerSaveResult(false);
  await vi.waitFor(() => expect(runtimeState.setRuntimeValue.mock.calls).toHaveLength(1));
}

// ── Tests ──────────────────────────────────────────────────────

describe('reactionSaveHealHandler', () => {
  // jsdom brands add/removeEventListener on Window itself (EventTarget.prototype
  // .call(window, …) throws), so capture the pre-spy window-bound originals.
  const nativeAdd = window.addEventListener.bind(window);
  const nativeRemove = window.removeEventListener.bind(window);
  let strays;

  function mockRuntime(overrides = {}) {
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key in overrides) return overrides[key];
      if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
      if (key === 'currentHitPoints') return 0;
      if (key === 'relentlessRageUses') return 0;
      if (key === 'deathSaves') return [false, false, false];
      if (key === 'deathFailures') return [false, false, false];
      return 0;
    });
  }

  // currentHitPoints reads consume `seq` one-by-one (last value repeats);
  // models HP changing between the entry gate and the post-fail re-read.
  function mockRuntimeHpSequence(seq) {
    let i = 0;
    runtimeState.getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'currentHitPoints') return seq[Math.min(i++, seq.length - 1)];
      if (key === 'activeBuffs') return [{ name: 'Rage', effect: 'stance' }];
      if (key === 'relentlessRageUses') return 0;
      if (key === 'deathSaves') return [false, false, false];
      if (key === 'deathFailures') return [false, false, false];
      return 0;
    });
  }

  beforeEach(() => {
    vi.resetAllMocks();
    // Re-install ALL defaults after reset (no residue either way).
    runtimeState.setRuntimeValue.mockResolvedValue(undefined);
    logService.addEntry.mockResolvedValue({});
    utils.guid.mockReturnValue('death-prompt-123');
    savePrompt.createSaveListener.mockReturnValue({ promptId: 'prompt-123' });
    mockRuntime();
    damageUtils.getCombatContext.mockResolvedValue({
      creatures: [{ name: P, type: 'player', currentHp: 0 }],
    });
    // Stray-listener sweep (constant mocked promptIds make leaked listeners fire).
    strays = [];
    vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => {
      if (type === 'save-result' || type === 'death-save-result' || type === 'combat-summary-updated') {
        strays.push([type, fn]);
      }
      nativeAdd(type, fn, opts);
    });
  });

  afterEach(() => {
    for (const [type, fn] of strays) nativeRemove(type, fn);
    strays = [];
    vi.restoreAllMocks();
  });

  // ── Refusal gates (gate-ORDERED: exact read-channel census proves each
  //    earlier gate never touches a later channel; zero writes overall) ──

  it.each([
    {
      title: 'Rage stance missing (stance-tagged buff with wrong name does not count)',
      runtime: { activeBuffs: [{ name: 'Whirling Fury', effect: 'stance' }] },
      combatCalls: 0,
      reads: ['activeBuffs'],
      desc: 'Rage is not active. Relentless Rage requires an active Rage.',
    },
    {
      title: 'activeBuffs non-array is treated as no stance',
      runtime: { activeBuffs: undefined },
      combatCalls: 0,
      reads: ['activeBuffs'],
      desc: 'Rage is not active. Relentless Rage requires an active Rage.',
    },
    {
      title: 'no combat context',
      combatNull: true,
      combatCalls: 1,
      reads: ['activeBuffs'],
      desc: 'No combat active.',
    },
    {
      title: 'player above 0 HP (player branch reads runtime HP, not creature currentHp 0)',
      runtime: { currentHitPoints: 5 },
      combatCalls: 1,
      reads: ['activeBuffs', 'currentHitPoints'],
      desc: `${P} is not at 0 Hit Points.`,
    },
    {
      title: 'uses exhausted (hardcoded maxUses=1)',
      runtime: { relentlessRageUses: 1 },
      combatCalls: 1,
      reads: ['activeBuffs', 'currentHitPoints', 'relentlessRageUses'],
      desc: 'Relentless Rage has no uses remaining. Recharges after a Short or Long Rest.',
    },
  ])('refuses with $title: full-shape popup, zero spend, no later-channel reads', async ({ runtime, combatNull, combatCalls, reads, desc }) => {
    if (runtime) mockRuntime(runtime);
    if (combatNull) damageUtils.getCombatContext.mockResolvedValue(null);
    const action = makeAction();
    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(result).toEqual(refusalPopup(action, desc));
    expect(readKeys()).toEqual(reads);
    expect(damageUtils.getCombatContext).toHaveBeenCalledTimes(combatCalls);
    // Full-array zero-spend census (not key-filtered).
    expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
    expect(logService.addEntry).not.toHaveBeenCalled();
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  // ── Trigger commit: prompt args + trigger log + popup + uses-key ──

  it.each([
    {
      title: 'custom feature name/saveType/DC flows through prompt, log, popup and uses-key',
      action: makeAction({ saveType: 'WIS', saveDc: 15 }, 'Unbreakable Spirit'),
      prompt: { targetName: P, saveType: 'WIS', saveDc: 15 },
      reads: ['activeBuffs', 'currentHitPoints', 'unbreakableSpiritUses'],
    },
    {
      title: 'empty automation defaults CON/DC 10 and name-fallback Relentless Rage',
      action: { automation: {} },
      prompt: { targetName: P, saveType: 'CON', saveDc: 10 },
      reads: ['activeBuffs', 'currentHitPoints', 'relentlessRageUses'],
    },
    {
      title: 'stance entry needs only the name "Rage" (effect tag irrelevant)',
      action: makeAction(),
      runtime: { activeBuffs: [{ name: 'Rage' }] },
      prompt: { targetName: P, saveType: 'CON', saveDc: 12 },
      reads: ['activeBuffs', 'currentHitPoints', 'relentlessRageUses'],
    },
  ])('trigger commit ($title): exact prompt args, trigger log, popup shape, reads', async ({ action, prompt, runtime, reads }) => {
    if (runtime) mockRuntime(runtime);
    const result = await handle(action, makePlayerStats(), campaignName, null);

    expect(savePrompt.createSaveListener).toHaveBeenCalledTimes(1);
    expect(savePrompt.createSaveListener).toHaveBeenCalledWith(campaignName, prompt);
    expect(logService.addEntry.mock.calls).toEqual([[campaignName, triggerLog(action)]]);
    expect(result).toEqual(commitPopup(action));
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(readKeys()).toEqual(reads);
  });

  // ── HP-resolution branch legs (getPlayersLastKnownHp) ──

  it.each([
    {
      title: 'prefix-matched player creature (name + space) resolves via runtime HP 0',
      context: { creatures: [{ name: `${P} (Player)`, type: 'player', currentHp: 0 }] },
      proceeds: true,
    },
    {
      title: 'no name-matching creature is treated as 0 HP',
      context: { creatures: [{ name: 'Goblin', type: 'npc', currentHp: 5 }] },
      proceeds: true,
    },
    {
      title: 'missing creatures array is treated as 0 HP',
      context: {},
      proceeds: true,
    },
    {
      title: 'non-player exact-name match reads creature currentHp 5 (runtime stays 0)',
      context: { creatures: [{ name: P, type: 'npc', currentHp: 5 }] },
      proceeds: false,
    },
  ])('HP resolution: $title', async ({ context, proceeds }) => {
    damageUtils.getCombatContext.mockResolvedValue(context);
    const action = makeAction();
    const result = await handle(action, makePlayerStats(), campaignName, null);

    if (proceeds) {
      expect(result).toEqual(commitPopup(action));
    } else {
      expect(result).toEqual(refusalPopup(action, `${P} is not at 0 Hit Points.`));
      expect(savePrompt.createSaveListener).not.toHaveBeenCalled();
      // Branch read creature HP, never the runtime 0: only one currentHitPoints
      // read would occur if the player branch had run — it did not.
      expect(readKeys()).toEqual(['activeBuffs']);
    }
  });

  // ── Save outcome commit censuses ──

  it('successful save commits exactly: HP write, full success log, one dispatch, one uses spend — then self-unsubscribes', async () => {
    const action = makeAction();
    const dispatched = vi.fn();
    window.addEventListener('combat-summary-updated', dispatched);

    await handle(action, makePlayerStats(), campaignName, null);

    // Mismatched promptId is inert but does NOT destroy the listener.
    window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId: 'other', success: true } }));
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();

    triggerSaveResult(true);
    await vi.waitFor(() => expect(runtimeState.setRuntimeValue.mock.calls).toHaveLength(2));

    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      [P, 'currentHitPoints', 10, campaignName],
      [P, 'relentlessRageUses', 1, campaignName],
    ]);
    expect(logService.addEntry.mock.calls).toEqual([
      [campaignName, triggerLog(action)],
      [campaignName, {
        type: 'ability_use',
        characterName: P,
        abilityName: 'Relentless Rage',
        description: `${P} succeeded on CON save. Relentless Rage sets Hit Points to 10.`,
        saveRoll: 15,
        saveBonus: 7,
        saveTotal: 22,
        saveDc: 12,
        saveSuccess: true,
        hpGained: 10,
        source: 'Relentless Rage',
      }],
    ]);
    expect(dispatched).toHaveBeenCalledTimes(1);

    // Re-fire detector: save-result listener removes itself after a matched
    // result — a duplicate event must not double-spend or re-log.
    triggerSaveResult(true);
    expect(runtimeState.setRuntimeValue.mock.calls).toHaveLength(2);
    expect(logService.addEntry.mock.calls).toHaveLength(2);
    expect(dispatched).toHaveBeenCalledTimes(1);
  });

  it('failed save commits exactly: full failure log, death prompt spawn, uses spend on failure too — zero HP write, zero dispatch', async () => {
    const action = makeAction();
    const dispatched = vi.fn();
    window.addEventListener('combat-summary-updated', dispatched);

    await handle(action, makePlayerStats(), campaignName, null);
    triggerSaveResult(false);
    await vi.waitFor(() => expect(runtimeState.setRuntimeValue.mock.calls).toHaveLength(1));

    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      [P, 'relentlessRageUses', 1, campaignName],
    ]);
    expect(logService.addEntry.mock.calls).toEqual([
      [campaignName, triggerLog(action)],
      [campaignName, {
        type: 'ability_use',
        characterName: P,
        abilityName: 'Relentless Rage',
        description: `${P} failed CON save. Relentless Rage did not activate.`,
        saveRoll: 8,
        saveBonus: 7,
        saveTotal: 15,
        saveDc: 12,
        saveSuccess: false,
        source: 'Relentless Rage',
      }],
    ]);
    expect(sendDeathSavePrompt).toHaveBeenCalledTimes(1);
    expect(sendDeathSavePrompt).toHaveBeenCalledWith(campaignName, {
      promptId: 'death-prompt-123',
      targetName: P,
    });
    expect(dispatched).not.toHaveBeenCalled();

    // Re-fire detector: no second uses spend, no second death prompt.
    triggerSaveResult(false);
    expect(runtimeState.setRuntimeValue.mock.calls).toHaveLength(1);
    expect(sendDeathSavePrompt).toHaveBeenCalledTimes(1);
  });

  // ── Post-fail HP gate on death-prompt spawn ──

  it.each([
    {
      title: 'HP re-read > 0 after the failed save suppresses the prompt',
      hpSeq: [0, 7],
    },
    {
      title: 'HP null (never written) fails the != null guard',
      hpSeq: [null],
    },
  ])('no death-save prompt when $title', async ({ hpSeq }) => {
    mockRuntimeHpSequence(hpSeq);
    const action = makeAction();

    await handle(action, makePlayerStats(), campaignName, null);
    triggerSaveResult(false);
    await vi.waitFor(() => expect(runtimeState.setRuntimeValue.mock.calls).toHaveLength(1));

    expect(sendDeathSavePrompt).not.toHaveBeenCalled();
    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      [P, 'relentlessRageUses', 1, campaignName],
    ]);
    // No death listener was registered: a well-formed nat20 result is inert.
    triggerDeathSaveResult({ isNat20: true, roll: 20, success: true });
    expect(runtimeState.setRuntimeValue.mock.calls).toHaveLength(1);
    expect(logService.addEntry.mock.calls).toHaveLength(2);
  });

  // ── Death-save slot machine ──

  it.each([
    {
      title: 'success marks first empty save slot',
      death: { isNat20: false, roll: 15, success: true },
      writes: [
        [P, 'deathSaves', [true, false, false], campaignName],
        [P, 'deathFailures', [false, false, false], campaignName],
      ],
      log: { roll: 15, isNatural20: false, success: true },
    },
    {
      title: 'success fills the next empty slot',
      runtime: { deathSaves: [true, true, false] },
      death: { isNat20: false, roll: 12, success: true },
      writes: [
        [P, 'deathSaves', [true, true, true], campaignName],
        [P, 'deathFailures', [false, false, false], campaignName],
      ],
      log: { roll: 12, isNatural20: false, success: true },
    },
    {
      title: 'regular failure marks one slot',
      death: { isNat20: false, isNat1: false, roll: 5, success: false },
      writes: [
        [P, 'deathSaves', [false, false, false], campaignName],
        [P, 'deathFailures', [true, false, false], campaignName],
      ],
      log: { roll: 5, isNatural20: false, isNatural1: false, success: false },
    },
    {
      title: 'nat1 marks two slots',
      death: { isNat20: false, isNat1: true, roll: 1, success: false },
      writes: [
        [P, 'deathSaves', [false, false, false], campaignName],
        [P, 'deathFailures', [true, true, false], campaignName],
      ],
      log: { roll: 1, isNatural20: false, isNatural1: true, success: false },
    },
    {
      title: 'nat20 clears both tracks and restores HP 1 (HP write first)',
      runtime: { deathSaves: [true, true, true], deathFailures: [true, true, false] },
      death: { isNat20: true, roll: 20, success: true },
      writes: [
        [P, 'currentHitPoints', 1, campaignName],
        [P, 'deathSaves', [false, false, false], campaignName],
        [P, 'deathFailures', [false, false, false], campaignName],
      ],
      log: { roll: 20, isNatural20: true, success: true },
    },
  ])('death-save slot machine: $title', async ({ runtime, death, writes, log }) => {
    if (runtime) mockRuntime(runtime);
    await driveFailedSave();

    // Mismatched death promptId is inert but does NOT destroy the listener.
    window.dispatchEvent(new CustomEvent('death-save-result', { detail: { promptId: 'other', ...death } }));
    expect(runtimeState.setRuntimeValue.mock.calls).toHaveLength(1);

    triggerDeathSaveResult(death);
    await vi.waitFor(() => expect(runtimeState.setRuntimeValue.mock.calls).toHaveLength(1 + writes.length));

    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      [P, 'relentlessRageUses', 1, campaignName],
      ...writes,
    ]);
    expect(logService.addEntry.mock.calls).toHaveLength(3);
    expect(logService.addEntry.mock.calls[2]).toEqual([
      campaignName,
      { type: 'death_save', characterName: P, ...log },
    ]);

    // Re-fire detector: matched handler removes itself at entry.
    triggerDeathSaveResult(death);
    expect(runtimeState.setRuntimeValue.mock.calls).toHaveLength(1 + writes.length);
  });

  // ── Heal-expression evaluator (handler-local; direct HP write) ──

  it.each([
    { title: 'numeric expression passes through (live 5e data)', expr: 1, ps: {}, hp: 1 },
    { title: '"2 * barbarian_level" uses player level (barbarianLevel field ignored)', expr: '2 * barbarian_level', ps: {}, hp: 10 },
    { title: '"2 * barbarian_level" prefers Barbarian class_levels', expr: '2 * barbarian_level', ps: { level: 8, class: { class_levels: [{ name: 'Barbarian', level: 8 }] } }, hp: 16 },
    { title: '"2 * barbarian_level" with no Barbarian class falls to player level', expr: '2 * barbarian_level', ps: { class: { class_levels: [{ name: 'Fighter', level: 10 }] } }, hp: 10 },
    { title: '"2 * level"', expr: '2 * level', ps: { level: 7 }, hp: 14 },
    { title: 'multiplier on an unknown field evaluates to 0 (source quirk)', expr: '3 * monk_level', ps: { level: 5 }, hp: 0 },
    { title: 'unparseable expression falls back to player level', expr: '1d8 + WIS modifier', ps: { level: 3 }, hp: 3 },
    { title: 'missing expression uses barbarianLevel field', expr: undefined, ps: { barbarianLevel: 7 }, hp: 7 },
    { title: 'missing expression without barbarianLevel falls to level', expr: undefined, ps: { level: 4 }, hp: 4 },
    { title: 'missing everything bottoms out at 1 (2 * 1)', expr: '2 * barbarian_level', ps: { level: undefined, class: undefined }, hp: 2 },
  ])('heal expression: $title', async ({ expr, ps, hp }) => {
    const action = makeAction({ healExpression: expr });
    await handle(action, makePlayerStats(ps), campaignName, null);
    triggerSaveResult(true);
    await vi.waitFor(() => expect(runtimeState.setRuntimeValue.mock.calls).toHaveLength(2));

    expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
      [P, 'currentHitPoints', hp, campaignName],
      [P, 'relentlessRageUses', 1, campaignName],
    ]);
  });

  // ── addEntry-rejection resilience (.catch + console.error on every log site) ──

  it.each([
    {
      title: 'success path',
      flow: async () => {
        triggerSaveResult(true);
        await vi.waitFor(() => expect(runtimeState.setRuntimeValue.mock.calls).toHaveLength(2));
        expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
          [P, 'currentHitPoints', 10, campaignName],
          [P, 'relentlessRageUses', 1, campaignName],
        ]);
      },
      errors: 2, // trigger log + success log
    },
    {
      title: 'failure path still spawns the death prompt',
      flow: async () => {
        triggerSaveResult(false);
        await vi.waitFor(() => expect(sendDeathSavePrompt).toHaveBeenCalledTimes(1));
        expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
          [P, 'relentlessRageUses', 1, campaignName],
        ]);
      },
      errors: 2,
    },
    {
      title: 'death-save branch still writes slots and revives on nat20',
      flow: async () => {
        triggerSaveResult(false);
        await vi.waitFor(() => expect(runtimeState.setRuntimeValue.mock.calls).toHaveLength(1));
        triggerDeathSaveResult({ isNat20: true, roll: 20, success: true });
        await vi.waitFor(() => expect(runtimeState.setRuntimeValue.mock.calls).toHaveLength(4));
        expect(runtimeState.setRuntimeValue.mock.calls).toEqual([
          [P, 'relentlessRageUses', 1, campaignName],
          [P, 'currentHitPoints', 1, campaignName],
          [P, 'deathSaves', [false, false, false], campaignName],
          [P, 'deathFailures', [false, false, false], campaignName],
        ]);
      },
      errors: 3, // + death_save log
    },
  ])('rejected addEntry on the $title does not block commits and is console.error-logged', async ({ flow, errors }) => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    logService.addEntry.mockRejectedValue(new Error('logging down'));

    await handle(makeAction(), makePlayerStats(), campaignName, null);
    await flow();

    expect(errSpy).toHaveBeenCalledTimes(errors);
  });
});
