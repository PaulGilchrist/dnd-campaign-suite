// @maintained-by-ai
// MA-0930: Grick "Tentacles" grapple-rider fix — prose carries "If the target is a
// Medium or smaller creature, it has the Grappled condition (escape DC 12) from all
// four tentacles" but the row shipped WITHOUT hit_conditions/escape_dc, so the
// grapple rider was structurally inert (buildHitConditionClause reads
// hit_conditions/escape_dc keys only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions w/ MA-0553 size gate). Two-field DATA
// fix mirroring the MA-0812 byte-shape: hit_conditions ["grappled"] + escape_dc 12
// placed after damage_type_primary (no secondary-damage fields — MA-0909
// post-secondary variant N/A). Row NOT absorbed: grep 'grick' test-side lands only
// here (+ MA-0812 cross-ref header), no HIT_CLAUSE_ROWS entry
// (handlePlainDamage.hitClause.test.js:224-282) — disk bytes + clause arm owned
// here; exact-key-list toEqual also proves no save_dc/save_type/save_effect/
// hit_target_effect ever landed (attack ride, no save leg). Pruned re-derivation:
// attackRowMissingToHit direct-call (truth-table owned by MA-0286 census,
// MA-1000:39, MA-1867 mega) — the live single "+4" chip below subsumes
// non-suppression for this row. Size-gate caveat: consumer gates Large-or-smaller
// (§MA-0909) vs RAW Medium-or-smaller — MA-0812 precedent; no size fields
// fabricated. §70 advisory residuals: "all four tentacles" repetition + sustained
// grapple state-machine — single grappled grant is the ceiling.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TENTACLES = monsters.find((m) => m.index === 'grick').actions[2];

describe('MA-0930 grick Tentacles — grapple-rider fix (row not absorbed by hitClause table)', () => {
  it('disk bytes + clause arm + one live "+4" chip dispatching the exact row (no save leg)', () => {
    // fingerprint: exact key spell/order; escape_dc 12 authority = prose "(escape DC 12)"
    expect(Object.keys(TENTACLES)).toEqual(['name', 'description', 'attack_bonus', 'reach', 'damage_dice_primary', 'damage_type_primary', 'hit_conditions', 'escape_dc']);
    expect(TENTACLES.name).toBe('Tentacles');
    expect(TENTACLES.attack_bonus).toBe(4);
    expect(TENTACLES.reach).toBe('5 ft.');
    expect(TENTACLES.damage_dice_primary).toBe('1d10 + 2');
    expect(TENTACLES.damage_type_primary).toBe('Slashing');
    expect(TENTACLES.hit_conditions).toEqual(['grappled']);
    expect(TENTACLES.escape_dc).toBe(12);
    expect(TENTACLES.description).toContain('condition (escape DC 12)');
    // clause arms with escapeDc 12 (was null pre-fix — keys absent)
    expect(buildHitConditionClause(TENTACLES)).toEqual({
      conditions: ['grappled'],
      escapeDc: 12,
      attackName: 'Tentacles',
      targetEffect: null,
    });
    // component lane: one attack chip, zero save chips, exact-row identity payload (MonsterAction.jsx:480)
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TENTACLES}
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
    expect(chips).toEqual(['+4']);
    expect(container.querySelectorAll('.mc-dice-link-save-clickable')).toHaveLength(0);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Tentacles', 4, TENTACLES);
  });
});
