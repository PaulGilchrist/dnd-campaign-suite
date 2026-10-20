// @maintained-by-ai
// MA-1673/MA-1674/MA-1689: honest dc_success canon for three block-save rows —
// Vrock "Spores" (actions[2], DC 15 CON, 20-ft Emanation, 1d10 Poison, Poisoned
// fail-only), Vrock "Stunning Scream" (actions[3], DC 15 CON, 20-ft Emanation,
// 3d6 Thunder + Stunned fail-only, 1/Day), and Water Elemental "Whelm"
// (actions[2], DC 15 STR, shapeless → single-target block-save lane,
// 4d8 + 4 Bludgeoning + Grappled/Restrained fail-only).
// RAW: a successful save pays ZERO damage and gains NO condition/grapple — none
// of these rows carries a half-on-success clause. dc_success was ABSENT →
// resolveBlockSaveDcSuccess (MonsterCardModal.jsx `action.dc_success ?? 'half'`)
// armed the MV-20 half-default (§63/§456 family MA-0481/MA-0622/MA-0781):
// live proof, SUCCESS legs paid half on raw rolls 7→3, 16→8 and Whelm
// (d20 2 + str mod 19 = 21 ≥ DC 15) paid raw 23→11, dcSuccess:"half".
// DATA fix: dc_success:"none" authored on disk (MA-0781 placement after
// save_type for the vrock pair; MA-0610 byte placement after save_effect for
// Whelm), consumed live via computeDamageAfterSave/AfterEvasion zero-on-success
// (MA-0590 routes the emanation RANGE byte to the picker). MA-1674's
// uses:"1/Day" STRING NaN-gate fix (numeric usage/uses/maxUses triple through
// abilitySaveMaxUses/monsterAbilitySaveUsesGate) is owned verbatim by
// monsterAbilityUses.vrock-stunning-scream.test.js — this lane pins only the
// dc_success seam. Generic half/none arithmetic at this seam is owned verbatim
// by applyDamage.helpers.test.js (:88-104 save half/none, :184-196 evasion).
// #1083 byte check verified against disk: Spores/Stunning Scream carry NO
// damage_type_primary byte (type lives in prose — "Poison damage",
// "Thunder damage"); only Whelm carries damage_type_primary:"Bludgeoning".
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import { extractConditionsFromSaveEffect } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const spores = () => monsters.find(m => m.index === 'vrock').actions.find(a => a.name === 'Spores');
const scream = () => monsters.find(m => m.index === 'vrock').actions.find(a => a.name === 'Stunning Scream');
const whelm = () => monsters.find(m => m.index === 'water-elemental').actions.find(a => a.name === 'Whelm');

describe('MA-1673/1674/1689 monsters.json data locks — three block-save rows, honest dc_success "none" on disk', () => {
  it('disk rows carry RAW block-save shape with dc_success "none" in documented byte order (#1086 programmatic read; positive prose anchors before /half/i absences; #1187 falsifier: deleting dc_success fails every placement leg below)', () => {
    // Spores: success clause is "ending the effect on itself on a success" — ZERO damage, Poisoned fail-only.
    const s = spores();
    expect(s.name).toBe('Spores');
    expect(s.save_dc).toBe(15);
    expect(s.save_type).toBe('Constitution');
    expect(s.range).toBe('20-foot Emanation');
    expect(s.damage_dice_primary).toBe('1d10');
    expect(s.damage_type_primary).toBeUndefined(); // #1083 disk truth: type is prose-only here
    expect(s.description).toMatch(/ending the effect on itself on a success/i);
    expect(s.description).toMatch(/takes 5 \(1d10\) Poison damage/);
    expect(s.save_effect).toMatch(/ending the effect on itself on a success/i);
    expect(s.description).not.toMatch(/half/i);
    expect(s.save_effect).not.toMatch(/half/i);
    const sKeys = Object.keys(s);
    expect(s.dc_success).toBe('none');
    expect(sKeys.indexOf('dc_success')).toBe(sKeys.indexOf('save_type') + 1);

    // Stunning Scream: RAW success carries NO success clause — no "Success:" byte at all.
    const c = scream();
    expect(c.name).toBe('Stunning Scream');
    expect(c.save_dc).toBe(15);
    expect(c.save_type).toBe('Constitution');
    expect(c.range).toBe('20-foot Emanation');
    expect(c.damage_dice_primary).toBe('3d6');
    expect(c.damage_type_primary).toBeUndefined(); // #1083 disk truth: type is prose-only here
    expect(c.description).toMatch(/Failure: 10 \(3d6\) Thunder damage/);
    expect(c.save_effect).toMatch(/Stunned condition until the end of the vrock's next turn/i);
    expect(c.description).not.toMatch(/Success:/i);
    expect(c.description).not.toMatch(/half/i);
    expect(c.save_effect).not.toMatch(/half/i);
    const cKeys = Object.keys(c);
    expect(c.dc_success).toBe('none');
    expect(cKeys.indexOf('dc_success')).toBe(cKeys.indexOf('save_type') + 1);

    // Whelm: RAW success = zero damage, NO grapple; fail face grants Grappled + Restrained (§52).
    const w = whelm();
    expect(w.name).toBe('Whelm');
    expect(w.save_dc).toBe(15);
    expect(w.save_type).toBe('Strength');
    expect(w.damage_dice_primary).toBe('4d8 + 4');
    expect(w.damage_type_primary).toBe('Bludgeoning'); // verified byte against disk
    expect(w.range).toBeUndefined(); // shapeless → single-target block-save lane
    expect(w.description).toMatch(/each creature in the elemental's space/);
    expect(w.save_effect).toMatch(/^Failure:/);
    expect(w.description).not.toMatch(/half/i);
    expect(w.description).not.toMatch(/Success:/i);
    expect(w.save_effect).not.toMatch(/half/i);
    const wKeys = Object.keys(w);
    expect(w.dc_success).toBe('none');
    expect(wKeys.indexOf('dc_success')).toBe(wKeys.indexOf('save_effect') + 1); // MA-0610 byte placement
    const conds = extractConditionsFromSaveEffect(w.save_effect).map(c => String(c).toLowerCase());
    expect(conds).toEqual(expect.arrayContaining(['grappled', 'restrained']));
  });
});

describe('MA-1673/1674/1689 save seam wired from disk: full on fail, ZERO on success — never half', () => {
  it('disk dc_success consumed live (computeDamageAfterSave + computeDamageAfterEvasion, evasion inactive): live-leak raws 7/16/23 pay full on fail, zero on success (#1187 falsifier: regress disk dc_success to "half" or delete it → ?? "half" default pays 3/8/11 on success and fails here; generic half/none arithmetic owned verbatim by applyDamage.helpers.test.js :88-104/:184-196)', () => {
    const dcSuccess = spores().dc_success;
    expect(computeDamageAfterSave(7, false, dcSuccess)).toBe(7);
    expect(computeDamageAfterSave(7, true, dcSuccess)).toBe(0);
    expect(computeDamageAfterEvasion(7, false, dcSuccess, false)).toBe(7);
    expect(computeDamageAfterEvasion(7, true, dcSuccess, false)).toBe(0);

    expect(computeDamageAfterSave(16, false, scream().dc_success)).toBe(16);
    expect(computeDamageAfterSave(16, true, scream().dc_success)).toBe(0);
    expect(computeDamageAfterEvasion(16, false, scream().dc_success, false)).toBe(16);
    expect(computeDamageAfterEvasion(16, true, scream().dc_success, false)).toBe(0);

    expect(computeDamageAfterSave(23, false, whelm().dc_success)).toBe(23); // live repro raw 23 (fail face pays full)
    expect(computeDamageAfterSave(23, true, whelm().dc_success)).toBe(0); // SUCCESS face 2+19=21 ≥ DC 15 — pre-fix paid 11
    expect(computeDamageAfterEvasion(23, false, whelm().dc_success, false)).toBe(23);
    expect(computeDamageAfterEvasion(23, true, whelm().dc_success, false)).toBe(0);
  });
});
