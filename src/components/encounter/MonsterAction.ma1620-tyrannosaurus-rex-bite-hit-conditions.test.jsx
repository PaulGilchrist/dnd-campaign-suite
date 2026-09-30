// MA-1620: Tyrannosaurus Rex "Bite" — prose carries "If the target is a
// Large or smaller creature, it has the Grappled condition (escape DC 17)"
// but the row shipped WITHOUT hit_conditions/escape_dc, so the grapple rider
// was structurally inert (buildHitConditionClause reads hit_conditions/
// escape_dc keys only, NEVER description; consumer live in handlePlainDamage.
// applyHitClauseConditions w/ size gate isLargeOrSmallerTarget at :836).
// Two-field DATA fix mirroring the MA-0909/MA-1274 byte-shape (MA-0010
// seam): hit_conditions:["grappled"] + escape_dc:17 placed after
// damage_type_primary. Locks: disk row shape + key placement, clause arms
// Grappled with escapeDc:17, damage/description fields byte-unchanged, the
// "+10" attack chip stays live, no save fields on row, Tail row untouched.
// "While Grappled → Restrained + Tail immunity" is the sustained-grapple
// state machine with zero producers (§70) — GM-adjudicated residual; single
// grappled grant is the ceiling, restrained must NOT join hit_conditions.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const REX = monsters.find((m) => m.index === 'tyrannosaurus-rex');
const BITE = REX.actions[1];
const TAIL = REX.actions[2];

describe('MA-1620 disk fingerprint: tyrannosaurus-rex Bite grapple rider fix', () => {
  it('disk row carries hit_conditions ["grappled"] + escape_dc 17 after damage_type_primary (MA-0909/MA-1274 byte-shape)', () => {
    expect(BITE.name).toBe('Bite');
    expect(BITE.hit_conditions).toEqual(['grappled']);
    expect(BITE.escape_dc).toBe(17);
    const keys = Object.keys(BITE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(BITE.attack_bonus).toBe(10);
    expect(BITE.reach).toBe('10 ft.');
  });

  it('damage + description fields byte-unchanged (core numeric axis was already live)', () => {
    expect(BITE.damage_dice_primary).toBe('4d12 + 7');
    expect(BITE.damage_type_primary).toBe('Piercing');
    expect(BITE.description).toContain('escape DC 17');
    expect(BITE.description).toContain('Grappled condition');
  });

  it('row carries NO save fields (attack ride, no save leg)', () => {
    expect(BITE.save_dc).toBeUndefined();
    expect(BITE.save_type).toBeUndefined();
    expect(BITE.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled rider with escapeDc 17 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(BITE);
    expect(clause).toEqual({
      conditions: ['grappled'],
      escapeDc: 17,
      attackName: 'Bite',
      targetEffect: null,
    });
  });

  it('restrained NEVER joins hit_conditions (sustained-grapple state machine = §70 advisory)', () => {
    expect(BITE.hit_conditions).not.toContain('restrained');
    expect(TAIL.hit_conditions).toBeUndefined();
    expect(TAIL.escape_dc).toBeUndefined();
  });

  it('attack half stays live: one "+10" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(BITE)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BITE}
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
    expect(chips).toEqual(['+10']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Bite', 10, expect.objectContaining({ name: 'Bite' }));
  });
});
