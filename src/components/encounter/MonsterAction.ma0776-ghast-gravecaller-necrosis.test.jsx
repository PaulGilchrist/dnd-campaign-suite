// MA-0776: Ghast Gravecaller "Horrific Necrosis" — prose carries "Hit: ...
// the target has the Frightened condition" but the row shipped WITHOUT
// hit_conditions, so the condition rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). One-field DATA fix:
// hit_conditions:["frightened"] (MA-0621/MA-0763/MA-0775 byte-shape, placed
// after damage_type_primary). Locks: disk row shape + key placement, clause
// arms the Frightened rider (was null pre-fix), "+7" attack chip stays live.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const NECROSIS = monsters.find((m) => m.index === 'ghast-gravecaller').actions[2];

describe('MA-0776 disk fingerprint: ghast-gravecaller Horrific Necrosis hit_conditions fix', () => {
  it('disk row carries hit_conditions ["frightened"] after damage_type_primary (MA-0621 byte-shape)', () => {
    expect(NECROSIS.hit_conditions).toEqual(['frightened']);
    const keys = Object.keys(NECROSIS);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(NECROSIS.attack_bonus).toBe(7);
    expect(NECROSIS.damage_dice_primary).toBe('2d10 + 4');
    expect(NECROSIS.damage_type_primary).toBe('Necrotic');
    expect(NECROSIS.description).toContain('Frightened');
  });

  it('buildHitConditionClause arms the Frightened rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(NECROSIS);
    expect(clause).toEqual({
      conditions: ['frightened'],
      escapeDc: null,
      attackName: 'Horrific Necrosis',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+7" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(NECROSIS)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={NECROSIS}
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
    expect(chips).toEqual(['+7']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Horrific Necrosis', 7, expect.objectContaining({ name: 'Horrific Necrosis' }));
  });
});
