// MA-1334: Poltergeist "Telekinetic Thrust" (actions[2], DC 12 Strength, 2d6 + 2
// Force) RAW carries NO half-on-success clause — "Failure: 9 (2d6 + 2) Force
// damage", successful save pays ZERO. dc_success was ABSENT → engine half-default
// paid half on a SAVE SUCCESS (MV-20 half-default leak, MA-0481/MA-0622/MA-0781/
// MA-1301 family): live proof str+19 stamp → saveSuccess:true (21 vs DC 12) yet
// save-damage finalDamage 4 (half of rolled 9), HP 158→154, dcSuccess:"half"
// stamped on every save_result. DATA fix: dc_success:"none" after save_effect
// (MA-1301 Piercer Drop byte placement), consumed via computeDamageAfterSave
// zero-on-success.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterSave } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const poltergeist = () => monsters.find(m => m.name === 'Poltergeist');
const thrust = () => poltergeist().actions.find(a => a.name === 'Telekinetic Thrust');

describe('MA-1334 monsters.json data lock: Poltergeist Telekinetic Thrust row', () => {
  const row = thrust();

  it('is the Telekinetic Thrust block-save row', () => {
    expect(row.name).toBe('Telekinetic Thrust');
    expect(row.save_dc).toBe(12);
    expect(row.save_type).toBe('Strength');
    expect(row.damage_dice_primary).toBe('2d6 + 2');
    expect(row.damage_type_primary).toBe('Force');
  });

  it('canonical prose carries NO half-on-success clause (success = zero)', () => {
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
  });

  it('dc_success authored "none" (half-default leak guard)', () => {
    expect(row.dc_success).toBe('none');
  });
});

describe('MA-1334 save seam pays full on fail, ZERO on success with dc_success "none"', () => {
  const dcSuccess = thrust().dc_success;

  it('computeDamageAfterSave: raw 9 full on fail, zero on success', () => {
    expect(computeDamageAfterSave(9, false, dcSuccess)).toBe(9);
    expect(computeDamageAfterSave(9, true, dcSuccess)).toBe(0);
  });
});
