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
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SCYLLA = monsters.find((m) => m.index === 'scylla');
const TIDE = SCYLLA.actions[2];

describe('MA-1978 disk fingerprint: Scylla Blood Tide recharge authored', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 25 DEX, 10d10 Piercing, default half', () => {
    expect(SCYLLA.name).toBe('Scylla');
    expect(TIDE.name).toBe('Blood Tide (Recharge 5-6)');
    expect(TIDE.save_dc).toBe(25);
    expect(TIDE.save_type).toBe('Dexterity');
    expect(TIDE.damage_dice_primary).toBe('10d10');
    expect(TIDE.damage_type_primary).toBe('Piercing');
    expect(TIDE.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE
  });

  it('recharge:"5-6" arms the MA-0031 gate (was ungated name-text)', () => {
    expect(TIDE.recharge).toBe('5-6');
    expect(rechargeUsageOf(TIDE)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(TIDE)).toBe('Blood Tide');
  });

  it('spent refuses, fresh available, recovery opens', () => {
    expect(monsterRechargeGate(TIDE, { 'Blood Tide': { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(TIDE, { 'Blood Tide': { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(TIDE, {}).available).toBe(true);
  });
});
