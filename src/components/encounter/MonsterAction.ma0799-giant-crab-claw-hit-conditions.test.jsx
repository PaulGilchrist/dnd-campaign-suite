// @maintained-by-ai
// MA-0799: Giant Crab "Claw" — prose carries "If the target is a Medium or
// smaller creature, it has the Grappled condition (escape DC 11) from one of
// two claws" but the row shipped WITHOUT hit_conditions/escape_dc, so the
// grapple rider was structurally inert (buildHitConditionClause reads
// hit_conditions/escape_dc keys only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). Two-field DATA fix:
// hit_conditions:["grappled"] + escape_dc:11 placed after damage_type_primary
// (MA-0010 Aberrant Cultist Tentacle Lash byte-shape). giant-crab is NOT in
// handlePlainDamage.hitClause HIT_CLAUSE_ROWS :224-281 (grep-verified) and no
// other lane pins this chip, so THIS file is the sole byte-owner: one fused
// test locks disk row shape + key placement + full row bytes (exact-bytes
// toEqual absorbs the no-save-fields absence check and every numerics pin),
// then the "+3" chip press delivers that exact row through onAttack
// (identity — payload IS the disk object). Clause arm for a
// conditions+escapeDc row is owned generically by the hitClause mega-lane
// (generic clause shapes :183-216 escape_dc passthrough + table data-locks
// :289-301 via grappled-escape siblings ankheg Bite :232, bugbear-warrior
// Grab :240); per-census (#419, cf. ma0286:109) no local
// buildHitConditionClause/attackRowMissingToHit re-derivation here — exact
// bytes + live chip are the tighter pin.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const CLAW = monsters.find((m) => m.index === 'giant-crab').actions[0];

const CLAW_EXACT = {
  name: 'Claw',
  description: 'Melee Attack Roll: +3, reach 5 ft. Hit: 4 (1d6 + 1) Bludgeoning damage. If the target is a Medium or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 11) from one of two claws.',
  attack_bonus: 3,
  reach: '5 ft.',
  damage_dice_primary: '1d6 + 1',
  damage_type_primary: 'Bludgeoning',
  hit_conditions: ['grappled'],
  escape_dc: 11,
};

describe('MA-0799 disk fingerprint: giant-crab Claw grapple rider fix', () => {
  it('sole-owner row fingerprint + live "+3" chip presses exact row through onAttack', () => {
    // Byte-shape: keys BY NAME in transport order, hit_conditions + escape_dc
    // sit immediately after damage_type_primary (MA-0010 byte-shape).
    expect(Object.keys(CLAW)).toEqual([
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
    // numeric (+3 attack bonus, 5 ft. reach, 1d6 + 1 Bludgeoning, escape
    // DC 11) breaks this one assertion (absorbs field-absence).
    expect(CLAW).toEqual(CLAW_EXACT);

    // Chip-level dispatch: exactly one "+3" attack chip (no damage chip —
    // attack_bonus arms the attack lane), press routes name/bonus/row once.
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={CLAW}
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
    expect(chips).toEqual(['+3']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Claw', 3, CLAW_EXACT);
    // Identity: the payload IS the disk row — hit_conditions + escape_dc
    // bytes ride the attack lane untouched (no copy/strip) into the clause
    // consumer.
    expect(onAttack.mock.calls[0][2]).toBe(CLAW);
  });
});
