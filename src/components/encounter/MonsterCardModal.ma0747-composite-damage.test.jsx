// @maintained-by-ai
// MA-0747: composite "Hit: 1 Piercing damage plus 5 (2d4) Poison damage." rows
// (flying-snake/Bite + scorpion/Sting byte-twins, no authored damage_dice_primary)
// previously resolved autoDamageFormula to null, so buildAutoDamage
// (useLoggedDiceRollAttack.js) early-returned undefined and BOTH legs dealt ZERO
// on every hit. Fix: extractFlatHitDamage's dice guard is scoped to PRIMARY-clause
// dice (MonsterCardHelpers.js:3093), so the flat constant "1" now threads through
// buildAutoDamageOptions beside the MA-0426 secondary transport.
// Trimmed 6→2 cases, distinct branches only (crit-trio folded per pass #507 rec).
// Cited legs kept (update sibling citations to these ranges): flying-snake/Bite
// consumer flat '1' + same-object secondary transport (the MA-0747 fix's own
// composition behavior — the kept consumer seam half) → test 1; dice-primary
// byte-inert face → test 2. Folded (pass #507 rec: crit-invariance roller trio
// HALF-OVERLAP diceRoller owner — all legs are diceRoller-internal constant
// grammar, zero composition in the block): rollExpression('1')→null is the
// owner constant-null arm ('4'/'0', "Flat constants alone never roll" #1063,
// diceRoller.test.js:222); rollExpressionDoubled('1')→null exits the SAME
// parseExpression-null arm (:113-114 ≡ :158-159), owned by the doubled
// null-table (diceRoller.test.js:256); parseConstant('1')→1 digit-branch is
// pinned REAL, not mocked, at attackRollBonuses-cla048-celestial-rider
// .test.js:107/:124 ('6'→6 same /^[+-]?\d+$/ branch — diceRoller.test.js
// never imports parseConstant). The composite consumer crit BEHAVIOR (flat "1"
// passed to the roller and never doubled, total stays 1) is seam-owned at
// handlePlainDamage.secondaryDamage.test.js:334 (CLA-281) — diceRoller mocked
// there, so that leg pins the consumer, not roller internals. buildAutoDamage
// Options takes NO crit input (MonsterCardModal.jsx:1160): no consumer crit
// composition is pinnable at this seam, so no convert — the kept half is the
// test-1 composition itself. Cut legs (owners): disk twins byte-mirror (implied
// by behavior below; scorpion/Sting extractor '1' → flat-hit-damage.test.js:26),
// buildSecondaryDamageTransport passthrough + null triple (cultist-flat-secondary),
// 2d4 roll/double ranges (diceRoller.test.js), scorpion options leg (byte-twin).
import { describe, it, expect } from 'vitest';
import { buildAutoDamageOptions } from './MonsterCardModal.jsx';
import { extractFlatHitDamage } from './MonsterCardHelpers.js';
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

  it('byte-inert: pure dice-primary rows never touch the flat extractor', () => {
    const diceRow = { name: 'Slam', attack_bonus: 5, damage_dice_primary: '2d6 + 3', damage_type_primary: 'Bludgeoning', description: 'Hit: 10 (2d6+3) Bludgeoning damage.' };
    expect(extractFlatHitDamage(diceRow)).toBe(null);
    expect(buildAutoDamageOptions(diceRow, 'Slam').autoDamageFormula).toBe('2d6 + 3');
  });
});
