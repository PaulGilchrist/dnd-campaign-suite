// MA-0791: Giant Axe Beak "Talons" — prose carries "If the target is a
// Large or smaller creature, it has the Prone condition" but the row shipped
// WITHOUT hit_conditions, so the condition rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions with isLargeOrSmallerTarget
// gate). One-field DATA fix: hit_conditions:["prone"] (MA-0621/MA-0756/
// MA-0775 byte-shape, placed after damage_type_primary). Locks: disk row
// shape + key placement, clause arm, "+8" attack chip stays live, Sharpened
// Beak twin byte-unchanged.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TALONS = monsters.find((m) => m.index === 'giant-axe-beak').actions[2];
const BEAK = monsters.find((m) => m.index === 'giant-axe-beak').actions[1];

describe('MA-0791 disk fingerprint: giant-axe-beak Talons hit_conditions fix', () => {
  it('disk row carries hit_conditions ["prone"] after damage_type_primary (MA-0621 byte-shape)', () => {
    expect(TALONS.hit_conditions).toEqual(['prone']);
    const keys = Object.keys(TALONS);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(TALONS.attack_bonus).toBe(8);
    expect(TALONS.reach).toBe('5 ft.');
    expect(TALONS.damage_dice_primary).toBe('2d8 + 5');
    expect(TALONS.damage_type_primary).toBe('Piercing');
  });

  it('buildHitConditionClause arms the Prone rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(TALONS);
    expect(clause).toEqual({
      conditions: ['prone'],
      escapeDc: null,
      attackName: 'Talons',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+8" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(TALONS)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TALONS}
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
    expect(onAttack).toHaveBeenCalledWith('Talons', 8, expect.objectContaining({ name: 'Talons' }));
  });

  it('Sharpened Beak twin byte-unchanged: no hit_conditions authored, clause null', () => {
    expect(BEAK.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(BEAK)).toBeNull();
    expect(BEAK.attack_bonus).toBe(8);
    expect(BEAK.damage_dice_primary).toBe('2d12 + 5');
    expect(BEAK.damage_type_primary).toBe('Slashing');
  });
});
