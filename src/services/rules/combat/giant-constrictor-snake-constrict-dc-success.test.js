// @maintained-by-ai
// MA-0798: Giant Constrictor Snake "Constrict" (actions[2], DC 14 Strength,
// shapeless "10 feet" → inline auto-save, 2d8 + 4 Bludgeoning) RAW authors NO
// success clause — Failure pays damage+Grappled, Success pays ZERO. dc_success
// was ABSENT → resolveBlockSaveDcSuccess (MonsterCardModal.jsx:214) defaulted
// the save context to 'half' (MV-20 half-default leak, §63/§126/§252 family
// MA-0481/MA-0622/MA-0768/MA-0781): live proof success legs total 28 vs DC 14
// paid floor(9/2)=4 with own hp_change −4 and dcSuccess:"half" stamps.
// DATA fix: dc_success:"none" after damage_type_primary (byte-twin family
// placement), consumed live via computeDamageAfterSave(…, 'none') = 0 on
// success, full raw on failure. Sustained grapple escape DC stays §70 advisory.
// Generic half/none arithmetic at this seam is owned verbatim by
// applyDamage.helpers.test.js (:88-104, :184-196 with literal 'none'); this
// lane pins only the snake row and its disk dc_success wired through the seam.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const constrict = () => monsters.find(m => m.index === 'giant-constrictor-snake')
  .actions.find(a => a.name === 'Constrict');

describe('MA-0798 Giant Constrictor Snake Constrict: honest dc_success canon on disk', () => {
  it('disk row carries RAW block-save shape with dc_success "none" after damage_type_primary (#1131 honest canon, #1086 golden bytes)', () => {
    const row = constrict();
    expect(row.save_dc).toBe(14);
    expect(row.save_type).toBe('Strength');
    expect(row.range).toBe('10 feet');
    expect(row.damage_dice_primary).toBe('2d8 + 4');
    expect(row.damage_type_primary).toBe('Bludgeoning');
    // Success pays zero, not half — prose must not lie.
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    expect(row.description).toMatch(/Failure:\s*13 \(2d8 \+ 4\) Bludgeoning damage/);
    expect(row.save_effect).toMatch(/Grappled.*escape DC 14/i);
    // Byte-twin family placement: dc_success authored last, right after the damage type.
    const keys = Object.keys(row);
    expect(row.dc_success).toBe('none');
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('damage_type_primary') + 1);
  });
});

describe('MA-0798 save seam paid through the snake row: full on fail, ZERO on success', () => {
  it('disk dc_success wired live: raw 13 (prose example) pays full on fail, zero on success — never half (#1187 falsifier: regress dc_success to "half" pays floor(13/2)=6, fails here; key absence fails the disk lock above)', () => {
    const dcSuccess = constrict().dc_success;
    expect(computeDamageAfterSave(13, false, dcSuccess)).toBe(13);
    expect(computeDamageAfterSave(13, true, dcSuccess)).toBe(0);
    // Live inline auto-save path (MonsterCardModal), evasion inactive: same contract.
    expect(computeDamageAfterEvasion(13, false, dcSuccess, false)).toBe(13);
    expect(computeDamageAfterEvasion(13, true, dcSuccess, false)).toBe(0);
  });
});
