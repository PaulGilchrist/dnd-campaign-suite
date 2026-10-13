// MA-2017: Thunderbird "Thunderstrike (Recharge 5-6)" — fingerprint #1 recharge
// name-text trap (MA-0663/1916/1924/1948/1987/1996 family): row authored with
// recharge ONLY in the name, no flat recharge field → rechargeUsageOf null →
// monsterRechargeGate null → ungated unlimited refires (live: 3 fires across
// rounds, monsterRecharge absent, zero recharge-type logs). Save core was
// live-verified exact BEFORE the fix (DC 24 DEX, 66/12d10 Lightning, half-on-
// success RAW-correct default via the INLINE auto-roll lane — shapeless "each
// creature within 60 ft" never opens the picker, MA-0701/§211; do NOT author
// dc_success). DATA fix: recharge:"5-6" rides the live MA-0031 spend/refusal/
// recovery lane (monsterRecharge.js) — inline rows spend at roll resolution
// (MonsterCardHelpers gate), spent chip, thunderstrike_refused popup+log with
// zero roll, d6≥5 recovery at owner turn-start. No range field: twin
// shapeless-inline rows Nidhogg Corpse Wind (MA-1948) + Simurgh Purifying
// Blaze (MA-1987) author recharge-only, byte-identical (adding range risks the
// picker flipping the lane — §211 single-victim inline fold stays).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const db = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const THUNDERBIRD = db.find((m) => m.index === 'thunderbird');
const STRIKE = THUNDERBIRD.actions[3];

describe('MA-2017 disk fingerprint: Thunderbird Thunderstrike recharge authored', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 24 DEX, 12d10 Lightning, default half', () => {
    expect(THUNDERBIRD.name).toBe('Thunderbird');
    expect(STRIKE.name).toBe('Thunderstrike (Recharge 5-6)');
    expect(STRIKE.save_dc).toBe(24);
    expect(STRIKE.save_type).toBe('Dexterity');
    expect(STRIKE.damage_dice_primary).toBe('12d10');
    expect(STRIKE.damage_type_primary).toBe('Lightning');
    expect(STRIKE.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE
    expect(STRIKE.range).toBeUndefined(); // one-field fix: twin shapeless-inline rows (MA-1948/1987) author no range — picker must never open (§211)
  });

  it('recharge:"5-6" arms the MA-0031 gate (was ungated name-text)', () => {
    expect(STRIKE.recharge).toBe('5-6');
    expect(rechargeUsageOf(STRIKE)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(STRIKE)).toBe('Thunderstrike');
  });

  it('spent refuses, recovered opens, fresh available', () => {
    expect(monsterRechargeGate(STRIKE, { Thunderstrike: { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(STRIKE, { Thunderstrike: { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(STRIKE, {}).available).toBe(true);
  });
});
