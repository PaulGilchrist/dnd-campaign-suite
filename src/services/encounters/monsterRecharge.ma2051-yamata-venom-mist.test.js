// @maintained-by-ai
// MA-2051: Yamata no Orochi "Venom Mist (Recharge 5-6)" — fingerprint #11
// recharge name-text trap (MA-0663/1916/1924/1948/1987/1996/2017/2041 family):
// row authored with recharge ONLY in the name, no flat recharge field →
// rechargeUsageOf null (monsterRecharge.js:35) → monsterRechargeGate null →
// ungated unlimited refires (live: 2 fires same-boundary + past owner-turn,
// monsterRecharge absent, zero refusal/refused/recovery logs; recharge-log
// substring grep hits only roll.name on this lane — truth via refused-type
// logs + cd.monsterRecharge + DOM, §685). Save core was live-verified exact
// BEFORE the fix (DC 26 Constitution auto-roll, 77 (22d6) Poison, half-on-
// success RAW default via the INLINE auto-roll lane — shapeless "each creature
// within 90 ft" with no Cone/Line/Sphere noun never opens the picker,
// MA-0701/§211; do NOT author dc_success/range). One-field DATA fix:
// recharge:"5-6" after save_dc rides the live MA-0031 spend/refusal/recovery
// lane (monsterRecharge.js) — inline rows spend at roll resolution, spent
// chip, venom_mist_refused popup+log with zero roll, d6≥5 recovery at owner
// turn-start. twin shapeless-inline rows preserved (MA-2017/2041).
//
// Base-cite table (monsterRecharge.test.js, CANON seam-fixture era):
//   key-suffix strip + threshold parse            :42-48  NEVER re-drive
//   fresh/spent/recharged gate truth-table        :50-58  NEVER re-drive
//   ungated rows → null generics                  :59-62  NEVER re-drive
//   fire-spend stamp + ability_use log            :65-73  NEVER re-drive
//   refusal vocab <slug>_refused (not recharged)  :75-81  NEVER re-drive
//   turn-start d6 regain / not-recharged / no-op  :84-122 NEVER re-drive
//   (d6≥5 recovery is seam-based at owner turn-start, NEVER wall-clock #app;
//    threshold-5 nat-5 boundary owned by base :107-112 / :171-184 — this
//    disk-only lane (#1057) does not walk it, so the ONE-SHOT LIVE-row
//    gate-arm suffices, #1118 shape VERBATIM)
//   5-6 twin gate-arm vocab (apep threshold 5)    :231-237 NEVER re-drive
//   MA-0021 spend/refusal/recovery vocab          NEVER re-drive
//
// #1038 dup-map — Yamata lanes and their owners (absence-only here, never
// re-driven): Venom Mist recharge axis OWNED here (canonical fingerprint) +
// its save core (live-verified, no other test file mentions Venom Mist —
// grep-verified); Head's Vigil legendary detection/ability_check axis →
// monsterLegendaryUses.ma2054 (CLOSED #1115, grep-confirmed it does NOT
// cite this lane and never touches recharge/Venom bytes); roster sweep →
// monsterEpicCohort.test.js :34; dice-roll engine → diceRoller (#1072),
// 77 (22d6) math never re-derived. legendary "Bite" + "Crushing Coil
// (Costs 2 Actions)" are cost/hit-axis namesakes (#948) — recharge
// ABSENCE-only pins; traits "Regenerative Heads"/"Eight Heads" own no
// recharge lane.
// Extractors (#1119): MA-2051 fixed ONLY the recharge:"5-6" field — the row
// has NO save_effect bytes → no extractor leg here; undefined→[] generics
// owned by MonsterCardModal.conditions-extraction.test.jsx canonical, purged
// family-wide (#1117). The ticket-fixed byte stays KEEP-live through
// production usageOf/key/gate.
// #948 decoys by NAME: action "Bite" vs legendary "Bite" namesakes,
// "Crushing Coil (Costs 2 Actions)" legendary — absence-only pins.
// #1121/#1125R twin-collision check VERIFIED: DC 26 + recharge "5-6" raw
// adjacency is NOT unique (hits 2 rows — Fenrir Devour STR/6d10 + this
// row); at object level DC 26 + Constitution + "5-6" collides with Apep
// Venomous Darkness (14d10, MA-1843) — the anchor therefore extends through
// this card's OWN within-90ft 77 (22d6) Poison description and damage bytes
// until count=1 (disk-verified).
//
// old→new map (4→2): old it1 save core → new it1 (+name-lookup #1094
// replacing brittle actions[2], verbatim description ground truth #993/#1086,
// dc_success ABSENCE honest half-default pin #1122, range ABSENCE =
// one-field fix §211 shapeless-inline twin MA-2017/2041); old it2 arming →
// new it2 (+ONE-SHOT LIVE-row gate-arm toEqual({key,threshold,available:true})
// #1118 shape / exact-once recharge filter dup-map #1038 / Bite gate-null
// decoy under spent map #1035 guard reaches the branch / legendary+reaction+
// trait+lair+bonus absence-only #1123 precedent / whole-DB raw-split exact-
// once); old it3 "spent refuses, recovered opens, fresh available" →
// DROPPED, generic truth-table re-drive of base :50-58 (+ :231-237 5-6 twin
// gate-arm vocab) (#1117/#1118); old it4 threshold-5 mock d6 ladder →
// DROPPED, base :84-122 owns the ladder (:107-112/:171-184 own the nat-5
// boundary), disk-only lane never re-driven (#1057).
// No state written → no afterEach to clean (#1121 precedent); no wall-clock
// (#app MANDATORY).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const db = JSON.parse(RAW);
const OROCHI = db.find((m) => m.index === 'yamata-no-orochi');
// lookup by NAME, not index (#1094 brittle-index fix — old actions[2])
const MIST = OROCHI.actions.find((a) => a.name.startsWith('Venom Mist'));

describe('MA-2051 disk fingerprint: Yamata no Orochi Venom Mist recharge authored', () => {
  it('real-row lock: save core byte-unchanged (live-verified exact) — DC 26 CON, 77 (22d6) Poison, description verbatim, dc_success + range ABSENT (shapeless-inline auto-roll lane, half-default RAW-correct, picker never opens §211)', () => {
    expect(OROCHI.name).toBe('Yamata no Orochi');
    expect(MIST.name).toBe('Venom Mist (Recharge 5-6)');
    expect(MIST.save_dc).toBe(26);
    expect(MIST.save_type).toBe('Constitution');
    expect(MIST.damage_dice_primary).toBe('22d6');
    expect(MIST.damage_type_primary).toBe('Poison');
    expect(MIST.description).toBe('Constitution Saving Throw: DC 26, each creature within 90 ft. Failure: 77 (22d6) Poison damage. Success: Half damage.');
    expect(MIST.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE (#1122)
    expect(MIST.range).toBeUndefined(); // one-field fix: shapeless-inline lane preserved (MA-2017/2041 twins) — no shape WORD, picker must never open (§211)
  });

  it('fix byte recharge:"5-6" arms the MA-0031 gate on the live row, exact-once within actions (was ungated name-text)', () => {
    expect(MIST.recharge).toBe('5-6');
    expect(rechargeUsageOf(MIST)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(MIST)).toBe('Venom Mist');
    // ONE-SHOT LIVE-row gate-arm on THIS row's bytes (#1118 shape VERBATIM):
    // key + threshold + fresh available in one shot
    // (spent/refused/recharged truth-table owned by base :50-58/:231-237, not re-driven — #1117/#1118)
    expect(monsterRechargeGate(MIST, null)).toEqual({ key: 'Venom Mist', threshold: 5, available: true });
    // exact-once fix: Venom Mist is the ONLY recharge-armed action on this
    // card (#1038 dup-map, #948 decoys by name). Under a spent-MIST map the
    // hit-axis neighbour Bite stays ungated null (#1035 guard reaches the branch):
    expect(OROCHI.actions.filter((a) => a.recharge).map((a) => a.name)).toEqual(['Venom Mist (Recharge 5-6)']);
    const bite = OROCHI.actions.find((a) => a.name === 'Bite');
    expect(monsterRechargeGate(bite, { 'Venom Mist': { recharged: false, threshold: 5 } })).toBeNull();
    // recharge never rides the legendary/reaction/trait/lair/bonus lanes —
    // legendary "Bite" namesake + "Crushing Coil (Costs 2 Actions)" are
    // cost/hit-axis (#948), Regenerative Heads/Eight Heads traits own no
    // recharge byte — absence-only pins (#1123 precedent):
    expect(OROCHI.legendary_actions.filter((a) => a.recharge)).toEqual([]);
    expect(OROCHI.reactions.filter((a) => a.recharge)).toEqual([]);
    expect(OROCHI.traits.filter((a) => a.recharge)).toEqual([]);
    expect(OROCHI.lair_actions.filter((a) => a.recharge)).toEqual([]);
    expect(OROCHI.bonus_actions.filter((a) => a.recharge)).toEqual([]);
    // #1121/#1125R whole-DB raw-split: NOT unique on DC 26 "5-6" alone (raw
    // adjacency hits 2 rows — Fenrir Devour + this row; object-level the
    // Apep Venomous Darkness CON/26/5-6 twin #1843 collides) — the anchor
    // extends through this card's own within-90ft 77 (22d6) Poison
    // description and damage bytes until count=1 (disk-verified).
    expect(RAW.split('"save_dc": 26,\n        "recharge": "5-6",\n        "description": "Constitution Saving Throw: DC 26, each creature within 90 ft. Failure: 77 (22d6) Poison damage. Success: Half damage.",\n        "damage_dice_primary": "22d6",\n        "damage_type_primary": "Poison"').length - 1).toBe(1);
  });
});
