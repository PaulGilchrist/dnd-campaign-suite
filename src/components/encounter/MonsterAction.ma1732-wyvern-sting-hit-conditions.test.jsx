// MA-1732: Wyvern "Sting" — prose carries "the target has the Poisoned
// condition until the start of the wyvern's next turn" but the row shipped
// WITHOUT hit_conditions, so the Poisoned rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions with Large-or-smaller gate).
// One-field DATA fix: hit_conditions:["poisoned"] placed after
// damage_type_secondary (MA-1723 Winter Wolf / MA-1726 Wolf lane, Ettercap
// byte-twin template). Locks: disk row shape + key placement, clause arm,
// core legs byte-unchanged, "+7" attack chip stays live, Bite sibling stays
// inert.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const WYVERN = monsters.find((m) => m.index === 'wyvern');
const STING = WYVERN.actions.find((a) => a.name === 'Sting');
const BITE = WYVERN.actions.find((a) => a.name === 'Bite');

describe('MA-1732 disk fingerprint: wyvern Sting hit_conditions fix', () => {
  it('disk row is actions[2] Sting and carries hit_conditions ["poisoned"] after damage_type_secondary (Ettercap byte-shape)', () => {
    expect(WYVERN.actions[2]).toBe(STING);
    expect(STING.hit_conditions).toEqual(['poisoned']);
    const keys = Object.keys(STING);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_secondary') + 1);
    expect(keys[keys.length - 1]).toBe('hit_conditions');
  });

  it('core legs byte-unchanged: +7, 10 ft. reach, 2d6 + 4 Piercing + 7d6 Poison', () => {
    expect(STING.attack_bonus).toBe(7);
    expect(STING.reach).toBe('10 ft.');
    expect(STING.damage_dice_primary).toBe('2d6 + 4');
    expect(STING.damage_type_primary).toBe('Piercing');
    expect(STING.damage_dice_secondary).toBe('7d6');
    expect(STING.damage_type_secondary).toBe('Poison');
    expect(STING.description).toBe(
      'Melee Attack Roll: +7, reach 10 ft. Hit: 11 (2d6 + 4) Piercing damage plus 24 (7d6) Poison damage, and the target has the Poisoned condition until the start of the wyvern\'s next turn.'
    );
  });

  it('no save lane, no escape clock, no hit_target_effect authored', () => {
    expect(STING.save_dc).toBeUndefined();
    expect(STING.save_type).toBeUndefined();
    expect(STING.save_effect).toBeUndefined();
    expect(STING.escape_dc).toBeUndefined();
    expect(STING.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Poisoned rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(STING);
    expect(clause).toEqual({
      conditions: ['poisoned'],
      escapeDc: null,
      attackName: 'Sting',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+7" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(STING)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={STING}
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
    expect(chips).toEqual(['+7']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Sting', 7, expect.objectContaining({ name: 'Sting' }));
  });

  it('sibling rows inert: Bite and Multiattack stay hit_conditions-free', () => {
    expect(BITE.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(BITE)).toBeNull();
    const MULTI = WYVERN.actions.find((a) => a.name === 'Multiattack');
    expect(MULTI.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(MULTI)).toBeNull();
  });
});
