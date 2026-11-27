// @maintained-by-ai 2026-11-27
// regression: bug-lion-aura-penalizes-allies-not-just-enemies — the ATTACKER
// hostility gate (Power of the Wilds "any of your enemies within 5 feet of
// you") is pinned in the 'attacker hostility gate' block below; regression:
// bug-lion-aura-self-target-exclusion-inert ("attacks against targets other
// than you") + bug-lion-aura-second-barbarian-exemption-missing ("or another
// Barbarian who has this option active") are BOTH pinned in the 'Lion-holder
// target exemption' block below — a bearer necessarily carries the Lion stamp,
// so the pre-loop targetIsExemptFromLionAuras read covers the bearer-self case
// too and the two axes share one code path.
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
// Attacker axis (RAW "any of YOUR ENEMIES within 5 feet of you have Disadvantage",
// bug-lion-aura-penalizes-allies-not-just-enemies): the ATTACKER must be an enemy of
// the bearer, wolf-mirrored (wolfAuraUtils.targetIsEnemyOfBearer). Unedited bearer →
// legacy party-by-type split: names on the candidate list (map players[] / gridless
// type-'player' creatures) are allies and exempt; off-list attackers (NPC/monster
// tokens, which live in placedItems[] on the map lane) pay it. EDITED ally-list
// bearer → everyone OFF its list is an enemy (betrayal direction, 2026-11-03 owner
// ruling — the aura is a debuff on the attacker, so hostility rules).
// targetName axis (RAW "against targets other than you or another Barbarian
// who has this option active"): a bearer who IS the attack's target is skipped
// per-bearer, and a target carrying its own Lion stamp is exempt from EVERY
// bearer's aura (bug-lion-aura-second-barbarian-exemption-missing). A null/
// omitted targetName stays lenient (no exclusion).
// Pattern-sibling: duplicityAuraUtils.test.js (same ctx/skip skeleton, trimmed).
const CAMPAIGN = 'test-campaign';

// Grid lane candidate list = the PARTY tokens only (monster/NPC tokens live in
// placedItems[], never here) — enemy attackers therefore appear as names passed
// via attackerName that are NOT listed in grid(...).
const grid = (...names) => ({ players: names.map(name => ({ name, gridX: 0, gridY: 0 })) });
const lion = (range) => range === undefined ? { optionName: 'Lion' } : { optionName: 'Lion', range };

function resetMocks() {
  getRuntimeValue.mockReset().mockReturnValue([]);
  isWithinRange.mockReset().mockResolvedValue(false);
  getCombatContext.mockReset().mockResolvedValue(null);
}

// Seeds runtime per player name; inRange may be a bool or per-source predicate.
// allies carries per-player EDITED selectedAllies lists (Phase 3.2 betrayal);
// any other key reads null (unedited → legacy party-by-type default).
function seed({ buffs = {}, allies = {}, inRange = true } = {}) {
  getRuntimeValue.mockImplementation((name, key) => {
    if (key === 'activeBuffs') return name in buffs ? buffs[name] : [];
    if (key === 'selectedAllies') return allies[name] ?? null;
    return null;
  });
  isWithinRange.mockImplementation(async source =>
    typeof inRange === 'function' ? inRange(source) : inRange);
}

describe('getLionDisadvantageAgainst — grid lane', () => {
  beforeEach(resetMocks);

  it('forces disadvantage for an in-range ENEMY Lion holder and pins its lookups', async () => {
    seed({ buffs: { Barbarian: [{ optionName: 'Bear' }, lion()] } });

    // 'Attacker' is off players[] (monster-token doctrine) → enemy of the
    // unedited bearer → pays the aura.
    expect(await getLionDisadvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Barbarian') }))
      .toEqual({ disadvantage: true, source: 'Barbarian' });
    expect(getRuntimeValue).toHaveBeenCalledWith('Barbarian', 'activeBuffs', CAMPAIGN);
    expect(isWithinRange).toHaveBeenCalledWith('Barbarian', 'Attacker', 5);
    expect(getCombatContext).not.toHaveBeenCalled();
  });

  it.each([
    ['attacker is the only Lion holder', { buffs: { Attacker: [lion()] } }, grid('Attacker')],
    ['no player holds Lion (near-miss name and other buffs)', { buffs: { Barbarian: [{ optionName: 'Bear' }], Druid: [{ optionName: 'Lioness' }] } }, grid('Barbarian', 'Druid')],
    ['Lion holder out of 5 ft range', { buffs: { Barbarian: [lion()] }, inRange: false }, grid('Barbarian')],
    ['non-array buff values survive iteration', { buffs: { Barbarian: 'not-an-array', Druid: null, Monk: 42 } }, grid('Barbarian', 'Druid', 'Monk')],
    ['solo attacker grid', {}, grid('Attacker')],
    ['mapData without players never falls back to the combat context', {}, { placedItems: [] }],
  ])('%s → no disadvantage', async (_label, setup, mapData) => {
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

    expect(await getLionDisadvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('P1', 'Stale', 'First', 'Second') }))
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

    expect(await getLionDisadvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Barbarian') }))
      .toEqual({ disadvantage: true, source: 'Barbarian' });
    expect(isWithinRange).toHaveBeenCalledWith('Barbarian', 'Attacker', expectedRange);
  });

  it('skipRangeCheck grants the first matching holder without measuring range', async () => {
    seed({ buffs: { Barbarian: [lion()] }, inRange: false });

    expect(await getLionDisadvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Barbarian'), skipRangeCheck: true }))
      .toEqual({ disadvantage: true, source: 'Barbarian' });
    expect(isWithinRange).not.toHaveBeenCalled();

    // the attacker is still skipped even unmeasured
    expect(await getLionDisadvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Attacker'), skipRangeCheck: true }))
      .toEqual({ disadvantage: false });
  });
});

// bug-lion-aura-penalizes-allies-not-just-enemies: RAW + the app's own modal
// copy restrict the aura to "your enemies". A party ally of the bearer must
// NEVER pay the Disadvantage (the live repro: ally EvasiveFighter 5 ft from
// lion bearer DraconicDragon, attacking party FeyRanger, logged
// mode:'disadvantage' pre-fix). Monster/NPC attackers stay penalized.
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

    // 'Thug 1' attacks: off the type-'player' party set → enemy → DD's Lion
    // aura grants unmeasured. NPC candidates are never buff-scanned.
    expect(await getLionDisadvantageAgainst({ attackerName: 'Thug 1', campaignName: CAMPAIGN, skipRangeCheck: true }))
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

    expect(await getLionDisadvantageAgainst({ attackerName: 'Thug 1', campaignName: CAMPAIGN, skipRangeCheck: true }))
      .toEqual({ disadvantage: false });
    expect(isWithinRange).not.toHaveBeenCalled();
  });
});

describe('getLionDisadvantageAgainst — attacker hostility gate (your enemies)', () => {
  beforeEach(resetMocks);

  it('spares a party-ally attacker standing next to an unedited bearer (grid lane)', async () => {
    seed({ buffs: { DraconicDragon: [lion()] } });

    expect(await getLionDisadvantageAgainst({
      attackerName: 'EvasiveFighter',
      targetName: 'FeyRanger',
      campaignName: CAMPAIGN,
      mapData: grid('DraconicDragon', 'EvasiveFighter', 'FeyRanger'),
    })).toEqual({ disadvantage: false });
    expect(isWithinRange).not.toHaveBeenCalled(); // hostility short-circuits before measurement
  });

  it('spares a party-ally attacker on the unmeasured gridless lane too', async () => {
    getCombatContext.mockResolvedValue({ creatures: [
      { name: 'DraconicDragon', type: 'player' },
      { name: 'HexWarlock', type: 'player' },
    ] });
    seed({ buffs: { DraconicDragon: [lion()] } });

    expect(await getLionDisadvantageAgainst({ attackerName: 'HexWarlock', targetName: 'DraconicDragon', campaignName: CAMPAIGN, skipRangeCheck: true }))
      .toEqual({ disadvantage: false });
  });

  it('still penalizes an off-list monster/NPC attacker (placedItems-token doctrine)', async () => {
    seed({ buffs: { Barbarian: [lion()] } });

    // Gazer sits in placedItems[], never players[] → off party set → enemy.
    expect(await getLionDisadvantageAgainst({
      attackerName: 'Gazer',
      targetName: 'Wizard',
      campaignName: CAMPAIGN,
      mapData: { players: [{ name: 'Barbarian', gridX: 0, gridY: 0 }], placedItems: [{ name: 'Gazer', type: 'monster', gridX: 1, gridY: 0 }] },
    })).toEqual({ disadvantage: true, source: 'Barbarian' });
    expect(isWithinRange).toHaveBeenCalledWith('Barbarian', 'Gazer', 5);
  });

  it('spares an ally attacker even when skipRangeCheck is set (hostility precedes measurement)', async () => {
    seed({ buffs: { Barbarian: [lion()] } });

    expect(await getLionDisadvantageAgainst({ attackerName: 'Wizard', targetName: 'Druid', campaignName: CAMPAIGN, mapData: grid('Barbarian', 'Wizard', 'Druid'), skipRangeCheck: true }))
      .toEqual({ disadvantage: false });
  });
});

// Phase 3.2 betrayal validation (arena-starter §4) — INVERTED to the wolf
// doctrine (2026-11-03 owner ruling, wolfAuraUtils.targetIsEnemyOfBearer):
// the Lion aura debuffs the bearer's ENEMIES, so an EDITED ally list excludes
// listed allies from the penalty and keeps everyone else (former party members
// betrayals included) penalized.
describe('getLionDisadvantageAgainst — betrayal ally-list flip (off-list = enemy)', () => {
  beforeEach(resetMocks);

  it('a defector bearer (self-only edited list) still penalizes its former allies', async () => {
    seed({ buffs: { Barbarian: [lion()] }, allies: { Barbarian: ['Barbarian'] } });
    expect(await getLionDisadvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Barbarian', 'Attacker') }))
      .toEqual({ disadvantage: true, source: 'Barbarian' });
  });

  it('an edited list naming the attacker treats them as ally — penalty lifted', async () => {
    seed({ buffs: { Barbarian: [lion()] }, allies: { Barbarian: ['Barbarian', 'Attacker'] } });
    expect(await getLionDisadvantageAgainst({ attackerName: 'Attacker', campaignName: CAMPAIGN, mapData: grid('Barbarian', 'Attacker') }))
      .toEqual({ disadvantage: false });
  });
});

// Clause axes 1 + 2 (bug-lion-aura-self-target-exclusion-inert, bug-lion-aura-
// second-barbarian-exemption-missing): RAW "against targets other than you OR
// ANOTHER BARBARIAN WHO HAS THIS OPTION ACTIVE" (2024 classes.json, Path of the
// Beast). Both axes ride the same pre-loop targetIsExemptFromLionAuras read —
// a bearer always carries the Lion stamp, so "target IS the bearer" is just
// the self case of "target holds a stamp". A near-miss stamp grants no
// exemption; a null/omitted targetName stays lenient. Both production lanes
// (contextBuilder-sync resolveLionAura / contextBuilder-map
// accumulateAuraCounts and monster-card resolveMonsterLionAura) ride this one
// util, so grid / skipRangeCheck / gridless faces pin both-lane parity.
describe('getLionDisadvantageAgainst — Lion-holder target exemption (you, or another Barbarian with the option)', () => {
  beforeEach(resetMocks);

  const bearers = () => ({ buffs: { ElderPaladin: [lion()], DraconicDragon: [lion()] } });
  const twoBearerGrid = () => grid('ElderPaladin', 'DraconicDragon');

  it.each([
    ['the bearer itself', 'ElderPaladin'],
    ['another Lion holder', 'DraconicDragon'],
  ])('exempts a measured grid attack whose target is %s', async (_label, targetName) => {
    seed(bearers());

    expect(await getLionDisadvantageAgainst({ attackerName: 'Goblin', targetName, campaignName: CAMPAIGN, mapData: twoBearerGrid() }))
      .toEqual({ disadvantage: false });
    expect(getRuntimeValue).toHaveBeenCalledWith(targetName, 'activeBuffs', CAMPAIGN);
    expect(isWithinRange).not.toHaveBeenCalled(); // exemption precedes measurement
  });

  it.each([
    ['the bearer itself', 'ElderPaladin'],
    ['another Lion holder', 'DraconicDragon'],
  ])('exempts %s on the unmeasured skipRangeCheck face too', async (_label, targetName) => {
    seed(bearers());

    expect(await getLionDisadvantageAgainst({ attackerName: 'Goblin', targetName, campaignName: CAMPAIGN, mapData: twoBearerGrid(), skipRangeCheck: true }))
      .toEqual({ disadvantage: false });
  });

  it('exempts a holder target on the gridless combat-context lane (monster-card face)', async () => {
    getCombatContext.mockResolvedValue({ creatures: [
      { name: 'Goblin', type: 'npc' },
      { name: 'ElderPaladin', type: 'player' },
      { name: 'DraconicDragon', type: 'player' },
      { name: 'Wild_Sage_Druid', type: 'player' },
    ] });
    seed(bearers());

    expect(await getLionDisadvantageAgainst({ attackerName: 'Goblin', targetName: 'DraconicDragon', campaignName: CAMPAIGN, skipRangeCheck: true }))
      .toEqual({ disadvantage: false });
    expect(isWithinRange).not.toHaveBeenCalled();
  });

  it('positive: an enemy attacking a NON-holder target pays the first bearer’s aura', async () => {
    // Self/holder exemption never masks a bearer: the out-of-range
    // ElderPaladin can't fire, so the in-range DraconicDragon wins.
    seed({ ...bearers(), inRange: source => source !== 'ElderPaladin' });

    expect(await getLionDisadvantageAgainst({ attackerName: 'Goblin', targetName: 'Wild_Sage_Druid', campaignName: CAMPAIGN, mapData: grid('ElderPaladin', 'DraconicDragon', 'Wild_Sage_Druid') }))
      .toEqual({ disadvantage: true, source: 'DraconicDragon' });
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('lenient when the caller passes no target (%s) — legacy behavior unchanged', async (_label, targetName) => {
    seed(bearers());

    expect(await getLionDisadvantageAgainst({ attackerName: 'Goblin', targetName, campaignName: CAMPAIGN, mapData: grid('ElderPaladin') }))
      .toEqual({ disadvantage: true, source: 'ElderPaladin' });
  });

  it('a near-miss target stamp (optionName Bear) grants no exemption', async () => {
    seed({ buffs: { ElderPaladin: [lion()], DraconicDragon: [{ optionName: 'Bear' }] } });

    expect(await getLionDisadvantageAgainst({ attackerName: 'Goblin', targetName: 'DraconicDragon', campaignName: CAMPAIGN, mapData: twoBearerGrid() }))
      .toEqual({ disadvantage: true, source: 'ElderPaladin' });
  });
});
