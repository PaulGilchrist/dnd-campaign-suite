// @maintained-by-ai
// MA-2081: Zmey Gorynych "Triple Fire Breath (Recharge 5-6)" — fingerprint #14
// recharge name-text trap (MA-0663/1916/1924/1948/1978/1987/1996/2017/2041/2051/2059/2067 family):
// row authored with recharge ONLY in the name, no flat recharge field →
// rechargeUsageOf null (monsterRecharge.js:37) → monsterRechargeGate null →
// ungated unlimited refires (live: fire #1 picker roll Bandit −36, same-turn
// re-tap RE-OPENED the picker with zero .mc-recharge-refusal, cd['Zmey Gorynych
// 1'].monsterRecharge absent at every probe — truth via refused-type logs +
// cd.monsterRecharge + DOM, §685). Save core was live-verified exact BEFORE the
// fix (MA-2033 working picker lane: prose "90-foot Cone" noun parses the picker
// shape — "90-ft Cone (GM positions tokens; selection advisory)", DC 23 Dexterity,
// 11d8 Fire, half-on-success RAW default; do NOT author dc_success/range).
// DATA fix (one field, MA-2059 Glacier Wave twin picker-row placement):
//   recharge:"5-6" after damage_type_primary rides the live MA-0031
//   spend/refusal/recovery lane (monsterRecharge.js) — PICKER rows spend at
//   PICKER-OPEN (MA-1996/1987 convention, CLA-384): stamp
//   {Triple Fire Breath:{recharged:false,threshold:5}} + ability_use spend log;
//   re-press refuses pre-gate `.mc-recharge-refusal` + triple_fire_breath_refused,
//   picker never re-opens; d6≥5 recovery at owner turn-start (seam-based,
//   NEVER wall-clock #app). Live-verified post-fix notes (manual walk, recorded
//   not simulated) — this lane is honest disk+gate arithmetic only (#910).
// LEGEND DECOUPLING (post-MA-2079): Wing Buffet delegates_to REMOVED, own
// save_dc/save_type/2d8 Fire authored — rechargeUsageOf reads ONLY the pressed
// row's flat recharge (monsterRecharge.js:37) → gate null on Wing Buffet even
// with the master key SPENT (pool-only, MA-2022 decoupling proof shape). That
// ENTIRE Wing Buffet leg is OWNED by saveProcessing.ma2079-zmey-wing-buffet
// .test.js :30-57 (which cross-cites this file as the breath-axis owner, :14-16)
// — absence-only lane filter here, never re-driven (§384: the MA-2079 sibling's
// stale pending-absence pins inverted same pass).
//
// Base-cite table (monsterRecharge.test.js, CANON seam-fixture era):
//   key-suffix strip + threshold parse            :42-48  NEVER re-drive
//   fresh/spent/recharged gate truth-table        :50-58  NEVER re-drive
//   ungated rows → null generics                  :59-62  NEVER re-drive
//   fire-spend stamp + ability_use log            :65-73  NEVER re-drive
//   refusal vocab <slug>_refused (not recharged)  :75-81  NEVER re-drive
//   turn-start d6 regain / not-recharged / no-op  :84-122 NEVER re-drive
//   (threshold-5 nat-5 boundary owned by base :107-112 / :171-184 — this
//    disk-only lane (#1057) does not walk the ladder, so the ONE-SHOT LIVE-
//    row gate-arm suffices, #1118 shape / #1128 precedent VERBATIM)
//   5-6 twin gate-arm vocab (apep threshold 5)    :231-237 NEVER re-drive
//   MA-0021 spend/refusal/recovery vocab          NEVER re-drive
//   .mc-recharge-refusal popup surface owned by MonsterCardModal refusal
//   lanes (recharge-cone :187, sleep-breath :256) — slug builder-interpolated,
//   never re-driven here (#1117/#1129)
//
// MA-2081 TRIPLE-FIRE ticket-distinct core (three-volley semantics, honest
// disk read): the row implements the three-head volley as ONE save / ONE
// 11d8 pool behind ONE recharge — rechargeActionKey KEEPs the word "Triple"
// ("Triple Fire Breath", not "Fire Breath" — unique vs the #1996 Fire Breath
// namesake family key), and the card arms EXACTLY ONE recharge row: the three
// volleys share the single once-per-recharge pool and never split into three
// rows/pools. Never re-derives dice math (#1072), 49 (11d8) lives verbatim.
//
// #1038 dup-map — Zmey lanes and their owners (absence-only here, never
// re-driven): Triple Fire Breath recharge axis OWNED here (canonical
// fingerprint row pin); Wing Buffet legendary save + decoupling →
// saveProcessing.ma2079-zmey-wing-buffet :30-57 (CLOSED); Dust Storm sibling →
// saveProcessing.ma2078-zmey-dust-storm; roster sweep → monsterEpicCohort
// .test.js; extractor word-scan generics → MonsterCardModal.conditions-
// extraction.test.jsx canonical (#1117); dice-roll engine → diceRoller (#1072).
// Multiattack/Bite/Claw are hit-axis namesakes (#948 decoys by NAME) —
// gate-null under a spent-master map honest (#1035 guard reaches the branch).
// Extractors (#1119 scope read): MA-2081 fixed ONLY the recharge byte — the
// row has NO save_effect bytes (half-default lives in description prose) →
// no extractor leg here; undefined→[] generic PURGED, owned by the canonical
// conditions-extraction lane; the FIXED recharge byte + honest absent
// companion bytes KEEP through production usageOf/key/gate.
// #1121 twin-collision check VERIFIED (disk): DC 23 alone hits 32 rows and
// the DC 23 + "5-6" parse pool is 6 rows (ancient-blue/bronze Lightning
// Breath, garuda Whirlwind Flight, king-kong Thunder Roar, ladon Sleeping
// Mist, this row); raw "save_dc":23+"recharge":"5-6" adjacency hits 3 — the
// anchor therefore extends through Zmey's OWN 49 (11d8) Fire cone description
// bytes up to the recharge fix byte until count=1 (disk-verified).
//
// old→new map (8→2): old it1 save core → new it1 (+name-lookup #1094
// replacing brittle actions[3], verbatim description ground truth #993/#1086,
// dc_success ABSENCE honest half-default pin #1122, range ABSENCE §211
// picker-via-prose pin MA-2033); old it2 arming + old it3 "spent refuses,
// recovered opens, fresh available" → folded into new it2 as the ONE-SHOT
// LIVE-row gate-arm toEqual({key,threshold,available:true}) #1118 shape
// (generic truth-table DROPPED, base :50-58/:231-237 #1117/#1118) + triple-
// fire key fingerprint + exact-once card filter #1038 / Bite+Claw+Multiattack
// gate-null decoys #1035 / legendary+reaction+trait+bonus+lair absence-only
// #1123 precedent / whole-DB raw-split exact-once; old it4 picker-open spend
// stamp → DROPPED, base :65-73 owns fire-spend stamp + ability_use log
// (picker-open spend convention recorded in header, live-verified not
// simulated, #910; closed twins #1996/#2059/#1130 keep zero spend legs);
// old it5 refusal surface popup+log → DROPPED (#1129 carried rec), refusal
// vocab base :75-81 + .mc-recharge-refusal owned by MonsterCardModal refusal
// lanes (recharge-cone :187, sleep-breath :256, verified live); old it6
// threshold-5 mock d6 ladder → DROPPED, base :84-122 owns the ladder
// (:107-112/:171-184 own the nat-5 boundary), disk-only lane never re-driven
// (#1128 precedent VERBATIM); old describe "legend decoupling" it1+it2 →
// DROPPED as a verbatim re-drive of saveProcessing.ma2079-zmey-wing-buffet
// .test.js :30-57 (own save fields :37-40, delegates_to GONE :43, recharge
// undefined + usageOf null + gate-null-under-spent-master :54-56) — the
// sibling cross-cites this split (:14-16); legendary lane keeps only the
// absence-only filter here.
// No state written → no afterEach to clean (#1121 precedent); disk-only
// determinism (#1057); no wall-clock (#app MANDATORY).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const db = JSON.parse(RAW);
const ZMEY = db.find((m) => m.index === 'zmey-gorynych');
// lookup by NAME, not index (#1094 brittle-index fix — old actions[3])
const BREATH = ZMEY.actions.find((a) => a.name.startsWith('Triple Fire Breath'));

describe('MA-2081 disk fingerprint: Zmey Triple Fire Breath recharge authored', () => {
  it('row lock: save core byte-unchanged (live-verified exact) — DC 23 DEX, 11d8 Fire, description verbatim; dc_success + range ABSENT (explicit "Half damage" clause makes the app half-default RAW-correct #1122; picker shape parses from prose "90-foot Cone" MA-2033, do NOT author range)', () => {
    expect(ZMEY.name).toBe('Zmey Gorynych');
    expect(BREATH.name).toBe('Triple Fire Breath (Recharge 5-6)');
    expect(BREATH.save_dc).toBe(23);
    expect(BREATH.save_type).toBe('Dexterity');
    expect(BREATH.damage_dice_primary).toBe('11d8');
    expect(BREATH.damage_type_primary).toBe('Fire');
    expect(BREATH.description).toBe('Dexterity Saving Throw: DC 23, each creature in a 90-foot Cone. Failure: 49 (11d8) Fire damage. Success: Half damage.');
    expect(BREATH.dc_success).toBeUndefined(); // half-on-success default is RAW-correct ("Success: Half damage") — pin its ABSENCE (#1122, MA-2059 twin)
    expect(BREATH.range).toBeUndefined(); // one-field fix: picker opens via prose noun (MA-2033) — no range byte authored
  });

  it('fix byte recharge:"5-6" arms the MA-0031 gate on the live row (was ungated name-text, 2 ungated fires live): triple-fire ONE-SHOT gate-arm (one pool gates the 3-head volley) + exact-once on the card + twin-collision raw-split', () => {
    expect(BREATH.recharge).toBe('5-6');
    expect(rechargeUsageOf(BREATH)).toEqual({ threshold: 5 });
    // ticket-distinct fingerprint: the gate key KEEPs the word "Triple" —
    // one pool ("Triple Fire Breath", unique vs the #1996 'Fire Breath'
    // namesake key) behind one threshold; the 3-head volley never splits
    expect(rechargeActionKey(BREATH)).toBe('Triple Fire Breath');
    // ONE-SHOT LIVE-row gate-arm on THIS row's bytes (#1118 shape VERBATIM):
    // key + threshold + fresh available in one shot
    // (spent/refused/recharged truth-table owned by base :50-58/:231-237, not re-driven — #1117/#1118)
    expect(monsterRechargeGate(BREATH, null)).toEqual({ key: 'Triple Fire Breath', threshold: 5, available: true });
    // exact-once fix: Triple Fire Breath is the ONLY recharge-armed row on
    // the whole card — three volleys share the single pool, never three rows/
    // pools (#1038 dup-map, #948 decoys by name). Under a spent-BREATH map
    // the hit-axis neighbours Bite/Claw/Multiattack stay ungated null
    // (#1035 guard reaches the branch):
    expect(ZMEY.actions.filter((a) => a.recharge).map((a) => a.name)).toEqual(['Triple Fire Breath (Recharge 5-6)']);
    const bite = ZMEY.actions.find((a) => a.name === 'Bite');
    const claw = ZMEY.actions.find((a) => a.name === 'Claw');
    const multiattack = ZMEY.actions.find((a) => a.name === 'Multiattack');
    expect(monsterRechargeGate(bite, { 'Triple Fire Breath': { recharged: false, threshold: 5 } })).toBeNull();
    expect(monsterRechargeGate(claw, { 'Triple Fire Breath': { recharged: false, threshold: 5 } })).toBeNull();
    expect(monsterRechargeGate(multiattack, { 'Triple Fire Breath': { recharged: false, threshold: 5 } })).toBeNull();
    // recharge never rides the legendary/reaction/trait/bonus/lair lanes —
    // Wing Buffet's own-fields + delegates_to-GONE + gate-null-under-spent-
    // master leg is FULLY OWNED by saveProcessing.ma2079-zmey-wing-buffet
    // .test.js :30-57 (never re-driven here, #1038); absence-only filter
    // pins (#1123 precedent):
    expect(ZMEY.legendary_actions.filter((a) => a.recharge)).toEqual([]);
    expect(ZMEY.reactions.filter((a) => a.recharge)).toEqual([]);
    expect(ZMEY.traits.filter((a) => a.recharge)).toEqual([]);
    expect(ZMEY.bonus_actions.filter((a) => a.recharge)).toEqual([]);
    expect(ZMEY.lair_actions.filter((a) => a.recharge)).toEqual([]);
    // #1121 whole-DB raw-split: NOT unique on DC 23 alone (32 rows) nor on
    // the DC 23 + "5-6" pool (6 rows: ancient-blue/bronze Lightning Breath,
    // garuda Whirlwind Flight, king-kong Thunder Roar, ladon Sleeping Mist,
    // this row; raw adjacency hits 3) — the anchor extends through Zmey's
    // OWN 49 (11d8) Fire cone description bytes up to the recharge fix byte
    // until count=1 (disk-verified).
    expect(RAW.split('"save_dc": 23,\n        "description": "Dexterity Saving Throw: DC 23, each creature in a 90-foot Cone. Failure: 49 (11d8) Fire damage. Success: Half damage.",\n        "damage_dice_primary": "11d8",\n        "damage_type_primary": "Fire",\n        "recharge": "5-6"').length - 1).toBe(1);
  });
});
