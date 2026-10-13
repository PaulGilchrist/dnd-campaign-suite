// MA-2041: Typhon "Storm Breach (Recharge 5-6)" — fingerprint #10 recharge
// name-text trap (MA-0663/1916/1924/1948/1987/1996/2017 family): row authored
// with recharge ONLY in the name, no flat recharge field → rechargeUsageOf
// null (monsterRecharge.js:37) → monsterRechargeGate null → ungated unlimited
// refires (live: 4 fires same-turn + past owner-turn-start, monsterRecharge
// absent, zero refusal/refused/recovery logs). Save core was live-verified
// exact BEFORE the fix (DC 27 Strength, 91/26d6 Bludgeoning, half-on-success
// engine default via the INLINE auto-roll lane — shapeless "within 120 ft"
// with no Cone/Line/Sphere noun never opens the picker, MA-0701/§211 NEW
// PIN: prose-parse needs a shape WORD, MA-2033 correction does NOT apply; do
// NOT author dc_success/range). DATA fix: recharge:"5-6" after save_dc rides
// the live MA-0031 spend/refusal/recovery lane (monsterRecharge.js) — inline
// rows spend at roll resolution, spent chip, storm_breach_refused popup+log
// with zero roll, d6≥5 recovery at owner turn-start.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';

const db = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TYPHON = db.find((m) => m.index === 'typhon');
const BREACH = TYPHON.actions[3];

describe('MA-2041 disk fingerprint: Typhon Storm Breach recharge authored', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 27 STR, 26d6 Bludgeoning, default half', () => {
    expect(TYPHON.name).toBe('Typhon');
    expect(BREACH.name).toBe('Storm Breach (Recharge 5-6)');
    expect(BREACH.save_dc).toBe(27);
    expect(BREACH.save_type).toBe('Strength');
    expect(BREACH.damage_dice_primary).toBe('26d6');
    expect(BREACH.damage_type_primary).toBe('Bludgeoning');
    expect(BREACH.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE
    expect(BREACH.range).toBeUndefined(); // one-field fix: shapeless-inline lane preserved (MA-2017 twin) — picker must never open (§211)
  });

  it('recharge:"5-6" arms the MA-0031 gate (was ungated name-text)', () => {
    expect(BREACH.recharge).toBe('5-6');
    expect(rechargeUsageOf(BREACH)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(BREACH)).toBe('Storm Breach');
  });

  it('spent refuses, recovered opens, fresh available', () => {
    expect(monsterRechargeGate(BREACH, { 'Storm Breach': { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(BREACH, { 'Storm Breach': { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(BREACH, {}).available).toBe(true);
  });
});
