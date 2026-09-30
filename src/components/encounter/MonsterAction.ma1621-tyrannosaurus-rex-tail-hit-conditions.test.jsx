// MA-1621: Tyrannosaurus Rex "Tail" — prose carries "If the target is a
// Huge or smaller creature, it has the Prone condition" but the row shipped
// WITHOUT hit_conditions, so the prone rider was structurally inert
// (buildHitConditionClause reads hit_conditions keys only, NEVER
// description; consumer live-unarmed in handlePlainDamage.
// applyHitClauseConditions). One-field DATA fix, MA-0775/MA-0756/MA-1116
// byte-shape (MA-0010 seam): hit_conditions:["prone"] placed after
// damage_type_primary. Consumer size gate is Large-or-smaller; the RAW
// "Huge or smaller" gate is advisory at Medium+ victims (accepted family
// precedent). Locks: disk row shape + key placement, clause arms Prone with
// escapeDc null (no escape clause on this row), damage/description fields
// byte-unchanged, "+10" attack chip stays live, no save fields, Bite row
// (MA-1620) untouched.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const REX = monsters.find((m) => m.index === 'tyrannosaurus-rex');
const BITE = REX.actions[1];
const TAIL = REX.actions[2];

describe('MA-1621 disk fingerprint: tyrannosaurus-rex Tail prone rider fix', () => {
  it('disk row carries hit_conditions ["prone"] after damage_type_primary (MA-0775/MA-0756 byte-shape)', () => {
    expect(TAIL.name).toBe('Tail');
    expect(TAIL.hit_conditions).toEqual(['prone']);
    const keys = Object.keys(TAIL);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(TAIL.attack_bonus).toBe(10);
    expect(TAIL.reach).toBe('15 ft.');
  });

  it('damage + description fields byte-unchanged (core numeric axis was already live)', () => {
    expect(TAIL.damage_dice_primary).toBe('4d8 + 7');
    expect(TAIL.damage_type_primary).toBe('Bludgeoning');
    expect(TAIL.description).toContain('Prone condition');
    expect(TAIL.description).toContain('Huge or smaller');
  });

  it('no escape_dc on Tail row (prone has no escape clause)', () => {
    expect(TAIL.escape_dc).toBeUndefined();
  });

  it('row carries NO save fields (attack ride, no save leg)', () => {
    expect(TAIL.save_dc).toBeUndefined();
    expect(TAIL.save_type).toBeUndefined();
    expect(TAIL.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Prone rider with escapeDc null (was null pre-fix)', () => {
    const clause = buildHitConditionClause(TAIL);
    expect(clause).toEqual({
      conditions: ['prone'],
      escapeDc: null,
      attackName: 'Tail',
      targetEffect: null,
    });
  });

  it('Bite row (MA-1620) untouched: grappled + escape_dc 17, no prone', () => {
    expect(BITE.hit_conditions).toEqual(['grappled']);
    expect(BITE.escape_dc).toBe(17);
    expect(BITE.hit_conditions).not.toContain('prone');
  });

  it('attack half stays live: one "+10" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(TAIL)).toBe(false);
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
    expect(onAttack).toHaveBeenCalledWith('Tail', 10, expect.objectContaining({ name: 'Tail' }));
  });
});
