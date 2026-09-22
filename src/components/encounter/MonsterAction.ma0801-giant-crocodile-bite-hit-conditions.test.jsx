// MA-0801: Giant Crocodile "Bite" — prose carries "If the target is a Large
// or smaller creature, it has the Grappled condition (escape DC 15). While
// Grappled, the target has the Restrained condition" but the row shipped
// WITHOUT hit_conditions/escape_dc, so the grapple rider was structurally
// inert (buildHitConditionClause reads hit_conditions/escape_dc keys only,
// NEVER description; consumer live in handlePlainDamage.applyHitClause-
// Conditions). Two-field DATA fix mirroring crocodile actions[0] byte-shape
// (MA-0010): hit_conditions:["grappled","restrained"] + escape_dc:15 placed
// after damage_type_primary. Locks: disk row shape + key placement, clause
// arms with escapeDc:15, "+8" attack chip stays live, no save fields on row.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const BITE = monsters.find((m) => m.index === 'giant-crocodile').actions[1];

describe('MA-0801 disk fingerprint: giant-crocodile Bite grapple rider fix', () => {
  it('disk row carries hit_conditions ["grappled","restrained"] + escape_dc 15 after damage_type_primary (MA-0010 byte-shape)', () => {
    expect(BITE.name).toBe('Bite');
    expect(BITE.hit_conditions).toEqual(['grappled', 'restrained']);
    expect(BITE.escape_dc).toBe(15);
    const keys = Object.keys(BITE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(BITE.attack_bonus).toBe(8);
    expect(BITE.reach).toBe('5 ft.');
    expect(BITE.damage_dice_primary).toBe('3d10 + 5');
    expect(BITE.damage_type_primary).toBe('Piercing');
  });

  it('row carries NO save fields (attack ride, no save leg)', () => {
    expect(BITE.save_dc).toBeUndefined();
    expect(BITE.save_type).toBeUndefined();
    expect(BITE.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled/Restrained rider with escapeDc 15 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(BITE);
    expect(clause).toEqual({
      conditions: ['grappled', 'restrained'],
      escapeDc: 15,
      attackName: 'Bite',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+8" chip, no stale suppression', () => {
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
    expect(chips).toEqual(['+8']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Bite', 8, expect.objectContaining({ name: 'Bite' }));
  });
});
