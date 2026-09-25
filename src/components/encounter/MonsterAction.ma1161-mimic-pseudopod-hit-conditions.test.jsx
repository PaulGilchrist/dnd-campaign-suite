// MA-1161: Mimic "Pseudopod" — description carries the grapple rider "If the
// target is a Large or smaller creature, it has the Grappled condition (escape
// DC 13). Ability checks made to escape this grapple have Disadvantage." but
// the row shipped WITHOUT hit_conditions/escape_dc, so the rider was
// structurally inert (buildHitConditionClause reads the hit_conditions/
// escape_dc keys only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). Two-field DATA fix mirroring
// MA-0930 Grick Tentacles / MA-1157 Mezzoloth Claws (f0eae38e3) byte-shape:
// hit_conditions:["grappled"] + escape_dc:13 placed after
// damage_type_secondary — escape_dc is 13 per row prose, NOT the 14 twin
// value. "Ability checks made to escape this grapple have Disadvantage" is
// GM-adjudicated advisory (no transport, §70 grapple state-machine zero
// producers) — accepted, not built. Locks: disk row shape + key placement,
// clause arms with escapeDc 13, single "+5" attack chip, secondary Acid
// damage keys byte-intact, save decoys gated off (MA-1071).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const PSEUDOPOD = monsters.find((m) => m.index === 'mimic').actions[1];

describe('MA-1161 disk fingerprint: mimic Pseudopod grapple rider fix', () => {
  it('description carries the raw rider prose byte-intact', () => {
    expect(PSEUDOPOD.name).toBe('Pseudopod');
    expect(PSEUDOPOD.description).toContain('Melee Attack Roll: +5, reach 5 ft.');
    expect(PSEUDOPOD.description).toContain('Hit: 7 (1d8 + 3) Bludgeoning damage plus 4 (1d8) Acid damage.');
    expect(PSEUDOPOD.description).toContain('Grappled</strong> condition (escape DC 13)');
    expect(PSEUDOPOD.description).toContain('Ability checks made to escape this grapple have Disadvantage.');
  });

  it('disk row carries hit_conditions ["grappled"] + escape_dc 13 after damage_type_secondary (MA-0930/MA-1157 byte-shape)', () => {
    expect(PSEUDOPOD.hit_conditions).toEqual(['grappled']);
    expect(PSEUDOPOD.escape_dc).toBe(13);
    const keys = Object.keys(PSEUDOPOD);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_secondary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(PSEUDOPOD.attack_bonus).toBe(5);
    expect(PSEUDOPOD.reach).toBe('5 ft.');
  });

  it('damage axes byte-intact: primary "1d8 + 3" Bludgeoning + secondary "1d8" Acid', () => {
    expect(PSEUDOPOD.damage_dice_primary).toBe('1d8 + 3');
    expect(PSEUDOPOD.damage_type_primary).toBe('Bludgeoning');
    expect(PSEUDOPOD.damage_dice_secondary).toBe('1d8');
    expect(PSEUDOPOD.damage_type_secondary).toBe('Acid');
  });

  it('row has NO real save fields — save_dc 0 decoy stays gated off (MA-1071)', () => {
    expect(PSEUDOPOD.save_dc).toBe(0);
    expect(PSEUDOPOD.save_type).toBe('');
    expect(PSEUDOPOD.save_effect).toBe('');
    expect(PSEUDOPOD.hit_target_effect).toBeUndefined();
    expect(PSEUDOPOD.hit_condition_roll).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled rider with escapeDc 13 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(PSEUDOPOD);
    expect(clause).toEqual({
      conditions: ['grappled'],
      escapeDc: 13,
      attackName: 'Pseudopod',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+5" chip, no DC chip, no stale suppression', () => {
    expect(attackRowMissingToHit(PSEUDOPOD)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={PSEUDOPOD}
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
    expect(chips).toEqual(['+5']);
    expect(container.querySelectorAll('.mc-dice-link-save, .mc-dice-link-save-clickable')).toHaveLength(0);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Pseudopod', 5, expect.objectContaining({ name: 'Pseudopod' }));
  });
});
