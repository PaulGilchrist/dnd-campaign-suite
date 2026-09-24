// MA-1084: Lich "Paralyzing Touch" — prose carries "Hit: ... the target has
// the Paralyzed condition until the start of the lich's next turn" but the
// row shipped WITHOUT hit_conditions, so the condition rider was structurally
// inert (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). One-field DATA fix:
// hit_conditions:["paralyzed"] (MA-0775 ghast Claw / MA-0763 gas-spore
// byte-shape, placed after damage_type_primary). Grants ride the STANDARD
// until-next-turn latch (MA-0775/MA-0763 precedent — no explicit clock; the
// RAW "until the start of the lich's next turn" anchor is GM-enforced badge
// removal). Locks: disk row shape + key placement, noise fields byte-kept
// (MA-1071: save_dc:0 decoy is code-gated Number(save_dc)>0 — inert, do NOT
// strip), clause arm, "+12" attack chip stays live with ZERO save chip.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const LICH = monsters.find((m) => m.index === 'lich');
const TOUCH = LICH.actions[2];
const CLAW = monsters.find((m) => m.index === 'ghast-gravecaller').actions[1];

describe('MA-1084 disk fingerprint: Lich Paralyzing Touch hit_conditions fix', () => {
  it('disk row carries hit_conditions ["paralyzed"] after damage_type_primary (MA-0775 byte-shape)', () => {
    expect(TOUCH.name).toBe('Paralyzing Touch');
    expect(TOUCH.hit_conditions).toEqual(['paralyzed']);
    const keys = Object.keys(TOUCH);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(TOUCH.attack_bonus).toBe(12);
    expect(TOUCH.reach).toBe('5 ft.');
    expect(TOUCH.damage_dice_primary).toBe('3d6 + 5');
    expect(TOUCH.damage_type_primary).toBe('Cold');
  });

  it('prose duration anchor byte-kept + noise fields untouched (MA-1071 decoy inert)', () => {
    expect(TOUCH.description).toContain('<strong>Paralyzed</strong> condition until the start of the lich\'s next turn');
    expect(TOUCH.save_dc).toBe(0);
    expect(TOUCH.save_type).toBe('');
    expect(TOUCH.save_effect).toBe('');
    expect(TOUCH.escape_dc).toBeUndefined();
    expect(TOUCH.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Paralyzed rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(TOUCH);
    expect(clause).toEqual({
      conditions: ['paralyzed'],
      escapeDc: null,
      attackName: 'Paralyzing Touch',
      targetEffect: null,
    });
  });

  it('byte-shape mirror of the MA-0775 ghast Claw twin key order', () => {
    expect(TOUCH.hit_conditions).toEqual(CLAW.hit_conditions);
    expect(buildHitConditionClause(CLAW).conditions).toEqual(['paralyzed']);
  });

  it('attack half stays live: one "+12" chip, no stale suppression, no DC0 chip (MA-1071 gate)', () => {
    expect(attackRowMissingToHit(TOUCH)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TOUCH}
        index={2}
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
    expect(chips).toEqual(['+12']);
    expect(container.querySelectorAll('.mc-dice-link-save-clickable')).toHaveLength(0);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Paralyzing Touch', 12, expect.objectContaining({ name: 'Paralyzing Touch' }));
  });
});
