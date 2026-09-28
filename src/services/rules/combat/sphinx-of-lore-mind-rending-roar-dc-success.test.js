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
// dracolich Terrifying Presence/salamander Constrict), consumed live via
// computeDamageAfterSave(…, 'none') = 0 on success (fd:0, NO hp_change,
// §959), full raw on failure. Incapacitated stays FAIL-only regardless —
// picker grant rides resolveSaveFailGrant→applySaveFailConditions
// early-return on saveSuccess (§63 trap-check: 'none' never suppresses the
// fail-side grant; MA-1460/MA-1484/MA-1486 twins).
import { describe, it, expect } from 'vitest';
import { computeDamageAfterEvasion, computeDamageAfterSave } from './applyDamage.js';
import { extractConditionsFromSaveEffect } from '../../../components/encounter/MonsterCardHelpers.js';
import monsters from '../../../../public/data/monsters.json';

const sphinx = () => monsters.find(m => m.index === 'sphinx-of-lore');
const roar = () => sphinx().actions[2];

describe('MA-1492 monsters.json data lock: Sphinx of Lore Mind-Rending Roar row', () => {
  const row = roar();

  it('is the Mind-Rending Roar emanation block-save row', () => {
    expect(row.name).toBe('Mind-Rending Roar');
    expect(row.save_dc).toBe(16);
    expect(row.save_type).toBe('Wisdom');
    expect(row.range).toBe('300-foot Emanation');
    expect(row.recharge).toBe('5-6');
  });

  it('canonical prose carries NO half-on-success clause (RAW success = unaffected)', () => {
    expect(row.description).not.toMatch(/half/i);
    expect(row.save_effect).not.toMatch(/half/i);
    expect(row.description).toMatch(/Failure:\s*35 \(10d6\) Psychic damage/);
    expect(row.save_effect).toMatch(/takes 35 \(10d6\) Psychic damage and has the Incapacitated condition/);
  });

  it('dc_success authored "none" (half-default leak guard)', () => {
    expect(row.dc_success).toBe('none');
  });

  it('fail-branch condition extraction stays intact beside the field add', () => {
    expect(extractConditionsFromSaveEffect(row.save_effect)).toEqual(['incapacitated']);
  });
});

describe('MA-1492 save seam pays full on fail, ZERO on success with dc_success "none"', () => {
  const dcSuccess = roar().dc_success;

  it('computeDamageAfterSave: raw 28 full on fail, zero on success', () => {
    expect(computeDamageAfterSave(28, false, dcSuccess)).toBe(28);
    expect(computeDamageAfterSave(28, true, dcSuccess)).toBe(0);
  });

  it('computeDamageAfterEvasion (no evasion): zero on success, full on fail', () => {
    expect(computeDamageAfterEvasion(28, false, dcSuccess, false)).toBe(28);
    expect(computeDamageAfterEvasion(28, true, dcSuccess, false)).toBe(0);
  });
});
