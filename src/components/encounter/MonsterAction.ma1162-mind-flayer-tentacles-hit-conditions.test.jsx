// @maintained-by-ai: 2026-10-18
// MA-1162: Mind Flayer "Tentacles" — description carries the grapple rider
// "If the target is a Medium or smaller creature, it has the Grappled condition
// (escape DC 14) from all the mind flayer's tentacles, and the target has the
// Stunned condition until the grapple ends." but the row shipped WITHOUT
// hit_conditions/escape_dc, so the rider was structurally inert
// (buildHitConditionClause reads the hit_conditions/escape_dc keys only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions).
// Two-field DATA fix mirroring MA-1157 (mezzoloth Claws) / MA-1161 (mimic
// Pseudopod) in-file byte-shape: hit_conditions:["grappled","stunned"] +
// escape_dc:14 after damage_type_primary. Unowned plain fused-1 (disk keys
// carry NO hit_target_effect and save_dc:0 is the household decoy — not
// fused-2, not te-only): HIT_CLAUSE_ROWS (handlePlainDamage.hitClause.test.js
// :224-282) carries NO mind-flayer tuple and no other test locks this row, so
// exact disk bytes + clause arm stay HERE.
// OWNED ELSEWHERE (direct calls pruned): DC0 decoy save-lane gate →
// MonsterAction.ma1071-pincer-staff-dc0-gate.test.jsx (the decoy fields
// save_dc:0/save_type:""/save_effect:"" stay pinned HERE via verbatim row
// bytes; save-chip absence rides the exact ['+7'] chip list — save chips
// render with the .mc-dice-link base class per MonsterAction.jsx :138/:145);
// attackRowMissingToHit suppression → MA-0286 census truth-table + whole-file
// census (ma0286:101 skips attack_bonus!=null rows — Tentacles live +7);
// runtime hit-clause channel → handlePlainDamage.hitClause.test.js generic
// grappled tuples; save-plan owners MA-1000/MA-1867 and the extractConditions
// family cover the save-prose lane, not this fused-1 row. "until the grapple
// ends" duration stays GM-adjudicated prose (§59/§70 grapple state-machine
// zero producers — no duration fields invented).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TENTACLES = monsters.find((m) => m.index === 'mind-flayer').actions[0];

describe('MA-1162 mind-flayer Tentacles hit_conditions fix', () => {
  it('fused lock: exact disk-row bytes arm the Grappled/Stunned clause escape DC 14; one "+7" chip live, click payloads the raw row', () => {
    expect(Object.keys(TENTACLES)).toEqual([
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
      'escape_dc',
    ]);
    expect(TENTACLES).toEqual({
      name: 'Tentacles',
      description: 'Melee Attack Roll: +7, reach 5 ft. Hit: 22 (4d8 + 4) Psychic damage. If the target is a Medium or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 14) from all the mind flayer\'s tentacles, and the target has the <strong>Stunned</strong> condition until the grapple ends.',
      attack_bonus: 7,
      save_dc: 0,
      save_type: '',
      save_effect: '',
      range: '',
      reach: '5 ft.',
      recharge: '',
      damage_dice_primary: '4d8 + 4',
      damage_type_primary: 'Psychic',
      hit_conditions: ['grappled', 'stunned'],
      escape_dc: 14,
    });
    expect(buildHitConditionClause(TENTACLES)).toEqual({
      conditions: ['grappled', 'stunned'],
      escapeDc: 14,
      attackName: 'Tentacles',
      targetEffect: null,
    });
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TENTACLES}
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
    expect(chips).toEqual(['+7']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Tentacles', 7, TENTACLES);
    expect(onAttack.mock.calls[0][2]).toBe(TENTACLES);
  });
});
