// @maintained-by-ai
// MA-1940: Ladon "Sleeping Mist (Recharge 5-6)" save core live-verified
// EXACT (DC 23 Constitution, Unconscious on fail, damageless 60-foot Cone
// picker, multi-target selectable) but the recharge gate never armed —
// name-text "(Recharge 5-6)" parsed by NO parser (MA-1916/0663/MA-1924/
// MA-1932 breath-twin family, 5th instance), 3 ungated volleys one session
// zero refusal tokens, monsterRecharge ABSENT whole-store. One-field DATA
// fix: recharge:"5-6" rides the live MA-0031/MA-0488/MA-1924 spend/refusal/
// recovery lane (monsterRecharge.js), MA-1924 byte-shape (after save_dc,
// before description). THIS file owns the Sleeping Mist save/recharge axis
// ONLY (ma1939:29-31 cites this lane to ma1940).
//
// Base-cite table (monsterRecharge.test.js, CANON @#1108 seam-fixture era,
// refreshed #1116/#1117):
//   key-suffix strip + threshold parse            :42-48  NEVER re-drive
//   fresh/spent/recharged gate truth-table        :50-58  NEVER re-drive
//   ungated rows → null                           :59-62  NEVER re-drive
//   fire-spend stamp + ability_use log            :65-73  NEVER re-drive
//   refusal vocab <slug>_refused (not recharged)  :75-81  NEVER re-drive
//   turn-start d6 regain / not-recharged / no-op  :84-122 NEVER re-drive
//   threshold-5 Lightning-Breath structured usage :143-185 NEVER re-drive
//   5-6 twin gate-arm vocab (apep threshold 5)    :231-237 NEVER re-drive
// Extractor generic vocab (undefined → []): MonsterCardModal.conditions-
// extraction.test.jsx header owns the map and already purged the unconscious
// word-scan leg that lived at this file's old :46 — this ticket touched NO
// save_effect bytes (one-field fix), so no extractor leg is ticket-distinct
// here (#1119 precedent: extractor-on-fixed-bytes would KEEP; nothing fixed).
//
// Sibling ownership (never re-locking theirs):
//  - Constrict escape_dc 22 + grapple_ongoing_damage 4d8 numerics →
//    monsterHitConditions.ma1939 :68-69 (#1097 axis owner); only recharge-
//    ABSENCE pinned here (#948 decoys by name — Multiattack/Bite/Constrict).
//  - Vigilant Watch advisory + legendary delegates → ma1944 :60-137 (#1110).
//  - spend/refusal/recovery vocab → base table above + MA-0021 latch,
//    NEVER re-drive.
//
// Applied recs (#1117 family-fold + #1118 template VERBATIM + #1119):
// rec#1 — old it3 "spent refuses, fresh available, recovery opens" is the
// generic spent/fresh/recharged truth-table → DROPPED (base :50-58 +
// :231-237 own it); fresh leg kept as the ONE-SHOT LIVE-row gate-arm
// toEqual({key,threshold,available}) + exact-once filter, #1118 it2 shape.
// rec#2 — old it4 extractor word-scan → purged citing conditions-extraction
// .test.jsx header (undefined→[] map owner; nothing to note-if-present —
// save_effect was NOT fixed by this ticket). rec#3 — old it5 MA-1939
// neighbour guard re-pinned Constrict numerics → TRIM-CITED to ma1939
// :68-69, replaced by absence-only pins + gate-null decoys (#1035 guard
// reaches the branch). Row lookup positional actions[3] → name-lookup
// (#1094). Disk-only (#1057), no wall-clock (#app), no logs emitted here —
// pure fingerprint, no afterEach state to clean.
//
// old→new map (5→2): old it1 save core → new it1 (+save_effect verbatim
// byte + conditions byte, #1086 programmatic disk-bytes); old it2 arming →
// new it2 (+one-shot gate-arm/exact-once/whole-DB raw-split #1113 shape/
// Constrict+Bite gate-null decoys); old it3 truth-table → DROPPED (base
// :50-58/:231-237); old it4 extractor → purged (conditions-extraction
// header); old it5 Constrict numerics → TRIM-CITED (ma1939 owns).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from './monsterRecharge.js';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const monsters = JSON.parse(RAW);
const LADON = monsters.find((m) => m.index === 'ladon');
const MIST = LADON.actions.find((a) => a.name.startsWith('Sleeping Mist'));

describe('MA-1940 disk fingerprint: Ladon Sleeping Mist recharge authored', () => {
  it('real-row lock: save core byte-unchanged (live-verified exact): DC 23 CON, condition-only, damageless — save_effect/description/conditions verbatim, dc_success ABSENT (no half pool to leak, §63 N/A, live results copy honest "takes no damage")', () => {
    expect(LADON.name).toBe('Ladon');
    expect(MIST.name).toBe('Sleeping Mist (Recharge 5-6)');
    expect(MIST.save_dc).toBe(23);
    expect(MIST.save_type).toBe('Constitution');
    expect(MIST.damage_dice_primary).toBeUndefined();
    expect(MIST.damage_dice_secondary).toBeUndefined();
    expect(MIST.dc_success).toBeUndefined();
    expect(MIST.save_effect).toBe("Failure: the target has the Unconscious condition until the end of its next turn, repeating the save at the end of each of its turns. Success: it isn't affected. No damage.");
    expect(MIST.conditions).toEqual(['unconscious']);
    expect(MIST.description).toBe('Constitution Saving Throw: DC 23, each creature in a 60-foot Cone. Failure: the target has the Unconscious condition until the end of its next turn, repeating the saving throw at the end of each of its turns to end the effect early. Success: no effect. No damage.');
  });

  it('recharge:"5-6" arms the MA-0031 gate on the live row (was ungated name-text), exact-once within actions', () => {
    expect(MIST.recharge).toBe('5-6');
    expect(rechargeUsageOf(MIST)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(MIST)).toBe('Sleeping Mist');
    // gate arm on THIS row's bytes: key + threshold + fresh available in one shot
    // (spent/refused/recharged truth-table owned by base :50-58/:231-237, not re-driven)
    expect(monsterRechargeGate(MIST, null)).toEqual({ key: 'Sleeping Mist', threshold: 5, available: true });
    // exact-once fix: Sleeping Mist is the ONLY recharge-armed action on this
    // card (#948 decoys by name — Constrict bytes owned by ma1939 :68-69,
    // Vigilant Watch by ma1944, absence-only pins here). Under a spent-Mist
    // map the hit-axis neighbours stay ungated null (#1035 guard reaches):
    expect(LADON.actions.filter((a) => a.recharge).map((a) => a.name)).toEqual(['Sleeping Mist (Recharge 5-6)']);
    const constrict = LADON.actions.find((a) => a.name === 'Constrict');
    expect(constrict.recharge).toBeUndefined();
    expect(monsterRechargeGate(constrict, { 'Sleeping Mist': { recharged: false, threshold: 5 } })).toBeNull();
    const bite = LADON.actions.find((a) => a.name === 'Bite');
    expect(monsterRechargeGate(bite, { 'Sleeping Mist': { recharged: false, threshold: 5 } })).toBeNull();
    // #1113 whole-DB raw-split: the fix byte pair (threshold "5-6" authored
    // AFTER save_dc, BEFORE description — MA-1924 twin byte-shape) occurs
    // exactly once in the entire monsters.json — no twin row shadow-arms.
    expect(RAW.split('"save_dc": 23,\n        "recharge": "5-6",\n        "description": "Constitution Saving Throw').length - 1).toBe(1);
  });
});
