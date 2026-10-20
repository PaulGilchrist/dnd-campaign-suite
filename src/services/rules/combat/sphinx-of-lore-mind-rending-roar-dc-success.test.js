// @maintained-by-ai
// MA-1492: Sphinx of Lore "Mind-Rending Roar" (actions[2], DC 16 Wisdom,
// "300-foot Emanation" → MA-0590 radius picker, 10d6 Psychic, recharge 5-6)
// RAW authors NO success clause — Failure pays damage + Incapacitated,
// Success pays ZERO (UNAFFECTED). dc_success was ABSENT →
// resolveBlockSaveDcSuccess (MonsterCardModal.jsx:268) defaulted the save
// context to 'half' (MV-20 half-default leak, §63/§129 family
// MA-0481/MA-0622/MA-0798/MA-1427): live proof success legs paid half —
// nat16 raw 28 applied 14 (hp 999→985), nat20 raw 41 applied 20 (985→965)
// with dcSuccess:"half" stamps + picker preview "takes half damage".
// DATA fix: dc_success:"none" after save_effect (byte-twin placement,
// dracolich Terrifying Presence/salamander Constrict — byte order read from
// disk, verified, not assumed), consumed live via computeDamageAfterSave(…,
// 'none') = 0 on success (fd:0, NO hp_change, §959), full raw on failure.
// Incapacitated stays FAIL-only regardless — picker grant rides
// resolveSaveFailGrant→applySaveFailConditions early-return on saveSuccess
// (§63 trap-check: 'none' never suppresses the fail-side grant;
// MA-1460/MA-1484/MA-1486 twins).
// Generic half/none arithmetic at this seam is owned verbatim by
// applyDamage.helpers.test.js (:88-104 save half/none, :184-196 evasion);
// this lane pins only the Roar row and its disk dc_success wired through
// the seam.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import { extractConditionsFromSaveEffect } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const roar = () => monsters.find(m => m.index === 'sphinx-of-lore').actions[2];

describe('MA-1492 monsters.json data lock: Sphinx of Lore Mind-Rending Roar row (#1086 honest canon, golden bytes)', () => {
  it('disk row carries RAW block-save shape with dc_success "none" immediately after save_effect (byte order read from disk)', () => {
    const row = roar();
    expect(row.name).toBe('Mind-Rending Roar');
    expect(row.save_dc).toBe(16);
    expect(row.save_type).toBe('Wisdom');
    expect(row.range).toBe('300-foot Emanation'); // MA-0590 radius picker lane
    expect(row.recharge).toBe('5-6');
    // Positive prose anchors first: only Failure names damage — success pays ZERO,
    // so the /half/i absences below are not vacuous.
    expect(row.description).toMatch(/Failure:\s*35 \(10d6\) Psychic damage/);
    expect(row.save_effect).toMatch(/takes 35 \(10d6\) Psychic damage and has the Incapacitated condition/);
    // Negative: no half-on-success clause anywhere on the row to contradict it.
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    // dracolich/salamander byte-twin placement: dc_success authored last,
    // right after save_effect. Pins KEY PRESENCE too — absent would not flip
    // the seam answer (undefined also falls through to zero), so this data
    // lock is the only absence guard.
    const keys = Object.keys(row);
    expect(row.dc_success).toBe('none');
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_effect') + 1);
    // Fail-branch condition extraction byte-intact beside the field add.
    expect(extractConditionsFromSaveEffect(row.save_effect)).toEqual(['incapacitated']);
  });
});

describe('MA-1492 save seam paid through the Roar row: full on fail, ZERO on success', () => {
  it('disk dc_success wired live: live-leak raws 28 (half-paid 14, hp 999→985) and 41 (half-paid 20, 985→965) pay full on fail, zero on success — never half (#1187 falsifier: regress disk dc_success to "half" pays 14/20 on success, fails here; key absence fails the disk lock above)', () => {
    const dcSuccess = roar().dc_success;
    expect(computeDamageAfterSave(28, false, dcSuccess)).toBe(28);
    expect(computeDamageAfterSave(28, true, dcSuccess)).toBe(0);
    expect(computeDamageAfterSave(41, false, dcSuccess)).toBe(41);
    expect(computeDamageAfterSave(41, true, dcSuccess)).toBe(0);
    // Radius-picker AoE lane (evasion inactive): same contract.
    expect(computeDamageAfterEvasion(28, false, dcSuccess, false)).toBe(28);
    expect(computeDamageAfterEvasion(28, true, dcSuccess, false)).toBe(0);
    // Falsifier: a regression to "half" changes this row's success answer —
    // differential only, the half arithmetic itself is owned by helpers :95-99.
    expect(computeDamageAfterSave(28, true, 'half')).not.toBe(computeDamageAfterSave(28, true, dcSuccess));
  });
});
