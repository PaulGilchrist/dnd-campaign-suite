// @maintained-by-ai 2026-11-28 — MA-1267 OWNER: Orc War Chief Spear two-handed
// twin, trimmed 3→1 to the two-handed twin recipe established today by
// ma0965/ma0989 longsword lanes: pure verbatim full-row disk lock (#387), row
// fetched LIVE from public/data/monsters.json before locking (never
// transcribed). Full-row toEqual makes the no-additive-secondary guard
// (§415 ALTERNATIVE dice — Fury rides PRIMARY, chooser swaps it), the
// primary/two_handed distinctness, and typo guards implicit: any added or
// changed key on the row flips it. Dropped legs, cite-skipped to owners by
// describe-block: the disk-derived chooser pin (offer.field === row.field read
// off THIS same locked row — mutation-inert) → MonsterCardHelpers.two-handed.
// test.js "MA-0636 data lock" describe (offer shape + two/one select-log fork
// canon) and MonsterCardModal.two-handed.test.jsx "MA-0325 offer forwarding at
// the chip press" describe; the unpicked default plus-rider base select leg
// (#535 keep) is a behavior-twin of MA-1264's own select log test (identical
// seam on its "1d6 + 3 plus 1d8" row); parser legs (plus-split roll shape,
// crit doubling, "+"-joined "1d6 + 4 + 1d8" unparseable grammar guard) →
// diceRoller.test.js "rollExpression"/"rollExpressionDoubled" (plus-split
// bytes "1d8 plus 2d6" pinned there) + "parseExpression"/"canRollExpression"
// rejection tables, with MA-1264/MA-1266 keeping the same-rule "+"-joined
// guards on their literals. Any helper/modal mutant dies in those owner lanes;
// any disk mutant dies here. Azer key-placement indexOf guard dropped as
// cosmetic (toEqual locks the exact key set; property order is not behavior).
// Census: "1d6 + 4 plus 1d8" and "2d8 + 4" are disk-unique to this row (grep);
// spear twin ma1146 owns the bare "1d6"/"1d8" Merfolk bytes, ma1264 the "+3"
// Eye bytes — disjoint; ma1608 keeps its not-swept 2-field cross-check.
// Greataxe sibling inertness is owned by MA-1266's disk lock; the non-weapon
// siblings are pinned inert here.
// MA-1267: Orc War Chief Spear had TWO data defects (FAIL(a)/DATA) — twin of
// MA-1264 (Orc Eye of Gruumsh Spear) + MA-1266 (same-monster Greataxe):
// (1) damage_dice_primary "1d6 + 4" dropped the Gruumsh's Fury rider —
// description carries "Hit: 12 (1d6 + 4 plus 1d8)" and the trait confirms the
// +1d8 rides the attacks; the prose "plus" rider had no parser so hits dealt
// ≤10 vs described avg 12. Fix expands PRIMARY to the row's own prose
// byte-shape via the rollExpression ` plus ` split — the "+"-joined
// "1d6 + 4 + 1d8" shape is UNPARSEABLE (MA-0014 zero-damage).
// (2) damage_dice_two_handed ABSENT → buildTwoHandedVariantOffer returned null
// → HIT-popup chooser never offered the "13 (2d8 + 4)" two-hands clause. Fix
// authors "2d8 + 4" in the Azer MA-0636/0959 placement.
import { describe, it, expect } from 'vitest';
import monstersJson from '../../../public/data/monsters.json';

describe('MA-1267 data lock (monsters.json Orc War Chief Spear)', () => {
  const orcs = () => {
    const monsters = Array.isArray(monstersJson) ? monstersJson : monstersJson.monsters;
    return monsters.find((m) => m.index === 'orc-war-chief');
  };

  it('disk lock (verbatim #387): actions[2] Spear full-row — plus-rider primary "1d6 + 4 plus 1d8" beside two_handed "2d8 + 4", type Piercing, no secondary key (§415 alternative dice — no double-charge); Multiattack/Battle Cry siblings stay byte-inert', () => {
    const actions = orcs().actions;
    expect(actions[2]).toEqual({
      name: 'Spear',
      description: 'Melee or Ranged Weapon Attack: +6 to hit, reach 5 ft. or range 20/60 ft., one target. Hit: 12 (1d6 + 4 plus 1d8) piercing damage, or 13 (2d8 + 4) piercing damage if used with two hands to make a melee attack.',
      attack_bonus: 6,
      reach: '5 ft.',
      damage_dice_primary: '1d6 + 4 plus 1d8',
      damage_dice_two_handed: '2d8 + 4',
      damage_type_primary: 'Piercing',
    });
    expect(actions[0].name).toBe('Multiattack');
    expect(actions[0].damage_dice_two_handed).toBeUndefined();
    expect(actions[3].name).toBe('Battle Cry');
    expect(actions[3].damage_dice_two_handed).toBeUndefined();
  });
});
