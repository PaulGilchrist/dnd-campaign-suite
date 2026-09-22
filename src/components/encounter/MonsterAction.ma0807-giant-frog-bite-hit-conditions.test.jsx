// MA-0807: Giant Frog "Bite" — prose carries "If the target is a Medium or
// smaller creature, it has the Grappled condition (escape DC 11)" but the row
// shipped WITHOUT hit_conditions/escape_dc, so the grapple rider was
// structurally inert (buildHitConditionClause reads hit_conditions/escape_dc
// keys only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). Two-field DATA fix (MA-0799/
// MA-0801 twin recipe): hit_conditions:["grappled"] + escape_dc:11 placed
// after damage_type_primary (MA-0010 Aberrant Cultist Tentacle Lash / ankheg
// Bite byte-shape). Locks: disk row shape + key placement, clause arms with
// escapeDc:11, "+3" attack chip stays live, no save fields on row.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const BITE = monsters.find((m) => m.index === 'giant-frog').actions[0];

describe('MA-0807 disk fingerprint: giant-frog Bite grapple rider fix', () => {
  it('disk row carries hit_conditions ["grappled"] + escape_dc 11 after damage_type_primary (MA-0010 byte-shape)', () => {
    expect(BITE.hit_conditions).toEqual(['grappled']);
    expect(BITE.escape_dc).toBe(11);
    const keys = Object.keys(BITE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(BITE.attack_bonus).toBe(3);
    expect(BITE.reach).toBe('5 ft.');
    expect(BITE.damage_dice_primary).toBe('1d6 + 2');
    expect(BITE.damage_type_primary).toBe('Piercing');
  });

  it('row carries NO save fields (attack ride, no save leg)', () => {
    expect(BITE.save_dc).toBeUndefined();
    expect(BITE.save_type).toBeUndefined();
    expect(BITE.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled rider with escapeDc 11 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(BITE);
    expect(clause).toEqual({
      conditions: ['grappled'],
      escapeDc: 11,
      attackName: 'Bite',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+3" chip, no stale suppression', () => {
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
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Bite', 3, expect.objectContaining({ name: 'Bite' }));
  });
});
