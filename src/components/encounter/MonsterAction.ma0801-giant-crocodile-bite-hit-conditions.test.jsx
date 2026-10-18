// @maintained-by-ai
// MA-0801: Giant Crocodile "Bite" — prose carries "If the target is a Large
// or smaller creature, it has the Grappled condition (escape DC 15). While
// Grappled, the target has the Restrained condition" but the row shipped
// WITHOUT hit_conditions/escape_dc, so the grapple rider was structurally
// inert (buildHitConditionClause reads hit_conditions/escape_dc keys only,
// NEVER description; consumer live in handlePlainDamage.applyHitClause-
// Conditions). Two-field DATA fix mirroring crocodile actions[0] byte-shape
// (MA-0010): hit_conditions:["grappled","restrained"] + escape_dc:15 placed
// after damage_type_primary. giant-crocodile is NOT in handlePlainDamage.hit
// Clause HIT_CLAUSE_ROWS :224-281 (grep-verified — only crocodile Bite :248
// sits there) and no other lane pins this chip (ma0802:65-74 twin-guards
// partial bytes only; its chip dispatch is Tail), so THIS file is the sole
// byte-owner: one fused test locks disk row shape + key placement + full row
// bytes (exact-bytes toEqual absorbs the no-save-fields absence check and
// every numerics pin), then the "+8" chip press delivers that exact row
// through onAttack (identity — payload IS the disk object). Clause arm for a
// conditions+escapeDc row is owned generically by the hitClause mega-lane
// (:183-301 once: generic clause shapes escape_dc passthrough + table
// data-locks via exact twin crocodile Bite :248 grappled/restrained+escape);
// no local buildHitConditionClause/attackRowMissingToHit re-derivation —
// exact bytes + live chip are the tighter pin.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const BITE = monsters.find((m) => m.index === 'giant-crocodile').actions[1];

const BITE_EXACT = {
  name: 'Bite',
  description: 'Melee Attack Roll: +8, reach 5 ft. Hit: 21 (3d10 + 5) Piercing damage. If the target is a Large or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 15). While <strong>Grappled</strong>, the target has the <strong>Restrained</strong> condition and can\'t be targeted by the crocodile\'s Tail.',
  attack_bonus: 8,
  reach: '5 ft.',
  damage_dice_primary: '3d10 + 5',
  damage_type_primary: 'Piercing',
  hit_conditions: ['grappled', 'restrained'],
  escape_dc: 15,
};

describe('MA-0801 disk fingerprint: giant-crocodile Bite grapple rider fix', () => {
  it('sole-owner row fingerprint + live "+8" chip presses exact row through onAttack', () => {
    // Byte-shape: keys BY NAME in transport order, hit_conditions + escape_dc
    // sit immediately after damage_type_primary (MA-0010 byte-shape).
    expect(Object.keys(BITE)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'damage_dice_primary',
      'damage_type_primary',
      'hit_conditions',
      'escape_dc',
    ]);
    // Exact bytes: any added save_dc/save_type/hit_target_effect or drifted
    // numeric (+8 attack bonus, 5 ft. reach, 3d10 + 5 Piercing, escape
    // DC 15) breaks this one assertion (absorbs field-absence).
    expect(BITE).toEqual(BITE_EXACT);

    // Chip-level dispatch: exactly one "+8" attack chip (no damage chip —
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
    expect(chips).toEqual(['+8']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Bite', 8, BITE_EXACT);
    // Identity: the payload IS the disk row — hit_conditions + escape_dc
    // bytes ride the attack lane untouched (no copy/strip) into the clause
    // consumer.
    expect(onAttack.mock.calls[0][2]).toBe(BITE);
  });
});
