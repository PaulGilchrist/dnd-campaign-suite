// @maintained-by-ai: 2026-10-18
// MA-1378: Rakshasa "Cursed Touch" — prose carries "If the target is a
// creature, it is cursed." but the row shipped WITHOUT hit_conditions, so the
// rider was structurally inert-unauthored (buildHitConditionClause reads
// hit_conditions/hit_target_effect/hit_condition_roll rider keys only,
// NEVER description; consumer live in handlePlainDamage.applyHitClauseConditions
// — no word whitelist, verbatim grant of tracked "cursed" condition).
// One-field DATA fix: hit_conditions:["cursed"] after damage_type_secondary
// (MA-0621/MA-1368 byte-shape). Unowned plain fused-1: HIT_CLAUSE_ROWS
// (handlePlainDamage.hitClause.test.js:224-282) carries NO rakshasa tuple,
// so exact disk bytes + Cursed clause arm stay HERE. Exact-row toEqual +
// key-order also reject any smuggled escape_dc/hit_target_effect/
// hit_condition_roll/hit_choice rider keys and byte-pin every damage/attack
// leg and the "it is cursed" prose. Rest-block clause ("no benefit from
// Short/Long Rest") stays §70 advisory residual. Multiattack actions[0]
// guard stays HERE (no other test pins rakshasa/Multiattack rider-absence).
// OWNED ELSEWHERE (calls pruned): attackRowMissingToHit truth table +
// whole-database census → MonsterAction.ma0286-slam-suppression.test.jsx
// (authored-bonus-live :93, census :101-123; the live "+10" chip census here
// is the row-level non-suppression proof); DC0 decoy save-lane gate →
// MonsterAction.ma1071-pincer-staff-dc0-gate.test.jsx (save_dc:0 authored-
// but-inert here, covered by exact-row bytes); clause output shape +
// runtime cursed application → handlePlainDamage.hitClause.test.js
// (conditions-only rows: lich/assassin :230/:265). Spot-check absorption:
// ma0611-djinni-spellcasting.test.jsx:2111 name/hit_conditions/secondary
// dice/attack_bonus clobber-guard only — bytes, keys, clause arm, render stay here.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const RAKSHASA = monsters.find((m) => m.index === 'rakshasa');
const TOUCH = RAKSHASA.actions[1];
const MULTI = RAKSHASA.actions[0];

describe('MA-1378 rakshasa Cursed Touch hit_conditions fix', () => {
  it('fused lock: exact disk-row bytes arm the Cursed clause; one "+10" chip live, click payloads the raw row', () => {
    expect(TOUCH).toEqual({
      name: 'Cursed Touch',
      description: 'Melee Attack Roll: +10, reach 5 ft. Hit: 12 (2d6 + 5) Slashing damage plus 19 (3d12) Necrotic damage. If the target is a creature, it is cursed. While cursed, the target gains no benefit from finishing a Short or Long Rest.',
      attack_bonus: 10,
      save_dc: 0,
      save_type: '',
      save_effect: '',
      range: '',
      reach: '5 ft.',
      recharge: '',
      damage_dice_primary: '2d6 + 5',
      damage_type_primary: 'Slashing',
      damage_dice_secondary: '3d12',
      damage_type_secondary: 'Necrotic',
      hit_conditions: ['cursed'],
    });
    // exact key order: hit_conditions lands last, right after damage_type_secondary
    // (MA-0621/MA-1368 byte-shape) — rejects smuggled rider keys by byte-diff
    expect(Object.keys(TOUCH)).toEqual([
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
      'damage_dice_secondary',
      'damage_type_secondary',
      'hit_conditions',
    ]);
    expect(buildHitConditionClause(TOUCH)).toEqual({
      conditions: ['cursed'],
      escapeDc: null,
      attackName: 'Cursed Touch',
      targetEffect: null,
    });
    // multiattack row untouched: no hit_conditions authored on actions[0]
    expect(MULTI.name).toBe('Multiattack');
    expect(MULTI.hit_conditions).toBeUndefined();
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TOUCH}
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
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+10']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Cursed Touch', 10, expect.objectContaining({ name: 'Cursed Touch' }));
  });
});
