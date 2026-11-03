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
// passes it. Pattern-siblings: lionAuraUtils.test.js / duplicityAuraUtils.test.js.
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
    ['attacker is the only Wolf holder', { buffs: { Attacker: [wolf()] } }, vs()],
    ['Rage of the Wilds without the Wolf optionName', { buffs: { Barbarian: [{ name: 'Rage of the Wilds' }] } }, vs()],
    ['Wolf optionName without the Rage of the Wilds name', { buffs: { Barbarian: [{ optionName: 'Wolf' }] } }, vs()],
    ['near-miss names (Bear sibling, similarly named buffs)', { buffs: { Barbarian: [bear()], Druid: [{ name: 'Wrath of the Wilds', optionName: 'Wolf' }] } }, vs()],
    ['non-array buff values survive iteration (list guard, not member guard)', { buffs: { Barbarian: 'not-an-array', Druid: null, Monk: 42 } }, vs()],
    ['solo attacker grid', {}, vs({ mapData: grid('Attacker') })],
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

  it('skipRangeCheck grants an enemy target from the first matching holder without measuring range', async () => {
    seed({ buffs: { Barbarian: [wolf()], Druid: [wolf()] }, inRange: false });

    expect(await getWolfAdvantageAgainst(vs({ mapData: grid('Attacker', 'Barbarian', 'Druid'), skipRangeCheck: true })))
      .toEqual({ advantage: true, source: 'Barbarian' });
    expect(isWithinRange).not.toHaveBeenCalled();

    // the attacker is still skipped even unmeasured
    expect(await getWolfAdvantageAgainst(vs({ mapData: grid('Attacker'), targetName: 'Target', skipRangeCheck: true })))
      .toEqual({ advantage: false });

    // …and skipRangeCheck does NOT bypass the target-enemy gate
    expect(await getWolfAdvantageAgainst(vs({ targetName: 'Barbarian', skipRangeCheck: true })))
      .toEqual({ advantage: false }); // self-target
  });

  it('a null targetName stays lenient: grants without the target gate or any range measurement (house law §44)', async () => {
    seed({ buffs: { Barbarian: [wolf()] }, inRange: false });

    // measured-path shape with no resolvable target (legacy callers/tests; the
    // map lane only reaches the measured path with a targetPos, which implies
    // a target, but leniency must never fabricate a refusal)
    expect(await getWolfAdvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Attacker', 'Barbarian') }))
      .toEqual({ advantage: true, source: 'Barbarian' });
    // skipRangeCheck shape (phantorm/tokenless target)
    expect(await getWolfAdvantageAgainst(vs({ targetName: null, skipRangeCheck: true })))
      .toEqual({ advantage: true, source: 'Barbarian' });
    expect(isWithinRange).not.toHaveBeenCalled();

    // leniency covers only the UNGATABLE target axis — the attacker-side betrayal
    // gate still refuses a defector
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

  it('an off-roster (unknown, non-null) target is legacy-enemy and stays lenient', async () => {
    getCombatContext.mockResolvedValue({ creatures: party });
    seed({ buffs: { DraconicDragon: [wolf()] } });

    expect(await getWolfAdvantageAgainst(sync({ targetName: 'OffRosterPhantom' })))
      .toEqual({ advantage: true, source: 'DraconicDragon' });
  });

  it.each([
    ['no combat context available', null, { 'Thug 1': [wolf()], DraconicDragon: [wolf()] }, sync()],
    ['summary without creatures', {}, { 'Thug 1': [wolf()], DraconicDragon: [wolf()] }, sync()],
    ['Wolf held only by an NPC', { creatures: party }, { 'Thug 1': [wolf()] }, sync()],
    ['party holds no Wolf buff', { creatures: party }, {}, sync()],
    ['legacy split: the target is a party PC (ally)', { creatures: party }, { DraconicDragon: [wolf()] }, sync({ targetName: 'OtherPc' })],
    ['the bearer is the target (never its own enemy)', { creatures: party }, { DraconicDragon: [wolf()] }, sync({ targetName: 'DraconicDragon' })],
  ])('%s → no advantage', async (_label, summary, buffs, call) => {
    getCombatContext.mockResolvedValue(summary);
    seed({ buffs });

    expect(await getWolfAdvantageAgainst(call))
      .toEqual({ advantage: false });
    expect(isWithinRange).not.toHaveBeenCalled();
  });
});

// Phase 3.2 betrayal validation (arena-starter §4) on BOTH axes: an EDITED ally
// list on the bearer flips the pack benefit — self-only defection drops former
// allies (attacker gate), a list omitting the target makes it an enemy (grant),
// a list naming the target keeps it friendly (refuse). Unedited bearers stay
// legacy party-by-type.
describe('getWolfAdvantageAgainst — betrayal ally-list flip (attacker + target gates)', () => {
  beforeEach(resetMocks);

  it('a defector bearer (self-only edited list) no longer grants the attacker advantage', async () => {
    seed({ buffs: { Barbarian: [wolf()] }, allies: { Barbarian: ['Barbarian'] } });
    expect(await getWolfAdvantageAgainst(vs()))
      .toEqual({ advantage: false });
  });

  it('an edited list that still names the attacker keeps the pack benefit (target off-list = enemy)', async () => {
    seed({ buffs: { Barbarian: [wolf()] }, allies: { Barbarian: ['Barbarian', 'Attacker'] } });
    expect(await getWolfAdvantageAgainst(vs()))
      .toEqual({ advantage: true, source: 'Barbarian' });
  });

  it('gridless: an edited bearer treats a target ON its list as friendly', async () => {
    getCombatContext.mockResolvedValue({ creatures: [{ name: 'DraconicDragon', type: 'player' }, { name: 'HexWarlock', type: 'player' }, { name: 'Thug 1', type: 'npc' }] });
    seed({ buffs: { DraconicDragon: [wolf()] }, allies: { DraconicDragon: ['DraconicDragon', 'HexWarlock', 'Thug 1'] } });
    expect(await getWolfAdvantageAgainst({ attackerName: 'HexWarlock', targetName: 'Thug 1', campaignName: CAMPAIGN, skipRangeCheck: true }))
      .toEqual({ advantage: false });
  });

  it('gridless: an edited bearer treats a target OFF its list as enemy', async () => {
    getCombatContext.mockResolvedValue({ creatures: [{ name: 'DraconicDragon', type: 'player' }, { name: 'HexWarlock', type: 'player' }, { name: 'Thug 1', type: 'npc' }] });
    seed({ buffs: { DraconicDragon: [wolf()] }, allies: { DraconicDragon: ['DraconicDragon', 'HexWarlock'] } });
    expect(await getWolfAdvantageAgainst({ attackerName: 'HexWarlock', targetName: 'Thug 1', campaignName: CAMPAIGN, skipRangeCheck: true }))
      .toEqual({ advantage: true, source: 'DraconicDragon' });
  });
});
