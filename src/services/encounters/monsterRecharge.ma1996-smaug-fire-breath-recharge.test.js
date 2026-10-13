// MA-1996: Smaug the Golden "Fire Breath (Recharge 5-6)" save core live-verified
// EXACT (DC 24 DEX, 22d6 Fire, half-on-success RAW-correct default — do NOT
// author dc_success; picker opens via DESCRIPTION prose MA-0618) but the
// recharge gate never armed — name-text "(Recharge 5-6)" parsed by NO parser
// (MA-1948/1978/1987 breath-twin family, 9th instance), ungated multi-fire
// 3 volleys one session with zero refusal, monsterRecharge key ABSENT past
// owner turn-start (`2:Smaug the Golden 1` walk-truth). DATA fix: recharge:
// "5-6" (+range:"90-foot Cone" byte-companion hygiene, identical 90/cone
// semantics) rides the live MA-0031 spend/refusal/recovery lane
// (monsterRecharge.js) — live post-fix: spend AT PICKER-OPEN stamp
// {Fire Breath:{recharged:false,threshold:5}} + fire_breath_refused +
// d6≥5 recovery at owner turn-start + re-live chip re-fires once re-spending.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SMAUG = monsters.find((m) => m.index === 'smaug-the-golden');
const BREATH = SMAUG.actions[4];

describe('MA-1996 disk fingerprint: Smaug Fire Breath recharge authored', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 24 DEX, 22d6 Fire, default half', () => {
    expect(SMAUG.name).toBe('Smaug the Golden');
    expect(BREATH.name).toBe('Fire Breath (Recharge 5-6)');
    expect(BREATH.save_dc).toBe(24);
    expect(BREATH.save_type).toBe('Dexterity');
    expect(BREATH.damage_dice_primary).toBe('22d6');
    expect(BREATH.damage_type_primary).toBe('Fire');
    expect(BREATH.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE
  });

  it('recharge:"5-6" + range:"90-foot Cone" arm the MA-0031 gate (was ungated name-text)', () => {
    expect(BREATH.recharge).toBe('5-6');
    expect(BREATH.range).toBe('90-foot Cone'); // identical to the description-parsed semantics the picker already used (MA-0618)
    expect(rechargeUsageOf(BREATH)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(BREATH)).toBe('Fire Breath');
  });

  it('spent refuses, recovered opens, fresh available', () => {
    expect(monsterRechargeGate(BREATH, { 'Fire Breath': { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(BREATH, { 'Fire Breath': { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(BREATH, {}).available).toBe(true);
  });
});
