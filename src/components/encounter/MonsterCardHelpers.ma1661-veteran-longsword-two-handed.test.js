// MA-1661: Veteran Longsword advertised the versatile two-handed variant
// ("or 8 (1d10 + 3) slashing damage if used with two hands") but
// damage_dice_two_handed was ABSENT — buildTwoHandedVariantOffer early-
// returned null (MonsterCardHelpers.js:1104) so the HIT popup paid
// 1d8 + 3 with zero GM chooser (prose-only FAIL(a), MA-0325/0636/0652/0871/
// 1063 family). One-field DATA fix adds damage_dice_two_handed "1d10 + 3".
// The "or … if used with two hands" conjunction is ALTERNATIVE dice (§415) —
// damage_dice_secondary must stay absent (additive combined transport would
// over-deal every hit — MA-0871 fingerprint).
// Twin analysis: unique BY-name row — ma0965 locks Half-Red Dragon Veteran
// (distinct prose on disk: "Weapon Attack:" vs "Melee Weapon Attack:").
// Offer shape, select logs, and byte-inert siblings are canon-covered in
// MonsterCardHelpers.two-handed.test.js:23-55 and
// MonsterCardModal.two-handed.test.jsx:213-223; null-triple transport for
// secondary-less rows in MonsterCardModal.cultist-flat-secondary.test.js:38.
// Key-order pins dropped as non-behavioral (#555).
// @maintained-by-ai
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { buildTwoHandedVariantOffer } from './MonsterCardHelpers.js';
import { canRollExpression } from '../../../src/services/dice/diceRoller.js';

describe('MA-1661 data lock (monsters.json Veteran Longsword)', () => {
  const longsword = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const row = monsters.find((m) => m.name === 'Veteran').actions.find((a) => a.name === 'Longsword');
    return row;
  };

  it('disk locks the alternative dice pair: +5 attack, 1d8 + 3 primary, 1d10 + 3 two-handed slashing — rollable, prose-consistent, secondary ABSENT (§415 MA-0871 guardrail)', () => {
    const row = longsword();
    expect(row.attack_bonus).toBe(5);
    expect(row.damage_dice_primary).toBe('1d8 + 3');
    expect(row.damage_dice_two_handed).toBe('1d10 + 3');
    expect(row.damage_type_primary).toBe('slashing');
    expect(canRollExpression(row.damage_dice_two_handed)).toBe(true);
    expect(row.description).toContain('8 (1d10 + 3) slashing damage if used with two hands');
    expect(row.damage_dice_secondary).toBeUndefined();
    expect(row.flat_damage_secondary).toBeUndefined();
  });

  it('buildTwoHandedVariantOffer derives the HIT-popup chooser formulas FROM disk', () => {
    const row = longsword();
    const offer = buildTwoHandedVariantOffer(row, 'Longsword');
    expect(offer).toMatchObject({ attackName: 'Longsword' });
    expect(offer.formula).toBe(row.damage_dice_two_handed);
    expect(offer.baseFormula).toBe(row.damage_dice_primary);
    expect(offer.damageType).toBe(row.damage_type_primary);
    expect(offer.label).toContain(row.damage_dice_two_handed);
  });
});
