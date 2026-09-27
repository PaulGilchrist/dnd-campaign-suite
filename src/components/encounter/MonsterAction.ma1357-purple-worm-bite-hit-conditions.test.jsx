// MA-1357: Purple Worm "Bite" — prose carries "If the target is a Large or
// smaller creature, it has the Grappled condition (escape DC 19), and it has
// the Restrained condition until the grapple ends" but the row shipped WITHOUT
// hit_conditions/escape_dc, so the grapple rider was structurally inert
// (buildHitConditionClause reads hit_conditions/escape_dc keys only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions).
// Two-field DATA fix mirroring aberrant-cultist Tentacle Lash byte-shape
// (MA-0010): hit_conditions:["grappled","restrained"] + escape_dc:19 placed
// after damage_type_primary. Size-gate stays GM-advisory (isLargeOrSmaller-
// Target). Locks: disk row shape + key placement, clause arms both conditions
// with escapeDc 19, "+14" attack chip stays live, save decoys stay 0/"".
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const WORM = monsters.find((m) => m.index === 'purple-worm');
const BITE = WORM.actions[1];

describe('MA-1357 disk fingerprint: purple-worm Bite grapple rider fix', () => {
  it('disk row carries hit_conditions ["grappled","restrained"] + escape_dc 19 after damage_type_primary (MA-0010 byte-shape)', () => {
    expect(WORM.name).toBe('Purple Worm');
    expect(BITE.name).toBe('Bite');
    expect(BITE.hit_conditions).toEqual(['grappled', 'restrained']);
    expect(BITE.escape_dc).toBe(19);
    const keys = Object.keys(BITE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(BITE.attack_bonus).toBe(14);
    expect(BITE.reach).toBe('10 ft.');
    expect(BITE.damage_dice_primary).toBe('3d8 + 9');
    expect(BITE.damage_type_primary).toBe('Piercing');
  });

  it('row carries NO save leg (attack-only ride, decoy save keys stay 0/"")', () => {
    expect(BITE.save_dc).toBe(0);
    expect(BITE.save_type).toBe('');
    expect(BITE.save_effect).toBe('');
    expect(BITE.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled/Restrained rider with escapeDc 19 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(BITE);
    expect(clause).toEqual({
      conditions: ['grappled', 'restrained'],
      escapeDc: 19,
      attackName: 'Bite',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+14" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(BITE)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BITE}
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
    expect(chips).toEqual(['+14']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Bite', 14, expect.objectContaining({ name: 'Bite' }));
  });
});
