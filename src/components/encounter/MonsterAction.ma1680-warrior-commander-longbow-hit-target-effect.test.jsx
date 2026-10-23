// @maintained-by-ai
// MA-1680: Warrior Commander "Longbow" — the row's OWN Hit clause carries
// the Speed-decrease rider ("Hit: 18 (3d8 + 5) Piercing damage, and the
// target's Speed decreases by 10 feet until the end of the target's next
// turn") but the row authored NO hit_target_effect, so the rider was inert
// (FAIL(a)/DATA — registered te + row lacks field = FAIL(a) full stop, §215
// codification; NOT §70 advisory — attack-row live lane). Fix = ONE field:
// hit_target_effect:"speed_reduction" at the MA-0995/MA-1147 twin byte-slot
// (after range, before damage_dice_primary). REUSE of the pre-existing
// Movement-group te (targetEffectDefinitions.js speed_reduction, defaults.
// value:10 = RAW −10 ft). Duration stays attacker-anchored
// until_start_of_next_turn via applyHitClauseTargetEffect — no invented
// clock (§37); RAW "end of the target's next turn" anchor is the accepted
// MA-0542/MA-0995 advisory residual. Greatsword sibling shares the "+9"
// bonus — row-scoped trap folded into the fingerprint (§693).
// Trimmed 10→2 tests (MA te-only canon #447/#448/#458/#460): byte-slot
// fingerprint BY NAME + chip dispatch identity only.
// Pruned with owners (verified by grep 2026-10-18):
//   numerics + te value + escape_dc null + clause arm + live hit grant →
//     handlePlainDamage.hitClause.test.js HIT_CLAUSE_ROWS:276
//     ['warrior-commander','Longbow',9,'3d8 + 5','Piercing',[],null,
//     'speed_reduction'] + loop :289-301 (buildHitConditionClause te-only
//     direct-call pin there — NOT re-derived here)
//   twin byte-shape restatements → each twin pins its OWN slot by name:
//     javelin ma0995:43-45, ocean spear ma1147:49-50 (ma0995:19 pointer to
//     the deleted :58-63 is now stale — slot locked at source owner)
//   save/condition decoy byte pins → subsumed: verbatim toEqual row has no
//     such keys + HIT_CLAUSE_ROWS:276 conditions [] / escapeDc null
//   registry te (label/group/fields ['source','value']/defaults.value 10) →
//     targetEffectDefinitions.test.js:280-308 (MA-0995 whitelist pin)
//   value 10 fold + passthrough default → conditionEffectsCompute.test.js
//     :147-158 (numeric leg :147-149, te.value||10 default :155-158)
//   "Speed -N" badge consumer → ConditionEffectBadges.test.jsx:95
//     (Speed -15 numeric badge) + ConditionEffectBadges.ma1012:47-58
//     (Speed -10 badge shape)
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
