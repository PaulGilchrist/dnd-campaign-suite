// MA-1723: Winter Wolf "Bite" — prose carries "If the target is a Large or
// smaller creature, it has the Prone condition" but the row shipped WITHOUT
// hit_conditions, so the Prone rider was structurally inert (buildHitConditionClause
// reads hit_conditions/hit_target_effect/hit_condition_roll only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions with
// Large-or-smaller gate). One-field DATA fix: hit_conditions:["prone"] placed
// after damage_type_primary (MA-1534 Boulder / MA-1541 Thunderbolt byte-shape
// twins). Locks: disk row shape + key placement, clause arm, core legs
// byte-unchanged, "+6" attack chip stays live, Cold Breath sibling stays
// inert (Pack Tactics is prose-only — no structured row exists).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const WW = monsters.find((m) => m.index === 'winter-wolf');
const BITE = WW.actions.find((a) => a.name === 'Bite');
const BREATH = WW.actions.find((a) => a.name === 'Cold Breath');

describe('MA-1723 disk fingerprint: winter-wolf Bite hit_conditions fix', () => {
  it('disk row carries hit_conditions ["prone"] after damage_type_primary (MA-1534 byte-shape)', () => {
    expect(BITE.hit_conditions).toEqual(['prone']);
    const keys = Object.keys(BITE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys[keys.length - 1]).toBe('hit_conditions');
  });

  it('core legs byte-unchanged: +6, 5 ft. reach, 2d6 + 4 Piercing', () => {
    expect(BITE.attack_bonus).toBe(6);
    expect(BITE.reach).toBe('5 ft.');
    expect(BITE.damage_dice_primary).toBe('2d6 + 4');
    expect(BITE.damage_type_primary).toBe('Piercing');
    expect(BITE.description).toBe(
      'Melee Attack Roll: +6, reach 5 ft. Hit: 11 (2d6 + 4) Piercing damage. If the target is a Large or smaller creature, it has the Prone condition.'
    );
  });

  it('no save lane, no escape clock, no hit_target_effect authored', () => {
    expect(BITE.save_dc).toBeUndefined();
    expect(BITE.save_type).toBeUndefined();
    expect(BITE.save_effect).toBeUndefined();
    expect(BITE.escape_dc).toBeUndefined();
    expect(BITE.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Prone rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(BITE);
    expect(clause).toEqual({
      conditions: ['prone'],
      escapeDc: null,
      attackName: 'Bite',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+6" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(BITE)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BITE}
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
    expect(chips).toEqual(['+6']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Bite', 6, expect.objectContaining({ name: 'Bite' }));
  });

  it('sibling row inert: Cold Breath stays hit_conditions-free (save lane only)', () => {
    expect(BREATH.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(BREATH)).toBeNull();
  });
});
