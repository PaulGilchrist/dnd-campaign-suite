// @maintained-by-ai
// MA-1898 + MA-1901: Garmr DATA fingerprints (one byte-pinned row each).
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
// Owner cites (not re-pinned here): recharge parse/gate/spend/turn-start d6
// recovery tri-state is MA-0031 (monsterRecharge.test.js:41-57; 5-6
// threshold twin MA-1843 :231-237, arm-fold precedent ma1890 :83-88);
// legendary cost parse incl. plain cost-1 rows is MA-1883
// (monsterLegendaryUses.ma1883:141-145); exhausted/latch
// monsterLegendaryUses.test.js:190-212/:304-326. This lane owns ONLY the
// Garmr disk fingerprints: exact row names (name suffix IS the machine-read
// recharge/cost marker), payload authored, core bytes untouched.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import { rechargeUsageOf } from '../../services/encounters/monsterRecharge.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const GARMR = monsters.find((m) => m.index === 'garmr');
const BREATH = GARMR.actions.find((a) => a.name === 'Corpse-Fire Breath (Recharge 5-6)');
const HOWL = GARMR.legendary_actions.find((a) => a.name === 'Knockdown Howl');

describe('MA-1898 disk fingerprint: Corpse-Fire Breath recharge authored', () => {
  it('full row by name: recharge:"5-6" arms the MA-0031 economy (was ungated name-text); core save bytes live-verified exact', () => {
    expect(BREATH.name).toBe('Corpse-Fire Breath (Recharge 5-6)');
    expect(BREATH.recharge).toBe('5-6');
    expect(rechargeUsageOf(BREATH)).toEqual({ threshold: 5 }); // gate tri-state owner monsterRecharge.test.js:50-57
    expect(BREATH.save_dc).toBe(24);
    expect(BREATH.save_type).toBe('Dexterity');
    expect(BREATH.damage_dice_primary).toBe('12d10');
    expect(BREATH.damage_type_primary).toBe('Necrotic');
    expect(BREATH.dc_success).toBeUndefined(); // engine default half = RAW
    expect(BREATH.description).toBe(
      'Dexterity Saving Throw: DC 24, each creature in a 60-foot Cone. Failure: 66 (12d10) Necrotic damage. Success: Half damage.'
    );
  });
});

describe('MA-1901 disk fingerprint: Knockdown Howl Prone payload authored', () => {
  it('full row by name (no cost suffix = plain LA, MA-1883 parse cited): save_effect canonical Prone word-scan live; save core live-verified exact', () => {
    expect(HOWL.name).toBe('Knockdown Howl'); // exact-name pin; cost marker is suffix-absent, MA-1883:141-145 owns default-1
    expect(HOWL.save_dc).toBe(23);
    expect(HOWL.save_type).toBe('Strength');
    expect(HOWL.damage_dice_primary).toBe('2d8');
    expect(HOWL.damage_type_primary).toBe('Thunder');
    expect(HOWL.dc_success).toBeUndefined(); // engine default half = RAW
    expect(HOWL.save_effect).toBe('Failure: The target is knocked Prone and takes 9 (2d8) Thunder damage. Success: half damage and not Prone.');
    expect(extractConditionsFromSaveEffect(HOWL.save_effect)).toEqual(['prone']);
    expect(HOWL.hit_conditions).toEqual(['prone']); // authored attack-lane bait (§153) — inert on a save row, kept inert
    expect(HOWL.description).toBe(
      'Strength Saving Throw: DC 23, each creature within 30 ft. Failure: knocked Prone and takes 9 (2d8) Thunder damage. Success: half damage and not Prone.'
    );
  });
});
