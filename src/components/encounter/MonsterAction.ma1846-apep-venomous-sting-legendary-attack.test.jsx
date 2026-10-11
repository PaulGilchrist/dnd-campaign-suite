// MA-1846: Apep "Venomous Sting" legendary child shipped prose-only —
// the row rendered a live ungated-damage .mc-dice-link chip (ActionDamageLinks
// prose extraction; attackRowMissingToHit suppressed the +18 chip) that rode
// the LA spend latch, spending a use and applying damage with zero hit
// adjudication, damageType:"" and no Poisoned rider. DATA fix (Orochi
// "Crushing Coil" / MA-0621 Sickening Ray byte-shape, no delegates_to — the
// row itself becomes the resolver): attack_bonus/reach/damage_dice_primary/
// damage_type_primary + hit_conditions:["poisoned"] (MA-0229 lane), avg text
// 24→23 (avg(4d6+9)=23). Numeric legendary children self-suppress the
// "Expend Legendary" chip (MonsterAction.jsx:192) and ride the section-wrapped
// gate (MonsterCardBody.jsx:228) which spends then routes resolveLegendaryRowMechanic
// → handleAttack. "Until end of its next turn" expiry stays hit_conditions-lane
// residual (§346: pure hit_conditions carries no clock).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';
import { canRollExpression } from '../../services/dice/diceRoller.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const APEP = monsters.find((m) => m.index === 'apep');
const LEGENDARY = APEP.legendary_actions;
const HEADER = LEGENDARY[0];
const STING = LEGENDARY[2];
const COILS = LEGENDARY[1];
const BOAT = LEGENDARY[3];

describe('MA-1846 disk fingerprint: Apep Venomous Sting structured legendary attack row', () => {
  it('row is legendary_actions[2] Venomous Sting with all five structured fields', () => {
    expect(LEGENDARY[2]).toBe(STING);
    expect(STING.name).toBe('Venomous Sting');
    expect(STING.attack_bonus).toBe(18);
    expect(STING.reach).toBe('25 ft.');
    expect(STING.damage_dice_primary).toBe('4d6 + 9');
    expect(STING.damage_type_primary).toBe('Poison');
    expect(STING.hit_conditions).toEqual(['poisoned']);
    expect(canRollExpression(STING.damage_dice_primary)).toBe(true);
  });

  it('avg text corrected 24→23: avg(4d6+9)=23; name/description otherwise byte-identical', () => {
    expect(STING.description).toBe(
      'Melee Attack Roll: +18, reach 25 ft., one target. Hit: 23 (4d6+9) Poison damage and the target has the Poisoned condition until the end of its next turn.'
    );
    expect(STING.description).not.toContain('Hit: 24');
  });

  it('key placement mirrors Orochi Crushing Coil twin: fields after description, hit_conditions last', () => {
    const keys = Object.keys(STING);
    expect(keys).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'damage_dice_primary',
      'damage_type_primary',
      'hit_conditions',
    ]);
  });

  it('no delegates_to / no automation / no save lane / no escape clock (§225/§229 — row is its own resolver)', () => {
    expect(STING.delegates_to).toBeUndefined();
    expect(STING.automation).toBeUndefined();
    expect(STING.save_dc).toBeUndefined();
    expect(STING.save_type).toBeUndefined();
    expect(STING.save_effect).toBeUndefined();
    expect(STING.escape_dc).toBeUndefined();
    expect(STING.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Poisoned rider (was null pre-fix); to-hit lane live', () => {
    const clause = buildHitConditionClause(STING);
    expect(clause).toEqual({
      conditions: ['poisoned'],
      escapeDc: null,
      attackName: 'Venomous Sting',
      targetEffect: null,
    });
    expect(attackRowMissingToHit(STING)).toBe(false);
  });

  it('legendary section rendering: numeric child renders ONE "+18" chip riding the wrapped gate, no ungated prose damage chip, no duplicate Expend chip', () => {
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
    expect(onAttack).toHaveBeenCalledWith('Venomous Sting', 18, expect.objectContaining({ name: 'Venomous Sting' }));
    expect(legendaryGate).not.toHaveBeenCalled();
  });

  it('header economy and siblings untouched: uses:3 header, Coils + Devour keep delegates_to', () => {
    expect(HEADER.name).toBe('Legendary Action Uses: 3');
    expect(HEADER.uses).toBe(3);
    expect(LEGENDARY.length).toBe(4);
    expect(COILS.delegates_to).toBe('Constrict');
    expect(COILS.attack_bonus).toBeUndefined();
    expect(BOAT.delegates_to).toBe('Constrict');
    expect(BOAT.attack_bonus).toBeUndefined();
    const stingActions = APEP.actions.filter((a) => a.name === 'Venomous Sting');
    expect(stingActions).toEqual([]);
  });
});
