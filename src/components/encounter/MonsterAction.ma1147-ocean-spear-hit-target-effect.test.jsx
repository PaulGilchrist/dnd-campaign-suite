// @maintained-by-ai 2026-11-28
// MA-1147: Merfolk Skirmisher "Ocean Spear" — the row's OWN Hit clause
// carries the Speed-decrease rider ("its Speed decreases by 10 feet until the
// end of its next turn") but the row authored NO hit_target_effect, so the
// rider was inert (FAIL(a)/DATA — registered te + row lacks field = FAIL(a)
// full stop, §410/§215 family). Fix = ONE field: hit_target_effect:
// "speed_reduction" at the MA-0995/MA-0542 byte-slot (immediately before
// damage_dice_primary). REUSE of the pre-existing Movement-group te
// (defaults.value:10 = RAW −10 ft; consumed by conditionEffects.js
// te.value||10 + ConditionEffectBadges.jsx "Speed -N" badge). Secondary 1d4
// Cold leg rides combined_damage_roll, unchanged by the fix; returning-spear
// clause stays pure flavor (MA-0905). Census-disjoint twins: Javelin "+6"
// chip → ma0995, Longbow "+9" chip → ma1680; each twin pins its OWN row
// slot-by-name.
// This row is ABSENT from handlePlainDamage.hitClause.test.js
// HIT_CLAUSE_ROWS (verified 2026-11-28: Javelin/Ice Spear/Longbow rows
// present, merfolk-skirmisher not), so the verbatim fingerprint + te-only
// clause arm below are its ONLY per-row data lock — do not shed the clause
// pin unless the row is added to that mega-table.
// Owners (verified 2026-11-28 by describe-block, NOT re-derived here):
// - registry te (label/group/fields ['source','value']/defaults.value 10):
//   targetEffectDefinitions.test.js describe('TARGET_EFFECT_DEFINITIONS
//   golden census (#820)') speed_reduction row; consumer te.value||10 fold:
//   conditionEffectsCompute.test.js describe('computeConditionEffects —
//   registry te census (bare te, exact diff)') + explicit-value fold in
//   describe('computeConditionEffects — parameterized te folds').
// - two-handed inert sibling + Merfolk Spear 1d8 twin:
//   MonsterCardHelpers.ma1146-merfolk-spear-two-handed.test.js.
// - save/condition decoy byte pins → subsumed: verbatim toEqual row shows
//   the empty save_dc/save_type/save_effect decoys + the single '+2' chip
//   list + te-only clause shape (conditions: [], escapeDc: null).
// - attackRowMissingToHit truth table: MonsterAction.ma0286-slam-suppression
//   .test.jsx describe('MA-0286 attackRowMissingToHit truth table').
// Duration stays attacker-anchored via applyHitClauseTargetEffect — no
// invented clock (§37).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const OCEAN_SPEAR = monsters.find((m) => m.index === 'merfolk-skirmisher').actions[0];

describe('MA-1147 merfolk-skirmisher Ocean Spear hit_target_effect lane', () => {
  it('disk row verbatim BY NAME: hit_target_effect "speed_reduction" immediately before damage_dice_primary, numerics + RAW prose byte-exact, te-only clause armed', () => {
    expect(OCEAN_SPEAR).toEqual({
      name: 'Ocean Spear',
      description: "Melee or Ranged Attack Roll: +2, reach 5 ft. or range 20/60 ft. Hit: 3 (1d6) Piercing damage plus 2 (1d4) Cold damage. If the target is a creature, its Speed decreases by 10 feet until the end of its next turn. Hit or Miss: The spear magically returns to the merfolk's hand immediately after a ranged attack.",
      attack_bonus: 2,
      save_dc: 0,
      save_type: '',
      save_effect: '',
      range: '20/60 ft.',
      reach: '5 ft.',
      recharge: '',
      hit_target_effect: 'speed_reduction',
      damage_dice_primary: '1d6',
      damage_type_primary: 'Piercing',
      damage_dice_secondary: '1d4',
      damage_type_secondary: 'Cold',
    });
    const keys = Object.keys(OCEAN_SPEAR);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('damage_dice_primary') - 1);
    // te-only rider armed (registry default 10 = RAW −10 ft, no stamped value)
    expect(buildHitConditionClause(OCEAN_SPEAR)).toEqual({
      conditions: [],
      escapeDc: null,
      attackName: 'Ocean Spear',
      targetEffect: 'speed_reduction',
    });
  });

  it('MonsterAction te-only gate: exactly one "+2" chip (no save/DC decoy), press dispatches the exact Ocean Spear row', () => {
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={OCEAN_SPEAR}
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
    const chips = [...container.querySelectorAll('.mc-dice-link')];
    expect(chips.map((c) => c.textContent.trim())).toEqual(['+2']);
    fireEvent.click(chips[0]);
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Ocean Spear', 2, OCEAN_SPEAR);
    expect(onAttack.mock.calls[0][2]).toBe(OCEAN_SPEAR);
  });
});
