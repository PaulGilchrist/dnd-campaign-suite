// MA-1541: Storm Giant "Thunderbolt" — prose carries "Hit: 22 (2d12 + 9)
// Lightning damage, and the target has the Blinded and Deafened conditions until
// the start of the giant's next turn" but the row shipped WITHOUT hit_conditions,
// so the rider was structurally inert (buildHitConditionClause reads
// hit_conditions/hit_target_effect/hit_condition_roll only, NEVER description;
// consumer live in handlePlainDamage.applyHitClauseConditions, granting both
// conditions + attacker-next-turn expiry clock). One-field DATA fix:
// hit_conditions:["blinded","deafened"] after damage_type_primary (MA-1534
// Boulder byte-shape twin, MA-1116 lineage). Locks: disk row shape + key
// placement, clause arms BOTH conditions, core legs byte-unchanged, "+14"
// attack chip stays live, Multiattack/Storm Sword siblings stay inert.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SG = monsters.find((m) => m.index === 'storm-giant');
const THUNDERBOLT = SG.actions.find((a) => a.name === 'Thunderbolt');
const STORM_SWORD = SG.actions.find((a) => a.name === 'Storm Sword');
const MULTI = SG.actions.find((a) => a.name === 'Multiattack');

describe('MA-1541 disk fingerprint: storm-giant Thunderbolt hit_conditions fix', () => {
  it('disk row carries hit_conditions ["blinded","deafened"] after damage_type_primary (MA-1534 byte-shape)', () => {
    expect(THUNDERBOLT.hit_conditions).toEqual(['blinded', 'deafened']);
    const keys = Object.keys(THUNDERBOLT);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys[keys.length - 1]).toBe('hit_conditions');
  });

  it('core legs byte-unchanged: +14, 500 ft., 2d12 + 9 Lightning', () => {
    expect(THUNDERBOLT.attack_bonus).toBe(14);
    expect(THUNDERBOLT.range).toBe('500 ft.');
    expect(THUNDERBOLT.damage_dice_primary).toBe('2d12 + 9');
    expect(THUNDERBOLT.damage_type_primary).toBe('Lightning');
    expect(THUNDERBOLT.description).toBe(
      "Ranged Attack Roll: +14, range 500 ft. Hit: 22 (2d12 + 9) Lightning damage, and the target has the Blinded and Deafened conditions until the start of the giant's next turn."
    );
  });

  it('no save lane, no escape clock, no hit_target_effect authored', () => {
    expect(THUNDERBOLT.save_dc).toBeUndefined();
    expect(THUNDERBOLT.save_type).toBeUndefined();
    expect(THUNDERBOLT.save_effect).toBeUndefined();
    expect(THUNDERBOLT.escape_dc).toBeUndefined();
    expect(THUNDERBOLT.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Blinded+Deafened rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(THUNDERBOLT);
    expect(clause).toEqual({
      conditions: ['blinded', 'deafened'],
      escapeDc: null,
      attackName: 'Thunderbolt',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+14" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(THUNDERBOLT)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={THUNDERBOLT}
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
    expect(chips).toEqual(['+14']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Thunderbolt', 14, expect.objectContaining({ name: 'Thunderbolt' }));
  });

  it('sibling rows inert: Multiattack + Storm Sword stay hit_conditions-free', () => {
    expect(MULTI.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(MULTI)).toBeNull();
    expect(STORM_SWORD.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(STORM_SWORD)).toBeNull();
  });
});
