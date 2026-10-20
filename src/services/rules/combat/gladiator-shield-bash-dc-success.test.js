// @maintained-by-ai
// MA-0868: Gladiator "Shield Bash" (gladiator|actions[2], DC 15 Strength, one
// creature within 5 feet, 2d4 + 4 Bludgeoning on fail + Prone on Medium-or-smaller)
// RAW carries NO half-on-success clause — success pays ZERO damage and gains no
// condition. dc_success was ABSENT → the MV-20 half-default in MonsterCardModal
// (resolveBlockSaveDcSuccess / buildSaveOptions / handleDamage) leaked half damage
// on save success (live: nat 5 +19 = 24 ≥ DC 15 yet finalDamage=floor(9/2)=4,
// hp_change Δ−4). DATA fix: dc_success:"none" authored after save_type
// (MA-0481/0622/0768/0781/0798 byte-shape, #1086 golden bytes) — both chips ride
// the same save adjudication and heal identically.
// Generic half/none arithmetic at this seam is owned verbatim by
// applyDamage.helpers.test.js (:88-104, :184-196 with literal 'none'); the
// buildSaveOptions 'none/'half transport passthrough is owned by
// MonsterCard.ma1971-wing-defense.test.jsx:68/:71; this lane pins only the
// Gladiator row and its disk dc_success wired through the seam.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const shieldBash = () => monsters.find(m => m.index === 'gladiator')
  .actions.find(a => a.name === 'Shield Bash');

describe('MA-0868 Gladiator Shield Bash: honest dc_success canon on disk', () => {
  it('disk row carries RAW block-save shape with dc_success "none" after save_type (#1131 honest canon, #1086 golden bytes)', () => {
    const row = shieldBash();
    expect(row.name).toBe('Shield Bash');
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Strength');
    expect(row.range).toBe('5 feet');
    expect(row.damage_dice_primary).toBe('2d4 + 4');
    expect(row.damage_type_primary).toBe('Bludgeoning');
    expect(row.description).toMatch(/Failure:\s*9 \(2d4 \+ 4\) Bludgeoning damage/);
    expect(row.save_effect).toMatch(/Medium or smaller creature, it has the Prone condition/i);
    // Success pays zero and no condition, not half — prose must not lie.
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    // MA-0481 byte-shape: dc_success authored immediately after save_type.
    const keys = Object.keys(row);
    expect(row.dc_success).toBe('none');
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_type') + 1);
  });
});

describe('MA-0868 save seam paid through the Gladiator row: full on fail, ZERO on success', () => {
  it('disk dc_success wired live: raw 9 (prose example + live-leak stamp) and raw 12 (dice band max 2d4+4) pay full on fail, zero on success — never half (#1187 falsifier: regress dc_success to "half" pays floor(9/2)=4 and 6, fails here; key absence fails the disk lock above)', () => {
    const dcSuccess = shieldBash().dc_success;
    expect(computeDamageAfterSave(9, false, dcSuccess)).toBe(9);
    expect(computeDamageAfterSave(9, true, dcSuccess)).toBe(0);
    expect(computeDamageAfterSave(12, false, dcSuccess)).toBe(12);
    expect(computeDamageAfterSave(12, true, dcSuccess)).toBe(0);
    // Live chip path (MonsterCardModal), evasion inactive: same contract.
    expect(computeDamageAfterEvasion(9, false, dcSuccess, false)).toBe(9);
    expect(computeDamageAfterEvasion(9, true, dcSuccess, false)).toBe(0);
  });
});
