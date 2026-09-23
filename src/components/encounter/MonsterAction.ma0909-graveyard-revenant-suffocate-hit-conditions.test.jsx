// MA-0909: Graveyard Revenant "Suffocate" — prose carries "If the target is
// a Large or smaller creature, it has the Grappled condition (escape DC 15)"
// but the row shipped WITHOUT hit_conditions/escape_dc, so the grapple rider
// was structurally inert (buildHitConditionClause reads hit_conditions/
// escape_dc keys only, NEVER description; consumer live in handlePlainDamage.
// applyHitClauseConditions w/ MA-0553 size gate isLargeOrSmallerTarget).
// Two-field DATA fix mirroring the MA-0801/MA-0812 byte-shape (MA-0010
// seam): hit_conditions:["grappled"] + escape_dc:15 placed after
// damage_type_secondary. Locks: disk row shape + key placement, clause arms
// Grappled with escapeDc:15, combined-damage rider fields byte-unchanged,
// "+8" attack chip stays live, no save fields on row. Suffocating tick,
// two-target cap, grappler-death release are §70 advisory residuals
// (§69/MA-0287/0288/0354 precedent) — single grappled grant is the ceiling.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SUFFOCATE = monsters.find((m) => m.index === 'graveyard-revenant').actions[1];

describe('MA-0909 disk fingerprint: graveyard-revenant Suffocate grapple rider fix', () => {
  it('disk row carries hit_conditions ["grappled"] + escape_dc 15 after damage_type_secondary (MA-0801/0812 byte-shape)', () => {
    expect(SUFFOCATE.name).toBe('Suffocate');
    expect(SUFFOCATE.hit_conditions).toEqual(['grappled']);
    expect(SUFFOCATE.escape_dc).toBe(15);
    const keys = Object.keys(SUFFOCATE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_secondary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(SUFFOCATE.attack_bonus).toBe(8);
    expect(SUFFOCATE.reach).toBe('10 ft.');
  });

  it('combined-damage rider fields byte-unchanged (rider was already live)', () => {
    expect(SUFFOCATE.damage_dice_primary).toBe('1d10 + 5');
    expect(SUFFOCATE.damage_type_primary).toBe('Bludgeoning');
    expect(SUFFOCATE.damage_dice_secondary).toBe('3d6');
    expect(SUFFOCATE.damage_type_secondary).toBe('Necrotic');
  });

  it('row carries NO save fields (attack ride, no save leg)', () => {
    expect(SUFFOCATE.save_dc).toBeUndefined();
    expect(SUFFOCATE.save_type).toBeUndefined();
    expect(SUFFOCATE.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled rider with escapeDc 15 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(SUFFOCATE);
    expect(clause).toEqual({
      conditions: ['grappled'],
      escapeDc: 15,
      attackName: 'Suffocate',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+8" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(SUFFOCATE)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={SUFFOCATE}
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
    expect(onAttack).toHaveBeenCalledWith('Suffocate', 8, expect.objectContaining({ name: 'Suffocate' }));
  });
});
