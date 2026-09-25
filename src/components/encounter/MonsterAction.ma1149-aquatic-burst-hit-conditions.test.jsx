// MA-1149: Merfolk Wavebender "Aquatic Burst" — prose carries "If the target
// is a Large or smaller creature, it has the Prone condition" but the row
// shipped WITHOUT hit_conditions, so the Prone rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.maybeApplyHitClause/applyHitClauseConditions). One-field
// DATA fix: hit_conditions:["prone"] placed after damage_type_primary
// (MA-1141/MA-1116 trailing-key byte-shape, no escape_dc). Locks: disk row
// shape + key placement, clause arm, single "+7" attack chip stays live, no DC
// chip from the save_dc:0 decoy (§417/§437). Caveat: consumer size gate admits
// Large (§153/MA-0877/MA-0909 family) vs RAW "Large or smaller" — matches here.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const WAVEBENDER = monsters.find((m) => m.index === 'merfolk-wavebender');
const BURST = WAVEBENDER.actions.find((a) => a.name === 'Aquatic Burst');

describe('MA-1149 disk fingerprint: merfolk-wavebender Aquatic Burst hit_conditions fix', () => {
  it('disk row carries hit_conditions ["prone"] after damage_type_primary (MA-1141 byte-shape)', () => {
    expect(BURST.hit_conditions).toEqual(['prone']);
    const keys = Object.keys(BURST);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(BURST.attack_bonus).toBe(7);
    expect(BURST.reach).toBe('5 ft.');
    expect(BURST.range).toBe('60 ft.');
    expect(BURST.damage_dice_primary).toBe('3d10 + 4');
    expect(BURST.damage_type_primary).toBe('Cold');
  });

  it('DC0 decoy fields unchanged and never arm a save lane (§417/§437)', () => {
    expect(BURST.save_dc).toBe(0);
    expect(BURST.save_type).toBe('');
    expect(BURST.save_effect).toBe('');
    expect(BURST.escape_dc).toBeUndefined();
    expect(BURST.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Prone rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(BURST);
    expect(clause).toEqual({
      conditions: ['prone'],
      escapeDc: null,
      attackName: 'Aquatic Burst',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+7" chip, no DC chip, no stale suppression', () => {
    expect(attackRowMissingToHit(BURST)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BURST}
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
    expect(container.querySelectorAll('.mc-dice-link-save-clickable')).toHaveLength(0);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Aquatic Burst', 7, expect.objectContaining({ name: 'Aquatic Burst' }));
  });
});
