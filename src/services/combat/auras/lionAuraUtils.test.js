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

import { getLionDisadvantageAgainst } from './lionAuraUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';

// Lion (source semantics): any non-attacker creature on the candidate list holding an
// activeBuff with optionName === 'Lion' (exact string — not duplicity's 'effect' key,
// no extra flag, no picker list) forces disadvantage, measured via isWithinRange
// (names, not coords) at parseInt(buff.range) || 5 — so garbage range strings like
// 'unlimited' and 0 collapse to 5. skipRangeCheck returns the first matching holder
// unmeasured; reachable on the grid lane via the unplaced-target branch of
// accumulateAuraCounts (contextBuilder-map.js). With no mapData the candidate list is
// the awaited combat-summary party filtered to type 'player'; the only production
// gridless caller, resolveLionAura (contextBuilder-sync.js), ALWAYS passes
// skipRangeCheck — the gridless measured path is unreachable in prod and untested.
// Pattern-sibling: duplicityAuraUtils.test.js (same ctx/skip skeleton, trimmed).
const CAMPAIGN = 'test-campaign';

const grid = (...names) => ({ players: names.map(name => ({ name, gridX: 0, gridY: 0 })) });
const lion = (range) => range === undefined ? { optionName: 'Lion' } : { optionName: 'Lion', range };

function resetMocks() {
  getRuntimeValue.mockReset().mockReturnValue([]);
  isWithinRange.mockReset().mockResolvedValue(false);
  getCombatContext.mockReset().mockResolvedValue(null);
}

// Seeds runtime per player name; inRange may be a bool or per-source predicate.
function seed({ buffs = {}, inRange = true } = {}) {
  getRuntimeValue.mockImplementation((name) => (name in buffs ? buffs[name] : []));
  isWithinRange.mockImplementation(async source =>
    typeof inRange === 'function' ? inRange(source) : inRange);
}

describe('getLionDisadvantageAgainst — grid lane', () => {
  beforeEach(resetMocks);

  it('forces disadvantage for an in-range ally Lion holder and pins its lookups', async () => {
    seed({ buffs: { Barbarian: [{ optionName: 'Bear' }, lion()] } });

    expect(await getLionDisadvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Attacker', 'Barbarian') }))
      .toEqual({ disadvantage: true, source: 'Barbarian' });
    expect(getRuntimeValue).toHaveBeenCalledWith('Barbarian', 'activeBuffs', CAMPAIGN);
    expect(isWithinRange).toHaveBeenCalledWith('Barbarian', 'Attacker', 5);
    expect(getCombatContext).not.toHaveBeenCalled();
  });

  it.each([
    ['attacker is the only Lion holder', { buffs: { Attacker: [lion()] } }],
    ['no player holds Lion (near-miss name and other buffs)', { buffs: { Barbarian: [{ optionName: 'Bear' }], Druid: [{ optionName: 'Lioness' }] } }],
    ['Lion holder out of 5 ft range', { buffs: { Barbarian: [lion()] }, inRange: false }],
    ['non-array buff values survive iteration', { buffs: { Barbarian: 'not-an-array', Druid: null, Monk: 42 } }],
    ['solo attacker grid', {}, grid('Attacker')],
    ['mapData without players never falls back to the combat context', {}, { placedItems: [] }],
  ])('%s → no disadvantage', async (_label, setup, mapData = grid('Attacker', 'Barbarian')) => {
    seed(setup);

    expect(await getLionDisadvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData }))
      .toEqual({ disadvantage: false });
    expect(getCombatContext).not.toHaveBeenCalled();
  });

  it('skips garbage, stale and non-Lion buffs until the first valid in-range holder (first match wins)', async () => {
    seed({
      buffs: {
        P1: 'not-an-array',
        Stale: [lion()],
        First: [{ optionName: 'Bear' }, lion()],
        Second: [lion()],
      },
      inRange: source => source !== 'Stale',
    });

    expect(await getLionDisadvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Attacker', 'P1', 'Stale', 'First', 'Second') }))
      .toEqual({ disadvantage: true, source: 'First' });
    expect(isWithinRange).toHaveBeenCalledTimes(2); // Stale measured-and-failed, First measured-and-won; Second never reached
  });

  it.each([
    [{ range: '10 ft' }, 10],
    [{ range: '30ft' }, 30],
    [{ range: 'unlimited' }, 5], // parseInt NaN → 5 fallback
    [{ range: 0 }, 5], // falsy range → '5 ft'
    [{}, 5],
  ])('buff range %o measures at %i ft', async (buff, expectedRange) => {
    seed({ buffs: { Barbarian: [lion(buff.range)] } });

    expect(await getLionDisadvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Attacker', 'Barbarian') }))
      .toEqual({ disadvantage: true, source: 'Barbarian' });
    expect(isWithinRange).toHaveBeenCalledWith('Barbarian', 'Attacker', expectedRange);
  });

  it('skipRangeCheck grants the first matching holder without measuring range', async () => {
    seed({ buffs: { Barbarian: [lion()] }, inRange: false });

    expect(await getLionDisadvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Attacker', 'Barbarian'), skipRangeCheck: true }))
      .toEqual({ disadvantage: true, source: 'Barbarian' });
    expect(isWithinRange).not.toHaveBeenCalled();

    // the attacker is still skipped even unmeasured
    expect(await getLionDisadvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Attacker'), skipRangeCheck: true }))
      .toEqual({ disadvantage: false });
  });
});

describe('getLionDisadvantageAgainst — gridless combat-context lane (always skipped in prod)', () => {
  beforeEach(resetMocks);

  const party = [
    { name: 'Thug 1', type: 'npc' },
    { name: 'DraconicDragon', type: 'player' },
    { name: 'HexWarlock', type: 'player' },
  ];

  it('pulls the party from the awaited combat context, filters NPCs, grants a Lion holder unmeasured', async () => {
    getCombatContext.mockResolvedValue({ creatures: party });
    seed({ buffs: { 'Thug 1': [lion()], DraconicDragon: [lion()] } });

    expect(await getLionDisadvantageAgainst({ attackerName: 'HexWarlock', campaignName: CAMPAIGN, skipRangeCheck: true }))
      .toEqual({ disadvantage: true, source: 'DraconicDragon' });
    expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
    expect(getRuntimeValue).not.toHaveBeenCalledWith('Thug 1', 'activeBuffs', CAMPAIGN);
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it.each([
    ['no combat context available', null, {}],
    ['summary without creatures', {}, {}],
    ['Lion buff held only by an NPC', { creatures: party }, { buffs: { 'Thug 1': [lion()] } }],
    ['party holds no Lion buff', { creatures: party }, {}],
  ])('%s → no disadvantage', async (_label, summary, setup) => {
    getCombatContext.mockResolvedValue(summary);
    seed(setup);

    expect(await getLionDisadvantageAgainst({ attackerName: 'HexWarlock', campaignName: CAMPAIGN, skipRangeCheck: true }))
      .toEqual({ disadvantage: false });
    expect(isWithinRange).not.toHaveBeenCalled();
  });
});
