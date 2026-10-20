// @maintained-by-ai
// Lane: tacticalMaster step ASSEMBLED via buildAttackRollDamageSteps() (attackRollDamageSteps.js:30, steps[21];
// source buildTacticalMasterStep attackRollPostDamage.js:590).
// Mechanics named from source (:570-627): post-hit mastery resolution — reads campaign lastAttack,
// auto-applies non-modal masteries to the last target (skipping Graze/Topple/Nick, choice/replace
// options, and masteries already latched on that exact target; Slow never writes its latch, :583),
// then offers a replace/choice modal when modalOptions exist (:573 replace-precedence).
// Consulted bytes census: getRuntimeValue('campaign','lastAttack'), getRuntimeValue('campaign',
// '_<Mastery>_appliedTarget'); writes: setRuntimeValue('campaign','_<Mastery>_appliedTarget',
// target, campaign), applyMasteryEffect(name, playerStats, campaign, target), setModalState(pending).
// Family map — cited, not re-pinned here:
// - Structure (name / subscribe 'cleave:done' / emit 'tactical:done' / index order):
//   attackRollDamageSteps.test.js structure lane (:228-247 owner).
// - Cleave lane (offer/resolve/map): attackRollDamageSteps-cleaveMastery.test.js (#1031 exemplar).
// - Topple lane (save DC + CON save resolve): attackRollDamageSteps-toppleMastery.test.js.
// - collectWeaponMastery collection + weapon-KIND gate (#969/#970): passives-module lanes own it;
//   it is a boundary stub here.
// No dice/DC math in this lane — dice stubs are inert (never rolled). Logging happens inside
// applyMasteryEffect (weaponMasteryHandler internals), not this step.
// Old->new: condition x3 -> t1 (table); miss-guard + null-mastery-guard -> t2 (zero-write pins);
// auto-apply Push/Sap + skip Graze/Topple/Nick + already-applied skip + Slow-latch-except -> t3
// (two labeled runs, exact call arrays); replace-modal -> t4 (exact full payload); choice-mode
// featureName threading -> t5 (exact full payload, replace-empty fallback + distinct byte sources).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks (module-graph stubs for the assembled pipeline; the tacticalMaster lane
//    rolls no dice and prompts no saves — those stubs stay inert) ───────────────

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
  rollExpressionDoubled: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  loadCombatSummary: vi.fn(),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve({})),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
  hasTwoWeaponFighting: vi.fn(() => false),
  collectWeaponMastery: vi.fn(),
  playerIsImmuneToCondition: vi.fn(() => false),
}));

vi.mock('../../rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(),
}));

vi.mock('../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  getAttackRiderOptions: vi.fn(() => Promise.resolve([])),
  getAttackRiderOptionsByContext: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../combat/prompts/bardicInspirationPromptUtils.js', () => ({
  sendBardicInspirationOffensePrompt: vi.fn(),
}));

vi.mock('../../combat/auras/bardicInspirationState.js', () => ({
  hasBardicInspirationOffense: vi.fn(() => false),
  getBardicInspirationDieSize: vi.fn(() => null),
}));

vi.mock('../../automation/common/resourceCheck.js', () => ({
  spendResource: vi.fn(),
}));

vi.mock('../../automation/common/buffToggle.js', () => ({
  getActiveBuffs: vi.fn(() => []),
}));

vi.mock('../../ui/utils.js', () => ({
  default: { guid: () => 'test-guid-123' },
}));

vi.mock('./features/index.js', () => ({
  featureModules: [],
}));

vi.mock('../../automation/handlers/combat/weaponMasteryHandler.js', () => ({
  applyMasteryEffect: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../rules/combat/rangeValidation.js', () => ({
  getDistanceFeet: vi.fn(() => 3),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isDistanceInRange: vi.fn(),
  isWithinRange: vi.fn(),
}));

vi.mock('../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

const { buildAttackRollDamageSteps } = await import('./attackRollDamageSteps.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');
const { collectWeaponMastery } = await import('../../combat/automation/automationService.js');
const { applyMasteryEffect } = await import('../../automation/handlers/combat/weaponMasteryHandler.js');

// ── Helpers ───────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
  return {
    attack: {},
    playerStats: {
      name: 'TestChar',
      abilities: [{ name: 'Strength', bonus: 3 }],
      automation: { actions: [], passives: [] },
      level: 5,
      proficiency: 3,
    },
    proceedWithDamage: vi.fn(),
    campaignName: 'test-campaign',
    ...overrides,
  };
}

// Campaign-keyed runtime stub (#1029): lastAttack + optional mastery latches.
// Source reads latches under the literal characterKey 'campaign' (:581).
function stubRuntime(lastAttack, latches = {}) {
  getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
    if (propertyName === 'lastAttack') return lastAttack;
    if (propertyName in latches) return latches[propertyName];
    return null;
  });
}

// Always set the consulted bytes (#1035 falsifiability mandate): hit flag,
// targetName, and attackName are all consumed downstream of the guards.
const HIT_ON_ORC = { hit: true, targetName: 'Orc', attackName: 'Greataxe' };

function tacticalStep(steps) {
  return steps.find((s) => s.name === 'tacticalMaster');
}

// ── Tests ────────────────────────────────────────────────────────

describe('tacticalMaster step (assembled)', () => {
  let steps;

  beforeEach(() => {
    vi.resetAllMocks();
    collectWeaponMastery.mockReturnValue(null);
    applyMasteryEffect.mockResolvedValue(undefined);
    stubRuntime(HIT_ON_ORC);
    steps = buildAttackRollDamageSteps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('condition: armed only with a named attack and automation data', () => {
    const step = tacticalStep(steps);
    const arms = [
      ['armed: attack.name + automation', makeCtx({ attack: { name: 'Greataxe' } }), true],
      ['attack.name missing', makeCtx({ attack: {} }), false],
      ['playerStats.automation missing', makeCtx({ attack: { name: 'Greataxe' }, playerStats: { name: 'TestChar' } }), false],
    ];
    for (const [label, ctx, expected] of arms) {
      expect(step.condition(ctx) ? true : false, label).toBe(expected);
    }
  });

  it('refuses on guard misses — data {} and zero writes, applies, or prompts', async () => {
    const step = tacticalStep(steps);

    // Run A: last attack missed (:598 guard) — mastery collection never even consulted.
    const ctxA = makeCtx({ attack: { name: 'Greataxe' }, setModalState: vi.fn() });
    stubRuntime({ hit: false, targetName: 'Orc', attackName: 'Greataxe' });
    const resA = await step.handler(ctxA);
    expect(resA.data).toEqual({ });
    expect(resA.modal).toBeUndefined();
    expect(collectWeaponMastery).not.toHaveBeenCalled();
    expect(applyMasteryEffect).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(ctxA.setModalState).not.toHaveBeenCalled();

    // Run B: hit but no masteries on this weapon (:601 guard) — boundary passthrough pinned.
    const ctxB = makeCtx({ attack: { name: 'Greataxe' }, setModalState: vi.fn() });
    stubRuntime(HIT_ON_ORC);
    collectWeaponMastery.mockReturnValue(null);
    const resB = await step.handler(ctxB);
    expect(resB.data).toEqual({});
    expect(resB.modal).toBeUndefined();
    expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', 'test-campaign');
    expect(collectWeaponMastery).toHaveBeenCalledWith('Greataxe', ctxB.playerStats);
    expect(applyMasteryEffect).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(ctxB.setModalState).not.toHaveBeenCalled();
  });

  it('auto-apply lane: exclusion list, exact-target latch, Slow writes no latch, exact payloads', async () => {
    const step = tacticalStep(steps);

    // Run A math, derived by hand once (source :570-587):
    //   allMasteries   = [Push, Slow, Sap, Graze, Topple, Nick]
    //   autoApply      = allMasteries minus [Graze, Topple, Nick, ...choice, ...replace]
    //                  = [Push, Slow, Sap]
    //   loop: Push latched on 'Orc' -> skip (:582);  Slow -> apply, NO latch write (:583);
    //         Sap -> latch 'campaign/_Sap_appliedTarget'='Orc' + apply.
    //   modalOptions [] -> terminal { data: {} } (:609).
    const ctxA = makeCtx({ attack: { name: 'Greataxe' }, setModalState: vi.fn() });
    stubRuntime(HIT_ON_ORC, { '_Push_appliedTarget': 'Orc' });
    collectWeaponMastery.mockReturnValue({
      baseMastery: 'Push',
      extraMasteries: ['Slow', 'Sap', 'Graze', 'Topple', 'Nick'],
      replaceMasteryOptions: [],
      choiceMasteries: [],
    });
    const resA = await step.handler(ctxA);

    expect(resA).toEqual({ data: {} });
    expect(applyMasteryEffect.mock.calls).toEqual([
      ['Slow', ctxA.playerStats, 'test-campaign', 'Orc'],
      ['Sap', ctxA.playerStats, 'test-campaign', 'Orc'],
    ]);
    expect(setRuntimeValue.mock.calls).toEqual([
      ['campaign', '_Sap_appliedTarget', 'Orc', 'test-campaign'],
    ]);
    expect(getRuntimeValue).toHaveBeenCalledWith('campaign', '_Push_appliedTarget', 'test-campaign');
    expect(ctxA.setModalState).not.toHaveBeenCalled();

    // Run B: latch holds a DIFFERENT target ('Goblin' !== 'Orc') — the === comparison at
    // :582 must still allow re-application and overwrite the latch to the current target.
    applyMasteryEffect.mockClear();
    setRuntimeValue.mockClear();
    const ctxB = makeCtx({ attack: { name: 'Greataxe' }, setModalState: vi.fn() });
    stubRuntime(HIT_ON_ORC, { '_Sap_appliedTarget': 'Goblin' });
    collectWeaponMastery.mockReturnValue({ baseMastery: 'Sap' });
    const resB = await step.handler(ctxB);

    expect(resB).toEqual({ data: {} });
    expect(applyMasteryEffect).toHaveBeenCalledWith('Sap', ctxB.playerStats, 'test-campaign', 'Orc');
    expect(setRuntimeValue.mock.calls).toEqual([
      ['campaign', '_Sap_appliedTarget', 'Orc', 'test-campaign'],
    ]);
    expect(ctxB.setModalState).not.toHaveBeenCalled();
  });

  it('replace-options modal: exact pending bytes, same bytes to setModalState, auto lane runs first', async () => {
    const ctx = makeCtx({ attack: { name: 'Greataxe' }, setModalState: vi.fn() });
    stubRuntime(HIT_ON_ORC);
    collectWeaponMastery.mockReturnValue({
      baseMastery: 'Push',
      replaceMasteryOptions: ['Sap', 'Vex'],
    });
    const result = await tacticalStep(steps).handler(ctx);

    // autoApply = [Push] (base not in replace list) runs before the modal offer (:607).
    expect(applyMasteryEffect.mock.calls).toEqual([
      ['Push', ctx.playerStats, 'test-campaign', 'Orc'],
    ]);
    expect(result).toEqual({
      data: { _tacticalMasterPending: true },
      modal: {
        type: 'tacticalMaster',
        props: {
          attackName: 'Greataxe',
          baseMastery: 'Push',
          replaceOptions: ['Sap', 'Vex'],
          targetName: 'Orc',
          isChoiceMode: false,
          featureName: null,
        },
      },
    });
    // Pending runtime bytes are byte-identical to modal props (:611-623).
    expect(ctx.setModalState).toHaveBeenCalledWith({
      tacticalMasterPending: result.modal.props,
    });
  });

  it('choice-mode fallback: empty replace list falls to choiceMasteries, featureName threaded, props sourced from lastAttack not ctx.attack', async () => {
    // ctx.attack.name ('Longsword') differs from lastAttack.attackName ('Warhammer'):
    // modal props must come from lastAttack (:613), falsifying a byte-source swap.
    const ctx = makeCtx({ attack: { name: 'Longsword' }, setModalState: vi.fn() });
    stubRuntime({ hit: true, targetName: 'Goblin', attackName: 'Warhammer' });
    collectWeaponMastery.mockReturnValue({
      baseMastery: 'Sap',
      replaceMasteryOptions: [],
      choiceMasteries: ['Push', 'Topple'],
      featureName: 'Battering Roots',
    });
    const result = await tacticalStep(steps).handler(ctx);

    // autoApply = [Sap] (choice list [Push, Topple] excluded from auto-apply, :575).
    expect(applyMasteryEffect.mock.calls).toEqual([
      ['Sap', ctx.playerStats, 'test-campaign', 'Goblin'],
    ]);
    expect(setRuntimeValue.mock.calls).toEqual([
      ['campaign', '_Sap_appliedTarget', 'Goblin', 'test-campaign'],
    ]);
    expect(result).toEqual({
      data: { _tacticalMasterPending: true },
      modal: {
        type: 'tacticalMaster',
        props: {
          attackName: 'Warhammer',
          baseMastery: 'Sap',
          replaceOptions: ['Push', 'Topple'],
          targetName: 'Goblin',
          isChoiceMode: true,
          featureName: 'Battering Roots',
        },
      },
    });
    expect(ctx.setModalState).toHaveBeenCalledWith({
      tacticalMasterPending: result.modal.props,
    });
  });
});
