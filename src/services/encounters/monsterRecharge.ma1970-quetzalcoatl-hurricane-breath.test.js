// @maintained-by-ai
// MA-1970: Quetzalcoatl "Hurricane Breath (Recharge 5-6)" save core live-verified
// EXACT (DC 25 DEX, 20d6 Thunder, half-on-success default RAW-correct; "90-foot
// Cone" parses to SaveAttackAoeModal picker) but two DATA fields missing: NO
// `recharge` — "(Recharge 5-6)" was name-text parsed by NO recharge parser
// (MA-1948/MA-1924/MA-0663 breath-twin family), 5 same-turn fires live, zero
// refusal, monsterRecharge key never stamped; NO `save_effect` — the Prone/
// Deafened rider lived only in description prose, inert (§53 MA-0090: 15 failed
// saves, zero condition grants). Two-field DATA fix: recharge:"5-6" rides the
// live MA-0031 spend/refusal/recovery lane (monsterRecharge.js, MA-1924
// byte-shape placement after save_dc); save_effect byte-mirrors the row's own
// description rider clause for extractConditionsFromSaveEffect (MV-31 transport).
//
// Base-cite table (monsterRecharge.test.js, CANON @#1108 seam-fixture era,
// refreshed #1116/#1117/#1120):
//   key-suffix strip + threshold parse            :42-48  NEVER re-drive
//   fresh/spent/recharged gate truth-table        :50-58  NEVER re-drive
//   ungated rows → null generics                  :59-62  NEVER re-drive
//   fire-spend stamp + ability_use log            :65-73  NEVER re-drive
//   refusal vocab <slug>_refused (not recharged)  :75-81  NEVER re-drive
//   turn-start d6 regain / not-recharged / no-op  :84-122 NEVER re-drive
//   5-6 twin gate-arm vocab (apep threshold 5)    :231-237 NEVER re-drive
//   MA-0021 spend/refusal/recovery vocab          NEVER re-drive
// Extractors (#1119 distinction rule): undefined→[] and word-scan/miss generics
// owned by MonsterCardModal.conditions-extraction.test.jsx :28-40 (CANON) —
// this file pins ONLY this row's live rider bytes.
//
// PRESERVED-CITED-BY (#1112 CLOSED, monsterLegendaryUses.ma1974-quetzalcoatl):
// "Hurricane Breath recharge/save_dc/20d6/save_effect bytes owner" — the
// fingerprint bytes below (name/save_dc/save_type/damage dice+type/recharge/
// save_effect + alphabetical extractor output) are cited there and stay
// canonical/stable verbatim. Wing Defense save core (DC25, dc_success 'none')
// and Talon/Wind Step delegates owned by #1112/#1089 — absence-only here;
// recharge must never ride the legendary/reaction lanes. epicCohort #1092
// owns the 20d6 cohort-band sweep-cite only — different lane, not re-driven.
//
// Applied recs (#1117 family-fold VERBATIM + #1117 family-wide + #1119):
// rec#1 — old it3 "spent refuses, fresh available, recovery opens" re-drove
// base :50-58/:231-237 verbatim per-row → DROPPED; kept as the ONE-SHOT
// LIVE-row gate-arm toEqual({key,threshold,available}) in it2, #1118 shape.
// rec#2 — old it4 generic leg extractConditionsFromSaveEffect(undefined)→[]
// PURGED, cited conditions-extraction canonical :28-40 (MA-1916 precedent).
// rec#3 — PRESERVED :23-49 cited bytes kept verbatim; cite-table refreshed.
// Row lookup positional actions[3] → name-lookup (#1094). Decoys by NAME
// (#948): Bite/Talon gate-null honest (#1035 guard reaches the branch);
// legendary + Wing Defense absence-only (#1112-owned). Whole-DB raw-split
// #1113/#1120/#1121: the fix byte pair is NOT unique on save_dc 25 alone —
// Behemoth "Earthshaker" is a DC 25 "5-6" twin decoy (Ziz Solar Flare DC24
// precedent #1121) — so the split extends through THIS card's 20d6 Cone
// description bytes until count=1. "Hurricane Breath" text appears twice in
// the DB (actions name + this card's combat-strategy prose) — the exact-once
// filter lands the actions lane only (dup-map #1038). Disk-only fingerprint
// (#1057), no wall-clock (#app), no state written — no afterEach to clean
// (#1121 precedent).
//
// old→new map (4→3): old it1 save core → new it1 (+description verbatim
// ground truth #993/#1086, dc_success ABSENCE honesty); old it2 arming →
// new it2 (+one-shot LIVE-row gate-arm / exact-once filter / whole-DB
// raw-split twin-extended / Bite+Talon gate-null decoys / legendary+wing
// absence-only); old it3 gate truth-table → DROPPED re-drive (base
// :50-58/:231-237 own it); old it4 rider → new it3 (+byte-mirror
// provenance + exact-once; undefined→[] generic leg PURGED to canonical).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from './monsterRecharge.js';
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const monsters = JSON.parse(RAW);
const QUETZALCOATL = monsters.find((m) => m.index === 'quetzalcoatl');
// lookup by NAME, not index (#1094 brittle-index fix)
const BREATH = QUETZALCOATL.actions.find((a) => a.name.startsWith('Hurricane Breath'));

describe('MA-1970 disk fingerprint: Quetzalcoatl Hurricane Breath recharge + rider authored', () => {
  it('real-row lock: save core byte-unchanged (live-verified exact) — DC 25 DEX, 20d6 Thunder, description verbatim, dc_success ABSENT (app half-default RAW-correct)', () => {
    expect(QUETZALCOATL.name).toBe('Quetzalcoatl');
    expect(BREATH.name).toBe('Hurricane Breath (Recharge 5-6)');
    expect(BREATH.save_dc).toBe(25);
    expect(BREATH.save_type).toBe('Dexterity');
    expect(BREATH.damage_dice_primary).toBe('20d6');
    expect(BREATH.damage_type_primary).toBe('Thunder');
    expect(BREATH.description).toBe('Dexterity Saving Throw: DC 25, each creature in a 90-foot Cone. Failure: 70 (20d6) Thunder damage. Success: Half damage. The target is also knocked Prone and Deafened for 1 minute on a failed save.');
    expect(BREATH.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE
  });

  it('recharge:"5-6" arms the MA-0031 gate on the live row, exact-once within actions (was ungated name-text)', () => {
    expect(BREATH.recharge).toBe('5-6');
    expect(rechargeUsageOf(BREATH)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(BREATH)).toBe('Hurricane Breath');
    // gate arm on THIS row's bytes: key + threshold + fresh available in one shot
    // (spent/refused/recharged truth-table owned by base :50-58/:231-237, not re-driven)
    expect(monsterRechargeGate(BREATH, null)).toEqual({ key: 'Hurricane Breath', threshold: 5, available: true });
    // exact-once fix: Hurricane Breath is the ONLY recharge-armed action on this
    // card (#948 decoys by name). Under a spent-Breath map the hit-axis
    // neighbours stay ungated null (#1035 guard reaches the branch):
    expect(QUETZALCOATL.actions.filter((a) => a.recharge).map((a) => a.name)).toEqual(['Hurricane Breath (Recharge 5-6)']);
    const bite = QUETZALCOATL.actions.find((a) => a.name === 'Bite');
    const talon = QUETZALCOATL.actions.find((a) => a.name === 'Talon');
    expect(monsterRechargeGate(bite, { 'Hurricane Breath': { recharged: false, threshold: 5 } })).toBeNull();
    expect(monsterRechargeGate(talon, { 'Hurricane Breath': { recharged: false, threshold: 5 } })).toBeNull();
    // recharge never rides the legendary/reaction lanes — save cores + Talon/
    // Wind Step delegates + Wing Defense bytes owned by #1112/#1089, absence-only pin:
    expect(QUETZALCOATL.legendary_actions.filter((a) => a.recharge)).toEqual([]);
    expect(QUETZALCOATL.reactions.filter((a) => a.recharge)).toEqual([]);
    // #1113 whole-DB raw-split: the fix byte pair (threshold "5-6" authored
    // AFTER save_dc — MA-1924 twin byte-shape) is NOT unique on save_dc 25
    // alone — Behemoth "Earthshaker" is a DC 25 "5-6" twin decoy (Ziz precedent
    // #1121) — so the split extends through this card's 20d6 Cone description.
    expect(RAW.split('"save_dc": 25,\n        "recharge": "5-6",\n        "description": "Dexterity Saving Throw: DC 25, each creature in a 90-foot Cone. Failure: 70 (20d6) Thunder damage. Success: Half damage. The target is also knocked Prone and Deafened for 1 minute on a failed save."').length - 1).toBe(1);
  });

  it('save_effect rider authored exact-once, byte-mirrors description clause, extracts [deafened,prone] (was description-only inert)', () => {
    // byte-mirror of the row's own description rider clause
    expect(BREATH.save_effect).toBe('The target is also knocked Prone and Deafened for 1 minute on a failed save.');
    expect(BREATH.description).toContain(BREATH.save_effect);
    // actual extractor output pinned: CONDITIONS scan is alphabetical → deafened before prone (§658)
    expect(extractConditionsFromSaveEffect(BREATH.save_effect)).toEqual(['deafened', 'prone']);
    // whole-DB + card exact-once: no other row carries this rider byte
    // (undefined→[] pre-fix generic leg PURGED — owned by conditions-extraction
    // canonical :28-40, #1117 family-wide rec; MA-1916 precedent)
    expect(RAW.split('"save_effect": "The target is also knocked Prone and Deafened for 1 minute on a failed save."').length - 1).toBe(1);
    expect(QUETZALCOATL.actions.filter((a) => a.save_effect != null).map((a) => a.name)).toEqual(['Hurricane Breath (Recharge 5-6)']);
  });
});
