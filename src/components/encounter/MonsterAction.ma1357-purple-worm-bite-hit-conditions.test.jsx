// @maintained-by-ai
// MA-1357: Purple Worm "Bite" — prose carries "If the target is a Large or
// smaller creature, it has the Grappled condition (escape DC 19), and it has
// the Restrained condition until the grapple ends" but the row shipped WITHOUT
// hit_conditions/escape_dc, so the grapple rider was structurally inert
// (buildHitConditionClause reads hit_conditions/escape_dc keys only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions).
// Two-field DATA fix mirroring aberrant-cultist Tentacle Lash byte-shape
// (MA-0010): hit_conditions:["grappled","restrained"] + escape_dc:19 placed
// after damage_type_primary. Size-gate stays GM-advisory (isLargeOrSmaller-
// Target). purple-worm is NOT in handlePlainDamage.hitClause HIT_CLAUSE_ROWS
// :224-282 (grep-verified), so THIS file is the sole byte-owner: one fused
// test locks disk row keys-by-name in transport order + exact bytes (toEx-
// act toEqual absorbs the save-decoy 0/"" check and hit_target_effect ab-
// sence), then the "+14" chip press delivers that exact row through onAttack
// (identity — payload IS the disk object, MonsterAction.jsx:480 passthrough).
// Clause arm for the ["grappled","restrained"]+escapeDc shape and the attack
// suppression gate are owned generically: hitClause mega-lane data-locks via
// byte-twin aberrant-cultist Tentacle Lash :224 (escapeDc 14) + clause arm
// :289-301, suppression census ma0286:95-121 — per-census (#419, cf.
// ma0795:4-20) no local buildHitConditionClause/attackRowMissingToHit
// re-derivation here — exact-bytes + live chip are the tighter pin.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const BITE = monsters.find((m) => m.index === 'purple-worm').actions[1];

const BITE_EXACT = {
  name: 'Bite',
  description: 'Melee Attack Roll: +14, reach 10 ft. Hit: 22 (3d8 + 9) Piercing damage. If the target is a Large or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 19), and it has the <strong>Restrained</strong> condition until the grapple ends.',
  attack_bonus: 14,
  save_dc: 0,
  save_type: '',
  save_effect: '',
  range: '',
  reach: '10 ft.',
  recharge: '',
  damage_dice_primary: '3d8 + 9',
  damage_type_primary: 'Piercing',
  hit_conditions: ['grappled', 'restrained'],
  escape_dc: 19,
};

describe('MA-1357 disk fingerprint: purple-worm Bite grapple rider fix', () => {
  it('sole-owner row fingerprint + live "+14" chip presses exact row through onAttack', () => {
    // Byte-shape: keys BY NAME in transport order, hit_conditions + escape_dc
    // sit immediately after damage_type_primary (MA-0010 byte-shape twin of
    // aberrant-cultist Tentacle Lash); no save/hit_target_effect leg added.
    expect(Object.keys(BITE)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'save_dc',
      'save_type',
      'save_effect',
      'range',
      'reach',
      'recharge',
      'damage_dice_primary',
      'damage_type_primary',
      'hit_conditions',
      'escape_dc',
    ]);
    // Exact bytes: any drifted numeric, save decoy, or added/dropped key
    // breaks this one assertion (absorbs field-absence checks).
    expect(BITE).toEqual(BITE_EXACT);

    // Chip-level dispatch: exactly one "+14" attack chip (no damage chip —
    // attack_bonus arms the attack lane), press routes name/bonus/row once.
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BITE}
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
    expect(chips).toEqual(['+14']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Bite', 14, BITE_EXACT);
    // Identity: the payload IS the disk row — hit_conditions/escape_dc bytes
    // ride the attack lane untouched (no copy/strip) into the clause consumer.
    expect(onAttack.mock.calls[0][2]).toBe(BITE);
  });
});
