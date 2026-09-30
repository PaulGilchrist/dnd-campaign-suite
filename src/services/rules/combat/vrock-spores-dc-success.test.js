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
import { extractConditionsFromSaveEffect } from '../../../components/encounter/MonsterCardHelpers.js';
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

// MA-1689: Water Elemental "Whelm" (actions[2], DC 15 Strength, shapeless →
// single-target block-save lane, executeBlockSaveRoll auto-fire vs cs target,
// 4d8 + 4 Bludgeoning + Grappled/Restrained fail-only) RAW carries NO
// "Success:" clause — a successful save pays ZERO damage and gains NO grapple.
// dc_success was ABSENT → resolveBlockSaveDcSuccess (MonsterCardModal.jsx:268,
// `action.dc_success ?? 'half'`, stamped :1145/:2150) armed the half-default
// (MV-20 half-leak, §523/§456 family MA-0481/MA-0622/MA-0781/MA-1673): live
// repro SUCCESS face (d20 2 + saving_throws.str.modifier 19 = 21 ≥ DC 15)
// paid half — raw 23 rolled, finalDamage 11, hp_change −11, dcSuccess:"half".
// FAIL face honest: full 27 + Grappled+Restrained granted (§52).
// DATA fix: dc_success:"none" after save_effect (MA-0610 whirlwind byte
// placement), consumed live via computeDamageAfterSave(…, 'none') = 0 on
// success. Block-save save-modifier seam reads saving_throws.str.modifier
// OBJECT ({modifier:N}; bare int → NaN) / ability_score_modifiers.str — cs
// saveBonuses byte-inert here (§MA-1670/§1194).
const waterElemental = () => monsters.find(m => m.index === 'water-elemental');
const whelm = () => waterElemental().actions.find(a => a.name === 'Whelm');

describe('MA-1689 monsters.json data lock: Water Elemental Whelm row', () => {
  const row = whelm();

  it('is the Whelm block-save row, primary 4d8 + 4 Bludgeoning kept', () => {
    expect(row.name).toBe('Whelm');
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Strength');
    expect(row.damage_dice_primary).toBe('4d8 + 4');
    expect(row.damage_type_primary).toBe('Bludgeoning');
    expect(row.range).toBeUndefined();
  });

  it('canonical prose carries NO half-on-success clause (RAW success = zero, no grapple)', () => {
    expect(row.description).not.toMatch(/half/i);
    expect(row.description).not.toMatch(/Success:/i);
    expect(row.save_effect).not.toMatch(/half/i);
    expect(row.save_effect).toMatch(/^Failure:/);
  });

  it('dc_success authored "none" immediately after save_effect (MA-0610 byte placement, half-default leak guard)', () => {
    expect(row.dc_success).toBe('none');
    const keys = Object.keys(row);
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_effect') + 1);
  });

  it('fail-face grant words canonical: Grappled + Restrained extract from save_effect (§52)', () => {
    const conds = extractConditionsFromSaveEffect(row.save_effect).map(c => String(c).toLowerCase());
    expect(conds).toContain('grappled');
    expect(conds).toContain('restrained');
  });
});

describe('MA-1689 save seam pays full on fail, ZERO on success with dc_success "none"', () => {
  const dcSuccess = whelm().dc_success;

  it('computeDamageAfterSave: raw 27 full on fail, zero on success', () => {
    expect(computeDamageAfterSave(27, false, dcSuccess)).toBe(27);
    expect(computeDamageAfterSave(27, true, dcSuccess)).toBe(0);
  });

  it('computeDamageAfterEvasion (no evasion): zero on success, full on fail', () => {
    expect(computeDamageAfterEvasion(27, false, dcSuccess, false)).toBe(27);
    expect(computeDamageAfterEvasion(27, true, dcSuccess, false)).toBe(0);
  });

  it('leak guard: the pre-fix half-default paid 11 on the repro raw roll 23', () => {
    expect(computeDamageAfterSave(23, true, 'half')).toBe(11);
  });

  it('block-save lane rig mirror (§1194): saving_throws.str.modifier object folds success', () => {
    const savingThrows = { str: { modifier: 19 } };
    const mod = savingThrows.str.modifier;
    expect(typeof mod).toBe('number');
    const total = 2 + mod;
    const success = total >= whelm().save_dc;
    expect(success).toBe(true);
    const dcSuccessResolved = whelm().dc_success ?? 'half';
    expect(dcSuccessResolved).toBe('none');
    expect(computeDamageAfterSave(23, success, dcSuccessResolved)).toBe(0);
  });
});
