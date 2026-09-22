// MA-0781: Ghost "Horrific Visage" (actions[3], DC 13 Wisdom, 60-foot Cone,
// 2d6 + 3 Psychic) RAW carries NO half-on-success clause — "Success: The target
// is immune to this ghost's Horrific Visage for 24 hours." Success pays ZERO.
// dc_success was ABSENT → resolveBlockSaveDcSuccess defaulted the picker props to
// 'half' (MV-20 half-default leak, §63/§126/§252 family MA-0481/MA-0622/MA-0768):
// live proof +19 saves returned saveResult:"success" yet paid half (fd5 on raw 10,
// fd7 on raw 14, dcSuccess:"half"). DATA fix: dc_success:"none" after
// damage_type_primary (MA-0481 byte-shape), consumed live via
// SaveAttackAoeModal computeDamageAfterEvasion → computeDamageAfterSave zero-on-success.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const ghost = () => monsters.find(m => m.index === 'ghost');
const visage = () => ghost().actions.find(a => a.name === 'Horrific Visage');

describe('MA-0781 monsters.json data lock: Ghost Horrific Visage row', () => {
  const row = visage();

  it('is the Horrific Visage block-save row', () => {
    expect(row.name).toBe('Horrific Visage');
    expect(row.save_dc).toBe(13);
    expect(row.save_type).toBe('Wisdom');
    expect(row.range).toBe('60-foot Cone');
    expect(row.damage_dice_primary).toBe('2d6 + 3');
    expect(row.damage_type_primary).toBe('Psychic');
  });

  it('canonical prose carries NO half-on-success clause (success = immunity)', () => {
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    expect(row.immunity).toMatch(/immune to this ghost'?s Horrific Visage for 24 hours/i);
  });

  it('dc_success authored "none" (half-default leak guard)', () => {
    expect(row.dc_success).toBe('none');
  });
});

describe('MA-0781 save seam pays full on fail, ZERO on success with dc_success "none"', () => {
  const dcSuccess = visage().dc_success;

  it('computeDamageAfterSave: raw 10 full on fail, zero on success', () => {
    expect(computeDamageAfterSave(10, false, dcSuccess)).toBe(10);
    expect(computeDamageAfterSave(10, true, dcSuccess)).toBe(0);
  });

  it('computeDamageAfterEvasion (no evasion): zero on success, full on fail', () => {
    expect(computeDamageAfterEvasion(10, false, dcSuccess, false)).toBe(10);
    expect(computeDamageAfterEvasion(10, true, dcSuccess, false)).toBe(0);
  });
});
