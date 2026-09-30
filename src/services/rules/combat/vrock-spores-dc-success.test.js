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
import { abilitySaveMaxUses, monsterAbilitySaveUsesGate } from '../../encounters/monsterAbilityUses.js';
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

// MA-1674: Vrock "Stunning Scream" (actions[3], DC 15 Constitution, 20-foot
// Emanation, 3d6 Thunder + Stunned fail-only) — same twin axes: RAW success
// carries NO success clause (no "Success:" byte in description) so the absent
// dc_success defaulted 'half' and a SUCCESS still paid half (live proof:
// "Saved — takes 4 Thunder damage (rolled 15, halved)", hp −4). Plus the
// `uses:"1/Day"` STRING gate defect: abilitySaveMaxUses Number("1/Day")=NaN
// → resolveAbilityUsesGate null → same-day refires FULL, zero refusal,
// monsterSpellUses never written, no counter chip (MA-0633 Fetid Cloud
// precedent). DATA fix: dc_success:"none" after save_type (MA-0781/MA-1673
// placement) + MA-0633 numeric usage/uses/maxUses triple replacing the string.
const scream = () => vrock().actions.find(a => a.name === 'Stunning Scream');

describe('MA-1674 monsters.json data lock: Vrock Stunning Scream row', () => {
  const row = scream();

  it('is the Stunning Scream block-save row, primary 3d6 Thunder kept', () => {
    expect(row.name).toBe('Stunning Scream');
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Constitution');
    expect(row.range).toBe('20-foot Emanation');
    expect(row.damage_dice_primary).toBe('3d6');
  });

  it('canonical prose carries NO success-pays clause (RAW success = nothing)', () => {
    expect(row.description).not.toMatch(/Success:/i);
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
  });

  it('dc_success authored "none" immediately after save_type (half-default leak guard)', () => {
    expect(row.dc_success).toBe('none');
    const keys = Object.keys(row);
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_type') + 1);
  });

  it('MA-0633 numerics replace the uses-STRING gate (NaN null-gate guard)', () => {
    expect(row.usage).toBe('1/Day');
    expect(row.usage).not.toBeInstanceOf(Object);
    expect(row.uses).toBe(1);
    expect(row.maxUses).toBe(1);
    expect(abilitySaveMaxUses(row)).toBe(1);
    const fresh = monsterAbilitySaveUsesGate(row, {});
    expect(fresh).toMatchObject({ useKey: 'Stunning Scream', maxUses: 1, used: 0, remaining: 1, exhausted: false });
  });
});

describe('MA-1674 save seam pays full on fail, ZERO on success with dc_success "none"', () => {
  const dcSuccess = scream().dc_success;

  it('computeDamageAfterSave: raw 16 full on fail, zero on success', () => {
    expect(computeDamageAfterSave(16, false, dcSuccess)).toBe(16);
    expect(computeDamageAfterSave(16, true, dcSuccess)).toBe(0);
  });

  it('computeDamageAfterEvasion (no evasion): zero on success, full on fail', () => {
    expect(computeDamageAfterEvasion(16, false, dcSuccess, false)).toBe(16);
    expect(computeDamageAfterEvasion(16, true, dcSuccess, false)).toBe(0);
  });

  it('leak guard: the pre-fix half-default paid 8 on the same raw roll', () => {
    expect(computeDamageAfterSave(16, true, 'half')).toBe(8);
  });
});
