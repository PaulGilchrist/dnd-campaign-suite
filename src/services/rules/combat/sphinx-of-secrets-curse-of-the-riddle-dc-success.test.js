// @maintained-by-ai
// MA-1498: Sphinx of Secrets "Curse of the Riddle" (actions[2], DC 15
// Intelligence, range 60 feet, 6d6 Psychic + Cursed on fail) RAW authors NO
// success-pays clause — "Failure: 21 (6d6) Psychic damage, and the target is
// cursed..." — Success pays ZERO. dc_success was ABSENT → half-default
// (action?.dc_success ?? 'half', MonsterCardModal.jsx:255/:1032, MV-20
// half-leak family §63/§129, MA-1301 single-target twin) paid HALF on
// SUCCESS: live proof nat16+0=16 ≥ DC15 → raw 22 applied 11 (hp 971→960);
// post-pre-fix-confirm nat18+19=37 ≥ DC15 → raw 24 applied 12 (999→987).
// DATA fix: dc_success:"none" after save_type (MA-1301 twin placement,
// verified byte order on disk). FAIL side stays byte-identical: full raw
// dice + 'cursed' grant via extractConditionsFromSaveEffect canonical word
// list (applyFailedSaveConditions fail-only — §63 trap-check, proven
// MA-1460/1484/1486/1492/1477). Generic half/none arithmetic at this seam
// is owned verbatim by applyDamage.helpers.test.js (:88-104, :184-196) —
// this lane pins only the Curse row and its disk dc_success wired through
// the seam, never half (#1187 falsifier: regress to "half" pays 11/12 —
// exactly the two live bug stamps — and fails here).
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import { extractConditionsFromSaveEffect } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const curse = () => monsters.find(m => m.index === 'sphinx-of-secrets').actions[2];

describe('MA-1498 Sphinx of Secrets Curse of the Riddle: honest dc_success canon on disk (#1086)', () => {
  it('disk row locks single-target DC 15 Intelligence save with dc_success "none" after save_type (golden bytes), RAW success prose pays ZERO, and the fail-branch still extracts ["cursed"]', () => {
    const row = curse();
    expect(row.name).toBe('Curse of the Riddle');
    expect(row.save_dc).toBe(15);
    expect(row.save_type).toBe('Intelligence');
    expect(row.range).toBe('60 feet');
    // Positive prose anchors first: only Failure names damage — success pays ZERO.
    expect(row.description).toMatch(/Failure:\s*21 \(6d6\) Psychic damage/);
    expect(row.save_effect).toMatch(/takes 21 \(6d6\) Psychic damage and is cursed with a riddle/);
    // Negative: no half-on-success clause anywhere on the row to contradict it.
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    // MA-1498 byte-shape: dc_success authored immediately after save_type
    // (MA-1301 twin lineage slot — verified actual key order on disk, #1086).
    const keys = Object.keys(row);
    expect(row.dc_success).toBe('none');
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_type') + 1);
    // FAIL side unchanged by the field add: canonical extraction still grants 'cursed'.
    expect(extractConditionsFromSaveEffect(row.save_effect)).toEqual(['cursed']);
  });
});

describe('MA-1498 save seam paid through the Curse row: full on fail, ZERO on success', () => {
  it('disk dc_success wired live: live stamps raw 22 (paid 11) and raw 24 (paid 12) pay full on fail, zero on success — save and no-evasion evasion legs agree (#1187 falsifier: regress to "half" pays 11/12, fails here)', () => {
    const dcSuccess = curse().dc_success;
    expect(computeDamageAfterSave(22, false, dcSuccess)).toBe(22);
    expect(computeDamageAfterSave(22, true, dcSuccess)).toBe(0);
    expect(computeDamageAfterSave(24, false, dcSuccess)).toBe(24);
    expect(computeDamageAfterSave(24, true, dcSuccess)).toBe(0);
    expect(computeDamageAfterEvasion(22, false, dcSuccess, false)).toBe(22);
    expect(computeDamageAfterEvasion(22, true, dcSuccess, false)).toBe(0);
  });
});
