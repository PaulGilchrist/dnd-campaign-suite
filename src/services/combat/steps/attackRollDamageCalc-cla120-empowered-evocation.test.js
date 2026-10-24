// @maintained-by-ai
// CLA-120 lane — attackRollDamageCalc.js buildRollBaseDamageStep (rollBaseDamage).
// Rule (5e Evocation 10th level, Empowered Evocation): when you cast an evocation
// spell that deals damage, you add your Intelligence modifier to that damage roll.
// Single owner of the gate: execution/index.js computeEmpoweredEvocation selects the
// evocation spell and may pre-bake " + N [Empowered Evocation]" into attack.damage /
// autoFormulaOverride (CLA-279 Radiant Soul dedupe shape). This lane owns ONLY the
// step's idempotency: fold the INT term exactly once — never re-append a pre-baked
// term; append once (with [damageType] tag before it) when the formula is unmarked.
//
// Family split (CLA-120 INT fold):
//   attackRollDamageSteps-damageRolling.test.js        same handler, generic append (mod>0) / skip (mod 0 & negative) — owned there
//   directSpellDamageSteps-cla120-empowered-evocation.test.js  spellContext fold-exactly-once seam
//   attackPostProcessing-cla120-potent-cantrip.test.js         potent-cantrip miss-half fold seam
//
// old -> new map:
//   'does NOT re-append when attack.damage already carries [EE]'  ┐ co-located falsifiable
//   'does NOT re-append via autoFormulaOverride'                   ┘ legs, folded (two-call shape, exact bytes)
//   'appends the INT term exactly once (PASS control)'               strengthened: exact total + rolled-bytes pin
//   'mod 0 -> zero [EE] terms'                                       removed — owner: damageRolling skip tests (same handler)
//
// fix#350(b) owner-pin STATUS (QUEUED-OWNER, re-verified at current bytes 2026-10-24):
// the `empEvocMod > 0` re-floor at attackRollDamageCalc.js:77 is PINNED-BY-OWNER (#1027)
// — owner arbitration owed, NOT a silent flip. Negative-INT floor truth is honestly
// pinned in the owner lane attackRollDamageSteps-damageRolling.test.js:169-185
// ('skips the [Empowered Evocation] append when modifier is 0 or negative'). No edit
// made here or in production; this header is the queue pointer only.
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Deterministic roller seam: exact bytes in, exact totals out (derived once, never a
// loop-oracle). Unknown formulas roll null → step returns null → loud failure.
const ROLL_TABLE = {
  '4d10+5': { total: 29, rolls: [6, 6, 6, 6, 5], modifier: 5 },
  '4d10': { total: 24, rolls: [6, 6, 6, 6], modifier: 0 },
  '2d8+5': { total: 15, rolls: [5, 5, 5], modifier: 5 },
};

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    const key = formula.replace(/\s*\[[^\]]*\]/g, '').replace(/\s+/g, '');
    return ROLL_TABLE[key] ?? null;
  }),
  rollExpressionDoubled: vi.fn(() => { throw new Error('crit roller must not run on a non-crit fixture'); }),
  rollExpressionMaximized: vi.fn(() => { throw new Error('maximized roller must not run without overchannel'); }),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => undefined),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
  hasTwoWeaponFighting: vi.fn(() => false),
}));

const { buildRollBaseDamageStep } = await import('./attackRollDamageCalc.js');
const { rollExpression } = await import('../../dice/diceRoller.js');

function makeCtx(overrides = {}) {
  return {
    attack: {},
    playerStats: { name: 'TestWizard', automation: { passives: [], actions: [] } },
    campaignName: 'test-campaign',
    ...overrides,
  };
}

describe('rollBaseDamage — CLA-120 Empowered Evocation folds INT exactly once', () => {
  let step;

  beforeEach(() => {
    vi.clearAllMocks();
    step = buildRollBaseDamageStep();
  });

  it('never re-appends a pre-baked [Empowered Evocation] term (execution-owned)', async () => {
    // Lane 1: cast-resolution baked "+ 5 [Empowered Evocation]" into attack.damage.
    const baked = await step.handler(makeCtx({
      attack: { damage: '4d10 + 5 [Empowered Evocation]', damageType: 'Fire' },
      empoweredEvocationModifier: 5,
    }));
    expect(baked.data.formula).toBe('4d10 + 5 [Empowered Evocation] [fire]');
    expect(baked.data.total).toBe(29); // 6+6+6+6 dice + 5 INT, derived once
    expect(baked.data.modifier).toBe(5);
    expect(rollExpression).toHaveBeenCalledWith('4d10 + 5 [Empowered Evocation] [fire]');

    // Lane 2: pre-baked term arrives via autoFormulaOverride instead.
    const override = await step.handler(makeCtx({
      autoFormulaOverride: '2d8 + 5 [Empowered Evocation]',
      empoweredEvocationModifier: 5,
    }));
    expect(override.data.formula).toBe('2d8 + 5 [Empowered Evocation]');
    expect(override.data.total).toBe(15); // 5+5 dice + 5 INT, derived once
  });

  it('appends the INT term exactly once to an unmarked formula (PASS falsifier)', async () => {
    const result = await step.handler(makeCtx({
      attack: { damage: '4d10', damageType: 'Fire' },
      empoweredEvocationModifier: 5,
    }));
    expect(result.data.formula).toBe('4d10 [fire] + 5 [Empowered Evocation]');
    expect(result.data.total).toBe(29);
    expect(result.data.modifier).toBe(5);
    expect(rollExpression).toHaveBeenCalledWith('4d10 [fire] + 5 [Empowered Evocation]');
  });
});
