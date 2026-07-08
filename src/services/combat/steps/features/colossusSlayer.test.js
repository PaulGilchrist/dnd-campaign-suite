import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => {
    if (formula === '1d8') {
      return { total: 5, rolls: [5], modifier: 0, formula: '1d8' };
    }
    return null;
  }),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((characterKey, propertyName) => {
    const store = vi.mocked(getRuntimeValue).getCalls().find(
      (c) => c[0] === characterKey && c[1] === propertyName
    )?.[2];
    return store?.[propertyName] ?? null;
  }),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
  getTargetFromAttacker: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
}));

// ── Imports ──────────────────────────────────────────────────────

import { colossusSlayer } from './colossusSlayer.js';

import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCombatContext, getTargetFromAttacker } from '../../../rules/combat/damageUtils.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';

// ── Helpers ───────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: { name: 'Fighter1' },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('colossusSlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('condition', () => {
    it('returns true when _Hunter\'s_Prey_choice is Colossus Slayer', () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === "_Hunter's_Prey_choice") return 'Colossus Slayer';
        return null;
      });

      expect(colossusSlayer.condition(makeCtx())).toBe(true);
    });

    it('returns false when _Hunter\'s_Prey_choice is not Colossus Slayer', () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === "_Hunter's_Prey_choice") return 'Other Feature';
        return null;
      });

      expect(colossusSlayer.condition(makeCtx())).toBe(false);
    });

    it('returns false when _Hunter\'s_Prey_choice is null', () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === "_Hunter's_Prey_choice") return null;
        return null;
      });

      expect(colossusSlayer.condition(makeCtx())).toBe(false);
    });

    it('returns false when _Hunter\'s_Prey_choice is undefined', () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === "_Hunter's_Prey_choice") return undefined;
        return null;
      });

      expect(colossusSlayer.condition(makeCtx())).toBe(false);
    });

    it('returns false when _Hunter\'s_Prey_choice is empty string', () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === "_Hunter's_Prey_choice") return '';
        return null;
      });

      expect(colossusSlayer.condition(makeCtx())).toBe(false);
    });
  });

  describe('handler', () => {
    describe('early returns — no combat context', () => {
      it('returns prevData when getCombatContext returns null', async () => {
        getCombatContext.mockResolvedValue(null);
        getRuntimeValue.mockReturnValue(null);

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await colossusSlayer.handler(
          makeCtx(),
          prevData,
        );

        expect(result).toEqual({ data: prevData });
        expect(getTargetFromAttacker).not.toHaveBeenCalled();
      });
    });

    describe('early returns — no target', () => {
      it('returns prevData when getTargetFromAttacker returns null', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue(null);

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await colossusSlayer.handler(
          makeCtx(),
          prevData,
        );

        expect(result).toEqual({ data: prevData });
      });
    });

    describe('early returns — target at full HP', () => {
      it('returns prevData when target currentHp >= maxHp', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ currentHp: 10, maxHp: 10 });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await colossusSlayer.handler(
          makeCtx(),
          prevData,
        );

        expect(result).toEqual({ data: prevData });
      });

      it('returns prevData when target currentHp equals maxHp', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ currentHp: 5, maxHp: 5 });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await colossusSlayer.handler(
          makeCtx(),
          prevData,
        );

        expect(result).toEqual({ data: prevData });
      });
    });

    describe('early returns — already used this round', () => {
      it('returns prevData when already used in current round', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ currentHp: 5, maxHp: 10 });
        getCurrentCombatRound.mockReturnValue(3);
        getRuntimeValue.mockImplementation((_key, prop) => {
          if (prop === '_Hunters_Prey_Colossus_UsedRound') return 3;
          return null;
        });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await colossusSlayer.handler(
          makeCtx(),
          prevData,
        );

        expect(result).toEqual({ data: prevData });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });
    });

    describe('successful application', () => {
      it('adds 1d8 to the damage when target is below max HP and not used this round', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ currentHp: 5, maxHp: 10 });
        getCurrentCombatRound.mockReturnValue(3);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d8' });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await colossusSlayer.handler(
          makeCtx(),
          prevData,
        );

        expect(result.data.formula).toBe('1d8+3 + 1d8 [extra]');
        expect(result.data.total).toBe(16);
        expect(result.data.rolls).toEqual([8, 3, 5]);
      });

      it('returns a sideEffects function that sets the runtime value', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ currentHp: 5, maxHp: 10 });
        getCurrentCombatRound.mockReturnValue(3);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d8' });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await colossusSlayer.handler(
          makeCtx(),
          prevData,
        );

        expect(result.sideEffects).toBeDefined();
        expect(typeof result.sideEffects).toBe('function');
        expect(setRuntimeValue).not.toHaveBeenCalled();

        await result.sideEffects();

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Fighter1',
          '_Hunters_Prey_Colossus_UsedRound',
          3,
          'test-campaign',
        );
      });

      it('rolls 1d8 and adds the result to prevData', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ currentHp: 3, maxHp: 15 });
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0, formula: '1d8' });

        const prevData = { formula: '2d6+4', total: 14, rolls: [3, 5, 4] };
        const result = await colossusSlayer.handler(
          makeCtx(),
          prevData,
        );

        expect(rollExpression).toHaveBeenCalledWith('1d8');
        expect(result.data.formula).toBe('2d6+4 + 1d8 [extra]');
        expect(result.data.total).toBe(21);
        expect(result.data.rolls).toEqual([3, 5, 4, 7]);
      });

      it('uses prevData as-is when rollExpression returns null', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ currentHp: 5, maxHp: 10 });
        getCurrentCombatRound.mockReturnValue(2);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue(null);

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await colossusSlayer.handler(
          makeCtx(),
          prevData,
        );

        expect(result).toEqual({ data: prevData });
        expect(setRuntimeValue).not.toHaveBeenCalled();
      });

      it('uses prevData when target has null currentHp', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ currentHp: null, maxHp: 10 });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await colossusSlayer.handler(
          makeCtx(),
          prevData,
        );

        expect(result).toEqual({ data: prevData });
        expect(rollExpression).not.toHaveBeenCalled();
      });

      it('uses prevData when target has null maxHp', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ currentHp: 5, maxHp: null });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await colossusSlayer.handler(
          makeCtx(),
          prevData,
        );

        expect(result).toEqual({ data: prevData });
        expect(rollExpression).not.toHaveBeenCalled();
      });

      it('marks used for current round after successful application', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ currentHp: 2, maxHp: 20 });
        getCurrentCombatRound.mockReturnValue(5);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0, formula: '1d8' });

        const prevData = { formula: '1d6+2', total: 9, rolls: [6, 2] };
        const result = await colossusSlayer.handler(
          makeCtx(),
          prevData,
        );

        expect(result.sideEffects).toBeDefined();
        await result.sideEffects();

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Fighter1',
          '_Hunters_Prey_Colossus_UsedRound',
          5,
          'test-campaign',
        );
      });

      it('applies when target is at 0 HP (below max HP)', async () => {
        getCombatContext.mockResolvedValue({});
        getTargetFromAttacker.mockReturnValue({ currentHp: 0, maxHp: 10 });
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0, formula: '1d8' });

        const prevData = { formula: '1d8+3', total: 11, rolls: [8, 3] };
        const result = await colossusSlayer.handler(
          makeCtx(),
          prevData,
        );

        expect(result.data.formula).toBe('1d8+3 + 1d8 [extra]');
        expect(result.data.total).toBe(14);
        expect(result.data.rolls).toEqual([8, 3, 3]);
      });
    });
  });
});
