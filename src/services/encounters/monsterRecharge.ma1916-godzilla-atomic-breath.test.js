// @maintained-by-ai
// MA-1916 head — recharge ticket lane (family: jormungandr #1924 → quetzalcoatl
// #1970 @#1112:23-49 → scylla #1978 @#1113:22-36, twin byte-shape this file owns).
// Godzilla "Atomic Breath (Recharge 5-6)": save core live-verified EXACT
// (DC 27 DEX, 26d6 Radiant, floor-half, 120-ft Line via description-token
// parse) but the recharge gate never armed — name-text "(Recharge 5-6)"
// parsed by NO parser (MA-1843/1859/1898/1907 breath-twin), two fires one
// fight zero refusal. One-field DATA fix: recharge:"5-6" rides the live
// MA-0031 lane (monsterRecharge.js). Ticket-distinct scope here = the godzilla
// disk bytes arming the lane; NEVER re-drive generic machinery.
//
// Base-cite table (monsterRecharge.test.js, CANON @#1108 seam-fixture era):
//   key-suffix strip + threshold parse          :42-48  NEVER re-drive
//   fresh/spent/recharged gate truth-table      :50-58  NEVER re-drive
//   ungated rows → null                           :59-62  NEVER re-drive
//   fire-spend stamp + ability_use log            :65-73  NEVER re-drive
//   refusal vocab <slug>_refused (not recharged) :75-81  NEVER re-drive
//   turn-start d6 regain / not-recharged / no-op :84-122 NEVER re-drive
//   5-6 twin gate-arm vocab (apep threshold 5)   :231-237 NEVER re-drive
//   legendary lifecycle vocab → monsterLegendaryUses.test.js cite-table :12-27
//     (refreshed #1116; recharge canon :89-99/:181-191)
// Extractor generic vocab (condition scan, no-match/undefined → []):
//   MonsterCardModal.conditions-extraction.test.jsx header owns the map —
//   NEVER re-drive here; only THIS row's byte → ['poisoned'] output is pinned.
//
// old→new map (6→4): old :20-23 arming → new it2 (+key/gate-arm/exact-once);
// old :25-29 spent/fresh → DROPPED (base :50-58/:231-237 own it);
// old :31-37 save core → new it1 (+name bytes); old :52-56 byte-mirror →
// new MA-1920 it1 (+exact-once); old :58-62 extractor → new it2 (undefined
// leg dropped, canonical cited); old :64-72 disarm+core folded into 1+2.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from './monsterRecharge.js';
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const GODZILLA = monsters.find((m) => m.index === 'godzilla');
const BREATH = GODZILLA.actions.find((a) => a.name.startsWith('Atomic Breath'));
// MA-1920: legendary save child "Nuclear Pulse (Costs 2 Actions)".
const PULSE = GODZILLA.legendary_actions.find((a) => a.name.startsWith('Nuclear Pulse'));

describe('MA-1916 disk fingerprint: Godzilla Atomic Breath recharge authored', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 27 DEX, 26d6 Radiant, default half', () => {
    expect(GODZILLA.name).toBe('Godzilla');
    expect(BREATH.name).toBe('Atomic Breath (Recharge 5-6)');
    expect(BREATH.save_dc).toBe(27);
    expect(BREATH.save_type).toBe('Dexterity');
    expect(BREATH.damage_dice_primary).toBe('26d6');
    expect(BREATH.damage_type_primary).toBe('Radiant');
    expect(BREATH.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE
  });

  it('recharge:"5-6" arms the MA-0031 gate on the live row (was ungated name-text)', () => {
    expect(BREATH.recharge).toBe('5-6');
    expect(rechargeUsageOf(BREATH)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(BREATH)).toBe('Atomic Breath');
    // gate arm on THIS row's bytes: key + threshold + fresh available in one shot
    // (spent/refused/recharged truth-table owned by base :50-58/:231-237, not re-driven)
    expect(monsterRechargeGate(BREATH, null)).toEqual({ key: 'Atomic Breath', threshold: 5, available: true });
    // exact-once fix: Atomic Breath is the ONLY recharge-armed action; confusable
    // siblings (Bite/Claw/Tail/Multiattack — #948 decoy-by-name) stay ungated null
    expect(GODZILLA.actions.filter((a) => a.recharge).map((a) => a.name)).toEqual(['Atomic Breath (Recharge 5-6)']);
    const bite = GODZILLA.actions.find((a) => a.name === 'Bite');
    expect(monsterRechargeGate(bite, { 'Atomic Breath': { recharged: false, threshold: 5 } })).toBeNull();
  });
});

// MA-1920: legendary Nuclear Pulse Poisoned rider was FAIL(b)/DATA — the row
// authored NO save_effect, and the save lane word-scans save_effect ONLY
// (MonsterCardHelpers.js:383; legendary save route MonsterCardModal.jsx:754 →
// extractConditionsFromSaveEffect(undefined) → [], generic leg owned by
// MonsterCardModal.conditions-extraction.test.jsx). Live PRE-FIX proof:
// DC 25 CON honest FAIL (total −10), finalDamage 53 applied, zero
// 'condition applied' log entries, activeConditions []. One-field DATA fix:
// save_effect byte-mirrors the row's own description clause (§346 canonical
// word "Poisoned"; Thri-Kreen MA-1584 sibling byte-shape "Failure: … for
// 1 minute."). §37 clock note: canonical-condition save lane grants ride the
// condition channel (MA-1584 shallow band pins addExpiration NOT called) —
// 1-minute expiry is the codified GM-enforced residual. No timers here (#app).
describe('MA-1920 disk fingerprint: Godzilla Nuclear Pulse save_effect Poisons on failed save', () => {
  it('row identity + save core + rider byte-mirror authored exact-once', () => {
    expect(PULSE.name).toBe('Nuclear Pulse (Costs 2 Actions)');
    // save core live-verified exact: DC 25 CON, 16d6 Radiant, default half
    expect(PULSE.save_dc).toBe(25);
    expect(PULSE.save_type).toBe('Constitution');
    expect(PULSE.damage_dice_primary).toBe('16d6');
    expect(PULSE.damage_type_primary).toBe('Radiant');
    expect(PULSE.dc_success).toBeUndefined();
    // byte-mirror of the row's own description rider clause
    expect(PULSE.save_effect).toBe('Failure: the target also has the Poisoned condition for 1 minute.');
    expect(PULSE.description).toContain(PULSE.save_effect);
    // exact-once fix + lane separation: Pulse is the only save_effect-bearing
    // legendary, and it is cost-based (NOT a d6-recharge row — MA-1916 lane)
    expect(GODZILLA.legendary_actions.filter((a) => a.save_effect != null).map((a) => a.name)).toEqual(['Nuclear Pulse (Costs 2 Actions)']);
    expect(PULSE.recharge).toBeUndefined();
    expect(monsterRechargeGate(PULSE, null)).toBeNull();
  });

  it('extracts [poisoned] on the legendary save lane; rider bytes keep DC chip clickable (MA-1867 disarm guard)', () => {
    // actual extractor output pinned (generic scan/no-match legs cited canonical header)
    expect(extractConditionsFromSaveEffect(PULSE.save_effect)).toEqual(['poisoned']);
    // MA-1867 disarm guard: rider clause carries NO dice + damage vocabulary
    expect(PULSE.save_effect).not.toMatch(/\d+d\d+/);
    expect(PULSE.save_effect.toLowerCase()).not.toContain('damage');
  });
});
