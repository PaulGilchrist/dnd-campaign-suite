// @maintained-by-ai 2026-11-27 sweep: merged 3 mismatch-buff rows into one exact-pair row; dead-fixture legs (Druid/Monk buffs off-grid) made live; dropped same-branch restatements (solo-attacker row, skipRangeCheck attacker/self sub-legs, gridless off-roster/NPC-only/no-buff/self-target/edited-flip rows); merged betrayal pair; null-combat-summary + missing-creatures consolidated.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => []),
}));

// Unlike corona, this module never touches coordinates or distance math: the
// name-based isWithinRange(bearer, target, 5) is its ONLY comparator, so a
// full mock is honest here (edge math is pinned in rangeCheck.test.js, the
// auraOfProtection precedent). Ally primitives run REAL through the runtime
// mock's 'selectedAllies' reads.
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

// Wolf / "Rage of the Wilds: Wolf" pack-tactics aura (TARGET semantics — owner ruling
// 2026-11-03, prose parity: "allies have Advantage … against any enemy of yours within
// 5 feet of you [the bearer]"): a non-attacker bearer holding an activeBuff with
// name === 'Rage of the Wilds' AND optionName === 'Wolf' (exact both-key gate — unlike
// lion there is no buff.range parse: range is hardcoded 5 ft, and unlike duplicity there
// is no picker list or extra flag) forces advantage when the ATTACK'S TARGET is the
// bearer's enemy within 5 ft of the BEARER — isWithinRange(bearer, target, 5), replacing
// the old bearer↔ATTACKER proximity axis. Target hostility: an EDITED ally-list bearer
// (hasExplicitAllyList) treats anyone off its list as enemy; unedited bearers keep the
// legacy party-by-type split (party PC tokens are allies, NPC/monster tokens enemies —
// map lane: players[] tokens are the party, placedItems are not; gridless lane: the cs
// type 'player' filter). The bearer is never its own enemy: target === bearer is exempt.
// A null targetName (phantom/tokenless target) CANNOT be gated — it grants unmeasured
// rather than fabricating a refusal (house law §44). skipRangeCheck keeps the gridless
// convention (enemy gate applies, distance unmeasured); every gridless production caller
// (resolveWolfAura in contextBuilder-sync.js, plus the map lane's unplaced-target branch)
// passes it. The bearer-side attacker gate mirrors auraOfProtection's Phase 3.2 betrayal
// gate (an EDITED bearer only supports creatures on its list). Caller wiring is pinned in
// contextBuilder-sync.wolf-aura.test.js / contextBuilder-map.test.js. Pattern-siblings:
// lionAuraUtils.test.js / auraOfProtection.test.js / coronaAuraUtils.test.js.
const CAMPAIGN = 'test-campaign';

const grid = (...names) => ({ players: names.map(name => ({ name, gridX: 0, gridY: 0 })) });
const wolf = () => ({ name: 'Rage of the Wilds', optionName: 'Wolf' });
const bear = () => ({ name: 'Rage of the Wilds', optionName: 'Bear' });

// Canonical map-lane call: attacker + a party-outside (NPC) target named 'Target'.
const vs = (extra = {}) => ({
  attackerName: 'Attacker',
  targetName: 'Target',
  campaignName: CAMPAIGN,
  mapData: grid('Attacker', 'Barbarian'),
  ...extra,
});

function resetMocks() {
  getRuntimeValue.mockReset().mockReturnValue([]);
  isWithinRange.mockReset().mockResolvedValue(false);
  getCombatContext.mockReset().mockResolvedValue(null);
}

// Seeds runtime per player name; inRange may be a bool or per-(bearer, target) predicate.
// allies carries per-player EDITED selectedAllies lists (Phase 3.2 betrayal);
// any other key reads null (unedited → legacy party-by-type default).
function seed({ buffs = {}, allies = {}, inRange = true } = {}) {
  getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'activeBuffs') return name in buffs ? buffs[name] : [];
    if (key === 'selectedAllies') return allies[name] ?? null;
    return null;
  });
  isWithinRange.mockImplementation(async (source, target) =>
    typeof inRange === 'function' ? inRange(source, target) : inRange);
}

describe('getWolfAdvantageAgainst — grid lane (bearer↔target axis)', () => {
  beforeEach(resetMocks);

  it('grants advantage when the target is in range and pins its lookups at the fixed bearer↔target 5 ft', async () => {
    seed({ buffs: { Barbarian: [bear(), wolf()] } });

    expect(await getWolfAdvantageAgainst(vs()))
      .toEqual({ advantage: true, source: 'Barbarian' });
    expect(getRuntimeValue).toHaveBeenCalledWith('Barbarian', 'activeBuffs', CAMPAIGN);
    expect(isWithinRange).toHaveBeenCalledWith('Barbarian', 'Target', 5);
    expect(getCombatContext).not.toHaveBeenCalled();
  });

  it('refuses a target out of the bearer range even when the attacker is adjacent (behavior change — the bearer↔attacker axis is retired)', async () => {
    // inRange would PASS for an attacker-proximity measurement (pre-fix granting
    // axis) and fails bearer↔target — the new axis alone decides.
    seed({ buffs: { Barbarian: [wolf()] }, inRange: (source, target) => target === 'Attacker' });

    expect(await getWolfAdvantageAgainst(vs()))
      .toEqual({ advantage: false });
    expect(isWithinRange).toHaveBeenCalledWith('Barbarian', 'Target', 5);
    expect(isWithinRange).not.toHaveBeenCalledWith('Barbarian', 'Attacker', 5);
  });

  it('the bearer is never its own enemy: an attack aimed AT the bearer is exempt even with an edited list omitting self', async () => {
    seed({ buffs: { Barbarian: [wolf()] }, allies: { Barbarian: ['Attacker'] }, inRange: true });

    expect(await getWolfAdvantageAgainst(vs({ targetName: 'Barbarian' })))
      .toEqual({ advantage: false });
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it.each([
    ['attacker is the only Wolf holder (the self-skip also covers the skipRangeCheck lane)', { buffs: { Attacker: [wolf()] } }, vs()],
    ['no buff matches the exact name+optionName pair: right name/no option, option under no name, Bear sibling, look-alike name', { buffs: { Barbarian: [{ name: 'Rage of the Wilds' }, { optionName: 'Wolf' }, bear(), { name: 'Wrath of the Wilds', optionName: 'Wolf' }] } }, vs()],
    ['non-array, null and numeric buff values skip the candidate (every seeded holder is a live candidate)', { buffs: { Barbarian: 'not-an-array', Druid: null, Monk: 42 } }, vs({ mapData: grid('Attacker', 'Barbarian', 'Druid', 'Monk') })],
    ['mapData without players never falls back to the combat context', {}, vs({ mapData: { placedItems: [] } })],
    ['legacy split: a party PC token as target is an ally, never an enemy (measured before range)', { buffs: { Barbarian: [wolf()] }, inRange: true }, vs({ targetName: 'OtherPc', mapData: grid('Attacker', 'Barbarian', 'OtherPc') })],
    ['edited ally list naming the target keeps it a friendly', { buffs: { Barbarian: [wolf()] }, allies: { Barbarian: ['Barbarian', 'Attacker', 'Target'] }, inRange: true }, vs()],
  ])('%s → no advantage', async (_label, setup, call) => {
    seed(setup);

    expect(await getWolfAdvantageAgainst(call))
      .toEqual({ advantage: false });
    expect(getCombatContext).not.toHaveBeenCalled();
  });

  it('skips garbage, stale and out-of-range holders until the first valid source (first match wins)', async () => {
    seed({
      buffs: {
        P1: 'not-an-array',
        Stale: [wolf()],
        First: [bear(), wolf()],
        Second: [wolf()],
      },
      inRange: source => source !== 'Stale',
    });

    expect(await getWolfAdvantageAgainst(vs({ mapData: grid('Attacker', 'P1', 'Stale', 'First', 'Second') })))
      .toEqual({ advantage: true, source: 'First' });
    expect(isWithinRange).toHaveBeenCalledTimes(2); // Stale measured-and-failed, First measured-and-won; Second never reached
  });

  it('skipRangeCheck grants an enemy target from the first matching holder without measuring', async () => {
    // The self/enemy/attacker gates run BEFORE the skip branch (pinned above),
    // and the gridless lane's refusals below run under skipRangeCheck — proof
    // the skip never bypasses the target-enemy gate.
    seed({ buffs: { Barbarian: [wolf()], Druid: [wolf()] }, inRange: false });

    expect(await getWolfAdvantageAgainst(vs({ mapData: grid('Attacker', 'Barbarian', 'Druid'), skipRangeCheck: true })))
      .toEqual({ advantage: true, source: 'Barbarian' });
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('a null targetName stays lenient: grants without the target gate or any range measurement (house law §44)', async () => {
    seed({ buffs: { Barbarian: [wolf()] }, inRange: false });

    // measured-path shape with no resolvable target (legacy callers/tests; the
    // map lane only reaches the measured path with a targetPos, which implies
    // a target, but leniency must never fabricate a refusal)
    expect(await getWolfAdvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Attacker', 'Barbarian') }))
      .toEqual({ advantage: true, source: 'Barbarian' });
    // skipRangeCheck shape (phantom/tokenless target)
    expect(await getWolfAdvantageAgainst(vs({ targetName: null, skipRangeCheck: true })))
      .toEqual({ advantage: true, source: 'Barbarian' });
    expect(isWithinRange).not.toHaveBeenCalled();

    // leniency covers only the UNGATABLE target axis — the attacker-side betrayal
    // gate still refuses a defector (gate order: bearerSupports runs first)
    seed({ buffs: { Barbarian: [wolf()] }, allies: { Barbarian: ['Barbarian'] } });
    expect(await getWolfAdvantageAgainst(vs({ targetName: null })))
      .toEqual({ advantage: false });
  });
});

describe('getWolfAdvantageAgainst — gridless combat-context lane (always skipRangeCheck in prod)', () => {
  beforeEach(resetMocks);

  const party = [
    { name: 'Thug 1', type: 'npc' },
    { name: 'DraconicDragon', type: 'player' },
    { name: 'HexWarlock', type: 'player' },
    { name: 'OtherPc', type: 'player' },
  ];

  const sync = (extra = {}) => ({
    attackerName: 'HexWarlock',
    targetName: 'Thug 1',
    campaignName: CAMPAIGN,
    skipRangeCheck: true,
    ...extra,
  });

  it('pulls the party from the awaited combat context, filters NPC bearers, and grants for an NPC-target enemy unmeasured', async () => {
    getCombatContext.mockResolvedValue({ creatures: party });
    seed({ buffs: { 'Thug 1': [wolf()], DraconicDragon: [wolf()] } });

    expect(await getWolfAdvantageAgainst(sync()))
      .toEqual({ advantage: true, source: 'DraconicDragon' });
    expect(getCombatContext).toHaveBeenCalledWith(CAMPAIGN);
    expect(getRuntimeValue).not.toHaveBeenCalledWith('Thug 1', 'activeBuffs', CAMPAIGN);
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('refuses when the combat summary is unusable (null or without creatures) even with a Wolf holder seeded', async () => {
    seed({ buffs: { DraconicDragon: [wolf()] } });

    // default mock resolves null
    expect(await getWolfAdvantageAgainst(sync()))
      .toEqual({ advantage: false });
    getCombatContext.mockResolvedValue({});
    expect(await getWolfAdvantageAgainst(sync()))
      .toEqual({ advantage: false });
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('legacy split on the context lane: the cs player-filter ally set refuses a party-PC target under skipRangeCheck', async () => {
    // Off-roster/non-player targets are the enemy arm pinned by the grant test
    // above (Thug 1 is off partyNames); only membership in the gridless-built
    // ally set is a distinct leg here.
    getCombatContext.mockResolvedValue({ creatures: party });
    seed({ buffs: { DraconicDragon: [wolf()] } });

    expect(await getWolfAdvantageAgainst(sync({ targetName: 'OtherPc' })))
      .toEqual({ advantage: false });
  });
});

// Phase 3.2 betrayal validation on the ATTACKER axis (the target-axis arms of the
// same hasExplicitAllyList/getAllyList flip are pinned in the grid table above:
// off-list grant + on-list refuse; the gridless lane shares that one code path).
describe('getWolfAdvantageAgainst — bearer-side betrayal gate (attacker axis)', () => {
  beforeEach(resetMocks);

  it('an edited list that drops the attacker refuses; one still naming the attacker keeps the pack benefit (target off-list = enemy)', async () => {
    seed({ buffs: { Barbarian: [wolf()] }, allies: { Barbarian: ['Barbarian'] } });
    expect(await getWolfAdvantageAgainst(vs()))
      .toEqual({ advantage: false });

    seed({ buffs: { Barbarian: [wolf()] }, allies: { Barbarian: ['Barbarian', 'Attacker'] } });
    expect(await getWolfAdvantageAgainst(vs()))
      .toEqual({ advantage: true, source: 'Barbarian' });
  });
});
