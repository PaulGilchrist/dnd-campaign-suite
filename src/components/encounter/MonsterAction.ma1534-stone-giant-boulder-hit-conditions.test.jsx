// @maintained-by-ai: 2026-10-18
// MA-1534: Stone Giant "Boulder" — prose carries "If the target is a Large or
// smaller creature, it has the Prone condition" but the row shipped WITHOUT
// hit_conditions, so the Prone rider was structurally inert (buildHitConditionClause
// reads hit_conditions/hit_target_effect/hit_condition_roll only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions with
// Large-or-smaller gate). One-field DATA fix: hit_conditions:["prone"] placed
// after damage_type_primary (MA-1116 Earthen Maul byte-shape twin).
// Stone-giant Boulder is ABSENT from handlePlainDamage.hitClause.test.js
// HIT_CLAUSE_ROWS (:224-282, stirge→vampire-spawn gap), so this file is its
// sole lane: tuple-miss deltas only — key placement, prose anchor + range
// (no table field for either), decoy noise fields, clause arm on the disk row,
// inert siblings — plus the sole MonsterAction press identity ("+9" chip).
// Generic clause shapes, full-lane grant, miss flows, and the size-gate ladder
// are owned by hitClause.test.js — never re-run here.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const SG = monsters.find((m) => m.index === 'stone-giant');
const BOULDER = SG.actions.find((a) => a.name === 'Boulder');
const CLUB = SG.actions.find((a) => a.name === 'Stone Club');
const MULTI = SG.actions.find((a) => a.name === 'Multiattack');

describe('MA-1534 stone-giant Boulder — tuple-miss disk fingerprint + press identity', () => {
  it('disk row: hit_conditions ["prone"] after damage_type_primary (last key), core legs + prose anchor byte-unchanged, no save/escape/effect noise, clause arms, siblings inert', () => {
    expect(BOULDER.hit_conditions).toEqual(['prone']);
    const keys = Object.keys(BOULDER);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys[keys.length - 1]).toBe('hit_conditions');

    // Core legs + prose anchor (range and description have NO hitClause tuple field).
    expect(BOULDER.attack_bonus).toBe(9);
    expect(BOULDER.range).toBe('60/240 ft.');
    expect(BOULDER.damage_dice_primary).toBe('2d8 + 6');
    expect(BOULDER.damage_type_primary).toBe('Bludgeoning');
    expect(BOULDER.description).toBe(
      'Ranged Attack Roll: +9, range 60/240 ft. Hit: 15 (2d8 + 6) Bludgeoning damage. If the target is a Large or smaller creature, it has the Prone condition.'
    );

    // Decoy noise: no save lane, no escape clock, no target effect authored.
    expect(BOULDER.save_dc).toBeUndefined();
    expect(BOULDER.save_type).toBeUndefined();
    expect(BOULDER.save_effect).toBeUndefined();
    expect(BOULDER.escape_dc).toBeUndefined();
    expect(BOULDER.hit_target_effect).toBeUndefined();

    // Sole buildHitConditionClause run on this row (tuple never reaches it).
    expect(buildHitConditionClause(BOULDER)).toEqual({
      conditions: ['prone'],
      escapeDc: null,
      attackName: 'Boulder',
      targetEffect: null,
    });

    // Siblings stay inert.
    expect(MULTI.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(MULTI)).toBeNull();
    expect(CLUB.hit_conditions).toBeUndefined();
    expect(buildHitConditionClause(CLUB)).toBeNull();
  });

  it('press identity: exactly one live "+9" chip, click dispatches Boulder attack with the disk row', () => {
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BOULDER}
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
    expect(onAttack).toHaveBeenCalledWith('Boulder', 9, expect.objectContaining({ name: 'Boulder' }));
  });
});
