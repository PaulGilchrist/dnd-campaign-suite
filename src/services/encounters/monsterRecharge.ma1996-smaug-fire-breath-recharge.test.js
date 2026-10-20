// @maintained-by-ai
// MA-1996: Smaug the Golden "Fire Breath (Recharge 5-6)" save core live-verified
// EXACT (DC 24 DEX, 22d6 Fire, half-on-success RAW-correct default — do NOT
// author dc_success; picker opens via DESCRIPTION prose MA-0618) but the
// recharge gate never armed — name-text "(Recharge 5-6)" parsed by NO parser
// (MA-1948/1978/1987 breath-twin family, 9th instance), ungated multi-fire
// 3 volleys one session with zero refusal, monsterRecharge key ABSENT past
// owner turn-start (`2:Smaug the Golden 1` walk-truth). DATA fix: recharge:
// "5-6" (+range:"90-foot Cone" byte-companion hygiene, identical 90/cone
// semantics the MA-0618 description parse already produced) rides the live
// MA-0031 spend/refusal/recovery lane (monsterRecharge.js). Unlike the
// one-field twins MA-1987/2067 (range deliberately NOT authored, §211), this
// fix authors the range byte too — so this lane pins BOTH fix bytes.
// Live-verified post-fix notes (manual walk, recorded not simulated): spend
// AT PICKER-OPEN stamp {Fire Breath:{recharged:false,threshold:5}} +
// fire_breath_refused + d6≥5 recovery at owner turn-start + re-live chip
// re-fires once re-spending. No UI sibling owns the real-Smaug chip/picker
// face (MonsterCardModal.test.jsx :321 is a synthetic fixture row, not this
// card) — this lane is honest disk+gate arithmetic only (#910 honest titles).
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
//    disk-only lane (#1057) does not walk it, #1076: no live walk here so
//    the ONE-SHOT LIVE-row gate-arm suffices, #1118 shape VERBATIM)
//   5-6 twin gate-arm vocab (apep threshold 5)    :231-237 NEVER re-drive
//   MA-0021 spend/refusal/recovery vocab          NEVER re-drive
//
// #1038 dup-map — Smaug lanes and their owners (absence-only here, never
// re-driven): Fire Breath recharge axis OWNED here (canonical fingerprint);
// Detection legendary → ma2002; Frightful Presence DC 22 WIS save →
// saveProcessing.ma1997; roster sweep → monsterEpicCohort.test.js :31;
// dice-roll engine → diceRoller (#1072), 22d6 math never re-derived.
// Extractors (#1119): MA-1996 fixed recharge + range companion bytes only —
// the row has NO save_effect bytes → no extractor leg here; undefined→[]
// generics owned by MonsterCardModal.conditions-extraction.test.jsx canonical,
// purged family-wide (#1117). Ticket-fixed bytes stay KEEP-live through
// production usageOf/key/gate.
// #948 decoys by NAME distinct from family sets: legendary "Flame Lash"
// (fire-namesake), legendary Claw/Tail (action-namesakes), "Hoard Guardian"
// trait, Frightful Presence save row — absence-only pins.
// #1121 twin-collision check VERIFIED: DC 24 + recharge "5-6" is NOT unique
// (9 rows: ancient-gold/red/silver-dragon Fire/Cold Breath twins, Ziz Solar
// Flare #1121, Simurgh Purifying Blaze #1124, Garmr, Nidhogg, Thunderbird)
// and "90-foot Cone" alone is NOT unique (githyanki-dracomancer Conjured
// Dragon's Breath decoy) — the raw-split anchor therefore extends through
// this card's OWN 77 (22d6) Fire description bytes up to the recharge byte
// until count=1 (disk-verified).
//
// old→new map (3→2): old it1 save core → new it1 (+name-lookup #1094,
// verbatim description ground truth #993/#1086, dc_success ABSENCE honest
// half-default pin #1122/#1123); old it2 arming → new it2 (+ONE-SHOT
// LIVE-row gate-arm toEqual({key,threshold,available:true}) #1118 shape /
// range byte-companion ticket-distinct pin / exact-once card filter #1038 /
// Bite+Multiattack gate-null decoys #1035 guard reaches the branch /
// legendary+reaction+trait+lair absence-only #1123 precedent); old it3
// "spent refuses, recovered opens, fresh available" → DROPPED, generic
// truth-table re-drive of base :50-58 (+ :231-237 5-6 twin gate-arm vocab)
// (#1117/#1118). No state written → no afterEach to clean (#1121 precedent);
// no wall-clock (#app MANDATORY).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const monsters = JSON.parse(RAW);
const SMAUG = monsters.find((m) => m.index === 'smaug-the-golden');
// lookup by NAME, not index (#1094 brittle-index fix)
const FIRE = SMAUG.actions.find((a) => a.name.startsWith('Fire Breath'));

describe('MA-1996 disk fingerprint: Smaug Fire Breath recharge authored', () => {
  it('real-row lock: save core byte-unchanged (live-verified exact) — DC 24 DEX, 22d6 Fire, description verbatim, dc_success ABSENT (app half-default RAW-correct)', () => {
    expect(SMAUG.name).toBe('Smaug the Golden');
    expect(FIRE.name).toBe('Fire Breath (Recharge 5-6)');
    expect(FIRE.save_dc).toBe(24);
    expect(FIRE.save_type).toBe('Dexterity');
    expect(FIRE.damage_dice_primary).toBe('22d6');
    expect(FIRE.damage_type_primary).toBe('Fire');
    expect(FIRE.description).toBe('Dexterity Saving Throw: DC 24, each creature in a 90-foot Cone. Failure: 77 (22d6) Fire damage. Success: Half damage.');
    expect(FIRE.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE
  });

  it('fix bytes recharge:"5-6" + range:"90-foot Cone" arm the MA-0031 gate on the live row, exact-once within actions (was ungated name-text)', () => {
    expect(FIRE.recharge).toBe('5-6');
    expect(FIRE.range).toBe('90-foot Cone'); // byte-companion: identical to the description-parsed semantics the picker already used (MA-0618); ticket-distinct two-byte fix (one-field twins MA-1987/2067 deliberately omitted range, §211)
    expect(rechargeUsageOf(FIRE)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(FIRE)).toBe('Fire Breath');
    // ONE-SHOT LIVE-row gate-arm on THIS row's bytes (#1118 shape VERBATIM):
    // key + threshold + fresh available in one shot
    // (spent/refused/recharged truth-table owned by base :50-58/:231-237, not re-driven — #1117/#1118)
    expect(monsterRechargeGate(FIRE, null)).toEqual({ key: 'Fire Breath', threshold: 5, available: true });
    // exact-once fix: Fire Breath is the ONLY recharge-armed action on this
    // card (#1038 dup-map, #948 decoys by name). Under a spent-Fire map the
    // hit-axis neighbours stay ungated null (#1035 guard reaches the branch):
    expect(SMAUG.actions.filter((a) => a.recharge).map((a) => a.name)).toEqual(['Fire Breath (Recharge 5-6)']);
    const bite = SMAUG.actions.find((a) => a.name === 'Bite');
    const multiattack = SMAUG.actions.find((a) => a.name === 'Multiattack');
    expect(monsterRechargeGate(bite, { 'Fire Breath': { recharged: false, threshold: 5 } })).toBeNull();
    expect(monsterRechargeGate(multiattack, { 'Fire Breath': { recharged: false, threshold: 5 } })).toBeNull();
    // recharge never rides the legendary/reaction/trait/lair lanes — Detection
    // legendary is ma2002-owned, Frightful Presence (DC 22 WIS) is ma1997-owned;
    // fire-namesake "Flame Lash" and action-namesakes Claw/Tail are absence-only
    // pins here (#948, #1123 precedent):
    expect(SMAUG.legendary_actions.filter((a) => a.recharge)).toEqual([]);
    expect(SMAUG.reactions.filter((a) => a.recharge)).toEqual([]);
    expect(SMAUG.traits.filter((a) => a.recharge)).toEqual([]);
    expect(SMAUG.lair_actions.filter((a) => a.recharge)).toEqual([]);
    // #1121 whole-DB raw-split: NOT unique on DC 24 "5-6" alone (9 twins incl.
    // ancient gold/red-dragon Fire Breath, Ziz #1121, Simurgh #1124) and NOT
    // unique on the 90-foot Cone range byte (githyanki-dracomancer decoy) —
    // anchor extends through this card's own 77 (22d6) Fire description bytes
    // to the recharge byte until count=1 (disk-verified).
    expect(RAW.split('"save_dc": 24,\n        "description": "Dexterity Saving Throw: DC 24, each creature in a 90-foot Cone. Failure: 77 (22d6) Fire damage. Success: Half damage.",\n        "range": "90-foot Cone",\n        "recharge": "5-6"').length - 1).toBe(1);
  });
});
