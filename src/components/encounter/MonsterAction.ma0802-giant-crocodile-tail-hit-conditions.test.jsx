// @maintained-by-ai
// MA-0802: Giant Crocodile "Tail" — prose carries "If the target is a Large
// or smaller creature, it has the Prone condition" but the row shipped WITHOUT
// hit_conditions, so the condition rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions with isLargeOrSmallerTarget
// gate — Bandit Medium passes). One-field DATA fix: hit_conditions:["prone"]
// (MA-0621/MA-0791 byte-shape, placed after damage_type_primary).
// giant-crocodile is NOT in handlePlainDamage.hitClause HIT_CLAUSE_ROWS
// :224-281 (grep-verified — only plain crocodile Bite :248 sits there, no
// giant-crocodile row and no plain-crocodile Tail twin) and no other lane
// pins this chip, so THIS file is the sole Tail byte-owner: one fused test
// locks disk row shape + key placement + full row bytes (exact-bytes toEqual
// absorbs the no-save-fields absence check and every numerics pin incl.
// 10 ft. reach), then the "+8" chip press delivers that exact row through
// onAttack (identity — payload IS the disk object). Clause arm for a
// conditions-only prone row is owned generically by the hitClause mega-lane
// (:183-301 once: generic clause shapes + table data-locks via prone twins
// ankylosaurus Tail :228 / brown-bear Claw :238) — no local
// buildHitConditionClause/attackRowMissingToHit re-derivation; exact bytes +
// live chip are the tighter pin. Bite twin bytes (+8, 3d10 + 5 Piercing,
// grappled/restrained + escape_dc 15) are fully owned by the ma0801
// sole-owner fingerprint test (green) — former :65-74 partial-byte twin-guard
// block deleted per fused-canon mapping #431, do NOT re-lock here.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TAIL = monsters.find((m) => m.index === 'giant-crocodile').actions[2];

const TAIL_EXACT = {
  name: 'Tail',
  description: 'Melee Attack Roll: +8, reach 10 ft. Hit: 18 (3d8 + 5) Bludgeoning damage. If the target is a Large or smaller creature, it has the <strong>Prone</strong> condition.',
  attack_bonus: 8,
  reach: '10 ft.',
  damage_dice_primary: '3d8 + 5',
  damage_type_primary: 'Bludgeoning',
  hit_conditions: ['prone'],
};

describe('MA-0802 disk fingerprint: giant-crocodile Tail hit_conditions fix', () => {
  it('sole-owner row fingerprint + live "+8" chip presses exact row through onAttack', () => {
    // Byte-shape: keys BY NAME in transport order, hit_conditions sits
    // immediately after damage_type_primary (MA-0621/MA-0791 byte-shape).
    expect(Object.keys(TAIL)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'damage_dice_primary',
      'damage_type_primary',
      'hit_conditions',
    ]);
    // Exact bytes: any added escape_dc/save_dc/save_type/hit_target_effect or
    // drifted numeric (+8 attack bonus, 10 ft. reach, 3d8 + 5 Bludgeoning)
    // breaks this one assertion (absorbs field-absence).
    expect(TAIL).toEqual(TAIL_EXACT);

    // Chip-level dispatch: exactly one "+8" attack chip (no damage chip —
    // attack_bonus arms the attack lane), press routes name/bonus/row once.
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
    expect(chips).toEqual(['+8']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Tail', 8, TAIL_EXACT);
    // Identity: the payload IS the disk row — hit_conditions:["prone"] bytes
    // ride the attack lane untouched (no copy/strip) into the clause consumer.
    expect(onAttack.mock.calls[0][2]).toBe(TAIL);
  });
});
