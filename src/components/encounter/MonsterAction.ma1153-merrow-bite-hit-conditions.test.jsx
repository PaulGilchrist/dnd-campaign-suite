// @maintained-by-ai: 2026-10-18
// MA-1153: Merrow "Bite" — prose carries "the target has the Poisoned
// condition until the end of the merrow's next turn" but the row shipped
// WITHOUT hit_conditions, so the Poisoned rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.maybeApplyHitClause/applyHitClauseConditions). One-field
// DATA fix: hit_conditions:["poisoned"] after damage_type_primary (Couatl
// Bite / Giant Vulture Gouge byte-shape, MA-1141/MA-1149 twin fixes, no
// escape_dc — time-based duration residual accepted). Unowned plain fused-1:
// HIT_CLAUSE_ROWS (handlePlainDamage.hitClause.test.js :224-282) carries NO
// merrow tuple, so exact disk bytes + clause arm stay HERE. OWNED ELSEWHERE
// (direct calls pruned): DC0 decoy save-lane gate + save-chip absence →
// MonsterAction.ma1071-pincer-staff-dc0-gate.test.jsx (§417/§437; the DC0
// decoy fields save_dc:0/save_type:""/save_effect:"" stay pinned HERE via
// verbatim row bytes, absence of escape_dc/hit_target_effect via exact keys);
// attackRowMissingToHit suppression → MA-0286 census truth-table (:89,
// derived from the live +6 pinned below); runtime hit-clause lane →
// handlePlainDamage.hitClause.test.js. Poisoned rides the standard condition
// channel — NOT a te (§449): clause targetEffect stays null.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const MERROW = monsters.find((m) => m.index === 'merrow');
const BITE = MERROW.actions.find((a) => a.name === 'Bite');

describe('MA-1153 merrow Bite hit_conditions fix', () => {
  it('fused lock: exact disk-row bytes arm the Poisoned clause; one "+6" chip live, click payloads the raw row', () => {
    expect(Object.keys(BITE)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'save_dc',
      'save_type',
      'save_effect',
      'range',
      'reach',
      'recharge',
      'damage_dice_primary',
      'damage_type_primary',
      'hit_conditions',
    ]);
    expect(BITE).toEqual({
      name: 'Bite',
      description: "Melee Attack Roll: +6, reach 5 ft. Hit: 6 (1d4 + 4) Piercing damage, and the target has the <strong>Poisoned</strong> condition until the end of the merrow's next turn.",
      attack_bonus: 6,
      save_dc: 0,
      save_type: '',
      save_effect: '',
      range: '',
      reach: '5 ft.',
      recharge: '',
      damage_dice_primary: '1d4 + 4',
      damage_type_primary: 'Piercing',
      hit_conditions: ['poisoned'],
    });
    expect(buildHitConditionClause(BITE)).toEqual({
      conditions: ['poisoned'],
      escapeDc: null,
      attackName: 'Bite',
      targetEffect: null,
    });
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
    expect(chips).toEqual(['+6']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Bite', 6, BITE);
    expect(onAttack.mock.calls[0][2]).toBe(BITE);
  });
});
