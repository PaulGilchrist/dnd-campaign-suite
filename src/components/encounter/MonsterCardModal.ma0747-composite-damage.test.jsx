// MA-0747: composite "Hit: 1 Piercing damage plus 5 (2d4) Poison damage."
// rows (flying-snake/Bite, scorpion/Sting — no authored damage_dice_primary)
// previously resolved autoDamageFormula to null, so buildAutoDamage
// (useLoggedDiceRollAttack.js) early-returned undefined and BOTH legs dealt
// ZERO on every hit. Fix: extractFlatHitDamage's dice guard is scoped to
// PRIMARY-clause dice, so the flat constant "1" now threads through
// buildAutoDamageOptions beside the MA-0426 secondary transport. These tests
// lock: flat primary "1" + secondary dice ride the SAME options object
// (combined_damage_roll inputs), and the flat constant stays dice-less and
// NEVER doubles on crit (§49/§210) while the secondary dice doubles per §32.
import { describe, it, expect, vi } from 'vitest';
import { buildAutoDamageOptions, buildSecondaryDamageTransport } from './MonsterCardModal.jsx';
import { extractFlatHitDamage } from './MonsterCardHelpers.js';
import { parseConstant, rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import monstersData from '../../../public/data/monsters.json';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

const flyingSnake = monstersData.find(m => m.index === 'flying-snake');
const scorpion = monstersData.find(m => m.index === 'scorpion');
const BITE = flyingSnake.actions.find(a => a.name === 'Bite');
const STING = scorpion.actions.find(a => a.name === 'Sting');

describe('MA-0747 composite flat-primary + dice-secondary auto-damage', () => {
  it('disk twins carry no damage_dice_primary and dice only in the secondary rider', () => {
    expect(BITE.damage_dice_primary).toBeUndefined();
    expect(BITE.damage_dice_secondary).toBe('2d4');
    expect(BITE.damage_type_secondary).toBe('Poison');
    expect(STING.damage_dice_primary).toBeUndefined();
    expect(STING.damage_dice_secondary).toBe('1d6');
    expect(STING.damage_type_secondary).toBe('Poison');
  });

  it.each([
    ['flying-snake/Bite', BITE, '2d4'],
    ['scorpion/Sting', STING, '1d6'],
  ])('buildAutoDamageOptions resolves flat primary "1" + threaded secondary %s (was null = zero-damage)', (_label, row, secondary) => {
    const opts = buildAutoDamageOptions(row, row.name);
    expect(opts.autoDamageFormula).toBe('1');
    expect(opts.autoDamageSecondaryFormula).toBe(secondary);
    expect(opts.autoDamageSecondaryDamageType).toBe('Poison');
  });

  it('buildSecondaryDamageTransport emits the secondary triple for the composite row', () => {
    const t = buildSecondaryDamageTransport(BITE, 'Bite');
    expect(t.autoDamageSecondaryFormula).toBe('2d4');
    expect(t.autoDamageSecondaryDamageType).toBe('Poison');
  });

  it('flat constant "1" resolves dice-less and NEVER doubles on crit; secondary dice doubles', () => {
    expect(extractFlatHitDamage(BITE)).toBe('1');
    // Primary flat leg — parseConstant owns it, no dice, crit-invariant (§49/§210).
    expect(rollExpression('1')).toBeNull();
    expect(rollExpressionDoubled('1')).toBeNull();
    expect(parseConstant('1')).toBe(1);
    // Secondary dice leg — rolls, doubles its dice count on crit (§32).
    const roll = rollExpression('2d4');
    expect(roll.total).toBeGreaterThanOrEqual(2);
    expect(roll.total).toBeLessThanOrEqual(8);
    const crit = rollExpressionDoubled('2d4');
    expect(crit.total).toBeGreaterThanOrEqual(4);
    expect(crit.total).toBeLessThanOrEqual(16);
  });

  it('byte-inert: pure dice-primary rows never touch the flat extractor', () => {
    const diceRow = { name: 'Slam', attack_bonus: 5, damage_dice_primary: '2d6 + 3', damage_type_primary: 'Bludgeoning', description: 'Hit: 10 (2d6+3) Bludgeoning damage.' };
    expect(extractFlatHitDamage(diceRow)).toBe(null);
    expect(buildAutoDamageOptions(diceRow, 'Slam').autoDamageFormula).toBe('2d6 + 3');
  });
});
