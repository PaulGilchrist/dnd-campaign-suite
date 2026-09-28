// MA-1498: Sphinx of Secrets "Curse of the Riddle" (actions[2], DC 15
// Intelligence, range 60 feet, 6d6 Psychic + Cursed on fail) RAW authors NO
// success-pays clause — "Failure: 21 (6d6) Psychic damage, and the target is
// cursed..." — Success pays ZERO. dc_success was ABSENT → half-default
// (action?.dc_success ?? 'half', MonsterCardModal.jsx:255/:1032, MV-20
// half-leak family §63/§129, MA-1301 single-target twin) paid HALF on
// SUCCESS: live proof nat16+0=16 ≥ DC15 → raw 22 applied 11 (hp 971→960);
// post-pre-fix-confirm nat18+19=37 ≥ DC15 → raw 24 applied 12 (999→987).
// DATA fix: dc_success:"none" after save_type (MA-1301 twin placement).
// FAIL side stays byte-identical: full raw dice + 'cursed' grant via
// extractConditionsFromSaveEffect canonical word list (applyFailedSaveConditions
// fail-only — §63 trap-check, proven MA-1460/1484/1486/1492/1477).
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import { extractConditionsFromSaveEffect } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const sphinx = () => monsters.find(m => m.index === 'sphinx-of-secrets');
const curse = () => sphinx().actions[2];

describe('MA-1498 monsters.json data lock: Sphinx of Secrets Curse of the Riddle row', () => {
  const row = curse();

  it('is the Curse of the Riddle single-target save row', () => {
    expect(row.name).toBe('Curse of the Riddle');
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Intelligence');
    expect(row.range).toBe('60 feet');
  });

  it('canonical prose carries NO half-on-success clause (RAW success = zero)', () => {
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    expect(row.description).toMatch(/Failure:\s*21 \(6d6\) Psychic damage/);
    expect(row.save_effect).toMatch(/takes 21 \(6d6\) Psychic damage and is cursed with a riddle/);
  });

  it('dc_success authored "none" after save_type (half-default leak guard)', () => {
    expect(row.dc_success).toBe('none');
  });

  it('fail-branch condition extraction stays intact beside the field add', () => {
    expect(extractConditionsFromSaveEffect(row.save_effect)).toEqual(['cursed']);
  });
});

describe('MA-1498 save seam pays full on fail, ZERO on success with dc_success "none"', () => {
  const dcSuccess = curse().dc_success;

  it('computeDamageAfterSave: raw 22 full on fail, zero on success', () => {
    expect(computeDamageAfterSave(22, false, dcSuccess)).toBe(22);
    expect(computeDamageAfterSave(22, true, dcSuccess)).toBe(0);
  });

  it('computeDamageAfterEvasion (no evasion): zero on success, full on fail', () => {
    expect(computeDamageAfterEvasion(22, false, dcSuccess, false)).toBe(22);
    expect(computeDamageAfterEvasion(22, true, dcSuccess, false)).toBe(0);
  });
});
