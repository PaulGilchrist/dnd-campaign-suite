// MA-0959: Half Ogre Battleaxe versatile clause was inert-by-construction —
// prose-only "or 14 (2d10 + 3) ... if used with two hands" with no authored
// damage_dice_two_handed (buildTwoHandedVariantOffer returns null → zero
// HIT-popup chooser) plus OCR corruption "2dl0" in the row description.
// One-field DATA fix + OCR repair, mirroring the MA-0325/MA-0636/MA-0652
// twin placement (damage_dice_two_handed after damage_dice_primary, before
// damage_type_primary; two-handed leg rides damage_type_primary).
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';

describe('MA-0959 data lock (monsters.json Half Ogre Battleaxe)', () => {
  const battleaxe = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const row = monsters.find((m) => m.name === 'Half Ogre').actions[0];
    expect(row.name).toBe('Battleaxe');
    return row;
  };

  it('actions[0] Battleaxe authors damage_dice_two_handed "2d10 + 3" beside the 2d8 + 3 primary (MA-0636/0652 placement)', () => {
    const row = battleaxe();
    expect(row.attack_bonus).toBe(5);
    expect(row.damage_dice_primary).toBe('2d8 + 3');
    expect(row.damage_dice_two_handed).toBe('2d10 + 3');
    expect(row.damage_type_primary).toBe('slashing');
  });

  it('OCR corruption repaired: description carries clean "2d10", no "2dl0" anywhere on the row', () => {
    const row = battleaxe();
    expect(row.description).toContain('14 (2d10 + 3) slashing damage if used with two hands');
    expect(row.description).not.toContain('2dl0');
  });

  it('buildTwoHandedVariantOffer arms the Half Ogre HIT-popup chooser with both formulas', () => {
    const offer = buildTwoHandedVariantOffer(battleaxe(), 'Battleaxe');
    expect(offer).toMatchObject({
      formula: '2d10 + 3',
      baseFormula: '2d8 + 3',
      damageType: 'slashing',
      attackName: 'Battleaxe',
    });
    expect(offer.label).toContain('2d10 + 3');
  });

  it('select logs record each choice with the correct formula', () => {
    const offer = buildTwoHandedVariantOffer(battleaxe(), 'Battleaxe');
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Half Ogre 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain('2d10 + 3');
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Half Ogre 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain('2d8 + 3');
  });

  it('Javelin sibling stays byte-inert — no chooser, no corrupt dice', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const javelin = monsters.find((m) => m.name === 'Half Ogre').actions[1];
    expect(javelin.name).toBe('Javelin');
    expect(javelin.damage_dice_two_handed).toBeUndefined();
    expect(buildTwoHandedVariantOffer(javelin, 'Javelin')).toBeNull();
  });
});
