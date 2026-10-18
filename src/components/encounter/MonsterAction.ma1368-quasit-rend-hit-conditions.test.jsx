// @maintained-by-ai: 2026-10-18
// MA-1368: Quasit "Rend" — prose carries "Hit: 5 (1d4 + 3) Slashing damage,
// and the target has the Poisoned condition until the start of the quasit's
// next turn" but the row shipped WITHOUT hit_conditions, so the rider was
// structurally inert-unauthored (buildHitConditionClause reads
// hit_conditions/hit_target_effect/hit_condition_roll rider keys only,
// NEVER description; consumer live in handlePlainDamage.applyHitClauseConditions).
// One-field DATA fix: hit_conditions:["poisoned"] after damage_type_primary
// (MA-0621 dracolich Sickening-Ray byte-shape). Unowned plain fused-1:
// HIT_CLAUSE_ROWS (handlePlainDamage.hitClause.test.js:224-282) carries NO
// quasit tuple, so exact disk bytes + Poisoned clause arm stay HERE. This is
// the Rend hit-clause lane only — the quasit Shape-Shift (actions[3]) chip +
// its Rend byte-inert sibling are owned by MA-1371
// (MonsterAction.ma1371-shape-shift-chip.test.jsx) and the invisibility
// attack-ender by monsterSelfBuff.quasit-invisibility.test.js — no collision.
// OWNED ELSEWHERE (calls pruned): attackRowMissingToHit truth table +
// whole-database census → MonsterAction.ma0286-slam-suppression.test.jsx;
// DC0 decoy save-lane gate → MonsterAction.ma1071-pincer-staff-dc0-gate
// .test.jsx (save_dc:0 authored-but-inert here, covered by exact-row bytes);
// clause output shape + runtime Poisoned application →
// handlePlainDamage.hitClause.test.js (poisoned-only rows: assassin :230).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const REND = monsters.find((m) => m.index === 'quasit').actions[0];

describe('MA-1368 quasit Rend hit_conditions fix', () => {
  it('fused lock: exact disk-row bytes arm the Poisoned clause; one "+5" chip live, click payloads the raw row', () => {
    expect(REND).toEqual({
      name: 'Rend',
      description: "Melee Attack Roll: +5, reach 5 ft. Hit: 5 (1d4 + 3) Slashing damage, and the target has the <strong>Poisoned</strong> condition until the start of the quasit's next turn.",
      attack_bonus: 5,
      save_dc: 0,
      save_type: '',
      save_effect: '',
      range: '',
      reach: '5 ft.',
      recharge: '',
      damage_dice_primary: '1d4 + 3',
      damage_type_primary: 'Slashing',
      hit_conditions: ['poisoned'],
    });
    // exact key order: hit_conditions lands last, right after damage_type_primary
    // (MA-0621 byte-shape) — also rejects any smuggled escape/roll/te rider keys
    expect(Object.keys(REND)).toEqual([
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
    expect(buildHitConditionClause(REND)).toEqual({
      conditions: ['poisoned'],
      escapeDc: null,
      attackName: 'Rend',
      targetEffect: null,
    });
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={REND}
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
    expect(onAttack).toHaveBeenCalledWith('Rend', 5, expect.objectContaining({ name: 'Rend' }));
  });
});
