// @maintained-by-ai
// MA-0763: Gas Spore Fungus "Tendril" — prose carries "Hit: ... the target has
// the Poisoned condition" but the row shipped WITHOUT hit_conditions, so the
// condition rider was structurally inert (buildHitConditionClause reads
// hit_conditions/hit_target_effect/hit_condition_roll only, NEVER description;
// consumer live in handlePlainDamage.applyHitClauseConditions). One-field DATA
// fix: hit_conditions:["poisoned"] (MA-0621/MA-0756 byte-shape, trailing after
// damage_type_primary). Sole lock: gas-spore-fungus is absent from the
// handlePlainDamage.hitClause.test.js HIT_CLAUSE_ROWS table, so this file is
// the only lane pinning the disk row — full byte-shape fingerprint + the
// "+0" attack-chip render whose click payload carries the rider row intact to
// the attack seam. Pruned (owners, all green): clause-output re-derivation
// (generic shapes: handlePlainDamage.hitClause.test.js:183-214; row inputs are
// byte-pinned here); attackRowMissingToHit false (MA-0286 census; derives from
// attack_bonus:0 pinned below); 3-arg onAttack dispatch shape (MA-0294);
// MA-0762 Touch twin cross-lock RETIRED — absorbed by MA-0762's own kept
// byte-shape lock (MonsterAction.ma0762-gas-spore-touch.test.jsx:29-37 pins
// attack_bonus:0, dc_success:"none", and no hit_conditions in the full key list).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TENDRIL = monsters.find((m) => m.index === 'gas-spore-fungus').actions[0];

describe('MA-0763 gas-spore-fungus Tendril hit_conditions fix', () => {
  it('disk byte-shape carries hit_conditions ["poisoned"] and the single "+0" chip dispatches the rider row intact', () => {
    // Fix field + placement byte-exact (trailing key after damage_type_primary).
    expect(Object.keys(TENDRIL)).toEqual([
      'name', 'description', 'attack_bonus', 'reach', 'damage_dice_primary', 'damage_type_primary',
      'hit_conditions',
    ]);
    expect(TENDRIL.name).toBe('Tendril');
    expect(TENDRIL.attack_bonus).toBe(0);
    expect(TENDRIL.damage_dice_primary).toBe('1d6');
    expect(TENDRIL.damage_type_primary).toBe('Poison');
    expect(TENDRIL.hit_conditions).toEqual(['poisoned']);

    // Attack half stays live post-fix: exactly one chip, no save/damage chip
    // arms; the exact-row payload carries hit_conditions to applyHitClauseConditions.
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
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Tendril', 0, TENDRIL);
  });
});
