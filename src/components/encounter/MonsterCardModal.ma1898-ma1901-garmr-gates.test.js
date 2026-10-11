// MA-1898 + MA-1901: Garmr DATA fingerprints.
// MA-1898 "Corpse-Fire Breath (Recharge 5-6)" (actions, aoe-save): core
// cone/save/full-half math live-verified EXACT but the recharge gate never
// armed — name-text "(Recharge 5-6)" parsed by NO parser (MA-0663/1843/1859
// fingerprint), two fires one fight zero refusal. One-field fix: recharge
// "5-6" rides the live MA-0031 spend/refusal/recovery lane.
// MA-1901 "Knockdown Howl" (legendary_actions, save): DC 23 STR + 2d8
// Thunder exact, but fail applied NO Prone — save lane word-scans
// save_effect ONLY (§52/§180/§346); authored hit_conditions:["prone"] is
// attack-lane-only bait (§153, handlePlainDamage) structurally inert here.
// One-field fix: save_effect carrying canonical Prone word (MA-1894 Fenrir
// Winter's Howl / MA-1884 Dracolich twin). dc_success ABSENT = default half
// RAW-correct. Prone stands with an action — GM-enforced, no clock (by
// design, same as row 1902 dragon push twin).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractConditionsFromSaveEffect, buildHitConditionClause } from './MonsterCardHelpers.js';
import { rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';
import { legendaryActionCost } from '../../services/encounters/monsterLegendaryUses.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const GARMR = monsters.find((m) => m.index === 'garmr');
const BREATH = GARMR.actions.find((a) => a.name.startsWith('Corpse-Fire Breath'));
const HOWL = GARMR.legendary_actions[2];

describe('MA-1898 disk fingerprint: Corpse-Fire Breath recharge authored', () => {
  it('recharge:"5-6" arms the MA-0031 gate (was ungated name-text)', () => {
    expect(BREATH.recharge).toBe('5-6');
    expect(rechargeUsageOf(BREATH)).toEqual({ threshold: 5 });
  });

  it('spent refuses, fresh available, recovery opens', () => {
    const spent = monsterRechargeGate(BREATH, { 'Corpse-Fire Breath': { recharged: false, threshold: 5 } });
    expect(spent.available).toBe(false);
    expect(monsterRechargeGate(BREATH, { 'Corpse-Fire Breath': { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(BREATH, {}).available).toBe(true);
  });

  it('save core byte-unchanged (live-verified exact): DC 24 DEX, 12d10 Necrotic, half', () => {
    expect(BREATH.save_dc).toBe(24);
    expect(BREATH.save_type).toBe('Dexterity');
    expect(BREATH.damage_dice_primary).toBe('12d10');
    expect(BREATH.damage_type_primary).toBe('Necrotic');
    expect(BREATH.dc_success).toBeUndefined(); // engine default half = RAW
  });
});

describe('MA-1901 disk fingerprint: Knockdown Howl Prone payload authored', () => {
  it('save_effect carries canonical Prone — word-scan now yields prone', () => {
    expect(HOWL.name).toBe('Knockdown Howl');
    expect(HOWL.save_effect).toBe('Failure: The target is knocked Prone and takes 9 (2d8) Thunder damage. Success: half damage and not Prone.');
    expect(extractConditionsFromSaveEffect(HOWL.save_effect)).toEqual(['prone']);
  });

  it('save core byte-unchanged (live-verified exact): DC 23 STR, 2d8 Thunder, default half', () => {
    expect(HOWL.save_dc).toBe(23);
    expect(HOWL.save_type).toBe('Strength');
    expect(HOWL.damage_dice_primary).toBe('2d8');
    expect(HOWL.damage_type_primary).toBe('Thunder');
    expect(HOWL.dc_success).toBeUndefined();
    expect(HOWL.description).toBe(
      'Strength Saving Throw: DC 23, each creature within 30 ft. Failure: knocked Prone and takes 9 (2d8) Thunder damage. Success: half damage and not Prone.'
    );
  });

  it('hit_conditions:["prone"] stays authored but is provably attack-lane inert (§153)', () => {
    expect(HOWL.hit_conditions).toEqual(['prone']);
    // buildHitConditionClause is consumed only by the attack-hit seam; on a
    // save row it never runs. Pin its output shape so a future save-lane
    // reader mis-wire cannot silently double-grant prone.
    const clause = buildHitConditionClause(HOWL);
    expect(clause.conditions).toEqual(['prone']);
    expect(clause.attackName).toBe('Knockdown Howl');
    expect(clause.escapeDc).toBeNull();
  });

  it('cost 1 (plain legendary) still parses to 1 — MA-1883 byte-inert', () => {
    expect(legendaryActionCost(HOWL)).toBe(1);
  });
});
