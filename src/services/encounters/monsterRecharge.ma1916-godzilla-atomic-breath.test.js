// MA-1916: Godzilla "Atomic Breath (Recharge 5-6)" save core live-verified
// EXACT (DC 27 DEX, 26d6 Radiant, floor-half, 120-ft Line picker via
// description-token parse) but the recharge gate never armed — name-text
// "(Recharge 5-6)" parsed by NO parser (MA-1843/1859/1898/1907 breath-twin),
// two fires one fight zero refusal. One-field DATA fix: recharge:"5-6" rides
// the live MA-0031 spend/refusal/recovery lane (monsterRecharge.js).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const GODZILLA = monsters.find((m) => m.index === 'godzilla');
const BREATH = GODZILLA.actions.find((a) => a.name.startsWith('Atomic Breath'));
// MA-1920: legendary save child "Nuclear Pulse (Costs 2 Actions)".
const PULSE = GODZILLA.legendary_actions.find((a) => a.name.startsWith('Nuclear Pulse'));

describe('MA-1916 disk fingerprint: Godzilla Atomic Breath recharge authored', () => {
  it('recharge:"5-6" arms the MA-0031 gate (was ungated name-text)', () => {
    expect(BREATH.recharge).toBe('5-6');
    expect(rechargeUsageOf(BREATH)).toEqual({ threshold: 5 });
  });

  it('spent refuses, fresh available, recovery opens', () => {
    expect(monsterRechargeGate(BREATH, { 'Atomic Breath': { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(BREATH, { 'Atomic Breath': { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(BREATH, {}).available).toBe(true);
  });

  it('save core byte-unchanged (live-verified exact): DC 27 DEX, 26d6 Radiant, default half', () => {
    expect(BREATH.save_dc).toBe(27);
    expect(BREATH.save_type).toBe('Dexterity');
    expect(BREATH.damage_dice_primary).toBe('26d6');
    expect(BREATH.damage_type_primary).toBe('Radiant');
    expect(BREATH.dc_success).toBeUndefined();
  });
});

// MA-1920: legendary Nuclear Pulse Poisoned rider was FAIL(b)/DATA — the
// row authored NO save_effect, and the save lane word-scans save_effect ONLY
// (MonsterCardHelpers.js:383; legendary save route MonsterCardModal.jsx:754
// extractConditionsFromSaveEffect(undefined) → []). Live PRE-FIX proof:
// DC 25 CON honest FAIL (total −10), finalDamage 53 applied, zero
// 'condition applied' log entries, activeConditions []. One-field DATA fix:
// save_effect byte-mirrors the row's own description clause (§346 canonical
// word "Poisoned"; Thri-Kreen MA-1584 sibling byte-shape "Failure: …
// for 1 minute."). §37 clock note: canonical-condition save lane grants ride
// the condition channel (MA-1584 shallow band pins addExpiration NOT
// called) — 1-minute expiry is the codified GM-enforced residual.
describe('MA-1920 disk fingerprint: Godzilla Nuclear Pulse save_effect Poisons on failed save', () => {
  it('save_effect authored, byte-mirrors the description rider clause', () => {
    expect(PULSE.name).toBe('Nuclear Pulse (Costs 2 Actions)');
    expect(PULSE.save_effect).toBe('Failure: the target also has the Poisoned condition for 1 minute.');
    expect(PULSE.description).toContain(PULSE.save_effect);
  });

  it('extractConditionsFromSaveEffect → [poisoned] on the legendary save lane', () => {
    expect(extractConditionsFromSaveEffect(PULSE.save_effect)).toEqual(['poisoned']);
    // PRE-FIX regression guard: description-only text never reaches the lane.
    expect(extractConditionsFromSaveEffect(undefined)).toEqual([]);
  });

  it('MA-1867 disarm guard: rider clause carries NO dice + damage pool (DC chip stays clickable)', () => {
    expect(PULSE.save_effect).not.toMatch(/\d+d\d+/);
    expect(String(PULSE.save_effect).toLowerCase()).not.toContain('damage');
    // save core live-verified exact (MA-1920): DC 25 CON, 16d6 Radiant, default half.
    expect(PULSE.save_dc).toBe(25);
    expect(PULSE.save_type).toBe('Constitution');
    expect(PULSE.damage_dice_primary).toBe('16d6');
    expect(PULSE.damage_type_primary).toBe('Radiant');
    expect(PULSE.dc_success).toBeUndefined();
  });
});
