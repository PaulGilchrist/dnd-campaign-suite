// MA-1162: Mind Flayer "Tentacles" — description carries the grapple rider
// "If the target is a Medium or smaller creature, it has the Grappled condition
// (escape DC 14) from all the mind flayer's tentacles, and the target has the
// Stunned condition until the grapple ends." but the row shipped WITHOUT
// hit_conditions/escape_dc, so the rider was structurally inert
// (buildHitConditionClause reads the hit_conditions/escape_dc keys only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions).
// Two-field DATA fix mirroring MA-1157 (mezzoloth Claws) / MA-1161 (mimic
// Pseudopod) in-file byte-shape: hit_conditions:["grappled","stunned"] +
// escape_dc:14 placed after damage_type_primary. "until the grapple ends"
// duration stays GM-adjudicated prose (§59/§70 grapple state-machine zero
// producers — no duration fields invented). Locks: disk row shape + key
// placement, clause arms with escapeDc 14, single "+7" attack chip, DC0 decoy
// stays gated off (MA-1071 — no save chip on row).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TENTACLES = monsters.find((m) => m.index === 'mind-flayer').actions[0];

describe('MA-1162 disk fingerprint: mind-flayer Tentacles grapple/stunned rider fix', () => {
  it('description carries the raw rider prose byte-intact', () => {
    expect(TENTACLES.name).toBe('Tentacles');
    expect(TENTACLES.description).toContain('Melee Attack Roll: +7, reach 5 ft.');
    expect(TENTACLES.description).toContain('Hit: 22 (4d8 + 4) Psychic damage.');
    expect(TENTACLES.description).toContain('Grappled</strong> condition (escape DC 14)');
    expect(TENTACLES.description).toContain('Stunned</strong> condition until the grapple ends.');
  });

  it('disk row carries hit_conditions ["grappled","stunned"] + escape_dc 14 after damage_type_primary (MA-1157/MA-1161 byte-shape)', () => {
    expect(TENTACLES.hit_conditions).toEqual(['grappled', 'stunned']);
    expect(TENTACLES.escape_dc).toBe(14);
    const keys = Object.keys(TENTACLES);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(TENTACLES.attack_bonus).toBe(7);
    expect(TENTACLES.reach).toBe('5 ft.');
    expect(TENTACLES.damage_dice_primary).toBe('4d8 + 4');
    expect(TENTACLES.damage_type_primary).toBe('Psychic');
  });

  it('row has NO real save fields — save_dc 0 decoy stays gated off (MA-1071)', () => {
    expect(TENTACLES.save_dc).toBe(0);
    expect(TENTACLES.save_type).toBe('');
    expect(TENTACLES.save_effect).toBe('');
    expect(TENTACLES.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled/Stunned rider with escapeDc 14 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(TENTACLES);
    expect(clause).toEqual({
      conditions: ['grappled', 'stunned'],
      escapeDc: 14,
      attackName: 'Tentacles',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+7" chip, no DC chip, no stale suppression', () => {
    expect(attackRowMissingToHit(TENTACLES)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TENTACLES}
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
    expect(chips).toEqual(['+7']);
    expect(container.querySelectorAll('.mc-dice-link-save, .mc-dice-link-save-clickable')).toHaveLength(0);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Tentacles', 7, expect.objectContaining({ name: 'Tentacles' }));
  });
});
