// MA-1153: Merrow "Bite" — prose carries "the target has the Poisoned
// condition until the end of the merrow's next turn" but the row shipped
// WITHOUT hit_conditions, so the Poisoned rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.maybeApplyHitClause/applyHitClauseConditions). One-field
// DATA fix: hit_conditions:["poisoned"] placed after damage_type_primary
// (Couatl Bite / Giant Vulture Gouge byte-shape; MA-1141/MA-1149 twin fixes,
// no escape_dc — time-based duration residual accepted). Locks: disk row
// shape + key placement, clause arm, single "+6" attack chip stays live, no DC
// chip from the save_dc:0 decoy (§417/§437). Poisoned rides the standard
// condition channel — NOT a te (§449).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const MERROW = monsters.find((m) => m.index === 'merrow');
const BITE = MERROW.actions.find((a) => a.name === 'Bite');

describe('MA-1153 disk fingerprint: merrow Bite hit_conditions fix', () => {
  it('disk row carries hit_conditions ["poisoned"] after damage_type_primary (Couatl/Giant Vulture byte-shape)', () => {
    expect(BITE.hit_conditions).toEqual(['poisoned']);
    const keys = Object.keys(BITE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(BITE.attack_bonus).toBe(6);
    expect(BITE.reach).toBe('5 ft.');
    expect(BITE.damage_dice_primary).toBe('1d4 + 4');
    expect(BITE.damage_type_primary).toBe('Piercing');
    expect(BITE.description).toContain("until the end of the merrow's next turn");
  });

  it('DC0 decoy fields unchanged and never arm a save lane (§417/§437)', () => {
    expect(BITE.save_dc).toBe(0);
    expect(BITE.save_type).toBe('');
    expect(BITE.save_effect).toBe('');
    expect(BITE.escape_dc).toBeUndefined();
    expect(BITE.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Poisoned rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(BITE);
    expect(clause).toEqual({
      conditions: ['poisoned'],
      escapeDc: null,
      attackName: 'Bite',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+6" chip, no DC chip, no stale suppression', () => {
    expect(attackRowMissingToHit(BITE)).toBe(false);
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
    expect(container.querySelectorAll('.mc-dice-link-save-clickable')).toHaveLength(0);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Bite', 6, expect.objectContaining({ name: 'Bite' }));
  });
});
