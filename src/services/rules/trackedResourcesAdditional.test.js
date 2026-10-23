// @maintained-by-ai
// ADDITIONAL-resource lane for src/services/rules/trackedResources.js.
// The registry golden + two-way Venn + core/martial/divine ladders live in
// trackedResources.test.js (base lane); subclass-keyed seeds (_Star_Map,
// _Steps_of_the_Fey, tireless, naturesVeil, stonecunning, stonesEndurance,
// stormsThunder, preserveLife) and the extra applyServerOverride arms live in
// trackedResourcesSubclass.test.js. This file owns the 12 remaining seed
// lanes declared by the base header (:13-16): tranceOfOrder, adrenalineRush,
// darkOnesLuck, gloriousDefense, naturalRecovery, arcaneWard, mysticArcanum
// PRESENCE (absence half is base :356), healinglight, favoredEnemy,
// moonlightStep, cosmicomen, featsOfChaos — consolidated from 55 its into
// table-driven rows (old->new: trance 4->1, adrenaline 5->1, darkOnes 6->1,
// glorious 3->1, natural 3->1, arcaneWard 5->1, arcanum 4->1, healinglight
// 5->1, favoredEnemy 4->1, moonlight 5->1, cosmicomen 5->1, featsOfChaos
// 6->1) plus invocation-contract and purity rows. Compute is invoked by
// rulesFactory.js:203 and seeded once per character load via
// App.jsx:175-176 applyServerOverride -> trackedResourcesToStoreEntries.
// NO CLOCK: grep proves 0 Date.now/setTimeout/setInterval in the module;
// every per-day/rearm semantic is seam-owned by restRules-constants.js
// (LONG_REST_RESOURCES re-arms the tranceOfOrder latch, CLA-364).
//
// Disk-quoted max formulas (public/data, both rulesets where present):
//   darkOnesLuckUses :201-202  2024/classes.json "Dark One's Own Luck":
//     "Uses = Charisma modifier (minimum once)" -> Math.max(1, CHA).
//     DRIFT (reported): 5e/classes.json says "Once you use this feature,
//     you can't use it again until you finish a short or long rest" (=1);
//     the code applies the CHA formula on BOTH rulesets — pinned as-is.
//   arcaneWard*Hp    :111-116  classes.json "Arcane Ward": "hit point
//     maximum equal to twice your wizard level + your Intelligence
//     modifier" -> 2*level + INT, negative INT NOT clamped (row pinned).
//   healinglightPool :228       "Pool of d6s (number = 1 + Warlock level)"
//     -> 1 + level, level missing -> 1.
//   gloriousDefense  :259       "The bonus equals your Charisma modifier
//     (minimum of +1)" -> Math.max(CHA, 1), paladin-gated.
//   naturalRecovery  :307       fix#134 (#1532): ruleset-aware half.
//     5e classes.json Druid/Land lv2 "Natural Recovery": "combined level
//     that is equal to or less than half your druid level (rounded up)"
//     -> CEIL (lv5=3; old floor lv5=2 captured pre-fix by this lane).
//     2024/classes.json Circle of the Land lv6: "combined levels equal to
//     or less than half your Druid level" — NO round-up clause; integer
//     slot levels <= half -> FLOOR (lv7=3). Below the per-edition grant
//     level (5e lv2, 2024 lv6) -> 0 (disk rows grant at those levels).
//   moonlightStep    :311       2024 classes.json "Uses equal to Wisdom
//     modifier"; code adds a 1-floor via wisGatedPool (:297-300).
//   cosmicomen       :314       level>=6 Stars gate (#1515 family). #1532-b
//     claim "disk law = one omen per LR, seed should cap 1" is
//     DISPROVEN-BYTE-CITED: 2024/classes.json Circle of the Stars lv6
//     'Cosmic Omen' says "You can use this Reaction a number of times
//     equal to your Wisdom modifier (minimum of once), and you regain all
//     expended uses when you finish a Long Rest" + automation
//     .uses_expression "WIS modifier" -> max(WIS,1) IS the disk law.
//     The one-per-LR law rides a DIFFERENT key: cosmicOmenEffect rolls
//     exactly ONE omen per Long Rest (restRules-longRest.js
//     resetStarMapOnLongRest :519-535). Consumers honor the seed:
//     cosmicOmenHandler.js :11-31 + TrackedResourceInput.jsx :13 max={max}.
//   adrenalineRush   :164-168   UA Thief-style: uses = proficiency bonus,
//     gated on automation.specialActions effect 'bonus_action_dash'.
//   featsOfChaos   :371-378     2024 classes.json: one use until slot-cast
//     or Long Rest -> cap 1; seeded for 2024 Wild Magic Sorcery subclass OR
//     any feats_of_chaos automation entry (automation-driven, class NOT
//     gated — row pinned, old mislabeled title corrected).
//   tranceOfOrder    CLA-364 BUG-A (module :346-353): NEVER seeded here;
//     handler-owned null-as-available latch, Long-Rest null re-arm.
//   favoredEnemy   :288-290     exact-level class_levels row wins, else
//     floor 1. QUIRK (reported): NOT Ranger-gated — every class seeds
//     favoredEnemyUses >= 1 (row pins the leak honestly).
//
// Kill-matrix (analytic declaration; every mutation flips >=1 row):
//   re-add tranceOfOrderUses seed (CLA-364 regression) -> lane 1 both arms;
//   drop 'bonus_action_dash' match or proficiency formula -> adrenaline rows;
//   drop major-vs-subclass patron identity arm in matchesPatron (:195-197)
//   -> darkOnes 4 identity rows; drop Math.max(1,CHA) floor -> CHA 0/-2
//   rows; drop isWarlock gate -> non-warlock row; remove passive_rule
//   alternate match arm (:112) -> arcaneWard row 2; clamp negative INT ->
//   INT -2 row; add class gate -> non-wizard-with-passive quirk row;
//   drop arcanum presence gate or || 0 per-level default (:205-208) ->
//   arcanum partial/null rows; heal 1+level gate mutants -> healinglight
//   rows; floor vs ceil at odd levels -> naturalRecovery lv5/lv7 rows;
//   level>=6 / level>=14 style gate flips -> cosmicomen lv6/lv4 rows;
//   exact-level row lookup (:288) -> favoredEnemy level-3-row miss;
//   wisGatedPool 1-floor (:297-300) -> moonlight/cosmicomen WIS-missing
//   rows; 2024-only vs automation-independent arms (:376) -> featsOfChaos
//   rows; getClassFeatures arg/order -> invocation contract; shared-reference
//   pools -> purity identity set census.
//
// Mock census: trackedResources.js imports exactly 1 of 1 exports from
// ../character/classFeatures.js (getClassFeatures) — mocked completely,
// 1 of 1. Unit under test (trackedResources.js) is NEVER mocked.
// No dead module mocks. Campaign lockdown N/A: no campaign strings here.

import { describe, it, expect, vi, beforeEach } from 'vitest';

import classes2024 from '../../../public/data/2024/classes.json';
import classes5e from '../../../public/data/classes.json';

vi.mock('../character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(),
}));

import { getClassFeatures } from '../character/classFeatures.js';
import { computeTrackedResources } from './trackedResources.js';

function basePlayerStats(extra = {}) {
  return {
    level: 5,
    rules: '5e',
    class: { name: 'Wizard', class_levels: [], major: {}, subclass: {} },
    abilities: [],
    feats: [],
    ...extra,
  };
}

// Row runner: assertion keyed by label so a failure names the row and key.
function expectPool(stats, keys, expected, label) {
  const result = computeTrackedResources(stats);
  const actual = {};
  const expectedPool = {};
  for (const key of keys) {
    actual[key] = result[key];
    // Single-key rows pass the pool directly; multi-key rows pass a key map.
    expectedPool[key] = 'current' in expected ? expected : expected[key];
  }
  expect({ [label]: actual }).toEqual({ [label]: expectedPool });
  return result;
}

const warlock = (extra = {}) => ({ name: 'Warlock', class_levels: [], major: {}, subclass: {}, ...extra });
const druid = (extra = {}) => ({ name: 'Druid', class_levels: [], major: {}, subclass: {}, ...extra });

describe('computeTrackedResources — additional seed lanes', () => {
  beforeEach(() => vi.clearAllMocks());

  // CLA-364 BUG-A: the module header (:346-353) declares tranceOfOrderUses
  // deliberately unseeded — handler-owned null-as-available latch; a
  // grant-time 0-seed poisoned the store and charged the free first use
  // 5 SP. Both a feature-present and a bare fixture must miss the key.
  it('tranceOfOrderUses: never seeded, present-in-keys false even with the feature (CLA-364)', () => {
    const withFeature = computeTrackedResources(basePlayerStats({
      automation: { bonusActions: [{ type: 'trance_of_order' }] },
    }));
    expect('tranceOfOrderUses' in withFeature).toBe(false);
    expect(withFeature.tranceOfOrderUses).toBeUndefined();
    expect('tranceOfOrderUses' in computeTrackedResources(basePlayerStats())).toBe(false);
  });

  // :164-168 — gated on specialActions.effect === 'bonus_action_dash'.
  it('adrenalineRushUses: proficiency value when dash present, 0 on every miss arm', () => {
    const rows = [
      ['dash + prof 4', basePlayerStats({ automation: { specialActions: [{ effect: 'bonus_action_dash' }] }, proficiency: 4 }), { current: 4, max: 4 }],
      ['dash + prof undefined -> 0', basePlayerStats({ automation: { specialActions: [{ effect: 'bonus_action_dash' }] } }), { current: 0, max: 0 }],
      ['other special action effect', basePlayerStats({ automation: { specialActions: [{ effect: 'other_effect' }] }, proficiency: 4 }), { current: 0, max: 0 }],
      ['specialActions missing', basePlayerStats({ automation: {} }), { current: 0, max: 0 }],
      ['automation missing', basePlayerStats(), { current: 0, max: 0 }],
    ];
    for (const [label, stats, expected] of rows) expectPool(stats, ['adrenalineRushUses'], expected, label);
  });

  // :199-203 — matchesPatron reads major.name OR subclass.name; uses =
  // max(1, CHA). Negative CHA still floors at 1 ("minimum once").
  it('darkOnesLuckUses: Fiend identity via major/subclass, max(1,CHA) clamps, warlock gate', () => {
    const rows = [
      ['major Fiend CHA 3', basePlayerStats({ class: warlock({ major: { name: 'Fiend' } }), abilities: [{ name: 'Charisma', bonus: 3 }] }), { current: 3, max: 3 }],
      ['major Fiend Patron CHA 0 -> floor 1', basePlayerStats({ class: warlock({ major: { name: 'Fiend Patron' } }), abilities: [{ name: 'Charisma', bonus: 0 }] }), { current: 1, max: 1 }],
      ['subclass Fiend CHA 2', basePlayerStats({ class: warlock({ subclass: { name: 'Fiend' } }), abilities: [{ name: 'Charisma', bonus: 2 }] }), { current: 2, max: 2 }],
      ['subclass Fiend Patron CHA -2 -> floor 1', basePlayerStats({ class: warlock({ subclass: { name: 'Fiend Patron' } }), abilities: [{ name: 'Charisma', bonus: -2 }] }), { current: 1, max: 1 }],
      ['non-Fiend warlock CHA 5 -> 0', basePlayerStats({ class: warlock({ major: { name: 'Archfey' } }), abilities: [{ name: 'Charisma', bonus: 5 }] }), { current: 0, max: 0 }],
      ['non-warlock CHA 5 -> 0', basePlayerStats({ abilities: [{ name: 'Charisma', bonus: 5 }] }), { current: 0, max: 0 }],
    ];
    for (const [label, stats, expected] of rows) expectPool(stats, ['darkOnesLuckUses'], expected, label);
  });

  // :254-261 — paladin gate + max(CHA, 1) ("minimum of +1", disk).
  it('gloriousDefenseUses: max(CHA,1) paladin, floor 1 at CHA 0, 0 non-paladin', () => {
    const rows = [
      ['paladin CHA 3', basePlayerStats({ class: { name: 'Paladin' }, abilities: [{ name: 'Charisma', bonus: 3 }] }), { current: 3, max: 3 }],
      ['paladin CHA 0 -> floor 1', basePlayerStats({ class: { name: 'Paladin' }, abilities: [{ name: 'Charisma', bonus: 0 }] }), { current: 1, max: 1 }],
      ['non-paladin CHA 5 -> 0', basePlayerStats({ class: { name: 'Cleric' }, abilities: [{ name: 'Charisma', bonus: 5 }] }), { current: 0, max: 0 }],
    ];
    for (const [label, stats, expected] of rows) expectPool(stats, ['gloriousDefenseUses'], expected, label);
  });

  // :306-308 — fix#134 (#1532): 5e disk "half your druid level (rounded
  // up)" -> ceil; 2024 disk "equal to or less than half your Druid level"
  // (no round-up clause) -> floor. Below the edition grant level -> 0
  // (5e row lv2, 2024 row lv6). Pre-fix capture: lv5 5e seeded 2 (floor).
  it('naturalRecoverySlots: 5e ceil(level/2) lv>=2, 2024 floor(level/2) lv>=6, 0 non-druid', () => {
    const rows = [
      ['druid lv5 5e = 3 (ceil; pre-fix floor captured 2)', basePlayerStats({ class: druid(), level: 5 }), { current: 3, max: 3 }],
      ['druid lv7 5e = 4 (ceil, was floor-3 pre-fix)', basePlayerStats({ class: druid(), level: 7 }), { current: 4, max: 4 }],
      ['druid lv20 5e = 10 (ceil table)', basePlayerStats({ class: druid(), level: 20 }), { current: 10, max: 10 }],
      ['druid lv2 5e = 1 (grant level, ceil(1))', basePlayerStats({ class: druid(), level: 2 }), { current: 1, max: 1 }],
      ['druid lv3 5e = 2 (ceil(1.5))', basePlayerStats({ class: druid(), level: 3 }), { current: 2, max: 2 }],
      ['druid lv1 5e -> 0 (disk grants lv2; ceil-pre-grant refused)', basePlayerStats({ class: druid(), level: 1 }), { current: 0, max: 0 }],
      ['druid lv7 2024 = 3 (floor: lv7 half=3.5, combined <= half)', basePlayerStats({ rules: '2024', class: druid(), level: 7 }), { current: 3, max: 3 }],
      ['druid lv6 2024 = 3 (grant level)', basePlayerStats({ rules: '2024', class: druid(), level: 6 }), { current: 3, max: 3 }],
      ['druid lv5 2024 -> 0 (below 2024 disk lv6 row)', basePlayerStats({ rules: '2024', class: druid(), level: 5 }), { current: 0, max: 0 }],
      ['non-druid lv7 -> 0', basePlayerStats({ level: 7 }), { current: 0, max: 0 }],
    ];
    for (const [label, stats, expected] of rows) expectPool(stats, ['naturalRecoverySlots'], expected, label);
  });

  // fix#134 (#1532) disk law census — byte quotes for BOTH edition rows:
  // 5e says rounded-UP (ceil); 2024 omits the clause (floor by "<= half").
  it('naturalRecovery disk law census: 5e "rounded up" bytes present, 2024 round-up clause absent', () => {
    const nr5e = classes5e.find((c) => c.name === 'Druid').subclasses.find((s) => s.name === 'Land')
      .class_levels.find((cl) => cl.level === 2).features.find((f) => f.name === 'Natural Recovery');
    expect(nr5e.description).toContain('equal to or less than half your druid level (rounded up)');
    expect(nr5e.description).not.toContain('rounded down');
    const nr2024 = classes2024.find((c) => c.name === 'Druid').majors.find((m) => m.name === 'Circle of the Land')
      .features.find((f) => f.name === 'Natural Recovery');
    expect(nr2024.level).toBe(6);
    expect(nr2024.description).toContain('combined levels equal to or less than half your Druid level');
    expect(nr2024.description).not.toContain('rounded up');
  });

  // :111-116 + :132-134 — both passive shapes, formula 2*level + INT with
  // negative INT unclamped, no class gate (quirk pinned). Twin keys are
  // distinct fresh objects of equal value.
  it('arcaneWardHp/arcaneWardMax: 2*level+INT, passive_rule alt arm, INT defaults/negative, class-ungated quirk, distinct objects', () => {
    const rows = [
      ['passive arcane_ward lv6 INT+3 = 15', basePlayerStats({ class: { name: 'Wizard' }, abilities: [{ name: 'Intelligence', bonus: 3 }], automation: { passives: [{ type: 'arcane_ward' }] }, level: 6 }), { arcaneWardMax: { current: 15, max: 15 }, arcaneWardHp: { current: 15, max: 15 } }],
      ['passive_rule effect arcane_ward lv8 INT+4 = 20', basePlayerStats({ class: { name: 'Wizard' }, abilities: [{ name: 'Intelligence', bonus: 4 }], automation: { passives: [{ type: 'passive_rule', effect: 'arcane_ward' }] }, level: 8 }), { arcaneWardMax: { current: 20, max: 20 }, arcaneWardHp: { current: 20, max: 20 } }],
      ['no Intelligence entry lv6 -> INT 0 = 12', basePlayerStats({ class: { name: 'Wizard' }, abilities: [{ name: 'Charisma', bonus: 2 }], automation: { passives: [{ type: 'arcane_ward' }] }, level: 6 }), { arcaneWardMax: { current: 12, max: 12 }, arcaneWardHp: { current: 12, max: 12 } }],
      ['INT -2 lv6 = 10 (negative not clamped)', basePlayerStats({ class: { name: 'Wizard' }, abilities: [{ name: 'Intelligence', bonus: -2 }], automation: { passives: [{ type: 'arcane_ward' }] }, level: 6 }), { arcaneWardMax: { current: 10, max: 10 }, arcaneWardHp: { current: 10, max: 10 } }],
      ['non-wizard WITH passive lv6 INT+3 = 15 (class-ungated quirk)', basePlayerStats({ class: { name: 'Cleric' }, abilities: [{ name: 'Intelligence', bonus: 3 }], automation: { passives: [{ type: 'arcane_ward' }] }, level: 6 }), { arcaneWardMax: { current: 15, max: 15 }, arcaneWardHp: { current: 15, max: 15 } }],
      ['other passive -> 0', basePlayerStats({ abilities: [{ name: 'Intelligence', bonus: 5 }], automation: { passives: [{ type: 'other_passive' }] } }), { arcaneWardMax: { current: 0, max: 0 }, arcaneWardHp: { current: 0, max: 0 } }],
      ['passives missing -> 0', basePlayerStats({ automation: {} }), { arcaneWardMax: { current: 0, max: 0 }, arcaneWardHp: { current: 0, max: 0 } }],
    ];
    for (const [label, stats, expected] of rows) expectPool(stats, ['arcaneWardMax', 'arcaneWardHp'], expected, label);
    const twin = computeTrackedResources(rows[0][1]);
    expect(twin.arcaneWardMax).not.toBe(twin.arcaneWardHp);
  });

  // PRESENCE half only (absence-gate is base :356, never retyped here).
  // arcanumPool (:205-208) defaults missing/null/undefined levels to 0.
  it('mysticArcanumLevel6-9 presence: full, partial, and null/undefined levels via arcanumPool default', () => {
    const stats = (mock) => {
      getClassFeatures.mockReturnValue(mock);
      return basePlayerStats({ class: warlock() });
    };
    const full = stats({ arcanumLevels: { level6: 1, level7: 1, level8: 1, level9: 1 } });
    expectPool(full, ['mysticArcanumLevel6', 'mysticArcanumLevel7', 'mysticArcanumLevel8', 'mysticArcanumLevel9'], {
      mysticArcanumLevel6: { current: 1, max: 1 },
      mysticArcanumLevel7: { current: 1, max: 1 },
      mysticArcanumLevel8: { current: 1, max: 1 },
      mysticArcanumLevel9: { current: 1, max: 1 },
    }, 'all four levels = 1');
    expectPool(stats({ arcanumLevels: { level6: 1, level7: 0 } }), ['mysticArcanumLevel6', 'mysticArcanumLevel7', 'mysticArcanumLevel8', 'mysticArcanumLevel9'], {
      mysticArcanumLevel6: { current: 1, max: 1 },
      mysticArcanumLevel7: { current: 0, max: 0 },
      mysticArcanumLevel8: { current: 0, max: 0 },
      mysticArcanumLevel9: { current: 0, max: 0 },
    }, 'missing levels default 0');
    expectPool(stats({ arcanumLevels: { level6: undefined, level7: null } }), ['mysticArcanumLevel6', 'mysticArcanumLevel7'], {
      mysticArcanumLevel6: { current: 0, max: 0 },
      mysticArcanumLevel7: { current: 0, max: 0 },
    }, 'undefined/null level values -> 0 (|| not ??, but 0-collision absent here)');
  });

  // :227-229 — "Pool of d6s (number = 1 + Warlock level)" (disk).
  it('healinglightPool: 1+level Celestial via major or subclass, level-missing -> 1, gated off others', () => {
    const rows = [
      ['major Celestial lv5 = 6', basePlayerStats({ class: warlock({ major: { name: 'Celestial Patron' } }), level: 5 }), { current: 6, max: 6 }],
      ['subclass Celestial lv3 = 4', basePlayerStats({ class: warlock({ subclass: { name: 'Celestial Patron' } }), level: 3 }), { current: 4, max: 4 }],
      ['major Celestial level undefined = 1', basePlayerStats({ class: warlock({ major: { name: 'Celestial Patron' } }), level: undefined }), { current: 1, max: 1 }],
      ['Fiend warlock -> 0', basePlayerStats({ class: warlock({ major: { name: 'Fiend' } }) }), { current: 0, max: 0 }],
      ['non-warlock -> 0', basePlayerStats({ class: { name: 'Cleric' } }), { current: 0, max: 0 }],
    ];
    for (const [label, stats, expected] of rows) expectPool(stats, ['healinglightPool'], expected, label);
  });

  // :288-290 — exact-level class_levels row wins; floor 1 otherwise.
  // QUIRK (reported, header): no Ranger gate — every class seeds >= 1.
  it('favoredEnemyUses: exact-level row value, floor 1 on 0/miss, un-Ranger-gated quirk', () => {
    const ranger = (classLevels) => basePlayerStats({ class: { name: 'Ranger', class_levels: classLevels, major: {}, subclass: {} } });
    const rows = [
      ['ranger lv5 row favored_enemy 2', ranger([{ level: 5, favored_enemy: 2 }]), { current: 2, max: 2 }],
      ['ranger lv5 row favored_enemy 0 -> floor 1', ranger([{ level: 5, favored_enemy: 0 }]), { current: 1, max: 1 }],
      ['lv5 char, level-3 row only -> exact-match miss, floor 1', basePlayerStats({ level: 5, class: { name: 'Ranger', class_levels: [{ level: 3, favored_enemy: 2 }], major: {}, subclass: {} } }), { current: 1, max: 1 }],
      ['QUIRK: Fighter seeds floor 1 too (class-ungated)', basePlayerStats({ class: { name: 'Fighter' } }), { current: 1, max: 1 }],
    ];
    for (const [label, stats, expected] of rows) expectPool(stats, ['favoredEnemyUses'], expected, label);
  });

  // :311 + wisGatedPool :297-300 — Moon circle (major OR subclass),
  // max(WIS,1); 0 for other circles/classes.
  it('moonlightStepUses: max(WIS,1) Moon druid, WIS-missing/-negative floor 1, 0 gated out', () => {
    const rows = [
      ['major Moon WIS 3', basePlayerStats({ class: druid({ major: { name: 'Circle of the Moon' } }), abilities: [{ name: 'Wisdom', bonus: 3 }] }), { current: 3, max: 3 }],
      ['subclass Moon WIS 2', basePlayerStats({ class: druid({ subclass: { name: 'Circle of the Moon' } }), abilities: [{ name: 'Wisdom', bonus: 2 }] }), { current: 2, max: 2 }],
      ['Moon, WIS entry without bonus -> 1', basePlayerStats({ class: druid({ major: { name: 'Circle of the Moon' } }), abilities: [{ name: 'Wisdom' }] }), { current: 1, max: 1 }],
      ['Moon WIS -1 -> floor 1', basePlayerStats({ class: druid({ major: { name: 'Circle of the Moon' } }), abilities: [{ name: 'Wisdom', bonus: -1 }] }), { current: 1, max: 1 }],
      ['Land druid WIS 5 -> 0', basePlayerStats({ class: druid({ major: { name: 'Circle of the Land' } }), abilities: [{ name: 'Wisdom', bonus: 5 }] }), { current: 0, max: 0 }],
      ['non-druid WIS 5 -> 0', basePlayerStats({ abilities: [{ name: 'Wisdom', bonus: 5 }] }), { current: 0, max: 0 }],
    ];
    for (const [label, stats, expected] of rows) expectPool(stats, ['moonlightStepUses'], expected, label);
  });

  // :313-314 — same wisGatedPool helper, level>=6 gate (#1515 family;
  // _Star_Map level>=3 gate at :316 is subclass-lane-owned, not here).
  // fix#134 (#1532-b): the "cap should be 1" claim is DISPROVEN-BYTE-CITED
  // in the census test below — disk law for cosmicomenUses is max(WIS,1);
  // the ONE-per-LR law rides the DIFFERENT key cosmicOmenEffect
  // (restRules-longRest.js resetStarMapOnLongRest). Consumers honor the
  // seed max: cosmicOmenHandler.js :11-31 + TrackedResourceInput.jsx :13.
  it('cosmicomenUses: max(WIS,1) Stars druid at lv6 boundary, 0 below gate or off-circle', () => {
    const rows = [
      ['major Stars lv8 WIS 3', basePlayerStats({ class: druid({ major: { name: 'Circle of the Stars' } }), abilities: [{ name: 'Wisdom', bonus: 3 }], level: 8 }), { current: 3, max: 3 }],
      ['subclass Stars lv6 WIS 2 (gate boundary)', basePlayerStats({ class: druid({ subclass: { name: 'Circle of the Stars' } }), abilities: [{ name: 'Wisdom', bonus: 2 }], level: 6 }), { current: 2, max: 2 }],
      ['Stars lv8 WIS +5 -> 5 (disk: "times equal to your Wisdom modifier"; cap-1 would under-seed)', basePlayerStats({ class: druid({ major: { name: 'Circle of the Stars' } }), abilities: [{ name: 'Wisdom', bonus: 5 }], level: 8 }), { current: 5, max: 5 }],
      ['Stars lv5 -> 0 (below gate)', basePlayerStats({ class: druid({ major: { name: 'Circle of the Stars' } }), abilities: [{ name: 'Wisdom', bonus: 5 }], level: 5 }), { current: 0, max: 0 }],
      ['Moon lv10 -> 0', basePlayerStats({ class: druid({ major: { name: 'Circle of the Moon' } }), abilities: [{ name: 'Wisdom', bonus: 5 }], level: 10 }), { current: 0, max: 0 }],
      ['Stars lv8 WIS no bonus -> 1', basePlayerStats({ class: druid({ major: { name: 'Circle of the Stars' } }), abilities: [{ name: 'Wisdom' }], level: 8 }), { current: 1, max: 1 }],
    ];
    for (const [label, stats, expected] of rows) expectPool(stats, ['cosmicomenUses'], expected, label);
  });

  // fix#134 (#1532-b) disk census: quote the omen law bytes this seed
  // answers to — WIS-many REACTION USES here; one OMEN per Long Rest is
  // the cosmicOmenEffect roll (restRules lane owns that seam).
  it('cosmicomen disk law census: uses = WIS modifier min once; one-omen-per-LR rides cosmicOmenEffect, not this seed', () => {
    const stars = classes2024.find((c) => c.name === 'Druid').majors.find((m) => m.name === 'Circle of the Stars');
    const omen = stars.features.find((f) => f.name === 'Cosmic Omen');
    expect(omen.level).toBe(6);
    expect(omen.automation).toMatchObject({ type: 'cosmic_omen', uses_expression: 'WIS modifier', recharge: 'long_rest' });
    expect(omen.description).toContain('You can use this Reaction a number of times equal to your Wisdom modifier (minimum of once), and you regain all expended uses when you finish a Long Rest.');
    expect(omen.description).toContain('Whenever you finish a Long Rest, you can consult your Star Map for omens and roll a die.');
  });

  // :371-378 — 1 + 0/1 caps ("one use", disk). Seeded by (2024 AND subclass
  // name) OR automation on specialActions/passives — class is NOT gated
  // (row pins it; the old "non-sorcerer -> 0" title was behavior-misleading).
  it('featsOfChaosUses: 2024-subclass arm, 5e subclass alone -> 0, automation arms, cap 1', () => {
    const wild = (rules, subclassName, automation) => basePlayerStats({ rules, class: { name: 'Sorcerer', subclass: { name: subclassName }, class_levels: [], major: {} }, automation });
    const rows = [
      ['2024 Wild Magic, no automation -> 1', wild('2024', 'Wild Magic Sorcery'), { current: 1, max: 1 }],
      ['5e Wild Magic + specialActions -> 1', wild('5e', 'Wild Magic Sorcery', { specialActions: [{ type: 'feats_of_chaos' }] }), { current: 1, max: 1 }],
      ['5e Wild Magic, no automation -> 0 (5e needs automation)', wild('5e', 'Wild Magic Sorcery'), { current: 0, max: 0 }],
      ['specialActions alone, other subclass -> 1', wild('5e', 'Other Magic', { specialActions: [{ type: 'feats_of_chaos' }] }), { current: 1, max: 1 }],
      ['passives alone -> 1', wild('5e', 'Other Magic', { passives: [{ type: 'feats_of_chaos' }] }), { current: 1, max: 1 }],
      ['QUIRK: non-sorcerer with automation -> 1 (class-ungated)', basePlayerStats({ automation: { passives: [{ type: 'feats_of_chaos' }] } }), { current: 1, max: 1 }],
      ['Storm Sorcery, no automation -> 0', wild('5e', 'Storm Sorcery'), { current: 0, max: 0 }],
    ];
    for (const [label, stats, expected] of rows) expectPool(stats, ['featsOfChaosUses'], expected, label);
  });

  it('invocation contract: getClassFeatures called exactly once per compute, with the playerStats identity', () => {
    getClassFeatures.mockReturnValue({ arcaneRecoveryLevels: 3 });
    const stats = basePlayerStats();
    const result = computeTrackedResources(stats);
    expect(getClassFeatures).toHaveBeenCalledTimes(1);
    expect(getClassFeatures).toHaveBeenCalledWith(stats);
    // gate-before-read: the arcanum/recovery adders consumed the same mock.
    expect(result.arcaneRecoveryLevels).toEqual({ current: 3, max: 3 });
  });

  it('purity: frozen input survives compute; every seeded pool is a distinct fresh object', () => {
    getClassFeatures.mockReturnValue({ arcanumLevels: { level6: 1, level7: 1, level8: 1, level9: 1 }, maxSorceryPoints: 6 });
    const stats = basePlayerStats({
      class: warlock({ major: { name: 'Fiend' }, subclass: { name: 'Fiend' } }),
      abilities: [{ name: 'Intelligence', bonus: 2 }, { name: 'Charisma', bonus: 4 }],
      automation: { passives: [{ type: 'arcane_ward' }] },
      proficiency: 3,
    });
    Object.freeze(stats);
    Object.freeze(stats.class);
    Object.freeze(stats.abilities);
    const result = computeTrackedResources(stats);
    const pools = Object.values(result);
    expect(pools.filter((p) => !p || typeof p !== 'object')).toEqual([]);
    // No shared references anywhere: twins (arcaneWardHp/Max, keystone
    // focus/ki) are separate objects, so a later consume can split them.
    expect(new Set(pools).size).toBe(pools.length);
    expect(result.darkOnesLuckUses).toEqual({ current: 4, max: 4 });
    expect(result.arcaneWardMax).toEqual({ current: 12, max: 12 });
  });
});
