// MA-1940: Ladon "Sleeping Mist (Recharge 5-6)" save core live-verified
// EXACT (DC 23 Constitution, Unconscious on fail, damageless 60-foot Cone
// picker, multi-target selectable) but the recharge gate never armed —
// name-text "(Recharge 5-6)" parsed by NO parser (MA-1916/0663/MA-1924/
// MA-1932 breath-twin family, 5th instance), 3 ungated volleys one session
// zero refusal tokens, monsterRecharge ABSENT whole-store. One-field DATA
// fix: recharge:"5-6" rides the live MA-0031/MA-0488/MA-1924 spend/refusal/
// recovery lane (monsterRecharge.js), MA-1924 byte-shape (after save_dc,
// before description). MA-1939 neighbor guard: actions[2] Constrict
// (escape_dc 22 + grapple_ongoing_damage) byte-undisturbed by this pass.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const LADON = monsters.find((m) => m.index === 'ladon');
const MIST = LADON.actions[3];

describe('MA-1940 disk fingerprint: Ladon Sleeping Mist recharge authored', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 23 CON, condition-only, damageless, default half n/a', () => {
    expect(LADON.name).toBe('Ladon');
    expect(MIST.name).toBe('Sleeping Mist (Recharge 5-6)');
    expect(MIST.save_dc).toBe(23);
    expect(MIST.save_type).toBe('Constitution');
    expect(MIST.damage_dice_primary).toBeUndefined();
    expect(MIST.damage_dice_secondary).toBeUndefined();
    expect(MIST.dc_success).toBeUndefined(); // damageless row — no half pool to leak (§63 N/A, live results copy honest "takes no damage")
    expect(MIST.description).toBe('Constitution Saving Throw: DC 23, each creature in a 60-foot Cone. Failure: the target has the Unconscious condition until the end of its next turn, repeating the saving throw at the end of each of its turns to end the effect early. Success: no effect. No damage.');
  });

  it('recharge:"5-6" arms the MA-0031 gate (was ungated name-text)', () => {
    expect(MIST.recharge).toBe('5-6');
    expect(rechargeUsageOf(MIST)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(MIST)).toBe('Sleeping Mist');
  });

  it('spent refuses, fresh available, recovery opens', () => {
    expect(monsterRechargeGate(MIST, { 'Sleeping Mist': { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(MIST, { 'Sleeping Mist': { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(MIST, {}).available).toBe(true);
  });

  it('save_effect yields [unconscious] only (fail-face condition core intact)', () => {
    expect(extractConditionsFromSaveEffect(MIST.save_effect)).toEqual(['unconscious']);
  });

  it('MA-1939 neighbor guard: Constrict actions[2] byte-undisturbed', () => {
    const constrict = LADON.actions[2];
    expect(constrict.name).toBe('Constrict');
    expect(constrict.escape_dc).toBe(22);
    expect(constrict.grapple_ongoing_damage).toEqual({ dice: '4d8', damage_type: 'Bludgeoning' });
    expect(constrict.recharge).toBeUndefined();
    // Bite actions[1] and Multiattack actions[0] stay recharge-free too
    expect(LADON.actions[0].recharge).toBeUndefined();
    expect(LADON.actions[1].recharge).toBeUndefined();
  });
});
