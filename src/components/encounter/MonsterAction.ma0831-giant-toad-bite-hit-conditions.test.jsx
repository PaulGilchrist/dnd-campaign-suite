// @maintained-by-ai
// MA-0831: Giant Toad "Bite" — prose carries "If the target is a Medium or
// smaller creature, it has the Grappled condition (escape DC 12)" but the row
// shipped WITHOUT hit_conditions/escape_dc, so the grapple rider was
// structurally inert (buildHitConditionClause reads hit_conditions/escape_dc
// keys only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). Two-field DATA fix mirroring
// the giant-frog twin (MA-0807, MA-0010 seam): hit_conditions:["grappled"] +
// escape_dc:12 placed after the already-live damage_type_secondary, leaving
// the dual-leg secondary bytes (2d4 Poison, MA-0531 transport) untouched.
// Absorption check (grep-verified): giant-toad is NOT in
// handlePlainDamage.hitClause HIT_CLAUSE_ROWS :224-282 and no other test
// touches these bytes (the only other giant-toad mentions are unrelated
// badge-icon rows in CreatureCard.rendering), so THIS file is the sole
// byte-owner: ONE fused test locks disk row shape + key placement + full row
// bytes (exact-bytes toEqual absorbs the no-save-fields absence check, the
// secondary-leg preservation pin, and every numerics pin), then the "+4" chip
// press delivers that exact row through onAttack (identity — payload IS the
// disk object, rider + secondary bytes ride the lane untouched). Clause arm
// for a conditions+escapeDc row is owned generically by the hitClause mega-lane
// (:183-334 once: generic clause shapes escape_dc passthrough :184 + table
// data-locks via exact twins aboleth/ankheg/crocodile grappled+escape :227,
// :232, :248); no local buildHitConditionClause/attackRowMissingToHit
// re-derivation — exact bytes + live chip are the tighter pin.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const BITE = monsters.find((m) => m.index === 'giant-toad').actions[0];

const BITE_EXACT = {
  name: 'Bite',
  description: 'Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Piercing damage plus 5 (2d4) Poison damage. If the target is a Medium or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 12).',
  attack_bonus: 4,
  reach: '5 ft.',
  damage_dice_primary: '1d6 + 2',
  damage_type_primary: 'Piercing',
  damage_dice_secondary: '2d4',
  damage_type_secondary: 'Poison',
  hit_conditions: ['grappled'],
  escape_dc: 12,
};

describe('MA-0831 disk fingerprint: giant-toad Bite grapple rider fix', () => {
  it('sole-owner row fingerprint + live "+4" chip presses exact row through onAttack', () => {
    // Byte-shape: keys BY NAME in transport order — the dual-leg secondary
    // pair stays in place and hit_conditions + escape_dc sit immediately
    // after damage_type_secondary (MA-0010 byte-shape placement).
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
      'escape_dc',
    ]);
    // Exact bytes: any added save_dc/save_type/hit_target_effect, any lost
    // secondary-leg byte (2d4 Poison, MA-0531 transport), or drifted numeric
    // (+4 attack bonus, 5 ft. reach, 1d6 + 2 Piercing, escape DC 12) breaks
    // this one assertion (absorbs field-absence and preservation pins).
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
    // Identity: the payload IS the disk row — hit_conditions + escape_dc and
    // the secondary-damage bytes ride the attack lane untouched (no copy/
    // strip) into the clause and combined-damage consumers.
    expect(onAttack.mock.calls[0][2]).toBe(BITE);
  });
});
