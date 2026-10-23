// @maintained-by-ai
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
// Fold canon #1215 (last family member): ONE disk-row data-lock test + ONE
// seam test, dc_success WIRED FROM DISK (#1086 byte order verified against
// disk, not assumed: name, description, save_dc, save_type, dc_success,
// range, success_immunity, save_effect). This file is the ONLY monsters.json
// lock of plain Yeti (index 'yeti') — MonsterCardHelpers.gaze-immunity.test.js
// locks the Abominable Yeti twin's parse/gate/refusal truth tables and
// saveProcessing.chilling-gaze-immunity.test.js mirrors that twin's live seam.
// Generic half/none arithmetic at this seam is owned verbatim by
// applyDamage.helpers.test.js (:88-104 save half/none, :184-196 evasion).
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const yeti = () => monsters.find(m => m.index === 'yeti');
const gaze = () => yeti().actions.find(a => a.name === 'Chilling Gaze');

describe('MA-1739 Yeti Chilling Gaze: honest dc_success canon on disk (#1086)', () => {
  it('disk row locks DC 13 CON block-save row with dc_success "none" immediately after save_type (verified byte order), RAW success prose pays ZERO — immunity only — and the MA-0030 success_immunity block parses to gaze_immunity 1 hour (#1187 falsifier: deleting dc_success or regressing it to "half" fails the byte-position leg and the seam test)', () => {
    const row = gaze();
    expect(row.name).toBe('Chilling Gaze');
    expect(row.save_dc).toBe(13);
    expect(row.save_type).toBe('Constitution');
    expect(row.range).toBe('30 feet');
    // Positive prose anchors first: fail pays 5 (2d4) Cold + Paralyzed;
    // the ONLY success clause is 1-hour gaze immunity — ZERO damage.
    expect(row.description).toMatch(/Failure: 5 \(2d4\) Cold damage, and the target has the Paralyzed condition/);
    expect(row.description).toMatch(/immune to the Chilling Gaze of all yetis \(but not abominable yetis\) for 1 hour/i);
    // Negative: no half-on-success clause anywhere on the row to contradict it.
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    // MA-0030 byte-shape: dc_success authored immediately after save_type
    // (Abominable Yeti byte-twin placement — actual key order read from disk).
    const keys = Object.keys(row);
    expect(row.dc_success).toBe('none');
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_type') + 1);
    // MA-0030 success_immunity rides the same row (object, MA-0147 canon)
    // and parses into the grant seam's { effect, duration, durationMinutes }.
    expect(row.success_immunity).toEqual({
      effect: 'gaze_immunity',
      duration: '1_hour',
      duration_minutes: 60
    });
    // parseSuccessImmunity(row) round-trip re-pin dropped (pass #509 rec,
    // fix#277 echo-class): with all clause bytes explicit it re-states the
    // literal above through the parser's sole no-default exit — zero
    // production signal. Parse exits owner-pinned once at
    // MonsterCardHelpers.gaze-immunity.test.js:34-37 (explicit-bytes twin
    // row + duration/default + null arms); the bytes are live-consumed at
    // the grant seam by saveProcessing.chilling-gaze-immunity.test.js,
    // which now imports real disk rows (fix#1362) through processSaveRoll.
  });
});

describe('MA-1739 save seam wired from disk: full on fail, ZERO on success — never half', () => {
  it('disk dc_success consumed live (computeDamageAfterSave + computeDamageAfterEvasion, evasion inactive): disk raw 5 (2d4) pays full on fail, zero on success (#1187 falsifier: regress disk dc_success to "half" → success pays floor(5/2)=2, exactly the live bug stamp, failing the zero legs; the pre-fix undefined-default leak was upstream `?? \'half\'` — never re-arm it here; generic half/none arithmetic owned verbatim by applyDamage.helpers.test.js :88-104/:184-196)', () => {
    const dcSuccess = gaze().dc_success;
    expect(computeDamageAfterSave(5, false, dcSuccess)).toBe(5);
    expect(computeDamageAfterSave(5, true, dcSuccess)).toBe(0);
    expect(computeDamageAfterEvasion(5, false, dcSuccess, false)).toBe(5);
    expect(computeDamageAfterEvasion(5, true, dcSuccess, false)).toBe(0);
    // Leak-shape falsifier: the upstream half-default pays floor(5/2)=2 on
    // success — the exact Cold damage live successful saves leaked pre-fix.
    expect(computeDamageAfterSave(5, true, 'half')).toBe(2);
  });
});
