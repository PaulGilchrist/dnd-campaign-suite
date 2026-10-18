// @maintained-by-ai
// MA-1732: Wyvern "Sting" — prose carries "the target has the Poisoned
// condition until the start of the wyvern's next turn" but the row shipped
// WITHOUT hit_conditions, so the Poisoned rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions with Large-or-smaller size
// gate). One-field DATA fix: hit_conditions:["poisoned"] placed after
// damage_type_secondary (MA-1723 Winter Wolf / MA-1726 Wolf lane, Ettercap
// byte-twin template).
// OWNED ELSEWHERE (trimmed, cited):
//  - Poisoned grant on resolved hit, provenance meta.source, escape-DC-free
//    condition log, once-only dedupe, clause-absent silence, and the
//    Large-or-smaller §1116 gate on THIS exact disk row → handlePlainDamage.
//    ma1732-wyvern-sting-poisoned-grant.test.js (runs buildHitCondition-
//    Clause(STING) at :139 through the resolved-hit seam — a clause-arm
//    regression here fails the grant owner first)
//  - buildHitConditionClause payload shape + no-rider null semantics →
//    handlePlainDamage.hitClause.test.js :211-216 and the describe.each
//    data-lock loop :289-301
//  - attackRowMissingToHit truth table + whole-DB suppression census →
//    MonsterAction.ma0286-slam-suppression.test.jsx :89-124 (its census
//    skips attack_bonus-non-null rows at :109, so the "+7" chip press is
//    unowned and lives here)
// Tuple-miss delta held here: wyvern is honestly absent from HIT_CLAUSE_ROWS
// (:224-282 ends winter-wolf/wolf/worg), and the owner loop's ?? fallbacks
// cannot distinguish absent-vs-null — exact disk keys BY NAME + verbatim row
// bytes pin every core leg (+7, 10 ft., 2d6 + 4 Piercing, 7d6 Poison), the
// terminal hit_conditions placement, and the absent save_dc/save_type/
// save_effect/escape_dc/hit_target_effect fields in one toEqual; the "+7"
// chip press then delivers that exact row through onAttack (identity —
// payload IS the disk object, MonsterAction.jsx:480). Bite and Multiattack
// siblings stay hit_conditions-free BY NAME — the fix did not leak.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const WYVERN = monsters.find((m) => m.index === 'wyvern');
const STING = WYVERN.actions.find((a) => a.name === 'Sting');
const BITE = WYVERN.actions.find((a) => a.name === 'Bite');
const MULTI = WYVERN.actions.find((a) => a.name === 'Multiattack');

const STING_EXACT = {
  name: 'Sting',
  description: 'Melee Attack Roll: +7, reach 10 ft. Hit: 11 (2d6 + 4) Piercing damage plus 24 (7d6) Poison damage, and the target has the Poisoned condition until the start of the wyvern\'s next turn.',
  attack_bonus: 7,
  reach: '10 ft.',
  damage_dice_primary: '2d6 + 4',
  damage_type_primary: 'Piercing',
  damage_dice_secondary: '7d6',
  damage_type_secondary: 'Poison',
  hit_conditions: ['poisoned'],
};

describe('MA-1732 wyvern Sting hit_conditions fix', () => {
  it('delta fingerprint: exact keys + verbatim bytes, "+7" chip presses the exact row, siblings stay inert', () => {
    // Byte-shape: keys BY NAME in transport order — hit_conditions sits
    // immediately after damage_type_secondary as the terminal key (Ettercap
    // byte-twin). Also arms the rider: no save_dc/save_type/save_effect/
    // escape_dc/hit_target_effect key can sneak in under this lock.
    expect(Object.keys(STING)).toEqual(Object.keys(STING_EXACT));
    // Exact bytes: any drifted leg (+7, 10 ft., 2d6 + 4 Piercing,
    // 7d6 Poison) or reworded "Poisoned ... next turn" prose breaks this
    // one pin.
    expect(STING).toEqual(STING_EXACT);

    // Chip-level dispatch: exactly one "+7" attack chip (no stale
    // suppression, no damage chip), press routes the disk row ONCE.
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={STING}
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
    expect(chips).toEqual(['+7']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Sting', 7, STING_EXACT);
    // Identity: the payload IS the disk row — hit_conditions bytes ride the
    // attack lane untouched (no copy/strip) into the clause consumer.
    expect(onAttack.mock.calls[0][2]).toBe(STING);

    // Inverted delta BY NAME: the fix did not leak — Bite and Multiattack
    // stay hit_conditions-free (clause-builder null semantics owned by
    // hitClause.test.js:211-215).
    expect(BITE.hit_conditions).toBeUndefined();
    expect(MULTI.hit_conditions).toBeUndefined();
  });
});
