import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { hexDamage } from './hexDamage.js';

import { rollExpression } from '../../../dice/diceRoller.js';
import { getCombatContext } from '../../../rules/combat/damageUtils.js';

// ── Helpers ───────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: { name: 'Ranger1' },
    targetName: 'Goblin1',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('hexDamage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('condition', () => {
    it('always returns true', () => {
      expect(hexDamage.condition(makeCtx())).toBe(true);
    });

    it('returns true with empty context', () => {
      expect(hexDamage.condition({})).toBe(true);
    });
  });

  describe('handler', () => {
    describe('early returns — no combat context', () => {
      it('returns prevData when getCombatContext returns null', async () => {
        getCombatContext.mockResolvedValue(null);

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result).toEqual({ data: prevData });
        expect(rollExpression).not.toHaveBeenCalled();
      });

      it('returns prevData when getCombatContext returns undefined', async () => {
        getCombatContext.mockResolvedValue(undefined);

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result).toEqual({ data: prevData });
        expect(rollExpression).not.toHaveBeenCalled();
      });
    });

    describe('early returns — attacker not found in combat context', () => {
      it('returns prevData when attacker name not in creatures array', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{ name: 'OtherCreature' }],
        });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result).toEqual({ data: prevData });
        expect(rollExpression).not.toHaveBeenCalled();
      });

      it('returns prevData when creatures array is missing', async () => {
        getCombatContext.mockResolvedValue({});

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result).toEqual({ data: prevData });
        expect(rollExpression).not.toHaveBeenCalled();
      });

      it('returns prevData when creatures array is null', async () => {
        getCombatContext.mockResolvedValue({ creatures: null });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result).toEqual({ data: prevData });
        expect(rollExpression).not.toHaveBeenCalled();
      });
    });

    describe('early returns — not concentrating on Hex', () => {
      it('returns prevData when concentration is null', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{ name: 'Ranger1', concentration: null }],
        });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result).toEqual({ data: prevData });
        expect(rollExpression).not.toHaveBeenCalled();
      });

      it('returns prevData when concentration is undefined', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{ name: 'Ranger1' }],
        });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result).toEqual({ data: prevData });
        expect(rollExpression).not.toHaveBeenCalled();
      });

      it('returns prevData when concentration spell is not Hex', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{ name: 'Ranger1', concentration: { spell: 'Bane' } }],
        });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result).toEqual({ data: prevData });
        expect(rollExpression).not.toHaveBeenCalled();
      });

      it('returns prevData when concentration spell is "HexingStriker" (not exact match)', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{ name: 'Ranger1', concentration: { spell: 'HexingStriker' } }],
        });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result).toEqual({ data: prevData });
        expect(rollExpression).not.toHaveBeenCalled();
      });
    });

    describe('early returns — target mismatch', () => {
      it('returns prevData when concentration target differs from ctx.targetName', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{
            name: 'Ranger1',
            concentration: { spell: 'Hex', target: 'Orc1' },
          }],
        });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result).toEqual({ data: prevData });
        expect(rollExpression).not.toHaveBeenCalled();
      });

      it('returns prevData when concentration target is different string', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{
            name: 'Ranger1',
            concentration: { spell: 'Hex', target: 'DifferentTarget' },
          }],
        });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result).toEqual({ data: prevData });
        expect(rollExpression).not.toHaveBeenCalled();
      });
    });

    describe('early returns — rollExpression returns null', () => {
      it('returns prevData when rollExpression returns null', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{
            name: 'Ranger1',
            concentration: { spell: 'Hex', target: 'Goblin1' },
          }],
        });
        rollExpression.mockReturnValue(null);

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result).toEqual({ data: prevData });
      });
    });

    describe('successful application', () => {
      it('adds 1d6 necrotic damage when hex target matches', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{
            name: 'Ranger1',
            concentration: { spell: 'Hex', target: 'Goblin1' },
          }],
        });
        rollExpression.mockReturnValue({ total: 4, rolls: [4], modifier: 0, formula: '1d6' });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result.data.formula).toBe('1d8+3 + 1d6 [necrotic]');
        expect(result.data.total).toBe(15);
        expect(result.data.rolls).toEqual([8, 3, 4]);
      });

      it('rolls 1d6 and adds to existing formula', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{
            name: 'Ranger1',
            concentration: { spell: 'Hex', target: 'Goblin1' },
          }],
        });
        rollExpression.mockReturnValue({ total: 6, rolls: [6], modifier: 0, formula: '1d6' });

        const prevData = { formula: '2d6+4', total: 15, rolls: [3, 5, 4] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result.data.formula).toBe('2d6+4 + 1d6 [necrotic]');
        expect(result.data.total).toBe(21);
        expect(result.data.rolls).toEqual([3, 5, 4, 6]);
      });

      it('rolls 1d6 and adds to existing formula with max roll', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{
            name: 'Ranger1',
            concentration: { spell: 'Hex', target: 'Goblin1' },
          }],
        });
        rollExpression.mockReturnValue({ total: 1, rolls: [1], modifier: 0, formula: '1d6' });

        const prevData = { formula: '1d8+5', total: 13, rolls: [8, 5] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result.data.formula).toBe('1d8+5 + 1d6 [necrotic]');
        expect(result.data.total).toBe(14);
        expect(result.data.rolls).toEqual([8, 5, 1]);
      });

      it('works when concentration has no target (unrestricted)', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{
            name: 'Ranger1',
            concentration: { spell: 'Hex' },
          }],
        });
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0, formula: '1d6' });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result.data.formula).toBe('1d8+3 + 1d6 [necrotic]');
        expect(result.data.total).toBe(14);
        expect(result.data.rolls).toEqual([8, 3, 3]);
      });

      it('works with empty prevData.rolls', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{
            name: 'Ranger1',
            concentration: { spell: 'Hex', target: 'Goblin1' },
          }],
        });
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d6' });

        const prevData = { formula: 'flat', total: 5, rolls: [] };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result.data.formula).toBe('flat + 1d6 [necrotic]');
        expect(result.data.total).toBe(10);
        expect(result.data.rolls).toEqual([5]);
      });

      it('works when prevData.rolls is undefined', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{
            name: 'Ranger1',
            concentration: { spell: 'Hex', target: 'Goblin1' },
          }],
        });
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0, formula: '1d6' });

        const prevData = { formula: '1d8+3', total: 11 };
        const result = await hexDamage.handler(makeCtx(), prevData);

        expect(result.data.formula).toBe('1d8+3 + 1d6 [necrotic]');
        expect(result.data.total).toBe(14);
        expect(result.data.rolls).toEqual([3]);
      });

      it('uses different attacker name from ctx.targetName to verify target match', async () => {
        getCombatContext.mockResolvedValue({
          creatures: [{
            name: 'Ranger1',
            concentration: { spell: 'Hex', target: 'Goblin1' },
          }],
        });
        rollExpression.mockReturnValue({ total: 2, rolls: [2], modifier: 0, formula: '1d6' });

        const ctx = makeCtx({
          playerStats: { name: 'Ranger1' },
          targetName: 'Goblin1',
        });
        const prevData = { formula: '1d10+2', total: 9, rolls: [7, 2] };
        const result = await hexDamage.handler(ctx, prevData);

        expect(result.data.formula).toBe('1d10+2 + 1d6 [necrotic]');
        expect(result.data.total).toBe(11);
        expect(result.data.rolls).toEqual([7, 2, 2]);
      });
    });
  });
});
