// @maintained-by-ai
// DH crit-ledger-shape lane (2026-11-06 improve) — attackRollDamageCalc.js sheet-lane crit
// damage rows carry the monster lane's per-dice-group `*2` marker idiom (playbook §4 "Crit
// damage lane log shape": monster rows log `1d6*2+1 (N)`). Every dice group the base/sneak
// steps ACTUALLY rolled through rollExpressionDoubled gets the marker; flat modifiers never
// do (they don't double on crit). VALUES ARE UNTOUCHED: total still 2×dice+flat and `rolls`
// keeps the single-set shape machine consumers pin — the marker is a formula-string/row-shape
// discriminator only. Non-crit rows stay byte-identical.
//
// Family split: attackRollDamageSteps-damageRolling.test.js owns roller dispatch / EE /
// cunning-cost legs; this file owns the crit formula SHAPE across the base→sneak chain.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hand-derived once (damageRolling.test.js convention): single-set `rolls`, doubled
// totals = 2×(dice sum)+flat, flat kept once.
const ROLL_TABLE = {
  '1d6+1': { total: 4, rolls: [3], modifier: 1 },
  '8d6': { total: 32, rolls: [4, 4, 4, 4, 4, 4, 4, 4], modifier: 0 },
  '8d6+3': { total: 35, rolls: [4, 4, 4, 4, 4, 4, 4, 4], modifier: 3 },
  '9d6': { total: 45, rolls: [5, 5, 5, 5, 5, 5, 5, 5, 5], modifier: 0 },
};
const DOUBLED_TABLE = {
  '1d6+1': { total: 7, rolls: [3], doubledRolls: [3, 3], modifier: 1 },
  '8d6+3': { total: 67, rolls: [4, 4, 4, 4, 4, 4, 4, 4], doubledRolls: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], modifier: 3 },
  '8d6': { total: 64, rolls: [4, 4, 4, 4, 4, 4, 4, 4], doubledRolls: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4], modifier: 0 },
  '9d6': { total: 90, rolls: [5, 5, 5, 5, 5, 5, 5, 5, 5], doubledRolls: [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5], modifier: 0 },
};
const MAXIMIZED_TABLE = {
  '8d6': { total: 48, rolls: [6, 6, 6, 6, 6, 6, 6, 6], modifier: 0, maximized: true },
};
const normKey = (formula) => (formula || '').replace(/\s*\[[^\]]*\]/g, '').replace(/\s+/g, '');

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => ROLL_TABLE[normKey(formula)] ?? null),
  rollExpressionDoubled: vi.fn((formula) => DOUBLED_TABLE[normKey(formula)] ?? null),
  rollExpressionMaximized: vi.fn((formula) => MAXIMIZED_TABLE[normKey(formula)] ?? null),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../automation/common/choiceStorage.js', () => ({
  getChosenRuntimeValue: vi.fn(() => undefined),
}));

vi.mock('../../combat/automation/automationService.js', () => ({
  hasTwoWeaponFighting: vi.fn(() => false),
}));

const { buildRollBaseDamageStep, buildSneakAttackStep } = await import('./attackRollDamageCalc.js');
const { rollExpression, rollExpressionDoubled } = await import('../../dice/diceRoller.js');
const { getRuntimeValue } = await import('../../../hooks/runtime/useRuntimeState.js');

const rollBaseDamage = buildRollBaseDamageStep();
const sneakAttack = buildSneakAttackStep();

function makeCtx(overrides = {}) {
  return {
    attack: { damage: '1d6+1', damageType: 'Piercing' },
    playerStats: {
      name: 'TestChar',
      abilities: [{ name: 'Dexterity', bonus: 5 }],
      automation: { actions: [], passives: [] },
      level: 20,
      proficiency: 6,
    },
    campaignName: 'test-campaign',
    ...overrides,
  };
}

// Runs the REAL base→sneak chain (base step output merged into ctx like the pipeline
// event chain does) and returns the sneak step's row data.
async function runDamageChain(overrides = {}) {
  const ctx = makeCtx(overrides);
  const base = await rollBaseDamage.handler(ctx);
  const sneak = await sneakAttack.handler({ ...ctx, ...base.data, sneakDice: overrides.sneakDice });
  return sneak.data;
}

beforeEach(() => {
  vi.clearAllMocks(); // keeps factory impls (ROLL_TABLE lookups), clears call logs
  getRuntimeValue.mockReturnValue(null);
});

describe('crit ledger shape — *2 marker on every doubled dice group', () => {
  it('crit base row stamps *2 on the base dice group; flat modifier stays single, values untouched', async () => {
    const result = await rollBaseDamage.handler(makeCtx({ isCrit: true }));

    // The roller still receives the UNMARKED formula (marker is post-roll display).
    expect(rollExpressionDoubled).toHaveBeenCalledWith('1d6+1 [piercing]');
    expect(result.data).toEqual({
      formula: '1d6*2+1 [piercing]', // +1 flat NOT doubled
      total: 7, // 2×3 + 1
      rolls: [3], // single set
      modifier: 1,
    });
  });

  it('crit base+sneak chain carries *2 on BOTH dice groups — the backlog example shape', async () => {
    const data = await runDamageChain({ isCrit: true, sneakDice: 9 });

    expect(rollExpressionDoubled).toHaveBeenCalledWith('9d6'); // sneak roller gets raw group
    expect(data).toEqual({
      formula: '1d6*2+1 [piercing] + 9d6*2 [Sneak Attack]',
      total: 97, // 2×(3+45) + 1 — total math unchanged by the marker
      rolls: [3, 5, 5, 5, 5, 5, 5, 5, 5, 5], // single set (no double-listing)
      effectiveSneakDice: 9,
    });
  });

  it('non-crit base+sneak chain stays byte-identical to the pre-fix shape', async () => {
    const data = await runDamageChain({ isCrit: false, sneakDice: 9 });

    expect(rollExpression).toHaveBeenCalledWith('1d6+1 [piercing]');
    expect(rollExpression).toHaveBeenCalledWith('9d6');
    expect(data).toEqual({
      formula: '1d6+1 [piercing] + 9d6 [Sneak Attack]',
      total: 49, // 4 + 45
      rolls: [3, 5, 5, 5, 5, 5, 5, 5, 5, 5],
      effectiveSneakDice: 9,
    });
  });

  it('flat appended adders ([Empowered Evocation]) are never marked or doubled on crit', async () => {
    const result = await rollBaseDamage.handler(makeCtx({
      attack: { damage: '8d6' },
      empoweredEvocationModifier: 3,
      isCrit: true,
    }));

    expect(rollExpressionDoubled).toHaveBeenCalledWith('8d6 + 3 [Empowered Evocation]');
    expect(result.data.formula).toBe('8d6*2 + 3 [Empowered Evocation]');
    expect(result.data.total).toBe(67); // 2×32 + 3 — flat once
  });

  it('cunning-strike cost keeps its *2: crit chain with cost 1 of 10 dice marks the reduced pool', async () => {
    getRuntimeValue.mockImplementation((name, prop) => (prop === '_cunningStrikeCostUsed' ? 1 : null));
    const data = await runDamageChain({ isCrit: true, sneakDice: 10 });

    expect(rollExpressionDoubled).toHaveBeenCalledWith('9d6'); // effective = 10 − 1
    expect(data.formula).toBe('1d6*2+1 [piercing] + 9d6*2 [Sneak Attack]');
    expect(data.effectiveSneakDice).toBe(9);
    expect(data.total).toBe(97);
  });
});
