// @maintained-by-ai 2026-11-28
// MA-1680: Warrior Commander "Longbow" — the row's OWN Hit clause carries
// the Speed-decrease rider ("Hit: 18 (3d8 + 5) Piercing damage, and the
// target's Speed decreases by 10 feet until the end of the target's next
// turn") but the row authored NO hit_target_effect, so the rider was inert
// (FAIL(a)/DATA — registered te + row lacks field = FAIL(a) full stop, §215
// codification; NOT §70 advisory — attack-row live lane). Fix = ONE field:
// hit_target_effect:"speed_reduction" at the MA-0995/MA-1147 twin byte-slot
// (after range, before damage_dice_primary). REUSE of the pre-existing
// Movement-group te (defaults.value:10 = RAW −10 ft). Duration stays
// attacker-anchored until_start_of_next_turn via
// applyHitClauseTargetEffect — no invented clock (§37); RAW "end of the
// target's next turn" anchor is the accepted MA-0542/MA-0995 advisory
// residual. Census-disjoint chip twins: Javelin "+6" → ma0995, Ocean Spear
// "+2" → ma1147; each twin pins its OWN row slot-by-name (cross-file line
// restatements retired). Greatsword sibling shares the "+9" bonus —
// row-scoped trap folded into the fingerprint below (§693).
// Two tests (MA te-only canon): byte-slot fingerprint BY NAME + chip
// dispatch identity only. The Longbow row IS present in
// handlePlainDamage.hitClause.test.js HIT_CLAUSE_ROWS (verified 2026-11-28),
// so clause output is shed there — no buildHitConditionClause pin here.
// Owners (verified 2026-11-28 by describe-block, NOT re-derived here):
// - numerics + te value + escape_dc null + clause arm + live grant:
//   handlePlainDamage.hitClause.test.js describe('monsters.json hit-clause
//   catalogue') HIT_CLAUSE_ROWS row ['warrior-commander','Longbow',9,
//   '3d8 + 5','Piercing',[],null,'speed_reduction'] + describe.each
//   '%s — %s hit-clause lane' lane-shape pins (te-only clause shape).
// - registry te (label/group/fields ['source','value']/defaults.value 10):
//   targetEffectDefinitions.test.js describe('TARGET_EFFECT_DEFINITIONS
//   golden census (#820)') speed_reduction row; consumer te.value||10 fold:
//   conditionEffectsCompute.test.js describe('computeConditionEffects —
//   registry te census (bare te, exact diff)') speed_reduction fold.
// - "Speed -N" badge consumer: ConditionEffectBadges.test.jsx nested
//   describe('badges from conditions and target effects') 'Speed -15'
//   numeric badge + ConditionEffectBadges.ma1012-frozen-grip.test.jsx
//   describe('MA-1012 frozen_grip badge consumer') 'Speed -10' shape.
// - save/condition decoy byte pins → subsumed: verbatim toEqual row has no
//   such keys + HIT_CLAUSE_ROWS conditions [] / escapeDc null.
// - attackRowMissingToHit truth table: MonsterAction.ma0286-slam-suppression
//   .test.jsx describe('MA-0286 attackRowMissingToHit truth table').
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const WARRIOR_COMMANDER = monsters.find((m) => m.index === 'warrior-commander');
const LONGBOW = WARRIOR_COMMANDER.actions[2];
const GREATSWORD = WARRIOR_COMMANDER.actions[1];

describe('MA-1680 warrior-commander Longbow hit_target_effect lane', () => {
  it('disk row verbatim BY NAME: hit_target_effect "speed_reduction" at the §215 byte-slot (after range, before damage_dice_primary), RAW prose byte-exact, Greatsword +9 sibling stays rider-less (§693 row-scoped trap)', () => {
    expect(LONGBOW).toEqual({
      name: 'Longbow',
      description: 'Ranged Attack Roll: +9, range 150/600 ft. Hit: 18 (3d8 + 5) Piercing damage, and the target\'s Speed decreases by 10 feet until the end of the target\'s next turn.',
      attack_bonus: 9,
      range: '150/600 ft.',
      hit_target_effect: 'speed_reduction',
      damage_dice_primary: '3d8 + 5',
      damage_type_primary: 'Piercing',
    });
    const keys = Object.keys(LONGBOW);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('range') + 1);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('damage_dice_primary') - 1);
    expect(GREATSWORD).toMatchObject({ name: 'Greatsword', attack_bonus: 9 });
    expect(GREATSWORD.hit_target_effect).toBeUndefined();
  });

  it('chip dispatch identity: exactly one "+9" chip (no save/DC decoy), press dispatches the exact Longbow row', () => {
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={LONGBOW}
        index={2}
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
    expect(chips.map((c) => c.textContent.trim())).toEqual(['+9']);
    fireEvent.click(chips[0]);
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Longbow', 9, LONGBOW);
    expect(onAttack.mock.calls[0][2]).toBe(LONGBOW);
  });
});
