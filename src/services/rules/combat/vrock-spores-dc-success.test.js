// MA-1673: Vrock "Spores" (actions[2], DC 15 Constitution, 20-foot Emanation,
// 1d10 Poison, Poisoned fail-only) RAW carries NO half-on-success clause —
// "ending the effect on itself on a success" means a successful save pays
// ZERO damage and gains NO condition. dc_success was ABSENT →
// resolveBlockSaveDcSuccess defaulted the picker props to 'half' (MV-20
// half-default leak, §63/§456 family MA-0481/MA-0622/MA-0781): live proof
// +19 saves returned saveResult:"success" yet paid half (rolls [7] → fd 3,
// hp_change −3, modal "Saved — takes 3 Poison damage (rolled 18, halved)").
// DATA fix: dc_success:"none" after save_type, consumed live via
// SaveAttackAoeModal computeDamageAfterEvasion → computeDamageAfterSave
// zero-on-success (MA-0590 routes the emanation RANGE byte to the picker).
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const vrock = () => monsters.find(m => m.index === 'vrock');
const spores = () => vrock().actions.find(a => a.name === 'Spores');

describe('MA-1673 monsters.json data lock: Vrock Spores row', () => {
  const row = spores();

  it('is the Spores block-save row', () => {
    expect(row.name).toBe('Spores');
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Constitution');
    expect(row.range).toBe('20-foot Emanation');
    expect(row.damage_dice_primary).toBe('1d10');
  });

  it('canonical prose carries NO half-on-success clause (success ends the effect)', () => {
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    expect(row.save_effect).toMatch(/ending the effect on itself on a success/i);
  });

  it('dc_success authored "none" immediately after save_type (half-default leak guard)', () => {
    expect(row.dc_success).toBe('none');
    const keys = Object.keys(row);
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_type') + 1);
  });
});

describe('MA-1673 save seam pays full on fail, ZERO on success with dc_success "none"', () => {
  const dcSuccess = spores().dc_success;

  it('computeDamageAfterSave: raw 7 full on fail, zero on success', () => {
    expect(computeDamageAfterSave(7, false, dcSuccess)).toBe(7);
    expect(computeDamageAfterSave(7, true, dcSuccess)).toBe(0);
  });

  it('computeDamageAfterEvasion (no evasion): zero on success, full on fail', () => {
    expect(computeDamageAfterEvasion(7, false, dcSuccess, false)).toBe(7);
    expect(computeDamageAfterEvasion(7, true, dcSuccess, false)).toBe(0);
  });

  it('leak guard: the pre-fix half-default paid 3 on the same raw roll', () => {
    expect(computeDamageAfterSave(7, true, 'half')).toBe(3);
  });
});
