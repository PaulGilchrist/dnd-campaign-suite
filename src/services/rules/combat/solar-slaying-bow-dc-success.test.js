// @maintained-by-ai
// MA-1477: Solar "Slaying Bow" (monsters.json solar|actions[2], DC 21
// Dexterity, range "600 feet") — three-field (+dc_success) DATA fix. Before
// the fix the row carried ONLY prose numerics: parseHpThresholdKillClause
// (MonsterCardHelpers.js, numeric hp_threshold_kill ONLY) → null → the
// instakill leg inert; no damage_dice_primary/secondary → the save-leg pools
// rolled NOTHING (MA-1475 prose-damage advisory family); dc_success ABSENT →
// resolveBlockSaveDcSuccess (MonsterCardModal.jsx) half-default leak
// (MV-20/§63), live-stamped dcSuccess:"half" while RAW success is
// silent-zero. Fix mirrors the MA-0352 Banshee Deathly Wail byte-shape
// (dc_success before hp_threshold_kill) plus the MA-0427 secondary-transport
// ordering twins (Brazen Gorgon Smelting Charge: damage_dice_secondary after
// the primary group) — consumed live via buildSecondaryDamageTransport →
// applySecondarySaveDamageLeg (saveProcessing.js).
// RAW: fail → ≤100 HP dies; otherwise 24 (4d8 + 6) Piercing + 36 (8d8)
// Radiant; success → none of it. Prose carries NO half-clause — dc_success
// "none" is the honest success-zero model (§63 trap-row discriminator is N/A:
// no non-damage success clause to gate, MA-1460 lineage). Generic half/none
// arithmetic at this seam is owned verbatim by applyDamage.helpers.test.js
// (:88-104, :184-196) and dice grammar/totals by diceRoller.test.js — this
// lane pins only the Slaying Bow row bytes (including the MA-0352/MA-0427
// key-order convention, cited by MA-1215) and its disk dc_success wired
// through the seam.
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import { parseHpThresholdKillClause } from '../../../components/encounter/MonsterCardHelpers.js';
import { canRollExpression } from '../../../services/dice/diceRoller.js';
import monsters from '../../../../public/data/monsters.json';

const solar = () => monsters.find(m => m.index === 'solar');
const row = () => solar().actions[2];

describe('MA-1477 monsters.json data lock: Solar Slaying Bow row (#1086 honest dc_success canon)', () => {
  it('disk row carries RAW block-save shape: identity, six numerics byte-exact, prose anchors match, NO half-clause, MA-0352/MA-0427 key order pinned', () => {
    const r = row();
    expect(r.name).toBe('Slaying Bow');
    expect(r.save_dc).toBe(21);
    expect(r.save_type).toBe('Dexterity');
    expect(r.range).toBe('600 feet');
    expect(r.damage_dice_primary).toBe('4d8 + 6');
    expect(r.damage_type_primary).toBe('Piercing');
    expect(r.damage_dice_secondary).toBe('8d8');
    expect(r.damage_type_secondary).toBe('Radiant');
    expect(r.hp_threshold_kill).toBe(100);
    expect(r.dc_success).toBe('none');
    // Disk dice strings are rollable (grammar/band arithmetic owned by diceRoller.test.js).
    expect(canRollExpression(r.damage_dice_primary)).toBe(true);
    expect(canRollExpression(r.damage_dice_secondary)).toBe(true);
    // Positive prose anchors first: only Failure names damage — instakill + full pools; success pays ZERO.
    expect(r.description).toMatch(/Failure: If the creature has 100 Hit Points or fewer, it dies\./);
    expect(r.description).toMatch(/takes 24 \(4d8 \+ 6\) Piercing damage plus 36 \(8d8\) Radiant damage\./);
    expect(r.save_effect).toMatch(/100 Hit Points or fewer, it dies/);
    expect(r.save_effect).toMatch(/4d8 \+ 6\) Piercing damage plus 36 \(8d8\) Radiant damage/);
    // Negative: no half-on-success clause anywhere on the row to contradict it.
    expect(r.description).not.toMatch(/half/i);
    expect(r.save_effect).not.toMatch(/half/i);
    // MA-0352 Banshee byte-shape: dc_success immediately before hp_threshold_kill;
    // MA-0427 twins: secondary pair after the primary group — exact adjacency chain.
    const keys = Object.keys(r);
    const i = k => keys.indexOf(k);
    expect(i('damage_dice_primary')).toBeGreaterThanOrEqual(0);
    expect(i('damage_type_primary')).toBe(i('damage_dice_primary') + 1);
    expect(i('damage_dice_secondary')).toBe(i('damage_type_primary') + 1);
    expect(i('damage_type_secondary')).toBe(i('damage_dice_secondary') + 1);
    expect(i('dc_success')).toBe(i('damage_type_secondary') + 1);
    expect(i('hp_threshold_kill')).toBe(i('dc_success') + 1);
  });
});

describe('MA-1477 save seam: disk dc_success wired live — full on fail, ZERO on success', () => {
  it('threshold 100 arms + both pools (24 Piercing / 36 Radiant prose raws) pay full on fail, zero on success via save AND evasion legs — never half (#1187 falsifier: regress disk dc_success to "half" pays 12/18 on success, flips the answer, fails here)', () => {
    const dcSuccess = row().dc_success;
    expect(parseHpThresholdKillClause(row())).toBe(100);
    expect(computeDamageAfterSave(24, false, dcSuccess)).toBe(24);
    expect(computeDamageAfterSave(36, false, dcSuccess)).toBe(36);
    expect(computeDamageAfterSave(24, true, dcSuccess)).toBe(0);
    expect(computeDamageAfterSave(36, true, dcSuccess)).toBe(0);
    expect(computeDamageAfterEvasion(24, false, dcSuccess, false)).toBe(24);
    expect(computeDamageAfterEvasion(36, false, dcSuccess, false)).toBe(36);
    expect(computeDamageAfterEvasion(24, true, dcSuccess, false)).toBe(0);
    expect(computeDamageAfterEvasion(36, true, dcSuccess, false)).toBe(0);
  });
});
