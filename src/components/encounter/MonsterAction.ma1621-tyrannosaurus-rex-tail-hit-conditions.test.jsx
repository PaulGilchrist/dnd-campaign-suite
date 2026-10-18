// @maintained-by-ai
// MA-1621: Tyrannosaurus Rex "Tail" — prose carries "If the target is a
// Huge or smaller creature, it has the Prone condition" but the row shipped
// WITHOUT hit_conditions, so the prone rider was structurally inert
// (buildHitConditionClause reads hit_conditions keys only, NEVER
// description; consumer live-unarmed in handlePlainDamage.
// applyHitClauseConditions). One-field DATA fix,
// MA-0775/MA-0756/MA-1116 byte-shape (MA-0010 seam): hit_conditions:
// ["prone"] placed after damage_type_primary. Consumer size gate is
// Large-or-smaller; the RAW "Huge or smaller" gate is advisory at Medium+
// victims (accepted family precedent). Unowned plain fused-1: absorption
// grep HIT_CLAUSE_ROWS (handlePlainDamage.hitClause.test.js :224-282,
// grep-verified BY NAME — no tyrannosaurus row; the only Tail tuple there
// is ankylosaurus prone :228) → this file is the sole byte-owner of the
// Tail row: keys BY NAME + verbatim toEqual (absorbs damage/description
// byte pins, escape_dc/save_dc/save_type/hit_target_effect absence, and
// the ['prone'] rider bytes), clause arm pinned locally, then the "+10"
// chip press delivers the exact row through onAttack (identity — payload
// IS the disk object).
// OWNERS OUTSIDE THIS FILE (trimmed, cited):
//  - attackRowMissingToHit suppression-gate truth table + whole-database
//    live-chip census (tyrannosaurus Tail sits in census) → MonsterAction.
//    ma0286-slam-suppression.test.jsx :89-113
//  - Bite row (MA-1620) full byte fingerprint incl. grappled + escape_dc 17
//    and prone-absence → MonsterAction.ma1620-tyrannosaurus-rex-bite-hit-
//    conditions.test.jsx (verbatim toEqual :71, byte-twin inverted pin here
//    pruned as weaker partial of those same bytes)
//  - generic clause-shape passthrough (conditions+escapeDc, te-only, null)
//    → handlePlainDamage.hitClause.test.js :183-214
//  - prone condition semantics consumer → conditionEffects lanes
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TAIL = monsters.find((m) => m.index === 'tyrannosaurus-rex').actions[2];

const TAIL_EXACT = {
  name: 'Tail',
  description: 'Melee Attack Roll: +10, reach 15 ft. Hit: 25 (4d8 + 7) Bludgeoning damage. If the target is a Huge or smaller creature, it has the Prone condition.',
  attack_bonus: 10,
  reach: '15 ft.',
  damage_dice_primary: '4d8 + 7',
  damage_type_primary: 'Bludgeoning',
  hit_conditions: ['prone'],
};

describe('MA-1621 disk fingerprint: tyrannosaurus-rex Tail prone rider fix', () => {
  it('sole-owner row fingerprint + prone clause arm (escapeDc null) + live "+10" chip presses exact row through onAttack', () => {
    // Byte-shape: keys BY NAME in transport order, hit_conditions sits
    // immediately after damage_type_primary (MA-0775/MA-0756 byte-shape).
    expect(Object.keys(TAIL)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'damage_dice_primary',
      'damage_type_primary',
      'hit_conditions',
    ]);
    // Exact bytes: any added escape_dc/save_dc/save_type/hit_target_effect,
    // any rider drift away from ['prone'], or drifted numeric (+10 attack
    // bonus, 15 ft. reach, 4d8 + 7 Bludgeoning) breaks this one assertion
    // (absorbs the core numeric/description "Prone condition"/"Huge or
    // smaller" pins and the no-escape-clause absence check).
    expect(TAIL).toEqual(TAIL_EXACT);

    // Tuple-miss delta: no HIT_CLAUSE_ROWS twin arms this exact
    // conditions-only prone clause — pin the arm locally (was null pre-fix).
    expect(buildHitConditionClause(TAIL)).toEqual({
      conditions: ['prone'],
      escapeDc: null,
      attackName: 'Tail',
      targetEffect: null,
    });

    // Chip-level dispatch: exactly one "+10" attack chip (attack_bonus arms
    // the attack lane — suppression-gate OFF leg owned by ma0286), press
    // routes name/bonus/row once.
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TAIL}
        index={2}
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
    expect(chips).toEqual(['+10']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Tail', 10, TAIL_EXACT);
    // Identity: the payload IS the disk row — hit_conditions bytes ride the
    // attack lane untouched (no copy/strip) into the clause consumer.
    expect(onAttack.mock.calls[0][2]).toBe(TAIL);
  });
});
