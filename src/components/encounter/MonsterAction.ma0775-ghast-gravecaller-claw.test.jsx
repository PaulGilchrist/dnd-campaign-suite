// MA-0775: Ghast Gravecaller "Claw" — prose carries "Hit: ... it has the
// Paralyzed condition" but the row shipped WITHOUT hit_conditions, so the
// condition rider was structurally inert (buildHitConditionClause reads
// hit_conditions/hit_target_effect/hit_condition_roll only, NEVER description;
// consumer live in handlePlainDamage.applyHitClauseConditions). One-field DATA
// fix: hit_conditions:["paralyzed"] (MA-0621/MA-0763 byte-shape, placed after
// damage_type_primary). Locks: disk row shape + key placement, clause arm,
// "+6" attack chip stays live, Horrific Necrosis twin byte-unchanged.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const CLAW = monsters.find((m) => m.index === 'ghast-gravecaller').actions[1];
const NECROSIS = monsters.find((m) => m.index === 'ghast-gravecaller').actions[2];

describe('MA-0775 disk fingerprint: ghast-gravecaller Claw hit_conditions fix', () => {
  it('disk row carries hit_conditions ["paralyzed"] after damage_type_primary (MA-0621 byte-shape)', () => {
    expect(CLAW.hit_conditions).toEqual(['paralyzed']);
    const keys = Object.keys(CLAW);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(CLAW.attack_bonus).toBe(6);
    expect(CLAW.damage_dice_primary).toBe('3d6 + 3');
    expect(CLAW.damage_type_primary).toBe('Slashing');
  });

  it('buildHitConditionClause arms the Paralyzed rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(CLAW);
    expect(clause).toEqual({
      conditions: ['paralyzed'],
      escapeDc: null,
      attackName: 'Claw',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+6" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(CLAW)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={CLAW}
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
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+6']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Claw', 6, expect.objectContaining({ name: 'Claw' }));
  });

  it('Horrific Necrosis twin now authored: hit_conditions ["frightened"] (MA-0776 fix, pin inverted)', () => {
    expect(NECROSIS.hit_conditions).toEqual(['frightened']);
    expect(buildHitConditionClause(NECROSIS)).toEqual({
      conditions: ['frightened'],
      escapeDc: null,
      attackName: 'Horrific Necrosis',
      targetEffect: null,
    });
    expect(NECROSIS.attack_bonus).toBe(7);
  });
});
