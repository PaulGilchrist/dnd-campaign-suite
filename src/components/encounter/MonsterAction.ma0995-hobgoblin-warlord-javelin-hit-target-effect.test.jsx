// MA-0995: Hobgoblin Warlord "Javelin" — the row's OWN Hit clause carries
// the Speed-decrease rider ("Hit: 11 (2d6 + 4) Piercing damage, and the
// target's Speed decreases by 10 feet until the start of the hobgoblin's
// next turn") but the row authored the rider in the WRONG slot: a structured
// `save_effect` with NO save_dc (§410/§118 decoy fingerprint — save_effect
// consumers are gated save_dc!=null in MonsterAction.jsx / MonsterCardModal.jsx;
// the hit path reads hit_conditions / hit_target_effect / hit_condition_roll
// only, NEVER description/save_effect). Wrong-slot FAIL(a)-DATA per §410.
// Speed is not a condition so hit_conditions does not fit (MA-0984 twin lane);
// the sanctioned seam is the live hit_target_effect passthrough (§215
// MA-0542/MA-0733 byte-twin placement: after save_effect, before
// damage_dice_primary). Fix: decoy save_effect DROPPED +
// hit_target_effect:"speed_reduction" authored — REUSE of the pre-existing
// Movement-group te (targetEffectDefinitions.js, fields ['source','value'],
// defaults.value:10 = RAW −10 ft; consumed by conditionEffects.js
// te.value||10 + ConditionEffectBadges.jsx "Speed -10" badge). Consumer
// applyHitClauseTargetEffect stamps duration:'until_start_of_next_turn' +
// ONE addExpiration anchored on the hobgoblin — exactly the RAW duration,
// no invented clock (§37).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const JAVELIN = monsters.find((m) => m.index === 'hobgoblin-warlord').actions[1];

describe('MA-0995 disk fingerprint: hobgoblin-warlord Javelin hit_target_effect fix', () => {
  it('disk row carries hit_target_effect "speed_reduction" at the MA-0542/MA-0733 slot (after range, before damage_dice_primary)', () => {
    expect(JAVELIN.name).toBe('Javelin');
    expect(JAVELIN.attack_bonus).toBe(6);
    expect(JAVELIN.reach).toBe('5 ft.');
    expect(JAVELIN.range).toBe('30/120 ft.');
    expect(JAVELIN.hit_target_effect).toBe('speed_reduction');
    const keys = Object.keys(JAVELIN);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('range') + 1);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('damage_dice_primary') - 1);
  });

  it('decoy save_effect dropped: row carries NO save fields (no save_dc ever armed ActionSaveRoll)', () => {
    expect(JAVELIN.save_effect).toBeUndefined();
    expect(JAVELIN.save_dc).toBeUndefined();
    expect(JAVELIN.save_type).toBeUndefined();
    expect(JAVELIN.escape_dc).toBeUndefined();
    expect(JAVELIN.hit_conditions).toBeUndefined();
    expect(JAVELIN.hit_condition_roll).toBeUndefined();
  });

  it('attack core untouched: attack_bonus 6, 2d6 + 4 Piercing, Hit prose still carries the Speed clause', () => {
    expect(JAVELIN.damage_dice_primary).toBe('2d6 + 4');
    expect(JAVELIN.damage_type_primary).toBe('Piercing');
    expect(JAVELIN.description).toMatch(/Hit:.*Speed decreases by 10 feet until the start of the hobgoblin's next turn/s);
  });

  it('speed_reduction is a registered te reusable with no stamped value (registry default 10 = RAW −10 ft)', () => {
    const def = getEffectDefinition('speed_reduction');
    expect(def).toBeTruthy();
    expect(def.label).toBe('Speed Reduced');
    expect(def.group).toBe('Movement');
    expect(def.fields).toEqual(['source', 'value']);
    expect(def.defaults.value).toBe(10);
  });

  it('buildHitConditionClause arms the te-only rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(JAVELIN);
    expect(clause).toEqual({
      conditions: [],
      escapeDc: null,
      attackName: 'Javelin',
      targetEffect: 'speed_reduction',
    });
  });

  it('attack half stays live: one "+6" chip, no save/DC decoy chip', () => {
    expect(attackRowMissingToHit(JAVELIN)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={JAVELIN}
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
    expect(onAttack).toHaveBeenCalledWith('Javelin', 6, expect.objectContaining({ name: 'Javelin' }));
  });
});
