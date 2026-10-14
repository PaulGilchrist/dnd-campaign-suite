import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(),
}));

import { getWolfAdvantageAgainst } from './wolfAuraUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';

function makePlayer(name, gridX = 0, gridY = 0) {
  return { name, gridX, gridY };
}

function makeMapData(players) {
  return { players };
}

function makeWolfBuff() {
  return { name: 'Rage of the Wilds', optionName: 'Wolf' };
}

describe('getWolfAdvantageAgainst', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReset();
    isWithinRange.mockReset();
    getCombatContext.mockReset();
    getRuntimeValue.mockImplementation(() => []);
    isWithinRange.mockResolvedValue(false);
    getCombatContext.mockResolvedValue(null);
  });

  it('returns false when mapData is undefined and no combat summary exists', async () => {
    getCombatContext.mockResolvedValue(null);
    const result = await getWolfAdvantageAgainst({ attackerName: 'A', campaignName: 'C', mapData: undefined });
    expect(result).toEqual({ advantage: false });
  });

  it('returns false when mapData is null and combat summary has no players', async () => {
    getCombatContext.mockResolvedValue({ creatures: [] });
    const result = await getWolfAdvantageAgainst({ attackerName: 'A', campaignName: 'C', mapData: null });
    expect(result).toEqual({ advantage: false });
  });

  it('returns false when mapData.players is missing or empty', async () => {
    expect(await getWolfAdvantageAgainst({ attackerName: 'A', mapData: {} })).toEqual({ advantage: false });
    expect(await getWolfAdvantageAgainst({ attackerName: 'A', mapData: makeMapData([]) })).toEqual({ advantage: false });
  });

  it('returns advantage when a non-attacker player has Wolf buff and is in range', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Barbarian' ? [makeWolfBuff()] : []);
    isWithinRange.mockResolvedValue(true);

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    });
    expect(result).toEqual({ advantage: true, source: 'Barbarian' });
  });

  it('skips the attacker even if they have Wolf buff', async () => {
    getRuntimeValue.mockImplementation(() => [makeWolfBuff()]);
    isWithinRange.mockResolvedValue(true);

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker')]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('returns false when no player has Wolf buff', async () => {
    getRuntimeValue.mockImplementation(() => []);

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('handles invalid buff types gracefully', async () => {
    getRuntimeValue
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('not-an-array')
      .mockReturnValueOnce(42)
      .mockReturnValueOnce([makeWolfBuff()]);

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([
        makePlayer('P1'), makePlayer('P2'), makePlayer('P3'), makePlayer('P4'), makePlayer('P5'),
      ]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('returns false when Wolf buff is out of range', async () => {
    getRuntimeValue.mockImplementation(() => [makeWolfBuff()]);
    isWithinRange.mockResolvedValue(false);

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('calls isWithinRange with 5 ft range', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Barbarian' ? [makeWolfBuff()] : []);
    isWithinRange.mockResolvedValue(true);

    await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'MyCampaign',
      activeMapName: 'MyMap',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    });
    expect(isWithinRange).toHaveBeenCalledWith('Barbarian', 'Attacker', 5);
  });

  it('iterates players until finding one with Wolf buff in range', async () => {
    getRuntimeValue.mockImplementation((name) => name === 'Player1' ? [] : name === 'Player2' ? [makeWolfBuff()] : []);
    isWithinRange.mockResolvedValue(true);

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([makePlayer('Player1'), makePlayer('Player2'), makePlayer('Attacker')]),
    });
    expect(result).toEqual({ advantage: true, source: 'Player2' });
  });

  it('returns false when only the attacker exists in mapData', async () => {
    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker')]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('does not match Wolf buff without Rage of the Wilds name', async () => {
    getRuntimeValue.mockImplementation(() => [{ optionName: 'Wolf' }]);
    isWithinRange.mockResolvedValue(true);

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('does not match Wolf buff without Wolf optionName', async () => {
    getRuntimeValue.mockImplementation(() => [{ name: 'Rage of the Wilds' }]);
    isWithinRange.mockResolvedValue(true);

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('skips non-Wolf buffs and finds Wolf among mixed buffs', async () => {
    getRuntimeValue.mockImplementation(() => [
      { name: 'Rage of the Wilds', optionName: 'Lion' },
      makeWolfBuff(),
    ]);
    isWithinRange.mockResolvedValue(true);

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    });
    expect(result).toEqual({ advantage: true, source: 'Barbarian' });
  });

  it('returns false when multiple Wolf buffs are all out of range', async () => {
    getRuntimeValue.mockImplementation(() => [makeWolfBuff()]);
    isWithinRange.mockResolvedValue(false);

    const result = await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      mapData: makeMapData([makePlayer('Barbarian1'), makePlayer('Barbarian2'), makePlayer('Attacker')]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('falls back to the combat summary party when mapData is missing (no-map mode)', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'DraconicDragon', type: 'player' },
        { name: 'HexWarlock', type: 'player' },
        { name: 'Thug 1', type: 'npc' },
      ],
    });
    getRuntimeValue.mockImplementation((name) => name === 'DraconicDragon' ? [makeWolfBuff()] : []);

    const result = await getWolfAdvantageAgainst({
      attackerName: 'HexWarlock',
      campaignName: 'test-campaign',
      skipRangeCheck: true,
    });
    expect(result).toEqual({ advantage: true, source: 'DraconicDragon' });
  });

  it('resolves a plain object (not a Promise shell) for gridless sync consumers', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'DraconicDragon', type: 'player' },
        { name: 'HexWarlock', type: 'player' },
      ],
    });
    getRuntimeValue.mockImplementation((name) => name === 'DraconicDragon' ? [makeWolfBuff()] : []);

    const result = await getWolfAdvantageAgainst({
      attackerName: 'HexWarlock',
      campaignName: 'test-campaign',
      skipRangeCheck: true,
    });
    expect(result.advantage).toBe(true);
  });

  it('returns false in no-map mode when no ally has the Wolf buff', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'DraconicDragon', type: 'player' },
        { name: 'HexWarlock', type: 'player' },
      ],
    });
    getRuntimeValue.mockImplementation(() => []);

    const result = await getWolfAdvantageAgainst({
      attackerName: 'HexWarlock',
      campaignName: 'test-campaign',
      skipRangeCheck: true,
    });
    expect(result).toEqual({ advantage: false });
  });

  it('ignores non-player creatures when falling back to the combat summary', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'HexWarlock', type: 'player' },
        { name: 'Thug 1', type: 'npc' },
      ],
    });
    getRuntimeValue.mockImplementation(() => [makeWolfBuff()]);

    const result = await getWolfAdvantageAgainst({
      attackerName: 'HexWarlock',
      campaignName: 'test-campaign',
      skipRangeCheck: true,
    });
    expect(result).toEqual({ advantage: false });
  });

  it('applies the range check in no-map mode when skipRangeCheck is not set', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'DraconicDragon', type: 'player' },
        { name: 'HexWarlock', type: 'player' },
      ],
    });
    getRuntimeValue.mockImplementation((name) => name === 'DraconicDragon' ? [makeWolfBuff()] : []);
    isWithinRange.mockResolvedValue(false);

    const result = await getWolfAdvantageAgainst({
      attackerName: 'HexWarlock',
      campaignName: 'test-campaign',
    });
    expect(result).toEqual({ advantage: false });
    expect(isWithinRange).toHaveBeenCalledWith('DraconicDragon', 'HexWarlock', 5);
  });

  it('reads buffs with the campaignName', async () => {
    getRuntimeValue.mockImplementation(() => []);

    await getWolfAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'MyCampaign',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Barbarian')]),
    });
    expect(getRuntimeValue).toHaveBeenCalledWith('Barbarian', 'activeBuffs', 'MyCampaign');
  });
});
