import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────

vi.mock('../../../dice/diceRoller.js', () => ({
  rollExpression: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn((_key, prop) => {
    const store = vi.mocked(getRuntimeValue).getCalls().find(
      (c) => c[0] === _key && c[1] === prop
    )?.[2];
    return store?.[prop] ?? null;
  }),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../../encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// ── Imports ──────────────────────────────────────────────────────

import { epitomeEmpoweredStrikes } from './epitomeEmpoweredStrikes.js';

import { rollExpression } from '../../../dice/diceRoller.js';
import { getRuntimeValue, setRuntimeValue } from '../../../../hooks/runtime/useRuntimeState.js';
import { getCurrentCombatRound } from '../../../encounters/combatData.js';
import { addEntry } from '../../../ui/logService.js';

// ── Helpers ──────────────────────────────────────────────────────

function makeCtx(overrides = {}) {
  return {
    campaignName: 'test-campaign',
    playerStats: { name: 'Monk1', level: 1 },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('epitomeEmpoweredStrikes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('condition', () => {
    it('returns true when elementalEpitomeActive is true and weaponType is unarmed', () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'elementalEpitomeActive') return true;
        return null;
      });

      expect(
        epitomeEmpoweredStrikes.condition(makeCtx({ attack: { weaponType: 'unarmed' } })),
      ).toBe(true);
    });

    it('returns false when elementalEpitomeActive is false', () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'elementalEpitomeActive') return false;
        return null;
      });

      expect(
        epitomeEmpoweredStrikes.condition(makeCtx({ attack: { weaponType: 'unarmed' } })),
      ).toBe(false);
    });

    it('returns false when elementalEpitomeActive is null', () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'elementalEpitomeActive') return null;
        return null;
      });

      expect(
        epitomeEmpoweredStrikes.condition(makeCtx({ attack: { weaponType: 'unarmed' } })),
      ).toBe(false);
    });

    it('returns false when elementalEpitomeActive is undefined', () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'elementalEpitomeActive') return undefined;
        return null;
      });

      expect(
        epitomeEmpoweredStrikes.condition(makeCtx({ attack: { weaponType: 'unarmed' } })),
      ).toBe(false);
    });

    it('returns false when weaponType is not unarmed (shortsword)', () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'elementalEpitomeActive') return true;
        return null;
      });

      expect(
        epitomeEmpoweredStrikes.condition(makeCtx({ attack: { weaponType: 'shortsword' } })),
      ).toBe(false);
    });

    it('returns false when attack is undefined', () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'elementalEpitomeActive') return true;
        return null;
      });

      expect(epitomeEmpoweredStrikes.condition(makeCtx({ attack: undefined }))).toBe(false);
    });

    it('returns false when attack.weaponType is undefined', () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'elementalEpitomeActive') return true;
        return null;
      });

      expect(
        epitomeEmpoweredStrikes.condition(makeCtx({ attack: {} })),
      ).toBe(false);
    });

    it('returns false when elementalEpitomeActive is true but weaponType is dagger', () => {
      getRuntimeValue.mockImplementation((_key, prop) => {
        if (prop === 'elementalEpitomeActive') return true;
        return null;
      });

      expect(
        epitomeEmpoweredStrikes.condition(makeCtx({ attack: { weaponType: 'dagger' } })),
      ).toBe(false);
    });
  });

  describe('handler', () => {
    describe('early returns — already used this round', () => {
      it('returns prevData when epitomeEmpoweredUsedRound matches current round', async () => {
        getCurrentCombatRound.mockReturnValue(3);
        getRuntimeValue.mockImplementation((_key, prop) => {
          if (prop === 'epitomeEmpoweredUsedRound') return 3;
          return null;
        });

        const prevData = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        const result = await epitomeEmpoweredStrikes.handler(makeCtx(), prevData);

        expect(result).toEqual({ data: prevData });
        expect(rollExpression).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
      });

      it('works when round is 0 and usedRound is 0', async () => {
        getCurrentCombatRound.mockReturnValue(0);
        getRuntimeValue.mockImplementation((_key, prop) => {
          if (prop === 'epitomeEmpoweredUsedRound') return 0;
          return null;
        });

        const prevData = { formula: '1d4+2', total: 6, rolls: [4, 2] };
        const result = await epitomeEmpoweredStrikes.handler(makeCtx(), prevData);

        expect(result).toEqual({ data: prevData });
        expect(rollExpression).not.toHaveBeenCalled();
      });
    });

    describe('early returns — class lookup fails', () => {
      it('defaults to d4 when class_levels is undefined', async () => {
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0, formula: '1d4' });

        const prevData = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        const result = await epitomeEmpoweredStrikes.handler(
          makeCtx({ playerStats: { name: 'Monk1', level: 1 } }),
          prevData,
        );

        expect(result.data.formula).toBe('1d4+3 + 1d4 [Empowered Strikes]');
        expect(result.data.total).toBe(11);
      });

      it('defaults to d4 when no matching class level found', async () => {
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 2, rolls: [2], modifier: 0, formula: '1d4' });

        const prevData = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        const result = await epitomeEmpoweredStrikes.handler(
          makeCtx({
            playerStats: { name: 'Monk1', level: 5, class: { class_levels: [] } },
          }),
          prevData,
        );

        expect(result.data.formula).toBe('1d4+3 + 1d4 [Empowered Strikes]');
        expect(result.data.total).toBe(10);
      });

      it('returns prevData when class_level has no martial_arts_die and rollExpression returns null', async () => {
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue(null);

        const prevData = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        const result = await epitomeEmpoweredStrikes.handler(
          makeCtx({
            playerStats: {
              name: 'Monk1',
              level: 1,
              class: { class_levels: [{ level: 1 }] },
            },
          }),
          prevData,
        );

        expect(result).toEqual({ data: prevData });
      });
    });

    describe('early returns — rollExpression fails', () => {
      it('returns prevData when rollExpression returns null', async () => {
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue(null);

        const prevData = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        const result = await epitomeEmpoweredStrikes.handler(makeCtx(), prevData);

        expect(result).toEqual({ data: prevData });
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
      });
    });

    describe('successful application', () => {
      it('adds 1d4 to the damage formula for a level 1 monk', async () => {
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0, formula: '1d4' });

        const prevData = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        const result = await epitomeEmpoweredStrikes.handler(makeCtx(), prevData);

        expect(result.data.formula).toBe('1d4+3 + 1d4 [Empowered Strikes]');
        expect(result.data.total).toBe(11);
        expect(result.data.rolls).toEqual([4, 3, 3]);
      });

      it('adds 1d6 to the damage formula for a level 5 monk', async () => {
        getCurrentCombatRound.mockReturnValue(2);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d6' });

        const prevData = { formula: '1d6+4', total: 10, rolls: [6, 4] };
        const result = await epitomeEmpoweredStrikes.handler(
          makeCtx({
            playerStats: {
              name: 'Monk5',
              level: 5,
              class: { class_levels: [{ level: 5, martial_arts_die: 6 }] },
            },
          }),
          prevData,
        );

        expect(rollExpression).toHaveBeenCalledWith('1d6');
        expect(result.data.formula).toBe('1d6+4 + 1d6 [Empowered Strikes]');
        expect(result.data.total).toBe(15);
        expect(result.data.rolls).toEqual([6, 4, 5]);
      });

      it('adds 1d8 to the damage formula for a level 11 monk', async () => {
        getCurrentCombatRound.mockReturnValue(3);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 7, rolls: [7], modifier: 0, formula: '1d8' });

        const prevData = { formula: '1d8+5', total: 13, rolls: [8, 5] };
        const result = await epitomeEmpoweredStrikes.handler(
          makeCtx({
            playerStats: {
              name: 'Monk11',
              level: 11,
              class: { class_levels: [{ level: 11, martial_arts_die: 8 }] },
            },
          }),
          prevData,
        );

        expect(rollExpression).toHaveBeenCalledWith('1d8');
        expect(result.data.formula).toBe('1d8+5 + 1d8 [Empowered Strikes]');
        expect(result.data.total).toBe(20);
        expect(result.data.rolls).toEqual([8, 5, 7]);
      });

      it('adds 1d10 to the damage formula for a level 17 monk', async () => {
        getCurrentCombatRound.mockReturnValue(4);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 9, rolls: [9], modifier: 0, formula: '1d10' });

        const prevData = { formula: '1d10+6', total: 16, rolls: [10, 6] };
        const result = await epitomeEmpoweredStrikes.handler(
          makeCtx({
            playerStats: {
              name: 'Monk17',
              level: 17,
              class: { class_levels: [{ level: 17, martial_arts_die: 10 }] },
            },
          }),
          prevData,
        );

        expect(rollExpression).toHaveBeenCalledWith('1d10');
        expect(result.data.formula).toBe('1d10+6 + 1d10 [Empowered Strikes]');
        expect(result.data.total).toBe(25);
        expect(result.data.rolls).toEqual([10, 6, 9]);
      });

      it('adds 1d12 to the damage formula for a level 20 monk', async () => {
        getCurrentCombatRound.mockReturnValue(5);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 11, rolls: [11], modifier: 0, formula: '1d12' });

        const prevData = { formula: '1d12+7', total: 19, rolls: [12, 7] };
        const result = await epitomeEmpoweredStrikes.handler(
          makeCtx({
            playerStats: {
              name: 'Monk20',
              level: 20,
              class: { class_levels: [{ level: 20, martial_arts_die: 12 }] },
            },
          }),
          prevData,
        );

        expect(rollExpression).toHaveBeenCalledWith('1d12');
        expect(result.data.formula).toBe('1d12+7 + 1d12 [Empowered Strikes]');
        expect(result.data.total).toBe(30);
        expect(result.data.rolls).toEqual([12, 7, 11]);
      });

      it('returns a sideEffects function', async () => {
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 2, rolls: [2], modifier: 0, formula: '1d4' });

        const prevData = { formula: '1d4+2', total: 7, rolls: [4, 2] };
        const result = await epitomeEmpoweredStrikes.handler(makeCtx(), prevData);

        expect(result.sideEffects).toBeDefined();
        expect(typeof result.sideEffects).toBe('function');
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
      });

      it('marks used for current round after sideEffects executes', async () => {
        getCurrentCombatRound.mockReturnValue(7);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 1, rolls: [1], modifier: 0, formula: '1d4' });

        const prevData = { formula: '1d4+2', total: 7, rolls: [4, 2] };
        const result = await epitomeEmpoweredStrikes.handler(makeCtx(), prevData);

        await result.sideEffects();

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Monk1',
          'epitomeEmpoweredUsedRound',
          7,
          'test-campaign',
        );
      });

      it('logs an ability_use entry when sideEffects executes', async () => {
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 2, rolls: [2], modifier: 0, formula: '1d4' });

        const prevData = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        const result = await epitomeEmpoweredStrikes.handler(makeCtx(), prevData);

        await result.sideEffects();

        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          type: 'ability_use',
          characterName: 'Monk1',
          abilityName: 'Elemental Epitome - Empowered Strikes',
          description: expect.stringContaining("Monk1's Unarmed Strike deals +1d4 damage"),
          timestamp: expect.any(Number),
        }));
      });

      it('includes targetName in the log entry when present', async () => {
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 2, rolls: [2], modifier: 0, formula: '1d4' });

        const prevData = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        const result = await epitomeEmpoweredStrikes.handler(
          makeCtx({ targetName: 'Goblin1' }),
          prevData,
        );

        await result.sideEffects();

        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          targetName: 'Goblin1',
          description: expect.stringContaining("against Goblin1"),
        }));
      });

      it('uses "target" as default when targetName is absent', async () => {
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 2, rolls: [2], modifier: 0, formula: '1d4' });

        const prevData = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        const result = await epitomeEmpoweredStrikes.handler(makeCtx(), prevData);

        await result.sideEffects();

        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          description: expect.stringContaining("against target"),
        }));
      });

      it('does not call addEntry if sideEffects is not invoked', async () => {
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 2, rolls: [2], modifier: 0, formula: '1d4' });

        const prevData = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        await epitomeEmpoweredStrikes.handler(makeCtx(), prevData);

        expect(addEntry).not.toHaveBeenCalled();
      });

      it('does not call setRuntimeValue if sideEffects is not invoked', async () => {
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 2, rolls: [2], modifier: 0, formula: '1d4' });

        const prevData = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        await epitomeEmpoweredStrikes.handler(makeCtx(), prevData);

        expect(setRuntimeValue).not.toHaveBeenCalled();
      });
    });

    describe('sideEffects error handling', () => {
      it('does not throw when addEntry rejects', async () => {
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 2, rolls: [2], modifier: 0, formula: '1d4' });
        addEntry.mockRejectedValueOnce(new Error('network failure'));

        const prevData = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        const result = await epitomeEmpoweredStrikes.handler(makeCtx(), prevData);

        await expect(result.sideEffects()).resolves.toBeUndefined();
      });

      it('throws when setRuntimeValue rejects (no .catch on setRuntimeValue call)', async () => {
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 2, rolls: [2], modifier: 0, formula: '1d4' });

        const rejectionError = new Error('store failure');
        setRuntimeValue.mockRejectedValue(rejectionError);

        const prevData = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        const result = await epitomeEmpoweredStrikes.handler(makeCtx(), prevData);

        await expect(result.sideEffects()).rejects.toThrow('store failure');

        setRuntimeValue.mockReset();
      });
    });

    describe('different characters', () => {
      it('tracks used round independently per character', async () => {
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0, formula: '1d4' });

        const prevData = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        const result = await epitomeEmpoweredStrikes.handler(
          makeCtx({ playerStats: { name: 'MonkA', level: 1 } }),
          prevData,
        );

        await result.sideEffects();

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'MonkA',
          'epitomeEmpoweredUsedRound',
          1,
          'test-campaign',
        );
      });

      it('tracks used round independently per character with different martial arts die', async () => {
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 5, rolls: [5], modifier: 0, formula: '1d6' });

        const prevData = { formula: '1d6+4', total: 10, rolls: [6, 4] };
        const result = await epitomeEmpoweredStrikes.handler(
          makeCtx({
            playerStats: { name: 'MonkB', level: 5, class: { class_levels: [{ level: 5, martial_arts_die: 6 }] } },
          }),
          prevData,
        );

        await result.sideEffects();

        expect(setRuntimeValue).toHaveBeenCalledWith(
          'MonkB',
          'epitomeEmpoweredUsedRound',
          1,
          'test-campaign',
        );
        expect(rollExpression).toHaveBeenCalledWith('1d6');
      });
    });

    describe('multiple attacks in same round', () => {
      it('only applies on the first attack of the round', async () => {
        getCurrentCombatRound.mockReturnValue(2);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0, formula: '1d4' });

        const prevData = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        const result1 = await epitomeEmpoweredStrikes.handler(makeCtx(), prevData);

        expect(result1.data.formula).toBe('1d4+3 + 1d4 [Empowered Strikes]');

        // Execute sideEffects to mark as used
        await result1.sideEffects();

        // Second call in same round — simulate that the round is now tracked
        getRuntimeValue.mockImplementation((_key, prop) => {
          if (prop === 'epitomeEmpoweredUsedRound') return 2;
          return null;
        });

        const prevData2 = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        const result2 = await epitomeEmpoweredStrikes.handler(makeCtx(), prevData2);

        expect(result2).toEqual({ data: prevData2 });
        expect(rollExpression).toHaveBeenCalledTimes(1);
      });
    });

    describe('new round resets the counter', () => {
      it('applies again in a new round after being used', async () => {
        getCurrentCombatRound.mockReturnValue(1);
        getRuntimeValue.mockReturnValue(null);
        rollExpression.mockReturnValue({ total: 3, rolls: [3], modifier: 0, formula: '1d4' });

        const prevData = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        const result1 = await epitomeEmpoweredStrikes.handler(makeCtx(), prevData);
        await result1.sideEffects();

        // Advance to next round — the usedRound is 1 but current round is 2, so it should apply again
        getCurrentCombatRound.mockReturnValue(2);
        getRuntimeValue.mockImplementation((_key, prop) => {
          if (prop === 'epitomeEmpoweredUsedRound') return 1;
          return null;
        });

        const prevData2 = { formula: '1d4+3', total: 8, rolls: [4, 3] };
        const result2 = await epitomeEmpoweredStrikes.handler(makeCtx(), prevData2);

        expect(result2.data.formula).toBe('1d4+3 + 1d4 [Empowered Strikes]');
        expect(rollExpression).toHaveBeenCalledTimes(2);
      });
    });
  });
});
