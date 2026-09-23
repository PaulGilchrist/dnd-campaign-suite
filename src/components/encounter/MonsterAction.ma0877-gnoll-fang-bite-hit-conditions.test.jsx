// MA-0877: Gnoll Fang of Yeenoghu "Bite" — prose carries "the target has
// the Poisoned condition until the start of the gnoll's next turn" but the
// row shipped WITHOUT hit_conditions, so the condition rider was
// structurally inert (buildHitConditionClause reads hit_conditions/
// hit_target_effect/hit_condition_roll only, NEVER description; consumer
// live in handlePlainDamage.applyHitClauseConditions). One-field DATA fix:
// hit_conditions:["poisoned"] placed after damage_type_secondary
// (MA-0794/MA-0795 byte-shape for secondary-carrying rows; MA-0763/
// MA-0621 poisoned shape). Locks: disk row shape + key placement, clause
// arm, "+5" attack chip stays live, combined-damage rider fields intact,
// no save fields on row.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const FANG = monsters.find((m) => m.index === 'gnoll-fang-of-yeenoghu');
const BITE = FANG.actions.find((a) => a.name === 'Bite');

describe('MA-0877 disk fingerprint: gnoll-fang-of-yeenoghu Bite hit_conditions fix', () => {
  it('disk row carries hit_conditions ["poisoned"] after damage_type_secondary (MA-0794/0795 byte-shape)', () => {
    expect(BITE.hit_conditions).toEqual(['poisoned']);
    const keys = Object.keys(BITE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_secondary') + 1);
    expect(BITE.attack_bonus).toBe(5);
    expect(BITE.reach).toBe('5 ft.');
    expect(BITE.damage_dice_primary).toBe('1d6 + 3');
    expect(BITE.damage_type_primary).toBe('Piercing');
  });

  it('combined-damage rider fields byte-unchanged (transport was already live)', () => {
    expect(BITE.damage_dice_secondary).toBe('2d6');
    expect(BITE.damage_type_secondary).toBe('Poison');
  });

  it('row carries NO save fields (correct per row)', () => {
    expect(BITE.save_dc).toBeUndefined();
    expect(BITE.save_type).toBeUndefined();
    expect(BITE.escape_dc).toBeUndefined();
    expect(BITE.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Poisoned rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(BITE);
    expect(clause).toEqual({
      conditions: ['poisoned'],
      escapeDc: null,
      attackName: 'Bite',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+5" chip, no stale suppression', () => {
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
    expect(chips).toEqual(['+5']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Bite', 5, expect.objectContaining({ name: 'Bite' }));
  });
});
