// MA-0868: Gladiator "Shield Bash" (actions[2], DC 15 Strength, one creature
// within 5 feet, 2d4 + 4 Bludgeoning on fail + Prone on Medium-or-smaller)
// RAW carries NO "On a Success: half damage" clause — success pays ZERO damage
// and gains no condition. dc_success was ABSENT → the MV-20 `dc_success ?? 'half'`
// default (MonsterCardModal resolveBlockSaveDcSuccess:214 / buildSaveOptions:933 /
// handleDamage:1886) leaked half damage on save success (live: nat 5 +19 = 24 ≥ DC 15
// yet finalDamage=floor(9/2)=4, hp_change Δ−4). DATA fix: dc_success:"none"
// after save_type (MA-0481/0622/0768/0781/0798 byte-shape) — both chips ride the
// same save adjudication and heal identically.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterSave, computeDamageAfterEvasion } from './applyDamage.js';
import { buildSaveOptions } from '../../../components/encounter/MonsterCardModal.jsx';
import monsters from '../../../../public/data/monsters.json';

const gladiator = () => monsters.find(m => m.name === 'Gladiator');
const shieldBash = () => gladiator().actions.find(a => a.name === 'Shield Bash');

describe('MA-0868 monsters.json data lock: Gladiator Shield Bash row', () => {
  const row = shieldBash();

  it('is the Shield Bash block-save row', () => {
    expect(row.name).toBe('Shield Bash');
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Strength');
    expect(row.range).toBe('5 feet');
    expect(row.damage_dice_primary).toBe('2d4 + 4');
    expect(row.damage_type_primary).toBe('Bludgeoning');
  });

  it('canonical prose carries NO half-on-success clause (failure-only leg)', () => {
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    expect(row.save_effect).toMatch(/Prone/i);
  });

  it('dc_success authored "none" (MV-20 half-default leak guard)', () => {
    expect(row.dc_success).toBe('none');
  });
});

describe('MA-0868 save seam pays full on fail, ZERO on success with dc_success "none"', () => {
  const dcSuccess = buildSaveOptions(shieldBash()).dcSuccess;

  it('buildSaveOptions rides authored "none" (no half default)', () => {
    expect(dcSuccess).toBe('none');
  });

  it('computeDamageAfterSave: raw 9 full on fail, zero on success', () => {
    expect(computeDamageAfterSave(9, false, dcSuccess)).toBe(9);
    expect(computeDamageAfterSave(9, true, dcSuccess)).toBe(0);
  });

  it('computeDamageAfterEvasion (no evasion): zero on success, full on fail', () => {
    expect(computeDamageAfterEvasion(9, false, dcSuccess, false)).toBe(9);
    expect(computeDamageAfterEvasion(9, true, dcSuccess, false)).toBe(0);
  });
});
