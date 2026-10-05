// CLA-120: rollBaseDamage must never append a second [Empowered Evocation] term
// when cast-resolution (execution/index.js computeEmpoweredEvocation) already
// baked the INT adder into the damage formula (CLA-279 Radiant Soul idempotency).
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    if (!formula || formula === '0') return null;
    const baseFormula = formula.replace(/\s*\[.*?\]\s*/g, '').replace(/\s+/g, '').trim();
    if (!baseFormula) return null;
    const match = baseFormula.match(/^(\d+)d(\d+)((?:[+-]\d+)+)?$/i);
    if (match) {
      const count = parseInt(match[1], 10);
      const sides = parseInt(match[2], 10);
      const modifier = match[3] ? match[3].match(/[+-]\d+/g).reduce((s, m) => s + parseInt(m, 10), 0) : 0;
      const rolls = Array(count).fill(Math.floor(sides / 2) + 1);
      const total = rolls.reduce((s, r) => s + r, 0) + modifier;
      return { total, rolls, modifier };
    }
    return { total: 6, rolls: [6], modifier: 0 };
  }),
  rollExpressionDoubled: vi.fn((_formula) => ({ total: 12, rolls: [6], modifier: 0 })),
  rollExpressionMaximized: vi.fn((_formula) => ({ total: 12, rolls: [6], modifier: 0, maximized: true })),
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

function makeCtx(overrides = {}) {
  return {
    attack: {},
    playerStats: {
      name: 'DivinationWizard',
      abilities: [{ name: 'Intelligence', bonus: 5 }],
      automation: { passives: [], actions: [] },
    },
    campaignName: 'test-campaign',
    isCrit: false,
    ...overrides,
  };
}

describe('rollBaseDamage — CLA-120 Empowered Evocation folds INT exactly once', () => {
  let step;

  beforeEach(() => {
    vi.clearAllMocks();
    step = buildRollBaseDamageStep();
  });

  it('does NOT re-append when attack.damage already carries [Empowered Evocation] (execution-owned)', async () => {
    const ctx = makeCtx({
      attack: { damage: '4d10 + 5 [Empowered Evocation]', damageType: 'Fire' },
      empoweredEvocationModifier: 5,
    });
    const result = await step.handler(ctx);
    expect(result.data.formula).toBe('4d10 + 5 [Empowered Evocation] [fire]');
    expect(result.data.formula.match(/\[Empowered Evocation\]/g)).toHaveLength(1);
    expect(result.data.modifier).toBe(5);
    expect(result.data.total).toBe(24 + 5);
  });

  it('does NOT re-append via autoFormulaOverride carrying the labeled term', async () => {
    const ctx = makeCtx({
      autoFormulaOverride: '4d10 + 5 [Empowered Evocation]',
      empoweredEvocationModifier: 5,
    });
    const result = await step.handler(ctx);
    expect(result.data.formula.match(/\[Empowered Evocation\]/g)).toHaveLength(1);
    expect(result.data.modifier).toBe(5);
  });

  it('appends the INT term exactly once to an unmarked formula (PASS control)', async () => {
    const ctx = makeCtx({
      attack: { damage: '4d10', damageType: 'Fire' },
      empoweredEvocationModifier: 5,
    });
    const result = await step.handler(ctx);
    expect(result.data.formula).toBe('4d10 [fire] + 5 [Empowered Evocation]');
    expect(result.data.formula.match(/\[Empowered Evocation\]/g)).toHaveLength(1);
  });

  it('mod 0 → zero [Empowered Evocation] terms (non-holder / zero-mod control)', async () => {
    const ctx = makeCtx({
      attack: { damage: '4d12', damageType: 'Poison' },
      empoweredEvocationModifier: 0,
    });
    const result = await step.handler(ctx);
    expect(result.data.formula).toBe('4d12 [poison]');
    expect(result.data.formula).not.toContain('[Empowered Evocation]');
  });
});
