// MA-1916: Godzilla "Atomic Breath (Recharge 5-6)" save core live-verified
// EXACT (DC 27 DEX, 26d6 Radiant, floor-half, 120-ft Line picker via
// description-token parse) but the recharge gate never armed — name-text
// "(Recharge 5-6)" parsed by NO parser (MA-1843/1859/1898/1907 breath-twin),
// two fires one fight zero refusal. One-field DATA fix: recharge:"5-6" rides
// the live MA-0031 spend/refusal/recovery lane (monsterRecharge.js).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const GODZILLA = monsters.find((m) => m.index === 'godzilla');
const BREATH = GODZILLA.actions.find((a) => a.name.startsWith('Atomic Breath'));

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
