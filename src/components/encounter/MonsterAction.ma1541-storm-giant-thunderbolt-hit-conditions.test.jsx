// @maintained-by-ai 2026-11-28
// MA-1541: Storm Giant "Thunderbolt" — prose carries "Hit: 22 (2d12 + 9)
// Lightning damage, and the target has the Blinded and Deafened conditions until
// the start of the giant's next turn" but the row shipped WITHOUT hit_conditions,
// so the rider was structurally inert (buildHitConditionClause reads
// hit_conditions/hit_target_effect/hit_condition_roll only, NEVER description;
// consumer live in handlePlainDamage.applyHitClauseConditions, granting both
// conditions + attacker-next-turn expiry clock). One-field DATA fix:
// hit_conditions:["blinded","deafened"] after damage_type_primary (MA-1534
// Boulder byte-shape twin, MA-1116 lineage). Storm-giant Thunderbolt is ABSENT
// from handlePlainDamage.hitClause.test.js "monsters.json hit-clause catalogue"
// (thunder-adjacent twins cloud-giant Thundercloud and djinni Storm Bolt are
// different rows), so this file is its sole lane: verbatim full-row disk
// fingerprint (subsumes core legs, prose anchor, range, and the
// no-save/escape/effect decoy absence), key placement, clause arm on the disk
// row, inert siblings — plus the sole MonsterAction press identity ("+14" chip).
// Pruned with owners (verified by describe-block reference 2026-11-28):
//   generic clause shapes / no-rider null arms / full-lane grant / miss flows /
//   size gate → handlePlainDamage.hitClause.test.js ("monsters.json hit-clause
//   catalogue", "rows without a hit rider never arm the lane", "hit-clause miss
//   flows (generic)", "hit-clause size gate")
//   chip suppression semantics (attackRowMissingToHit) →
//     MonsterAction.ma0286-slam-suppression.test.jsx,
//     MonsterAction.ma1071-pincer-staff-dc0-gate.test.jsx
//   storm-giant Spellcasting row → MonsterCardModal.ma0611 / ma1591 MA-1543 lock
//   storm-giant Lightning Storm cylinder row →
//     MonsterCardModal.thunderclap-sphere.test.jsx
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SG = monsters.find((m) => m.index === 'storm-giant');
const THUNDERBOLT = SG.actions.find((a) => a.name === 'Thunderbolt');
const STORM_SWORD = SG.actions.find((a) => a.name === 'Storm Sword');
const MULTI = SG.actions.find((a) => a.name === 'Multiattack');

describe('MA-1541 storm-giant Thunderbolt — tuple-miss disk fingerprint + press identity', () => {
  it('disk row: verbatim full-row fingerprint with hit_conditions ["blinded","deafened"] last after damage_type_primary, no save/escape/effect decoys, clause arms BOTH conditions, siblings inert', () => {
    expect(THUNDERBOLT).toEqual({
      name: 'Thunderbolt',
      description:
        "Ranged Attack Roll: +14, range 500 ft. Hit: 22 (2d12 + 9) Lightning damage, and the target has the Blinded and Deafened conditions until the start of the giant's next turn.",
      attack_bonus: 14,
      range: '500 ft.',
      damage_dice_primary: '2d12 + 9',
      damage_type_primary: 'Lightning',
      hit_conditions: ['blinded', 'deafened'],
    });

    // Key placement (toEqual cannot see order): the fix slot-locks after
    // damage_type_primary as the final key (MA-1534/MA-1116 byte shape).
    const keys = Object.keys(THUNDERBOLT);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys[keys.length - 1]).toBe('hit_conditions');

    // Sole buildHitConditionClause run on this row (tuple never reaches it):
    // both conditions arm, no escape clock, no target effect.
    expect(buildHitConditionClause(THUNDERBOLT)).toEqual({
      conditions: ['blinded', 'deafened'],
      escapeDc: null,
      attackName: 'Thunderbolt',
      targetEffect: null,
    });

    // The one-field fix landed on Thunderbolt only — attack siblings stay
    // inert. (The generic no-rider null guard is owned by
    // handlePlainDamage.hitClause.test.js "rows without a hit rider never
    // arm the lane".)
    expect(MULTI.hit_conditions).toBeUndefined();
    expect(STORM_SWORD.hit_conditions).toBeUndefined();
  });

  it('press identity: exactly one live "+14" chip, click dispatches Thunderbolt attack with the disk row by reference', () => {
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={THUNDERBOLT}
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
    expect(chips).toEqual(['+14']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Thunderbolt', 14, THUNDERBOLT);
    expect(onAttack.mock.calls[0][2]).toBe(THUNDERBOLT);
  });
});
