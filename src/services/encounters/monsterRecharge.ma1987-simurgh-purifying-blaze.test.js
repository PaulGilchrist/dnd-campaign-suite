// MA-1987: Simurgh "Purifying Blaze (Recharge 5-6)" save core live-verified
// EXACT (DC 24 DEX, 12d10 Radiant, half-on-success RAW-correct default —
// do NOT author dc_success) incl. live multi-target picker (60-foot Cone parses
// → SaveAttackAoeModal, per-victim adjudication 2/2 Bandits, FeyRanger half
// face via PC prompt) but the recharge gate never armed — name-text
// "(Recharge 5-6)" parsed by NO parser (MA-1948/1978/1916/0663 breath-twin
// family), ungated multi-fire zero refusal (3 volleys one session),
// monsterRecharge key ABSENT past owner turn-start (`2:Simurgh 1`).
// One-field DATA fix: recharge:"5-6" rides the live MA-0031 spend/refusal/
// recovery lane (monsterRecharge.js) — live post-fix: spend AT PICKER-OPEN
// stamp {Purifying Blaze:{recharged:false,threshold:5}} + purifying_blaze_refused
// + d6≥5 recovery at owner turn-start + re-live chip re-fires once re-spending.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SIMURGH = monsters.find((m) => m.index === 'simurgh');
const BLAZE = SIMURGH.actions[3];

describe('MA-1987 disk fingerprint: Simurgh Purifying Blaze recharge authored', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 24 DEX, 12d10 Radiant, default half', () => {
    expect(SIMURGH.name).toBe('Simurgh');
    expect(BLAZE.name).toBe('Purifying Blaze (Recharge 5-6)');
    expect(BLAZE.save_dc).toBe(24);
    expect(BLAZE.save_type).toBe('Dexterity');
    expect(BLAZE.damage_dice_primary).toBe('12d10');
    expect(BLAZE.damage_type_primary).toBe('Radiant');
    expect(BLAZE.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE
  });

  it('recharge:"5-6" arms the MA-0031 gate (was ungated name-text)', () => {
    expect(BLAZE.recharge).toBe('5-6');
    expect(rechargeUsageOf(BLAZE)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(BLAZE)).toBe('Purifying Blaze');
  });

  it('spent refuses, fresh available, recovery opens', () => {
    expect(monsterRechargeGate(BLAZE, { 'Purifying Blaze': { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(BLAZE, { 'Purifying Blaze': { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(BLAZE, {}).available).toBe(true);
  });
});
