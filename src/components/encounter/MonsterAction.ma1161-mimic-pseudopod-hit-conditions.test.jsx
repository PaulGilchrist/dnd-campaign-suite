// @maintained-by-ai: 2026-10-18
// MA-1161: Mimic "Pseudopod" — prose carries the grapple rider "If the
// target is a Large or smaller creature, it has the Grappled condition (escape
// DC 13). Ability checks made to escape this grapple have Disadvantage." but
// the row shipped WITHOUT hit_conditions/escape_dc, so the rider was
// structurally inert (buildHitConditionClause reads the hit_conditions/
// escape_dc keys only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). Two-field DATA fix mirroring
// MA-0930 Grick Tentacles / MA-1157 Mezzoloth Claws byte-shape:
// hit_conditions:["grappled"] + escape_dc:13 after damage_type_secondary —
// escape_dc is 13 per row prose, NOT the 14 twin value. Unowned plain
// fused-1: HIT_CLAUSE_ROWS (handlePlainDamage.hitClause.test.js :224-282)
// carries NO mimic tuple, so exact disk bytes + clause arm stay HERE.
// OWNED ELSEWHERE (direct calls pruned): DC0 decoy save-lane gate →
// MonsterAction.ma1071-pincer-staff-dc0-gate.test.jsx (the decoy fields
// save_dc:0/save_type:""/save_effect:"" stay pinned HERE via verbatim row
// bytes; save-chip absence rides the exact ['+5'] chip list — save chips
// render as .mc-dice-link base-class per MonsterAction.jsx :138/:145);
// attackRowMissingToHit suppression → MA-0286 census truth-table (:89) +
// whole-file census (:101, covers mimic/Pseudopod live +5); runtime
// hit-clause lane → handlePlainDamage.hitClause.test.js (generic
// grappled+DC-13 tuples :232/:236/:239 own the channel). Bite twin
// conditional_damage → MA-1160 owner. "Ability checks made to escape this
// grapple have Disadvantage" is GM-adjudicated advisory — §70 grapple
// state-machine zero producers — accepted, not built.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const PSEUDOPOD = monsters.find((m) => m.index === 'mimic').actions.find((a) => a.name === 'Pseudopod');

describe('MA-1161 mimic Pseudopod hit_conditions fix', () => {
  it('fused lock: exact disk-row bytes arm the Grappled clause escape DC 13; one "+5" chip live, click payloads the raw row', () => {
    expect(Object.keys(PSEUDOPOD)).toEqual([
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
      'escape_dc',
    ]);
    expect(PSEUDOPOD).toEqual({
      name: 'Pseudopod',
      description: 'Melee Attack Roll: +5, reach 5 ft. Hit: 7 (1d8 + 3) Bludgeoning damage plus 4 (1d8) Acid damage. If the target is a Large or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 13). Ability checks made to escape this grapple have Disadvantage.',
      attack_bonus: 5,
      save_dc: 0,
      save_type: '',
      save_effect: '',
      range: '',
      reach: '5 ft.',
      recharge: '',
      damage_dice_primary: '1d8 + 3',
      damage_type_primary: 'Bludgeoning',
      damage_dice_secondary: '1d8',
      damage_type_secondary: 'Acid',
      hit_conditions: ['grappled'],
      escape_dc: 13,
    });
    expect(buildHitConditionClause(PSEUDOPOD)).toEqual({
      conditions: ['grappled'],
      escapeDc: 13,
      attackName: 'Pseudopod',
      targetEffect: null,
    });
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={PSEUDOPOD}
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
    expect(chips).toEqual(['+5']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Pseudopod', 5, PSEUDOPOD);
    expect(onAttack.mock.calls[0][2]).toBe(PSEUDOPOD);
  });
});
