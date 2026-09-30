// MA-1661: Veteran Longsword advertised the versatile two-handed variant
// ("or 8 (1d10 + 3) slashing damage if used with two hands") but
// damage_dice_two_handed was ABSENT — buildTwoHandedVariantOffer early-
// returned null (MonsterCardHelpers.js:1042) so the HIT popup paid
// 1d8 + 3 with zero GM chooser (prose-only FAIL(a), MA-0325/0636/0652/0871/
// 1063 family; live pre-fix ledger: popup buttons ["Done"] only, whole-log
// grep of two_handed|1d10|variant_selected == 0). One-field DATA fix adds
// damage_dice_two_handed "1d10 + 3" in the Azer/MA-1063 byte-shape (after
// damage_dice_primary, before damage_type_primary; two-handed leg rides
// primary type "slashing"), making the row a byte-twin of the Half-Red
// Dragon Veteran Longsword (MA-0965) and the Drider Longsword (MA-0636).
// The "or … if used with two hands" conjunction is ALTERNATIVE dice (§415) —
// damage_dice_secondary must stay absent (additive combined transport would
// over-deal every hit — MA-0871 fingerprint).
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';
import { buildSecondaryDamageTransport } from './MonsterCardModal.jsx';
import { canRollExpression } from '../../../src/services/dice/diceRoller.js';

describe('MA-1661 data lock (monsters.json Veteran Longsword)', () => {
  const veteran = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    return monsters.find((m) => m.name === 'Veteran');
  };
  const longsword = () => {
    const row = veteran().actions[1];
    expect(row.name).toBe('Longsword');
    return row;
  };

  it('actions[1] Longsword authors damage_dice_two_handed "1d10 + 3" beside the 1d8 + 3 primary (MA-1063 placement)', () => {
    const row = longsword();
    expect(row.attack_bonus).toBe(5);
    expect(row.reach).toBe('5 ft.');
    expect(row.damage_dice_primary).toBe('1d8 + 3');
    expect(row.damage_dice_two_handed).toBe('1d10 + 3');
    expect(row.damage_type_primary).toBe('slashing');
  });

  it('key placement after primary, before damage_type_primary — byte-twin of Half-Red Dragon Veteran + Drider Longsword', () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const keys = Object.keys(longsword());
    expect(keys.indexOf('damage_dice_two_handed')).toBe(keys.indexOf('damage_dice_primary') + 1);
    expect(keys.indexOf('damage_dice_two_handed')).toBeLessThan(keys.indexOf('damage_type_primary'));
    const halfRedKeys = Object.keys(monsters.find((m) => m.name === 'Half-Red Dragon Veteran').actions[1]);
    expect(keys).toEqual(halfRedKeys);
    const driderKeys = Object.keys(monsters.find((m) => m.name === 'Drider').actions[2]);
    expect(driderKeys).toEqual(keys);
  });

  it('authored prose stays byte-intact and matches the fixed field (8 = 1d10 + 3)', () => {
    const row = longsword();
    expect(row.description).toBe('Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: 7 (1d8 + 3) slashing damage, or 8 (1d10 + 3) slashing damage if used with two hands.');
    expect(row.description).not.toMatch(/1dl0|1d1O/);
  });

  it('variant dice stay rollable and the two hands are ALTERNATIVE, never a combined rider (§415 — MA-0871 guardrail)', () => {
    const row = longsword();
    expect(canRollExpression(row.damage_dice_two_handed)).toBe(true);
    expect(row.damage_dice_two_handed).not.toBe(row.damage_dice_primary);
    expect(row.damage_dice_secondary).toBeUndefined();
    expect(row.flat_damage_secondary).toBeUndefined();
    expect(row.damage_dice_ranged).toBeUndefined();
    expect(buildSecondaryDamageTransport(row, 'Longsword').autoDamageSecondaryFormula).toBeNull();
  });

  it('buildTwoHandedVariantOffer arms the Veteran HIT-popup chooser with both formulas', () => {
    const offer = buildTwoHandedVariantOffer(longsword(), 'Longsword');
    expect(offer).toMatchObject({
      formula: '1d10 + 3',
      baseFormula: '1d8 + 3',
      damageType: 'slashing',
      attackName: 'Longsword',
    });
    expect(offer.label).toContain('1d10 + 3');
  });

  it('select logs: two-handed flips to 1d10 + 3, unpicked default is one-handed 1d8 + 3 only', () => {
    const offer = buildTwoHandedVariantOffer(longsword(), 'Longsword');
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Veteran 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain('1d10 + 3');
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Veteran 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain('1d8 + 3');
  });

  it('Shortsword "+5" sibling stays byte-inert — no chooser, no two-handed field (§693 row-scope twin)', () => {
    const shortsword = veteran().actions[2];
    expect(shortsword.name).toBe('Shortsword');
    expect(shortsword.attack_bonus).toBe(5);
    expect(shortsword.damage_dice_two_handed).toBeUndefined();
    expect(buildTwoHandedVariantOffer(shortsword, 'Shortsword')).toBeNull();
  });

  it('Heavy Crossbow sibling stays byte-inert (ranged row, no versatile dice)', () => {
    const xbow = veteran().actions[3];
    expect(xbow.name).toBe('Heavy Crossbow');
    expect(xbow.damage_dice_two_handed).toBeUndefined();
    expect(buildTwoHandedVariantOffer(xbow, 'Heavy Crossbow')).toBeNull();
  });
});
