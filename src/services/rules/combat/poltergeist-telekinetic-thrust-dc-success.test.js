// @maintained-by-ai
// MA-1334: Poltergeist "Telekinetic Thrust" (actions[2], DC 12 Strength, 2d6 + 2
// Force) RAW carries NO half-on-success clause — "Failure: 9 (2d6 + 2) Force
// damage", a successful save pays ZERO. dc_success was ABSENT → engine half-default
// paid half on a SAVE SUCCESS (MV-20 half-default leak, MA-0481/MA-0622/MA-0781/
// MA-1301 family): live proof str+19 stamp → saveSuccess:true (21 vs DC 12) yet
// save-damage finalDamage 4 (half of rolled 9), HP 158→154, dcSuccess:"half"
// stamped on every save_result. DATA fix: dc_success:"none" after save_effect
// (MA-1301 Piercer Drop byte placement — byte order read from disk, verified, not
// assumed), consumed via computeDamageAfterSave zero-on-success. Generic half/none
// arithmetic at this seam is owned verbatim by applyDamage.helpers.test.js
// (:88-104, :184-196) — this lane pins only the Thrust row and its disk
// dc_success wired through the seam.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterSave } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const thrust = () => monsters.find(m => m.name === 'Poltergeist')
  .actions.find(a => a.name === 'Telekinetic Thrust');

describe('MA-1334 monsters.json data lock: Poltergeist Telekinetic Thrust row (#1086 honest canon, golden bytes)', () => {
  it('disk row carries RAW block-save shape with dc_success "none" immediately after save_effect (MA-1301 lineage byte order read from disk)', () => {
    const row = thrust();
    expect(row.name).toBe('Telekinetic Thrust');
    expect(row.save_dc).toBe(12);
    expect(row.save_type).toBe('Strength');
    expect(row.damage_dice_primary).toBe('2d6 + 2');
    expect(row.damage_type_primary).toBe('Force');
    // Positive prose anchors first: only Failure names damage — success pays ZERO.
    expect(row.description).toMatch(/Failure:\s*9 \(2d6 \+ 2\) Force damage/);
    expect(row.save_effect).toMatch(/^Failure:\s*9 \(2d6 \+ 2\) Force damage/);
    // Negative: no half-on-success clause anywhere on the row to contradict it.
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    // MA-1301 byte-shape: dc_success authored immediately after save_effect —
    // pins KEY PRESENCE too (absent would not flip the seam answer: undefined
    // also falls through to zero, so this data lock is the only absence guard).
    const keys = Object.keys(row);
    expect(row.dc_success).toBe('none');
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_effect') + 1);
  });
});

describe('MA-1334 save seam paid through the Thrust row: full on fail, ZERO on success', () => {
  it('disk dc_success wired live: raw 9 (prose example AND live bug stamp — half-paid 4) pays full on fail, zero on success — never half (#1187 falsifier: dc_success regressed to "half" flips the success answer away from 0)', () => {
    const dcSuccess = thrust().dc_success;
    expect(computeDamageAfterSave(9, false, dcSuccess)).toBe(9);
    expect(computeDamageAfterSave(9, true, dcSuccess)).toBe(0);
    // Falsifier: a regression to "half" changes this row's success answer —
    // differential only, the half arithmetic itself is owned by helpers :95-99.
    expect(computeDamageAfterSave(9, true, 'half')).not.toBe(computeDamageAfterSave(9, true, dcSuccess));
  });
});
