// @maintained-by-ai
// MA-1460: Shambling Mound "Engulf" (actions[2], DC 15 Strength, shapeless
// "" range → inline auto-save, 3d6 Lightning) RAW success = unaffected — the
// 3d6 is recurring-only (start of victim's turns, §70 sustained-grapple
// residual; the immediate pool on fail is the accepted MA-0771 stand-in).
// dc_success was ABSENT → resolveBlockSaveDcSuccess (MonsterCardModal.jsx:268)
// defaulted the save context to 'half' (MV-20 half-default leak, §63/§129
// family MA-0481/MA-0622/MA-0798): live proof success legs paid half — raw
// 3d6=14 applied 7 with own hp_change −7 (986 → 979) on ✓ SAVE SUCCESS 21.
// DATA fix: dc_success:"none" after damage_type_primary (byte-twin placement,
// giant-constrictor-snake/salamander Constrict), consumed live via
// computeDamageAfterSave(…, 'none') = 0 on success (fd:0, NO hp_change entry,
// §959), full raw on failure. Conditions ride the FAIL branch regardless
// (applyFailedSaveConditions early-returns on saveSuccess only, §63 trap rows
// N/A here — no non-damage success clause to discriminate).
// Generic half/none arithmetic at this seam is owned verbatim by
// applyDamage.helpers.test.js (:88-104 save half/none, :184-196 evasion); this
// lane pins only the Engulf row and its disk dc_success wired through the seam.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import { extractConditionsFromSaveEffect } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const engulf = () => monsters.find(m => m.index === 'shambling-mound').actions[2];

describe('MA-1460 Shambling Mound Engulf: honest dc_success canon on disk', () => {
  it('disk row carries RAW block-save shape with dc_success "none" after damage_type_primary (#1086 disk read, no transcription)', () => {
    const row = engulf();
    expect(row.name).toBe('Engulf');
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Strength');
    expect(row.range).toBe(''); // shapeless → inline auto-save lane
    expect(row.damage_dice_primary).toBe('3d6');
    expect(row.damage_type_primary).toBe('Lightning');
    // Prose is failure-only: positive anchors so the half-clause absence is not vacuous.
    expect(row.description).toMatch(/Failure:\s*The target is pulled/);
    expect(row.description).toMatch(/takes 10 \(3d6\) Lightning damage at the start of each of its turns/);
    expect(row.save_effect).toMatch(/Grappled.*escape DC 14/i);
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    // Byte-twin family placement (constrictor/salamander): dc_success authored last, right after the damage type.
    const keys = Object.keys(row);
    expect(row.dc_success).toBe('none');
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('damage_type_primary') + 1);
    // Fail-branch conditions byte-intact beside the field add (§52).
    expect(extractConditionsFromSaveEffect(row.save_effect)).toEqual(['blinded', 'grappled', 'restrained']);
  });
});

describe('MA-1460 save seam paid through the Engulf row: full on fail, ZERO on success', () => {
  it('disk dc_success wired live: raw 14 (live leak — half-paid 7, hp 986→979) and raw 10 (prose example) pay full on fail, zero on success — never half (#1187 falsifier: regress disk dc_success to "half" pays 7/5 on success, fails here; key absence fails the disk lock above)', () => {
    const dcSuccess = engulf().dc_success;
    expect(computeDamageAfterSave(14, false, dcSuccess)).toBe(14);
    expect(computeDamageAfterSave(14, true, dcSuccess)).toBe(0);
    expect(computeDamageAfterSave(10, false, dcSuccess)).toBe(10);
    expect(computeDamageAfterSave(10, true, dcSuccess)).toBe(0);
    // Live inline auto-save path (MonsterCardModal), evasion inactive: same contract.
    expect(computeDamageAfterEvasion(14, false, dcSuccess, false)).toBe(14);
    expect(computeDamageAfterEvasion(14, true, dcSuccess, false)).toBe(0);
  });
});
