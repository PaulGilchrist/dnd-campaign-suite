// @maintained-by-ai
// MA-0829: Giant Squid "Tentacle" — prose carries "If the target is a Huge
// or smaller creature, it has the Grappled condition (escape DC 16) from one
// of two tentacles" but the row shipped WITHOUT hit_conditions/escape_dc, so
// the grapple rider was structurally inert (buildHitConditionClause reads
// hit_conditions/escape_dc keys only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). Two-field DATA fix mirroring
// the giant-frog/giant-octopus twins (MA-0807/MA-0812, MA-0010 seam):
// hit_conditions:["grappled"] + escape_dc:16 placed after damage_type_primary
// (DC 16 = 8 + STR 6 + PB 2, description authority). Pull-10ft clause is
// §70 advisory (zero consumer app-wide) — not fabricated.
// giant-squid is NOT in handlePlainDamage.hitClause HIT_CLAUSE_ROWS
// :224-282 (grep-verified — only the giant-octopus twin sits at :261) and
// no other lane pins these Tentacle bytes (the only other giant-squid lock
// is monsterSelfAura.giant-ink-cloud — a distinct Ink Cloud reaction row),
// so THIS file is the sole byte-owner: one fused test locks disk row shape +
// key placement + full row bytes (exact-bytes toEqual absorbs the no-save-
// fields absence check and every numerics pin), then the "+9" chip press
// delivers that exact row through onAttack (identity — payload IS the disk
// object). Clause arm for a conditions+escapeDc row is owned generically by
// the hitClause mega-lane (:183-334 once: generic clause shapes escape_dc
// passthrough + table data-locks via exact twins crocodile/ankheg/otyugh
// grappled+escape); no local buildHitConditionClause/attackRowMissingToHit
// re-derivation — exact bytes + live chip are the tighter pin.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TENTACLE = monsters.find((m) => m.index === 'giant-squid').actions[2];

const TENTACLE_EXACT = {
  name: 'Tentacle',
  description: 'Melee Attack Roll: +9, reach 15 ft. Hit: 19 (3d8 + 6) Bludgeoning damage. If the target is a Huge or smaller creature, it has the <strong>Grappled</strong> condition (escape DC 16) from one of two tentacles, and the squid can pull the target up to 10 feet straight toward itself.',
  attack_bonus: 9,
  reach: '15 ft.',
  damage_dice_primary: '3d8 + 6',
  damage_type_primary: 'Bludgeoning',
  hit_conditions: ['grappled'],
  escape_dc: 16,
};

describe('MA-0829 disk fingerprint: giant-squid Tentacle grapple rider fix', () => {
  it('sole-owner row fingerprint + live "+9" chip presses exact row through onAttack', () => {
    // Byte-shape: keys BY NAME in transport order, hit_conditions + escape_dc
    // sit immediately after damage_type_primary (MA-0010 byte-shape).
    expect(Object.keys(TENTACLE)).toEqual([
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
    // numeric (+9 attack bonus, 15 ft. reach, 3d8 + 6 Bludgeoning, escape
    // DC 16) breaks this one assertion (absorbs field-absence).
    expect(TENTACLE).toEqual(TENTACLE_EXACT);

    // Chip-level dispatch: exactly one "+9" attack chip (no damage chip —
    // attack_bonus arms the attack lane), press routes name/bonus/row once.
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TENTACLE}
        index={2}
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
    expect(chips).toEqual(['+9']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Tentacle', 9, TENTACLE_EXACT);
    // Identity: the payload IS the disk row — hit_conditions + escape_dc
    // bytes ride the attack lane untouched (no copy/strip) into the clause
    // consumer.
    expect(onAttack.mock.calls[0][2]).toBe(TENTACLE);
  });
});
