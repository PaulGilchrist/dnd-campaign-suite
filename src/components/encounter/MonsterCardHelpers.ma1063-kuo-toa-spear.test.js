// MA-1063: Kuo-Toa Spear versatile "or 5 (1d8 + 1) ... if used with two
// hands to make a melee attack" was misfiled into damage_dice_secondary —
// the §118/MA-0426/0531 ADDITIVE combined transport auto-rolled BOTH pools
// on EVERY hit (FAIL(a) wrong-slot over-deal: live ledger paid 1d6+1 PLUS
// 1d8+1, e.g. nat13+3 hit → 7+3=10, RAW one-handed max 7). One-field DATA
// fix renames the slot to damage_dice_two_handed, mirroring the
// MA-0871 Gnoll Spear byte-twin placement (after damage_dice_primary, before
// damage_type_primary; two-handed leg rides damage_type_primary piercing):
// buildTwoHandedVariantOffer now arms the §166 HIT-popup chooser and
// buildSecondaryDamageTransport goes byte-inert for the row.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';
import { buildSecondaryDamageTransport } from './MonsterCardModal.jsx';

describe('MA-1063 data lock (monsters.json Kuo-Toa Spear)', () => {
  const spearRow = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const spear = monsters.find((m) => m.name === 'Kuo-Toa').actions[1];
    expect(spear.name).toBe('Spear');
    return spear;
  };

  it('actions[1] Spear authors damage_dice_two_handed "1d8 + 1" beside the 1d6 + 1 primary (MA-0871/0636/0652 placement)', () => {
    const spear = spearRow();
    expect(spear.attack_bonus).toBe(3);
    expect(spear.damage_dice_primary).toBe('1d6 + 1');
    expect(spear.damage_dice_two_handed).toBe('1d8 + 1');
    expect(spear.damage_type_primary).toBe('piercing');
    expect(spear.description).toMatch(/1d8 \+ 1\) piercing damage if used with two hands to make a melee attack/);
  });

  it('wrong-slot additive fields are GONE: no damage_dice_secondary (§118 combined transport dead for this row)', () => {
    const spear = spearRow();
    expect(spear.damage_dice_secondary).toBeUndefined();
    expect(spear.flat_damage_secondary).toBeUndefined();
  });

  it('buildTwoHandedVariantOffer arms the Spear HIT-popup chooser with both formulas', () => {
    const offer = buildTwoHandedVariantOffer(spearRow(), 'Spear');
    expect(offer).toMatchObject({
      formula: '1d8 + 1',
      baseFormula: '1d6 + 1',
      damageType: 'piercing',
      attackName: 'Spear',
    });
    expect(offer.label).toContain('1d8 + 1');
  });

  it('buildSecondaryDamageTransport is byte-inert — no autoDamageSecondaryFormula additive stacking', () => {
    expect(buildSecondaryDamageTransport(spearRow(), 'Spear')).toEqual({
      autoDamageSecondaryFormula: null,
      autoDamageSecondaryName: null,
      autoDamageSecondaryDamageType: null,
    });
  });

  it('select logs: two-handed rides 1d8 + 1, unpicked default is single-hand 1d6 + 1 only', () => {
    const offer = buildTwoHandedVariantOffer(spearRow(), 'Spear');
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Kuo-Toa 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain('1d8 + 1');
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Kuo-Toa 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain('1d6 + 1');
  });

  it('Bite/Net siblings stay byte-inert — no chooser, no secondary transport', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const kuoToa = monsters.find((m) => m.name === 'Kuo-Toa');
    expect(buildTwoHandedVariantOffer(kuoToa.actions[0], 'Bite')).toBeNull();
    expect(buildSecondaryDamageTransport(kuoToa.actions[0], 'Bite').autoDamageSecondaryFormula).toBeNull();
    expect(buildTwoHandedVariantOffer(kuoToa.actions[2], 'Net')).toBeNull();
    expect(buildSecondaryDamageTransport(kuoToa.actions[2], 'Net').autoDamageSecondaryFormula).toBeNull();
  });
});
