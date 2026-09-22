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
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const snake = () => monsters.find(m => m.index === 'giant-constrictor-snake');
const constrict = () => snake().actions.find(a => a.name === 'Constrict');

describe('MA-0798 monsters.json data lock: Giant Constrictor Snake Constrict row', () => {
  const row = constrict();

  it('is the Constrict block-save row', () => {
    expect(row.name).toBe('Constrict');
    expect(row.save_dc).toBe(14);
    expect(row.save_type).toBe('Strength');
    expect(row.range).toBe('10 feet');
    expect(row.damage_dice_primary).toBe('2d8 + 4');
    expect(row.damage_type_primary).toBe('Bludgeoning');
  });

  it('canonical prose carries NO half-on-success clause (success pays zero)', () => {
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    expect(row.description).toMatch(/Failure:\s*13 \(2d8 \+ 4\) Bludgeoning damage/);
    expect(row.save_effect).toMatch(/Grappled.*escape DC 14/i);
  });

  it('dc_success authored "none" (half-default leak guard)', () => {
    expect(row.dc_success).toBe('none');
  });
});

describe('MA-0798 save seam pays full on fail, ZERO on success with dc_success "none"', () => {
  const dcSuccess = constrict().dc_success;

  it('computeDamageAfterSave: raw 17 full on fail, zero on success', () => {
    expect(computeDamageAfterSave(17, false, dcSuccess)).toBe(17);
    expect(computeDamageAfterSave(17, true, dcSuccess)).toBe(0);
  });

  it('computeDamageAfterEvasion (no evasion): zero on success, full on fail', () => {
    expect(computeDamageAfterEvasion(17, false, dcSuccess, false)).toBe(17);
    expect(computeDamageAfterEvasion(17, true, dcSuccess, false)).toBe(0);
  });
});
