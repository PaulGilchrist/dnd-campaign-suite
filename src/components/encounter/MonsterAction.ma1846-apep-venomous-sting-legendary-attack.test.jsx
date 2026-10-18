// @maintained-by-ai: 2026-10-18 — trimmed 7→2 tests: tests 1-4 folded into one
// exact-shape toEqual (key set + values + absent delegates_to/automation/save/
// escape keys all fall out of it; avg(4d6+9)=23 fix lives in the description
// byte); pruned buildHitConditionClause/attackRowMissingToHit re-derivation
// (owners: handlePlainDamage.hitClause.test.js :183-214 generic clause shapes,
// poisoned row-shape twin :203; MonsterAction.ma0286-slam-suppression.test.jsx
// :89 truth table + :113 whole-DB census — grep "buildHitConditionClause.*owner"
// / "attackRowMissingToHit truth table" hits dozens of sibling prunings); pruned
// Devour/BOAT + LEGENDARY.length restatements (owner: ma1847-apep-devour-the-boat
// -save.test.jsx :40-73 full fingerprint) and the uses-counter/gate-spent/refusal/
// regain legs (row-agnostic section wrapper MonsterCardBody.jsx:240-243; owners:
// MonsterCardModal.legendary-uses-kraken.test.jsx :282 exhausted refusal,
// :301 regain, MonsterCardModal.ma1847-devour-the-boat.test.jsx :116-171 Apep
// spend/refusal lane).
// MA-1846: Apep "Venomous Sting" legendary child shipped prose-only — the row
// rendered a live ungated-damage .mc-dice-link chip (ActionDamageLinks prose
// extraction; attackRowMissingToHit had suppressed the +18 chip) that rode the LA
// spend latch, spending a use and applying damage with zero hit adjudication,
// damageType:"" and no Poisoned rider. DATA fix (row becomes its own resolver,
// MA-0621 byte-shape, no delegates_to): attack_bonus/reach/damage_dice_primary/
// damage_type_primary + hit_conditions ["poisoned"] (MA-0229 lane — clause
// derivation owned by hitClause.test.js, not re-derived here), avg text 24→23.
// Numeric legendary children self-suppress the "Expend Legendary" chip
// (MonsterAction.jsx:217-218); the section wrapper (MonsterCardBody.jsx:240-242)
// reroutes this row's onAttack press through legendaryGate — spend-then-resolve
// (resolveLegendaryRowMechanic → handleAttack) lives there, the row stays a
// byte-passthrough. "Until end of its next turn" expiry stays hit_conditions-lane
// residual (§346: pure hit_conditions carries no clock).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { canRollExpression } from '../../services/dice/diceRoller.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const APEP = monsters.find((m) => m.index === 'apep');
const LEGENDARY = APEP.legendary_actions;
const HEADER = LEGENDARY[0];
const COILS = LEGENDARY[1];
const STING = LEGENDARY[2];

describe('MA-1846 Apep Venomous Sting: structured legendary attack row', () => {
  it('disk fingerprint — exact key set pins the full row (avg text 23, Poison rollable, no delegates_to/automation/save/escape keys); header uses:3 and Coils delegate sibling byte-state; no actions[] shadow', () => {
    expect(STING).toEqual({
      name: 'Venomous Sting',
      description: 'Melee Attack Roll: +18, reach 25 ft., one target. Hit: 23 (4d6+9) Poison damage and the target has the Poisoned condition until the end of its next turn.',
      attack_bonus: 18,
      reach: '25 ft.',
      damage_dice_primary: '4d6 + 9',
      damage_type_primary: 'Poison',
      hit_conditions: ['poisoned'],
    });
    expect(canRollExpression(STING.damage_dice_primary)).toBe(true);
    expect(HEADER.name).toBe('Legendary Action Uses: 3');
    expect(HEADER.uses).toBe(3);
    // Coils (grep "Coils" — sole pin): delegate-only, no numeric of its own.
    expect(COILS.delegates_to).toBe('Constrict');
    expect(COILS.attack_bonus).toBeUndefined();
    expect(APEP.actions.some((a) => a.name === 'Venomous Sting')).toBe(false);
  });

  it('gate-open row press: ONE "+18" chip (no ungated 4d6+9 damage chip — the MA-1846 auto-hit lever dies here; no duplicate Expend chip, numeric self-suppress :217-218) routes onAttack with the full row payload; row-level legendaryGate byte-inert — spend lives in the section wrapper (MonsterCardBody.jsx:240-242)', () => {
    const legendaryGate = vi.fn();
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={STING}
        index={0}
        attackerCannotAct={false}
        onAttack={onAttack}
        onDamage={vi.fn()}
        onSaveRoll={vi.fn()}
        onSpellCast={vi.fn()}
        reactionUsesUsed={{}}
        onGatedReaction={vi.fn()}
        legendaryGate={legendaryGate}
      />
    );
    const chips = [...container.querySelectorAll('.mc-dice-link')].map((c) => c.textContent.trim());
    expect(chips).toEqual(['+18']);
    expect(container.querySelector('.mc-dice-link-legendary')).toBeNull();
    fireEvent.click(container.querySelector('.mc-dice-link'));
    // Full row identity payload: carries attack_bonus + reach + hit_conditions
    // so the wrapper's legendaryGate(action) → handleAttack arms the Poisoned rider.
    expect(onAttack).toHaveBeenCalledWith('Venomous Sting', 18, STING);
    expect(legendaryGate).not.toHaveBeenCalled();
  });
});
