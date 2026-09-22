// MA-0829: Giant Squid "Tentacle" — prose carries "If the target is a Huge
// or smaller creature, it has the Grappled condition (escape DC 16) from one
// of two tentacles" but the row shipped WITHOUT hit_conditions/escape_dc, so
// the grapple rider was structurally inert (buildHitConditionClause reads
// hit_conditions/escape_dc keys only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). Two-field DATA fix mirroring
// the giant-frog/giant-octopus twins (MA-0807/MA-0812, MA-0010 seam):
// hit_conditions:["grappled"] + escape_dc:16 placed after
// damage_type_primary. Locks: disk row shape + key placement, clause arms
// Grappled with escapeDc:16, "+9" attack chip stays live, no save fields on
// row. Escape DC 16 = 8 + STR 6 + PB 2 (description authority). Pull-10ft
// clause is §70 advisory (zero consumer app-wide) — not fabricated.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TENTACLE = monsters.find((m) => m.index === 'giant-squid').actions[2];

describe('MA-0829 disk fingerprint: giant-squid Tentacle grapple rider fix', () => {
  it('disk row carries hit_conditions ["grappled"] + escape_dc 16 after damage_type_primary (MA-0010 byte-shape)', () => {
    expect(TENTACLE.name).toBe('Tentacle');
    expect(TENTACLE.hit_conditions).toEqual(['grappled']);
    expect(TENTACLE.escape_dc).toBe(16);
    const keys = Object.keys(TENTACLE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(TENTACLE.attack_bonus).toBe(9);
    expect(TENTACLE.reach).toBe('15 ft.');
    expect(TENTACLE.damage_dice_primary).toBe('3d8 + 6');
    expect(TENTACLE.damage_type_primary).toBe('Bludgeoning');
  });

  it('row carries NO save fields (attack ride, no save leg)', () => {
    expect(TENTACLE.save_dc).toBeUndefined();
    expect(TENTACLE.save_type).toBeUndefined();
    expect(TENTACLE.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled rider with escapeDc 16 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(TENTACLE);
    expect(clause).toEqual({
      conditions: ['grappled'],
      escapeDc: 16,
      attackName: 'Tentacle',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+9" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(TENTACLE)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TENTACLE}
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
    expect(chips).toEqual(['+9']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Tentacle', 9, expect.objectContaining({ name: 'Tentacle' }));
  });
});
