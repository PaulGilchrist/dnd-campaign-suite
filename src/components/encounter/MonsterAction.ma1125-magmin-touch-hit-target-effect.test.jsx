// @maintained-by-ai
// MA-1125: Magmin "Touch" — te-only hit lane (MA-0995 #447/#448 te-only template).
// The row's OWN Hit clause carries the burning rider ("If the target is a creature
// or a flammable object that isn't being worn or carried, it starts burning") but
// pre-fix the row authored NO hit_target_effect (§449: the hit path reads
// hit_conditions / hit_target_effect / hit_condition_roll only, NEVER description) —
// zero-producer fingerprint: live hit left cd store absent, targetEffects null,
// zero burn log entries. FAIL(a)/DATA one-field fix. This lane owns ONLY the
// by-name disk fingerprint + the chip-identity dispatch. Owners (verified,
// NOT re-derived here):
// - numerics + te-only clause shape + live grant until_start_of_next_turn with the
//   ONE attacker-anchored addExpiration clock (§37/MA-0995 twin):
//   handlePlainDamage.hitClause.test.js generic te-only clause :193-200 +
//   live-grant loop :304-362 (registerTargetEffect :341-342, clock :344-352).
//   Magmin is NOT in HIT_CLAUSE_ROWS :224-282, so this file keeps the row fingerprint.
// - registry te 'burning' (label/cls/group/fields ['source'] + GM-enforced copy):
//   targetEffectDefinitions.js:166-179, lookup loop targetEffectDefinitions.test.js:416-421;
//   MA-0673 registration pin: MonsterCardHelpers.cataclysm-rays.test.js:145-152.
// - consumer fold + badge: conditionEffectsCompute.test.js:152-160 (passthrough family).
// - attackRowMissingToHit truth table: MA-0286 owner census (ma0286:101, whole-file).
// Decoy save_dc:0/save_type:"" stay in place (MA-1071 §437 convention — the
// Number(save_dc) > 0 gate disarms the lane; strip = mass rewrite refused).
// Grant-only model accepted: recurring burn tick + flammable-object half are
// documented advisory residuals (§70/§87 — te registry alone never ticks). No timers.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TOUCH = monsters.find((m) => m.index === 'magmin').actions[0];

describe('MA-1125 magmin Touch hit_target_effect lane', () => {
  it('disk row verbatim BY NAME: hit_target_effect "burning" at the MA-0995 byte-slot (immediately before damage_dice_primary), decoy save fields in place, attack core + burning prose intact', () => {
    expect(TOUCH).toEqual({
      name: 'Touch',
      description: 'Melee Attack Roll: +4, reach 5 ft. Hit: 7 (2d4 + 2) Fire damage. If the target is a creature or a flammable object that isn\'t being worn or carried, it starts burning.',
      attack_bonus: 4,
      save_dc: 0,
      save_type: '',
      save_effect: '',
      range: '',
      reach: '5 ft.',
      recharge: '',
      hit_target_effect: 'burning',
      damage_dice_primary: '2d4 + 2',
      damage_type_primary: 'Fire',
    });
    const keys = Object.keys(TOUCH);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('damage_dice_primary') - 1);
  });

  it('MonsterAction te-only gate: exactly one "+4" chip (decoy save_dc:0 renders no save chip), press dispatches the exact Touch row', () => {
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
    const chips = [...container.querySelectorAll('.mc-dice-link')];
    expect(chips.map((c) => c.textContent.trim())).toEqual(['+4']);
    expect(container.querySelectorAll('.mc-dice-link-save-clickable').length).toBe(0);
    fireEvent.click(chips[0]);
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Touch', 4, TOUCH);
    expect(onAttack.mock.calls[0][2]).toBe(TOUCH);
  });
});
