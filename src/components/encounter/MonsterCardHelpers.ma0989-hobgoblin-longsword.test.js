// MA-0989: Hobgoblin Longsword versatile clause was inert-by-construction —
// prose-only "or 6 (1d10 + 1) ... if used with two hands" with no authored
// damage_dice_two_handed (buildTwoHandedVariantOffer returned null → zero
// HIT-popup chooser, §166 toggle audit 0 switches/radiogroup/tablist).
// One-field DATA fix, mirroring the MA-0636/MA-0652/MA-0959/MA-0965 twin
// placement (damage_dice_two_handed after damage_dice_primary, before
// damage_type_primary; two-handed leg rides damage_type_primary Slashing).
// Description untouched.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';

describe('MA-0989 data lock (monsters.json Hobgoblin Longsword)', () => {
  const longsword = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const row = monsters.find((m) => m.name === 'Hobgoblin').actions[0];
    expect(row.name).toBe('Longsword');
    return row;
  };

  it('actions[0] Longsword authors damage_dice_two_handed "1d10 + 1" beside the 1d8 + 1 primary (MA-0636/0652/0959/0965 placement)', () => {
    const row = longsword();
    expect(row.attack_bonus).toBe(3);
    expect(row.damage_dice_primary).toBe('1d8 + 1');
    expect(row.damage_dice_two_handed).toBe('1d10 + 1');
    expect(row.damage_type_primary).toBe('Slashing');
  });

  it('authored prose stays byte-intact and matches the fixed field (6 = 1d10 + 1)', () => {
    const row = longsword();
    expect(row.description).toContain('5 (1d8 + 1) slashing damage, or 6 (1d10 + 1) slashing damage if used with two hands.');
    expect(row.description).not.toMatch(/1dl0|1d1O/);
  });

  it('buildTwoHandedVariantOffer arms the Hobgoblin HIT-popup chooser with both formulas', () => {
    const offer = buildTwoHandedVariantOffer(longsword(), 'Longsword');
    expect(offer).toMatchObject({
      formula: '1d10 + 1',
      baseFormula: '1d8 + 1',
      damageType: 'Slashing',
      attackName: 'Longsword',
    });
    expect(offer.label).toContain('1d10 + 1');
  });

  it('select logs record each choice with the correct formula', () => {
    const offer = buildTwoHandedVariantOffer(longsword(), 'Longsword');
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Hobgoblin 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain('1d10 + 1');
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Hobgoblin 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain('1d8 + 1');
  });

  it('Longbow sibling stays byte-inert — no chooser, no two-handed field', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const longbow = monsters.find((m) => m.name === 'Hobgoblin').actions[1];
    expect(longbow.name).toBe('Longbow');
    expect(longbow.damage_dice_two_handed).toBeUndefined();
    expect(buildTwoHandedVariantOffer(longbow, 'Longbow')).toBeNull();
  });
});
