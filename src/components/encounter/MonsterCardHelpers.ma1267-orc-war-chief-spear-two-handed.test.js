// @maintained-by-ai — trimmed 7→3 tests (#523): disk lock folds key-placement +
// no-double-charge guard (damage_dice_secondary ABSENT); ONE parser press derives
// both formulas FROM disk (+ row-distinct "'1d6 + 4 + 1d8'" grammar guard — grep:
// these bytes live only here, vs ma1264 "+3" / ma1266 "1d12 + 4"); offer+select
// fork kept as this row's press because its unpicked default carries the distinct
// plus-rider baseFormula (#535 precedent — absent from generic owners:
// two-handed.test.js:23-34,44-55,133-143; Modal.two-handed.test.jsx:213-223;
// null-triple transport cite-skipped to cultist-flat-secondary.test.js:36-39,
// plus-split parser behavior to diceRoller.test.js:228-357). Row literals
// "1d6 + 4 plus 1d8" / "2d8 + 4" BY-name disk-lock stays (#387).
// MA-1267: Orc War Chief Spear had TWO data defects (FAIL(a)/DATA) — twin of
// MA-1264 (Orc Eye of Gruumsh Spear) + MA-1266 (same-monster Greataxe):
// (1) damage_dice_primary "1d6 + 4" dropped the trait rider — description carries
// "Hit: 12 (1d6 + 4 plus 1d8)" and Gruumsh's Fury confirms the +1d8 is
// "included in the attacks"; the prose "plus" rider has no parser (§530
// grep-zero) so hits dealt ≤10 vs described avg 12. Fix expands PRIMARY via the
// rollExpression ` plus ` split (diceRoller.js) — byte-shape of the row's own
// "(1d6 + 4 plus 1d8)". NOTE: the "+"-joined "1d6 + 4 + 1d8" shape is
// UNPARSEABLE (parseExpression grammar diceRoller.js:42 is a single dice term;
// canRollExpression→false, rollExpression→null → MA-0014 blocked zero-damage) —
// the plus-word split is the only live multi-dice primary seam.
// (2) damage_dice_two_handed ABSENT → buildTwoHandedVariantOffer
// (MonsterCardHelpers.js:818) returned null → HIT-popup chooser never offered
// the "13 (2d8 + 4)" two-hands clause. Fix authors "2d8 + 4" in the Azer
// MA-0636/0959 placement (after damage_dice_primary, before damage_type_primary).
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { canRollExpression, rollExpression, rollExpressionDoubled, parseExpression } from '../../../src/services/dice/diceRoller.js';
import { buildTwoHandedVariantOffer, buildTwoHandedVariantSelectLog } from './MonsterCardHelpers.js';

describe('MA-1267 data lock (monsters.json Orc War Chief Spear)', () => {
  const spearRow = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const spear = monsters.find((m) => m.index === 'orc-war-chief').actions[2];
    expect(spear.name).toBe('Spear');
    return spear;
  };

  it('disk lock: actions[2] Spear plus-rider primary + two-handed variant, Azer key placement, no additive misfire fields (secondary ABSENT — Fury rides PRIMARY, chooser swaps it)', () => {
    const spear = spearRow();
    expect(spear.attack_bonus).toBe(6);
    expect(spear.damage_dice_primary).toBe('1d6 + 4 plus 1d8');
    expect(spear.damage_dice_two_handed).toBe('2d8 + 4');
    expect(spear.damage_type_primary).toBe('Piercing');
    expect(spear.damage_dice_secondary).toBeUndefined();
    expect(spear.description).toBe('Melee or Ranged Weapon Attack: +6 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 12 (1d6 + 4 plus 1d8) piercing damage, or 13 (2d8 + 4) piercing damage if used with two hands to make a melee attack.');
    const keys = Object.keys(spear);
    expect(keys.indexOf('damage_dice_two_handed')).toBeGreaterThan(keys.indexOf('damage_dice_primary'));
    expect(keys.indexOf('damage_dice_two_handed')).toBeLessThan(keys.indexOf('damage_type_primary'));
  });

  it('both row formulas PARSE via the plus-word split — "+"-joined "1d6 + 4 + 1d8" does NOT (grammar guard: MA-0014 zero-damage if prose-plus is ever rewritten to plus-sign-joined)', () => {
    const { damage_dice_primary: primary, damage_dice_two_handed: twoHanded } = spearRow();
    expect(canRollExpression(primary)).toBe(true);
    const single = rollExpression(primary);
    expect(single.rolls.length).toBe(2);
    expect(single.modifier).toBe(4);
    expect(single.total).toBeGreaterThanOrEqual(6);
    expect(single.total).toBeLessThanOrEqual(18);
    const crit = rollExpressionDoubled(primary);
    expect(crit.doubledRolls.length).toBe(4);
    expect(crit.modifier).toBe(4);
    expect(canRollExpression(twoHanded)).toBe(true);
    const two = rollExpression(twoHanded);
    expect(two.total).toBeGreaterThanOrEqual(6);
    expect(two.total).toBeLessThanOrEqual(20);
    expect(parseExpression('1d6 + 4 + 1d8')).toBeNull();
    expect(canRollExpression('1d6 + 4 + 1d8')).toBe(false);
  });

  it('chooser fork wired from disk: offer arms both formulas; select logs ride two-handed, unpicked default keeps the plus-rider base', () => {
    const { damage_dice_primary: baseFormula, damage_dice_two_handed: formula, damage_type_primary: damageType } = spearRow();
    const offer = buildTwoHandedVariantOffer(spearRow(), 'Spear');
    expect(offer).toMatchObject({ formula, baseFormula, damageType, attackName: 'Spear' });
    expect(offer.label).toContain(formula);
    const two = buildTwoHandedVariantSelectLog({ monsterName: 'Orc War Chief 1', offer, hands: 'two-handed' });
    expect(two.automationType).toBe('two_handed_variant_selected');
    expect(two.description).toContain('TWO-HANDED');
    expect(two.description).toContain(formula);
    const one = buildTwoHandedVariantSelectLog({ monsterName: 'Orc War Chief 1', offer, hands: 'one-handed', defaulted: true });
    expect(one.automationType).toBe('one_handed_variant_selected');
    expect(one.description).toContain('default');
    expect(one.description).toContain(baseFormula);
  });
});
