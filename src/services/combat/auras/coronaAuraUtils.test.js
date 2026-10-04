// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

vi.mock('../../encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => null),
  getCombatContext: vi.fn(async () => null),
}));

import { getCoronaSaveDisadvantage, getCoronaSaveDisadvantageSync } from './coronaAuraUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getCombatSummary, getCombatContext } from '../../encounters/combatData.js';

function makePlayer(name, gridX = 0, gridY = 0) {
  return { name, gridX, gridY };
}

function makeMapData(players) {
  return { players };
}

function makeCoronaBuff(distance, enemiesDisadvantageSaves = ['Fire', 'Radiant']) {
  const buff = { effect: 'sunlight_aura', enemiesDisadvantageSaves };
  if (distance !== undefined) buff.distance = distance;
  return buff;
}

describe('getCoronaSaveDisadvantage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReset();
    isWithinRange.mockReset();
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'coronaOfLightEnemies') return [];
      return [];
    });
    isWithinRange.mockResolvedValue(false);
  });

  it('returns false when mapData is undefined', async () => {
    const result = await getCoronaSaveDisadvantage({ targetName: 'Target', mapData: undefined });
    expect(result).toEqual({ disadvantage: false });
  });

  it('returns false when mapData is null', async () => {
    const result = await getCoronaSaveDisadvantage({ targetName: 'Target', mapData: null });
    expect(result).toEqual({ disadvantage: false });
  });

  it('returns false when mapData.players is missing or empty', async () => {
    expect(await getCoronaSaveDisadvantage({ targetName: 'Target', mapData: {} })).toEqual({ disadvantage: false });
    expect(await getCoronaSaveDisadvantage({ targetName: 'Target', mapData: makeMapData([]) })).toEqual({ disadvantage: false });
  });

  it('returns false when no player has corona aura buff', async () => {
    getRuntimeValue.mockImplementation(() => []);

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
    });
    expect(result).toEqual({ disadvantage: false });
  });

  it('skips the target itself even if they have corona aura buff', async () => {
    getRuntimeValue.mockReturnValue([makeCoronaBuff()]);

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target')]),
      damageType: 'Fire',
    });
    expect(result).toEqual({ disadvantage: false });
  });

  it('returns disadvantage with source when a non-target player has corona buff and is in range', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Paladin' ? [makeCoronaBuff()] : []);
    isWithinRange.mockResolvedValue(true);

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
    });
    expect(result).toEqual({ disadvantage: true, source: 'Paladin' });
  });

  it('returns the first non-target player with corona buff', async () => {
    getRuntimeValue.mockImplementation((name) =>
      name === 'Paladin1' || name === 'Paladin2' ? [makeCoronaBuff()] : [],
    );
    isWithinRange.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin1'), makePlayer('Paladin2')]),
      damageType: 'Fire',
    });
    expect(result).toEqual({ disadvantage: true, source: 'Paladin2' });
  });

  it('handles invalid buff types gracefully', async () => {
    getRuntimeValue
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('not-an-array')
      .mockReturnValueOnce(42)
      .mockReturnValueOnce([makeCoronaBuff()]);

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([
        makePlayer('Target'), makePlayer('P1'), makePlayer('P2'), makePlayer('P3'), makePlayer('P4'), makePlayer('P5'),
      ]),
      damageType: 'Fire',
    });
    expect(result).toEqual({ disadvantage: false });
  });

  it('returns false when corona buff is out of range', async () => {
    getRuntimeValue.mockImplementation(() => [makeCoronaBuff()]);
    isWithinRange.mockResolvedValue(false);

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
    });
    expect(result).toEqual({ disadvantage: false });
  });

  it('respects enemiesDisadvantageSaves filter for damage type', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Paladin' ? [makeCoronaBuff(undefined, ['Radiant'])] : []);
    isWithinRange.mockResolvedValue(true);

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
    });
    expect(result).toEqual({ disadvantage: false });
  });

  it('passes correct parameters to isWithinRange', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Paladin' ? [makeCoronaBuff('60 ft')] : []);
    isWithinRange.mockResolvedValue(true);

    await getCoronaSaveDisadvantage({
      targetName: 'Target',
      campaignName: 'MyCampaign',
      activeMapName: 'MyMap',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
    });
    expect(isWithinRange).toHaveBeenCalledWith('Paladin', 'Target', 60);
  });

  it('respects coronaOfLightEnemies list', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'coronaOfLightEnemies' && name === 'Paladin') return ['Target'];
      if (key === 'activeBuffs' && name === 'Paladin') return [makeCoronaBuff()];
      return [];
    });
    isWithinRange.mockResolvedValue(true);

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
    });
    expect(result).toEqual({ disadvantage: true, source: 'Paladin' });
  });

  it('returns false when target not in coronaOfLightEnemies list', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (key === 'coronaOfLightEnemies' && name === 'Paladin') return ['Other'];
      if (key === 'activeBuffs' && name === 'Paladin') return [makeCoronaBuff()];
      return [];
    });

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
    });
    expect(result).toEqual({ disadvantage: false });
  });

  it('uses default 60 ft range when coronaBuff.distance is absent', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Paladin' ? [{ effect: 'sunlight_aura', enemiesDisadvantageSaves: ['Fire'] }] : []);
    isWithinRange.mockResolvedValue(true);

    await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
    });
    expect(isWithinRange).toHaveBeenCalledWith('Paladin', 'Target', 60);
  });

  it('normalizes damageType case to match against enemiesDisadvantageSaves', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Paladin' ? [makeCoronaBuff(undefined, ['Fire', 'radiant'])] : []);
    isWithinRange.mockResolvedValue(true);

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'FIRE',
    });
    expect(result).toEqual({ disadvantage: true, source: 'Paladin' });
  });

  it('returns false when enemiesDisadvantageSaves is empty array', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Paladin' ? [makeCoronaBuff(undefined, [])] : []);
    isWithinRange.mockResolvedValue(true);

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Target',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
    });
    expect(result).toEqual({ disadvantage: false });
  });
});

// ── CLA-063: skipRangeCheck lanes, gridless-lenient without mapData ──

function makeCombatSummaryWith(creatures) {
  return { round: 1, creatures };
}

describe('getCoronaSaveDisadvantage — skipRangeCheck gridless lane (CLA-063)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReset();
    isWithinRange.mockReset();
    getCombatSummary.mockReset().mockReturnValue(null);
    getCombatContext.mockReset().mockResolvedValue(null);
  });

  function seedCleric(campaignName, enemies) {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name !== 'War_Cleric') return [];
      if (key === 'activeBuffs') return [{ effect: 'sunlight_aura', enemiesDisadvantageSaves: ['Fire', 'Radiant'] }];
      if (key === 'coronaOfLightEnemies') return enemies;
      return [];
    });
    getCombatSummary.mockReturnValue(makeCombatSummaryWith([
      { name: 'War_Cleric', type: 'player' },
      { name: 'Bandit 1', type: 'npc' },
    ]));
  }

  it('returns disadvantage for a targeted enemy + Fire save with no mapData', async () => {
    seedCleric('test-campaign', ['Bandit 1']);

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Bandit 1',
      campaignName: 'test-campaign',
      damageType: 'Fire',
      skipRangeCheck: true,
    });
    expect(result).toEqual({ disadvantage: true, source: 'War_Cleric' });
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('returns disadvantage for Radiant damageType (case-normalized) with no mapData', async () => {
    seedCleric('test-campaign', ['Bandit 1']);

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Bandit 1',
      campaignName: 'test-campaign',
      damageType: 'radiant',
      skipRangeCheck: true,
    });
    expect(result).toEqual({ disadvantage: true, source: 'War_Cleric' });
  });

  it('returns false for non-Fire/Radiant damageType', async () => {
    seedCleric('test-campaign', ['Bandit 1']);

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Bandit 1',
      campaignName: 'test-campaign',
      damageType: 'Cold',
      skipRangeCheck: true,
    });
    expect(result).toEqual({ disadvantage: false });
  });

  it('returns false when target is not in coronaOfLightEnemies', async () => {
    seedCleric('test-campaign', ['Other']);

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Bandit 1',
      campaignName: 'test-campaign',
      damageType: 'Radiant',
      skipRangeCheck: true,
    });
    expect(result).toEqual({ disadvantage: false });
  });

  it('falls back to combat-context fetch when the summary cache is cold', async () => {
    seedCleric('test-campaign', ['Bandit 1']);
    getCombatSummary.mockReturnValue(null);
    getCombatContext.mockResolvedValue(makeCombatSummaryWith([
      { name: 'War_Cleric', type: 'player' },
      { name: 'Bandit 1', type: 'npc' },
    ]));

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Bandit 1',
      campaignName: 'test-campaign',
      damageType: 'Fire',
      skipRangeCheck: true,
    });
    expect(result).toEqual({ disadvantage: true, source: 'War_Cleric' });
    expect(getCombatContext).toHaveBeenCalledWith('test-campaign');
  });

  it('returns false when no combat summary at all', async () => {
    const result = await getCoronaSaveDisadvantage({
      targetName: 'Bandit 1',
      campaignName: 'test-campaign',
      damageType: 'Fire',
      skipRangeCheck: true,
    });
    expect(result).toEqual({ disadvantage: false });
  });

  it('never checks range when skipRangeCheck is set even with mapData players', async () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name !== 'War_Cleric') return [];
      if (key === 'activeBuffs') return [{ effect: 'sunlight_aura', enemiesDisadvantageSaves: ['Fire', 'Radiant'] }];
      if (key === 'coronaOfLightEnemies') return ['Bandit 1'];
      return [];
    });

    const result = await getCoronaSaveDisadvantage({
      targetName: 'Bandit 1',
      campaignName: 'test-campaign',
      mapData: makeMapData([makePlayer('War_Cleric'), makePlayer('Bandit 1')]),
      damageType: 'Fire',
      skipRangeCheck: true,
    });
    expect(result).toEqual({ disadvantage: true, source: 'War_Cleric' });
    expect(isWithinRange).not.toHaveBeenCalled();
  });
});

describe('getCoronaSaveDisadvantageSync (CLA-063 sync save lanes)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReset();
    getCombatSummary.mockReset().mockReturnValue(null);
  });

  function seedCleric() {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name !== 'War_Cleric') return [];
      if (key === 'activeBuffs') return [{ effect: 'sunlight_aura', enemiesDisadvantageSaves: ['Fire', 'Radiant'] }];
      if (key === 'coronaOfLightEnemies') return ['Bandit 1'];
      return [];
    });
    getCombatSummary.mockReturnValue(makeCombatSummaryWith([
      { name: 'War_Cleric', type: 'player' },
      { name: 'Bandit 1', type: 'npc' },
    ]));
  }

  it('returns disadvantage for targeted enemy + Fire/Radiant with skipRangeCheck and no mapData', () => {
    seedCleric();
    expect(getCoronaSaveDisadvantageSync({ targetName: 'Bandit 1', campaignName: 'test-campaign', damageType: 'Radiant', skipRangeCheck: true }))
      .toEqual({ disadvantage: true, source: 'War_Cleric' });
    expect(getCoronaSaveDisadvantageSync({ targetName: 'Bandit 1', campaignName: 'test-campaign', damageType: 'Fire', skipRangeCheck: true }))
      .toEqual({ disadvantage: true, source: 'War_Cleric' });
  });

  it('returns false for non-Fire/Radiant and for non-enemies', () => {
    seedCleric();
    expect(getCoronaSaveDisadvantageSync({ targetName: 'Bandit 1', campaignName: 'test-campaign', damageType: 'Cold', skipRangeCheck: true }))
      .toEqual({ disadvantage: false });

    seedCleric();
    getRuntimeValue.mockImplementation((name, key) => {
      if (name !== 'War_Cleric') return [];
      if (key === 'activeBuffs') return [{ effect: 'sunlight_aura', enemiesDisadvantageSaves: ['Fire', 'Radiant'] }];
      if (key === 'coronaOfLightEnemies') return ['Somebody Else'];
      return [];
    });
    expect(getCoronaSaveDisadvantageSync({ targetName: 'Bandit 1', campaignName: 'test-campaign', damageType: 'Fire', skipRangeCheck: true }))
      .toEqual({ disadvantage: false });
  });

  it('stays conservative-false without skipRangeCheck (cannot measure range sync)', () => {
    seedCleric();
    expect(getCoronaSaveDisadvantageSync({ targetName: 'Bandit 1', campaignName: 'test-campaign', damageType: 'Fire' }))
      .toEqual({ disadvantage: false });
  });

  it('honors mapData players without needing combat summary', () => {
    getRuntimeValue.mockImplementation((name, key) => {
      if (name !== 'Paladin') return [];
      if (key === 'activeBuffs') return [{ effect: 'sunlight_aura', enemiesDisadvantageSaves: ['Fire'] }];
      return [];
    });
    expect(getCoronaSaveDisadvantageSync({
      targetName: 'Target',
      campaignName: 'test-campaign',
      mapData: makeMapData([makePlayer('Target'), makePlayer('Paladin')]),
      damageType: 'Fire',
      skipRangeCheck: true,
    })).toEqual({ disadvantage: true, source: 'Paladin' });
  });
});
