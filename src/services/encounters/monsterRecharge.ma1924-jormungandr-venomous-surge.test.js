// @maintained-by-ai
// MA-1924 head — recharge ticket lane (family: godzilla #1916 @#1117 template
// VERBATIM → quetzalcoatl #1970 @#1112 → scylla #1978 @#1113 twin byte-shape;
// king-kong thunder-roar #1932 next). Jormungandr siblings by axis: Venom Drip
// hit rider → monsterHitConditions.ma1927 (#1096 CLOSED), Capsize save core →
// monsterLegendarySave.ma1928 (#1100 CLOSED). THIS file owns the save/recharge
// axis of Venomous Surge ONLY — never re-locking theirs.
// Jormungandr "Venomous Surge (Recharge 5-6)": save core live-verified EXACT
// (DC 27 CON, 26d6 Poison, floor-half, shapeless "90 ft." inline degradation
// accepted §211/MA-1920) but the recharge gate never armed — name-text
// "(Recharge 5-6)" parsed by NO parser (MA-1843/1916/0663 breath-twin), two
// full-face fires one fight zero refusal, monsterRecharge key ABSENT.
// One-field DATA fix: recharge:"5-6" rides the live MA-0031 spend/refusal/
// recovery lane (monsterRecharge.js), godzilla twin byte-shape.
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
// Extractor generic vocab (undefined → []): MonsterCardModal.conditions-extraction
// .test.jsx header owns the map. This fix touched NO save_effect bytes, so no
// extractor leg lives here (applied-rec #2: vacuous — nothing to purge).
//
// Applied recs (#1117 family-fold): old it3 "spent refuses, fresh available,
// recovery opens" is the generic spent/fresh/recharged truth-table re-drive →
// DROPPED (base :50-58 + :231-237 5-6 twin gate-arm vocab own it). Fresh leg
// kept as the ONE-SHOT LIVE-row gate-arm toEqual({key,threshold,available}) +
// exact-once guard, #1117 it2 shape VERBATIM. Fix bytes = the recharge field
// ONLY (no save/damage/condition bytes touched — #1113 whole-DB raw-split
// N/A); save core stays byte-unchanged, locked in it1. Disk-only (#1057),
// no wall-clock (#app), no logs emitted here — pure fingerprint.
//
// old→new map (3→2): old :18-26 save core → new it1 (+dc_success ABSENCE
// comment); old :28-32 arming → new it2 (+gate-arm/exact-once/Venom Drip
// decoy); old :34-37 spent/fresh/recovery → DROPPED (base), fresh folded into
// it2 one-shot arm. Row lookup positional actions[3] → name-lookup (#1094).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from './monsterRecharge.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const JORMUNGANDR = monsters.find((m) => m.index === 'jormungandr');
const SURGE = JORMUNGANDR.actions.find((a) => a.name.startsWith('Venomous Surge'));
const VENOM_DRIP = JORMUNGANDR.legendary_actions.find((a) => a.name === 'Venom Drip');

describe('MA-1924 disk fingerprint: Jormungandr Venomous Surge recharge authored', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 27 CON, 26d6 Poison, default half', () => {
    expect(JORMUNGANDR.name).toBe('Jormungandr');
    expect(SURGE.name).toBe('Venomous Surge (Recharge 5-6)');
    expect(SURGE.save_dc).toBe(27);
    expect(SURGE.save_type).toBe('Constitution');
    expect(SURGE.damage_dice_primary).toBe('26d6');
    expect(SURGE.damage_type_primary).toBe('Poison');
    expect(SURGE.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE
  });

  it('recharge:"5-6" arms the MA-0031 gate on the live row (was ungated name-text)', () => {
    expect(SURGE.recharge).toBe('5-6');
    expect(rechargeUsageOf(SURGE)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(SURGE)).toBe('Venomous Surge');
    // gate arm on THIS row's bytes: key + threshold + fresh available in one shot
    // (spent/refused/recharged truth-table owned by base :50-58/:231-237, not re-driven)
    expect(monsterRechargeGate(SURGE, null)).toEqual({ key: 'Venomous Surge', threshold: 5, available: true });
    // exact-once fix: Venomous Surge is the ONLY recharge-armed action; #948
    // decoy-by-name closest confusion is legendary Venom Drip (#1096 owns its
    // hit-axis bytes — only recharge-absence pinned here, save/recharge axis):
    // it stays ungated null under a spent Surge map, alongside the weapon row
    expect(JORMUNGANDR.actions.filter((a) => a.recharge).map((a) => a.name)).toEqual(['Venomous Surge (Recharge 5-6)']);
    expect(VENOM_DRIP.recharge).toBeUndefined();
    expect(monsterRechargeGate(VENOM_DRIP, { 'Venomous Surge': { recharged: false, threshold: 5 } })).toBeNull();
    const bite = JORMUNGANDR.actions.find((a) => a.name === 'Bite');
    expect(monsterRechargeGate(bite, { 'Venomous Surge': { recharged: false, threshold: 5 } })).toBeNull();
  });
});
