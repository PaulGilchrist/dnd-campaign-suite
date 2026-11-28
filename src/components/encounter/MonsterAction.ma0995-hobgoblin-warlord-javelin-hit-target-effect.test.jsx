// @maintained-by-ai 2026-11-28
// MA-0995: Hobgoblin Warlord "Javelin" — target-effect-ONLY hit lane. The row's
// OWN Hit clause carries the Speed-decrease rider ("Hit: 11 (2d6 + 4) Piercing
// damage, and the target's Speed decreases by 10 feet until the start of the
// hobgoblin's next turn"); pre-fix the rider sat in the WRONG slot as a save_dc-less
// save_effect (§410/§118 decoy family — hit path reads hit_conditions /
// hit_target_effect / hit_condition_roll only). Fix = decoy dropped +
// hit_target_effect:"speed_reduction" authored at the §215 MA-0542/MA-0733
// byte-slot (after range, before damage_dice_primary). This lane owns the
// by-name disk fingerprint, the javelin slot-lock, and the te-only chip
// dispatch identity (census-disjoint siblings: Ocean Spear "+2" chip →
// ma1147, Longbow "+9" chip → ma1680).
// Owners (verified 2026-11-28 by describe-block, NOT re-derived here):
// - numerics + clause shape + live grant: handlePlainDamage.hitClause.test.js
//   describe('monsters.json hit-clause catalogue') HIT_CLAUSE_ROWS row
//   ['hobgoblin-warlord','Javelin',6,'2d6 + 4','Piercing',[],null,
//   'speed_reduction'] + describe.each '%s — %s hit-clause lane' lane-shape
//   pins (buildHitConditionClause te-only clause).
// - registry te (label/group/fields/defaults.value 10 = RAW −10 ft):
//   targetEffectDefinitions.test.js describe('TARGET_EFFECT_DEFINITIONS
//   golden census (#820)') speed_reduction row; consumer te.value||10
//   default: conditionEffectsCompute.test.js describe('computeConditionEffects
//   — registry te census (bare te, exact diff)') speed_reduction fold.
// - javelin byte-slot: owned HERE (test 1 slot-lock). ma1680 header defers:
//   "each twin pins its OWN slot by name" — its old ":58-63"/":47-59"
//   javelin twin-block restatements are retired.
// - attackRowMissingToHit truth table: MonsterAction.ma0286-slam-suppression
//   .test.jsx describe('MA-0286 attackRowMissingToHit truth table').
// Duration stays attacker-anchored until_start_of_next_turn via
// applyHitClauseTargetEffect — no invented clock (§37).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const JAVELIN = monsters.find((m) => m.index === 'hobgoblin-warlord').actions.find((a) => a.name === 'Javelin');

describe('MA-0995 hobgoblin-warlord Javelin hit_target_effect lane', () => {
  it('disk row verbatim BY NAME: hit_target_effect "speed_reduction" at the §215 byte-slot, decoy save fields dropped, RAW Speed prose intact', () => {
    expect(JAVELIN).toEqual({
      name: 'Javelin',
      description: 'Melee or Ranged Attack Roll: +6, reach 5 ft. or range 30/120 ft. <strong>Hit:</strong> 11 (2d6 + 4) Piercing damage, and the target\'s Speed decreases by 10 feet until the start of the hobgoblin\'s next turn.',
      attack_bonus: 6,
      reach: '5 ft.',
      range: '30/120 ft.',
      hit_target_effect: 'speed_reduction',
      damage_dice_primary: '2d6 + 4',
      damage_type_primary: 'Piercing',
    });
    const keys = Object.keys(JAVELIN);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('range') + 1);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('damage_dice_primary') - 1);
  });

  it('MonsterAction te-only gate: exactly one "+6" chip (no save/DC decoy), press dispatches the exact Javelin row', () => {
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={JAVELIN}
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
    expect(chips.map((c) => c.textContent.trim())).toEqual(['+6']);
    fireEvent.click(chips[0]);
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Javelin', 6, JAVELIN);
    expect(onAttack.mock.calls[0][2]).toBe(JAVELIN);
  });
});
