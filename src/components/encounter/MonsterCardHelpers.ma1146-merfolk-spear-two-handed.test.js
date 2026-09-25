// MA-1146: Merfolk Spear versatile "or 4 (1d8) piercing damage if used with
// two hands to make a melee attack" had NO authored damage_dice_two_handed
// transport field — buildTwoHandedVariantOffer returned null
// (MonsterCardHelpers.js:794) so the §166 HIT-popup chooser never rendered
// and 1d8 was structurally unreachable (FAIL(a)-DATA). One-field fix authors
// damage_dice_two_handed "1d8" (prose carries no modifier) mirroring the
// MA-1100 Lizard King/Queen Trident / MA-1063 kuo-toa Spear placement (after
// damage_dice_primary, before damage_type_primary). The ranged band "20/60"
// stays prose (§150/§193 no-seam family) — no damage_dice_ranged in scope.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';
import { buildSecondaryDamageTransport } from './MonsterCardModal.jsx';

describe('MA-1146 data lock (monsters.json Merfolk Spear)', () => {
  const spearRow = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const spear = monsters.find((m) => m.index === 'merfolk').actions[0];
    expect(spear.name).toBe('Spear');
    return spear;
  };

  it('actions[0] Spear authors damage_dice_two_handed "1d8" beside the 1d6 primary (MA-1100/1063 placement, no modifier)', () => {
    const spear = spearRow();
    expect(spear.attack_bonus).toBe(2);
    expect(spear.damage_dice_primary).toBe('1d6');
    expect(spear.damage_dice_two_handed).toBe('1d8');
    expect(spear.damage_dice_two_handed).not.toBe(spear.damage_dice_primary);
    expect(spear.damage_type_primary).toBe('Piercing');
    expect(spear.description).toMatch(/1d8\) piercing damage if used with two hands to make a melee attack/);
  });

  it('no additive/ranged misfire fields on the row: damage_dice_secondary ABSENT', () => {
    const spear = spearRow();
    expect(spear.damage_dice_secondary).toBeUndefined();
    expect(spear.flat_damage_secondary).toBeUndefined();
  });

  it('buildTwoHandedVariantOffer arms the Spear HIT-popup chooser with both formulas', () => {
    const offer = buildTwoHandedVariantOffer(spearRow(), 'Spear');
    expect(offer).toMatchObject({
      formula: '1d8',
      baseFormula: '1d6',
      damageType: 'Piercing',
      attackName: 'Spear',
    });
    expect(offer.label).toContain('1d8');
  });

  it('buildSecondaryDamageTransport stays byte-inert — no additive secondary pool', () => {
    expect(buildSecondaryDamageTransport(spearRow(), 'Spear')).toEqual({
      autoDamageSecondaryFormula: null,
      autoDamageSecondaryName: null,
      autoDamageSecondaryDamageType: null,
    });
  });

  it('select logs: two-handed rides 1d8, unpicked default is one-handed 1d6 only', () => {
    const offer = buildTwoHandedVariantOffer(spearRow(), 'Spear');
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Merfolk 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain('1d8');
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Merfolk 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain('1d6');
  });

  it('Merfolk Skirmisher Ocean Spear sibling stays byte-inert for two-handed — no chooser (MA-1147 rides its own secondary leg)', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const skirmisher = monsters.find((m) => m.index === 'merfolk-skirmisher');
    expect(buildTwoHandedVariantOffer(skirmisher.actions[0], 'Ocean Spear')).toBeNull();
    expect(skirmisher.actions[0].damage_dice_two_handed).toBeUndefined();
  });
});
