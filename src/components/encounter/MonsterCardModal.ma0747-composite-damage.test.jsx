// @maintained-by-ai 2026-11-28
// MA-0747: composite "Hit: 1 Piercing damage plus 5 (2d4) Poison damage." rows
// (flying-snake/Bite + scorpion/Sting byte-twins, no authored damage_dice_primary)
// previously resolved autoDamageFormula to null, so buildAutoDamage
// (useLoggedDiceRollAttack.js) early-returned undefined and BOTH legs dealt ZERO
// on every hit. Fix: extractFlatHitDamage's dice guard is scoped to PRIMARY-clause
// dice (MonsterCardHelpers.js:3116), so the flat constant "1" now threads through
// buildAutoDamageOptions beside the MA-0426 secondary transport.
// This lane pins ONLY the composition seam: flat primary + threaded secondary
// triple ride the SAME options object — the exact co-existence the fix created.
// Owners (cite-skips): extractor guard-branch truth table, incl. scorpion/Sting
// byte-twin '1' and dice-adjacent null → MonsterCardHelpers.flat-hit-damage.test.js
// describe "extractFlatHitDamage owner truth-table" rows ['scorpion','Sting','1']
// / ['aarakocra','Talon',null]; buildSecondaryDamageTransport dice branch + null
// triple → MonsterCardModal.cultist-flat-secondary.test.js; dice-primary formula
// lane (byte-inert fallback never fires) → MonsterCardModal.auto-damage-roll.test.js
// describe "attack chip → rollAttack auto-damage transport" + enlarged-damage.test.js;
// plus-grammar roll/crit math → diceRoller.test.js (owner re-established run2#2157)
// and handlePlainDamage.secondaryDamage.test.js:334 (CLA-281 consumer crit leg —
// buildAutoDamageOptions takes NO crit input, so no consumer crit composition is
// pinnable at this seam).
// Trimmed 2→1 (pass 2026-11-28): cut direct extractFlatHitDamage(BITE) re-read
// (subsumed — a guard-scope regression flips opts.autoDamageFormula to null below;
// branch owned at flat-hit-damage.test.js twin row) and the whole byte-inert
// dice-row test (both assertions owned by the cite-skips above — mutation-inert
// re-reads of the extractor guard and the heavily-covered dice-primary lane).
import { describe, it, expect } from 'vitest';
import { buildAutoDamageOptions } from './MonsterCardModal.jsx';
import monstersData from '../../../public/data/monsters.json';

const BITE = monstersData.find(m => m.index === 'flying-snake').actions.find(a => a.name === 'Bite');

describe('MA-0747 composite flat-primary + dice-secondary auto-damage', () => {
  it('flying-snake/Bite: flat primary "1" + threaded "2d4" Poison secondary ride the SAME options object (was null = zero-damage)', () => {
    // MA-0747 guard scope: dice ONLY in the "plus 5 (2d4) Poison" rider must
    // not block flat-primary extraction — this disk row IS the fix.
    expect(buildAutoDamageOptions(BITE, BITE.name)).toMatchObject({
      autoDamageFormula: '1',
      autoDamageSecondaryFormula: '2d4',
      autoDamageSecondaryDamageType: 'Poison',
    });
  });
});
