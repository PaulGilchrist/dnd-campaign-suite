// MA-1608: Tribal Warrior Spear advertised versatile two-handed variant
// ("or 5 (1d8 + 1) piercing damage if used with two hands to make a melee
// attack") but damage_dice_two_handed was ABSENT — buildTwoHandedVariantOffer
// early-returned null (MonsterCardHelpers.js:992) so the HIT popup paid
// 1d6 + 1 with zero GM chooser (prose-only FAIL(a), MA-0325/0636/0871/1063
// family). One-field DATA fix adds damage_dice_two_handed "1d8 + 1" in the
// Azer/MA-1063 byte-shape (after damage_dice_primary, before
// damage_type_primary; two-handed leg rides primary type "piercing"), making
// the row a byte-twin of the Kuo-Toa Spear (MA-1063). The "or … if used
// with two hands" conjunction is ALTERNATIVE dice (§415) — damage_dice_secondary
// must stay absent (additive combined transport would over-deal every hit).
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';
import { buildSecondaryDamageTransport } from './MonsterCardModal.jsx';

describe('MA-1608 data lock (monsters.json Tribal Warrior Spear)', () => {
  const spearRow = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const spear = monsters.find((m) => m.name === 'Tribal Warrior').actions[0];
    expect(spear.name).toBe('Spear');
    return spear;
  };

  it('actions[0] Spear authors damage_dice_two_handed "1d8 + 1" beside the 1d6 + 1 primary (MA-1063 placement)', () => {
    const spear = spearRow();
    expect(spear.attack_bonus).toBe(3);
    expect(spear.damage_dice_primary).toBe('1d6 + 1');
    expect(spear.damage_dice_two_handed).toBe('1d8 + 1');
    expect(spear.damage_type_primary).toBe('piercing');
    expect(spear.description).toMatch(/1d8 \+ 1\) piercing damage if used with two hands to make a melee attack/);
  });

  it('key order mirrors the Kuo-Toa MA-1063 byte-twin (two_handed after primary, before damage_type_primary)', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const tribalKeys = Object.keys(spearRow());
    const kuoKeys = Object.keys(monsters.find((m) => m.name === 'Kuo-Toa').actions[1]);
    expect(tribalKeys).toEqual(kuoKeys);
    expect(tribalKeys.indexOf('damage_dice_two_handed')).toBe(tribalKeys.indexOf('damage_dice_primary') + 1);
  });

  it('wrong-slot additive fields stay GONE: "or … two hands" is alternative dice, not a combined rider (§415)', () => {
    const spear = spearRow();
    expect(spear.damage_dice_secondary).toBeUndefined();
    expect(spear.flat_damage_secondary).toBeUndefined();
    expect(spear.damage_dice_ranged).toBeUndefined();
    expect(buildSecondaryDamageTransport(spear, 'Spear').autoDamageSecondaryFormula).toBeNull();
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

  it('select logs: two-handed rides 1d8 + 1, unpicked default is one-handed 1d6 + 1 only', () => {
    const offer = buildTwoHandedVariantOffer(spearRow(), 'Spear');
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Tribal Warrior 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain('1d8 + 1');
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Tribal Warrior 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain('1d6 + 1');
  });

  it('orc-family "plus 1d8" rider Spears stay byte-untouched (MA-1264/1267 shapes — not swept by this fix)', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const eye = monsters.find((m) => m.name === 'Orc Eye of Gruumsh').actions[0];
    expect(eye.damage_dice_primary).toBe('1d6 + 3 plus 1d8');
    expect(eye.damage_dice_two_handed).toBe('2d8 + 3');
    const chief = monsters.find((m) => m.name === 'Orc War Chief').actions[2];
    expect(chief.damage_dice_primary).toBe('1d6 + 4 plus 1d8');
    expect(chief.damage_dice_two_handed).toBe('2d8 + 4');
  });
});
