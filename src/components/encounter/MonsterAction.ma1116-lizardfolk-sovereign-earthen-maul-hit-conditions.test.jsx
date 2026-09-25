// MA-1116: Lizardfolk Sovereign "Earthen Maul" — prose carries "If the target
// is a Medium or smaller creature, it has the Prone condition" but the row
// shipped WITHOUT hit_conditions, so the Prone rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.maybeApplyHitClause/applyHitClauseConditions). One-field
// DATA fix: hit_conditions:["prone"] placed after damage_type_primary
// (MA-0763 Tendril byte-shape). Locks: disk row shape + key placement, clause
// arm, "+5" attack chip stays live, decoy save_dc:0 stays inert (§417/§437),
// Bite sibling stays hit_conditions-free. Caveat: consumer size gate admits
// Large (§153/MA-0877 family) vs RAW "Medium or smaller" — documented.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SOV = monsters.find((m) => m.index === 'lizardfolk-sovereign');
const MAUL = SOV.actions.find((a) => a.name === 'Earthen Maul');
const BITE = SOV.actions.find((a) => a.name === 'Bite');

describe('MA-1116 disk fingerprint: lizardfolk-sovereign Earthen Maul hit_conditions fix', () => {
  it('disk row carries hit_conditions ["prone"] after damage_type_primary (MA-0763 byte-shape)', () => {
    expect(MAUL.hit_conditions).toEqual(['prone']);
    const keys = Object.keys(MAUL);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(MAUL.attack_bonus).toBe(5);
    expect(MAUL.reach).toBe('5 ft.');
    expect(MAUL.damage_dice_primary).toBe('2d6 + 3');
    expect(MAUL.damage_type_primary).toBe('Bludgeoning');
  });

  it('DC0 decoy fields unchanged and never arm a save lane (§417/§437)', () => {
    expect(MAUL.save_dc).toBe(0);
    expect(MAUL.save_type).toBe('');
    expect(MAUL.save_effect).toBe('');
    expect(MAUL.escape_dc).toBeUndefined();
    expect(MAUL.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Prone rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(MAUL);
    expect(clause).toEqual({
      conditions: ['prone'],
      escapeDc: null,
      attackName: 'Earthen Maul',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+5" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(MAUL)).toBe(false);
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
    expect(onAttack).toHaveBeenCalledWith('Earthen Maul', 5, expect.objectContaining({ name: 'Earthen Maul' }));
  });

  it('Bite sibling byte-unchanged: no hit_conditions authored there', () => {
    expect(BITE.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(BITE)).toBeNull();
  });
});
