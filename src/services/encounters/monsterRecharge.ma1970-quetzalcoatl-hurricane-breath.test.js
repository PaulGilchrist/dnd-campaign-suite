// MA-1970: Quetzalcoatl "Hurricane Breath (Recharge 5-6)" save core live-verified
// EXACT (DC 25 DEX, 20d6 Thunder, half-on-success default RAW-correct; "90-foot
// Cone" parses to SaveAttackAoeModal picker) but two DATA fields missing: NO
// `recharge` — "(Recharge 5-6)" was name-text parsed by NO recharge parser
// (MA-1948/MA-1924/MA-0663 breath-twin family), 5 same-turn fires live, zero
// refusal, monsterRecharge key never stamped; NO `save_effect` — the Prone/
// Deafened rider lived only in description prose, inert (§53 MA-0090: 15 failed
// saves, zero condition grants). Two-field DATA fix: recharge:"5-6" rides the
// live MA-0031 spend/refusal/recovery lane (monsterRecharge.js, MA-1924
// byte-shape placement after save_dc); save_effect byte-mirrors the row's own
// description rider clause for extractConditionsFromSaveEffect (MV-31 transport).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { rechargeActionKey, rechargeUsageOf, monsterRechargeGate } from '../../services/encounters/monsterRecharge.js';
import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const QUETZALCOATL = monsters.find((m) => m.index === 'quetzalcoatl');
const BREATH = QUETZALCOATL.actions[3];

describe('MA-1970 disk fingerprint: Quetzalcoatl Hurricane Breath recharge + rider authored', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 25 DEX, 20d6 Thunder, default half', () => {
    expect(QUETZALCOATL.name).toBe('Quetzalcoatl');
    expect(BREATH.name).toBe('Hurricane Breath (Recharge 5-6)');
    expect(BREATH.save_dc).toBe(25);
    expect(BREATH.save_type).toBe('Dexterity');
    expect(BREATH.damage_dice_primary).toBe('20d6');
    expect(BREATH.damage_type_primary).toBe('Thunder');
    expect(BREATH.dc_success).toBeUndefined(); // half-on-success default is RAW-correct here — pin its ABSENCE
  });

  it('recharge:"5-6" arms the MA-0031 gate (was ungated name-text)', () => {
    expect(BREATH.recharge).toBe('5-6');
    expect(rechargeUsageOf(BREATH)).toEqual({ threshold: 5 });
    expect(rechargeActionKey(BREATH)).toBe('Hurricane Breath');
  });

  it('spent refuses, fresh available, recovery opens', () => {
    expect(monsterRechargeGate(BREATH, { 'Hurricane Breath': { recharged: false, threshold: 5 } }).available).toBe(false);
    expect(monsterRechargeGate(BREATH, { 'Hurricane Breath': { recharged: true } }).available).toBe(true);
    expect(monsterRechargeGate(BREATH, {}).available).toBe(true);
  });

  it('save_effect rider arms Prone + Deafened grants (was description-only inert)', () => {
    // byte-mirror of the row's own description rider clause
    expect(BREATH.save_effect).toBe('The target is also knocked Prone and Deafened for 1 minute on a failed save.');
    // actual extractor output pinned: CONDITIONS scan is alphabetical → deafened before prone
    expect(extractConditionsFromSaveEffect(BREATH.save_effect)).toEqual(['deafened', 'prone']);
    // pre-fix fingerprint: no save_effect → zero conditions (rider inert)
    expect(extractConditionsFromSaveEffect(undefined)).toEqual([]);
  });
});
