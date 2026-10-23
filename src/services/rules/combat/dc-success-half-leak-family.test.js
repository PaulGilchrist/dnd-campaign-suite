// @maintained-by-ai
// fix#172 family (census test-maintain-bugs.md:1320): the five same-class
// monsters.json rows with NO dedicated per-row lane — Kraken "Swallow",
// Tarrasque "Tail", Pit Fiend "Bite", Dragon Turtle "Tail", Adult Blue
// Dracolich "Wing Attack (Costs 2 Actions)" — carried Failure:-only save
// prose + a damage pool (save-leg formula, MonsterCardHelpers saveChipPlan:
// legacy chips roll damage_dice_primary) with dc_success ABSENT, so the
// MV-20 half default (resolveBlockSaveDcSuccess, MonsterCardModal.jsx:286 ->
// computeDamageAfterSave, applyDamage.js:93) paid half on a RAW success that
// takes NOTHING. DATA fix per row: single-key dc_success:"none" authored
// immediately after save_type (MA-0030 placement — the fix#172 MA-1578
// byte-shape), consumed via computeDamageAfterSave zero-on-success.
// Rider-only rows (Tail x2/Bite x2: saveChipPlan formula null) get the same
// authored key so the picker never fabricates "takes half damage" copy
// (§335 one-fingerprint law); the damage-bearing legs (Kraken Swallow,
// Dracolich Wing) additionally close the real half-payment leak.
// Lanes NOT re-fingerprinted here (cite-skip): Pseudodragon Sting MA-1351,
// Thri-Kreen/Homunculus margins MA-1584/MA-1000, Drow MA-0639, Wight
// MA-1718, Godzilla Nuclear Pulse MA-1916, Satyr variants MA-1436.
// KEPT rows (triage verdicts, owner RAW-discipline — do NOT "fix"):
// Godzilla Nuclear Pulse — description byte "Success: Half damage" = lawful
// half (MA-1920 lane pins its ABSENCE); Satyr Fey Melody row-level stays
// variant-neutral (per-variant dc_success none/half authored in the payload,
// resolveBlockSaveDcSuccess is consulted only when no variant dc_success).
import { describe, it, expect } from 'vitest';
import { computeDamageAfterSave } from './applyDamage.js';
import monsters from '../../../../public/data/monsters.json';

const row = (monster, name, section = 'actions') =>
  monsters.find(m => m.name === monster)[section].find(a => a.name === name);

const FIXED = [
  ['Kraken', 'Swallow', 25, 'Dexterity', 'Failure: 23 (3d8 + 10) Piercing damage'],
  ['Tarrasque', 'Tail', 20, 'Strength', 'Failure: knocked prone'],
  ['Pit Fiend', 'Bite', 21, 'Constitution', 'Failure: The target has the Poisoned condition'],
  ['Dragon Turtle', 'Tail', 20, 'Strength', 'Failure: be pushed up to 10 feet away from the dragon turtle and knocked prone.'],
  ['Adult Blue Dracolich', 'Wing Attack (Costs 2 Actions)', 21, 'Dexterity', 'Failure: 14 (2d6 + 7) Bludgeoning damage. The target is also knocked prone.'],
];

describe('fix#172 family: Failure:-only rows authored dc_success "none" (MA-0030 placement)', () => {
  it.each(FIXED)('%s "%s" disk row: Failure-only prose, none after save_type, no half clause anywhere', (monster, name, dc, saveType, saveEffect) => {
    const a = row(monster, name, monster === 'Adult Blue Dracolich' ? 'legendary_actions' : 'actions');
    expect(a.name).toBe(name);
    expect(a.save_dc).toBe(dc);
    expect(a.save_type).toBe(saveType);
    expect(a.save_effect).toContain(saveEffect);
    // Negative: no half-on-success clause on the row to contradict the none.
    expect(a.save_effect).not.toMatch(/half/i);
    expect(a.description).not.toMatch(/success\s*:/i);
    expect(a.dc_success).toBe('none');
    const keys = Object.keys(a);
    expect(keys.indexOf('dc_success')).toBe(keys.indexOf('save_type') + 1);
  });

  it('computeDamageAfterSave tri-arm on the authored key: fail pays FULL, success pays ZERO, never half (#1348 pattern)', () => {
    for (const [monster, name] of FIXED) {
      const a = row(monster, name, monster === 'Adult Blue Dracolich' ? 'legendary_actions' : 'actions');
      expect(a.dc_success).toBe('none');
      // prose example roll + live-bug falsifier roll: half-default would pay
      // floor(raw/2) > 0 and fail this arm.
      for (const raw of [10, 9]) {
        expect(computeDamageAfterSave(raw, false, a.dc_success)).toBe(raw);
        expect(computeDamageAfterSave(raw, true, a.dc_success)).toBe(0);
      }
    }
  });
});

describe('fix#172 family KEPT rows: lawful half + variant-neutral stay unauthored', () => {
  it('Godzilla "Nuclear Pulse (Costs 2 Actions)": description bytes "Success: Half damage" — MV-20 half default is RAW-correct (MA-1920 lane owns the lock)', () => {
    const a = row('Godzilla', 'Nuclear Pulse (Costs 2 Actions)', 'legendary_actions');
    expect(a.description).toContain('Success: Half damage');
    expect(a.dc_success).toBeUndefined();
    // lawful half arithmetic (falsifier: none-authored would zero the leg)
    expect(computeDamageAfterSave(53, false, a.dc_success ?? 'half')).toBe(53);
    expect(computeDamageAfterSave(53, true, a.dc_success ?? 'half')).toBe(26);
  });

  it('Satyr Revelmaster "Fey Melody": row-level dc_success stays variant-neutral — the variants payload owns none (charming) / half (frightening)', () => {
    const a = row('Satyr Revelmaster', 'Fey Melody');
    expect(a.dc_success).toBeUndefined();
    expect(a.variants.find(v => v.key === 'charming').dc_success).toBe('none');
    expect(a.variants.find(v => v.key === 'frightening').dc_success).toBe('half');
    expect(computeDamageAfterSave(10, true, 'half')).toBe(5);
    expect(computeDamageAfterSave(10, true, 'none')).toBe(0);
  });

  it('census triage report row: Ancient Gold Dragon "Weakening Breath" stays unauthored (debuff-only te lane MA-0102, no damage pool key — flagged, not self-fixed)', () => {
    const a = row('Ancient Gold Dragon', 'Weakening Breath');
    expect(a.damage_dice_primary).toBeUndefined();
    expect(a.dc_success).toBeUndefined();
  });
});
