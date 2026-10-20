// @maintained-by-ai
// MA-0781: Ghost "Horrific Visage" (DC 13 Wisdom, 60-foot Cone, 2d6 + 3 Psychic)
// RAW carries NO half-on-success clause — "Success: The target is immune to this
// ghost's Horrific Visage for 24 hours." Success pays ZERO. dc_success was ABSENT
// → resolveBlockSaveDcSuccess defaulted the picker props to 'half' (MV-20
// half-default leak, §63/§126/§252 family MA-0481/MA-0622/MA-0768): live proof
// +19 saves returned saveResult:"success" yet paid half (fd5 on raw 10, fd7 on
// raw 14, dcSuccess:"half"). DATA fix: dc_success:"none" after
// damage_type_primary (MA-0481 byte-shape), consumed live via SaveAttackAoeModal
// computeDamageAfterEvasion → computeDamageAfterSave zero-on-success.
// Generic half/none arithmetic at this seam is owned verbatim by
// applyDamage.helpers.test.js (:88-104, :184-196 with literal 'none'); this lane
// pins only the visage row and its disk dc_success wired through the seam.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const visage = () => monsters.find(m => m.index === 'ghost')
  .actions.find(a => a.name === 'Horrific Visage');

describe('MA-0781 Ghost Horrific Visage: honest dc_success canon on disk', () => {
  it('disk row carries RAW block-save shape with dc_success "none" after damage_type_primary (#1131 honest canon, #1086 golden bytes)', () => {
    const row = visage();
    expect(row.save_dc).toBe(13);
    expect(row.save_type).toBe('Wisdom');
    expect(row.range).toBe('60-foot Cone');
    expect(row.damage_dice_primary).toBe('2d6 + 3');
    expect(row.damage_type_primary).toBe('Psychic');
    // Success outcome is immunity, not halved damage — prose must not lie.
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    expect(row.description).toMatch(/Failure:\s*10 \(2d6 \+ 3\) Psychic damage/);
    expect(row.immunity).toMatch(/immune to this ghost'?s Horrific Visage for 24 hours/i);
    // MA-0481 byte-shape: dc_success authored last, right after the damage type.
    const keys = Object.keys(row);
    expect(row.dc_success).toBe('none');
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('damage_type_primary') + 1);
  });
});

describe('MA-0781 save seam paid through the visage row: full on fail, ZERO on success', () => {
  it('disk dc_success wired live: raw 10 (prose example) and raw 14 pay full on fail, zero on success — never half (#1187 falsifier: regress to "half" pays 5/7, fails here)', () => {
    const dcSuccess = visage().dc_success;
    expect(computeDamageAfterSave(10, false, dcSuccess)).toBe(10);
    expect(computeDamageAfterSave(10, true, dcSuccess)).toBe(0);
    expect(computeDamageAfterSave(14, false, dcSuccess)).toBe(14);
    expect(computeDamageAfterSave(14, true, dcSuccess)).toBe(0);
    // Live cone path (SaveAttackAoeModal), evasion inactive: same contract.
    expect(computeDamageAfterEvasion(10, false, dcSuccess, false)).toBe(10);
    expect(computeDamageAfterEvasion(10, true, dcSuccess, false)).toBe(0);
  });
});
