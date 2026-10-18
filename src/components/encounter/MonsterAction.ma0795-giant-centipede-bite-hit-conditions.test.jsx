// @maintained-by-ai
// MA-0795: Giant Centipede "Bite" — prose carries "the target has the
// Poisoned condition until the start of the centipede's next turn" but the
// row shipped WITHOUT hit_conditions, so the condition rider was
// structurally inert (buildHitConditionClause reads hit_conditions/
// hit_target_effect/hit_condition_roll only, NEVER description; consumer
// live in handlePlainDamage.applyHitClauseConditions). One-field DATA fix:
// hit_conditions:["poisoned"] placed after damage_type_primary (MA-0621/
// MA-0763/MA-0791/MA-0794 byte-shape). giant-centipede is NOT in
// handlePlainDamage.hitClause HIT_CLAUSE_ROWS :224-281 (grep-verified) and
// no other lane pins this chip, so THIS file is the sole byte-owner: one
// fused test locks disk row shape + key placement + full row bytes (toEx-
// act toEqual absorbs the no-save-fields absence check), then the "+4"
// chip press delivers that exact row through onAttack (identity — payload
// IS the disk object). Clause arm for a ["poisoned"]/null-DC row is owned
// generically by the hitClause mega-lane (clause shapes :183-216 + table
// data-locks :289-301 via poisoned siblings assassin Shortsword :230,
// couatl Bite :247, otyugh Bite :268); per-census escape (#419, cf.
// ma0286:109) no local buildHitConditionClause/attackRowMissingToHit
// re-derivation here — exact-bytes + live chip are the tighter pin.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const BITE = monsters.find((m) => m.index === 'giant-centipede').actions[0];

const BITE_EXACT = {
  name: 'Bite',
  description: 'Melee Attack Roll: +4, reach 5 ft. Hit: 4 (1d4 + 2) Piercing damage, and the target has the <strong>Poisoned</strong> condition until the start of the centipede\'s next turn.',
  attack_bonus: 4,
  reach: '5 ft.',
  damage_dice_primary: '1d4 + 2',
  damage_type_primary: 'Piercing',
  hit_conditions: ['poisoned'],
};

describe('MA-0795 disk fingerprint: giant-centipede Bite hit_conditions fix', () => {
  it('sole-owner row fingerprint + live "+4" chip presses exact row through onAttack', () => {
    // Byte-shape: keys BY NAME in transport order, hit_conditions sits
    // immediately after damage_type_primary (MA-0621 siblings byte-shape).
    expect(Object.keys(BITE)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'damage_dice_primary',
      'damage_type_primary',
      'hit_conditions',
    ]);
    // Exact bytes: any added save_dc/save_type/escape_dc/hit_target_effect
    // or drifted numeric breaks this one assertion (absorbs field-absence).
    expect(BITE).toEqual(BITE_EXACT);

    // Chip-level dispatch: exactly one "+4" attack chip (no damage chip —
    // attack_bonus arms the attack lane), press routes name/bonus/row once.
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
    expect(chips).toEqual(['+4']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Bite', 4, BITE_EXACT);
    // Identity: the payload IS the disk row — hit_conditions bytes ride the
    // attack lane untouched (no copy/strip) into the clause consumer.
    expect(onAttack.mock.calls[0][2]).toBe(BITE);
  });
});
