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

import { getWolfAdvantageAgainst } from './wolfAuraUtils.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { isWithinRange } from '../../rules/combat/rangeCheck.js';
import { getCombatContext } from '../../rules/combat/damageUtils.js';

// Wolf / "Rage of the Wilds: Wolf" pack-tactics aura (source semantics): a non-attacker
// candidate holding an activeBuff with name === 'Rage of the Wilds' AND optionName === 'Wolf'
// (exact both-key gate — unlike lion there is no buff.range parse: range is hardcoded 5 ft,
// and unlike duplicity there is no picker list or extra flag) forces advantage for the
// attacker, measured via isWithinRange (names, not coords). skipRangeCheck returns the first
// matching holder unmeasured — reachable on the grid lane via the unplaced-target branch of
// accumulateAuraCounts (contextBuilder-map.js). With no mapData the candidate list is the
// awaited combat-summary party filtered to type 'player'; every production gridless caller
// (resolveWolfAura in contextBuilder-sync.js, plus the unplaced-target branch when mapData
// is absent) ALWAYS passes skipRangeCheck — the gridless measured path is unreachable in
// prod and untested. Pattern-siblings: lionAuraUtils.test.js / duplicityAuraUtils.test.js.
const CAMPAIGN = 'test-campaign';

const grid = (...names) => ({ players: names.map(name => ({ name, gridX: 0, gridY: 0 })) });
const wolf = () => ({ name: 'Rage of the Wilds', optionName: 'Wolf' });

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

describe('getWolfAdvantageAgainst — grid lane', () => {
  beforeEach(resetMocks);

  it('grants advantage for an in-range Wolf ally and pins its lookups at the fixed 5 ft', async () => {
    seed({ buffs: { Barbarian: [{ name: 'Rage of the Wilds', optionName: 'Bear' }, wolf()] } });

    expect(await getWolfAdvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Attacker', 'Barbarian') }))
      .toEqual({ advantage: true, source: 'Barbarian' });
    expect(getRuntimeValue).toHaveBeenCalledWith('Barbarian', 'activeBuffs', CAMPAIGN);
    expect(isWithinRange).toHaveBeenCalledWith('Barbarian', 'Attacker', 5);
    expect(getCombatContext).not.toHaveBeenCalled();
  });

  it.each([
    ['attacker is the only Wolf holder', { buffs: { Attacker: [wolf()] } }],
    ['Rage of the Wilds without the Wolf optionName', { buffs: { Barbarian: [{ name: 'Rage of the Wilds' }] } }],
    ['Wolf optionName without the Rage of the Wilds name', { buffs: { Barbarian: [{ optionName: 'Wolf' }] } }],
    ['near-miss names (Bear sibling, similarly named buffs)', { buffs: { Barbarian: [{ name: 'Rage of the Wilds', optionName: 'Bear' }], Druid: [{ name: 'Wrath of the Wilds', optionName: 'Wolf' }] } }],
    ['Wolf holder out of 5 ft range', { buffs: { Barbarian: [wolf()] }, inRange: false }],
    ['non-array buff values survive iteration (list guard, not member guard)', { buffs: { Barbarian: 'not-an-array', Druid: null, Monk: 42 } }],
    ['solo attacker grid', {}, grid('Attacker')],
    ['mapData without players never falls back to the combat context', {}, { placedItems: [] }],
  ])('%s → no advantage', async (_label, setup, mapData = grid('Attacker', 'Barbarian')) => {
    seed(setup);

    expect(await getWolfAdvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData }))
      .toEqual({ advantage: false });
    expect(getCombatContext).not.toHaveBeenCalled();
  });

  it('skips garbage, stale and out-of-range holders until the first valid source (first match wins)', async () => {
    seed({
      buffs: {
        P1: 'not-an-array',
        Stale: [wolf()],
        First: [{ name: 'Rage of the Wilds', optionName: 'Elk' }, wolf()],
        Second: [wolf()],
      },
      inRange: source => source !== 'Stale',
    });

    expect(await getWolfAdvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Attacker', 'P1', 'Stale', 'First', 'Second') }))
      .toEqual({ advantage: true, source: 'First' });
    expect(isWithinRange).toHaveBeenCalledTimes(2); // Stale measured-and-failed, First measured-and-won; Second never reached
  });

  it('skipRangeCheck grants the first matching holder without measuring range', async () => {
    seed({ buffs: { Barbarian: [wolf()], Druid: [wolf()] }, inRange: false });

    expect(await getWolfAdvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Attacker', 'Barbarian', 'Druid'), skipRangeCheck: true }))
      .toEqual({ advantage: true, source: 'Barbarian' });
    expect(isWithinRange).not.toHaveBeenCalled();

    // the attacker is still skipped even unmeasured
    expect(await getWolfAdvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Attacker'), skipRangeCheck: true }))
      .toEqual({ advantage: false });
  });
});

describe('getWolfAdvantageAgainst — gridless combat-context lane (always skipped in prod)', () => {
  beforeEach(resetMocks);

  const party = [
    { name: 'Thug 1', type: 'npc' },
    { name: 'DraconicDragon', type: 'player' },
    { name: 'HexWarlock', type: 'player' },
  ];

  it('pulls the party from the awaited combat context, filters NPCs, grants a Wolf holder unmeasured', async () => {
    getCombatContext.mockResolvedValue({ creatures: party });
    seed({ buffs: { 'Thug 1': [wolf()], DraconicDragon: [wolf()] } });

    expect(await getWolfAdvantageAgainst({ attackerName: 'HexWarlock', campaignName: CAMPAIGN, skipRangeCheck: true }))
      .toEqual({ advantage: true, source: 'DraconicDragon' });
    expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
    expect(getRuntimeValue).not.toHaveBeenCalledWith('Thug 1', 'activeBuffs', CAMPAIGN);
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it.each([
    ['no combat context available', null, {}],
    ['summary without creatures', {}, {}],
    ['Wolf held only by an NPC', { creatures: party }, { buffs: { 'Thug 1': [wolf()] } }],
    ['party holds no Wolf buff', { creatures: party }, {}],
  ])('%s → no advantage', async (_label, summary, setup) => {
    getCombatContext.mockResolvedValue(summary);
    seed(setup);

    expect(await getWolfAdvantageAgainst({ attackerName: 'HexWarlock', campaignName: CAMPAIGN, skipRangeCheck: true }))
      .toEqual({ advantage: false });
    expect(isWithinRange).not.toHaveBeenCalled();
  });
});
