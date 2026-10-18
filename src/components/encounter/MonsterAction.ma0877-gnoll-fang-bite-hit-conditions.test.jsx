// @maintained-by-ai
// MA-0877: Gnoll Fang of Yeenoghu "Bite" — prose carries "the target has
// the Poisoned condition until the start of the gnoll's next turn" but the
// row shipped WITHOUT hit_conditions, so the condition rider was
// structurally inert (buildHitConditionClause reads hit_conditions/
// hit_target_effect/hit_condition_roll only, NEVER description). One-field
// DATA fix: hit_conditions:["poisoned"] placed after damage_type_secondary
// (MA-0794/MA-0795 byte-shape for secondary-carrying rows; MA-0763/
// MA-0621 poisoned shape). This row is NOT in the HIT_CLAUSE_ROWS mega
// table (handlePlainDamage.hitClause.test.js:224-282, grep-verified), so
// this is its sole byte-lock: Object.keys exact (pins placement AND proves
// no save fields can creep in — old no-save it pruned) + verbatim toEqual
// (pins combined-damage rider transport). Clause arming and the consumer
// lane (buildHitConditionClause/attackRowMissingToHit → handlePlainDamage
// .applyHitClauseConditions) are generic mega-locks (hitClause
// .test.js:183-334) — direct helper calls pruned.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const BITE = monsters.find((m) => m.index === 'gnoll-fang-of-yeenoghu').actions[1];

describe('MA-0877 gnoll-fang-of-yeenoghu Bite poisoned rider', () => {
  it('fused lock: exact disk-row bytes arm the clause; "+5" chip live, click payloads the row', () => {
    expect(Object.keys(BITE)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'damage_dice_primary',
      'damage_type_primary',
      'damage_dice_secondary',
      'damage_type_secondary',
      'hit_conditions',
    ]);
    expect(BITE).toEqual({
      name: 'Bite',
      description: 'Melee Attack Roll: +5, reach 5 ft. Hit: 6 (1d6 + 3) Piercing damage plus 7 (2d6) Poison damage, and the target has the <strong>Poisoned</strong> condition until the start of the gnoll\'s next turn.',
      attack_bonus: 5,
      reach: '5 ft.',
      damage_dice_primary: '1d6 + 3',
      damage_type_primary: 'Piercing',
      damage_dice_secondary: '2d6',
      damage_type_secondary: 'Poison',
      hit_conditions: ['poisoned'],
    });
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BITE}
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
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Bite', 5, BITE);
    expect(onAttack.mock.calls[0][2]).toBe(BITE);
  });
});
