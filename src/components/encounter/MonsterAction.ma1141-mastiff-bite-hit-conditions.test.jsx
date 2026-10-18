// @maintained-by-ai: 2026-10-18
// MA-1141: Mastiff "Bite" — prose carries "If the target is a Medium or
// smaller creature, it has the Prone condition" but the row shipped WITHOUT
// hit_conditions, so the Prone rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description). One-field DATA fix:
// hit_conditions:["prone"] after damage_type_primary (MA-1116/MA-0763
// trailing-key byte-shape, no escape_dc). Unowned plain fused-1:
// HIT_CLAUSE_ROWS (handlePlainDamage.hitClause.test.js :224-282) carries NO
// mastiff tuple (wolf-family prone rows :280-281 own the generic lane), so
// exact disk bytes + clause arm stay HERE. OWNED ELSEWHERE (calls pruned):
// DC0 decoy save-lane gate → MonsterAction.ma1071-pincer-staff-dc0-gate
// .test.jsx (§417/§437, save_dc:0 authored-but-inert here via exact keys);
// attackRowMissingToHit suppression → MA-0286 census truth-table; runtime
// hit-clause lane + size-gate ladder (consumer admits Large §153/MA-0877/
// MA-0909 vs RAW "Medium or smaller" — documented caveat) →
// handlePlainDamage.hitClause.test.js. Unique here: verbatim row bytes,
// clause arm, "+3" chip identity press. Bite is the mastiff's ONLY action.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const MASTIFF = monsters.find((m) => m.index === 'mastiff');
const BITE = MASTIFF.actions.find((a) => a.name === 'Bite');

describe('MA-1141 mastiff Bite hit_conditions fix', () => {
  it('fused lock: exact disk-row bytes arm the Prone clause; one "+3" chip live, click payloads the raw row', () => {
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
      description: 'Melee Attack Roll: +3, reach 5 ft. Hit: 4 (1d6 + 1) Piercing damage. If the target is a Medium or smaller creature, it has the <strong>Prone</strong> condition.',
      attack_bonus: 3,
      save_dc: 0,
      save_type: '',
      save_effect: '',
      range: '',
      reach: '5 ft.',
      recharge: '',
      damage_dice_primary: '1d6 + 1',
      damage_type_primary: 'Piercing',
      hit_conditions: ['prone'],
    });
    expect(buildHitConditionClause(BITE)).toEqual({
      conditions: ['prone'],
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
    expect(chips).toEqual(['+3']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Bite', 3, BITE);
    expect(onAttack.mock.calls[0][2]).toBe(BITE);
  });
});
