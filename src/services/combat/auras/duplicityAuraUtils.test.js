// @maintained-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => []),
}));

vi.mock('../../rules/combat/rangeCheck.js', () => ({
  isWithinRange: vi.fn(async () => false),
}));

vi.mock('../../rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn(async () => null),
}));

import { getDuplicityAdvantageAgainst } from './duplicityAuraUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';

// Duplicity (source semantics): a non-attacker creature holding a 'create_illusion'
// activeBuff flagged isImprovedDuplicity forces advantage on attackers listed in its
// 'invokeDuplicityAdvantageTargets' picker list while within 5 ft. Grid lane measures
// via isWithinRange (names, not coords); skipRangeCheck returns first match unmeasured;
// with no mapData the candidate list is the awaited combat-summary party, filtered to
// type 'player' (the only production no-map caller, resolveDuplicityAura, always skips).
const CAMPAIGN = 'test-campaign';

const grid = (...names) => ({ players: names.map(name => ({ name, gridX: 0, gridY: 0 })) });
const duplicity = () => ({ effect: 'create_illusion', isImprovedDuplicity: true });

function resetMocks() {
  getRuntimeValue.mockReset().mockReturnValue([]);
  isWithinRange.mockReset().mockResolvedValue(false);
  getCombatContext.mockReset().mockResolvedValue(null);
}

// Seeds runtime per (name, key); inRange may be a bool or per-source predicate.
function seed({ buffs = {}, grants = {}, inRange = true } = {}) {
  getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'activeBuffs') return name in buffs ? buffs[name] : [];
    if (key === 'invokeDuplicityAdvantageTargets') return name in grants ? grants[name] : [];
    return [];
  });
  isWithinRange.mockImplementation(async source =>
    typeof inRange === 'function' ? inRange(source) : inRange);
}

describe('getDuplicityAdvantageAgainst — grid lane', () => {
  beforeEach(resetMocks);

  it('forces advantage for a granted ally within 5 ft of the buff holder', async () => {
    seed({ buffs: { Cleric: [duplicity()] }, grants: { Cleric: ['Attacker'] } });

    expect(await getDuplicityAdvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Attacker', 'Cleric') }))
      .toEqual({ advantage: true, source: 'Cleric' });
    expect(getRuntimeValue).toHaveBeenCalledWith('Cleric', 'invokeDuplicityAdvantageTargets', CAMPAIGN);
    expect(isWithinRange).toHaveBeenCalledWith('Cleric', 'Attacker', 5);
    expect(getCombatContext).not.toHaveBeenCalled();
  });

  it.each([
    ['attacker is the holder and self-granted', { buffs: { Attacker: [duplicity()] }, grants: { Attacker: ['Attacker'] } }],
    ['create_illusion without isImprovedDuplicity flag', { buffs: { Cleric: [{ effect: 'create_illusion' }] }, grants: { Cleric: ['Attacker'] } }],
    ['isImprovedDuplicity flag without create_illusion effect', { buffs: { Cleric: [{ effect: 'mirror_image', isImprovedDuplicity: true }] }, grants: { Cleric: ['Attacker'] } }],
    ['granted list present but no buff held', { grants: { Cleric: ['Attacker'] } }],
    ['buff held but granted list empty', { buffs: { Cleric: [duplicity()] } }],
    ['attacker absent from granted list', { buffs: { Cleric: [duplicity()] }, grants: { Cleric: ['War_Cleric'] } }],
    ['granted list is a non-array', { buffs: { Cleric: [duplicity()] }, grants: { Cleric: 'not-an-array' } }],
    ['granting holder out of 5 ft range', { buffs: { Cleric: [duplicity()] }, grants: { Cleric: ['Attacker'] }, inRange: false }],
    ['solo attacker grid', {}, grid('Attacker')],
    ['empty grid never falls back to the combat context', {}, { players: [], placedItems: [] }],
  ])('%s → no advantage', async (_label, setup, mapData = grid('Attacker', 'Cleric')) => {
    seed(setup);

    expect(await getDuplicityAdvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData }))
      .toEqual({ advantage: false });
    expect(getCombatContext).not.toHaveBeenCalled();
  });

  it('skips garbage buffs and out-of-range holders until the first valid in-range source', async () => {
    seed({
      buffs: { P1: 'not-an-array', P2: null, Stale: [{ effect: 'create_illusion' }], Cleric: [duplicity()] },
      grants: { Stale: ['Attacker'], Cleric: ['Attacker'] },
      inRange: source => source === 'Cleric',
    });

    expect(await getDuplicityAdvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Attacker', 'P1', 'P2', 'Stale', 'Cleric') }))
      .toEqual({ advantage: true, source: 'Cleric' });
  });

  it('skipRangeCheck grants the first matching holder without measuring range', async () => {
    seed({ buffs: { Cleric: [duplicity()] }, grants: { Cleric: ['Attacker'] }, inRange: false });

    expect(await getDuplicityAdvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Attacker', 'Cleric'), skipRangeCheck: true }))
      .toEqual({ advantage: true, source: 'Cleric' });
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('appends placedItems as candidates, deduped against players but not against each other (quirk)', async () => {
    seed({
      buffs: { Cleric: [duplicity()], Illusion: [duplicity()], Sprite: [duplicity()] },
      grants: { Cleric: ['Attacker'], Illusion: ['Attacker'], Sprite: ['Attacker'] },
      inRange: source => source === 'Sprite',
    });
    const mapData = {
      players: [{ name: 'Attacker' }, { name: 'Cleric' }],
      placedItems: [
        { name: 'Cleric', gridX: 9, gridY: 9 },
        { name: 'Illusion', gridX: 2, gridY: 2 },
        { name: 'Illusion', gridX: 4, gridY: 4 },
        { name: 'Sprite', gridX: 1, gridY: 1 },
      ],
    };

    expect(await getDuplicityAdvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData }))
      .toEqual({ advantage: true, source: 'Sprite' });
    const buffChecks = name => getRuntimeValue.mock.calls.filter(([n, k]) => n === name && k === 'activeBuffs').length;
    expect(buffChecks('Cleric')).toBe(1);
    expect(buffChecks('Illusion')).toBe(2);
  });
});

describe('getDuplicityAdvantageAgainst — gridless combat-context lane (skipRangeCheck)', () => {
  beforeEach(resetMocks);

  const party = [
    { name: 'Divine_Cleric', type: 'player' },
    { name: 'War_Cleric', type: 'player' },
    { name: 'Wight 1', type: 'npc' },
  ];

  it('pulls the party from the awaited combat context and grants a listed ally', async () => {
    getCombatContext.mockResolvedValue({ creatures: party });
    seed({ buffs: { Divine_Cleric: [duplicity()] }, grants: { Divine_Cleric: ['War_Cleric'] } });

    expect(await getDuplicityAdvantageAgainst({ attackerName: 'War_Cleric', campaignName: CAMPAIGN, skipRangeCheck: true }))
      .toEqual({ advantage: true, source: 'Divine_Cleric' });
    expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it.each([
    ['no combat context available', null, {}, {}],
    ['buff held only by an NPC (party filtered to players)', { creatures: party }, { buffs: { 'Wight 1': [duplicity()] } }, { grants: { 'Wight 1': ['War_Cleric'] } }],
    ['player holder with no granted targets', { creatures: party }, { buffs: { Divine_Cleric: [duplicity()] } }, {}],
  ])('%s → no advantage', async (_label, summary, buffs, grants) => {
    getCombatContext.mockResolvedValue(summary);
    seed({ ...buffs, ...grants });

    expect(await getDuplicityAdvantageAgainst({ attackerName: 'War_Cleric', campaignName: CAMPAIGN, skipRangeCheck: true }))
      .toEqual({ advantage: false });
    expect(isWithinRange).not.toHaveBeenCalled();
  });
});
