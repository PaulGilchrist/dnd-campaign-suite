// @maintained-by-ai
// MA-1436: Satyr Revelmaster Fey Melody choose-one variant — row disk lock +
// parseSaveVariantChooser unit truth table (this file is the parser's
// canonical arm/inert owner). Pre-fix the row carried both song variants in
// prose with range:"" — the chip press word-scanned "line of sight" into a
// fake 60-ft LINE picker and condition-sprayed Charmed + Frightened +
// Incapacitated together on every failed save, both songs at once, damage
// always paid. Post-fix the structured variants[] payload + "60-foot
// Emanation" range arm the variant chooser; the parser arms ONLY on
// structured arrays so every unauthored row stays byte-inert null.
//
// Owner lanes cited — coverage NOT duplicated here:
// - Per-variant outcomes (charmed+incapacitated / frightened application,
//   rounds:10 clock, dc_success none/half, Psychic damage, zero-damage leg,
//   chooserless guardrail): SaveAttackAoeModal.fey-melody-variant.test.jsx
//   (consumes the variants from disk).
// - Chooser UI offer/select/skip fork: SaveVariantChooserModal.test.jsx.
// - Emanation shape (range string → 60-ft Radius, never Line; §412):
//   MonsterCardModal.save-variant-shape.test.jsx.
// - MA-1878 te-bearing POSITIVE (Gaze arms with keys incl. te-only
//   "confusing", range "120 feet", DC 23): saveProcessing.ma1878-demogorgon-
//   gaze.test.js DATA lock + ma1881 inherit lane — Gaze positives cut here.
import { describe, it, expect } from 'vitest';
import { parseSaveVariantChooser, parseAnimalSpiritVariants, extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const FEY_MELODY = monstersData.find(m => m.index === 'satyr-revelmaster').actions.find(a => a.name === 'Fey Melody');
const byKey = Object.fromEntries(FEY_MELODY.variants.map(v => [v.key, v]));

describe('MA-1436 Fey Melody row disk lock — envelope, formula byte, spray fingerprint gone', () => {
  it('DC 14 WIS + recharge 4-6 + 60-foot Emanation; Frightening formula "2d6 + 3" Psychic; save_effect carries ZERO canonical condition words', () => {
    expect(FEY_MELODY.save_dc).toBe(14);
    expect(FEY_MELODY.save_type).toBe('Wisdom');
    expect(FEY_MELODY.recharge).toBe('4-6');
    expect(FEY_MELODY.range).toBe('60-foot Emanation');
    expect(FEY_MELODY.variants).toHaveLength(2);
    // The picker lane mocks dice, so the authored formula byte is pinned here.
    expect(byKey.frightening.damage_dice).toBe('2d6 + 3');
    expect(byKey.frightening.damage_type).toBe('Psychic');
    // MA-1436 regression fingerprint: the canonical §50 extractor sees
    // nothing in save_effect — per-variant effects ride variants[] only.
    expect(extractConditionsFromSaveEffect(FEY_MELODY.save_effect)).toEqual([]);
  });
});

describe('parseSaveVariantChooser — structured arm only, byte-inert elsewhere', () => {
  it('arms on the authored Fey Melody row (both variants survive the filter)', () => {
    const chooser = parseSaveVariantChooser(FEY_MELODY);
    expect(chooser).not.toBeNull();
    expect(chooser.variants).toHaveLength(2);
  });

  it('null truth table — unauthored rows, short payloads, incomplete entries (label required; conditions or NON-empty te required)', () => {
    expect(parseSaveVariantChooser(null)).toBeNull();
    expect(parseSaveVariantChooser({ name: 'Ram', save_dc: 15, save_effect: 'Failure: 3d6 bludgeoning.' })).toBeNull();
    expect(parseSaveVariantChooser({ variants: [{ key: 'a', label: 'A', conditions: ['prone'] }] })).toBeNull();
    // label required — a te-bearing entry without one is filtered, leaving <2 (MA-1878 boundary).
    expect(parseSaveVariantChooser({ variants: [{ key: 'a', te: 'confusion' }, { key: 'b', label: 'B', conditions: ['prone'] }] })).toBeNull();
    // effect required, and te must be a NON-empty string to complete (MA-1878 boundary).
    expect(parseSaveVariantChooser({ variants: [{ key: 'a', label: 'A', conditions: [] }, { key: 'b', label: 'B' }] })).toBeNull();
    expect(parseSaveVariantChooser({ variants: [{ key: 'a', label: 'A', te: '' }, { key: 'b', label: 'B', conditions: [] }] })).toBeNull();
  });

  it('MA-0275 Animal Spirit prose chooser rows stay chooser-inert for the generic arm', () => {
    const beastLord = monstersData.find(m => (m.actions || []).some(a => parseAnimalSpiritVariants(a)));
    expect(beastLord).toBeTruthy();
    const spiritRow = beastLord.actions.find(a => parseAnimalSpiritVariants(a));
    expect(parseSaveVariantChooser(spiritRow)).toBeNull();
  });
});
