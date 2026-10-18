// @maintained-by-ai: 2026-10-18
// MA-1157: Mezzoloth "Claws" — prose carries the grapple rider "If the
// target is a Large or smaller creature, it has the Grappled condition (escape
// DC 14) from two of four claws, and it has the Restrained condition until the
// grapple ends." but the row shipped WITHOUT hit_conditions/escape_dc, so the
// rider was structurally inert (buildHitConditionClause reads the
// hit_conditions/escape_dc keys only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). Two-field DATA fix mirroring
// giant-crocodile Bite byte-shape (MA-0801) / MA-1111 in-file twin:
// hit_conditions:["grappled","restrained"] + escape_dc:14 after
// damage_type_primary. Unowned plain fused-1: HIT_CLAUSE_ROWS
// (handlePlainDamage.hitClause.test.js :224-282) carries NO mezzoloth tuple
// (chain-devil :242 owns the generic grappled+restrained DC-14 runtime lane),
// so exact disk bytes + clause arm stay HERE. OWNED ELSEWHERE (direct calls
// pruned): DC0 decoy save-lane gate + save-chip absence →
// MonsterAction.ma1071-pincer-staff-dc0-gate.test.jsx (§417/§437; the DC0
// decoy fields save_dc:0/save_type:""/save_effect:"" stay pinned HERE via
// verbatim row bytes); attackRowMissingToHit suppression → MA-0286 census
// truth-table (:89, derived from the live +7 chip pinned below); runtime
// hit-clause lane → handlePlainDamage.hitClause.test.js. "two of four claws"
// / "until the grapple ends" stay flavor advisory (§59/§70 grapple state
// machine zero producers); single damage leg — no per-leg twins.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const MEZZOLOTH = monsters.find((m) => m.index === 'mezzoloth');
const CLAWS = MEZZOLOTH.actions.find((a) => a.name === 'Claws');

describe('MA-1157 mezzoloth Claws hit_conditions fix', () => {
  it('fused lock: exact disk-row bytes arm the Grappled/Restrained clause escape DC 14; one "+7" chip live, click payloads the raw row', () => {
    expect(Object.keys(CLAWS)).toEqual([
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
    expect(CLAWS).toEqual({
      name: 'Claws',
      description: 'Melee Attack Roll: +7, reach 5 ft. Hit: 9 (2d4 + 4) Slashing damage. If the target is a Large or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 14) from two of four claws, and it has the <strong>Restrained</strong> condition until the grapple ends.',
      attack_bonus: 7,
      save_dc: 0,
      save_type: '',
      save_effect: '',
      range: '',
      reach: '5 ft.',
      recharge: '',
      damage_dice_primary: '2d4 + 4',
      damage_type_primary: 'Slashing',
      hit_conditions: ['grappled', 'restrained'],
      escape_dc: 14,
    });
    expect(buildHitConditionClause(CLAWS)).toEqual({
      conditions: ['grappled', 'restrained'],
      escapeDc: 14,
      attackName: 'Claws',
      targetEffect: null,
    });
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={CLAWS}
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
    expect(chips).toEqual(['+7']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Claws', 7, CLAWS);
    expect(onAttack.mock.calls[0][2]).toBe(CLAWS);
  });
});
