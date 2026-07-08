import { describe, it, expect, vi } from 'vitest';
import { buildGenericSteps } from './genericSteps.js';

vi.mock('../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    if (!formula || formula === '0') return null;
    const numeric = parseInt(formula.replace(/\D/g, ''), 10);
    if (isNaN(numeric)) return null;
    return { total: numeric, rolls: [numeric], modifier: 0 };
  }),
}));

const { rollExpression } = await import('../../dice/diceRoller.js');

function makeCtx(overrides = {}) {
  return {
    attack: {},
    proceedWithDamage: vi.fn(),
    ...overrides,
  };
}

describe('buildGenericSteps', () => {
  let steps;

  beforeEach(() => {
    vi.clearAllMocks();
    steps = buildGenericSteps();
  });

  it('returns an array of 3 steps', () => {
    expect(steps).toHaveLength(3);
  });

  it('has steps with correct names in order', () => {
    const names = steps.map((s) => s.name);
    expect(names).toEqual(['genericHousekeeping', 'genericRollDamage', 'genericProceed']);
  });

  it('has correct subscribe/emit chain', () => {
    expect(steps[0].subscribe).toBe('generic:do');
    expect(steps[0].emit).toBe('generic:ready');
    expect(steps[1].subscribe).toBe('generic:ready');
    expect(steps[1].emit).toBe('generic:applied');
    expect(steps[2].subscribe).toBe('generic:applied');
    expect(steps[2].emit).toBe('pipeline:complete');
  });

  describe('genericHousekeeping step', () => {
    it('always returns true for condition', () => {
      expect(steps[0].condition({})).toBe(true);
      expect(steps[0].condition({ attack: null })).toBe(true);
      expect(steps[0].condition({ attack: { name: 'Test' } })).toBe(true);
    });

    it('returns { data: {} } from handler', async () => {
      const result = await steps[0].handler({});
      expect(result).toEqual({ data: {} });
    });
  });

  describe('genericRollDamage step', () => {
    describe('condition', () => {
      it('returns true when ctx.attack has damage', () => {
        const ctx = makeCtx({ attack: { damage: '1d6+2' } });
        expect(steps[1].condition(ctx)).toBe(true);
      });

      it('returns true when ctx has autoFormulaOverride', () => {
        const ctx = makeCtx({ autoFormulaOverride: '2d4' });
        expect(steps[1].condition(ctx)).toBe(true);
      });

      it('returns false when neither attack.damage nor autoFormulaOverride exists', () => {
        const ctx = makeCtx({ attack: {} });
        expect(steps[1].condition(ctx)).toBe(false);
      });

      it('returns false when attack.damage is empty string', () => {
        const ctx = makeCtx({ attack: { damage: '' } });
        expect(steps[1].condition(ctx)).toBe(false);
      });

      it('returns false when attack.damage is null', () => {
        const ctx = makeCtx({ attack: { damage: null } });
        expect(steps[1].condition(ctx)).toBe(false);
      });

      it('returns false when autoFormulaOverride is falsy and no damage', () => {
        const ctx = makeCtx({ autoFormulaOverride: null });
        expect(steps[1].condition(ctx)).toBe(false);
      });
    });

    describe('handler', () => {
      it('uses autoFormulaOverride when both it and attack.damage exist', async () => {
        const ctx = makeCtx({
          attack: { damage: '1d6' },
          autoFormulaOverride: '2d8+4',
        });
        const result = await steps[1].handler(ctx);
        expect(result).not.toBeNull();
        expect(result.data.formula).toBe('2d8+4');
        expect(rollExpression).toHaveBeenCalledWith('2d8+4');
      });

      it('uses attack.damage when no autoFormulaOverride', async () => {
        const ctx = makeCtx({ attack: { damage: '1d6+2' } });
        const result = await steps[1].handler(ctx);
        expect(result).not.toBeNull();
        expect(result.data.formula).toBe('1d6+2');
        expect(rollExpression).toHaveBeenCalledWith('1d6+2');
      });

      it('returns null when rollExpression returns null (formula "0")', async () => {
        const ctx = makeCtx({ attack: { damage: '0' } });
        const result = await steps[1].handler(ctx);
        expect(result).toBeNull();
      });

      it('returns data with formula, total, rolls, and modifier', async () => {
        const ctx = makeCtx({ attack: { damage: '1d6' } });
        const result = await steps[1].handler(ctx);
        expect(result).not.toBeNull();
        expect(result.data).toHaveProperty('formula');
        expect(result.data).toHaveProperty('total');
        expect(result.data).toHaveProperty('rolls');
        expect(result.data).toHaveProperty('modifier');
      });
    });
  });

  describe('genericProceed step', () => {
    describe('condition', () => {
      it('returns true when ctx.formula is a number', () => {
        const ctx = makeCtx({ formula: 10 });
        expect(steps[2].condition(ctx)).toBe(true);
      });

      it('returns true when ctx.formula is 0', () => {
        const ctx = makeCtx({ formula: 0 });
        expect(steps[2].condition(ctx)).toBe(true);
      });

      it('returns true when ctx.formula is a string', () => {
        const ctx = makeCtx({ formula: '1d6' });
        expect(steps[2].condition(ctx)).toBe(true);
      });

      it('returns false when ctx.formula is undefined', () => {
        const ctx = makeCtx();
        expect(steps[2].condition(ctx)).toBe(false);
      });

      it('returns false when ctx.formula is null', () => {
        const ctx = makeCtx({ formula: null });
        expect(steps[2].condition(ctx)).toBe(false);
      });
    });

    describe('handler', () => {
      it('calls proceedWithDamage with attack, formula, total, rolls, and modifier', async () => {
        const ctx = makeCtx({
          attack: { name: 'Test' },
          formula: '1d6+2',
          total: 8,
          rolls: [6],
          modifier: 2,
        });
        const result = await steps[2].handler(ctx);
        expect(ctx.proceedWithDamage).toHaveBeenCalledWith(
          { name: 'Test' },
          '1d6+2',
          8,
          [6],
          2,
        );
        expect(result).toEqual({ data: { _done: true } });
      });

      it('returns _done: true in result', async () => {
        const ctx = makeCtx({
          attack: {},
          formula: '1d4',
          total: 4,
          rolls: [4],
          modifier: 0,
        });
        const result = await steps[2].handler(ctx);
        expect(result.data._done).toBe(true);
      });
    });
  });
});
