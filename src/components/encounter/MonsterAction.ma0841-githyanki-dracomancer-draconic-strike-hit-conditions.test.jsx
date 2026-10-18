// MA-0841: Githyanki Dracomancer "Draconic Strike" — prose carries "the target has
// the Frightened condition until the start of the githyanki's next turn" but the row
// shipped WITHOUT hit_conditions, so the frightened rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/hit_condition_roll
// keys only, NEVER description; consumer live in handlePlainDamage
// .applyHitClauseConditions, which stamps meta{source} only — no rounds clock, so
// the duration residual stays GM-advisory, §70). One-field DATA fix mirroring the
// MA-0621/MA-0776 byte-shape twins and the ma0834/ma0819 template (MA-0010 seam):
// hit_conditions:["frightened"] placed after damage_type_secondary (dual-damage row
// shape, MA-0010 assassin/balor precedent); no escape_dc, no save fields, no escape
// clause. githyanki-dracomancer is deliberately NOT in the mega HIT_CLAUSE_ROWS
// table (handlePlainDamage.hitClause.test.js:224-282), so this file is the row's
// only lane — disk fingerprint + chip press, exact bytes, nothing else. Clause
// arming (escapeDc:null) and chip class of this shape are owned generically
// (mega lane :183-334 — cited once, not repeated here); this exact row's
// byte-identical buildHitConditionClause output is additionally pinned by
// MonsterCardHelpers.hit-choice.test.js:89-94 and MonsterCardModal.hit-choice
// .test.jsx:214. Hybrid row §147: ONE "+10" chip, no melee/ranged toggles or
// ranged dice swaps.
// @maintained-by-ai
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const STRIKE = monsters.find((m) => m.index === 'githyanki-dracomancer').actions[1];

describe('MA-0841 githyanki-dracomancer Draconic Strike frightened rider', () => {
  it('disk fingerprint: exact row bytes, exact key order — hit_conditions ["frightened"] after damage_type_secondary, secondary "5d6" Fire untouched, no escape/save fields', () => {
    expect(STRIKE).toEqual({
      name: 'Draconic Strike',
      description: 'Melee or Ranged Attack Roll: +10, reach 10 ft. or range 120 ft. Hit: 12 (2d6 + 5) Slashing damage plus 17 (5d6) Fire damage, and the target has the <strong>Frightened</strong> condition until the start of the githyanki\'s next turn.',
      attack_bonus: 10,
      reach: '10 ft.',
      range: '120 ft.',
      damage_dice_primary: '2d6 + 5',
      damage_type_primary: 'Slashing',
      damage_dice_secondary: '5d6',
      damage_type_secondary: 'Fire',
      hit_conditions: ['frightened'],
    });
    expect(Object.keys(STRIKE)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'range',
      'damage_dice_primary',
      'damage_type_primary',
      'damage_dice_secondary',
      'damage_type_secondary',
      'hit_conditions',
    ]);
  });

  it('chip press: one "+10" chip (§147 hybrid — no range-mode toggles or dice swaps) routes the exact disk row through onAttack by identity', () => {
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={STRIKE}
        index={1}
        attackerCannotAct={false}
        onAttack={onAttack}
        onDamage={vi.fn()}
        onSaveRoll={vi.fn()}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
      />
    );
    const chips = [...container.querySelectorAll('.mc-dice-link')];
    expect(chips.map((c) => c.textContent.trim())).toEqual(['+10']);
    fireEvent.click(chips[0]);
    expect(onAttack).toHaveBeenCalledTimes(1);
    const [name, bonus, row] = onAttack.mock.calls[0];
    expect(name).toBe('Draconic Strike');
    expect(bonus).toBe(10);
    expect(row).toBe(STRIKE);
  });
});
