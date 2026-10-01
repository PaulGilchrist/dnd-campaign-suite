// MA-1739: Yeti "Chilling Gaze" (actions[3], DC 13 Constitution, 30 feet,
// 5 (2d4) Cold + Paralyzed on fail) RAW pays NOTHING on success — "Success:
// The target is immune to the Chilling Gaze of all yetis (but not abominable
// yetis) for 1 hour." dc_success was ABSENT → resolveBlockSaveDcSuccess
// defaulted 'half' (MV-20 half-default leak, §63 family MA-0481/MA-0622/
// MA-0781): live successful CON saves still paid floor(2d4/2)=2 Cold.
// DATA fix: dc_success:"none" after save_type + MA-0030 success_immunity
// block (Abominable Yeti byte-twin) riding the generic seams —
// buildAbilitySaveRollContext passthrough → saveProcessing.grantSuccessImmunity
// (te gaze_immunity, minutes×10 clock) → refusal gate gazeImmunityActive.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import { parseSuccessImmunity } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const yeti = () => monsters.find(m => m.index === 'yeti');
const gaze = () => yeti().actions.find(a => a.name === 'Chilling Gaze');

describe('MA-1739 monsters.json data lock: Yeti Chilling Gaze row', () => {
  const row = gaze();

  it('is the Chilling Gaze block-save row', () => {
    expect(row.name).toBe('Chilling Gaze');
    expect(row.save_dc).toBe(13);
    expect(row.save_type).toBe('Constitution');
    expect(row.range).toBe('30 feet');
  });

  it('canonical prose carries NO half-on-success clause (success = immunity only)', () => {
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    expect(row.description).toMatch(/immune to the Chilling Gaze of all yetis \(but not abominable yetis\) for 1 hour/i);
  });

  it('dc_success authored "none" (half-default leak guard)', () => {
    expect(row.dc_success).toBe('none');
  });

  it('MA-0030 success_immunity authored, parses to gaze_immunity 1 hour', () => {
    expect(row.success_immunity).toEqual({
      effect: 'gaze_immunity',
      duration: '1_hour',
      duration_minutes: 60
    });
    expect(parseSuccessImmunity(row)).toEqual({
      effect: 'gaze_immunity',
      duration: '1_hour',
      durationMinutes: 60
    });
  });
});

describe('MA-1739 save seam pays full on fail, ZERO on success with dc_success "none"', () => {
  const dcSuccess = gaze().dc_success;

  it('computeDamageAfterSave: raw 5 full on fail, zero on success', () => {
    expect(computeDamageAfterSave(5, false, dcSuccess)).toBe(5);
    expect(computeDamageAfterSave(5, true, dcSuccess)).toBe(0);
  });

  it('computeDamageAfterEvasion (no evasion): zero on success, full on fail', () => {
    expect(computeDamageAfterEvasion(5, false, dcSuccess, false)).toBe(5);
    expect(computeDamageAfterEvasion(5, true, dcSuccess, false)).toBe(0);
  });

  it('leak-shape guard: the upstream half-default (no authored dc_success) pays floor(5/2)=2', () => {
    expect(computeDamageAfterSave(5, true, 'half')).toBe(2);
    expect(computeDamageAfterSave(5, true, undefined)).toBe(0);
  });
});
