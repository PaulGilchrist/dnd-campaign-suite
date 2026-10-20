// @maintained-by-ai
// MA-2017: Thunderbird "Thunderstrike (Recharge 5-6)" — fingerprint #1 recharge
// name-text trap (MA-0663/1916/1924/1948/1987/1996 family): row authored with
// recharge ONLY in the name, no flat recharge field → rechargeUsageOf null →
// monsterRechargeGate null → ungated unlimited refires (live: 3 fires across
// rounds, monsterRecharge absent, zero recharge-type logs). Save core was
// live-verified exact BEFORE the fix (DC 24 DEX, 66/12d10 Lightning, half-on-
// success RAW-correct default via the INLINE auto-roll lane — shapeless "each
// creature within 60 ft" never opens the picker, MA-0701/§211; do NOT author
// dc_success). One-field DATA fix: recharge:"5-6" rides the live MA-0031
// spend/refusal/recovery lane (monsterRecharge.js) — inline rows spend at roll
// resolution (MonsterCardHelpers gate), spent chip, thunderstrike_refused
// popup+log with zero roll, d6≥5 recovery at owner turn-start. No range field:
// twin shapeless-inline row Nidhogg Corpse Wind (MA-1948) authors recharge-only,
// byte-identical shape (adding range risks the picker flipping the lane —
// §211 single-victim inline fold stays).
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
// #1038 dup-map — Thunderbird lanes and their owners (absence-only here,
// never re-driven): Thunderstrike recharge axis OWNED here (canonical
// fingerprint); Updraft advisory → monsterActionAdvisory.ma2018 CLOSED #1088
// (its ticket-decoys — Thunderstrike save-chip §128 + spell_reflection — are
// OWNED THERE; this lane never locks advisory bytes); Storm Call legendary
// delegate → saveProcessing.ma2022; Wing Clap legendary save →
// saveProcessing.ma2021; roster sweep → monsterEpicCohort.test.js :34;
// dice-roll engine → diceRoller (#1072), 12d10 math never re-derived.
// Extractors (#1119): MA-2017 fixed ONLY recharge:"5-6" — the row has NO
// save_effect bytes → no extractor leg here; undefined→[] generics owned by
// MonsterCardModal.conditions-extraction.test.jsx canonical, purged
// family-wide (#1117). The ticket-fixed byte stays KEEP-live through
// production usageOf/key/gate.
// #948 decoys by NAME distinct from family sets: trait-namesakes "Wings of
// Thunder"/"Sky Caller", action-namesake Wing (attack vs legendary) —
// absence-only pins (#1123 precedent).
// #1121/#1125R twin-collision check VERIFIED: DC 24 + recharge "5-6" is NOT
// unique (9-row twin pool: ancient-gold/red/silver-dragon Fire/Cold Breath,
// Ziz Solar Flare #1121, Simurgh Purifying Blaze #1124, Garmr, Nidhogg
// Corpse Wind — a shapeless CON/necrotic 66-(12d10)-within-60ft near-twin —
// Thunderbird, Smaug #1996) — the raw-split anchor therefore extends through
// this card's OWN Dexterity/Lightning save+damage description bytes to the
// damage-type byte until count=1 (disk-verified).
//
// old→new map (3→2): old it1 save core → new it1 (+name-lookup #1094,
// verbatim description ground truth #993/#1086, dc_success ABSENCE honest
// half-default pin #1122/#1123, range ABSENCE = one-field fix §211
// ticket-distinct vs Smaug's two-byte fix); old it2 arming → new it2
// (+ONE-SHOT LIVE-row gate-arm toEqual({key,threshold,available:true})
// #1118 shape / exact-once recharge filter dup-map #1038 / Beak+Wing
// gate-null decoys #1035 guard reaches the branch / legendary+reaction+trait
// +lair absence-only #1123 precedent); old it3 "spent refuses, recovered
// opens, fresh available" → DROPPED, generic truth-table re-drive of base
// :50-58 (+ :231-237 5-6 twin gate-arm vocab) (#1117/#1118).
// No state written → no afterEach to clean (#1121 precedent); no wall-clock
// (#app MANDATORY).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const db = JSON.parse(RAW);
const THUNDERBIRD = db.find((m) => m.index === 'thunderbird');
// lookup by NAME, not index (#1094 brittle-index fix)
const STRIKE = THUNDERBIRD.actions.find((a) => a.name.startsWith('Thunderstrike'));

describe('MA-2017 disk fingerprint: Thunderbird Thunderstrike recharge authored', () => {
  it('real-row lock: save core byte-unchanged (live-verified exact) — DC 24 DEX, 66 (12d10) Lightning, description verbatim, dc_success + range ABSENT (inline auto-roll lane, half-default RAW-correct)', () => {
    expect(THUNDERBIRD.name).toBe('Thunderbird');
    expect(STRIKE.name).toBe('Thunderstrike (Recharge 5-6)');
    expect(STRIKE.save_dc).toBe(24);
    expect(STRIKE.save_type).toBe('Dexterity');
    expect(STRIKE.damage_dice_primary).toBe('12d10');
    expect(STRIKE.damage_type_primary).toBe('Lightning');
    expect(STRIKE.description).toBe('Dexterity Saving Throw: DC 24, each creature within 60 ft. Failure: 66 (12d10) Lightning damage. Success: Half damage.');
    expect(STRIKE.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE
    expect(STRIKE.range).toBeUndefined(); // one-field fix: twin shapeless-inline row MA-1948 authors no range — picker must never open (§211)
  });

  it('fix byte recharge:"5-6" arms the MA-0031 gate on the live row, exact-once within actions (was ungated name-text)', () => {
    expect(STRIKE.recharge).toBe('5-6');
    expect(rechargeUsageOf(STRIKE)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(STRIKE)).toBe('Thunderstrike');
    // ONE-SHOT LIVE-row gate-arm on THIS row's bytes (#1118 shape VERBATIM):
    // key + threshold + fresh available in one shot
    // (spent/refused/recharged truth-table owned by base :50-58/:231-237, not re-driven — #1117/#1118)
    expect(monsterRechargeGate(STRIKE, null)).toEqual({ key: 'Thunderstrike', threshold: 5, available: true });
    // exact-once fix: Thunderstrike is the ONLY recharge-armed action on this
    // card (#1038 dup-map, #948 decoys by name). Under a spent-STRIKE map the
    // hit-axis neighbours stay ungated null (#1035 guard reaches the branch):
    expect(THUNDERBIRD.actions.filter((a) => a.recharge).map((a) => a.name)).toEqual(['Thunderstrike (Recharge 5-6)']);
    const beak = THUNDERBIRD.actions.find((a) => a.name === 'Beak');
    const wing = THUNDERBIRD.actions.find((a) => a.name === 'Wing');
    expect(monsterRechargeGate(beak, { Thunderstrike: { recharged: false, threshold: 5 } })).toBeNull();
    expect(monsterRechargeGate(wing, { Thunderstrike: { recharged: false, threshold: 5 } })).toBeNull();
    // recharge never rides the legendary/reaction/trait/lair lanes — Storm Call
    // is saveProcessing.ma2022-owned, Wing Clap ma2021-owned, and Updraft's
    // advisory bytes are monsterActionAdvisory.ma2018-owned (#1088, never
    // re-driven here); Wing-namesake + Wings of Thunder/Sky Caller traits and
    // the empty lair are absence-only pins (#948, #1123 precedent):
    expect(THUNDERBIRD.legendary_actions.filter((a) => a.recharge)).toEqual([]);
    expect(THUNDERBIRD.reactions.filter((a) => a.recharge)).toEqual([]);
    expect(THUNDERBIRD.traits.filter((a) => a.recharge)).toEqual([]);
    expect(THUNDERBIRD.lair_actions.filter((a) => a.recharge)).toEqual([]);
    // #1121/#1125R whole-DB raw-split: NOT unique on DC 24 "5-6" alone (9-row
    // twin pool incl. Nidhogg — a shapeless CON/necrotic within-60ft near-twin
    // sharing the save/recharge bytes) — the anchor extends through this card's
    // own Dexterity/Lightning save+damage bytes until count=1 (disk-verified).
    expect(RAW.split('"save_dc": 24,\n        "recharge": "5-6",\n        "description": "Dexterity Saving Throw: DC 24, each creature within 60 ft. Failure: 66 (12d10) Lightning damage. Success: Half damage.",\n        "damage_dice_primary": "12d10",\n        "damage_type_primary": "Lightning"').length - 1).toBe(1);
  });
});
