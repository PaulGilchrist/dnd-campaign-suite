// @maintained-by-ai
// MA-1389: Remorhaz "Bite" — prose carries "If the target is a Large or
// smaller creature, it has the Grappled condition (escape DC 17), and it has
// the Restrained condition until the grapple ends" but the row shipped WITHOUT
// hit_conditions/escape_dc, so the grapple rider was structurally inert
// (buildHitConditionClause reads hit_conditions/escape_dc keys only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions).
// Two-field DATA fix mirroring purple-worm Bite / aberrant-cultist Tentacle
// Lash byte-shape (MA-1357/MA-0010): hit_conditions:["grappled","restrained"]
// + escape_dc:17 — disk keys decide shape, so here they sit after
// damage_type_secondary (this row carries a 4d6 Fire secondary leg). Disk
// prose DC 17 is canonical (disk-is-truth §3; 8+PB+STR would be 19 — NOT
// recomputed). Size-gate stays GM-advisory (isLargeOrSmallerTarget).
// remorhaz is NOT in handlePlainDamage.hitClause HIT_CLAUSE_ROWS :224-282
// (grep-verified), so THIS file is the sole byte-owner: one fused test locks
// disk row keys BY NAME in transport order + exact bytes (exact toEqual
// absorbs name/reach/attack_bonus, damage+secondary byte-unchanged, the
// save-decoy 0/"" check and hit_target_effect absence), then the "+11" chip
// press delivers that exact row through onAttack (identity — payload IS the
// disk object, MonsterAction.jsx:480 passthrough). Clause arm for the
// ["grappled","restrained"]+escapeDc shape and the attack suppression gate are
// owned generically: hitClause mega-lane data-locks via byte-twin
// aberrant-cultist Tentacle Lash :225 (escapeDc 14) + clause arm :296,
// suppression census ma0286:95-121 — per-census (#419, cf. ma1357:17-22) no
// local buildHitConditionClause/attackRowMissingToHit re-derivation here —
// exact-bytes + live chip are the tighter pin.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const BITE = monsters.find((m) => m.index === 'remorhaz').actions[0];

const BITE_EXACT = {
  name: 'Bite',
  description: 'Melee Attack Roll: +11, reach 10 ft. Hit: 18 (2d10 + 7) Piercing damage plus 14 (4d6) Fire damage. If the target is a Large or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 17), and it has the <strong>Restrained</strong> condition until the grapple ends.',
  attack_bonus: 11,
  save_dc: 0,
  save_type: '',
  save_effect: '',
  range: '',
  reach: '10 ft.',
  recharge: '',
  damage_dice_primary: '2d10 + 7',
  damage_type_primary: 'Piercing',
  damage_dice_secondary: '4d6',
  damage_type_secondary: 'Fire',
  hit_conditions: ['grappled', 'restrained'],
  escape_dc: 17,
};

describe('MA-1389 disk fingerprint: remorhaz Bite grapple rider fix', () => {
  it('sole-owner row fingerprint + live "+11" chip presses exact row through onAttack', () => {
    // Byte-shape: keys BY NAME in transport order, hit_conditions + escape_dc
    // sit immediately after damage_type_secondary (MA-0010 byte-shape adapted
    // to this row's secondary-fire leg); no save/hit_target_effect leg added.
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
      'damage_dice_secondary',
      'damage_type_secondary',
      'hit_conditions',
      'escape_dc',
    ]);
    // Exact bytes: any drifted numeric, save decoy, or added/dropped key
    // breaks this one assertion (absorbs field-absence checks).
    expect(BITE).toEqual(BITE_EXACT);

    // Chip-level dispatch: exactly one "+11" attack chip (no damage chip —
    // attack_bonus arms the attack lane), press routes name/bonus/row once.
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BITE}
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
    expect(chips).toEqual(['+11']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Bite', 11, BITE_EXACT);
    // Identity: the payload IS the disk row — hit_conditions/escape_dc bytes
    // ride the attack lane untouched (no copy/strip) into the clause consumer.
    expect(onAttack.mock.calls[0][2]).toBe(BITE);
  });
});
