// @maintained-by-ai
// MA-0995: Hobgoblin Warlord "Javelin" — target-effect-ONLY hit lane. The row's
// OWN Hit clause carries the Speed-decrease rider ("Hit: 11 (2d6 + 4) Piercing
// damage, and the target's Speed decreases by 10 feet until the start of the
// hobgoblin's next turn"); pre-fix the rider sat in the WRONG slot as a save_dc-less
// save_effect (§410/§118 decoy family — hit path reads hit_conditions /
// hit_target_effect / hit_condition_roll only). Fix = decoy dropped +
// hit_target_effect:"speed_reduction" authored at the §215 MA-0542/MA-0733
// byte-slot (after range, before damage_dice_primary). This lane owns the
// by-name disk fingerprint + gate order + chip dispatch identity.
// Owners (verified, NOT re-derived here):
// - numerics + clause shape + live grant: handlePlainDamage.hitClause.test.js
//   HIT_CLAUSE_ROWS:262 ['hobgoblin-warlord','Javelin',6,'2d6 + 4','Piercing',
//   [],null,'speed_reduction'] + loop :289-301 (pins buildHitConditionClause
//   te-only clause; te-only arm generic shape :193-199).
// - registry te (label/group/fields/defaults.value 10 = RAW −10 ft):
//   targetEffectDefinitions.test.js:296-302 (MA-0995 whitelist pin); consumer
//   te.value||10 default: conditionEffectsCompute.test.js:155-158 (MA-0995).
// - javelin "before damage_dice_primary" byte twin: ma1680 test :58-63.
// - attackRowMissingToHit truth table: MA-0286 census :89.
// Duration stays attacker-anchored until_start_of_next_turn via
// applyHitClauseTargetEffect — no invented clock (§37).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const JAVELIN = monsters.find((m) => m.index === 'hobgoblin-warlord').actions.find((a) => a.name === 'Javelin');

describe('MA-0995 hobgoblin-warlord Javelin hit_target_effect lane', () => {
  it('disk row verbatim BY NAME: hit_target_effect "speed_reduction" at the §215 byte-slot, decoy save fields dropped, RAW Speed prose intact', () => {
    expect(JAVELIN).toEqual({
      name: 'Javelin',
      description: 'Melee or Ranged Attack Roll: +6, reach 5 ft. or range 30/120 ft. <strong>Hit:</strong> 11 (2d6 + 4) Piercing damage, and the target\'s Speed decreases by 10 feet until the start of the hobgoblin\'s next turn.',
      attack_bonus: 6,
      reach: '5 ft.',
      range: '30/120 ft.',
      hit_target_effect: 'speed_reduction',
      damage_dice_primary: '2d6 + 4',
      damage_type_primary: 'Piercing',
    });
    const keys = Object.keys(JAVELIN);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('range') + 1);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('damage_dice_primary') - 1);
  });

  it('MonsterAction te-only gate: exactly one "+6" chip (no save/DC decoy), press dispatches the exact Javelin row', () => {
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
    const chips = [...container.querySelectorAll('.mc-dice-link')];
    expect(chips.map((c) => c.textContent.trim())).toEqual(['+6']);
    fireEvent.click(chips[0]);
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Javelin', 6, JAVELIN);
    expect(onAttack.mock.calls[0][2]).toBe(JAVELIN);
  });
});
