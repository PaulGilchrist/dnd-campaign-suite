// @maintained-by-ai
// MA-1723: Winter Wolf "Bite" — prose carries "If the target is a Large or
// smaller creature, it has the Prone condition" but the row shipped WITHOUT
// hit_conditions, so the Prone rider was structurally inert (buildHitConditionClause
// reads hit_conditions/hit_target_effect/hit_condition_roll only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions with
// Large-or-smaller size gate). One-field DATA fix: hit_conditions:["prone"]
// placed after damage_type_primary (MA-1534 Boulder / MA-1541 Thunderbolt
// byte-shape twins).
// OWNED ELSEWHERE (trimmed, cited):
//  - numerics (+6, 2d6 + 4, Piercing), hit_conditions ["prone"], escape_dc /
//    hit_target_effect absence, buildHitConditionClause arm, and the real
//    resolved-hit Prone grant with provenance meta + once-only damage on the
//    winter-wolf disk row → handlePlainDamage.hitClause.test.js:280
//    (describe.each data-lock :289-302, grant lane :304+; plain-wolf twin
//    :281 is +4 / 1d6 + 2 — honestly distinct tuple, distinguished BY NAME)
//  - attackRowMissingToHit "authored attack_bonus keeps chip live" truth
//    leg + whole-DB suppression census → MonsterAction.ma0286-slam-
//    suppression.test.jsx (its census skips attack_bonus-non-null rows, so
//    the winter-wolf chip press is unowned and lives here)
//  - winter-wolf Bite numerics re-pinned by siblings → MonsterAction.ma1726
//    -wolf-bite :84-86, MonsterCardModal.ma1595 :169-172
// Tuple-miss delta held here: exact disk keys BY NAME + verbatim row bytes
// (owner's ?? fallbacks cannot distinguish absent-vs-null; verbatim toEqual
// absorbs the description-verbatim "Large or smaller" clause, the absent
// save_dc/save_type/save_effect/escape_dc/hit_target_effect fields, and the
// per-field core-leg pins), then the "+6" chip press delivers that exact
// row through onAttack (identity — payload IS the disk object, MonsterAction
// .jsx:480). Cold Breath save-lane sibling and Pack Tactics trait stay
// structurally inert BY NAME — inverted nowhere else.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const WW = monsters.find((m) => m.index === 'winter-wolf');
const BITE = WW.actions.find((a) => a.name === 'Bite');
const BREATH = WW.actions.find((a) => a.name === 'Cold Breath');

const BITE_EXACT = {
  name: 'Bite',
  description: 'Melee Attack Roll: +6, reach 5 ft. Hit: 11 (2d6 + 4) Piercing damage. If the target is a Large or smaller creature, it has the Prone condition.',
  attack_bonus: 6,
  reach: '5 ft.',
  damage_dice_primary: '2d6 + 4',
  damage_type_primary: 'Piercing',
  hit_conditions: ['prone'],
};

describe('MA-1723 winter-wolf Bite hit_conditions fix', () => {
  it('delta fingerprint: exact keys + verbatim bytes, "+6" chip presses the exact row, save-lane siblings stay inert', () => {
    // Byte-shape: keys BY NAME in transport order — hit_conditions sits
    // immediately after damage_type_primary as the terminal key (MA-1534
    // byte-shape twins).
    expect(Object.keys(BITE)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'damage_dice_primary',
      'damage_type_primary',
      'hit_conditions',
    ]);
    // Exact bytes: any drifted leg (+6, 5 ft., 2d6 + 4 Piercing), any
    // authored save_dc/save_type/save_effect/escape_dc/hit_target_effect,
    // or reworded "Large or smaller ... Prone" prose breaks this one pin.
    expect(BITE).toEqual(BITE_EXACT);

    // Chip-level dispatch: exactly one "+6" attack chip (no stale
    // suppression, no damage chip), press routes the disk row ONCE.
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BITE}
        index={0}
        attackerCannotAct={false}
        onAttack={onAttack}
        onDamage={vi.fn()}
        onSaveRoll={vi.fn()}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
      />
    );
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+6']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Bite', 6, BITE_EXACT);
    // Identity: the payload IS the disk row — hit_conditions bytes ride the
    // attack lane untouched (no copy/strip) into the clause consumer.
    expect(onAttack.mock.calls[0][2]).toBe(BITE);

    // Inverted delta BY NAME: the fix did not leak — Cold Breath stays the
    // save lane only (clause builder reads hit riders, not save keys), and
    // Pack Tactics remains prose-only with no structured row.
    expect(BREATH.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(BREATH)).toBeNull();
    expect(WW.traits.map((t) => t.name)).toEqual(['Pack Tactics']);
    expect(WW.traits[0].hit_conditions).toBeUndefined();
  });
});
