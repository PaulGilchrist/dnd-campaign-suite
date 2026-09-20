// @improved-by-ai
// MA-0636: Drider Longsword advertised versatile two-handed 1d10+3 variant
// (monsters.json damage_dice_two_handed) — MA-0325 template one-field data
// fix. Locks: drider actions[2] authors the variant alongside the primary;
// buildTwoHandedVariantOffer yields the offer with BOTH formulas (two-handed
// swap formula + one-handed base/default); select-log records each choice;
// sibling drider rows without the field stay byte-inert.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';

describe('MA-0636 data lock (monsters.json Drider Longsword)', () => {
  it('actions[2] Longsword authors damage_dice_two_handed "1d10 + 3" beside the 1d8 + 3 primary', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const drider = monsters.find((m) => m.name === 'Drider');
    const longsword = drider.actions[2];
    expect(longsword.name).toBe('Longsword');
    expect(longsword.attack_bonus).toBe(6);
    expect(longsword.damage_dice_primary).toBe('1d8 + 3');
    expect(longsword.damage_dice_two_handed).toBe('1d10 + 3');
    expect(longsword.damage_type_primary).toBe('slashing');
  });

  it('buildTwoHandedVariantOffer arms the HIT-popup chooser with both formulas', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const longsword = monsters.find((m) => m.name === 'Drider').actions[2];
    const offer = buildTwoHandedVariantOffer(longsword, 'Longsword');
    expect(offer).toMatchObject({
      formula: '1d10 + 3',
      baseFormula: '1d8 + 3',
      damageType: 'slashing',
      attackName: 'Longsword',
    });
    expect(offer.label).toContain('1d10 + 3');
  });

  it('sibling drider rows without the field stay byte-inert', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const drider = monsters.find((m) => m.name === 'Drider');
    expect(buildTwoHandedVariantOffer(drider.actions[1], 'Bite')).toBeNull();
    expect(drider.actions[3].name).toBe('Longbow');
    expect(buildTwoHandedVariantOffer(drider.actions[3], 'Longbow')).toBeNull();
  });

  it('select logs record each choice with the correct formula', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const offer = buildTwoHandedVariantOffer(monsters.find((m) => m.name === 'Drider').actions[2], 'Longsword');
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Drider 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain('1d10 + 3');
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Drider 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain('1d8 + 3');
  });
});
