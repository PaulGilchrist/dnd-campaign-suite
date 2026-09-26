// MA-1266: Orc War Chief Greataxe dropped the Gruumsh's Fury rider (FAIL(a)/DATA):
// description carries "Hit: 15 (1d12 + 4 plus 1d8) slashing damage" and the trait
// confirms the +1d8 is "included in the attacks" (unconditional weapon-hit ride), but
// damage_dice_primary was "1d12 + 4" — the prose "plus" rider has no parser (§530
// grep-zero) so hits dealt ≤16 vs described avg 15. Fix expands PRIMARY via the
// rollExpression ` plus ` split — MA-1264 twin byte-shape of the row's own
// "(1d12 + 4 plus 1d8)" prose. NOTE: the "+"-joined "1d12 + 4 + 1d8" shape is
// UNPARSEABLE (parseExpression grammar diceRoller.js:42 is a single dice term;
// canRollExpression→false → MA-0014 blocked zero-damage) — the plus-word split is
// the only live multi-dice primary seam.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';
import { canRollExpression, rollExpression, rollExpressionDoubled, parseExpression } from '../../../src/services/dice/diceRoller.js';
import { buildSecondaryDamageTransport } from './MonsterCardModal.jsx';

describe('MA-1266 data lock (monsters.json Orc War Chief Greataxe)', () => {
  const axeRow = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    const axe = monsters.find((m) => m.index === 'orc-war-chief').actions[1];
    expect(axe.name).toBe('Greataxe');
    return axe;
  };

  it('actions[1] Greataxe authors plus-rider primary matching the row prose byte-shape (MA-1264 twin)', () => {
    const axe = axeRow();
    expect(axe.attack_bonus).toBe(6);
    expect(axe.damage_dice_primary).toBe('1d12 + 4 plus 1d8');
    expect(axe.damage_type_primary).toBe('Slashing');
    expect(axe.description).toBe('Melee Weapon Attack: +6 to hit, reach 5 ft., one target. Hit: 15 (1d12 + 4 plus 1d8) slashing damage.');
  });

  it('plus-rider primary PARSES and rolls a d8 leg — "1d12 + 4 + 1d8" two-dice-plus shape does NOT (parser grammar guard)', () => {
    const primary = axeRow().damage_dice_primary;
    expect(canRollExpression(primary)).toBe(true);
    const single = rollExpression(primary);
    expect(single.rolls.length).toBe(2);
    expect(single.modifier).toBe(4);
    expect(single.total).toBeGreaterThanOrEqual(6);
    expect(single.total).toBeLessThanOrEqual(24);
    const crit = rollExpressionDoubled(primary);
    expect(crit.doubledRolls.length).toBe(4);
    expect(crit.modifier).toBe(4);
    expect(parseExpression('1d12 + 4 + 1d8')).toBeNull();
    expect(canRollExpression('1d12 + 4 + 1d8')).toBe(false);
  });

  it('no additive misfire fields on the row: damage_dice_secondary / two_handed ABSENT (rider rides PRIMARY)', () => {
    const axe = axeRow();
    expect(axe.damage_dice_secondary).toBeUndefined();
    expect(axe.damage_dice_two_handed).toBeUndefined();
    expect(buildSecondaryDamageTransport(axe, 'Greataxe')).toEqual({
      autoDamageSecondaryFormula: null,
      autoDamageSecondaryName: null,
      autoDamageSecondaryDamageType: null,
    });
  });
});
