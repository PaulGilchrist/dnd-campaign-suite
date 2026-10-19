// @maintained-by-ai
// attackRollDamageSteps-bonuses-basic lane: owns steps[8..10] built by attackRollDamageCalc.js
// (buildTwoWeaponFightingStep / buildTargetEffectsStep / buildSuperiorityDieBonusesStep).
// Names, index order, and the subscribe/emit chain are pinned by attackRollDamageSteps.test.js;
// generic modal/oncePerTurn/uses/stamp guards are CANON in attackRollDamageSteps-automationBonuses.test.js
// (#1029) — not duplicated here. Exact bytes hand-derived once (#815/#710); deterministic dice
// stub follows the #1026 convention (NdM → each die floor(M/2)+1: 1d4→3, 1d6→4, 1d8→5);
// exact full-acc toEqual never range-only or toContain (#829/#953/#973); store bytes are
// campaign-keyed (#1021); every guard is a latch-falsifier with zero-writes pins (#934/#1029);
// labels distinguishable-bytes (#1022); honest titles (#910); falsifiable (#842); no wall-clock (#app).
//
// old->new map: TWF condition×4 → t1; TWF guard handlers×6 → t2 (table, each exact {} +
// zero-writes); TWF gain → t3 exact full-acc. targetEffects condition → t4 (shared with
// superiority); TE guard handlers×3 → t5 (table + zero-writes); TE add/damageType-fallback/
// multiple(teak toContain) → t6 one-call label ladder exact full-acc + cleanup pin;
// TE same_as_weapon → t7; TE null-roll → t8 (skip but still clear). Superiority consume×6 +
// commanderStrike → t9 one-call consume-all exact full-acc + exact 8-writes pin (#786);
// lunging melee/unarmed/ranged×3 → t10 (gate pair); zero/null + no-values + isMeleeFlag → t11;
// cs default-label → t12 (source-stamp-vs-fallback discriminator, mega-test uses a custom stamp).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../dice/diceRoller.js', () => ({
  // Deterministic stub (#1026): NdM → each die floor(M/2)+1. Unparseable → null (skip).
  rollExpression: vi.fn((formula) => {
    if (!formula || formula === '0') return null;
    const baseFormula = formula.replace(/\s*\[.*?\]\s*/g, '').trim();
    if (!baseFormula) return null;
    const match = baseFormula.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
    if (match) {
      const count = parseInt(match[1], 10);
      const sides = parseInt(match[2], 10);
      const modStr = match[3] ? parseInt(match[3], 10) : 0;
      const rolls = Array(count).fill(Math.floor(sides / 2) + 1);
      const total = rolls.reduce((s, r) => s + r, 0) + modStr;
      return { total, rolls, modifier: modStr };
    }
    const numMatch = baseFormula.match(/^(\d+)$/);
    if (numMatch) {
      const val = parseInt(numMatch[1], 10);
      return { total: val, rolls: [val], modifier: 0 };
    }
    return null;
  }),
  // Only used by this lane's siblings' handlers (rollBaseDamage/sneak) — never run here.
  rollExpressionDoubled: vi.fn(),
  rollExpressionMaximized: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  loadCombatSummary: vi.fn(() => Promise.resolve({ lastAttack: {} })),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
  hasTwoWeaponFighting: vi.fn(() => false),
  collectWeaponMastery: vi.fn(),
  evaluateAutoExpression: vi.fn(),
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

vi.mock('../../automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: 'test-prompt-id', promise: Promise.resolve({ success: true }) })),
}));

// ── Imports ──────────────────────────────────────────────────────

const { buildAttackRollDamageSteps } = await import('./attackRollDamageSteps.js');
const { rollExpression } = await import('../../dice/diceRoller.js');
const { hasTwoWeaponFighting } = await import('../../combat/automation/automationService.js');
const { getRuntimeValue, setRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');

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

// ── Tests ────────────────────────────────────────────────────────

describe('attackRollDamageSteps basic-bonus lane — steps[8] twoWeaponFighting, steps[9] targetEffects, steps[10] superiorityDieBonuses', () => {
  let steps;

  beforeEach(() => {
    vi.resetAllMocks();
    steps = buildAttackRollDamageSteps();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('t1: twoWeaponFighting condition — true only for bonus-action attacks with playerStats', () => {
    expect(steps[8].condition(makeCtx({ isBonusActionAttack: true }))).toBe(true);
    expect(steps[8].condition(makeCtx({ isBonusActionAttack: false }))).toBe(false);
    expect(steps[8].condition(makeCtx())).toBeFalsy();
    expect(steps[8].condition(makeCtx({ isBonusActionAttack: true, playerStats: null }))).toBe(false);
  });

  // t2: every early-return arm in one falsifiable table; the step authors NO runtime
  // writes on any path — zero-writes pin falsifies an unconditional-store variant (#934).
  it('t2: twoWeaponFighting adds nothing on every guard path and writes nothing', async () => {
    const light = { properties: ['Light'], abilityName: 'Dexterity' };
    const stats = (bonus) => ({ abilities: [{ name: 'Dexterity', bonus }] });
    const cases = [
      ['no two-weapon-fighting feature', false, { attack: light, playerStats: stats(3), formula: '1d6', total: 4, rolls: [1] }],
      ['weapon property is not Light', true, { attack: { ...light, properties: ['Finesse'] }, playerStats: stats(3), formula: '1d6', total: 4, rolls: [1] }],
      ['attack has no abilityName', true, { attack: { properties: ['Light'] }, playerStats: stats(3), formula: '1d6', total: 4, rolls: [1] }],
      ['ability modifier is 0', true, { attack: light, playerStats: stats(0), formula: '1d6', total: 4, rolls: [4] }],
      ['ability modifier is negative', true, { attack: light, playerStats: stats(-2), formula: '1d6', total: 4, rolls: [4] }],
      ['modifier already folded into formula', true, { attack: light, playerStats: stats(3), formula: '1d8+3[Dexterity]', total: 11, rolls: [8] }],
    ];

    for (const [label, hasFeature, overrides] of cases) {
      hasTwoWeaponFighting.mockReturnValue(hasFeature);
      const result = await steps[8].handler(makeCtx({ isBonusActionAttack: true, ...overrides }));
      expect(result.data, label).toEqual({});
    }
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('t3: twoWeaponFighting adds the +3 Dexterity modifier to off-hand damage once', async () => {
    hasTwoWeaponFighting.mockReturnValue(true);
    const ctx = makeCtx({
      isBonusActionAttack: true,
      attack: { properties: ['Light'], abilityName: 'Dexterity' },
      playerStats: { abilities: [{ name: 'Dexterity', bonus: 3 }] },
      formula: '1d6',
      total: 4,
      rolls: [1],
    });
    const result = await steps[8].handler(ctx);

    expect(result.data).toEqual({ formula: '1d6 + 3 [Dexterity]', total: 7, rolls: [1, 3] });
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('t4: targetEffects and superiorityDieBonuses conditions always run', () => {
    expect(steps[9].condition({})).toBe(true);
    expect(steps[9].condition({ attack: null })).toBe(true);
    expect(steps[10].condition({})).toBe(true);
  });

  // t5: guards return exact {} and short-circuit BEFORE the cleanup write —
  // zero-writes pin is the latch falsifier of the riders.length===0 early return.
  it('t5: targetEffects writes nothing when empty store, non-array store, or no damage_bonus entries', async () => {
    const cases = [
      ['empty store', null],
      ['non-array store', 'not-an-array'],
      ['store without damage_bonus entries', [{ effect: 'push', value: 5 }]],
    ];

    for (const [label, raw] of cases) {
      getRuntimeValue.mockReturnValue(raw);
      const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
      const result = await steps[9].handler(ctx);
      expect(result.data, label).toEqual({});
    }
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  it('t6: targetEffects appends every damage_bonus roll with exact labels and clears only consumed entries', async () => {
    const push = { effect: 'push', value: 5 };
    getRuntimeValue.mockReturnValue([
      { effect: 'damage_bonus', damageExpression: '1d4', label: 'Radiant Hex' },
      { effect: 'damage_bonus', damageExpression: '1d4', damageType: 'Cold' },
      { effect: 'damage_bonus', damageExpression: '1d4' },
      push,
    ]);

    const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3], attack: { damageType: 'Slashing' } });
    const result = await steps[9].handler(ctx);

    // Label ladder: te.label verbatim > te.damageType lowered > attack damageType lowered.
    // Each 1d4 stubs to 3 (#1026): total 11+3+3+3 = 20.
    expect(result.data).toEqual({
      formula: '1d8+3 + 1d4 [Radiant Hex] + 1d4 [cold] + 1d4 [slashing]',
      total: 20,
      rolls: [8, 3, 3, 3, 3],
    });
    expect(setRuntimeValue.mock.calls).toEqual([['campaign', 'targetEffects', [push], 'test-campaign']]);
  });

  it('t7: targetEffects labels same_as_weapon when neither effect nor attack names a damage type', async () => {
    getRuntimeValue.mockReturnValue([{ effect: 'damage_bonus', damageExpression: '1d6' }]);

    const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    const result = await steps[9].handler(ctx);

    // 1d6 stubs to 4 (#1026): total 11+4 = 15.
    expect(result.data).toEqual({ formula: '1d8+3 + 1d6 [same_as_weapon]', total: 15, rolls: [8, 3, 4] });
    expect(setRuntimeValue.mock.calls).toEqual([['campaign', 'targetEffects', [], 'test-campaign']]);
  });

  it('t8: targetEffects skips a bonus whose roll returns null but still clears damage_bonus entries', async () => {
    getRuntimeValue.mockReturnValue([
      { effect: 'damage_bonus', damageExpression: '1d4' },
      { effect: 'push', value: 5 },
    ]);
    rollExpression.mockReturnValue(null);

    const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    const result = await steps[9].handler(ctx);

    expect(result.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    expect(setRuntimeValue.mock.calls).toEqual([[
      'campaign', 'targetEffects', [{ effect: 'push', value: 5 }], 'test-campaign',
    ]]);
  });

  // t9: one call consumes ALL six pending die stores in pipeline order with
  // distinguishable bytes (2,3,4,5,6,7) — labels lowered except 'Bardic Inspiration'
  // and the verbatim Commander's Strike source stamp (#1022/#786 collaborators-once).
  it('t9: superiorityDieBonuses consumes every pending die in order, exact damage acc, then clears all eight store keys', async () => {
    getRuntimeValue.mockImplementation((_key, prop) => ({
      feintingAttackDieValue: 2,
      bardicInspirationOffenseValue: 3,
      pendingRiposteDieValue: 4,
      attackRiderDieValue: 5,
      lungingAttackDieValue: 6,
      commanderStrikeBonus: 7,
      commanderStrikeSource: "Commander's Fury",
    })[prop] ?? null);

    const ctx = makeCtx({
      formula: '1d8+3',
      total: 11,
      rolls: [8, 3],
      attack: { weaponType: 'melee', damageType: 'Slashing' },
    });
    const result = await steps[10].handler(ctx);

    expect(result.data).toEqual({
      formula: "1d8+3 + 2 [slashing] + 3 [Bardic Inspiration] + 4 [slashing] + 5 [slashing] + 6 [slashing] + 7 [Commander's Fury]",
      total: 38,
      rolls: [8, 3, 2, 3, 4, 5, 6, 7],
      isMeleeOrUnarmed: true,
    });
    expect(setRuntimeValue.mock.calls).toEqual([
      ['TestChar', 'feintingAttackDieValue', null, 'test-campaign'],
      ['TestChar', 'bardicInspirationOffenseValue', null, 'test-campaign'],
      ['TestChar', 'pendingRiposteDieValue', null, 'test-campaign'],
      ['TestChar', 'attackRiderDieValue', null, 'test-campaign'],
      ['TestChar', 'lungingAttackDieValue', null, 'test-campaign'],
      ['TestChar', 'commanderStrikeBonus', null, 'test-campaign'],
      ['TestChar', 'commanderStrikeActive', null, 'test-campaign'],
      ['TestChar', 'commanderStrikeSource', null, 'test-campaign'],
    ]);
  });

  // t10: weaponType gate — ranged must NOT consume lunge (zero-writes falsifier);
  // unarmed must consume, carrying its own bludgeoning label.
  it('t10: lungingAttackDieValue is consumed only for melee/unarmed, never ranged', async () => {
    getRuntimeValue.mockImplementation((_key, prop) => (prop === 'lungingAttackDieValue' ? 6 : null));

    const ranged = await steps[10].handler(makeCtx({
      formula: '1d8+3', total: 11, rolls: [8, 3], attack: { weaponType: 'ranged' },
    }));
    expect(ranged.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3], isMeleeOrUnarmed: false });
    expect(setRuntimeValue).not.toHaveBeenCalled();

    setRuntimeValue.mockClear();
    const unarmed = await steps[10].handler(makeCtx({
      formula: '1d8+3', total: 11, rolls: [8, 3], attack: { weaponType: 'unarmed', damageType: 'bludgeoning' },
    }));
    expect(unarmed.data).toEqual({ formula: '1d8+3 + 6 [bludgeoning]', total: 17, rolls: [8, 3, 6], isMeleeOrUnarmed: true });
    expect(setRuntimeValue.mock.calls).toEqual([['TestChar', 'lungingAttackDieValue', null, 'test-campaign']]);
  });

  it('t11: superiorityDieBonuses consumes nothing and writes nothing when every pending value is zero or null', async () => {
    getRuntimeValue.mockReturnValue(0);

    const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3], attack: { weaponType: 'melee' } });
    const result = await steps[10].handler(ctx);

    expect(result.data).toEqual({ formula: '1d8+3', total: 11, rolls: [8, 3], isMeleeOrUnarmed: true });
    expect(setRuntimeValue).not.toHaveBeenCalled();
  });

  // t12: discriminator vs t9 — there the source stamp was read; here it is absent,
  // so the fallback label must appear with identical clear-writes.
  it('t12: commanderStrike folds with the default label when the source stamp is absent', async () => {
    getRuntimeValue.mockImplementation((_key, prop) => (prop === 'commanderStrikeBonus' ? 7 : null));

    const ctx = makeCtx({ formula: '1d8+3', total: 11, rolls: [8, 3] });
    const result = await steps[10].handler(ctx);

    expect(result.data).toEqual({
      formula: "1d8+3 + 7 [Commander's Strike]",
      total: 18,
      rolls: [8, 3, 7],
      isMeleeOrUnarmed: false,
    });
    expect(setRuntimeValue.mock.calls).toEqual([
      ['TestChar', 'commanderStrikeBonus', null, 'test-campaign'],
      ['TestChar', 'commanderStrikeActive', null, 'test-campaign'],
      ['TestChar', 'commanderStrikeSource', null, 'test-campaign'],
    ]);
  });
});
