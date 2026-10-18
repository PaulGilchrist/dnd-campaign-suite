// @maintained-by-ai — trimmed 7→5 tests (disk lock incl. key placement; both
// formulas parse incl. '+'-joined grammar guard; offer; no-additive guard;
// select logs). All assertions kept except provably-redundant two_handed
// not.toBe(primary) (both literals already toBe-locked). Twin note: the
// byte-identical eye literals in MA-1608 test :76-77 are that fix's
// not-swept cross-check; THIS file is the MA-1264 owner lock (canon #523).
// MA-1264: Orc Eye of Gruumsh Spear had TWO data defects (FAIL(a)/DATA):
// (1) damage_dice_primary "1d6 + 3" dropped the trait rider — description
// carries "Hit: 11 (1d6 + 3 plus 1d8)" and Gruumsh's Fury confirms the +1d8
// is included in the attacks; the prose "plus" rider has no parser (§530
// grep-zero) so hits dealt ≤9 vs described avg 11. Fix expands PRIMARY via
// the rollExpression ` plus ` split (diceRoller.js) — byte-shape of the
// row's own "(1d6 + 3 plus 1d8)". NOTE: the "+"-joined "1d6 + 3 + 1d8"
// shape is UNPARSEABLE (parseExpression grammar diceRoller.js:42 is a single
// dice term; canRollExpression→false, rollExpression→null → MA-0014 blocked
// zero-damage) — the plus-word split is the only live multi-dice primary seam.
// (2) damage_dice_two_handed ABSENT → buildTwoHandedVariantOffer
// (MonsterCardHelpers.js:818) returned null → HIT-popup chooser never offered
// the "12 (2d8 + 3)" two-hands clause. Fix authors "2d8 + 3" in the Azer
// MA-0636/0959 placement (after damage_dice_primary, before damage_type_primary).
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { canRollExpression, rollExpression, rollExpressionDoubled, parseExpression } from '../../../src/services/dice/diceRoller.js';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';
import { buildSecondaryDamageTransport } from './MonsterCardModal.jsx';

describe('MA-1264 data lock (monsters.json Orc Eye of Gruumsh Spear)', () => {
  const spearRow = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const spear = monsters.find((m) => m.index === 'orc-eye-of-gruumsh').actions[0];
    expect(spear.name).toBe('Spear');
    return spear;
  };

  it('disk lock: actions[0] Spear authors plus-rider primary + two-handed variant in Azer/MA-0636 key placement', () => {
    const spear = spearRow();
    expect(spear.attack_bonus).toBe(5);
    expect(spear.damage_dice_primary).toBe('1d6 + 3 plus 1d8');
    expect(spear.damage_dice_two_handed).toBe('2d8 + 3');
    expect(spear.damage_type_primary).toBe('Piercing');
    expect(spear.description).toMatch(/1d6 \+ 3 plus 1d8\) piercing damage, or 12 \(2d8 \+ 3\) piercing damage if used with two hands/);
    const keys = Object.keys(spear);
    expect(keys.indexOf('damage_dice_two_handed')).toBeGreaterThan(keys.indexOf('damage_dice_primary'));
    expect(keys.indexOf('damage_dice_two_handed')).toBeLessThan(keys.indexOf('damage_type_primary'));
  });

  it('both row formulas PARSE via the plus-word split — "+"-joined "1d6 + 3 + 1d8" does NOT (grammar guard)', () => {
    const { damage_dice_primary: primary, damage_dice_two_handed: twoHanded } = spearRow();
    expect(canRollExpression(primary)).toBe(true);
    const single = rollExpression(primary);
    expect(single.rolls.length).toBe(2);
    expect(single.modifier).toBe(3);
    expect(single.total).toBeGreaterThanOrEqual(5);
    expect(single.total).toBeLessThanOrEqual(17);
    const crit = rollExpressionDoubled(primary);
    expect(crit.doubledRolls.length).toBe(4);
    expect(crit.modifier).toBe(3);
    expect(canRollExpression(twoHanded)).toBe(true);
    const two = rollExpression(twoHanded);
    expect(two.total).toBeGreaterThanOrEqual(5);
    expect(two.total).toBeLessThanOrEqual(19);
    expect(parseExpression('1d6 + 3 + 1d8')).toBeNull();
    expect(canRollExpression('1d6 + 3 + 1d8')).toBe(false);
  });

  it('buildTwoHandedVariantOffer arms the Spear HIT-popup chooser with both formulas', () => {
    const offer = buildTwoHandedVariantOffer(spearRow(), 'Spear');
    expect(offer).toMatchObject({
      formula: '2d8 + 3',
      baseFormula: '1d6 + 3 plus 1d8',
      damageType: 'Piercing',
      attackName: 'Spear',
    });
    expect(offer.label).toContain('2d8 + 3');
  });

  it('no additive misfire fields on the row: damage_dice_secondary ABSENT (chooser swaps PRIMARY)', () => {
    const spear = spearRow();
    expect(spear.damage_dice_secondary).toBeUndefined();
    expect(buildSecondaryDamageTransport(spear, 'Spear')).toEqual({
      autoDamageSecondaryFormula: null,
      autoDamageSecondaryName: null,
      autoDamageSecondaryDamageType: null,
    });
  });

  it('select logs: two-handed rides 2d8 + 3, unpicked default is one-handed plus-rider', () => {
    const offer = buildTwoHandedVariantOffer(spearRow(), 'Spear');
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Orc Eye of Gruumsh 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain('2d8 + 3');
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Orc Eye of Gruumsh 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain('1d6 + 3 plus 1d8');
  });
});
