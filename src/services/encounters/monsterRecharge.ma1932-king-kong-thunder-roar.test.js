// @maintained-by-ai
// MA-1932: King Kong "Thunder Roar (Recharge 5-6)" save core live-verified
// EXACT (DC 23 Wisdom, Frightened-until-end-of-next-turn on fail, nothing on
// success, no damage dice) but the recharge gate never armed — name-text
// "(Recharge 5-6)" parsed by NO parser (MA-1916/0663/MA-1924 breath-twin
// family), two ungated fires one fight zero refusal, monsterRecharge ABSENT.
// Fix: one-field recharge:"5-6" rides the live MA-0031/MA-0488/MA-1924
// spend/refusal/recovery lane (monsterRecharge.js). Secondary cosmetic fix:
// save_effect contradicted the description ("Success: half damage" vs "Success:
// no effect. No damage.") — zero damage dice authored, so the half-claim was
// mechanically inert; corrected to no-effect wording + dc_success:"none" per
// MA-1928/§530 condition-only-row convention so no fake "takes half damage"
// copy surfaces. THIS file owns the Thunder Roar save/recharge axis ONLY.
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
// Extractor generic vocab incl. undefined → []: MonsterCardModal.conditions-
// extraction.test.jsx header owns the map (no undefined leg lived here — vacu-
// ity-check n/a, applied-rec #3 NOTE). This ticket DID fix the save_effect/
// dc_success bytes, so the frightened word-scan on the FIXED byte is ticket-
// distinct behavior kept in it1 (ma1931 :99 pins only NOT-grappled there).
//
// Sibling ownership (never re-locking theirs):
//  - Grab full-row lock (name/attack/DC 25 Str/dc_success/escape_dc/save_
//    effect bytes) → monsterGrabSave.ma1931 :53-82 (#1093 cites THIS file as
//    owner of the DC 23 Wis core — kept here, its grab numerics trimmed out).
//  - Slam/Rock Throw legendary + Multiattack siblings → ma1936 advisory axis.
//  - turn-latch/cost-floor vocab → #1109 family, NEVER re-drive.
//
// Applied recs (#1117 family-fold + #1093 + #1118): rec#1 — old :54-59 inci-
// dental grab.save_dc/escape_dc/recharge sibling pins are NOT this row's own
// bytes (ma1931 full-row lock owns the numerics) → TRIM-CITED; replaced by
// name-only exact-once recharge guard + cheap gate-null-on-Grab decoy (the
// recharge axis stays this file's). rec#2 — old it3 "spent refuses, fresh
// available, recovery opens" is the generic truth-table → DROPPED (base
// :50-58 + :231-237 own it); fresh leg kept as the ONE-SHOT LIVE-row gate-arm
// toEqual({key,threshold,available}) + exact-once guard, #1117 it2 shape
// VERBATIM. rec#3 — no undefined-extractor leg here (none to purge; canonical
// map conditions-extraction.test.jsx). No wall-clock (#app); disk-only (#1057);
// no logs emitted here — pure fingerprint; no after-each state to clean.
//
// old→new map (5→2): old it1 save core → new it1 (+save_effect fixed byte +
// extractor + dc_success "none" fix byte); old it2 arming → new it2 (+one-
// shot gate-arm/exact-once/Grab-name-decoy); old it3 truth-table → DROPPED
// (base :50-58/:231-237); old it4 save_effect → folded into new it1; old it5
// dc_success + grab numeric pins → dc_success folded into new it1, grab
// numerics TRIM-CITED to ma1931. Row lookup positional actions[3] → name-
// lookup (#1094).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from './monsterRecharge.js';
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const KING_KONG = monsters.find((m) => m.index === 'king-kong');
const ROAR = KING_KONG.actions.find((a) => a.name.startsWith('Thunder Roar'));

describe('MA-1932 disk fingerprint: King Kong Thunder Roar recharge authored + save_effect contradiction fixed', () => {
  it('real-row lock: save core byte-unchanged (live-verified exact) + fix bytes dc_success:"none" + no-fake-half-damage save_effect scan [frightened]', () => {
    expect(KING_KONG.name).toBe('King Kong');
    expect(ROAR.name).toBe('Thunder Roar (Recharge 5-6)');
    expect(ROAR.save_dc).toBe(23);
    expect(ROAR.save_type).toBe('Wisdom');
    expect(ROAR.damage_dice_primary).toBeUndefined();
    expect(ROAR.damage_dice_secondary).toBeUndefined();
    expect(ROAR.description).toBe("Wisdom Saving Throw: DC 23, each creature within 60 ft. that can hear Kong. Failure: the target has the Frightened condition until the end of its next turn. Success: no effect. No damage.");
    // the ticket's cosmetic fix: fake "half damage" clause replaced by RAW
    // no-effect wording; exact byte subsumes any half-damage regex leg.
    expect(ROAR.save_effect).toBe('Failure: the target has the Frightened condition until the end of its next turn. Success: no effect.');
    expect(extractConditionsFromSaveEffect(ROAR.save_effect)).toEqual(['frightened']);
    expect(ROAR.dc_success).toBe('none'); // MA-1928/§530 condition-only-row convention — no half-default copy can surface
  });

  it('recharge:"5-6" arms the MA-0031 gate on the live row (was ungated name-text), exact-once within actions', () => {
    expect(ROAR.recharge).toBe('5-6');
    expect(rechargeUsageOf(ROAR)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(ROAR)).toBe('Thunder Roar');
    // gate arm on THIS row's bytes: key + threshold + fresh available in one shot
    // (spent/refused/recharged truth-table owned by base :50-58/:231-237, not re-driven)
    expect(monsterRechargeGate(ROAR, null)).toEqual({ key: 'Thunder Roar', threshold: 5, available: true });
    // exact-once fix: Thunder Roar is the ONLY recharge-armed action on this
    // card (#948 decoys by name — Multiattack/Slam/Grab covered by the filter;
    // legendary Slam/Rock Throw owned by ma1936, not re-locked here). Grab's
    // save_dc/escape_dc numerics owned by ma1931 :64-67 — recharge-axis only.
    expect(KING_KONG.actions.filter((a) => a.recharge).map((a) => a.name)).toEqual(['Thunder Roar (Recharge 5-6)']);
    const grab = KING_KONG.actions.find((a) => a.name === 'Grab');
    expect(monsterRechargeGate(grab, { 'Thunder Roar': { recharged: false, threshold: 5 } })).toBeNull();
  });
});
