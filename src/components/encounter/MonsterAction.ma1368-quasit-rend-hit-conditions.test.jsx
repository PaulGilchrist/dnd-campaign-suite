// MA-1368: Quasit "Rend" — prose carries "Hit: 5 (1d4 + 3) Slashing damage,
// and the target has the Poisoned condition until the start of the quasit's
// next turn" but the row shipped WITHOUT hit_conditions, so the rider was
// structurally inert-unauthored (buildHitConditionClause reads
// hit_conditions/hit_target_effect/hit_condition_roll only, NEVER description;
// consumer live in handlePlainDamage.applyHitClauseConditions). One-field DATA
// fix: hit_conditions:["poisoned"] (MA-0621 dracolich Sickening-Ray byte-shape,
// placed after damage_type_primary). Locks: disk row shape + key placement,
// clause arms Poisoned, "+5" attack chip stays live, damage legs byte-unchanged,
// no escape/roll/te rider keys smuggled in.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const REND = monsters.find((m) => m.index === 'quasit').actions[0];

describe('MA-1368 disk fingerprint: quasit Rend hit_conditions fix', () => {
  it('disk row carries hit_conditions ["poisoned"] after damage_type_primary (MA-0621 byte-shape)', () => {
    expect(REND.hit_conditions).toEqual(['poisoned']);
    const keys = Object.keys(REND);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
  });

  it('damage/attack legs byte-unchanged', () => {
    expect(REND.name).toBe('Rend');
    expect(REND.attack_bonus).toBe(5);
    expect(REND.reach).toBe('5 ft.');
    expect(REND.damage_dice_primary).toBe('1d4 + 3');
    expect(REND.damage_type_primary).toBe('Slashing');
    expect(REND.save_dc).toBe(0);
    expect(REND.save_type).toBe('');
    expect(REND.save_effect).toBe('');
    expect(REND.description).toContain("until the start of the quasit's next turn");
  });

  it('buildHitConditionClause arms the Poisoned rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(REND);
    expect(clause).toEqual({
      conditions: ['poisoned'],
      escapeDc: null,
      attackName: 'Rend',
      targetEffect: null,
    });
  });

  it('no other rider keys authored (poisoned needs no escape/roll/te)', () => {
    expect(REND.escape_dc).toBeUndefined();
    expect(REND.hit_target_effect).toBeUndefined();
    expect(REND.hit_condition_roll).toBeUndefined();
    expect(REND.hit_choice).toBeUndefined();
  });

  it('attack half stays live: one "+5" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(REND)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={REND}
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
    expect(chips).toEqual(['+5']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Rend', 5, expect.objectContaining({ name: 'Rend' }));
  });
});
