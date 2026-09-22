// MA-0841: Githyanki Dracomancer "Draconic Strike" — prose carries "the target
// has the Frightened condition until the start of the githyanki's next turn" but
// the row shipped WITHOUT hit_conditions, so the frightened rider was
// structurally inert (buildHitConditionClause reads hit_conditions/
// hit_target_effect/hit_condition_roll keys only, NEVER description; consumer
// live in handlePlainDamage.applyHitClauseConditions). One-field DATA fix
// mirroring the MA-0621/MA-0776 byte-shape twins and the ma0834/ma0819
// template (MA-0010 seam): hit_conditions:["frightened"] placed after
// damage_type_secondary (dual-damage row shape, MA-0010 assassin/balor
// precedent). No escape_dc (no escape clause). Duration residual ("until the
// start of the githyanki's next turn") stays GM-advisory (§70 — the hit-clause
// consumer stamps meta{source} only, no rounds clock). Hybrid row §147: ONE
// "+10" chip, no melee/ranged toggles or ranged dice swaps. Locks: disk row
// shape + key placement, clause arms with escapeDc null, secondary "5d6" Fire
// untouched, "+10" attack chip stays live, no save fields on row.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const STRIKE = monsters.find((m) => m.index === 'githyanki-dracomancer').actions[1];

describe('MA-0841 disk fingerprint: githyanki-dracomancer Draconic Strike frightened rider fix', () => {
  it('disk row carries hit_conditions ["frightened"] after damage_type_secondary (MA-0621/MA-0776 byte-shape)', () => {
    expect(STRIKE.name).toBe('Draconic Strike');
    expect(STRIKE.hit_conditions).toEqual(['frightened']);
    const keys = Object.keys(STRIKE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_secondary') + 1);
    expect(STRIKE.attack_bonus).toBe(10);
    expect(STRIKE.reach).toBe('10 ft.');
    expect(STRIKE.range).toBe('120 ft.');
    expect(STRIKE.damage_dice_primary).toBe('2d6 + 5');
    expect(STRIKE.damage_type_primary).toBe('Slashing');
    expect(STRIKE.description).toContain('Frightened');
  });

  it('dual-damage legs preserved: secondary "5d6" Fire untouched by the one-field fix', () => {
    expect(STRIKE.damage_dice_secondary).toBe('5d6');
    expect(STRIKE.damage_type_secondary).toBe('Fire');
  });

  it('row carries NO escape_dc and NO save fields (no escape clause, attack ride, no save leg)', () => {
    expect(STRIKE.escape_dc).toBeUndefined();
    expect(STRIKE.save_dc).toBeUndefined();
    expect(STRIKE.save_type).toBeUndefined();
    expect(STRIKE.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Frightened rider with escapeDc null (was null pre-fix)', () => {
    const clause = buildHitConditionClause(STRIKE);
    expect(clause).toEqual({
      conditions: ['frightened'],
      escapeDc: null,
      attackName: 'Draconic Strike',
      targetEffect: null,
    });
  });

  it('hybrid attack half stays live: ONE "+10" chip, no range-mode toggles or dice swaps (§147)', () => {
    expect(attackRowMissingToHit(STRIKE)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={STRIKE}
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
    expect(chips).toEqual(['+10']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Draconic Strike', 10, expect.objectContaining({ name: 'Draconic Strike' }));
  });
});
