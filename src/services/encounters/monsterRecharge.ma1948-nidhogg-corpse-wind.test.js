// MA-1948: Nidhogg "Corpse Wind (Recharge 5-6)" save core live-verified
// EXACT (DC 24 CON, 12d10 Necrotic, floor-half success face 62→31 via PC
// prompt; shapeless "within 60 ft." inline degradation adjudicated separately
// — not this ticket) but the recharge gate never armed — name-text
// "(Recharge 5-6)" parsed by NO parser (MA-1916/0663/1924 breath-twin
// family), ungated double-fire zero refusal, monsterRecharge key ABSENT past
// owner turn-start. One-field DATA fix: recharge:"5-6" rides the live MA-0031
// spend/refusal/recovery lane (monsterRecharge.js) — live post-fix: spend
// stamp {Corpse Wind:{recharged:false,threshold:5}} + corpse_wind_refused +
// d6:5 recovery at owner turn-start + re-live chip re-fires once re-spending.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const NIDHOGG = monsters.find((m) => m.index === 'nidhogg');
const WIND = NIDHOGG.actions[3];

describe('MA-1948 disk fingerprint: Nidhogg Corpse Wind recharge authored', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 24 CON, 12d10 Necrotic, default half', () => {
    expect(NIDHOGG.name).toBe('Nidhogg');
    expect(WIND.name).toBe('Corpse Wind (Recharge 5-6)');
    expect(WIND.save_dc).toBe(24);
    expect(WIND.save_type).toBe('Constitution');
    expect(WIND.damage_dice_primary).toBe('12d10');
    expect(WIND.damage_type_primary).toBe('Necrotic');
    expect(WIND.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE
  });

  it('recharge:"5-6" arms the MA-0031 gate (was ungated name-text)', () => {
    expect(WIND.recharge).toBe('5-6');
    expect(rechargeUsageOf(WIND)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(WIND)).toBe('Corpse Wind');
  });

  it('spent refuses, fresh available, recovery opens', () => {
    expect(monsterRechargeGate(WIND, { 'Corpse Wind': { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(WIND, { 'Corpse Wind': { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(WIND, {}).available).toBe(true);
  });
});
