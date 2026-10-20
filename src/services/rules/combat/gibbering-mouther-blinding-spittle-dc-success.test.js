// @maintained-by-ai
// MA-0839: Gibbering Mouther "Blinding Spittle" (actions[1], DC 10 Dexterity,
// 10-foot-radius Sphere within 30 feet, 2d6 Radiant, recharge 5-6) RAW carries
// NO half-on-success clause — "Failure: 7 (2d6) Radiant damage, and the target
// has the Blinded condition …" — success pays ZERO damage and gains no condition.
// dc_success was ABSENT → resolveBlockSaveDcSuccess defaulted the picker props to
// 'half' (MV-20 half-default leak, family MA-0481/MA-0622/MA-0768/MA-0781):
// live proof +19 dexterity saves returned saveResult:"success" yet paid half
// (fd2 on raw 5, dcSuccess:"half", hp_change Δ−2). DATA fix: dc_success:"none"
// after damage_type_primary (MA-0481 byte-shape), consumed live via
// SaveAttackAoeModal computeDamageAfterEvasion → computeDamageAfterSave zero-on-success.
// Generic half/none arithmetic at this seam is owned verbatim by
// applyDamage.helpers.test.js (:88-104 save half/none, :184-196 evasion); this
// lane pins only the spittle row and its disk dc_success wired through the seam.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const spittle = () => monsters.find(m => m.index === 'gibbering-mouther').actions[1];

describe('MA-0839 Gibbering Mouther Blinding Spittle: honest dc_success canon on disk', () => {
  it('disk row carries RAW block-save shape with dc_success "none" after damage_type_primary (#1086 disk read, no transcription)', () => {
    const row = spittle();
    expect(row.name).toBe('Blinding Spittle');
    expect(row.save_dc).toBe(10);
    expect(row.save_type).toBe('Dexterity');
    expect(row.range).toBe('30 feet');
    expect(row.damage_dice_primary).toBe('2d6');
    expect(row.damage_type_primary).toBe('Radiant');
    expect(row.recharge).toBe('5-6');
    // Prose is failure-only: positive anchors so the half-clause absence is not vacuous.
    expect(row.save_effect).toMatch(/^Failure: 7 \(2d6\) Radiant damage/);
    expect(row.description).toMatch(/Failure:\s*7 \(2d6\) Radiant damage/);
    expect(row.description).toMatch(/Blinded/);
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    // MA-0481 byte-shape: dc_success authored last, right after the damage type.
    const keys = Object.keys(row);
    expect(row.dc_success).toBe('none');
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('damage_type_primary') + 1);
  });
});

describe('MA-0839 save seam paid through the spittle row: full on fail, ZERO on success', () => {
  it('disk dc_success wired live: raw 7 (prose example) and raw 5 (live leak fd2 evidence) pay full on fail, zero on success — never half (#1187 falsifier: regress to "half" pays 3/2, fails here)', () => {
    const dcSuccess = spittle().dc_success;
    expect(computeDamageAfterSave(7, false, dcSuccess)).toBe(7);
    expect(computeDamageAfterSave(7, true, dcSuccess)).toBe(0);
    expect(computeDamageAfterSave(5, false, dcSuccess)).toBe(5);
    expect(computeDamageAfterSave(5, true, dcSuccess)).toBe(0);
    // Live sphere path (SaveAttackAoeModal), evasion inactive: same contract.
    expect(computeDamageAfterEvasion(7, false, dcSuccess, false)).toBe(7);
    expect(computeDamageAfterEvasion(7, true, dcSuccess, false)).toBe(0);
  });
});
