// @maintained-by-ai
// MA-1726: Wolf "Bite" — prose carries "If the target is a Medium or
// smaller creature, it has the Prone condition" but the row shipped WITHOUT
// hit_conditions, so the Prone rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions with Medium-or-smaller size
// gate). One-field DATA fix: hit_conditions:["prone"] placed after
// damage_type_primary (MA-1723 winter-wolf / MA-1534 Boulder / MA-1541
// Thunderbolt byte-shape twins).
// OWNED ELSEWHERE (trimmed, cited):
//  - numerics (+4, 1d6 + 2, Piercing), hit_conditions ["prone"], escape_dc /
//    hit_target_effect absence, buildHitConditionClause arm, and the real
//    resolved-hit Prone grant with provenance meta + once-only damage on the
//    plain-wolf disk row → handlePlainDamage.hitClause.test.js:281
//    (describe.each data-lock :289-302, grant lane :304+; winter-wolf twin
//    :280 mega-absorbed by its owner ma1723 — the former :84-86 twin
//    re-pins are now re-locked there too)
//  - attackRowMissingToHit "authored attack_bonus keeps chip live" truth
//    leg + whole-DB suppression census → MonsterAction.ma0286-slam-
//    suppression.test.jsx (its census skips attack_bonus-non-null rows, so
//    the wolf "+4" chip press is unowned and lives here)
// Tuple-miss delta held here: exact disk keys BY NAME + verbatim row bytes
// (owner's ?? fallbacks cannot distinguish absent-vs-null; verbatim toEqual
// absorbs the description-verbatim "Medium or smaller" clause and the absent
// save_dc/save_type/save_effect/escape_dc/hit_target_effect fields), then
// the "+4" chip press delivers that exact row through onAttack (identity —
// payload IS the disk object, MonsterAction.jsx:480). Wolf is Bite-only and
// Pack Tactics stays prose-only BY NAME — inverted nowhere else.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const WOLF = monsters.find((m) => m.index === 'wolf');
const BITE = WOLF.actions.find((a) => a.name === 'Bite');

const BITE_EXACT = {
  name: 'Bite',
  description: 'Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage. If the target is a Medium or smaller creature, it has the Prone condition.',
  attack_bonus: 4,
  reach: '5 ft.',
  damage_dice_primary: '1d6 + 2',
  damage_type_primary: 'Piercing',
  hit_conditions: ['prone'],
};

describe('MA-1726 wolf Bite hit_conditions fix', () => {
  it('delta fingerprint: exact keys + verbatim bytes, "+4" chip presses the exact row, Pack Tactics stays prose-only', () => {
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
    // Exact bytes: any drifted leg (+4, 5 ft., 1d6 + 2 Piercing), any
    // authored save_dc/save_type/save_effect/escape_dc/hit_target_effect,
    // or reworded "Medium or smaller ... Prone" prose breaks this one pin.
    expect(BITE).toEqual(BITE_EXACT);

    // Chip-level dispatch: exactly one "+4" attack chip (no stale
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
    expect(chips).toEqual(['+4']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Bite', 4, BITE_EXACT);
    // Identity: the payload IS the disk row — hit_conditions bytes ride the
    // attack lane untouched (no copy/strip) into the clause consumer.
    expect(onAttack.mock.calls[0][2]).toBe(BITE);

    // Inverted delta BY NAME: the fix did not leak — wolf stays Bite-only
    // and Pack Tactics remains prose-only with no structured row.
    expect(WOLF.actions).toHaveLength(1);
    expect(WOLF.traits.map((t) => t.name)).toEqual(['Pack Tactics']);
    expect(WOLF.traits[0].hit_conditions).toBeUndefined();
  });
});
