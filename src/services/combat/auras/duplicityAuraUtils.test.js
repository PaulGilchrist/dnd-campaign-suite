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

import { getDuplicityAdvantageAgainst } from './duplicityAuraUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';

function makePlayer(name, gridX = 0, gridY = 0) {
  return { name, gridX, gridY };
}

function makeMapData(players, placedItems = []) {
  return { players, placedItems };
}

function makeDuplicityBuff() {
  return { effect: 'create_illusion', isImprovedDuplicity: true };
}

function runtimeWith({ buffsByHolder = {}, grantedByHolder = {} }) {
  getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'activeBuffs') return buffsByHolder[name] || [];
    if (key === 'invokeDuplicityAdvantageTargets') return grantedByHolder[name] || [];
    return [];
  });
}

describe('getDuplicityAdvantageAgainst', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRuntimeValue.mockReset();
    isWithinRange.mockReset();
    getCombatContext.mockReset();
    getRuntimeValue.mockImplementation(() => []);
    isWithinRange.mockResolvedValue(true);
    getCombatContext.mockResolvedValue(null);
  });

  it('returns false when mapData is undefined and no combat summary exists', async () => {
    getCombatContext.mockResolvedValue(null);
    const result = await getDuplicityAdvantageAgainst({ attackerName: 'A', campaignName: 'C', mapData: undefined });
    expect(result).toEqual({ advantage: false });
  });

  it('returns false when mapData is null and combat summary has no players', async () => {
    getCombatContext.mockResolvedValue({ creatures: [] });
    const result = await getDuplicityAdvantageAgainst({ attackerName: 'A', campaignName: 'C', mapData: null });
    expect(result).toEqual({ advantage: false });
  });

  it('returns false when mapData.players is missing or empty', async () => {
    expect(await getDuplicityAdvantageAgainst({ attackerName: 'A', campaignName: 'C', mapData: {} })).toEqual({ advantage: false });
    expect(await getDuplicityAdvantageAgainst({ attackerName: 'A', campaignName: 'C', mapData: makeMapData([]) })).toEqual({ advantage: false });
  });

  it('returns false when no player has Improved Duplicity', async () => {
    runtimeWith({ buffsByHolder: {}, grantedByHolder: { Cleric: ['Attacker'] } });

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('returns advantage when a granted ally attacks and the buff holder is in range', async () => {
    runtimeWith({
      buffsByHolder: { Cleric: [makeDuplicityBuff()] },
      grantedByHolder: { Cleric: ['Attacker'] },
    });
    isWithinRange.mockResolvedValue(true);

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
    });
    expect(result).toEqual({ advantage: true, source: 'Cleric' });
  });

  it('returns false when the attacker is NOT on the picker-granted list', async () => {
    runtimeWith({
      buffsByHolder: { Cleric: [makeDuplicityBuff()] },
      grantedByHolder: { Cleric: ['War_Cleric'] },
    });
    isWithinRange.mockResolvedValue(true);

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('returns false when the granted list is empty even with the buff active', async () => {
    runtimeWith({
      buffsByHolder: { Cleric: [makeDuplicityBuff()] },
      grantedByHolder: { Cleric: [] },
    });

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('reads the granted list with the campaignName', async () => {
    runtimeWith({
      buffsByHolder: { Cleric: [makeDuplicityBuff()] },
      grantedByHolder: { Cleric: ['Attacker'] },
    });

    await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'MyCampaign',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
    });
    expect(getRuntimeValue).toHaveBeenCalledWith('Cleric', 'invokeDuplicityAdvantageTargets', 'MyCampaign');
  });

  it('skips the attacker even if they have Improved Duplicity and listed themselves', async () => {
    runtimeWith({
      buffsByHolder: { Attacker: [makeDuplicityBuff()] },
      grantedByHolder: { Attacker: ['Attacker'] },
    });

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([makePlayer('Attacker')]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('ignores a buff that has create_illusion but NOT isImprovedDuplicity', async () => {
    runtimeWith({
      buffsByHolder: { Cleric: [{ effect: 'create_illusion' }] },
      grantedByHolder: { Cleric: ['Attacker'] },
    });

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('handles invalid buff types gracefully', async () => {
    getRuntimeValue
      .mockReturnValueOnce(null)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('not-an-array')
      .mockReturnValueOnce(42)
      .mockReturnValueOnce([makeDuplicityBuff()])
      .mockReturnValueOnce(undefined);

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([
        makePlayer('P1'), makePlayer('P2'), makePlayer('P3'), makePlayer('P4'), makePlayer('P5'),
      ]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('handles a non-array granted list gracefully', async () => {
    runtimeWith({
      buffsByHolder: { Cleric: [makeDuplicityBuff()] },
      grantedByHolder: { Cleric: 'not-an-array' },
    });

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('returns false when Improved Duplicity is out of range', async () => {
    runtimeWith({
      buffsByHolder: { Cleric: [makeDuplicityBuff()] },
      grantedByHolder: { Cleric: ['Attacker'] },
    });
    isWithinRange.mockResolvedValue(false);

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('iterates players until finding one with Improved Duplicity granting to the attacker', async () => {
    runtimeWith({
      buffsByHolder: { Cleric2: [makeDuplicityBuff()] },
      grantedByHolder: { Cleric2: ['Attacker'] },
    });
    isWithinRange.mockResolvedValue(true);

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([makePlayer('Cleric1'), makePlayer('Cleric2'), makePlayer('Attacker')]),
    });
    expect(result).toEqual({ advantage: true, source: 'Cleric2' });
  });

  it('calls isWithinRange with 5 ft range', async () => {
    runtimeWith({
      buffsByHolder: { Cleric: [makeDuplicityBuff()] },
      grantedByHolder: { Cleric: ['Attacker'] },
    });
    isWithinRange.mockResolvedValue(true);

    await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'MyCampaign',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
    });
    expect(isWithinRange).toHaveBeenCalledWith('Cleric', 'Attacker', 5);
  });

  it('skips the range check when skipRangeCheck is true', async () => {
    runtimeWith({
      buffsByHolder: { Cleric: [makeDuplicityBuff()] },
      grantedByHolder: { Cleric: ['Attacker'] },
    });

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([makePlayer('Attacker'), makePlayer('Cleric')]),
      skipRangeCheck: true,
    });
    expect(result).toEqual({ advantage: true, source: 'Cleric' });
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('returns false when only the attacker exists in mapData', async () => {
    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([makePlayer('Attacker')]),
    });
    expect(result).toEqual({ advantage: false });
  });

  it('combines players and placedItems into allCreatures', async () => {
    runtimeWith({
      buffsByHolder: { Illusion: [makeDuplicityBuff()] },
      grantedByHolder: { Illusion: ['Attacker'] },
    });
    isWithinRange.mockResolvedValue(true);

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData([], [
        { name: 'Illusion', gridX: 3, gridY: 4 },
      ]),
    });
    expect(result).toEqual({ advantage: true, source: 'Illusion' });
  });

  it('skips duplicate placedItems that share a name with a player', async () => {
    runtimeWith({
      buffsByHolder: { Cleric: [makeDuplicityBuff()] },
      grantedByHolder: { Cleric: ['Attacker'] },
    });
    isWithinRange.mockResolvedValue(true);

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'Attacker',
      campaignName: 'C',
      mapData: makeMapData(
        [makePlayer('Cleric')],
        [{ name: 'Cleric', gridX: 1, gridY: 1 }],
      ),
    });
    expect(result).toEqual({ advantage: true, source: 'Cleric' });
  });

  it('falls back to the combat summary party when mapData is missing (no-map mode)', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Divine_Cleric', type: 'player' },
        { name: 'War_Cleric', type: 'player' },
        { name: 'Wight 1', type: 'npc' },
      ],
    });
    runtimeWith({
      buffsByHolder: { Divine_Cleric: [makeDuplicityBuff()] },
      grantedByHolder: { Divine_Cleric: ['War_Cleric'] },
    });

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'War_Cleric',
      campaignName: 'test-campaign',
      skipRangeCheck: true,
    });
    expect(result).toEqual({ advantage: true, source: 'Divine_Cleric' });
  });

  it('returns false in no-map mode when the granted ally is not on the list', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Divine_Cleric', type: 'player' },
        { name: 'War_Cleric', type: 'player' },
      ],
    });
    runtimeWith({
      buffsByHolder: { Divine_Cleric: [makeDuplicityBuff()] },
      grantedByHolder: { Divine_Cleric: [] },
    });

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'War_Cleric',
      campaignName: 'test-campaign',
      skipRangeCheck: true,
    });
    expect(result).toEqual({ advantage: false });
  });

  it('ignores non-player creatures when falling back to the combat summary', async () => {
    getCombatContext.mockResolvedValue({
      creatures: [
        { name: 'Divine_Cleric', type: 'player' },
        { name: 'Wight 1', type: 'npc' },
      ],
    });
    runtimeWith({
      buffsByHolder: { Wight: [makeDuplicityBuff()] },
      grantedByHolder: { Wight: ['War_Cleric'] },
    });

    const result = await getDuplicityAdvantageAgainst({
      attackerName: 'War_Cleric',
      campaignName: 'test-campaign',
      skipRangeCheck: true,
    });
    expect(result).toEqual({ advantage: false });
  });
});
