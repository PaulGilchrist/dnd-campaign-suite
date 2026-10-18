// @maintained-by-ai: 2026-10-18
// MA-1116: Lizardfolk Sovereign "Earthen Maul" — prose carries "If the target
// is a Medium or smaller creature, it has the Prone condition" but the row
// shipped WITHOUT hit_conditions, so the Prone rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description). One-field DATA fix:
// hit_conditions:["prone"] after damage_type_primary (MA-0763 Tendril
// byte-shape). Unowned plain fused-1: HIT_CLAUSE_ROWS
// (handlePlainDamage.hitClause.test.js :224-282) carries NO
// lizardfolk-sovereign tuple (only dao Earthen Maul :252), so exact disk
// bytes + clause arm stay HERE. OWNED ELSEWHERE (calls pruned): DC0 decoy
// save-lane gate → MonsterAction.ma1071-pincer-staff-dc0-gate.test.jsx
// (§417/§437, save_dc:0 authored-but-inert here via exact keys);
// attackRowMissingToHit suppression + hit-clause runtime lane + size-gate
// ladder (consumer admits Large §153/MA-0877 vs RAW "Medium or smaller" —
// documented caveat) → handlePlainDamage.hitClause.test.js. Unique here:
// verbatim row bytes, clause arm, "+5" chip identity press, Bite sibling
// rider-free.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SOV = monsters.find((m) => m.index === 'lizardfolk-sovereign');
const MAUL = SOV.actions.find((a) => a.name === 'Earthen Maul');
const BITE = SOV.actions.find((a) => a.name === 'Bite');

describe('MA-1116 lizardfolk-sovereign Earthen Maul hit_conditions fix', () => {
  it('fused lock: exact disk-row bytes arm the Prone clause; one "+5" chip live, click payloads the raw row; Bite sibling stays rider-free', () => {
    expect(Object.keys(MAUL)).toEqual([
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
    expect(MAUL).toEqual({
      name: 'Earthen Maul',
      description: 'Melee Attack Roll: +5, reach 5 ft. Hit: 10 (2d6 + 3) Bludgeoning damage. If the target is a Medium or smaller creature, it has the <strong>Prone</strong> condition.',
      attack_bonus: 5,
      save_dc: 0,
      save_type: '',
      save_effect: '',
      range: '',
      reach: '5 ft.',
      recharge: '',
      damage_dice_primary: '2d6 + 3',
      damage_type_primary: 'Bludgeoning',
      hit_conditions: ['prone'],
    });
    expect(buildHitConditionClause(MAUL)).toEqual({
      conditions: ['prone'],
      escapeDc: null,
      attackName: 'Earthen Maul',
      targetEffect: null,
    });
    expect(buildHitConditionClause(BITE)).toBeNull();
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={MAUL}
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
    expect(chips).toEqual(['+5']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Earthen Maul', 5, MAUL);
    expect(onAttack.mock.calls[0][2]).toBe(MAUL);
  });
});
