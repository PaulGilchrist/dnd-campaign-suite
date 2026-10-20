// @maintained-by-ai
// MA-1987: Simurgh "Purifying Blaze (Recharge 5-6)" save core live-verified
// EXACT (DC 24 DEX, 12d10 Radiant, half-on-success RAW-correct default —
// do NOT author dc_success) incl. live multi-target picker (60-foot Cone parses
// → SaveAttackAoeModal, per-victim adjudication 2/2 Bandits, FeyRanger half
// face via PC prompt) but the recharge gate never armed — name-text
// "(Recharge 5-6)" parsed by NO parser (MA-1948/1916/1978/0663 breath-twin
// family), ungated multi-fire zero refusal (3 volleys one session),
// monsterRecharge key ABSENT past owner turn-start (`2:Simurgh 1`).
// One-field DATA fix: recharge:"5-6" rides the live MA-0031 spend/refusal/
// recovery lane (monsterRecharge.js) — live post-fix: spend AT PICKER-OPEN
// stamp {Purifying Blaze:{recharged:false,threshold:5}} + purifying_blaze_refused
// + d6≥5 recovery at owner turn-start + re-live chip re-fires once re-spending.
// Unlike the shapeless-inline twins (MA-1948/2017), THIS row's "in a 60-foot
// Cone" prose DOES open the picker — but no range field is authored (§211:
// adding one risks flipping the lane); the fix stays one-field.
//
// Base-cite table (monsterRecharge.test.js, CANON seam-fixture era):
//   key-suffix strip + threshold parse            :42-48  NEVER re-drive
//   fresh/spent/recharged gate truth-table        :50-58  NEVER re-drive
//   ungated rows → null generics                  :59-62  NEVER re-drive
//   fire-spend stamp + ability_use log            :65-73  NEVER re-drive
//   refusal vocab <slug>_refused (not recharged)  :75-81  NEVER re-drive
//   turn-start d6 regain / not-recharged / no-op  :84-122 NEVER re-drive
//   5-6 twin gate-arm vocab (apep threshold 5)    :231-237 NEVER re-drive
//   MA-0021 spend/refusal/recovery vocab          NEVER re-drive
// Extractors (#1119 distinction rule): MA-1987 fixed ONLY recharge:"5-6" —
// the row has NO save_effect bytes → no extractor leg here; undefined→[]
// generics owned by the conditions-extraction canonical, purged (#1117).
// The ticket-fixed byte stays KEEP-live through production usageOf/key/gate.
// Simurgh save core NOT cited-as-canonical by any sibling (grep 2026-10-20);
// MA-1990/1991 own the legendary Healing Breath / Soothing Cry lanes
// (MonsterCardModal) — absence-only here, never re-driven.
//
// old→new map (3→2): old it1 save core → new it1 (+name-lookup #1094,
// verbatim description ground truth #993/#1086, dc_success ABSENCE honesty
// #1122/#1123 — explicit "Half damage" clause makes the app half-default
// RAW-correct); old it2 arming → new it2 (+ONE-SHOT LIVE-row gate-arm
// toEqual({key,threshold,available:true}) #1118 shape / exact-once recharge
// filter dup-map #1038 / Talon+Beak gate-null decoys #1035 guard reaches
// the branch / legendary+reaction+trait absence-only #1123 drag-decoy
// precedent, Purifying Aura trait-namesake #948 / whole-DB raw-split
// #1121/#1122 twin-extended); old it3 "spent refuses, fresh available,
// recovery opens" → DROPPED, generic truth-table re-drive of base
// :50-58/:231-237 (#1117/#1118).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const monsters = JSON.parse(RAW);
const SIMURGH = monsters.find((m) => m.index === 'simurgh');
// lookup by NAME, not index (#1094 brittle-index fix)
const BLAZE = SIMURGH.actions.find((a) => a.name.startsWith('Purifying Blaze'));

describe('MA-1987 disk fingerprint: Simurgh Purifying Blaze recharge authored', () => {
  it('real-row lock: save core byte-unchanged (live-verified exact) — DC 24 DEX, 12d10 Radiant, description verbatim, dc_success ABSENT (app half-default RAW-correct)', () => {
    expect(SIMURGH.name).toBe('Simurgh');
    expect(BLAZE.name).toBe('Purifying Blaze (Recharge 5-6)');
    expect(BLAZE.save_dc).toBe(24);
    expect(BLAZE.save_type).toBe('Dexterity');
    expect(BLAZE.damage_dice_primary).toBe('12d10');
    expect(BLAZE.damage_type_primary).toBe('Radiant');
    expect(BLAZE.description).toBe('Dexterity Saving Throw: DC 24, each creature in a 60-foot Cone the Simurgh chooses to burn. Failure: 66 (12d10) Radiant damage. Success: Half damage.');
    expect(BLAZE.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE
  });

  it('fix byte recharge:"5-6" arms the MA-0031 gate on the live row, exact-once within actions (was ungated name-text)', () => {
    expect(BLAZE.recharge).toBe('5-6');
    expect(rechargeUsageOf(BLAZE)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(BLAZE)).toBe('Purifying Blaze');
    // gate arm on THIS row's bytes: key + threshold + fresh available in one shot
    // (spent/refused/recharged truth-table owned by base :50-58/:231-237, not re-driven — #1117/#1118)
    expect(monsterRechargeGate(BLAZE, null)).toEqual({ key: 'Purifying Blaze', threshold: 5, available: true });
    // exact-once fix: Purifying Blaze is the ONLY recharge-armed action on this
    // card (#1038 dup-map, #948 decoys by name). Under a spent-Blaze map the
    // hit-axis neighbours stay ungated null (#1035 guard reaches the branch):
    expect(SIMURGH.actions.filter((a) => a.recharge).map((a) => a.name)).toEqual(['Purifying Blaze (Recharge 5-6)']);
    const talon = SIMURGH.actions.find((a) => a.name === 'Talon');
    const beak = SIMURGH.actions.find((a) => a.name === 'Beak');
    expect(monsterRechargeGate(talon, { 'Purifying Blaze': { recharged: false, threshold: 5 } })).toBeNull();
    expect(monsterRechargeGate(beak, { 'Purifying Blaze': { recharged: false, threshold: 5 } })).toBeNull();
    // recharge never rides the legendary/reaction/trait lanes — Healing Breath
    // and Soothing Cry owned by MonsterCardModal.ma1990/ma1991, and the
    // trait-namesake "Purifying Aura" is an absence-only pin (#948, #1123):
    expect(SIMURGH.legendary_actions.filter((a) => a.recharge)).toEqual([]);
    expect(SIMURGH.reactions.filter((a) => a.recharge)).toEqual([]);
    expect(SIMURGH.traits.filter((a) => a.recharge)).toEqual([]);
    // #1121/#1122 whole-DB raw-split: NOT unique on DC 24 "5-6" alone — Garmr
    // "Corpse-Fire Breath" is a DC 24 DEX 12d10 60-foot Cone twin decoy sharing
    // the description prefix (split count 2) — the anchor extends through this
    // card's own "the Simurgh chooses to burn" bytes until count=1.
    expect(RAW.split('"save_dc": 24,\n        "recharge": "5-6",\n        "description": "Dexterity Saving Throw: DC 24, each creature in a 60-foot Cone the Simurgh chooses to burn').length - 1).toBe(1);
  });
});
