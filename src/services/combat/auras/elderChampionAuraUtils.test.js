import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

vi.mock('./auraOfProtection.js', () => ({
  getAuraRangeFromStats: vi.fn(() => 10),
}));

import { getElderChampionSaveDisadvantage } from './elderChampionAuraUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getAllyList } from '../../../hooks/useAllySelection.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getAuraRangeFromStats } from './auraOfProtection.js';

describe('getElderChampionSaveDisadvantage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReset();
    getAllyList.mockReset();
    isWithinRange.mockReset();
    getAuraRangeFromStats.mockReset();
  });

  it('returns { disadvantage: false } when attackerStats is null', async () => {
    const result = await getElderChampionSaveDisadvantage({
      attackerName: 'ElderChampion',
      attackerStats: null,
      targetName: 'Target',
    });
    expect(result).toEqual({ disadvantage: false });
    expect(getRuntimeValue).not.toHaveBeenCalled();
    expect(getAllyList).not.toHaveBeenCalled();
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('returns { disadvantage: false } when attackerStats is undefined', async () => {
    const result = await getElderChampionSaveDisadvantage({
      attackerName: 'ElderChampion',
      attackerStats: undefined,
      targetName: 'Target',
    });
    expect(result).toEqual({ disadvantage: false });
    expect(getRuntimeValue).not.toHaveBeenCalled();
  });

  it('returns { disadvantage: false } when elderChampionActive is not set on attacker', async () => {
    getRuntimeValue.mockReturnValue(false);

    const result = await getElderChampionSaveDisadvantage({
      attackerName: 'ElderChampion',
      attackerStats: {},
      targetName: 'Target',
    });

    expect(result).toEqual({ disadvantage: false });
    expect(getRuntimeValue).toHaveBeenCalledWith('ElderChampion', 'elderChampionActive');
    expect(getAllyList).not.toHaveBeenCalled();
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('returns { disadvantage: false } when elderChampionActive is null', async () => {
    getRuntimeValue.mockReturnValue(null);

    const result = await getElderChampionSaveDisadvantage({
      attackerName: 'ElderChampion',
      attackerStats: {},
      targetName: 'Target',
    });

    expect(result).toEqual({ disadvantage: false });
    expect(getRuntimeValue).toHaveBeenCalledWith('ElderChampion', 'elderChampionActive');
  });

  it('returns { disadvantage: false } when target is in attacker\'s ally list', async () => {
    getRuntimeValue.mockReturnValue(true);
    getAllyList.mockReturnValue(['Ally1', 'Target', 'Ally2']);

    const result = await getElderChampionSaveDisadvantage({
      attackerName: 'ElderChampion',
      attackerStats: {},
      targetName: 'Target',
    });

    expect(result).toEqual({ disadvantage: false });
    expect(getRuntimeValue).toHaveBeenCalledWith('ElderChampion', 'elderChampionActive');
    expect(getAllyList).toHaveBeenCalledWith('ElderChampion');
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('returns { disadvantage: false } when target is not in ally list but is an enemy', async () => {
    getRuntimeValue.mockReturnValue(true);
    getAllyList.mockReturnValue(['Ally1', 'Ally2']);
    isWithinRange.mockResolvedValue(false);

    const result = await getElderChampionSaveDisadvantage({
      attackerName: 'ElderChampion',
      attackerStats: {},
      targetName: 'Enemy',
    });

    expect(result).toEqual({ disadvantage: false });
    expect(getAllyList).toHaveBeenCalledWith('ElderChampion');
    expect(isWithinRange).toHaveBeenCalledWith('ElderChampion', 'Enemy', 10);
  });

  it('returns { disadvantage: true, source: attackerName } when target is outside ally list and in range', async () => {
    getRuntimeValue.mockReturnValue(true);
    getAllyList.mockReturnValue(['Ally1', 'Ally2']);
    isWithinRange.mockResolvedValue(true);

    const result = await getElderChampionSaveDisadvantage({
      attackerName: 'ElderChampion',
      attackerStats: {},
      targetName: 'Enemy',
    });

    expect(result).toEqual({ disadvantage: true, source: 'ElderChampion' });
    expect(getAllyList).toHaveBeenCalledWith('ElderChampion');
    expect(isWithinRange).toHaveBeenCalledWith('ElderChampion', 'Enemy', 10);
  });

  it('passes the aura range from getAuraRangeFromStats to isWithinRange', async () => {
    getRuntimeValue.mockReturnValue(true);
    getAllyList.mockReturnValue([]);
    getAuraRangeFromStats.mockReturnValue(30);
    isWithinRange.mockResolvedValue(true);

    await getElderChampionSaveDisadvantage({
      attackerName: 'ElderChampion',
      attackerStats: { auraRange: 30 },
      targetName: 'Enemy',
    });

    expect(getAuraRangeFromStats).toHaveBeenCalledWith({ auraRange: 30 });
    expect(isWithinRange).toHaveBeenCalledWith('ElderChampion', 'Enemy', 30);
  });

  it('returns { disadvantage: false } when isWithinRange throws an error', async () => {
    getRuntimeValue.mockReturnValue(true);
    getAllyList.mockReturnValue([]);
    isWithinRange.mockRejectedValue(new Error('map load failed'));

    const result = await getElderChampionSaveDisadvantage({
      attackerName: 'ElderChampion',
      attackerStats: {},
      targetName: 'Enemy',
    });

    expect(result).toEqual({ disadvantage: false });
  });

  it('returns { disadvantage: false } when isWithinRange returns false', async () => {
    getRuntimeValue.mockReturnValue(true);
    getAllyList.mockReturnValue([]);
    isWithinRange.mockResolvedValue(false);

    const result = await getElderChampionSaveDisadvantage({
      attackerName: 'ElderChampion',
      attackerStats: {},
      targetName: 'DistantEnemy',
    });

    expect(result).toEqual({ disadvantage: false });
  });

  it('works with elderChampionActive set to truthy non-boolean', async () => {
    getRuntimeValue.mockReturnValue('yes');
    getAllyList.mockReturnValue([]);
    isWithinRange.mockResolvedValue(true);

    const result = await getElderChampionSaveDisadvantage({
      attackerName: 'ElderChampion',
      attackerStats: {},
      targetName: 'Enemy',
    });

    expect(result).toEqual({ disadvantage: true, source: 'ElderChampion' });
  });
});
