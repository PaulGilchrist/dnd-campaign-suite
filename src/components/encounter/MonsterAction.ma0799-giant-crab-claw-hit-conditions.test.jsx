// MA-0799: Giant Crab "Claw" — prose carries "If the target is a Medium or
// smaller creature, it has the Grappled condition (escape DC 11) from one of
// two claws" but the row shipped WITHOUT hit_conditions/escape_dc, so the
// grapple rider was structurally inert (buildHitConditionClause reads
// hit_conditions/escape_dc keys only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). Two-field DATA fix:
// hit_conditions:["grappled"] + escape_dc:11 placed after damage_type_primary
// (MA-0010 Aberrant Cultist Tentacle Lash byte-shape). Locks: disk row shape
// + key placement, clause arms with escapeDc:11, "+3" attack chip stays live,
// no save fields on row.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const CLAW = monsters.find((m) => m.index === 'giant-crab').actions[0];

describe('MA-0799 disk fingerprint: giant-crab Claw grapple rider fix', () => {
  it('disk row carries hit_conditions ["grappled"] + escape_dc 11 after damage_type_primary (MA-0010 byte-shape)', () => {
    expect(CLAW.hit_conditions).toEqual(['grappled']);
    expect(CLAW.escape_dc).toBe(11);
    const keys = Object.keys(CLAW);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(CLAW.attack_bonus).toBe(3);
    expect(CLAW.reach).toBe('5 ft.');
    expect(CLAW.damage_dice_primary).toBe('1d6 + 1');
    expect(CLAW.damage_type_primary).toBe('Bludgeoning');
  });

  it('row carries NO save fields (attack ride, no save leg)', () => {
    expect(CLAW.save_dc).toBeUndefined();
    expect(CLAW.save_type).toBeUndefined();
    expect(CLAW.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled rider with escapeDc 11 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(CLAW);
    expect(clause).toEqual({
      conditions: ['grappled'],
      escapeDc: 11,
      attackName: 'Claw',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+3" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(CLAW)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={CLAW}
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
    expect(chips).toEqual(['+3']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Claw', 3, expect.objectContaining({ name: 'Claw' }));
  });
});
