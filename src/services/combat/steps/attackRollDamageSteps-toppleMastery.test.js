// @maintained-by-ai
// Lane: toppleMastery + masteryDone steps ASSEMBLED via buildAttackRollDamageSteps()
// (attackRollDamageSteps.js:31-32; steps[22] / steps[23]).
// Mechanics named from source (buildToppleMasteryStep attackRollPostDamage.js:663-709): post-hit
// mastery resolution — on lastAttack.hit with Topple as the weapon's BASE mastery, prompts the last
// target for a CON save (DC 8 + weapon ability mod + proficiency, computeToppleSaveDc :629-636),
// announces a save_result (success:null), and on a failed save applies prone via the REAL
// addCondition + stamps activeConditionMeta (handleToppleFailure :638-661). Save-driven, not
// auto-on-hit: a saved target stays untouched. Topple must be baseMastery — extra/choice-list
// Topple still refuses (:679). masteryDone (:711-721) is the terminal { _pipelineComplete:true }.
// Consulted bytes census: getRuntimeValue('campaign','lastAttack',campaign); collectWeaponMastery(
// lastAttack.attackName, playerStats) — NOT ctx.attack.name (byte-source swap pinned in t3);
// writes via addCondition: setRuntimeValue(target,'activeConditions',[...,'prone']) + 'activeConditionMeta'.
// Never calls applyMasteryEffect (weaponMasteryHandler owns that lane — weaponMasteryHandler.test.js).
// Family map — cited, not re-pinned here:
// - Structure (name / subscribe 'tactical:done' / emit 'mastery:done' / masteryDone 'cleave:check'
//   -> 'pipeline:complete' / index order): attackRollDamageSteps.test.js structure lane (:228-247 owner).
// - Tactical-master auto-apply exclusion of Topple: attackRollDamageSteps-tacticalMaster.test.js (#1036).
// - Cleave offer/resolve: attackRollDamageSteps-cleaveMastery.test.js (#1031).
// - collectWeaponMastery collection + mastery-case gate (#969/#970): passives lanes own it;
//   boundary stub here. conditionSaveService aura/immunity suppression: condition-save lanes; stub false here.
// No dice rolled in this lane — dice stubs are inert (#1036-inert); the save roll lives behind the
// mocked createSaveListener promise. Guard legs reach their labeled branch (#1035): every miss-run
// pins not-called side effects, every armed run pins exact call arrays.
// Old->new: condition x3 -> t1 (table); miss-guard + collect-null + no-Topple guards -> t2
// (4 labeled runs, zero-effect pins; byte-source swap at :673); prompt + announce-log + DEX DC +
// STR-default + success-no-write -> t3 (2 runs, exact payloads, byte-source swap at :630/:681);
// apply-prone + failure-logs -> t4 (one run, exact write/log ledger); already-prone zero-write
// (vacuous — fixture lacked creatures so addCondition never ran; source dedupes, never skips the
// write) -> t5 (exact single write ['prone']); masteryDone x3 -> t6. "No target name returns early"
// REMOVED: source has no such guard — it prompts with an undefined targetName; armed path covers
// target bytes honestly.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks (module-graph stubs for the assembled pipeline; this lane rolls no dice —
//    dice/save-prompt stubs stay inert except where the topple lane consults them) ────

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
const { loadCombatSummary } = await import('../../encounters/combatData.js');
const { addEntry } = await import('../../ui/logService.js');
const { collectWeaponMastery } = await import('../../combat/automation/automationService.js');
const { applyMasteryEffect } = await import('../../automation/handlers/combat/weaponMasteryHandler.js');
const { createSaveListener } = await import('../../automation/common/savePrompt.js');

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

// Campaign-keyed runtime stub (#1029): source reads lastAttack under the literal
// characterKey 'campaign' (:670); activeConditions/activeConditionMeta are consulted
// by the real addCondition via the injected getRuntimeValue.
function stubRuntime(lastAttack, extras = {}) {
  getRuntimeValue.mockImplementation((_characterKey, propertyName) => {
    if (propertyName === 'lastAttack') return lastAttack;
    if (propertyName in extras) return extras[propertyName];
    return null;
  });
}

// Always set the consulted bytes (#1035 falsifiability mandate): hit flag,
// targetName, and attackName are all consumed downstream of the guards.
const HIT_ON_ORC = { hit: true, targetName: 'Orc', attackName: 'Greataxe' };

const TOPPLE_BASE = { baseMastery: 'Topple', extraMasteries: [], choiceMasteries: [] };

function toppleStep(steps) {
  return steps.find((s) => s.name === 'toppleMastery');
}

function clearEffects() {
  collectWeaponMastery.mockClear();
  applyMasteryEffect.mockClear();
  createSaveListener.mockClear();
  addEntry.mockClear();
  setRuntimeValue.mockClear();
}

// ── Tests ────────────────────────────────────────────────────────

describe('toppleMastery step (assembled)', () => {
  let steps;

  beforeEach(() => {
    vi.resetAllMocks();
    stubRuntime(HIT_ON_ORC);
    loadCombatSummary.mockResolvedValue({ creatures: [{ name: 'Orc' }] });
    collectWeaponMastery.mockReturnValue(null);
    createSaveListener.mockReturnValue({
      promptId: 'test-prompt-id',
      promise: Promise.resolve({ success: true }),
    });
    steps = buildAttackRollDamageSteps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('t1 condition: armed only with a named attack and playerStats', () => {
    const step = toppleStep(steps);
    const arms = [
      ['armed: attack.name + playerStats', makeCtx({ attack: { name: 'Greataxe' } }), true],
      ['attack.name missing', makeCtx({ attack: {} }), false],
      ['playerStats missing', makeCtx({ attack: { name: 'Greataxe' }, playerStats: null }), false],
    ];
    for (const [label, ctx, expected] of arms) {
      expect(step.condition(ctx) ? true : false, label).toBe(expected);
    }
  });

  it('t2 refuses on guard misses — data {} with zero prompts, logs, or writes', async () => {
    const step = toppleStep(steps);

    // Run A: last attack missed (:671 guard) — mastery collection never consulted.
    const ctxA = makeCtx({ attack: { name: 'Greataxe' } });
    stubRuntime({ hit: false, targetName: 'Orc', attackName: 'Greataxe' });
    const resA = await step.handler(ctxA);
    expect(resA).toEqual({ data: {} });
    expect(getRuntimeValue).toHaveBeenCalledWith('campaign', 'lastAttack', 'test-campaign');
    expect(collectWeaponMastery).not.toHaveBeenCalled();
    expect(createSaveListener).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();

    // Run B: hit but weapon has no mastery data (:674 guard). Byte-source swap:
    // ctx.attack.name is 'Greataxe' but collection must receive lastAttack.attackName (:673).
    clearEffects();
    const ctxB = makeCtx({ attack: { name: 'Greataxe' } });
    stubRuntime({ hit: true, targetName: 'Orc', attackName: 'Longbow' });
    collectWeaponMastery.mockReturnValue(null);
    const resB = await step.handler(ctxB);
    expect(resB).toEqual({ data: {} });
    expect(collectWeaponMastery).toHaveBeenCalledWith('Longbow', ctxB.playerStats);
    expect(createSaveListener).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();

    // Run C: Topple in extraMasteries but NOT base (:677 passes, :679 refuses).
    clearEffects();
    const ctxC = makeCtx({ attack: { name: 'Greataxe' } });
    collectWeaponMastery.mockReturnValue({ baseMastery: 'Push', extraMasteries: ['Topple'], choiceMasteries: [] });
    const resC = await step.handler(ctxC);
    expect(resC).toEqual({ data: {} });
    expect(createSaveListener).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();

    // Run D: Topple in choiceMasteries but NOT base (:677 passes via choice list, :679 refuses).
    clearEffects();
    const ctxD = makeCtx({ attack: { name: 'Greataxe' } });
    collectWeaponMastery.mockReturnValue({ baseMastery: 'Push', extraMasteries: [], choiceMasteries: ['Topple'] });
    const resD = await step.handler(ctxD);
    expect(resD).toEqual({ data: {} });
    expect(createSaveListener).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('t3 armed path: CON save DC sourced from lastAttack bytes; announce logged; saved target untouched', async () => {
    const step = toppleStep(steps);

    // Run A byte-source swap (#1036): ctx.attack.name 'Greataxe' (STR) must be ignored —
    // target 'Goblin', weapon 'Longbow' (DEX 4, prof 3 -> DC 15) come from lastAttack (:681, :630).
    const ctxA = makeCtx({
      attack: { name: 'Greataxe' },
      playerStats: {
        name: 'TestChar',
        abilities: [{ name: 'Strength', bonus: 3 }, { name: 'Dexterity', bonus: 4 }],
        automation: { actions: [], passives: [] },
        proficiency: 3,
        attacks: [{ name: 'Longbow', abilityName: 'Dexterity' }],
      },
    });
    stubRuntime({ hit: true, targetName: 'Goblin', attackName: 'Longbow' });
    collectWeaponMastery.mockReturnValue(TOPPLE_BASE);
    const resA = await step.handler(ctxA);

    expect(resA).toEqual({ data: {} });
    expect(collectWeaponMastery).toHaveBeenCalledWith('Longbow', ctxA.playerStats);
    expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
      targetName: 'Goblin',
      saveType: 'CON',
      saveDc: 15,
    });
    expect(addEntry.mock.calls).toEqual([[
      'test-campaign',
      {
        type: 'save_result',
        characterName: 'TestChar',
        targetName: 'Goblin',
        saveType: 'CON',
        saveDc: 15,
        description: 'Topple: Goblin must make a DC 15 CON save (weapon Dexterity) or fall Prone.',
        success: null,
      },
    ]]);
    // Default save succeeds — saved target gets nothing.
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(applyMasteryEffect).not.toHaveBeenCalled();

    // Run B: weapon entry has no abilityName — defaults to Strength (:631), DC 8+3+3=14.
    clearEffects();
    const ctxB = makeCtx({
      attack: { name: 'Greataxe' },
      playerStats: {
        name: 'TestChar',
        abilities: [{ name: 'Strength', bonus: 3 }],
        automation: { actions: [], passives: [] },
        proficiency: 3,
        attacks: [{ name: 'Greataxe' }],
      },
    });
    stubRuntime(HIT_ON_ORC);
    collectWeaponMastery.mockReturnValue(TOPPLE_BASE);
    await step.handler(ctxB);

    expect(createSaveListener).toHaveBeenCalledWith('test-campaign', {
      targetName: 'Orc',
      saveType: 'CON',
      saveDc: 14,
    });
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('t4 failed save: exact prone write + meta stamp + full log ledger', async () => {
    const step = toppleStep(steps);
    const ctx = makeCtx({ attack: { name: 'Greataxe' } });
    stubRuntime(HIT_ON_ORC);
    collectWeaponMastery.mockReturnValue(TOPPLE_BASE);
    createSaveListener.mockReturnValue({
      promptId: 'test-prompt-id',
      promise: Promise.resolve({ success: false }),
    });

    const result = await step.handler(ctx);

    expect(result).toEqual({ data: {} });
    // Real addCondition (conditionSaveService:152-156): dedupe-append prone, then stamp meta with DC.
    expect(setRuntimeValue.mock.calls).toEqual([
      ['Orc', 'activeConditions', ['prone'], 'test-campaign'],
      ['Orc', 'activeConditionMeta', { prone: { dc: 14, ability: 'CON' } }, 'test-campaign'],
    ]);
    // announce (success:null) -> failed save_result -> ability_use, in order, exact bytes.
    expect(addEntry.mock.calls).toEqual([
      ['test-campaign', {
        type: 'save_result',
        characterName: 'TestChar',
        targetName: 'Orc',
        saveType: 'CON',
        saveDc: 14,
        description: 'Topple: Orc must make a DC 14 CON save (weapon Strength) or fall Prone.',
        success: null,
      }],
      ['test-campaign', {
        type: 'save_result',
        characterName: 'TestChar',
        rollType: 'save-topple',
        targetName: 'Orc',
        saveDc: 14,
        saveType: 'CON',
        success: false,
        description: 'Orc failed CON save vs Topple. Gains Prone condition.',
      }],
      ['test-campaign', {
        type: 'ability_use',
        characterName: 'TestChar',
        abilityName: 'Topple',
        description: 'TestChar used Topple on Orc — target failed CON save (DC 14, weapon Strength), fell Prone.',
        targetName: 'Orc',
      }],
    ]);
    expect(applyMasteryEffect).not.toHaveBeenCalled();
  });

  it('t5 already-prone target: single deduped write of exactly ["prone"]', async () => {
    const step = toppleStep(steps);
    const ctx = makeCtx({ attack: { name: 'Greataxe' } });
    stubRuntime(HIT_ON_ORC, { activeConditions: ['prone'] });
    collectWeaponMastery.mockReturnValue(TOPPLE_BASE);
    createSaveListener.mockReturnValue({
      promptId: 'test-prompt-id',
      promise: Promise.resolve({ success: false }),
    });

    await step.handler(ctx);

    // addCondition filters the existing prone then re-appends: one write, never ['prone','prone'].
    const proneWrites = setRuntimeValue.mock.calls.filter((c) => c[1] === 'activeConditions');
    expect(proneWrites).toEqual([['Orc', 'activeConditions', ['prone'], 'test-campaign']]);
  });
});

describe('masteryDone step (assembled)', () => {
  it('t6 condition always true; terminal payload regardless of context (wiring owned by attackRollDamageSteps.test.js:228-247)', async () => {
    const steps = buildAttackRollDamageSteps();
    const step = steps.find((s) => s.name === 'masteryDone');

    expect(step.condition({})).toBe(true);
    expect(step.condition({ attack: null, playerStats: null })).toBe(true);
    await expect(step.handler({ attack: null, playerStats: null })).resolves.toEqual({
      data: { _pipelineComplete: true },
    });
  });
});
