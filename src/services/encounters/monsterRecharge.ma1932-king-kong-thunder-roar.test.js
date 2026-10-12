// MA-1932: King Kong "Thunder Roar (Recharge 5-6)" save core live-verified
// EXACT (DC 23 Wisdom, Frightened-until-end-of-next-turn on fail, nothing on
// success, no damage dice) but the recharge gate never armed — name-text
// "(Recharge 5-6)" parsed by NO parser (MA-1916/0663/MA-1924 breath-twin
// family), two ungated fires one fight zero refusal, monsterRecharge ABSENT.
// Fix: one-field recharge:"5-6" rides the live MA-0031/MA-0488/MA-1924
// spend/refusal/recovery lane (monsterRecharge.js). Secondary cosmetic fix:
// save_effect contradicted the description ("Success: half damage" vs "Success:
// no effect. No damage.") — zero damage dice authored, so the half-claim was
// mechanically inert; corrected to no-effect wording + dc_success:"none" per
// MA-1928/§530 condition-only-row convention so no fake "takes half damage"
// copy surfaces.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const KING_KONG = monsters.find((m) => m.index === 'king-kong');
const ROAR = KING_KONG.actions[3];

describe('MA-1932 disk fingerprint: King Kong Thunder Roar recharge authored + save_effect contradiction fixed', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 23 Wisdom, condition-only, no damage dice', () => {
    expect(KING_KONG.name).toBe('King Kong');
    expect(ROAR.name).toBe('Thunder Roar (Recharge 5-6)');
    expect(ROAR.save_dc).toBe(23);
    expect(ROAR.save_type).toBe('Wisdom');
    expect(ROAR.damage_dice_primary).toBeUndefined();
    expect(ROAR.damage_dice_secondary).toBeUndefined();
    expect(ROAR.description).toBe("Wisdom Saving Throw: DC 23, each creature within 60 ft. that can hear Kong. Failure: the target has the Frightened condition until the end of its next turn. Success: no effect. No damage.");
  });

  it('recharge:"5-6" arms the MA-0031 gate (was ungated name-text)', () => {
    expect(ROAR.recharge).toBe('5-6');
    expect(rechargeUsageOf(ROAR)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(ROAR)).toBe('Thunder Roar');
  });

  it('spent refuses, fresh available, recovery opens', () => {
    expect(monsterRechargeGate(ROAR, { 'Thunder Roar': { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(ROAR, { 'Thunder Roar': { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(ROAR, {}).available).toBe(true);
  });

  it('save_effect yields [frightened], drops the fake half-damage clause, states success = no effect', () => {
    expect(extractConditionsFromSaveEffect(ROAR.save_effect)).toEqual(['frightened']);
    expect(ROAR.save_effect).not.toMatch(/half damage/i);
    expect(ROAR.save_effect).toBe('Failure: the target has the Frightened condition until the end of its next turn. Success: no effect.');
  });

  it("dc_success:'none' authored — no half-default copy can surface on a zero-damage row (MA-1928/§530 convention)", () => {
    expect(ROAR.dc_success).toBe('none');
    // MA-1931 twin actions[2] (Grab) byte-undisturbed by this pass.
    const grab = KING_KONG.actions[2];
    expect(grab.name).toBe('Grab');
    expect(grab.save_dc).toBe(25);
    expect(grab.escape_dc).toBe(25);
    expect(grab.recharge).toBeUndefined();
  });
});
