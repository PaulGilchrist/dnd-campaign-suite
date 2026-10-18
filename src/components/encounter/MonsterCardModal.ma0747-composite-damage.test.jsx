// @maintained-by-ai
// MA-0747: composite "Hit: 1 Piercing damage plus 5 (2d4) Poison damage." rows
// (flying-snake/Bite + scorpion/Sting byte-twins, no authored damage_dice_primary)
// previously resolved autoDamageFormula to null, so buildAutoDamage
// (useLoggedDiceRollAttack.js) early-returned undefined and BOTH legs dealt ZERO
// on every hit. Fix: extractFlatHitDamage's dice guard is scoped to PRIMARY-clause
// dice (MonsterCardHelpers.js:3082), so the flat constant "1" now threads through
// buildAutoDamageOptions beside the MA-0426 secondary transport.
// Trimmed 6→3 cases, distinct branches only. Cited legs kept (update sibling
// citations to these ranges): flying-snake/Bite consumer flat '1' + same-object
// secondary transport → test 1; flat crit-invariance dice-less roller trio
// (CLA-281, cultist-flat-secondary owner cites) → test 2; dice-primary byte-inert
// face → test 3. Cut legs (owners): disk twins byte-mirror (implied by behavior
// below; scorpion/Sting extractor '1' → flat-hit-damage.test.js:26),
// buildSecondaryDamageTransport passthrough + null triple (cultist-flat-secondary),
// 2d4 roll/double ranges (diceRoller.test.js), scorpion options leg (byte-twin).
import { describe, it, expect } from 'vitest';
import { buildAutoDamageOptions } from './MonsterCardModal.jsx';
import { extractFlatHitDamage } from './MonsterCardHelpers.js';
import { parseConstant, rollExpression, rollExpressionDoubled } from '../../services/dice/diceRoller.js';
import monstersData from '../../../public/data/monsters.json';

const BITE = monstersData.find(m => m.index === 'flying-snake').actions.find(a => a.name === 'Bite');

describe('MA-0747 composite flat-primary + dice-secondary auto-damage', () => {
  it('flying-snake/Bite: flat primary "1" + threaded secondary ride the SAME options object (was null = zero-damage)', () => {
    // MA-0747 guard scope: dice ONLY in the "plus 5 (2d4) Poison" rider must
    // not block flat-primary extraction — this disk row IS the fix.
    expect(extractFlatHitDamage(BITE)).toBe('1');
    const opts = buildAutoDamageOptions(BITE, BITE.name);
    expect(opts.autoDamageFormula).toBe('1');
    expect(opts.autoDamageSecondaryFormula).toBe('2d4');
    expect(opts.autoDamageSecondaryDamageType).toBe('Poison');
  });

  it('flat constant "1" resolves dice-less and NEVER doubles on crit (§49/§210 — CLA-281 lock)', () => {
    // Primary flat leg — parseConstant owns it, no dice, crit-invariant;
    // the secondary dice-doubling path (§32) is diceRoller-owned.
    expect(rollExpression('1')).toBeNull();
    expect(rollExpressionDoubled('1')).toBeNull();
    expect(parseConstant('1')).toBe(1);
  });

  it('byte-inert: pure dice-primary rows never touch the flat extractor', () => {
    const diceRow = { name: 'Slam', attack_bonus: 5, damage_dice_primary: '2d6 + 3', damage_type_primary: 'Bludgeoning', description: 'Hit: 10 (2d6+3) Bludgeoning damage.' };
    expect(extractFlatHitDamage(diceRow)).toBe(null);
    expect(buildAutoDamageOptions(diceRow, 'Slam').autoDamageFormula).toBe('2d6 + 3');
  });
});
