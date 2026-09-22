// MA-0834: Giant Vulture "Gouge" — prose carries "the target has the Poisoned
// condition until the end of its next turn" but the row shipped WITHOUT
// hit_conditions, so the poisoned rider was structurally inert
// (buildHitConditionClause reads hit_conditions/escape_dc keys only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions).
// One-field DATA fix mirroring the dracolich MA-0621 byte-shape twin and the
// ma0807/ma0819 template (MA-0010 seam): hit_conditions:["poisoned"] placed
// after damage_type_primary. No escape_dc (no escape clause). Duration
// residual ("until the end of its next turn") stays GM-advisory (§70 — the
// hit-clause consumer stamps meta{source} only, no rounds clock).
// Locks: disk row shape + key placement, clause arms with escapeDc:null,
// "+4" attack chip stays live, no save fields on row.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const GOUGE = monsters.find((m) => m.index === 'giant-vulture').actions[0];

describe('MA-0834 disk fingerprint: giant-vulture Gouge poisoned rider fix', () => {
  it('disk row carries hit_conditions ["poisoned"] after damage_type_primary (MA-0621 byte-shape)', () => {
    expect(GOUGE.name).toBe('Gouge');
    expect(GOUGE.hit_conditions).toEqual(['poisoned']);
    const keys = Object.keys(GOUGE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(GOUGE.attack_bonus).toBe(4);
    expect(GOUGE.reach).toBe('5 ft.');
    expect(GOUGE.damage_dice_primary).toBe('2d6 + 2');
    expect(GOUGE.damage_type_primary).toBe('Piercing');
  });

  it('row carries NO escape_dc and NO save fields (no escape clause, attack ride, no save leg)', () => {
    expect(GOUGE.escape_dc).toBeUndefined();
    expect(GOUGE.save_dc).toBeUndefined();
    expect(GOUGE.save_type).toBeUndefined();
    expect(GOUGE.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Poisoned rider with escapeDc null (was null pre-fix)', () => {
    const clause = buildHitConditionClause(GOUGE);
    expect(clause).toEqual({
      conditions: ['poisoned'],
      escapeDc: null,
      attackName: 'Gouge',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+4" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(GOUGE)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={GOUGE}
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
    expect(chips).toEqual(['+4']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Gouge', 4, expect.objectContaining({ name: 'Gouge' }));
  });
});
