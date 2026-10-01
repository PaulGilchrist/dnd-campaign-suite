// MA-1726: Wolf "Bite" — prose carries "If the target is a Medium or
// smaller creature, it has the Prone condition" but the row shipped WITHOUT
// hit_conditions, so the Prone rider was structurally inert (buildHitConditionClause
// reads hit_conditions/hit_target_effect/hit_condition_roll only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions with
// Large-or-smaller gate — Medium Bandit passes). One-field DATA fix:
// hit_conditions:["prone"] placed after damage_type_primary (MA-1723
// winter-wolf Bite / MA-1534 Boulder / MA-1541 Thunderbolt byte-shape twins).
// Locks: disk row shape + key placement, clause arm, core legs byte-unchanged,
// "+4" attack chip stays live, Pack Tactics stays prose-only (no structured row).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const WOLF = monsters.find((m) => m.index === 'wolf');
const BITE = WOLF.actions.find((a) => a.name === 'Bite');
const WINTER_BITE = monsters.find((m) => m.index === 'winter-wolf').actions.find((a) => a.name === 'Bite');

describe('MA-1726 disk fingerprint: wolf Bite hit_conditions fix', () => {
  it('disk row carries hit_conditions ["prone"] after damage_type_primary (MA-1723 byte-shape)', () => {
    expect(BITE.hit_conditions).toEqual(['prone']);
    const keys = Object.keys(BITE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys[keys.length - 1]).toBe('hit_conditions');
  });

  it('core legs byte-unchanged: +4, 5 ft. reach, 1d6 + 2 Piercing', () => {
    expect(BITE.attack_bonus).toBe(4);
    expect(BITE.reach).toBe('5 ft.');
    expect(BITE.damage_dice_primary).toBe('1d6 + 2');
    expect(BITE.damage_type_primary).toBe('Piercing');
    expect(BITE.description).toBe(
      'Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage. If the target is a Medium or smaller creature, it has the Prone condition.'
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

  it('attack half stays live: one "+4" chip, no stale suppression', () => {
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
    expect(chips).toEqual(['+4']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Bite', 4, expect.objectContaining({ name: 'Bite' }));
  });

  it('wolf is Bite-only: Pack Tactics stays prose-only, winter-wolf twin byte-intact', () => {
    expect(WOLF.actions).toHaveLength(1);
    expect(WOLF.traits.map((t) => t.name)).toEqual(['Pack Tactics']);
    expect(WOLF.traits[0].hit_conditions).toBeUndefined();
    expect(WINTER_BITE.hit_conditions).toEqual(['prone']);
    expect(WINTER_BITE.attack_bonus).toBe(6);
    expect(WINTER_BITE.damage_dice_primary).toBe('2d6 + 4');
  });
});
