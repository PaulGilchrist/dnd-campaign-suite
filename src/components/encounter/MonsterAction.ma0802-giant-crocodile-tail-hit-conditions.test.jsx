// MA-0802: Giant Crocodile "Tail" — prose carries "If the target is a Large
// or smaller creature, it has the Prone condition" but the row shipped WITHOUT
// hit_conditions, so the condition rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions with isLargeOrSmallerTarget
// gate — Bandit Medium passes). One-field DATA fix: hit_conditions:["prone"]
// (MA-0621/MA-0791 byte-shape, placed after damage_type_primary). Locks:
// disk row shape + key placement, clause arm, "+8" attack chip stays live,
// Bite twin (MA-0801 grapple rider) byte-unchanged.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TAIL = monsters.find((m) => m.index === 'giant-crocodile').actions[2];
const BITE = monsters.find((m) => m.index === 'giant-crocodile').actions[1];

describe('MA-0802 disk fingerprint: giant-crocodile Tail hit_conditions fix', () => {
  it('disk row carries hit_conditions ["prone"] after damage_type_primary (MA-0621 byte-shape)', () => {
    expect(TAIL.name).toBe('Tail');
    expect(TAIL.hit_conditions).toEqual(['prone']);
    const keys = Object.keys(TAIL);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(TAIL.attack_bonus).toBe(8);
    expect(TAIL.reach).toBe('10 ft.');
    expect(TAIL.damage_dice_primary).toBe('3d8 + 5');
    expect(TAIL.damage_type_primary).toBe('Bludgeoning');
  });

  it('buildHitConditionClause arms the Prone rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(TAIL);
    expect(clause).toEqual({
      conditions: ['prone'],
      escapeDc: null,
      attackName: 'Tail',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+8" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(TAIL)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TAIL}
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
    expect(chips).toEqual(['+8']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Tail', 8, expect.objectContaining({ name: 'Tail' }));
  });

  it('Bite twin byte-unchanged (MA-0801 fix not disturbed): grapple rider intact', () => {
    expect(BITE.hit_conditions).toEqual(['grappled', 'restrained']);
    expect(BITE.escape_dc).toBe(15);
    expect(BITE.attack_bonus).toBe(8);
    expect(BITE.damage_dice_primary).toBe('3d10 + 5');
    expect(BITE.damage_type_primary).toBe('Piercing');
    const clause = buildHitConditionClause(BITE);
    expect(clause.conditions).toEqual(['grappled', 'restrained']);
    expect(clause.escapeDc).toBe(15);
  });
});
