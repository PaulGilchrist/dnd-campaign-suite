// @maintained-by-ai
// MA-2067: Ziz "Solar Flare (Recharge 5-6)" — fingerprint #13 recharge
// name-text trap (MA-0663/1916/1924/1948/1987/1996/2017/2041/2051/2059
// family): row authored with recharge ONLY in the name, no flat recharge
// field → rechargeUsageOf null → monsterRechargeGate null → ungated
// unlimited refires (live: 2 fires same-boundary, monsterRecharge absent,
// zero refusal/refused/recovery logs). ONE-field DATA fix: recharge:"5-6"
// (after save_dc, before description — MA-1924/1948 twin byte-shape) rides
// the live MA-0031 spend/refusal/recovery lane (monsterRecharge.js) — inline
// rows spend at roll resolution, spent chip, solar_flare_refused popup+log
// with zero roll, d6≥5 recovery at owner turn-start (seam-based, NEVER wall-
// clock #app). Save core live-verified exact BEFORE the fix: DC 24 Consti-
// tution auto-roll, 9d10 Radiant, half-on-success RAW default via the INLINE
// auto-roll lane — shapeless "each creature within 60 ft" with no Cone/Line/
// Sphere noun never opens the picker (MA-0701/§211), so unlike the range-
// companion twins (MA-1996) this fix deliberately authors NO range byte and
// NO dc_success — both ABSENCE pins KEEP (fixed-scope honesty #1119/#1122).
// twin shapeless-inline rows preserved (MA-2017/2041/2051).
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
//   lanes — slug builder-interpolated, never re-driven here (#1117)
//
// #1038 dup-map — Ziz lanes and their owners (absence-only here, never
// re-driven): Solar Flare recharge axis OWNED here (canonical fingerprint
// row pin); Wing Shield reaction advisory axis →
// monsterActionAdvisory.ma2068-ziz-wing-shield (CLOSED #1089 — reaction axis
// owns Wing Shield there, absence-only here); Sky Screech save lane →
// saveProcessing.ma2072-ziz-sky-screech; Blinding Ascent self-buff →
// monsterSelfBuff.ma2071-ziz-blinding-ascent; roster sweep →
// monsterEpicCohort.test.js; extractor word-scan generics →
// MonsterCardModal.conditions-extraction.test.jsx canonical (#1117);
// dice-roll engine → diceRoller (#1072), 49 (9d10) math never re-derived.
// Multiattack/Beak/Wing are hit-axis namesakes (#948 decoys by NAME) —
// gate-null under spent map honest (#1035 guard reaches the branch).
// Extractors (#1119 scope read): MA-2067 fixed NO save_effect bytes (row has
// none — half-default lives in description prose) → no extractor leg here;
// undefined→[] generic PURGED, owned by the canonical conditions-extraction
// lane; the ticket's FIXED recharge byte + honest absent companion bytes
// KEEP through production usageOf/key/gate.
// #1121 twin-collision check VERIFIED (disk): Ziz Solar Flare shares save
// bytes with Nidhogg Corpse Wind (#1121, its OWN recharge bytes owned there,
// never re-locked here — a not-Ziz namesake absence-only) and sits in the
// 9-row DC 24 + "5-6" pool @ma1996 header (ancient-gold/red/silver dragons,
// garmr, nidhogg, simurgh, smaug, thunderbird, ziz); raw adjacency
// "save_dc":24+"recharge":"5-6" hits 5 rows — the anchor therefore extends
// through THIS row's OWN 49 (9d10) Radiant description bytes until count=1
// (disk-verified).
//
// old→new map (4→2): old it1 save core → new it1 (+name-lookup #1094
// replacing brittle actions[3], verbatim description ground truth #993/#1086,
// dc_success ABSENCE honest half-default pin #1122, range ABSENCE §211
// shapeless-inline pin); old it2 arming → new it2 (+ONE-SHOT LIVE-row gate-
// arm toEqual({key,threshold,available:true}) #1118 shape / exact-once card
// filter #1038 / Beak+Wing gate-null decoys #1035 / Wing-Shield+legendary+
// trait absence-only #1089/#1123 precedent / whole-DB raw-split exact-once);
// old it3 "spent refuses, recovered opens, fresh available" → DROPPED,
// generic gate truth-table re-drive of base :50-58 (+ :231-237 5-6 twin
// gate-arm vocab) (#1117 family-fold / #1118, fresh leg folded into the
// one-shot arm); old it4 threshold-5 mock d6 ladder → DROPPED, base :84-122
// owns the ladder (:107-112/:171-184 own the nat-5 boundary), disk-only lane
// never re-driven (#1128 precedent VERBATIM).
// No state written → no afterEach to clean (#1121 precedent); disk-only
// determinism (#1057); no wall-clock (#app MANDATORY).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const RAW = readFileSync('public/data/monsters.json', 'utf8');
const db = JSON.parse(RAW);
const ZIZ = db.find((m) => m.index === 'ziz');
// lookup by NAME, not index (#1094 brittle-index fix — old actions[3])
const FLARE = ZIZ.actions.find((a) => a.name.startsWith('Solar Flare'));

describe('MA-2067 disk fingerprint: Ziz Solar Flare recharge authored', () => {
  it('row lock: save core byte-unchanged (live-verified exact) — DC 24 CON, 9d10 Radiant, description verbatim; dc_success + range ABSENT (explicit "Half damage" clause makes the app half-default RAW-correct #1122; shapeless 60-ft radius rides the inline auto-roll lane, picker must never open §211)', () => {
    expect(ZIZ.name).toBe('Ziz');
    expect(FLARE.name).toBe('Solar Flare (Recharge 5-6)');
    expect(FLARE.save_dc).toBe(24);
    expect(FLARE.save_type).toBe('Constitution');
    expect(FLARE.damage_dice_primary).toBe('9d10');
    expect(FLARE.damage_type_primary).toBe('Radiant');
    expect(FLARE.description).toBe('Constitution Saving Throw: DC 24, each creature within 60 ft. Failure: 49 (9d10) Radiant damage. Success: Half damage.');
    expect(FLARE.dc_success).toBeUndefined(); // half-on-success default is RAW-correct ("Success: Half damage") — pin its ABSENCE (#1122)
    expect(FLARE.range).toBeUndefined(); // one-field fix: shapeless-inline lane preserved (MA-2017/2041/2051 twins) — no range byte authored (§211)
  });

  it('fix byte recharge:"5-6" arms the MA-0031 gate on the live row (was ungated name-text): ONE-SHOT gate-arm + exact-once on the card + twin-collision raw-split', () => {
    expect(FLARE.recharge).toBe('5-6');
    expect(rechargeUsageOf(FLARE)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(FLARE)).toBe('Solar Flare');
    // ONE-SHOT LIVE-row gate-arm on THIS row's bytes (#1118 shape VERBATIM):
    // key + threshold + fresh available in one shot
    // (spent/refused/recharged truth-table owned by base :50-58/:231-237, not re-driven — #1117)
    expect(monsterRechargeGate(FLARE, null)).toEqual({ key: 'Solar Flare', threshold: 5, available: true });
    // exact-once fix: Solar Flare is the ONLY recharge-armed action on this
    // card (#1038 dup-map, #948 decoys by name). Under a spent-FLARE map the
    // hit-axis neighbours Beak/Wing stay ungated null (#1035 guard reaches
    // the branch):
    expect(ZIZ.actions.filter((a) => a.recharge).map((a) => a.name)).toEqual(['Solar Flare (Recharge 5-6)']);
    const beak = ZIZ.actions.find((a) => a.name === 'Beak');
    const wing = ZIZ.actions.find((a) => a.name === 'Wing');
    expect(monsterRechargeGate(beak, { 'Solar Flare': { recharged: false, threshold: 5 } })).toBeNull();
    expect(monsterRechargeGate(wing, { 'Solar Flare': { recharged: false, threshold: 5 } })).toBeNull();
    // recharge never rides the reaction/legendary/trait lanes — Wing Shield
    // advisory axis owned by monsterActionAdvisory.ma2068-ziz-wing-shield
    // (CLOSED #1089), legendary Wing/Sky Screech and Sun Shield/Protector
    // traits own no recharge byte — absence-only pins (#1123 precedent):
    expect(ZIZ.reactions.filter((a) => a.recharge)).toEqual([]);
    expect(ZIZ.legendary_actions.filter((a) => a.recharge)).toEqual([]);
    expect(ZIZ.traits.filter((a) => a.recharge)).toEqual([]);
    // #1121 whole-DB raw-split: NOT unique on DC 24 "5-6" alone (9-row pool
    // @ma1996 header; raw save_dc 24 + "5-6" adjacency hits 5 — nidhogg
    // Corpse Wind shares this description prefix as twin decoy, its own
    // recharge bytes owned there #1121) — the anchor extends through THIS
    // row's OWN 49 (9d10) Radiant description bytes up to the recharge fix
    // byte until count=1 (disk-verified).
    expect(RAW.split('"save_dc": 24,\n        "recharge": "5-6",\n        "description": "Constitution Saving Throw: DC 24, each creature within 60 ft. Failure: 49 (9d10) Radiant damage. Success: Half damage."').length - 1).toBe(1);
  });
});
