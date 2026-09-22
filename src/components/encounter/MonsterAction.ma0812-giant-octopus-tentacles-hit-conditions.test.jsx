// MA-0812: Giant Octopus "Tentacles" — prose carries "If the target is a
// Medium or smaller creature, it has the Grappled condition (escape DC 13)
// from all eight tentacles. While Grappled, the target has the Restrained
// condition" but the row shipped WITHOUT hit_conditions/escape_dc, so the
// grapple rider was structurally inert (buildHitConditionClause reads
// hit_conditions/escape_dc keys only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). Two-field DATA fix mirroring
// the giant-crocodile/giant-frog twins (MA-0801/MA-0807, MA-0010 seam):
// hit_conditions:["grappled","restrained"] + escape_dc:13 placed after
// damage_type_primary. Locks: disk row shape + key placement, clause arms
// BOTH conditions with escapeDc:13, "+5" attack chip stays live, no save
// fields on row. Escape DC 13 = 8 + STR 3 + PB 2 (description authority).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TENTACLES = monsters.find((m) => m.index === 'giant-octopus').actions[0];

describe('MA-0812 disk fingerprint: giant-octopus Tentacles grapple rider fix', () => {
  it('disk row carries hit_conditions ["grappled","restrained"] + escape_dc 13 after damage_type_primary (MA-0010 byte-shape)', () => {
    expect(TENTACLES.name).toBe('Tentacles');
    expect(TENTACLES.hit_conditions).toEqual(['grappled', 'restrained']);
    expect(TENTACLES.escape_dc).toBe(13);
    const keys = Object.keys(TENTACLES);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(TENTACLES.attack_bonus).toBe(5);
    expect(TENTACLES.reach).toBe('10 ft.');
    expect(TENTACLES.damage_dice_primary).toBe('2d6 + 3');
    expect(TENTACLES.damage_type_primary).toBe('Bludgeoning');
  });

  it('row carries NO save fields (attack ride, no save leg)', () => {
    expect(TENTACLES.save_dc).toBeUndefined();
    expect(TENTACLES.save_type).toBeUndefined();
    expect(TENTACLES.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled/Restrained rider with escapeDc 13 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(TENTACLES);
    expect(clause).toEqual({
      conditions: ['grappled', 'restrained'],
      escapeDc: 13,
      attackName: 'Tentacles',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+5" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(TENTACLES)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TENTACLES}
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
    expect(chips).toEqual(['+5']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Tentacles', 5, expect.objectContaining({ name: 'Tentacles' }));
  });
});
