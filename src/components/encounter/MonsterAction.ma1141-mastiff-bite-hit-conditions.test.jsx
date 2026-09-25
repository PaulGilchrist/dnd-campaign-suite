// MA-1141: Mastiff "Bite" — prose carries "If the target is a Medium or
// smaller creature, it has the Prone condition" but the row shipped WITHOUT
// hit_conditions, so the Prone rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.maybeApplyHitClause/applyHitClauseConditions). One-field
// DATA fix: hit_conditions:["prone"] placed after damage_type_primary
// (MA-1116/MA-0763 trailing-key byte-shape, no escape_dc). Locks: disk row
// shape + key placement, clause arm, single "+3" attack chip stays live, no DC
// chip from the save_dc:0 decoy (§417/§437). Caveat: consumer size gate admits
// Large (§153/MA-0877/MA-0909 family) vs RAW "Medium or smaller" — documented.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const MASTIFF = monsters.find((m) => m.index === 'mastiff');
const BITE = MASTIFF.actions.find((a) => a.name === 'Bite');

describe('MA-1141 disk fingerprint: mastiff Bite hit_conditions fix', () => {
  it('disk row carries hit_conditions ["prone"] after damage_type_primary (MA-1116 byte-shape)', () => {
    expect(BITE.hit_conditions).toEqual(['prone']);
    const keys = Object.keys(BITE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(BITE.attack_bonus).toBe(3);
    expect(BITE.reach).toBe('5 ft.');
    expect(BITE.damage_dice_primary).toBe('1d6 + 1');
    expect(BITE.damage_type_primary).toBe('Piercing');
  });

  it('DC0 decoy fields unchanged and never arm a save lane (§417/§437)', () => {
    expect(BITE.save_dc).toBe(0);
    expect(BITE.save_type).toBe('');
    expect(BITE.save_effect).toBe('');
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

  it('attack half stays live: one "+3" chip, no DC chip, no stale suppression', () => {
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
    expect(chips).toEqual(['+3']);
    expect(container.querySelectorAll('.mc-dice-link-save-clickable')).toHaveLength(0);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Bite', 3, expect.objectContaining({ name: 'Bite' }));
  });
});
