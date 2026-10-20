// @maintained-by-ai
// MA-1978: Scylla "Blood Tide (Recharge 5-6)" save core live-verified
// EXACT (DC 25 DEX, 10d10 Piercing, half-on-success RAW-correct default —
// do NOT author dc_success) but the recharge gate never armed — name-text
// "(Recharge 5-6)" parsed by NO parser (MA-1948/1916/0663 breath-twin
// family), ungated multi-fire zero refusal (5 fires one session), monsterRecharge
// key ABSENT past owner turn-start. One-field DATA fix: recharge:"5-6" rides the
// live MA-0031 spend/refusal/recovery lane (monsterRecharge.js) — live post-fix:
// spend stamp {Blood Tide:{recharged:false,threshold:5}} + blood_tide_refused +
// d6≥5 recovery at owner turn-start + re-live chip re-fires once re-spending.
// Inline "within 30 ft. of her lair mouth" degradation is §211 family, out of
// scope; 0-HP consumed clause stays §70 advisory (no eyeRay lane authored).
//
// Base-cite table (monsterRecharge.test.js, CANON seam-fixture era):
//   key-suffix strip + threshold parse            :42-48  NEVER re-drive
//   fresh/spent/recharged gate truth-table        :50-58  NEVER re-drive
//   ungated rows → null generics                  :59-62  NEVER re-drive
//   fire-spend stamp + ability_use log            :65-73  NEVER re-drive
//   refusal vocab <slug>_refused (not recharged)  :75-81  NEVER re-drive
//   turn-start d6 regain / not-recharged / no-op  :84-122 NEVER re-drive
//   5-6 twin gate-arm vocab (apep threshold 5)    :231-237 NEVER re-drive
//
// PRESERVED-CITED-BY (#1113 CLOSED — this file is the Blood Tide numerics
// OWNER): the fingerprint bytes below (name/save_dc/save_type/damage
// dice+type/description/recharge) stay canonical/stable verbatim. ma1981
// Snatch and ma1982 Shriek cite this axis and trim THEIR copies — never
// re-drive their lanes here: Snatch prerequisite → ma1981 owns; Shriek
// save_effect rider → ma1982 owns (its save_effect sweep already proves
// Blood Tide rides NO rider byte, and its :140 pins target_prerequisite
// absence — cited, not doubled).
//
// Applied recs (#1117 family-fold + #1118 explicit + #1113):
// rec#1 (#1117) — old it3 "spent refuses, fresh available, recovery opens"
// re-drove base :50-58/:231-237 verbatim per-row → DROPPED; kept as the
// ONE-SHOT LIVE-row gate-arm toEqual({key,threshold,available}) in it2.
// rec#2 (#1118) — same fold cited base :50-58/:231-237; positional
// actions[2] lookup → name-lookup (#1094 brittle-index fix).
// rec#3 (#1113) — save-core fingerprint (:22-36 territory) PRESERVED
// canonical here; ma1981 trims its :136-139 weakest copy on ITS turn.
// #1122 hurricane template VERBATIM: whole-DB raw-split exact-once — the
// fix byte is NOT unique on DC 25 "5-6" alone (Behemoth "Earthshaker" DC25
// "5-6" twin #1122; Quetzalcoatl Hurricane Breath sits EARLIER in the
// file, split count 2) — so the split extends through this card's own
// 10d10 lair-mouth damage/description bytes until count=1. dc_success
// ABSENCE honest default-half (#1122 pattern). Decoys by NAME (#948):
// Shriek (#1113-owned) / Snatch (#1981-owned) / trait-namesake "Blood
// Tide" drag ability — absence-only, recharge never rides those lanes.
// #1035 guard reaches the branch: Bite/Multiattack gate null under a spent
// map. Extractors (#1119): ticket-fixed byte recharge:"5-6" KEEP-live
// (usageOf/key/gate through production); generic truth-tables purged.
// Honest titles (#910); determinism disk-only (#1057); no state written →
// no afterEach to clean (#1121 precedent); no wall-clock (#app).
//
// old→new map (3→2): old it1 save core → new it1 (+description verbatim
// ground truth #993/#1086, dc_success ABSENCE honesty); old it2 arming →
// new it2 (+one-shot LIVE-row gate-arm / exact-once card filter / whole-DB
// raw-split twin-extended / Bite+Multiattack gate-null decoys / legendary+
// reaction+trait absence-only); old it3 gate truth-table → DROPPED re-drive
// (base :50-58/:231-237 own it, #1117/#1118).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const monsters = JSON.parse(RAW);
const SCYLLA = monsters.find((m) => m.index === 'scylla');
// lookup by NAME, not index (#1094 brittle-index fix)
const TIDE = SCYLLA.actions.find((a) => a.name.startsWith('Blood Tide'));

describe('MA-1978 disk fingerprint: Scylla Blood Tide recharge authored', () => {
  it('real-row lock: save core byte-unchanged (live-verified exact, #1113 canonical here) — DC 25 DEX, 10d10 Piercing, description verbatim, dc_success ABSENT (app half-default RAW-correct)', () => {
    expect(SCYLLA.name).toBe('Scylla');
    expect(TIDE.name).toBe('Blood Tide (Recharge 5-6)');
    expect(TIDE.save_dc).toBe(25);
    expect(TIDE.save_type).toBe('Dexterity');
    expect(TIDE.damage_dice_primary).toBe('10d10');
    expect(TIDE.damage_type_primary).toBe('Piercing');
    expect(TIDE.description).toBe('Dexterity Saving Throw: DC 25, each creature within 30 ft. of her lair mouth. Failure: 55 (10d10) Piercing damage. Success: Half damage. A creature reduced to 0 Hit Points by this tide is dragged into the depths and consumed.');
    expect(TIDE.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE
  });

  it('fix byte recharge:"5-6" arms the MA-0031 gate on the live row, exact-once within actions (was ungated name-text)', () => {
    expect(TIDE.recharge).toBe('5-6');
    expect(rechargeUsageOf(TIDE)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(TIDE)).toBe('Blood Tide');
    // gate arm on THIS row's bytes: key + threshold + fresh available in one shot
    // (spent/refused/recharged truth-table owned by base :50-58/:231-237, not re-driven — #1117/#1118)
    expect(monsterRechargeGate(TIDE, null)).toEqual({ key: 'Blood Tide', threshold: 5, available: true });
    // exact-once fix: Blood Tide is the ONLY recharge-armed action on this card
    // (#948 decoys by name). Under a spent-Tide map the hit-axis neighbours stay
    // ungated null (#1035 guard reaches the branch):
    expect(SCYLLA.actions.filter((a) => a.recharge).map((a) => a.name)).toEqual(['Blood Tide (Recharge 5-6)']);
    const bite = SCYLLA.actions.find((a) => a.name === 'Bite');
    const multiattack = SCYLLA.actions.find((a) => a.name === 'Multiattack');
    expect(monsterRechargeGate(bite, { 'Blood Tide': { recharged: false, threshold: 5 } })).toBeNull();
    expect(monsterRechargeGate(multiattack, { 'Blood Tide': { recharged: false, threshold: 5 } })).toBeNull();
    // recharge never rides the legendary/reaction/trait lanes — Shriek save
    // rider (#1113/ma1982-owned) and Snatch prerequisite (#1981-owned) and the
    // trait-namesake "Blood Tide" drag ability are absence-only pins (#948, #1038):
    expect(SCYLLA.legendary_actions.filter((a) => a.recharge)).toEqual([]);
    expect(SCYLLA.reactions.filter((a) => a.recharge)).toEqual([]);
    expect(SCYLLA.traits.filter((a) => a.recharge)).toEqual([]);
    // #1122 whole-DB raw-split: NOT unique on DC 25 "5-6" alone — Quetzalcoatl
    // Hurricane Breath sits earlier in the file and Behemoth "Earthshaker" is a
    // DC 25 "5-6" twin decoy (#1122/#1121) — split extends through this card's
    // 10d10 lair-mouth description bytes until count=1.
    expect(RAW.split('"save_dc": 25,\n        "recharge": "5-6",\n        "description": "Dexterity Saving Throw: DC 25, each creature within 30 ft. of her lair mouth.').length - 1).toBe(1);
  });
});
