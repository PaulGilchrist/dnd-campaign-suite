// @maintained-by-ai
// MA-1012: Ice Devil "Ice Spear" — te-only hit lane (MA-0995 #447 te-only template).
// The row's OWN Hit clause carries the multi-clause rider ("can't take a Bonus Action
// or Reaction, its Speed decreases by 10 feet, ... move or take one action ... not
// both"); pre-fix WRONG-slot fingerprint: a save_dc-less save_effect (§410/§118 decoy
// family — the hit path reads hit_conditions / hit_target_effect / hit_condition_roll
// only, NEVER description/save_effect). Fix = decoy DROPPED + hit_target_effect:
// "frozen_grip" authored at the §215 MA-0542/MA-0733 byte-slot (after range, before
// damage_dice_primary). This lane owns ONLY the by-name disk fingerprint + the
// chip-identity dispatch. Owners (verified, NOT re-derived here):
// - numerics + te-only clause shape + live grant: handlePlainDamage.hitClause.test.js
//   HIT_CLAUSE_ROWS:263 ['ice-devil','Ice Spear',10,'2d8 + 5','Piercing',[],null,
//   'frozen_grip'] + loop :289-302 (generic te-only clause :193-199).
// - registry te (label/group/fields/defaults.value 10 = RAW −10 ft + §70 advisory
//   economy copy): targetEffectDefinitions.test.js:326-336 (MA-1012 whitelist pin).
// - consumer fold te.value||10 → speedReduction + riderNoReactions:
//   conditionEffectsCompute.test.js:164-171; "Speed -10" badge with the 'frozen_grip'
//   remove key + honest tooltip: ConditionEffectBadges.ma1012-frozen-grip.test.jsx.
// - attackRowMissingToHit truth table: MA-0286 owner census :89.
// Clock: the passthrough's ONE addExpiration stays attacker-anchored (MA-0995 twin;
// RAW end-of-turn anchor is the accepted §38 advisory residual). No timers.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SPEAR = monsters.find((m) => m.index === 'ice-devil').actions.find((a) => a.name === 'Ice Spear');

describe('MA-1012 ice-devil Ice Spear hit_target_effect lane', () => {
  it('disk row verbatim BY NAME: hit_target_effect "frozen_grip" at the §215 byte-slot, decoy save fields dropped, dual-dice + full rider prose intact', () => {
    expect(SPEAR).toEqual({
      name: 'Ice Spear',
      description: 'Melee or Ranged Attack Roll: +10, reach 5 ft. or range 30/120 ft. <strong>Hit:</strong> 14 (2d8 + 5) Piercing damage plus 10 (3d6) Cold damage. Until the end of its next turn, the target can\'t take a Bonus Action or Reaction, its Speed decreases by 10 feet, and it can move or take one action on its turn, not both. Hit or Miss: The spear magically returns to the devil\'s hand immediately after a ranged attack.',
      attack_bonus: 10,
      reach: '5 ft.',
      range: '30/120 ft.',
      hit_target_effect: 'frozen_grip',
      damage_dice_primary: '2d8 + 5',
      damage_type_primary: 'Piercing',
      damage_dice_secondary: '3d6',
      damage_type_secondary: 'Cold',
    });
    const keys = Object.keys(SPEAR);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('range') + 1);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('damage_dice_primary') - 1);
  });

  it('MonsterAction te-only gate: exactly one "+10" chip (no save/DC decoy), press dispatches the exact Ice Spear row', () => {
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={SPEAR}
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
    const chips = [...container.querySelectorAll('.mc-dice-link')];
    expect(chips.map((c) => c.textContent.trim())).toEqual(['+10']);
    fireEvent.click(chips[0]);
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Ice Spear', 10, SPEAR);
    expect(onAttack.mock.calls[0][2]).toBe(SPEAR);
  });
});
