// truePolymorph HEXAD lane #1982 — .ResolveMaxCR: canonical resolveTruePolymorphMaxCR MATH.
// Owns (truePolymorphHandler.js :44-55 + parseChallengeRating :13-21): the numeric
// creature→creature CR-cap table. This is the canonical math home — the full unit
// matrix stays here.
//
// Read first: #1980 seam map (truePolymorphHandleModes.test.js header) + handler-main
// decisions #1981 (truePolymorphHandler.test.js header).
//
// Liveness (verified 2026-10-16): internal LIVE via handler :215 (resolveCreatureTargetMode
// ← handle :253 ← index.js:539 `true_polymorph` dispatch); external export has ZERO prod
// consumers (grep across src/: tests only) → canonical unit matrix, direct calls.
//
// Ownership boundaries (per seam map):
//   • mode routing + popup payload shapes + the object_into_creature hardcoded-9 DISCARD
//     (:215 compute → :163 literal): #1980 lane. The resolver is MODE-AGNOSTIC — no
//     `mode` param exists; this lane never pins payloads or the discard.
//   • gates / save flow / ally skip: #1981 lane.
//   • writes (concentration, targetEffects, form stats): service lanes #1983/#1986.
//     Purity here is structural: the ONLY mocked surface is monsterUtils + utils.getName
//     — no runtime/log imports exist on the resolver's code path.
//   • object cap CR≤9 lives in buildModePopup (:163/:277), flagged by #1980; pinned
//     below ONLY as disk RAW evidence, never as resolver output.
//
// RAW basis (verified against disk, both rulesets, 2026-10-16):
//   5e   spells.json: cap is target's CR "or its level, if the target doesn't have a
//        challenge rating" → PC branch returns FULL level; monster branch returns CR.
//   2024 spells.json: "Challenge Rating equal to or less than the target's Challenge
//        Rating or level" — same math, one shared resolver, dual-ruleset by design.
//   HALF-LEVEL rule is ABSENT from both true-polymorph rows (verified: no /half/i in
//   either row) — that rule belongs to shapechange (#1953 compact-table). Negative-pin below.
//
// Honesty notes:
//   • makeAction merge n/a: resolver takes plain args, no action object here.
//   • arity: resolver never consumes campaignName (arg 2) — inert pass-through; prod call
//     site :215 forwards it, getMonsterData is invoked (targetName, null) so the
//     campaign-NPC fallback (monsterUtils.js:55) is NEVER entered — bestiary-only cap.
//     Custom NPCs therefore land on DEFAULT_MAX_CR (1).
//   • no timers: the only async is the awaited getMonsterData promise.
import { describe, it, expect, vi, beforeEach } from 'vitest';

import spells5e from '../../../../../public/data/spells.json' with { type: 'json' };
import spells2024 from '../../../../../public/data/2024/spells.json' with { type: 'json' };

vi.mock('../../../npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(),
}));

// Mirrors prod utils.getName exactly (utils.js:12-17): identity with
// 'Unknown' guard — case-sensitive, non-string → 'Unknown'.
vi.mock('../../../ui/utils.js', () => ({
  default: { getName: (fullName) => (!fullName || typeof fullName !== 'string' ? 'Unknown' : fullName) },
}));

import { resolveTruePolymorphMaxCR } from './truePolymorphHandler.js';
import { getMonsterData } from '../../../npcs/monsterUtils.js';

const campaignName = 'TestCampaign';
const targetName = 'Goblin';

function truePolymorphRow(spells) {
  return spells.find(s => s.index === 'true-polymorph');
}

describe('truePolymorph RAW basis — public/data spells.json rows (data drift fails loudly)', () => {
  it('ships as level 9 concentration in BOTH rulesets with index true-polymorph', () => {
    for (const [file, spells] of [['5e', spells5e], ['2024', spells2024]]) {
      const row = truePolymorphRow(spells);
      expect(row, `true-polymorph row missing in ${file} spells.json`).toBeDefined();
      expect(row.name).toBe('True Polymorph');
      expect(row.level).toBe(9);
      expect(row.concentration).toBe(true);
    }
  });

  it('creature→creature cap sentence: full CR or level, NO halving (both rulesets)', () => {
    const text5e = truePolymorphRow(spells5e).description.join('\n');
    const text2024 = truePolymorphRow(spells2024).description.join('\n');
    // Exact disk sentences the two resolver branches implement (:46-49 PC level, :50-53 CR).
    expect(text5e).toContain(
      "whose challenge rating is equal to or less than the target's (or its level, if the target doesn't have a challenge rating)"
    );
    expect(text2024).toContain(
      "Challenge Rating equal to or less than the target's Challenge Rating or level"
    );
    // Half-level is shapechange territory (#1953) — must not leak into this math.
    expect(/half/i.test(text5e)).toBe(false);
    expect(/half/i.test(text2024)).toBe(false);
  });

  it('object→creature CR≤9 cap exists on disk (literal lives in buildModePopup — #1980 owns it)', () => {
    expect(truePolymorphRow(spells5e).description.join('\n')).toContain(
      "the creature's challenge rating is 9 or lower"
    );
    expect(truePolymorphRow(spells2024).description.join('\n')).toContain(
      'Challenge Rating of 9 or lower'
    );
  });
});

describe('truePolymorphHandler.resolveTruePolymorphMaxCR — canonical CR-cap math', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // PC branch (:45-49): RAW full-level cap, computedStats.level preferred, exact
  // case-sensitive getName match, first match wins.
  it.each([
    ['PC cap = computedStats.level (full level, no halving)', targetName, [{ name: targetName, computedStats: { level: 7 } }], 7],
    ['top-level level fallback', targetName, [{ name: targetName, level: 5 }], 5],
    ['computedStats.level beats level', targetName, [{ name: targetName, level: 3, computedStats: { level: 8 } }], 8],
    ['exact multiword name match', 'Goblin the Brave', [{ name: 'Goblin the Brave', computedStats: { level: 9 } }], 9],
    ['level 1 boundary', targetName, [{ name: targetName, computedStats: { level: 1 } }], 1],
    ['level 20 boundary', targetName, [{ name: targetName, computedStats: { level: 20 } }], 20],
    ['duplicate names: first match wins', targetName, [{ name: targetName, computedStats: { level: 4 } }, { name: targetName, computedStats: { level: 6 } }], 4],
  ])('%s', async (_label, target, characters, expected) => {
    expect(await resolveTruePolymorphMaxCR(target, campaignName, characters)).toBe(expected);
  });

  // PCs that fail the `typeof level === 'number' && level > 0` gate (:48) or the
  // getName match (:45) fall through to the monster lane — never silently 0, never
  // half — and a fully unresolvable target defaults to 1.
  it.each([
    ['non-number level skipped → monster CR', targetName, [{ name: targetName, computedStats: { level: 'unknown' } }], { challenge_rating: '2' }, 2],
    ['level 0 fails >0 gate → monster CR', targetName, [{ name: targetName, computedStats: { level: 0 } }], { challenge_rating: 4 }, 4],
    ['negative level fails gate → monster CR', targetName, [{ name: targetName, level: -3 }], { challenge_rating: 4 }, 4],
    ['PC found but no level field, no bestiary row → DEFAULT_MAX_CR', targetName, [{ name: targetName }], null, 1],
    ['name mismatch is case-sensitive → monster CR lane', targetName, [{ name: 'goblin', computedStats: { level: 9 } }], { challenge_rating: 2 }, 2],
  ])('%s', async (_label, target, characters, monsterData, expected) => {
    getMonsterData.mockResolvedValue(monsterData);

    expect(await resolveTruePolymorphMaxCR(target, campaignName, characters)).toBe(expected);
  });

  // characters-arg guards: default `= []` (:44) and the `|| []` belt-and-braces.
  it.each([
    ['characters omitted', undefined],
    ['characters null', null],
  ])('%s → falls through to bestiary lane', async (_label, characters) => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: 3 });

    expect(await resolveTruePolymorphMaxCR(targetName, campaignName, characters)).toBe(3);
  });

  // parseChallengeRating (:13-21) owns the numeric cap values, incl fractions and
  // garbage → 0 (monsterUtils bestiary CR is stringly typed upstream).
  it.each([
    [3, 3],
    ['2', 2],
    ['12', 12],
    ['1/8', 0.125],
    ['1/4', 0.25],
    ['1/2', 0.5],
    ['3/4', 0.75],
    [0, 0], // numeric CR 0 survives the `!= null && !== ''` guard and parses to 0 — does NOT default to 1
    ['0/1', 0],
    ['invalid', 0],
  ])('bestiary challenge_rating %s → maxCR %s', async (cr, expected) => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: cr });

    expect(await resolveTruePolymorphMaxCR(targetName, campaignName, [])).toBe(expected);
  });

  // DEFAULT_MAX_CR = 1 (:11, :54) — the custom-NPC landing spot (npcs.json is never
  // consulted: getMonsterData is called with npcs=null, see call-shape pin below).
  it.each([
    ['bestiary miss (getMonsterData → null)', null],
    ['challenge_rating null', { name: targetName, challenge_rating: null }],
    ['challenge_rating empty string', { name: targetName, challenge_rating: '' }],
    ['mock default (resolved undefined)', undefined],
  ])('%s → DEFAULT_MAX_CR 1', async (_label, monsterData) => {
    getMonsterData.mockResolvedValue(monsterData);

    expect(await resolveTruePolymorphMaxCR(targetName, campaignName, [])).toBe(1);
  });

  it('queries bestiary with (targetName, null) — campaign-NPC fallback never entered, campaignName inert', async () => {
    getMonsterData.mockResolvedValue({ name: targetName, challenge_rating: 3 });

    // campaignName is not consumed by the resolver; any value yields the same call.
    await resolveTruePolymorphMaxCR(targetName, 'SomeOtherCampaign', []);

    expect(getMonsterData).toHaveBeenCalledTimes(1);
    expect(getMonsterData).toHaveBeenCalledWith(targetName, null);
  });

  it('short-circuits on PC hit — bestiary never queried, zero side calls', async () => {
    const maxCR = await resolveTruePolymorphMaxCR(targetName, campaignName, [{ name: targetName, computedStats: { level: 17 } }]);

    expect(maxCR).toBe(17);
    expect(getMonsterData).not.toHaveBeenCalled();
  });
});
