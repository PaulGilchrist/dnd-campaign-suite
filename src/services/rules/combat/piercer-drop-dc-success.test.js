// MA-1301: Piercer "Drop" (actions[1], DC 11 Dexterity, 3d6 Piercing) RAW
// carries NO half-on-success clause — "Failure: 10 (3d6) Piercing damage",
// success pays ZERO. dc_success was ABSENT → engine half-default paid half on a
// SAVE SUCCESS (MV-20 half-default leak, MA-0481/MA-0622/MA-0768/MA-0781 family):
// live proof +19 dex stamp → saveSuccess:true yet save-damage finalDamage 4
// (half of rolled 9), hp 999→995. DATA fix: dc_success:"none" after save_effect,
// consumed via computeDamageAfterSave zero-on-success.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterSave } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const piercer = () => monsters.find(m => m.name === 'Piercer');
const drop = () => piercer().actions.find(a => a.name === 'Drop');

describe('MA-1301 monsters.json data lock: Piercer Drop row', () => {
  const row = drop();

  it('is the Drop block-save row', () => {
    expect(row.name).toBe('Drop');
    expect(row.save_dc).toBe(11);
    expect(row.save_type).toBe('Dexterity');
    expect(row.damage_dice_primary).toBe('3d6');
    expect(row.damage_type_primary).toBe('Piercing');
  });

  it('canonical prose carries NO half-on-success clause (success = zero)', () => {
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
  });

  it('dc_success authored "none" (half-default leak guard)', () => {
    expect(row.dc_success).toBe('none');
  });
});

describe('MA-1301 save seam pays full on fail, ZERO on success with dc_success "none"', () => {
  const dcSuccess = drop().dc_success;

  it('computeDamageAfterSave: raw 10 full on fail, zero on success', () => {
    expect(computeDamageAfterSave(10, false, dcSuccess)).toBe(10);
    expect(computeDamageAfterSave(10, true, dcSuccess)).toBe(0);
  });
});
