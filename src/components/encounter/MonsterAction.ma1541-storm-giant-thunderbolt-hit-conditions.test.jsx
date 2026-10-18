// @maintained-by-ai: 2026-10-18 — trimmed 6→2 tests: tuple-miss disk
// fingerprint BY NAME (folded: key placement, core legs + prose anchor,
// decoy noise, clause arm, inert siblings) + sole press identity only.
// MA-1541: Storm Giant "Thunderbolt" — prose carries "Hit: 22 (2d12 + 9)
// Lightning damage, and the target has the Blinded and Deafened conditions until
// the start of the giant's next turn" but the row shipped WITHOUT hit_conditions,
// so the rider was structurally inert (buildHitConditionClause reads
// hit_conditions/hit_target_effect/hit_condition_roll only, NEVER description;
// consumer live in handlePlainDamage.applyHitClauseConditions, granting both
// conditions + attacker-next-turn expiry clock). One-field DATA fix:
// hit_conditions:["blinded","deafened"] after damage_type_primary (MA-1534
// Boulder byte-shape twin, MA-1116 lineage). Storm-giant Thunderbolt is ABSENT
// from handlePlainDamage.hitClause.test.js HIT_CLAUSE_ROWS (:224-282, honest
// tuple-read 2026-10-18 — thunder-adjacent twins cloud-giant Thundercloud :245
// and djinni Storm Bolt :257 are different rows), so this file is its sole
// lane: tuple-miss deltas only — key placement, prose anchor + range (no table
// field for either), decoy noise fields, clause arm on the disk row, inert
// siblings — plus the sole MonsterAction press identity ("+14" chip).
// Pruned with owners (verified by grep 2026-10-18):
//   generic clause shapes / null arms / full-lane grant / miss flows →
//     handlePlainDamage.hitClause.test.js (buildHitConditionClause generic
//     :183-214 + describe.each HIT_CLAUSE_ROWS :284)
//   chip suppression semantics (attackRowMissingToHit) →
//     MonsterAction.ma0286-slam-suppression.test.jsx,
//     MonsterAction.ma1071-pincer-staff-dc0-gate.test.jsx
//   storm-giant Spellcasting row → MonsterCardModal.ma1591 / ma0611 MA-1543 lock
//   storm-giant Lightning Storm cylinder row → MonsterCardModal.thunderclap-sphere.test.jsx:201
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SG = monsters.find((m) => m.index === 'storm-giant');
const THUNDERBOLT = SG.actions.find((a) => a.name === 'Thunderbolt');
const STORM_SWORD = SG.actions.find((a) => a.name === 'Storm Sword');
const MULTI = SG.actions.find((a) => a.name === 'Multiattack');

describe('MA-1541 storm-giant Thunderbolt — tuple-miss disk fingerprint + press identity', () => {
  it('disk row: hit_conditions ["blinded","deafened"] after damage_type_primary (last key), core legs + prose anchor byte-unchanged, no save/escape/effect noise, clause arms BOTH conditions, siblings inert', () => {
    expect(THUNDERBOLT.hit_conditions).toEqual(['blinded', 'deafened']);
    const keys = Object.keys(THUNDERBOLT);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys[keys.length - 1]).toBe('hit_conditions');

    // Core legs + prose anchor (range and description have NO hitClause tuple field).
    expect(THUNDERBOLT.attack_bonus).toBe(14);
    expect(THUNDERBOLT.range).toBe('500 ft.');
    expect(THUNDERBOLT.damage_dice_primary).toBe('2d12 + 9');
    expect(THUNDERBOLT.damage_type_primary).toBe('Lightning');
    expect(THUNDERBOLT.description).toBe(
      "Ranged Attack Roll: +14, range 500 ft. Hit: 22 (2d12 + 9) Lightning damage, and the target has the Blinded and Deafened conditions until the start of the giant's next turn."
    );

    // Decoy noise: no save lane, no escape clock, no target effect authored.
    expect(THUNDERBOLT.save_dc).toBeUndefined();
    expect(THUNDERBOLT.save_type).toBeUndefined();
    expect(THUNDERBOLT.save_effect).toBeUndefined();
    expect(THUNDERBOLT.escape_dc).toBeUndefined();
    expect(THUNDERBOLT.hit_target_effect).toBeUndefined();

    // Sole buildHitConditionClause run on this row (tuple never reaches it).
    expect(buildHitConditionClause(THUNDERBOLT)).toEqual({
      conditions: ['blinded', 'deafened'],
      escapeDc: null,
      attackName: 'Thunderbolt',
      targetEffect: null,
    });

    // Siblings stay inert.
    expect(MULTI.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(MULTI)).toBeNull();
    expect(STORM_SWORD.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(STORM_SWORD)).toBeNull();
  });

  it('press identity: exactly one live "+14" chip, click dispatches Thunderbolt attack with the disk row', () => {
    expect(attackRowMissingToHit(THUNDERBOLT)).toBe(false);
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
    expect(onAttack).toHaveBeenCalledWith('Thunderbolt', 14, expect.objectContaining({ name: 'Thunderbolt' }));
  });
});
