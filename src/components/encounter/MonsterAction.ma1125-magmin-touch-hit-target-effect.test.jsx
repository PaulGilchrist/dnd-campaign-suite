// MA-1125: Magmin "Touch" — the row's OWN Hit clause carries the burning
// rider ("If the target is a creature or a flammable object that isn't being
// worn or carried, it starts burning") but the row authored NO hit_target_effect
// (§449: the hit path reads hit_conditions / hit_target_effect /
// hit_condition_roll only, NEVER description). Zero-producer fingerprint:
// live pre-fix hit left victim cd store absent, top-level targetEffects null,
// zero burn/condition log entries. FAIL(a)/DATA one-field fix.
// Sanctioned seam: hit_target_effect passthrough (§215) →
// buildHitConditionClause (MonsterCardHelpers.js:648/:651) →
// applyHitClauseTargetEffect (handlePlainDamage.js:654) registers the
// pre-registered `burning` te verbatim with until_start_of_next_turn +
// attacker-anchored addExpiration clock (§37/MA-0995 twin mechanics).
// Byte-shape/placement mirror MA-0995 hobgoblin-warlord Javelin:
// hit_target_effect immediately before damage_dice_primary. Decoy
// save_dc:0/save_type:"" stay in place (MA-1071 §437 convention — the
// Number(save_dc) > 0 gate disarms the lane; strip = mass rewrite refused).
// Grant-only model accepted: recurring burn tick + flammable-object half are
// documented advisory residuals (§70/§87 — te registry alone never ticks).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TOUCH = monsters.find((m) => m.index === 'magmin').actions[0];

describe('MA-1125 disk fingerprint: magmin Touch hit_target_effect fix', () => {
  it('disk row carries hit_target_effect "burning" at the MA-0995 slot (immediately before damage_dice_primary)', () => {
    expect(TOUCH.name).toBe('Touch');
    expect(TOUCH.attack_bonus).toBe(4);
    expect(TOUCH.reach).toBe('5 ft.');
    expect(TOUCH.hit_target_effect).toBe('burning');
    const keys = Object.keys(TOUCH);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('damage_dice_primary') - 1);
  });

  it('attack core untouched: 2d4 + 2 Fire, Hit prose still carries the burning clause', () => {
    expect(TOUCH.damage_dice_primary).toBe('2d4 + 2');
    expect(TOUCH.damage_type_primary).toBe('Fire');
    expect(TOUCH.description).toMatch(/it starts burning\.$/s);
  });

  it('burning is a pre-registered te (MA-0673 registration, GM-enforced tick note, no new registration needed)', () => {
    const def = getEffectDefinition('burning');
    expect(def).toBeTruthy();
    expect(def.label).toBe('Burning');
    expect(def.cls).toBe('effect-debuff');
    expect(def.group).toBe('Defensive');
    expect(def.fields).toEqual(['source']);
    expect(def.description).toMatch(/GM-enforced/);
  });

  it('buildHitConditionClause arms the te-only rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(TOUCH);
    expect(clause).toEqual({
      conditions: [],
      escapeDc: null,
      attackName: 'Touch',
      targetEffect: 'burning',
    });
  });

  it('attack half stays live: one "+4" chip, decoy save_dc:0 renders NO save chip', () => {
    expect(attackRowMissingToHit(TOUCH)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TOUCH}
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
    expect(chips).toEqual(['+4']);
    expect(container.querySelectorAll('.mc-dice-link-save-clickable').length).toBe(0);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Touch', 4, expect.objectContaining({ name: 'Touch' }));
  });
});
