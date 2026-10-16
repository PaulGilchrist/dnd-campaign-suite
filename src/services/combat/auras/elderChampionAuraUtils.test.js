// @maintained-by-ai
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

// Delegation-only mock: getAuraRangeFromStats internals are owned by
// auraOfProtection.test.js — here we only pin that its output is forwarded.
vi.mock('./auraOfProtection.js', () => ({
  getAuraRangeFromStats: vi.fn(),
}));

import { getElderChampionSaveDisadvantage } from './elderChampionAuraUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getAllyList } from '../../../hooks/useAllySelection.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getAuraRangeFromStats } from './auraOfProtection.js';

const BASE = { attackerName: 'ElderChampion', attackerStats: {}, targetName: 'Enemy' };

describe('getElderChampionSaveDisadvantage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getAuraRangeFromStats.mockReturnValue(10);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([null, undefined])(
    'short-circuits before any lookup when attackerStats is %p',
    async (attackerStats) => {
      const result = await getElderChampionSaveDisadvantage({ ...BASE, attackerStats });

      expect(result).toEqual({ disadvantage: false });
      expect(getRuntimeValue).not.toHaveBeenCalled();
      expect(getAllyList).not.toHaveBeenCalled();
      expect(isWithinRange).not.toHaveBeenCalled();
    }
  );

  it.each([false, null, undefined])(
    'short-circuits at the aura gate when elderChampionActive is %p',
    async (active) => {
      getRuntimeValue.mockReturnValue(active);

      const result = await getElderChampionSaveDisadvantage(BASE);

      expect(result).toEqual({ disadvantage: false });
      expect(getRuntimeValue).toHaveBeenCalledWith('ElderChampion', 'elderChampionActive');
      expect(getAllyList).not.toHaveBeenCalled();
      expect(isWithinRange).not.toHaveBeenCalled();
    }
  );

  it('spares targets in the attacker ally list without a range check', async () => {
    getRuntimeValue.mockReturnValue(true);
    getAllyList.mockReturnValue(['Ally1', 'Enemy', 'Ally2']);

    const result = await getElderChampionSaveDisadvantage(BASE);

    expect(result).toEqual({ disadvantage: false });
    expect(getAllyList).toHaveBeenCalledWith('ElderChampion');
    expect(getAuraRangeFromStats).not.toHaveBeenCalled();
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it.each([true, 'yes'])(
    'gives out-of-range enemies disadvantage when gate is %p, forwarding the aura range',
    async (active) => {
      getRuntimeValue.mockReturnValue(active);
      getAllyList.mockReturnValue(['Ally1']);
      getAuraRangeFromStats.mockReturnValue(30);
      isWithinRange.mockResolvedValue(true);

      const result = await getElderChampionSaveDisadvantage(BASE);

      expect(result).toEqual({ disadvantage: true, source: 'ElderChampion' });
      expect(getAuraRangeFromStats).toHaveBeenCalledWith(BASE.attackerStats);
      expect(isWithinRange).toHaveBeenCalledWith('ElderChampion', 'Enemy', 30);
    }
  );

  it('returns no disadvantage when the target is outside the aura range', async () => {
    getRuntimeValue.mockReturnValue(true);
    getAllyList.mockReturnValue(['Ally1']);
    isWithinRange.mockResolvedValue(false);

    const result = await getElderChampionSaveDisadvantage(BASE);

    expect(result).toEqual({ disadvantage: false });
    expect(isWithinRange).toHaveBeenCalledWith('ElderChampion', 'Enemy', 10);
  });

  it('falls back to no disadvantage instead of throwing when the range check fails', async () => {
    getRuntimeValue.mockReturnValue(true);
    getAllyList.mockReturnValue([]);
    isWithinRange.mockRejectedValue(new Error('map load failed'));

    const result = await getElderChampionSaveDisadvantage(BASE);

    expect(result).toEqual({ disadvantage: false });
    expect(console.warn).toHaveBeenCalled();
  });
});

