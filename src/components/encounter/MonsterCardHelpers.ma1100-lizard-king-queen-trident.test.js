// MA-1100: Lizard King/Queen Trident versatile "or 7 (1d8 + 3) piercing
// damage if used with two hands to make a melee attack" had NO authored
// damage_dice_two_handed transport field — buildTwoHandedVariantOffer
// returned null (MonsterCardHelpers.js:794) so the §166 HIT-popup chooser
// never rendered and 1d8 + 3 was structurally unreachable (FAIL(a)-DATA).
// One-field fix authors damage_dice_two_handed "1d8 + 3" mirroring the
// MA-1063 kuo-toa Spear / MA-0959 half-ogre Battleaxe placement (after
// damage_dice_primary, before damage_type_primary). The ranged band "20/60"
// stays prose (§150/§193 no-seam family) — no damage_dice_ranged in scope.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';
import { buildSecondaryDamageTransport } from './MonsterCardModal.jsx';

describe('MA-1100 data lock (monsters.json Lizard King/Queen Trident)', () => {
  const tridentRow = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const trident = monsters.find((m) => m.index === 'lizard-king-queen').actions[3];
    expect(trident.name).toBe('Trident');
    return trident;
  };

  it('actions[3] Trident authors damage_dice_two_handed "1d8 + 3" beside the 1d6 + 3 primary (MA-1063/0959 placement)', () => {
    const trident = tridentRow();
    expect(trident.attack_bonus).toBe(5);
    expect(trident.damage_dice_primary).toBe('1d6 + 3');
    expect(trident.damage_dice_two_handed).toBe('1d8 + 3');
    expect(trident.damage_type_primary).toBe('Piercing');
    expect(trident.description).toMatch(/1d8 \+ 3\) piercing damage if used with two hands to make a melee attack/);
  });

  it('no additive/ranged misfire fields on the row: damage_dice_secondary ABSENT', () => {
    const trident = tridentRow();
    expect(trident.damage_dice_secondary).toBeUndefined();
    expect(trident.flat_damage_secondary).toBeUndefined();
  });

  it('buildTwoHandedVariantOffer arms the Trident HIT-popup chooser with both formulas', () => {
    const offer = buildTwoHandedVariantOffer(tridentRow(), 'Trident');
    expect(offer).toMatchObject({
      formula: '1d8 + 3',
      baseFormula: '1d6 + 3',
      damageType: 'Piercing',
      attackName: 'Trident',
    });
    expect(offer.label).toContain('1d8 + 3');
  });

  it('buildSecondaryDamageTransport stays byte-inert — no additive secondary pool', () => {
    expect(buildSecondaryDamageTransport(tridentRow(), 'Trident')).toEqual({
      autoDamageSecondaryFormula: null,
      autoDamageSecondaryName: null,
      autoDamageSecondaryDamageType: null,
    });
  });

  it('select logs: two-handed rides 1d8 + 3, unpicked default is one-handed 1d6 + 3 only', () => {
    const offer = buildTwoHandedVariantOffer(tridentRow(), 'Trident');
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Lizard King/Queen 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain('1d8 + 3');
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Lizard King/Queen 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain('1d6 + 3');
  });

  it('Bite/Claws siblings stay byte-inert — no chooser, no secondary transport', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const lizard = monsters.find((m) => m.index === 'lizard-king-queen');
    expect(buildTwoHandedVariantOffer(lizard.actions[1], 'Bite')).toBeNull();
    expect(buildSecondaryDamageTransport(lizard.actions[1], 'Bite').autoDamageSecondaryFormula).toBeNull();
    expect(buildTwoHandedVariantOffer(lizard.actions[2], 'Claws')).toBeNull();
    expect(buildSecondaryDamageTransport(lizard.actions[2], 'Claws').autoDamageSecondaryFormula).toBeNull();
  });
});
