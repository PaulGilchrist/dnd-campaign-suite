// @maintained-by-ai
// MA-1948: Nidhogg "Corpse Wind (Recharge 5-6)" save core live-verified
// EXACT (DC 24 CON, 12d10 Necrotic, floor-half success face 62→31 via PC
// prompt) but the recharge gate never armed — name-text "(Recharge 5-6)"
// parsed by NO parser (MA-1916/0663/1924/1940 breath-twin family), ungated
// double-fire zero refusal, monsterRecharge key ABSENT past owner turn-start.
// One-field DATA fix: recharge:"5-6" rides the live MA-0031 spend/refusal/
// recovery lane (monsterRecharge.js) — MA-1924 byte-shape (after save_dc,
// before description). THIS file owns Corpse Wind's OWN recharge/save axis
// (#1101 twin split: Grave Gale save bytes owned by
// monsterLegendarySave.ma1952-nidhogg-grave-gale — cited, never re-locked).
//
// Base-cite table (monsterRecharge.test.js, CANON @#1108 seam-fixture era,
// refreshed #1116/#1117):
//   key-suffix strip + threshold parse            :42-48  NEVER re-drive
//   fresh/spent/recharged gate truth-table        :50-58  NEVER re-drive
//   ungated rows → null generics                  :59-62  NEVER re-drive
//   fire-spend stamp + ability_use log            :65-73  NEVER re-drive
//   refusal vocab <slug>_refused (not recharged)  :75-81  NEVER re-drive
//   turn-start d6 regain / not-recharged / no-op  :84-122 NEVER re-drive
//   5-6 twin gate-arm vocab (apep threshold 5)    :231-237 NEVER re-drive
//   MA-0021 spend/refusal/recovery vocab          NEVER re-drive
// Extractors (#1119 distinction rule): this ticket fixed NO save_effect bytes
// (row has none — half-default lives in description prose) → no extractor leg
// here; undefined→[] generic vocab owned by the conditions-extraction header.
//
// Applied recs (#1117 family-fold + #1118 template VERBATIM + #1120):
// rec#1 — old it3 "spent refuses, fresh available, recovery opens" is the
// generic spent/fresh/recharged truth-table → DROPPED (base :50-58 +
// :231-237 own it); fresh leg kept as the ONE-SHOT LIVE-row gate-arm
// toEqual({key,threshold,available}) + exact-once filter, #1118 it2 shape.
// Row lookup positional actions[3] → name-lookup (#1094). Decoys by NAME
// (#948): Bite/Claw gate-null honest (#1035 guard reaches the branch);
// Grave Gale absence-only pin, its save core cited to #1952/#1101. Whole-DB
// raw-split #1113/#1120: the fix byte pair is NOT unique on save_dc 24
// alone — Ziz "Solar Flare" is a DC 24 CON "5-6" twin decoy sharing the
// description prefix — so the split pins THIS card's 12d10 damage bytes.
// Disk-only (#1057), no wall-clock (#app), no state written — pure
// fingerprint, no afterEach to clean.
//
// old→new map (3→2): old it1 save core → new it1 (+verbatim description
// ground truth #993/#1086, dc_success ABSENCE honesty — explicit "Half
// damage" clause makes the app half-default RAW-correct); old it2 arming →
// new it2 (+one-shot gate-arm / exact-once / whole-DB raw-split #1113
// shape / Bite+Claw gate-null decoys / Grave Gale absence-only); old it3
// truth-table → DROPPED (base :50-58/:231-237).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from './monsterRecharge.js';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const monsters = JSON.parse(RAW);
const NIDHOGG = monsters.find((m) => m.index === 'nidhogg');
// lookup by NAME, not index (#1094 brittle-index fix)
const WIND = NIDHOGG.actions.find((a) => a.name.startsWith('Corpse Wind'));

describe('MA-1948 disk fingerprint: Nidhogg Corpse Wind recharge authored', () => {
  it('real-row lock: save core byte-unchanged (live-verified exact) — DC 24 CON, 12d10 Necrotic, description verbatim, dc_success ABSENT (explicit "Half damage" clause makes the app half-default RAW-correct)', () => {
    expect(NIDHOGG.name).toBe('Nidhogg');
    expect(WIND.name).toBe('Corpse Wind (Recharge 5-6)');
    expect(WIND.save_dc).toBe(24);
    expect(WIND.save_type).toBe('Constitution');
    expect(WIND.damage_dice_primary).toBe('12d10');
    expect(WIND.damage_type_primary).toBe('Necrotic');
    expect(WIND.description).toBe('Constitution Saving Throw: DC 24, each creature within 60 ft. Failure: 66 (12d10) Necrotic damage. Success: Half damage.');
    expect(WIND.dc_success).toBeUndefined();
  });

  it('recharge:"5-6" arms the MA-0031 gate on the live row (was ungated name-text), exact-once within actions', () => {
    expect(WIND.recharge).toBe('5-6');
    expect(rechargeUsageOf(WIND)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(WIND)).toBe('Corpse Wind');
    // gate arm on THIS row's bytes: key + threshold + fresh available in one shot
    // (spent/refused/recharged truth-table owned by base :50-58/:231-237, not re-driven)
    expect(monsterRechargeGate(WIND, null)).toEqual({ key: 'Corpse Wind', threshold: 5, available: true });
    // exact-once fix: Corpse Wind is the ONLY recharge-armed action on this
    // card (#948 decoys by name). Under a spent-Wind map the hit-axis
    // neighbours stay ungated null (#1035 guard reaches the branch):
    expect(NIDHOGG.actions.filter((a) => a.recharge).map((a) => a.name)).toEqual(['Corpse Wind (Recharge 5-6)']);
    const bite = NIDHOGG.actions.find((a) => a.name === 'Bite');
    const claw = NIDHOGG.actions.find((a) => a.name === 'Claw');
    expect(monsterRechargeGate(bite, { 'Corpse Wind': { recharged: false, threshold: 5 } })).toBeNull();
    expect(monsterRechargeGate(claw, { 'Corpse Wind': { recharged: false, threshold: 5 } })).toBeNull();
    // Grave Gale absence-only pin (#948) — its save quartet + delegate guard
    // owned by monsterLegendarySave.ma1952-nidhogg-grave-gale (#1101 CLOSED);
    // recharge must never ride the legendary lane.
    const gale = NIDHOGG.legendary_actions.find((a) => a.name === 'Grave Gale (Costs 2 Actions)');
    expect(gale.recharge).toBeUndefined();
    // #1113 whole-DB raw-split: the fix byte pair (threshold "5-6" authored
    // AFTER save_dc, BEFORE description — MA-1924 twin byte-shape) occurs
    // exactly once in the entire monsters.json. Save_dc 24 + "5-6" alone is
    // NOT unique — Ziz "Solar Flare" is a DC 24 CON 5-6 twin decoy sharing
    // the description prefix — so the split pins this card's 12d10 bytes.
    expect(RAW.split('"save_dc": 24,\n        "recharge": "5-6",\n        "description": "Constitution Saving Throw: DC 24, each creature within 60 ft. Failure: 66 (12d10) Necrotic damage. Success: Half damage."').length - 1).toBe(1);
  });
});
