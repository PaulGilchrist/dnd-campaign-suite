// @maintained-by-ai
// MA-2059: Ymir "Glacier Wave (Recharge 5-6)" — fingerprint #12 recharge
// name-text trap (MA-0663/1916/1924/1948/1987/1996/2017/2041/2051 family):
// row authored with recharge ONLY in the name, no flat recharge field →
// rechargeUsageOf null (monsterRecharge.js:37) → monsterRechargeGate null →
// ungated unlimited refires (live: 4 fires incl same-turn + past owner-turn,
// cd['Ymir 1'].monsterRecharge absent at every probe, zero refusal/recovery
// logs). SECOND gap: prose Restrained clause inert (§567 bait twin) — save
// lane word-scans save_effect ONLY (extractConditionsFromSaveEffect,
// Helpers:383) → row carried no save_effect → ['restrained'] never produced,
// zero grant after two failed saves (live cd['Bandit'].activeConditions []).
// TWO-field DATA fix (monsters.json ymir actions "Glacier Wave"):
//   recharge:"5-6"  — rides the live MA-0031 spend/refusal/recovery lane
//                     (picker-open spend convention MA-1996/1987; re-press
//                     refuses — refusal vocab owned by base, not re-driven).
//   save_effect:"The target has the Restrained condition until the end of
//     its next turn." — centaur-warden Entangling Trail byte-twin (exactly
//     2 occurrences on disk: centaur-warden + this row; no OTHER test file
//     mentions this byte — grep-verified → the byte's extractor unit pin is
//     OWNED HERE, #1119 fixed-bytes KEEP: MA-2059 authored save_effect).
// dc_success stays UNSET — half-default pays half on success, matching RAW
// "Success: Half damage" (MA-2045/MA-1855 pin, #1122 honest ABSENCE pin).
// escape_dc stays OMITTED — RAW states no escape DC here (§537: restrained≠
// grappled, escape badges ride the grapple hit-clause lane anyway). Range
// honest: this is an AUTHORED 120-ft Line — the Line noun lives in the
// description and the picker opens via MA-2033 Line parse (not §211
// shapeless-inline); no range field authored, pin stays ABSENT. Core picker
// consumer lane lives on SaveAttackAoeModal.ma2059 (both faces, grant-log
// authored-clause copy) — not duplicated here.
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
//   lanes (recharge-cone :187, sleep-breath :256) — never re-drive here
//
// #1038 dup-map — Ymir lanes and their owners (absence-only here, never
// re-driven): Glacier Wave recharge axis + save_effect byte OWNED here
// (canonical fingerprint row pin); Glacier Wave picker consumer (mixed
// confirm, fail full-damage + Restrained grant, half face) →
// SaveAttackAoeModal.ma2059 (CLOSED, grep-confirmed it cites THIS lane as
// row-data owner and re-pins nothing); Frost Geyser save lane →
// SaveAttackAoeModal.ma2063; roster sweep → monsterEpicCohort.test.js;
// dice-roll engine → diceRoller (#1072), 77 (14d10) math never re-derived.
// Multiattack/Glacier Club/Stomp are hit-axis namesakes (#948 — Stomp's
// hit_conditions:['prone'] rides the hit-clause lane) — recharge/save_effect
// ABSENCE-only pins; traits Legendary Resistance/Primordial Flesh/
// World-Flesh own no recharge byte.
// Extractors (#1119): MA-2059 fixed BOTH fields, so the extractor leg on the
// FIXED save_effect byte KEEPs (['restrained'] + authored until-clause); the
// undefined→[] generic is PURGED — owned by MonsterCardModal.conditions-
// extraction.test.jsx canonical word-scan legs, purged family-wide (#1117).
// #1121/#1125R twin-collision check VERIFIED (disk): the DC+threshold+save-
// type pool DC 26 + "5-6" hits 5 rows (apep/colossus/fenrir/yamata/ymir);
// raw adjacency "Strength"+"save_dc":26 hits 2 (Fenrir Devour + this row);
// the anchor therefore extends through this row's OWN 120-ft-Line description
// and 14d10 Bludgeoning + recharge bytes until count=1 (disk-verified).
//
// old→new map (7→3): old it1 save core → new it1 (+name-lookup #1094
// replacing brittle actions[3], verbatim description ground truth #993/#1086,
// dc_success/escape_dc/range ABSENCE honest pins #1122/§537/§211-honest-
// Line, + save_effect byte folded from old it6 + card-exact-once save_effect
// filter #1038); old it2 arming → new it2 (+ONE-SHOT LIVE-row gate-arm
// toEqual({key,threshold,available:true}) #1118 shape / exact-once recharge
// filter #1038 / Stomp gate-null decoy under spent map #1035 guard reaches
// the branch / legendary+reaction+trait+lair+bonus absence-only #1123
// precedent / whole-DB raw-split exact-once); old it3 "spent refuses,
// recovered opens, fresh available" → DROPPED, generic truth-table re-drive
// of base :50-58 (+ :231-237 5-6 twin gate-arm vocab) (#1117/#1118); old
// it4 threshold-5 mock d6 ladder → DROPPED, base :84-122 owns the ladder
// (:107-112/:171-184 own the nat-5 boundary), disk-only lane never re-
// driven (#1128 precedent VERBATIM); old it5 refusal surface popup+log →
// DROPPED, refusal vocab base :75-81 + .mc-recharge-refusal popup owned by
// MonsterCardModal refusal lanes, slug is builder-interpolated (#1117);
// old it6+it7+it8 save_effect byte/extractor/duration note → merged into
// new it1 (byte authorship) + new it3 (fixed-byte extractor unit, #1119
// KEEP; undefined→[] generic purged citing canonical #1117).
// No state written → no afterEach to clean (#1121 precedent); disk-only
// determinism (#1057); no wall-clock (#app MANDATORY).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';
import { extractConditionDurationNote } from '../../services/encounters/monsterAbilityUses.js';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const db = JSON.parse(RAW);
const YMIR = db.find((m) => m.index === 'ymir');
// lookup by NAME, not index (#1094 brittle-index fix — old actions[3])
const WAVE = YMIR.actions.find((a) => a.name.startsWith('Glacier Wave'));

describe('MA-2059 disk fingerprint: Ymir Glacier Wave two-field fix bytes, save core live-verified exact', () => {
  it('row lock: DC 26 STR, 14d10 Bludgeoning, description verbatim; dc_success + escape_dc + range ABSENT (half-default RAW, no fabricated escape DC, authored Line parsed inline MA-2033); save_effect Restrained byte authored once on the card (centaur-warden byte-twin)', () => {
    expect(YMIR.name).toBe('Ymir');
    expect(WAVE.name).toBe('Glacier Wave (Recharge 5-6)');
    expect(WAVE.save_dc).toBe(26);
    expect(WAVE.save_type).toBe('Strength');
    expect(WAVE.damage_dice_primary).toBe('14d10');
    expect(WAVE.damage_type_primary).toBe('Bludgeoning');
    expect(WAVE.description).toBe('Strength Saving Throw: DC 26, each creature in a 120-foot-long, 10-foot-wide Line. Failure: 77 (14d10) Bludgeoning damage. Success: Half damage. The target is also Restrained until the end of its next turn.');
    expect(WAVE.dc_success).toBeUndefined(); // half-on-success default is RAW-correct ("Success: Half damage") — pin its ABSENCE (#1122, MA-2045/1855 twin)
    expect(WAVE.escape_dc).toBeUndefined(); // RAW states no escape DC — do NOT fabricate (§537: badges ride grapple lane)
    expect(WAVE.range).toBeUndefined(); // authored Line lives in the description (MA-2033 parse, picker opens) — no separate range field authored
    // MA-2059 fix byte #2: the Restrained save_effect (centaur-warden
    // Entangling Trail byte-twin, 2 occurrences on disk, no other test
    // mentions it — owned here); save_effect-exact-once on this card (#1038:
    // Multiattack/Glacier Club/Stomp are hit-axis namesakes #948):
    expect(WAVE.save_effect).toBe('The target has the Restrained condition until the end of its next turn.');
    expect(YMIR.actions.filter((a) => a.save_effect).map((a) => a.name)).toEqual(['Glacier Wave (Recharge 5-6)']);
  });
});

describe('MA-2059 recharge axis: fix byte recharge:"5-6" arms the MA-0031 gate (was ungated name-text, 4 fires live)', () => {
  it('recharge:"5-6" parsed to threshold 5 + ONE-SHOT LIVE-row gate-arm + exact-once on the card + twin-collision raw-split', () => {
    expect(WAVE.recharge).toBe('5-6');
    expect(rechargeUsageOf(WAVE)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(WAVE)).toBe('Glacier Wave');
    // ONE-SHOT LIVE-row gate-arm on THIS row's bytes (#1118 shape VERBATIM):
    // key + threshold + fresh available in one shot
    // (spent/refused/recharged truth-table owned by base :50-58/:231-237, not re-driven — #1117/#1118)
    expect(monsterRechargeGate(WAVE, null)).toEqual({ key: 'Glacier Wave', threshold: 5, available: true });
    // exact-once fix: Glacier Wave is the ONLY recharge-armed action on this
    // card (#1038 dup-map, #948 decoys by name). Under a spent-WAVE map the
    // hit-axis neighbour Stomp (hit_conditions:['prone']) stays ungated null
    // (#1035 guard reaches the branch):
    expect(YMIR.actions.filter((a) => a.recharge).map((a) => a.name)).toEqual(['Glacier Wave (Recharge 5-6)']);
    const stomp = YMIR.actions.find((a) => a.name === 'Stomp');
    expect(monsterRechargeGate(stomp, { 'Glacier Wave': { recharged: false, threshold: 5 } })).toBeNull();
    // recharge never rides the legendary/reaction/trait/lair/bonus lanes —
    // Legendary Resistance/Primordial Flesh/World-Flesh traits own no
    // recharge byte — absence-only pins (#1123 precedent):
    expect(YMIR.legendary_actions.filter((a) => a.recharge)).toEqual([]);
    expect(YMIR.reactions.filter((a) => a.recharge)).toEqual([]);
    expect(YMIR.traits.filter((a) => a.recharge)).toEqual([]);
    expect(YMIR.lair_actions.filter((a) => a.recharge)).toEqual([]);
    expect(YMIR.bonus_actions.filter((a) => a.recharge)).toEqual([]);
    // #1121/#1125R whole-DB raw-split: NOT unique on DC 26 "5-6" alone (pool
    // hits 5 rows — apep/colossus/fenrir/yamata/ymir; raw Strength+DC 26
    // adjacency hits 2 — Fenrir Devour + this row) — the anchor extends
    // through this row's OWN 120-ft-Line description + 14d10 Bludgeoning +
    // recharge fix byte until count=1 (disk-verified).
    expect(RAW.split('"save_type": "Strength",\n        "save_dc": 26,\n        "description": "Strength Saving Throw: DC 26, each creature in a 120-foot-long, 10-foot-wide Line. Failure: 77 (14d10) Bludgeoning damage. Success: Half damage. The target is also Restrained until the end of its next turn.",\n        "damage_dice_primary": "14d10",\n        "damage_type_primary": "Bludgeoning",\n        "recharge": "5-6"').length - 1).toBe(1);
  });
});

describe('MA-2059 Restrained bait closed: extractor consumes the ticket-authored save_effect byte (#1119 fixed-bytes KEEP)', () => {
  it('word-scan yields [restrained] (was [] — no save_effect, display-only prose §567 bait) and the authored until-clause rides the grant-log copy', () => {
    expect(extractConditionsFromSaveEffect(WAVE.save_effect)).toEqual(['restrained']);
    expect(extractConditionDurationNote(WAVE.save_effect)).toBe('until the end of its next turn (GM-enforced)');
    // undefined→[] generic PURGED: owned by MonsterCardModal.conditions-extraction.test.jsx canonical word-scan legs (#1117); picker consumer of the same byte pinned fail/SUCCESS faces on SaveAttackAoeModal.ma2059 — not re-driven here
  });
});
