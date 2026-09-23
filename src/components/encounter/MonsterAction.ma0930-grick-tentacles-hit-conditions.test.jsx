// MA-0930: Grick "Tentacles" — prose carries "If the target is a Medium or
// smaller creature, it has the Grappled condition (escape DC 12) from all four
// tentacles" but the row shipped WITHOUT hit_conditions/escape_dc, so the
// grapple rider was structurally inert (buildHitConditionClause reads
// hit_conditions/escape_dc keys only, NEVER description; consumer live
// in handlePlainDamage.applyHitClauseConditions w/ MA-0553 size gate).
// Two-field DATA fix mirroring the MA-0812 byte-shape: hit_conditions:
// ["grappled"] + escape_dc:12 placed after damage_type_primary (no
// secondary-damage fields on this row — MA-0909 post-secondary variant
// N/A). Size-gate fidelity: RAW Medium-or-smaller; consumer gates
// Large-or-smaller (§MA-0909) — MA-0812 Medium-gate precedent; Bandit
// (Medium) passes either way; no fabricated size fields added.
// "from all four tentacles" repetition + sustained grapple state-machine
// remain §70 advisory residuals — single grappled grant is the ceiling.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TENTACLES = monsters.find((m) => m.index === 'grick').actions[2];

describe('MA-0930 disk fingerprint: grick Tentacles grapple rider fix', () => {
  it('disk row carries hit_conditions ["grappled"] + escape_dc 12 after damage_type_primary (MA-0812 byte-shape)', () => {
    expect(TENTACLES.name).toBe('Tentacles');
    expect(TENTACLES.hit_conditions).toEqual(['grappled']);
    expect(TENTACLES.escape_dc).toBe(12);
    const keys = Object.keys(TENTACLES);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(TENTACLES.attack_bonus).toBe(4);
    expect(TENTACLES.reach).toBe('5 ft.');
  });

  it('attack-row fields byte-unchanged (damage axis was already exact)', () => {
    expect(TENTACLES.description).toContain('1d10 + 2) Slashing damage');
    expect(TENTACLES.description).toContain('escape DC 12');
    expect(TENTACLES.damage_dice_primary).toBe('1d10 + 2');
    expect(TENTACLES.damage_type_primary).toBe('Slashing');
    expect(TENTACLES.damage_dice_secondary).toBeUndefined();
    expect(TENTACLES.damage_type_secondary).toBeUndefined();
  });

  it('row carries NO save fields (attack ride, no save leg)', () => {
    expect(TENTACLES.save_dc).toBeUndefined();
    expect(TENTACLES.save_type).toBeUndefined();
    expect(TENTACLES.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled rider with escapeDc 12 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(TENTACLES);
    expect(clause).toEqual({
      conditions: ['grappled'],
      escapeDc: 12,
      attackName: 'Tentacles',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+4" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(TENTACLES)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TENTACLES}
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
    expect(chips).toEqual(['+4']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Tentacles', 4, expect.objectContaining({ name: 'Tentacles' }));
  });
});
