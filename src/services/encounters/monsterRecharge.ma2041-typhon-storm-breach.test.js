// @maintained-by-ai
// MA-2041: Typhon "Storm Breach (Recharge 5-6)" — fingerprint #10 recharge
// name-text trap (MA-0663/1916/1924/1948/1987/1996/2017 family): row authored
// with recharge ONLY in the name, no flat recharge field → rechargeUsageOf
// null → monsterRechargeGate null → ungated unlimited refires (live: 4 fires
// same-turn + past owner-turn-start, monsterRecharge absent, zero
// refusal/refused/recovery logs). Save core was live-verified exact BEFORE the
// fix (DC 27 STR, 91 (26d6) Bludgeoning, half-on-success engine default via
// the INLINE auto-roll lane — shapeless "within 120 ft" with no Cone/Line/
// Sphere noun never opens the picker, MA-0701/§211 NEW PIN: prose-parse needs
// a shape WORD, MA-2033 correction does NOT apply; do NOT author
// dc_success/range). One-field DATA fix: recharge:"5-6" after save_dc rides
// the live MA-0031 spend/refusal/recovery lane (monsterRecharge.js) — inline
// rows spend at roll resolution, spent chip, storm_breach_refused popup+log
// with zero roll, d6≥5 recovery at owner turn-start.
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
// #1038 dup-map — Typhon lanes and their owners (absence-only here, never
// re-driven): Storm Breach recharge axis OWNED here (canonical fingerprint);
// Earthquake legendary (DC 25 DEX, 6d8, save_effect prone, costs-2) →
// saveProcessing.ma2045 (it touches Storm Breach only as the spent-master-key
// decoupling decoy, never this save core); roster sweep →
// monsterEpicCohort.test.js :34; dice-roll engine → diceRoller (#1072),
// 26d6 math never re-derived. regional_effects is authored empty — no lane.
// Extractors (#1119): MA-2041 fixed ONLY the recharge:"5-6" field — the row
// has NO save_effect bytes → no extractor leg here; undefined→[] generics
// owned by MonsterCardModal.conditions-extraction.test.jsx canonical, purged
// family-wide (#1117). The ticket-fixed byte stays KEEP-live through
// production usageOf/key/gate.
// #948 decoys by NAME distinct from family sets: legendary "Serpent Head" +
// trait "Hundred Serpent Heads" (action-namesakes), "Earthshaker" trait vs
// legendary "Earthquake" (ma2045-owned), "Firebolt Volley" — absence-only
// pins (#1123 precedent).
// #1121/#1125R twin-collision check VERIFIED: DC 27 + recharge "5-6" is NOT
// unique (3-row twin pool: Godzilla Atomic Breath — DEX/26d6 Radiant #1916 —
// and Jormungandr Venomous Surge — CON/26d6 Poison #1924 — share the same
// DC+threshold bytes) — save_type Strength resolves it at object level
// (unique DB-wide); the raw-split anchor therefore extends through this
// card's OWN Strength save + within-120ft (26d6) Bludgeoning description and
// damage bytes until count=1 (disk-verified).
//
// old→new map (3→2): old it1 save core → new it1 (+name-lookup #1094
// replacing brittle actions[3], verbatim description ground truth #993/#1086,
// dc_success ABSENCE honest half-default pin #1122/#1123, range ABSENCE =
// one-field fix §211 shapeless-inline twin MA-2017/1948); old it2 arming →
// new it2 (+ONE-SHOT LIVE-row gate-arm toEqual({key,threshold,available:true})
// #1118 shape / exact-once recharge filter dup-map #1038 / Serpent Head+Claw
// gate-null decoys #1035 guard reaches the branch / legendary+reaction+trait+
// lair absence-only #1123 precedent); old it3 "spent refuses, recovered
// opens, fresh available" → DROPPED, generic truth-table re-drive of base
// :50-58 (+ :231-237 5-6 twin gate-arm vocab) (#1117/#1118).
// No state written → no afterEach to clean (#1121 precedent); no wall-clock
// (#app MANDATORY).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const db = JSON.parse(RAW);
const TYPHON = db.find((m) => m.index === 'typhon');
// lookup by NAME, not index (#1094 brittle-index fix — old actions[3])
const BREACH = TYPHON.actions.find((a) => a.name.startsWith('Storm Breach'));

describe('MA-2041 disk fingerprint: Typhon Storm Breach recharge authored', () => {
  it('real-row lock: save core byte-unchanged (live-verified exact) — DC 27 STR, 91 (26d6) Bludgeoning, description verbatim, dc_success + range ABSENT (shapeless-inline auto-roll lane, half-default RAW-correct, picker never opens §211)', () => {
    expect(TYPHON.name).toBe('Typhon');
    expect(BREACH.name).toBe('Storm Breach (Recharge 5-6)');
    expect(BREACH.save_dc).toBe(27);
    expect(BREACH.save_type).toBe('Strength');
    expect(BREACH.damage_dice_primary).toBe('26d6');
    expect(BREACH.damage_type_primary).toBe('Bludgeoning');
    expect(BREACH.description).toBe('Strength Saving Throw: DC 27, each creature within 120 ft. Failure: 91 (26d6) Bludgeoning damage. Success: Half damage. The area becomes difficult terrain as boulders and debris fly.');
    expect(BREACH.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE (#1122)
    expect(BREACH.range).toBeUndefined(); // one-field fix: shapeless-inline lane preserved (MA-2017/1948 twins) — no shape WORD, picker must never open (§211)
  });

  it('fix byte recharge:"5-6" arms the MA-0031 gate on the live row, exact-once within actions (was ungated name-text)', () => {
    expect(BREACH.recharge).toBe('5-6');
    expect(rechargeUsageOf(BREACH)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(BREACH)).toBe('Storm Breach');
    // ONE-SHOT LIVE-row gate-arm on THIS row's bytes (#1118 shape VERBATIM):
    // key + threshold + fresh available in one shot
    // (spent/refused/recharged truth-table owned by base :50-58/:231-237, not re-driven — #1117/#1118)
    expect(monsterRechargeGate(BREACH, null)).toEqual({ key: 'Storm Breach', threshold: 5, available: true });
    // exact-once fix: Storm Breach is the ONLY recharge-armed action on this
    // card (#1038 dup-map, #948 decoys by name). Under a spent-BREACH map the
    // hit-axis neighbours stay ungated null (#1035 guard reaches the branch):
    expect(TYPHON.actions.filter((a) => a.recharge).map((a) => a.name)).toEqual(['Storm Breach (Recharge 5-6)']);
    const head = TYPHON.actions.find((a) => a.name === 'Serpent Head');
    const claw = TYPHON.actions.find((a) => a.name === 'Claw');
    expect(monsterRechargeGate(head, { 'Storm Breach': { recharged: false, threshold: 5 } })).toBeNull();
    expect(monsterRechargeGate(claw, { 'Storm Breach': { recharged: false, threshold: 5 } })).toBeNull();
    // recharge never rides the legendary/reaction/trait/lair lanes — Earthquake
    // (Costs 2 Actions) is saveProcessing.ma2045-owned (it owns the DC 25 DEX
    // prone save_effect, never a recharge byte); Serpent Head legendary +
    // Hundred Serpent Heads/Earthshaker traits and Firebolt Volley are
    // absence-only namesake pins here (#948, #1123 precedent):
    expect(TYPHON.legendary_actions.filter((a) => a.recharge)).toEqual([]);
    expect(TYPHON.reactions.filter((a) => a.recharge)).toEqual([]);
    expect(TYPHON.traits.filter((a) => a.recharge)).toEqual([]);
    expect(TYPHON.lair_actions.filter((a) => a.recharge)).toEqual([]);
    // #1121/#1125R whole-DB raw-split: NOT unique on DC 27 "5-6" alone (3-row
    // twin pool — Godzilla Atomic Breath #1916, Jormungandr Venomous Surge
    // #1924 share the DC+threshold bytes) — the anchor extends through this
    // card's own Strength save + within-120ft 26d6 Bludgeoning description and
    // damage bytes until count=1 (disk-verified).
    expect(RAW.split('"save_dc": 27,\n        "recharge": "5-6",\n        "description": "Strength Saving Throw: DC 27, each creature within 120 ft. Failure: 91 (26d6) Bludgeoning damage. Success: Half damage. The area becomes difficult terrain as boulders and debris fly.",\n        "damage_dice_primary": "26d6",\n        "damage_type_primary": "Bludgeoning"').length - 1).toBe(1);
  });
});
