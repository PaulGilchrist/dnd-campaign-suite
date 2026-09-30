// MA-1638: Vampire "Grave Strike" — prose carries "If the target is a
// Large or smaller creature, it has the Grappled condition (escape DC 14)
// from one of two hands" but the row shipped WITHOUT hit_conditions/
// escape_dc, so the grapple rider was structurally inert (buildHitCondition-
// Clause reads hit_conditions/escape_dc keys only, NEVER description;
// consumer live in handlePlainDamage.applyHitClauseConditions w/ size gate
// isLargeOrSmallerTarget — Bandit "Medium or Small" admits cleanly).
// Two-field DATA fix mirroring the MA-0909 dual-damage byte-shape (MA-0010
// seam): hit_conditions:["grappled"] + escape_dc:14 placed AFTER the last
// damage key (damage_type_secondary), unlike the MA-1620 single-damage
// tyrannosaurus twin which lands them after damage_type_primary. Locks: disk
// row shape + key placement, clause arms Grappled with escapeDc:14, dual
// damage keys byte-unchanged, no save fields on row, "Expend Legendary" /
// Bite decoys never join this row's chip set, and restrained NEVER joins
// hit_conditions ("from one of two hands" = flavor §70; sustained-grapple
// state machine has zero producers).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const VAMPIRE = monsters.find((m) => m.index === 'vampire');
const GRAVE = VAMPIRE.actions[1];
const BITE = VAMPIRE.actions[2];

describe('MA-1638 disk fingerprint: vampire Grave Strike grapple rider fix', () => {
  it('disk row carries hit_conditions ["grappled"] + escape_dc 14 after damage_type_secondary (MA-0909 dual-damage byte-shape)', () => {
    expect(GRAVE.name).toBe('Grave Strike');
    expect(GRAVE.hit_conditions).toEqual(['grappled']);
    expect(GRAVE.escape_dc).toBe(14);
    const keys = Object.keys(GRAVE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_secondary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(GRAVE.attack_bonus).toBe(9);
    expect(GRAVE.reach).toBe('5 ft.');
  });

  it('dual damage + description fields byte-unchanged (combined_damage_roll axis was already live)', () => {
    expect(GRAVE.damage_dice_primary).toBe('1d8 + 4');
    expect(GRAVE.damage_type_primary).toBe('Bludgeoning');
    expect(GRAVE.damage_dice_secondary).toBe('2d6');
    expect(GRAVE.damage_type_secondary).toBe('Necrotic');
    expect(GRAVE.description).toContain('escape DC 14');
    expect(GRAVE.description).toContain('Grappled condition');
    expect(GRAVE.description).toContain('from one of two hands');
  });

  it('row carries NO save fields (attack ride, no save leg; Bite keeps the save row untouched)', () => {
    expect(GRAVE.save_dc).toBeUndefined();
    expect(GRAVE.save_type).toBeUndefined();
    expect(GRAVE.save_effect).toBeUndefined();
    expect(GRAVE.hit_target_effect).toBeUndefined();
    expect(BITE.name).toBe('Bite');
    expect(BITE.save_dc).toBe(17);
    expect(BITE.hit_conditions).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled rider with escapeDc 14 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(GRAVE);
    expect(clause).toEqual({
      conditions: ['grappled'],
      escapeDc: 14,
      attackName: 'Grave Strike',
      targetEffect: null,
    });
  });

  it('restrained NEVER joins hit_conditions (two-hands flavor + §70 sustained-grapple advisory)', () => {
    expect(GRAVE.hit_conditions).not.toContain('restrained');
  });

  it('attack half stays live: one "+9" chip, no stale suppression, no decoy chips on row', () => {
    expect(attackRowMissingToHit(GRAVE)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={GRAVE}
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
    expect(chips).toEqual(['+9']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Grave Strike', 9, expect.objectContaining({ name: 'Grave Strike' }));
  });
});
