// MA-0871: Gnoll Spear versatile "or 1d8 + 2 if used with two hands" was
// misfiled into damage_dice_secondary — the MA-0426/0531 ADDITIVE combined
// transport auto-rolled BOTH pools on EVERY hit (FAIL(a) double-charge: RAW
// one-handed max 8, live ledger paid 16). One-field DATA fix mirrors the
// MA-0325/MA-0652 twin placement (damage_dice_two_handed after primary,
// before damage_type_primary; two-handed leg rides damage_type_primary):
// buildTwoHandedVariantOffer now arms the HIT-popup chooser and
// buildSecondaryDamageTransport goes byte-inert for the row.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';
import { buildSecondaryDamageTransport } from './MonsterCardModal.jsx';

describe('MA-0871 data lock (monsters.json Gnoll Spear)', () => {
  const spearRow = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const spear = monsters.find((m) => m.name === 'Gnoll').actions[1];
    expect(spear.name).toBe('Spear');
    return spear;
  };

  it('actions[1] Spear authors damage_dice_two_handed "1d8 + 2" beside the 1d6 + 2 primary (MA-0636/0652 placement)', () => {
    const spear = spearRow();
    expect(spear.attack_bonus).toBe(4);
    expect(spear.damage_dice_primary).toBe('1d6 + 2');
    expect(spear.damage_dice_two_handed).toBe('1d8 + 2');
    expect(spear.damage_type_primary).toBe('Piercing');
    expect(spear.description).toMatch(/1d8 \+ 2\) piercing damage if used with two hands/);
  });

  it('combined-always rider fields are GONE: no damage_dice_secondary / damage_type_secondary', () => {
    const spear = spearRow();
    expect(spear.damage_dice_secondary).toBeUndefined();
    expect(spear.damage_type_secondary).toBeUndefined();
  });

  it('buildTwoHandedVariantOffer arms the Spear HIT-popup chooser with both formulas', () => {
    const offer = buildTwoHandedVariantOffer(spearRow(), 'Spear');
    expect(offer).toMatchObject({
      formula: '1d8 + 2',
      baseFormula: '1d6 + 2',
      damageType: 'Piercing',
      attackName: 'Spear',
    });
    expect(offer.label).toContain('1d8 + 2');
  });

  it('buildSecondaryDamageTransport is byte-inert — no autoDamageSecondaryFormula double-charge', () => {
    expect(buildSecondaryDamageTransport(spearRow(), 'Spear')).toEqual({
      autoDamageSecondaryFormula: null,
      autoDamageSecondaryName: null,
      autoDamageSecondaryDamageType: null,
    });
  });

  it('select logs record each choice with the correct formula', () => {
    const offer = buildTwoHandedVariantOffer(spearRow(), 'Spear');
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Gnoll 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain('1d8 + 2');
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Gnoll 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain('1d6 + 2');
  });

  it('Gnoll Bite/Longbow siblings stay byte-inert', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const gnoll = monsters.find((m) => m.name === 'Gnoll');
    expect(buildTwoHandedVariantOffer(gnoll.actions[0], 'Bite')).toBeNull();
    expect(buildSecondaryDamageTransport(gnoll.actions[0], 'Bite').autoDamageSecondaryFormula).toBeNull();
    expect(buildTwoHandedVariantOffer(gnoll.actions[2], 'Longbow')).toBeNull();
    expect(buildSecondaryDamageTransport(gnoll.actions[2], 'Longbow').autoDamageSecondaryFormula).toBeNull();
  });
});
