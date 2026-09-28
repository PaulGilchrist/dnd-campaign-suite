// MA-1436: Satyr Revelmaster Fey Melody choose-one variant — DATA lock +
// generic parseSaveVariantChooser arm. Pre-fix the row carried both song
// variants in prose with range:"" — the chip press word-scanned "line of
// sight" into a fake 60-ft LINE picker and condition-sprayed Charmed +
// Frightened + Incapacitated together on every failed save, both songs at
// once, damage always paid. Post-fix the structured variants[] payload +
// "60-foot Emanation" range arm the variant chooser; the parser arms ONLY
// on structured arrays so every unauthored row stays byte-inert null.
import { describe, it, expect } from 'vitest';
import { parseSaveVariantChooser, parseAnimalSpiritVariants, extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';
import monstersData from '../../../public/data/monsters.json';

const SATYR = monstersData.find(m => m.index === 'satyr-revelmaster');
const FEY_MELODY = SATYR.actions.find(a => a.name === 'Fey Melody');
const byKey = Object.fromEntries(FEY_MELODY.variants.map(v => [v.key, v]));

describe('MA-1436 Fey Melody DATA lock', () => {
  it('row keeps DC 14 WIS + recharge 4-6, range is a 60-foot Emanation', () => {
    expect(FEY_MELODY.save_dc).toBe(14);
    expect(FEY_MELODY.save_type).toBe('Wisdom');
    expect(FEY_MELODY.recharge).toBe('4-6');
    expect(FEY_MELODY.range).toBe('60-foot Emanation');
  });

  it('save_effect carries ZERO canonical condition words — the spray fingerprint is gone', () => {
    const CONDITIONS = ['blinded', 'charmed', 'cursed', 'deafened', 'frightened', 'grappled', 'incapacitated', 'paralyzed', 'petrified', 'poisoned', 'prone', 'restrained', 'stunned', 'unconscious'];
    const words = FEY_MELODY.save_effect.toLowerCase();
    const hits = CONDITIONS.filter(c => new RegExp(`\\b${c}\\b`).test(words));
    expect(hits).toEqual([]);
    expect(extractConditionsFromSaveEffect(FEY_MELODY.save_effect)).toEqual([]);
  });

  it('variants payload: Charming = charmed+incapacitated 10 rounds, no damage, success none', () => {
    expect(FEY_MELODY.variants).toHaveLength(2);
    expect(byKey.charming.conditions).toEqual(['charmed', 'incapacitated']);
    expect(byKey.charming.rounds).toBe(10);
    expect(byKey.charming.dc_success).toBe('none');
    expect(byKey.charming.damage_dice ?? null).toBeNull();
  });

  it('variants payload: Frightening = frightened 10 rounds, 2d6+3 Psychic half on success', () => {
    expect(byKey.frightening.conditions).toEqual(['frightened']);
    expect(byKey.frightening.rounds).toBe(10);
    expect(byKey.frightening.dc_success).toBe('half');
    expect(byKey.frightening.damage_dice).toBe('2d6 + 3');
    expect(byKey.frightening.damage_type).toBe('Psychic');
  });
});

describe('MA-1436 parseSaveVariantChooser — structured arm only, byte-inert elsewhere', () => {
  it('arms on the authored Fey Melody row', () => {
    const chooser = parseSaveVariantChooser(FEY_MELODY);
    expect(chooser).not.toBeNull();
    expect(chooser.variants.map(v => v.key)).toEqual(['charming', 'frightening']);
  });

  it('null for unauthored rows, one-variant rows, and malformed entries', () => {
    expect(parseSaveVariantChooser({ name: 'Ram', save_dc: 15, save_effect: 'Failure: 3d6 bludgeoning.' })).toBeNull();
    expect(parseSaveVariantChooser(null)).toBeNull();
    expect(parseSaveVariantChooser({ variants: [{ key: 'a', label: 'A', conditions: ['prone'] }] })).toBeNull();
    expect(parseSaveVariantChooser({ variants: [{ key: 'a', label: 'A', conditions: [] }, { key: 'b', label: 'B' }] })).toBeNull();
  });

  it('MA-0275 Animal Spirit prose chooser rows stay chooser-inert for the generic arm', () => {
    const beastLord = monstersData.find(m => (m.actions || []).some(a => parseAnimalSpiritVariants(a)));
    expect(beastLord).toBeTruthy();
    const spiritRow = beastLord.actions.find(a => parseAnimalSpiritVariants(a));
    expect(parseSaveVariantChooser(spiritRow)).toBeNull();
  });
});
