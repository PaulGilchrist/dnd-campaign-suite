// @maintained-by-ai
// MA-1353: Psychic Gray Ooze "Psychic Crush" (actions[1], DC 10 Intelligence, 3d8
// Psychic) RAW carries NO half-on-success clause — "Failure: 13 (3d8) Psychic
// damage.", a successful save pays ZERO. dc_success was ABSENT → engine half-default
// paid half on a SAVE SUCCESS (MV-20 half-default leak, MA-0481/MA-0622/MA-0781/
// MA-1301/MA-1334 family): live proof int+19 stamp → SAVE SUCCESS (37 vs DC 10) yet
// save-damage finalDamage 4 (half of rolled 8), HP 999→995, dcSuccess:"half"
// stamped on the save_result. DATA fix: dc_success:"none" after save_effect
// (MA-1334 Poltergeist byte placement — byte order read from disk, verified, not
// assumed), consumed via computeDamageAfterSave zero-on-success. Generic half/none
// arithmetic at this seam is owned verbatim by applyDamage.helpers.test.js
// (:88-104, :184-196) — this lane pins only the Crush row and its disk
// dc_success wired through the seam.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterSave } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const crush = () => monsters.find(m => m.index === 'psychic-gray-ooze')
  .actions.find(a => a.name === 'Psychic Crush');

describe('MA-1353 monsters.json data lock: Psychic Gray Ooze Psychic Crush row (#1086 honest canon, golden bytes)', () => {
  it('disk row carries RAW block-save shape with dc_success "none" immediately after save_effect (MA-1334 lineage byte order read from disk)', () => {
    const row = crush();
    expect(row.name).toBe('Psychic Crush');
    expect(row.save_dc).toBe(10);
    expect(row.save_type).toBe('Intelligence');
    expect(row.damage_dice_primary).toBe('3d8');
    expect(row.damage_type_primary).toBe('Psychic');
    // Positive prose anchors first: only Failure names damage — success pays ZERO.
    expect(row.description).toBe('Intelligence Saving Throw: DC 10, one creature the ooze can see within 60 feet. Failure: 13 (3d8) Psychic damage.');
    expect(row.save_effect).toBe('Failure: 13 (3d8) Psychic damage.');
    // Negative: no half-on-success clause anywhere on the row to contradict it.
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    // MA-1334 byte-shape: dc_success authored immediately after save_effect —
    // pins KEY PRESENCE too (absent would not flip the seam answer: undefined
    // also falls through to zero, so this data lock is the only absence guard).
    const keys = Object.keys(row);
    expect(row.dc_success).toBe('none');
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_effect') + 1);
  });
});

describe('MA-1353 save seam paid through the Crush row: full on fail, ZERO on success', () => {
  it('disk dc_success wired live: prose raw 13 AND live-bug raw 8 (half-paid 4 on the 37-vs-DC-10 success) pay full on fail, zero on success — never half (#1187 falsifier: dc_success regressed to "half" flips the success answer away from 0)', () => {
    const dcSuccess = crush().dc_success;
    expect(computeDamageAfterSave(13, false, dcSuccess)).toBe(13);
    expect(computeDamageAfterSave(13, true, dcSuccess)).toBe(0);
    expect(computeDamageAfterSave(8, false, dcSuccess)).toBe(8);
    expect(computeDamageAfterSave(8, true, dcSuccess)).toBe(0);
    // Falsifier: a regression to "half" changes this row's success answer —
    // differential only, the half arithmetic itself is owned by helpers :95-99.
    expect(computeDamageAfterSave(13, true, 'half')).not.toBe(computeDamageAfterSave(13, true, dcSuccess));
  });
});
