// MA-1534: Stone Giant "Boulder" — prose carries "If the target is a Large or
// smaller creature, it has the Prone condition" but the row shipped WITHOUT
// hit_conditions, so the Prone rider was structurally inert (buildHitConditionClause
// reads hit_conditions/hit_target_effect/hit_condition_roll only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions with
// Large-or-smaller gate). One-field DATA fix: hit_conditions:["prone"] placed
// after damage_type_primary (MA-1116 Earthen Maul byte-shape twin). Locks: disk
// row shape + key placement, clause arm, core legs byte-unchanged, "+9" attack
// chip stays live, Multiattack/Stone Club siblings stay inert.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SG = monsters.find((m) => m.index === 'stone-giant');
const BOULDER = SG.actions.find((a) => a.name === 'Boulder');
const CLUB = SG.actions.find((a) => a.name === 'Stone Club');
const MULTI = SG.actions.find((a) => a.name === 'Multiattack');

describe('MA-1534 disk fingerprint: stone-giant Boulder hit_conditions fix', () => {
  it('disk row carries hit_conditions ["prone"] after damage_type_primary (MA-1116 byte-shape)', () => {
    expect(BOULDER.hit_conditions).toEqual(['prone']);
    const keys = Object.keys(BOULDER);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys[keys.length - 1]).toBe('hit_conditions');
  });

  it('core legs byte-unchanged: +9, 60/240 ft., 2d8 + 6 Bludgeoning', () => {
    expect(BOULDER.attack_bonus).toBe(9);
    expect(BOULDER.range).toBe('60/240 ft.');
    expect(BOULDER.damage_dice_primary).toBe('2d8 + 6');
    expect(BOULDER.damage_type_primary).toBe('Bludgeoning');
    expect(BOULDER.description).toBe(
      'Ranged Attack Roll: +9, range 60/240 ft. Hit: 15 (2d8 + 6) Bludgeoning damage. If the target is a Large or smaller creature, it has the Prone condition.'
    );
  });

  it('no save lane, no escape clock, no hit_target_effect authored', () => {
    expect(BOULDER.save_dc).toBeUndefined();
    expect(BOULDER.save_type).toBeUndefined();
    expect(BOULDER.save_effect).toBeUndefined();
    expect(BOULDER.escape_dc).toBeUndefined();
    expect(BOULDER.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Prone rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(BOULDER);
    expect(clause).toEqual({
      conditions: ['prone'],
      escapeDc: null,
      attackName: 'Boulder',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+9" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(BOULDER)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BOULDER}
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
    expect(chips).toEqual(['+9']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Boulder', 9, expect.objectContaining({ name: 'Boulder' }));
  });

  it('sibling rows inert: Multiattack + Stone Club stay hit_conditions-free', () => {
    expect(MULTI.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(MULTI)).toBeNull();
    expect(CLUB.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(CLUB)).toBeNull();
  });
});
