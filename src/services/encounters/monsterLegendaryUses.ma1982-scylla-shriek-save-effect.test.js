// MA-1982: Scylla "Shriek (Costs 2 Actions)" save core + 2-use spend live-verified
// EXACT (DC 23 Wisdom, 2d10 Thunder, half-on-success default RAW-correct, spends 2
// legendary uses per MA-1883 name-cost parse) but the "Deafened for 1 minute" rider
// was description-prose-only — inert: extractConditionsFromSaveEffect (Helpers:383)
// is save_effect-scoped with ZERO description fallback (§53 MA-0090 family; MA-1982
// live: 4 failed saves, activeConditions ABSENT, zero deaf log). One-field DATA fix
// (MA-1970 twin template): save_effect byte-mirrors the row's own description rider
// tail with the canonical word "Deafened"; placement after damage_type_primary.
// dc_success stays ABSENT — default half is RAW-correct ("Success: half damage").
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

import { extractConditionsFromSaveEffect } from '../../components/encounter/MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SCYLLA = monsters.find((m) => m.index === 'scylla');
const SHRIEK = SCYLLA.legendary_actions[3];
const BLOOD_TIDE = SCYLLA.actions[2];
const SNATCH = SCYLLA.legendary_actions[2];

describe('MA-1982 disk fingerprint: Scylla Shriek Deafened rider save_effect authored', () => {
  it('row identity + save core byte-unchanged (live-verified exact): DC 23 WIS, 2d10 Thunder', () => {
    expect(SCYLLA.name).toBe('Scylla');
    expect(SHRIEK.name).toBe('Shriek (Costs 2 Actions)');
    expect(SHRIEK.save_dc).toBe(23);
    expect(SHRIEK.save_type).toBe('Wisdom');
    expect(SHRIEK.damage_dice_primary).toBe('2d10');
    expect(SHRIEK.damage_type_primary).toBe('Thunder');
  });

  it('dc_success stays ABSENT — half-on-success default is RAW-correct here', () => {
    expect(SHRIEK.dc_success).toBeUndefined();
  });

  it('save_effect byte-mirrors the description rider tail with canonical "Deafened"', () => {
    expect(SHRIEK.save_effect).toBe('The target is Deafened for 1 minute.');
    // rider tail rides the row's own description verbatim
    expect(SHRIEK.description).toContain('and the target is Deafened for 1 minute');
  });

  it('extractor grants deafened on failed save (was description-only inert)', () => {
    // actual extractor output pinned: canonical word-scan yields the single key
    expect(extractConditionsFromSaveEffect(SHRIEK.save_effect)).toEqual(['deafened']);
    // pre-fix fingerprint: no save_effect → zero conditions (rider inert)
    expect(extractConditionsFromSaveEffect(undefined)).toEqual([]);
    // description alone never armed the extractor (§53 hardened)
    expect(extractConditionsFromSaveEffect(SHRIEK.description)).toEqual(extractConditionsFromSaveEffect(SHRIEK.save_effect));
  });

  it('MA-1978/MA-1981 siblings byte-guarded (edited today, untouched by this fix)', () => {
    expect(BLOOD_TIDE.name).toBe('Blood Tide (Recharge 5-6)');
    expect(BLOOD_TIDE.save_dc).toBe(25);
    expect(BLOOD_TIDE.save_type).toBe('Dexterity');
    expect(BLOOD_TIDE.recharge).toBe('5-6'); // MA-1978 fix intact
    expect(BLOOD_TIDE.save_effect).toBeUndefined();
    expect(SNATCH.name).toBe('Snatch');
    expect(SNATCH.attack_bonus).toBe(16);
    expect(SNATCH.target_prerequisite).toEqual({ conditions: ['grappled', 'restrained'] }); // MA-1981 fix intact
    expect(SNATCH.save_effect).toBeUndefined();
  });
});
