// @maintained-by-ai
// MA-1301: Piercer "Drop" (actions[1], DC 11 Dexterity, 3d6 Piercing) RAW
// carries NO half-on-success clause — "Failure: 10 (3d6) Piercing damage",
// success pays ZERO. dc_success was ABSENT → engine half-default paid half on a
// SAVE SUCCESS (MV-20 half-default leak, MA-0481/MA-0622/MA-0768/MA-0781 family):
// live proof +19 dex stamp → saveSuccess:true yet save-damage finalDamage 4
// (half of rolled 9), hp 999→995. DATA fix: dc_success:"none" after save_effect
// (MA-1301 byte placement — the MA-1334 lineage slot, NOT the MA-0781 ghost
// lineage's post-damage_type position), consumed via computeDamageAfterSave
// zero-on-success. Modal save-axis passthrough owned by
// MonsterCardModal.ma1656-hunger-of-hadar.test.js; generic half/none arithmetic
// at this seam is owned verbatim by applyDamage.helpers.test.js (:88-104,
// :184-196) — this lane pins only the Drop row and its disk dc_success wired
// through the seam.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterSave } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const drop = () => monsters.find(m => m.name === 'Piercer')
  .actions.find(a => a.name === 'Drop');

describe('MA-1301 Piercer Drop: honest dc_success canon on disk (#1086)', () => {
  it('disk row carries RAW block-save shape with dc_success "none" after save_effect (#1131 honest canon, golden bytes)', () => {
    const row = drop();
    expect(row.name).toBe('Drop');
    expect(row.save_dc).toBe(11);
    expect(row.save_type).toBe('Dexterity');
    expect(row.damage_dice_primary).toBe('3d6');
    expect(row.damage_type_primary).toBe('Piercing');
    // Positive prose anchors first: only Failure names damage — success pays ZERO.
    expect(row.description).toMatch(/Failure:\s*10 \(3d6\) Piercing damage/);
    expect(row.save_effect).toBe('Failure: 10 (3d6) Piercing damage');
    // Negative: no half-on-success clause anywhere on the row to contradict it.
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    // MA-1301 byte-shape: dc_success authored immediately after save_effect.
    const keys = Object.keys(row);
    expect(row.dc_success).toBe('none');
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_effect') + 1);
  });
});

describe('MA-1301 save seam paid through the Drop row: full on fail, ZERO on success', () => {
  it('disk dc_success wired live: raw 10 (prose example) and raw 9 (live bug stamp — half-paid 4) pay full on fail, zero on success — never half (#1187 falsifier: regress to "half" pays 5/4, fails here)', () => {
    const dcSuccess = drop().dc_success;
    expect(computeDamageAfterSave(10, false, dcSuccess)).toBe(10);
    expect(computeDamageAfterSave(10, true, dcSuccess)).toBe(0);
    expect(computeDamageAfterSave(9, false, dcSuccess)).toBe(9);
    expect(computeDamageAfterSave(9, true, dcSuccess)).toBe(0);
  });
});
