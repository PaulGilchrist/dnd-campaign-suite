// MA-1378: Rakshasa "Cursed Touch" — prose carries "If the target is a
// creature, it is cursed." but the row shipped WITHOUT hit_conditions, so the
// rider was structurally inert-unauthored (buildHitConditionClause reads
// hit_conditions/hit_target_effect/hit_condition_roll only, NEVER description;
// consumer live in handlePlainDamage.applyHitClauseConditions — no word
// whitelist, verbatim grant of tracked "cursed" condition). One-field DATA fix:
// hit_conditions:["cursed"] (MA-0621/MA-1368 byte-shape, placed after
// damage_type_secondary). Locks: disk row shape + key placement, clause arms
// Cursed, "+10" attack chip stays live, damage/secondary legs byte-unchanged,
// no escape/roll/te rider keys smuggled in. Rest-block clause ("no benefit
// from Short/Long Rest") stays §70 advisory residual.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TOUCH = monsters.find((m) => m.index === 'rakshasa').actions[1];
const MULTI = monsters.find((m) => m.index === 'rakshasa').actions[0];

describe('MA-1378 disk fingerprint: rakshasa Cursed Touch hit_conditions fix', () => {
  it('disk row carries hit_conditions ["cursed"] after damage_type_secondary (MA-0621/MA-1368 byte-shape)', () => {
    expect(TOUCH.hit_conditions).toEqual(['cursed']);
    const keys = Object.keys(TOUCH);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_secondary') + 1);
  });

  it('damage/attack legs byte-unchanged', () => {
    expect(TOUCH.name).toBe('Cursed Touch');
    expect(TOUCH.attack_bonus).toBe(10);
    expect(TOUCH.reach).toBe('5 ft.');
    expect(TOUCH.damage_dice_primary).toBe('2d6 + 5');
    expect(TOUCH.damage_type_primary).toBe('Slashing');
    expect(TOUCH.damage_dice_secondary).toBe('3d12');
    expect(TOUCH.damage_type_secondary).toBe('Necrotic');
    expect(TOUCH.save_dc).toBe(0);
    expect(TOUCH.save_type).toBe('');
    expect(TOUCH.save_effect).toBe('');
    expect(TOUCH.description).toContain('it is cursed');
  });

  it('buildHitConditionClause arms the Cursed rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(TOUCH);
    expect(clause).toEqual({
      conditions: ['cursed'],
      escapeDc: null,
      attackName: 'Cursed Touch',
      targetEffect: null,
    });
  });

  it('no other rider keys authored (cursed needs no escape/roll/te)', () => {
    expect(TOUCH.escape_dc).toBeUndefined();
    expect(TOUCH.hit_target_effect).toBeUndefined();
    expect(TOUCH.hit_condition_roll).toBeUndefined();
    expect(TOUCH.hit_choice).toBeUndefined();
  });

  it('multiattack row actions[0] untouched: no hit_conditions authored', () => {
    expect(MULTI.name).toBe('Multiattack');
    expect(MULTI.hit_conditions).toBeUndefined();
  });

  it('attack half stays live: one "+10" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(TOUCH)).toBe(false);
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
