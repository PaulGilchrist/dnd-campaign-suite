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
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const mouther = () => monsters.find(m => m.index === 'gibbering-mouther');
const spittle = () => mouther().actions.find(a => a.name === 'Blinding Spittle');

describe('MA-0839 monsters.json data lock: Gibbering Mouther Blinding Spittle row', () => {
  const row = spittle();

  it('is the Blinding Spittle block-save row', () => {
    expect(row.name).toBe('Blinding Spittle');
    expect(row.save_dc).toBe(10);
    expect(row.save_type).toBe('Dexterity');
    expect(row.range).toBe('30 feet');
    expect(row.damage_dice_primary).toBe('2d6');
    expect(row.damage_type_primary).toBe('Radiant');
    expect(row.recharge).toBe('5-6');
  });

  it('canonical prose carries NO half-on-success clause (failure-only leg)', () => {
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    expect(row.save_effect).toMatch(/^Failure: 7 \(2d6\) Radiant damage/i);
  });

  it('dc_success authored "none" (half-default leak guard)', () => {
    expect(row.dc_success).toBe('none');
  });
});

describe('MA-0839 save seam pays full on fail, ZERO on success with dc_success "none"', () => {
  const dcSuccess = spittle().dc_success;

  it('computeDamageAfterSave: raw 7 full on fail, zero on success', () => {
    expect(computeDamageAfterSave(7, false, dcSuccess)).toBe(7);
    expect(computeDamageAfterSave(7, true, dcSuccess)).toBe(0);
  });

  it('computeDamageAfterEvasion (no evasion): zero on success, full on fail', () => {
    expect(computeDamageAfterEvasion(7, false, dcSuccess, false)).toBe(7);
    expect(computeDamageAfterEvasion(7, true, dcSuccess, false)).toBe(0);
  });
});
