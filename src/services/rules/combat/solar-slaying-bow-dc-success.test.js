// MA-1477: Solar "Slaying Bow" (solar|actions|2, DC 21 Dexterity, range
// "600 feet") — three-field (+dc_success) DATA fix. Before the fix the row
// carried ONLY prose numerics: parseHpThresholdKillClause (MonsterCardHelpers
// .js:849, numeric hp_threshold_kill ONLY) → null, applyHpThresholdKill
// (saveProcessing.js:1243 `if (!Number.isFinite(threshold)) return false`)
// never consulted → instakill leg inert; no damage_dice_primary/secondary →
// the save-leg pools rolled NOTHING (MA-1475 prose-damage advisory family);
// dc_success ABSENT → resolveBlockSaveDcSuccess (MonsterCardModal.jsx:265)
// half-default leak (MV-20/§63), live-stamped dcSuccess:"half" while RAW
// success is silent-zero.
// Fix mirrors the MA-0352 Banshee Deathly Wail byte-shape (dc_success before
// hp_threshold_kill) plus the MA-0427 secondary-transport ordering twins
// (Brazen Gorgon Smelting Charge: damage_dice_secondary after the primary
// group) — consumed live via buildSecondaryDamageTransport (:999) →
// applySecondarySaveDamageLeg (saveProcessing.js:1174).
// RAW: fail → ≤100 HP dies; otherwise 24 (4d8 + 6) Piercing + 36 (8d8)
// Radiant; success → none of it. Prose carries NO half-clause — dc_success
// "none" is the honest success-zero model (§63 trap-row discriminator is N/A:
// no non-damage success clause to gate, MA-1460 lineage).
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import { parseHpThresholdKillClause } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const solar = () => monsters.find(m => m.index === 'solar');
const row = () => solar().actions[2];

describe('MA-1477 monsters.json data lock: Solar Slaying Bow row', () => {
  it('is the Slaying Bow save row', () => {
    const r = row();
    expect(r.name).toBe('Slaying Bow');
    expect(r.save_dc).toBe(21);
    expect(r.save_type).toBe('Dexterity');
    expect(r.range).toBe('600 feet');
  });

  it('authors all six numeric fields byte-exact', () => {
    const r = row();
    expect(r.damage_dice_primary).toBe('4d8 + 6');
    expect(r.damage_type_primary).toBe('Piercing');
    expect(r.damage_dice_secondary).toBe('8d8');
    expect(r.damage_type_secondary).toBe('Radiant');
    expect(r.hp_threshold_kill).toBe(100);
    expect(r.dc_success).toBe('none');
  });

  it('MA-0352 Banshee byte-shape: dc_success authored immediately before hp_threshold_kill; MA-0427: secondary pair after the primary group', () => {
    const keys = Object.keys(row());
    const iPrimary = keys.indexOf('damage_dice_primary');
    const iPrimaryType = keys.indexOf('damage_type_primary');
    const iSecondary = keys.indexOf('damage_dice_secondary');
    const iSecondaryType = keys.indexOf('damage_type_secondary');
    const iDc = keys.indexOf('dc_success');
    const iThreshold = keys.indexOf('hp_threshold_kill');
    expect(iPrimary).toBeGreaterThanOrEqual(0);
    expect(iPrimaryType).toBe(iPrimary + 1);
    expect(iSecondary).toBe(iPrimaryType + 1);
    expect(iSecondaryType).toBe(iSecondary + 1);
    expect(iDc).toBe(iSecondaryType + 1);
    expect(iThreshold).toBe(iDc + 1);
  });

  it('prose matches the authored numerics and carries NO half-on-success clause', () => {
    const r = row();
    expect(r.description).toMatch(/If the creature has 100 Hit Points or fewer, it dies\./);
    expect(r.description).toMatch(/takes 24 \(4d8 \+ 6\) Piercing damage plus 36 \(8d8\) Radiant damage\./);
    expect(r.save_effect).toMatch(/100 Hit Points or fewer, it dies/);
    expect(r.save_effect).toMatch(/4d8 \+ 6\) Piercing damage plus 36 \(8d8\) Radiant damage/);
    expect(r.description).not.toMatch(/half/i);
    expect(r.save_effect).not.toMatch(/half/i);
  });
});

describe('MA-1477 save seam semantics with the authored fields', () => {
  const dcSuccess = row().dc_success;

  it('parseHpThresholdKillClause arms the numeric threshold (100) on the row', () => {
    expect(parseHpThresholdKillClause(row())).toBe(100);
  });

  it('computeDamageAfterSave: raw pools full on fail, ZERO on success (dc_success none)', () => {
    expect(computeDamageAfterSave(24, false, dcSuccess)).toBe(24);
    expect(computeDamageAfterSave(36, false, dcSuccess)).toBe(36);
    expect(computeDamageAfterSave(24, true, dcSuccess)).toBe(0);
    expect(computeDamageAfterSave(36, true, dcSuccess)).toBe(0);
  });

  it('computeDamageAfterEvasion (no evasion): full on fail, zero on success, both legs', () => {
    expect(computeDamageAfterEvasion(24, false, dcSuccess, false)).toBe(24);
    expect(computeDamageAfterEvasion(36, false, dcSuccess, false)).toBe(36);
    expect(computeDamageAfterEvasion(24, true, dcSuccess, false)).toBe(0);
    expect(computeDamageAfterEvasion(36, true, dcSuccess, false)).toBe(0);
  });

  it('pools roll clean inside RAW bands: Piercing 4d8+6 = 10–38, Radiant 8d8 = 8–64', async () => {
    const { rollExpression, canRollExpression } = await import('../../../services/dice/diceRoller.js');
    expect(canRollExpression(row().damage_dice_primary)).toBe(true);
    expect(canRollExpression(row().damage_dice_secondary)).toBe(true);
    for (let i = 0; i < 200; i++) {
      const p = rollExpression(row().damage_dice_primary);
      const s = rollExpression(row().damage_dice_secondary);
      expect(p.total).toBeGreaterThanOrEqual(10);
      expect(p.total).toBeLessThanOrEqual(38);
      expect(s.total).toBeGreaterThanOrEqual(8);
      expect(s.total).toBeLessThanOrEqual(64);
    }
  });
});
