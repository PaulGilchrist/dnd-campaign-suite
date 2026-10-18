// @maintained-by-ai: 2026-10-18
// MA-1149: Merfolk Wavebender "Aquatic Burst" — prose carries "If the target
// is a Large or smaller creature, it has the Prone condition" but the row
// shipped WITHOUT hit_conditions, so the Prone rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.maybeApplyHitClause/applyHitClauseConditions). One-field
// DATA fix: hit_conditions:["prone"] after damage_type_primary (MA-1141/
// MA-1116 trailing-key byte-shape, no escape_dc). Unowned plain fused-1:
// HIT_CLAUSE_ROWS (handlePlainDamage.hitClause.test.js :224-282) carries NO
// merfolk-wavebender tuple, so exact disk bytes + clause arm stay HERE.
// OWNED ELSEWHERE (calls pruned): DC0 decoy save-lane gate →
// MonsterAction.ma1071-pincer-staff-dc0-gate.test.jsx (§417/§437, save_dc:0
// authored-but-inert here via exact keys); attackRowMissingToHit suppression
// → MA-0286 census truth-table; runtime hit-clause lane + size-gate ladder
// (consumer admits Large §153/MA-0877/MA-0909 vs RAW "Large or smaller" —
// documented caveat, matches here) → handlePlainDamage.hitClause.test.js.
// Unique here: verbatim row bytes, clause arm, "+7" chip identity press.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const WAVEBENDER = monsters.find((m) => m.index === 'merfolk-wavebender');
const BURST = WAVEBENDER.actions.find((a) => a.name === 'Aquatic Burst');

describe('MA-1149 merfolk-wavebender Aquatic Burst hit_conditions fix', () => {
  it('fused lock: exact disk-row bytes arm the Prone clause; one "+7" chip live, click payloads the raw row', () => {
    expect(Object.keys(BURST)).toEqual([
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
    expect(BURST).toEqual({
      name: 'Aquatic Burst',
      description: 'Melee or Ranged Attack Roll: +7, reach 5 ft. or range 60 ft. Hit: 20 (3d10 + 4) Cold damage. If the target is a Large or smaller creature, it has the <strong>Prone</strong> condition.',
      attack_bonus: 7,
      save_dc: 0,
      save_type: '',
      save_effect: '',
      range: '60 ft.',
      reach: '5 ft.',
      recharge: '',
      damage_dice_primary: '3d10 + 4',
      damage_type_primary: 'Cold',
      hit_conditions: ['prone'],
    });
    expect(buildHitConditionClause(BURST)).toEqual({
      conditions: ['prone'],
      escapeDc: null,
      attackName: 'Aquatic Burst',
      targetEffect: null,
    });
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BURST}
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
    // Exact ['+7'] enumeration also proves the save_dc:0 decoy never renders
    // a save chip (save chips share the .mc-dice-link class, §417/§437).
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+7']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Aquatic Burst', 7, BURST);
    expect(onAttack.mock.calls[0][2]).toBe(BURST);
  });
});
