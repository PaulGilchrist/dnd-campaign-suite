// MA-0794: Giant Boar "Gore" — prose carries "the target ... has the Prone
// condition" but the row shipped WITHOUT hit_conditions, so the condition
// rider was structurally inert (buildHitConditionClause reads
// hit_conditions/hit_target_effect/hit_condition_roll only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions
// with isLargeOrSmallerTarget gate). One-field DATA fix:
// hit_conditions:["prone"] placed after damage_type_secondary — transport
// keys grouped, matching the closest authored siblings that carry BOTH
// damage_dice_secondary AND hit_conditions (Tentacle Lash / Shortsword /
// Flame Whip byte-shape). Locks: disk row shape + key placement, clause
// arm, "+5" attack chip stays live, secondary charge-extra transport keys
// byte-unchanged (rides PRIMARY every hit via buildSecondaryDamageTransport
// combined_damage_roll; ChargeBonusOffer NOT required per §531 gridless).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const GORE = monsters.find((m) => m.index === 'giant-boar').actions[0];

describe('MA-0794 disk fingerprint: giant-boar Gore hit_conditions fix', () => {
  it('disk row carries hit_conditions ["prone"] after damage_type_secondary (siblings byte-shape)', () => {
    expect(GORE.hit_conditions).toEqual(['prone']);
    const keys = Object.keys(GORE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_secondary') + 1);
    expect(GORE.attack_bonus).toBe(5);
    expect(GORE.reach).toBe('5 ft.');
  });

  it('buildHitConditionClause arms the Prone rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(GORE);
    expect(clause).toEqual({
      conditions: ['prone'],
      escapeDc: null,
      attackName: 'Gore',
      targetEffect: null,
    });
  });

  it('secondary charge-extra transport keys stay byte-unchanged', () => {
    expect(GORE.damage_dice_primary).toBe('2d6 + 3');
    expect(GORE.damage_type_primary).toBe('Piercing');
    expect(GORE.damage_dice_secondary).toBe('2d6');
    expect(GORE.damage_type_secondary).toBe('Piercing');
    expect(GORE.conditional_damage).toBeUndefined();
    expect(GORE.escape_dc).toBeUndefined();
  });

  it('attack half stays live: one "+5" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(GORE)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={GORE}
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
    expect(onAttack).toHaveBeenCalledWith('Gore', 5, expect.objectContaining({ name: 'Gore' }));
  });
});
