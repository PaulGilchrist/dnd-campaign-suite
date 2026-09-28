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
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import { extractConditionsFromSaveEffect } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const mound = () => monsters.find(m => m.index === 'shambling-mound');
const engulf = () => mound().actions[2];

describe('MA-1460 monsters.json data lock: Shambling Mound Engulf row', () => {
  const row = engulf();

  it('is the Engulf block-save row', () => {
    expect(row.name).toBe('Engulf');
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Strength');
    expect(row.damage_dice_primary).toBe('3d6');
    expect(row.damage_type_primary).toBe('Lightning');
  });

  it('canonical prose carries NO half-on-success clause (RAW success = unaffected)', () => {
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    expect(row.description).toMatch(/takes 10 \(3d6\) Lightning damage at the start of each of its turns/);
    expect(row.save_effect).toMatch(/Grappled.*escape DC 14/i);
  });

  it('dc_success authored "none" (half-default leak guard)', () => {
    expect(row.dc_success).toBe('none');
  });

  it('fail-branch conditions half stays byte-intact beside the field add', () => {
    expect(extractConditionsFromSaveEffect(row.save_effect)).toEqual(['blinded', 'grappled', 'restrained']);
  });
});

describe('MA-1460 save seam pays full on fail, ZERO on success with dc_success "none"', () => {
  const dcSuccess = engulf().dc_success;

  it('computeDamageAfterSave: raw 14 full on fail, zero on success', () => {
    expect(computeDamageAfterSave(14, false, dcSuccess)).toBe(14);
    expect(computeDamageAfterSave(14, true, dcSuccess)).toBe(0);
  });

  it('computeDamageAfterEvasion (no evasion): zero on success, full on fail', () => {
    expect(computeDamageAfterEvasion(14, false, dcSuccess, false)).toBe(14);
    expect(computeDamageAfterEvasion(14, true, dcSuccess, false)).toBe(0);
  });
});
