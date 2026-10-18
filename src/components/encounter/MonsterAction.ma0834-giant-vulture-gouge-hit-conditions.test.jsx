// MA-0834: Giant Vulture "Gouge" — prose carries "the target has the Poisoned
// condition until the end of its next turn" but the row shipped WITHOUT
// hit_conditions, so the poisoned rider was structurally inert
// (buildHitConditionClause reads hit_conditions/escape_dc keys only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions,
// which stamps meta{source} only — duration residual stays GM-advisory, §70).
// One-field DATA fix mirroring the dracolich MA-0621 byte-shape twin and the
// ma0807/ma0819 template (MA-0010 seam): hit_conditions:["poisoned"] after
// damage_type_primary. giant-vulture is deliberately NOT in the mega
// HIT_CLAUSE_ROWS table (handlePlainDamage.hitClause.test.js:224-282), so
// this file is the row's only lane — disk fingerprint + chip press, exact
// bytes, nothing else. No escape_dc, no save fields, no escape clause.
// @maintained-by-ai
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const GOUGE = monsters.find((m) => m.index === 'giant-vulture').actions[0];

describe('MA-0834 giant-vulture Gouge poisoned rider', () => {
  it('disk fingerprint: exact row bytes, exact key order, hit_conditions ["poisoned"] after damage_type_primary, no escape/save fields', () => {
    expect(GOUGE).toEqual({
      name: 'Gouge',
      description: 'Melee Attack Roll: +4, reach 5 ft. Hit: 9 (2d6 + 2) Piercing damage, and the target has the <strong>Poisoned</strong> condition until the end of its next turn.',
      attack_bonus: 4,
      reach: '5 ft.',
      damage_dice_primary: '2d6 + 2',
      damage_type_primary: 'Piercing',
      hit_conditions: ['poisoned'],
    });
    expect(Object.keys(GOUGE)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'damage_dice_primary',
      'damage_type_primary',
      'hit_conditions',
    ]);
    // Clause arming (escapeDc:null) + suppression + chip class of this exact
    // row are owned generically by the mega lane
    // (handlePlainDamage.hitClause.test.js:183-334) — not repeated here.
  });

  it('chip press: one "+4" chip routes the exact disk row through onAttack by identity', () => {
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={GOUGE}
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
    const chips = [...container.querySelectorAll('.mc-dice-link')];
    expect(chips.map((c) => c.textContent.trim())).toEqual(['+4']);
    fireEvent.click(chips[0]);
    expect(onAttack).toHaveBeenCalledTimes(1);
    const [name, bonus, row] = onAttack.mock.calls[0];
    expect(name).toBe('Gouge');
    expect(bonus).toBe(4);
    expect(row).toBe(GOUGE);
  });
});
