// MA-0819: Giant Scorpion "Claw" — prose carries "If the target is a Large or
// smaller creature, it has the Grappled condition (escape DC 13) from one of
// two claws" but the row shipped WITHOUT hit_conditions/escape_dc, so the
// grapple rider was structurally inert (buildHitConditionClause reads
// hit_conditions/escape_dc keys only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). Two-field DATA fix mirroring
// the giant-frog/giant-octopus twins (MA-0807/MA-0812, MA-0010 seam):
// hit_conditions:["grappled"] + escape_dc:13 placed after damage_type_primary.
// Locks: disk row shape + key placement, clause arms with escapeDc:13, "+5"
// attack chip stays live, no save fields on row. Escape DC 13 = description
// authority ("escape DC 13" byte-carried).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const CLAW = monsters.find((m) => m.index === 'giant-scorpion').actions[1];

describe('MA-0819 disk fingerprint: giant-scorpion Claw grapple rider fix', () => {
  it('disk row carries hit_conditions ["grappled"] + escape_dc 13 after damage_type_primary (MA-0010 byte-shape)', () => {
    expect(CLAW.name).toBe('Claw');
    expect(CLAW.hit_conditions).toEqual(['grappled']);
    expect(CLAW.escape_dc).toBe(13);
    const keys = Object.keys(CLAW);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(CLAW.attack_bonus).toBe(5);
    expect(CLAW.reach).toBe('5 ft.');
    expect(CLAW.damage_dice_primary).toBe('1d6 + 3');
    expect(CLAW.damage_type_primary).toBe('Bludgeoning');
  });

  it('row carries NO save fields (attack ride, no save leg)', () => {
    expect(CLAW.save_dc).toBeUndefined();
    expect(CLAW.save_type).toBeUndefined();
    expect(CLAW.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled rider with escapeDc 13 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(CLAW);
    expect(clause).toEqual({
      conditions: ['grappled'],
      escapeDc: 13,
      attackName: 'Claw',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+5" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(CLAW)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={CLAW}
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
    expect(chips).toEqual(['+5']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Claw', 5, expect.objectContaining({ name: 'Claw' }));
  });
});
