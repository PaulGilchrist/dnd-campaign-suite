// MA-0863: Glabrezu "Pincer" — prose carries "If the target is a Medium or
// smaller creature, it has the Grappled condition (escape DC 15) from one of
// two pincers" but the row shipped WITHOUT hit_conditions/escape_dc, so the
// grapple rider was structurally inert (buildHitConditionClause reads
// hit_conditions/escape_dc keys only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). Two-field DATA fix mirroring
// the giant-squid/giant-octopus twins (MA-0829/MA-0812, MA-0010 seam):
// hit_conditions:["grappled"] + escape_dc:15 placed after
// damage_type_primary. Locks: disk row shape + key placement, clause arms
// Grappled with escapeDc:15, "+9" attack chip stays live, no save fields on
// row. Escape DC 15 = 8 + STR 7 + PB 0 (description authority). "one of two
// pincers" limb-stack sustained-grapple state-machine is §70 advisory
// (MA-0287/0288/0354 precedent) — single grappled grant is the ceiling.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const PINCER = monsters.find((m) => m.index === 'glabrezu').actions[1];

describe('MA-0863 disk fingerprint: glabrezu Pincer grapple rider fix', () => {
  it('disk row carries hit_conditions ["grappled"] + escape_dc 15 after damage_type_primary (MA-0010 byte-shape)', () => {
    expect(PINCER.name).toBe('Pincer');
    expect(PINCER.hit_conditions).toEqual(['grappled']);
    expect(PINCER.escape_dc).toBe(15);
    const keys = Object.keys(PINCER);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(PINCER.attack_bonus).toBe(9);
    expect(PINCER.reach).toBe('10 ft.');
    expect(PINCER.damage_dice_primary).toBe('2d10 + 5');
    expect(PINCER.damage_type_primary).toBe('Slashing');
  });

  it('row carries NO save fields (attack ride, no save leg)', () => {
    expect(PINCER.save_dc).toBeUndefined();
    expect(PINCER.save_type).toBeUndefined();
    expect(PINCER.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled rider with escapeDc 15 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(PINCER);
    expect(clause).toEqual({
      conditions: ['grappled'],
      escapeDc: 15,
      attackName: 'Pincer',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+9" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(PINCER)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={PINCER}
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
    expect(onAttack).toHaveBeenCalledWith('Pincer', 9, expect.objectContaining({ name: 'Pincer' }));
  });
});
