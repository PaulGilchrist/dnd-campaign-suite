// MA-0965: Half-Red Dragon Veteran Longsword versatile clause was inert-by-
// construction — prose-only "or 8 (1d10 + 3) ... if used with two hands" with
// no authored damage_dice_two_handed (buildTwoHandedVariantOffer returned null
// → zero HIT-popup chooser, §166 toggle audit 0 switches/radiogroup/tablist).
// One-field DATA fix, mirroring the MA-0636/MA-0652/MA-0959 twin placement
// (damage_dice_two_handed after damage_dice_primary, before damage_type_primary;
// two-handed leg rides damage_type_primary slashing). Description untouched.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';

describe('MA-0965 data lock (monsters.json Half-Red Dragon Veteran Longsword)', () => {
  const longsword = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const row = monsters.find((m) => m.name === 'Half-Red Dragon Veteran').actions[1];
    expect(row.name).toBe('Longsword');
    return row;
  };

  it('actions[1] Longsword authors damage_dice_two_handed "1d10 + 3" beside the 1d8 + 3 primary (MA-0636/0652/0959 placement)', () => {
    const row = longsword();
    expect(row.attack_bonus).toBe(5);
    expect(row.damage_dice_primary).toBe('1d8 + 3');
    expect(row.damage_dice_two_handed).toBe('1d10 + 3');
    expect(row.damage_type_primary).toBe('slashing');
  });

  it('authored prose stays byte-intact and matches the fixed field (8 = 1d10 + 3)', () => {
    const row = longsword();
    expect(row.description).toContain('7 (1d8 + 3) slashing damage, or 8 (1d10 + 3) slashing damage if used with two hands.');
    expect(row.description).not.toMatch(/1dl0|1d1O/);
  });

  it('buildTwoHandedVariantOffer arms the veteran HIT-popup chooser with both formulas', () => {
    const offer = buildTwoHandedVariantOffer(longsword(), 'Longsword');
    expect(offer).toMatchObject({
      formula: '1d10 + 3',
      baseFormula: '1d8 + 3',
      damageType: 'slashing',
      attackName: 'Longsword',
    });
    expect(offer.label).toContain('1d10 + 3');
  });

  it('select logs record each choice with the correct formula', () => {
    const offer = buildTwoHandedVariantOffer(longsword(), 'Longsword');
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Half-Red Dragon Veteran 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain('1d10 + 3');
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Half-Red Dragon Veteran 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain('1d8 + 3');
  });

  it('Shortsword sibling stays byte-inert — no chooser, no two-handed field', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const shortsword = monsters.find((m) => m.name === 'Half-Red Dragon Veteran').actions[2];
    expect(shortsword.name).toBe('Shortsword');
    expect(shortsword.damage_dice_two_handed).toBeUndefined();
    expect(buildTwoHandedVariantOffer(shortsword, 'Shortsword')).toBeNull();
  });
});
