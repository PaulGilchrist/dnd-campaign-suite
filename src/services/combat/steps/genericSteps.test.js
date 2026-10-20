// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildGenericSteps } from './genericSteps.js';

// Deterministic diceRoller stub (sibling convention #829/#815: NdM → each die floor(M/2)+1).
// Unparseable formulas return null, mirroring the real rollExpression contract (diceRoller.js:110),
// so the wrong formula fails loudly via the exact-data assertions instead of silently matching.
vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    const m = /^(\d*)d(\d+)([+-]\d+)?$/i.exec(formula || '');
    if (!m) return null;
    const count = Number(m[1] || 1);
    const sides = Number(m[2]);
    const modifier = Number(m[3] || 0);
    const rolls = Array(count).fill(Math.floor(sides / 2) + 1);
    return { total: rolls.reduce((a, b) => a + b, 0) + modifier, rolls, modifier, formula };
  }),
}));

const makeCtx = (overrides = {}) => ({
  attack: {},
  proceedWithDamage: vi.fn(),
  ...overrides,
});

describe('buildGenericSteps', () => {
  let steps, housekeeping, rollDamage, proceed;

  beforeEach(() => {
    vi.clearAllMocks();
    steps = buildGenericSteps();
    [housekeeping, rollDamage, proceed] = steps;
  });

  it('builds the 3-step event chain generic:do → generic:ready → generic:applied → pipeline:complete', () => {
    expect(steps.map(({ name, subscribe, emit }) => ({ name, subscribe, emit }))).toEqual([
      { name: 'genericHousekeeping', subscribe: 'generic:do', emit: 'generic:ready' },
      { name: 'genericRollDamage', subscribe: 'generic:ready', emit: 'generic:applied' },
      { name: 'genericProceed', subscribe: 'generic:applied', emit: 'pipeline:complete' },
    ]);
  });

  it('genericHousekeeping is unconditional and initializes empty data', async () => {
    expect(housekeeping.condition({})).toBe(true);
    expect(housekeeping.condition({ attack: null })).toBe(true);
    expect(await housekeeping.handler(makeCtx())).toEqual({ data: {} });
  });

  describe('genericRollDamage', () => {
    it('gates on attack.damage or autoFormulaOverride (truth table)', () => {
      const truthy = [
        { attack: { damage: '1d6+2' } },
        { attack: {}, autoFormulaOverride: '2d4' },
        { attack: null, autoFormulaOverride: '1d4' },
      ];
      const falsy = [
        { attack: {} },
        { attack: { damage: '' } },
        { attack: { damage: null } },
        { attack: null },
        { attack: {}, autoFormulaOverride: null },
      ];
      for (const ctx of truthy) expect(rollDamage.condition(makeCtx(ctx))).toBe(true);
      for (const ctx of falsy) expect(rollDamage.condition(makeCtx(ctx))).toBe(false);
    });

    it('prefers autoFormulaOverride over attack.damage and passes formula, total, rolls, modifier through', async () => {
      const ctx = makeCtx({ attack: { damage: '1d6+2' }, autoFormulaOverride: '2d8+4' });
      expect(await rollDamage.handler(ctx)).toEqual({
        data: { formula: '2d8+4', total: 14, rolls: [5, 5], modifier: 4 },
      });
    });

    it('falls back to attack.damage when no override', async () => {
      const ctx = makeCtx({ attack: { damage: '1d6+2' } });
      expect(await rollDamage.handler(ctx)).toEqual({
        data: { formula: '1d6+2', total: 6, rolls: [4], modifier: 2 },
      });
    });

    it('returns null when the roll fails (unparseable formula)', async () => {
      const ctx = makeCtx({ attack: { damage: 'not-a-formula' } });
      expect(await rollDamage.handler(ctx)).toBeNull();
    });
  });

  describe('genericProceed', () => {
    it('gates on formula != null — 0 and empty string run, null/undefined are blocked', () => {
      for (const formula of [0, '0', '1d6', '']) expect(proceed.condition(makeCtx({ formula }))).toBe(true);
      for (const formula of [null, undefined]) expect(proceed.condition(makeCtx({ formula }))).toBe(false);
    });

    it('hands attack, formula, total, rolls, modifier to proceedWithDamage and marks done', async () => {
      const ctx = makeCtx({
        attack: { name: 'Test' },
        formula: '1d6+2',
        total: 8,
        rolls: [6],
        modifier: 2,
      });
      const result = await proceed.handler(ctx);
      expect(ctx.proceedWithDamage).toHaveBeenCalledWith({
        attack: { name: 'Test' },
        formula: '1d6+2',
        total: 8,
        rolls: [6],
        modifier: 2,
      });
      expect(result).toEqual({ data: { _done: true } });
    });
  });
});
