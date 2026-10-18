// @maintained-by-ai
// MA-0775: Ghast Gravecaller "Claw" — prose carries "Hit: ... it has the
// Paralyzed condition" but the row shipped WITHOUT hit_conditions, so the
// condition rider was structurally inert (buildHitConditionClause reads
// hit_conditions/hit_target_effect/hit_condition_roll only, NEVER description;
// consumer live in handlePlainDamage.applyHitClauseConditions). One-field DATA
// fix: hit_conditions:["paralyzed"] (MA-0621/MA-0763 byte-shape, trailing after
// damage_type_primary). Sole lock: ghast-gravecaller is absent from the
// handlePlainDamage.hitClause.test.js HIT_CLAUSE_ROWS table, so this file is
// the only lane pinning the disk row — full byte-shape fingerprint + the
// "+6" attack-chip render whose click payload carries the rider row intact to
// the attack seam. Pruned (owners, all green): clause-output re-derivation
// (generic shapes: handlePlainDamage.hitClause.test.js:289-302 — lich/Paralyzing
// Touch :265 arms the identical ['paralyzed']/escapeDc-null clause; row inputs
// byte-pinned here); attackRowMissingToHit false (this row ESCAPES the MA-0286
// suppression census — attack_bonus != null rows skipped at ma0286:109,
// armed-bonus-stays-live arm owned :93); 3-arg onAttack dispatch shape
// (MA-0294; canon MonsterAction.jsx:480 onAttack(name, bonus, row)); save-chip
// plan units (MA-0927/MA-1433 lanes — this row carries no save fields).
// MA-0776 Horrific Necrosis twin cross-lock RETIRED — absorbed by MA-0776's
// own kept byte-shape lock (MonsterAction.ma0776-ghast-gravecaller-necrosis
// .test.jsx:20-27 pins hit_conditions:["frightened"], key placement, +7 dice).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const CLAW = monsters.find((m) => m.index === 'ghast-gravecaller').actions.find((a) => a.name === 'Claw');

describe('MA-0775 ghast-gravecaller Claw hit_conditions fix', () => {
  it('disk byte-shape carries hit_conditions ["paralyzed"] and the single "+6" chip dispatches the rider row intact', () => {
    // Fix field + placement byte-exact (trailing key after damage_type_primary);
    // prose <strong>Paralyzed</strong> anchor byte-kept alongside the armed field.
    expect(Object.keys(CLAW)).toEqual([
      'name', 'description', 'attack_bonus', 'reach', 'damage_dice_primary', 'damage_type_primary',
      'hit_conditions',
    ]);
    expect(CLAW.name).toBe('Claw');
    expect(CLAW.attack_bonus).toBe(6);
    expect(CLAW.damage_dice_primary).toBe('3d6 + 3');
    expect(CLAW.damage_type_primary).toBe('Slashing');
    expect(CLAW.hit_conditions).toEqual(['paralyzed']);
    expect(CLAW.description).toContain('<strong>Paralyzed</strong>');

    // Attack half stays live post-fix: exactly one chip, no save/damage chip
    // arms; the exact-row payload carries hit_conditions to applyHitClauseConditions.
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={CLAW}
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
    expect(chips).toEqual(['+6']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Claw', 6, CLAW);
  });
});
