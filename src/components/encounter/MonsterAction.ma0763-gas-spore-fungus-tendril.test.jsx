// MA-0763: Gas Spore Fungus "Tendril" — prose carries "Hit: ... the target has
// the Poisoned condition" but the row shipped WITHOUT hit_conditions, so the
// condition rider was structurally inert (buildHitConditionClause reads
// hit_conditions/hit_target_effect/hit_condition_roll only, NEVER description;
// consumer live in handlePlainDamage.applyHitClauseConditions). One-field DATA
// fix: hit_conditions:["poisoned"] (MA-0621/MA-0756 byte-shape, placed after
// damage_type_primary). Locks: disk row shape + key placement, clause arm,
// "+0" attack chip stays live, MA-0762 gas-spore twin byte-unchanged.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TENDRIL = monsters.find((m) => m.index === 'gas-spore-fungus').actions[0];
const TOUCH = monsters.find((m) => m.index === 'gas-spore').actions[0];

describe('MA-0763 disk fingerprint: gas-spore-fungus Tendril hit_conditions fix', () => {
  it('disk row carries hit_conditions ["poisoned"] after damage_type_primary (MA-0621 byte-shape)', () => {
    expect(TENDRIL.hit_conditions).toEqual(['poisoned']);
    const keys = Object.keys(TENDRIL);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(TENDRIL.attack_bonus).toBe(0);
    expect(TENDRIL.damage_dice_primary).toBe('1d6');
    expect(TENDRIL.damage_type_primary).toBe('Poison');
  });

  it('buildHitConditionClause arms the Poisoned rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(TENDRIL);
    expect(clause).toEqual({
      conditions: ['poisoned'],
      escapeDc: null,
      attackName: 'Tendril',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+0" chip, no stale suppression (MA-0763 numeric axis verified live)', () => {
    expect(attackRowMissingToHit(TENDRIL)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TENDRIL}
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
    expect(chips).toEqual(['+0']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Tendril', 0, expect.objectContaining({ name: 'Tendril' }));
  });

  it('MA-0762 gas-spore Touch twin byte-unchanged: no hit_conditions authored there', () => {
    expect(TOUCH.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(TOUCH)).toBeNull();
    expect(TOUCH.attack_bonus).toBe(0);
    expect(TOUCH.dc_success).toBe('none');
  });
});
