// MA-1012: Ice Devil "Ice Spear" — the row's OWN Hit clause carries the
// rider ("Until the end of its next turn, the target can't take a Bonus
// Action or Reaction, its Speed decreases by 10 feet, and it can move or
// take one action on its turn, not both") but the row authored the rider in
// the WRONG slot: a structured `save_effect` with NO save_dc (§410/§118
// wrong-slot fingerprint — save_effect consumers are gated save_dc!=null in
// MonsterAction.jsx / MonsterCardModal.jsx; the hit path reads
// hit_conditions / hit_target_effect / hit_condition_roll only, NEVER
// description/save_effect). Wrong-slot FAIL(a)-DATA per §410.
// The rider is a multi-clause non-condition rider: speed + reaction economy
// do not fit hit_conditions, and the hit passthrough carries ONE te
// (§215 MA-0542/MA-0733 single-string shape; MA-0711 parseSlowedClauses
// arms SAVE legs only) — so the fix registers ONE composite te
// `frozen_grip` (Movement group, fields ['source','value'], defaults
// .value:10 = RAW −10 ft) whose consumers mirror the MA-0087 slowed trio
// where live: conditionEffects.js speed_reduction numeric leg
// (te.value||10 → charSummaryCalc Speed −10) + no_reactions marker
// (riderNoReactions) + ConditionEffectBadges.jsx "Speed -10" badge with the
// 'frozen_grip' remove key. The Bonus-Action block and the move-or-one-
// action-not-both economy clauses have NO consumer channel app-wide (§70) —
// honest advisory copy on the registry description + grant log. Fix: decoy
// save_effect DROPPED + hit_target_effect:"frozen_grip" authored at the
// MA-0542/MA-0733 slot (after range, before damage_dice_primary — MA-0995
// byte-twin placement). Clock: the passthrough's ONE addExpiration anchored
// on the ice devil (MA-0995 twin; RAW end-of-turn anchor is the accepted
// advisory residual, §38/MA-0542). Verified damage transport untouched.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const ICE_DEVIL = monsters.find((m) => m.name === 'Ice Devil');
const SPEAR = ICE_DEVIL.actions[1];

describe('MA-1012 disk fingerprint: Ice Devil Ice Spear hit_target_effect fix', () => {
  it('disk row carries hit_target_effect "frozen_grip" at the MA-0542/MA-0733 slot (after range, before damage_dice_primary)', () => {
    expect(SPEAR.name).toBe('Ice Spear');
    expect(SPEAR.attack_bonus).toBe(10);
    expect(SPEAR.reach).toBe('5 ft.');
    expect(SPEAR.range).toBe('30/120 ft.');
    expect(SPEAR.hit_target_effect).toBe('frozen_grip');
    const keys = Object.keys(SPEAR);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('range') + 1);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('damage_dice_primary') - 1);
  });

  it('decoy save_effect dropped: row carries NO save fields (no save_dc ever armed ActionSaveRoll)', () => {
    expect(SPEAR.save_effect).toBeUndefined();
    expect(SPEAR.save_dc).toBeUndefined();
    expect(SPEAR.save_type).toBeUndefined();
    expect(SPEAR.escape_dc).toBeUndefined();
    expect(SPEAR.hit_conditions).toBeUndefined();
    expect(SPEAR.hit_condition_roll).toBeUndefined();
  });

  it('attack core untouched: attack_bonus 10, 2d8 + 5 Piercing + 3d6 Cold structured secondary LIVE, Hit prose still carries the full rider', () => {
    expect(SPEAR.damage_dice_primary).toBe('2d8 + 5');
    expect(SPEAR.damage_type_primary).toBe('Piercing');
    expect(SPEAR.damage_dice_secondary).toBe('3d6');
    expect(SPEAR.damage_type_secondary).toBe('Cold');
    expect(SPEAR.description).toMatch(/Hit:.*2d8 \+ 5.*3d6/s);
    expect(SPEAR.description).toMatch(/can't take a Bonus Action or Reaction.*Speed decreases by 10 feet.*move or take one action.*not both/s);
    expect(SPEAR.description).toMatch(/spear magically returns/s);
  });

  it('frozen_grip is a registered te reusable with no stamped value (registry default 10 = RAW −10 ft)', () => {
    const def = getEffectDefinition('frozen_grip');
    expect(def).toBeTruthy();
    expect(def.label).toBe('Frozen Grip');
    expect(def.group).toBe('Movement');
    expect(def.fields).toEqual(['source', 'value']);
    expect(def.defaults.value).toBe(10);
  });

  it('buildHitConditionClause arms the te-only rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(SPEAR);
    expect(clause).toEqual({
      conditions: [],
      escapeDc: null,
      attackName: 'Ice Spear',
      targetEffect: 'frozen_grip',
    });
  });

  it('attack half stays live: one "+10" chip, no save/DC decoy chip', () => {
    expect(attackRowMissingToHit(SPEAR)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={SPEAR}
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
    expect(onAttack).toHaveBeenCalledWith('Ice Spear', 10, expect.objectContaining({ name: 'Ice Spear' }));
  });
});
