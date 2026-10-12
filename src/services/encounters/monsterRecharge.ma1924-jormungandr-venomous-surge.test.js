// MA-1924: Jormungandr "Venomous Surge (Recharge 5-6)" save core live-verified
// EXACT (DC 27 CON, 26d6 Poison, floor-half, shapeless "90 ft." inline
// degradation accepted §211/MA-1920) but the recharge gate never armed —
// name-text "(Recharge 5-6)" parsed by NO parser (MA-1916/0663/MA-0031
// breath-twin), two full-face fires one fight zero refusal, monsterRecharge
// key ABSENT. One-field DATA fix: recharge:"5-6" rides the live MA-0031
// spend/refusal/recovery lane (monsterRecharge.js), godzilla twin byte-shape.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const JORMUNGANDR = monsters.find((m) => m.index === 'jormungandr');
const SURGE = JORMUNGANDR.actions[3];

describe('MA-1924 disk fingerprint: Jormungandr Venomous Surge recharge authored', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 27 CON, 26d6 Poison, default half', () => {
    expect(JORMUNGANDR.name).toBe('Jormungandr');
    expect(SURGE.name).toBe('Venomous Surge (Recharge 5-6)');
    expect(SURGE.save_dc).toBe(27);
    expect(SURGE.save_type).toBe('Constitution');
    expect(SURGE.damage_dice_primary).toBe('26d6');
    expect(SURGE.damage_type_primary).toBe('Poison');
    expect(SURGE.dc_success).toBeUndefined();
  });

  it('recharge:"5-6" arms the MA-0031 gate (was ungated name-text)', () => {
    expect(SURGE.recharge).toBe('5-6');
    expect(rechargeUsageOf(SURGE)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(SURGE)).toBe('Venomous Surge');
  });

  it('spent refuses, fresh available, recovery opens', () => {
    expect(monsterRechargeGate(SURGE, { 'Venomous Surge': { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(SURGE, { 'Venomous Surge': { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(SURGE, {}).available).toBe(true);
  });
});
