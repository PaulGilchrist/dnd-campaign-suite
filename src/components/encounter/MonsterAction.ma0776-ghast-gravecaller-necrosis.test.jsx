// @maintained-by-ai
// MA-0776: Ghast Gravecaller "Horrific Necrosis" — prose carries "Hit: ...
// the target has the Frightened condition" but the row shipped WITHOUT
// hit_conditions, so the condition rider was structurally inert
// (buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description; consumer live in
// handlePlainDamage.applyHitClauseConditions). One-field DATA fix:
// hit_conditions:["frightened"] (MA-0621/MA-0763/MA-0775 byte-shape, placed
// after damage_type_primary). Sole lock (canon #425: MA-0776 self-owns this
// row superset; MA-0775's twin cross-lock RETIRED pointing here): this file
// is the only lane pinning the necrosis disk row — ghast-gravecaller is
// absent from the handlePlainDamage.hitClause.test.js HIT_CLAUSE_ROWS table —
// so keep the full byte-shape fingerprint + the "+7" attack-chip render whose
// exact-row click payload carries hit_conditions intact to the attack seam.
// Pruned (owners, all green): clause-output re-derivation (generic shapes:
// handlePlainDamage.hitClause.test.js:183-214 arms/empties + :296-301
// data-lock arm via the same helper; identical ['frightened']/escapeDc-null
// clause from a hit_conditions row byte-pinned at MA-0841 githyanki
// Draconic Strike — row INPUT byte-pinned here); attackRowMissingToHit false
// (this row ESCAPES the MA-0286 suppression census — attack_bonus != null
// rows skipped at ma0286:109, armed-bonus-stays-live arm owned :93; derives
// from attack_bonus:7 pinned below); 3-arg onAttack dispatch shape (MA-0294;
// canon MonsterAction.jsx:480 onAttack(name, bonus, row)). MA-1084 shallow
// ghast mirror verified NON-overlapping (ma1084:56-58 mirrors only
// ghast-gravecaller Claw actions[1], not this actions[2] necrosis row).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const NECROSIS = monsters.find((m) => m.index === 'ghast-gravecaller').actions[2];

describe('MA-0776 ghast-gravecaller Horrific Necrosis hit_conditions fix', () => {
  it('disk byte-shape carries hit_conditions ["frightened"] and the single "+7" chip dispatches the rider row intact', () => {
    // Fix field + placement byte-exact (trailing key after damage_type_primary);
    // prose <strong>Frightened</strong> anchor byte-kept alongside the armed field.
    expect(Object.keys(NECROSIS)).toEqual([
      'name', 'description', 'attack_bonus', 'reach', 'range', 'damage_dice_primary', 'damage_type_primary',
      'hit_conditions',
    ]);
    expect(NECROSIS.name).toBe('Horrific Necrosis');
    expect(NECROSIS.attack_bonus).toBe(7);
    expect(NECROSIS.reach).toBe('5 ft.');
    expect(NECROSIS.range).toBe('120 ft.');
    expect(NECROSIS.damage_dice_primary).toBe('2d10 + 4');
    expect(NECROSIS.damage_type_primary).toBe('Necrotic');
    expect(NECROSIS.hit_conditions).toEqual(['frightened']);
    expect(NECROSIS.description).toContain('<strong>Frightened</strong>');

    // Attack half stays live post-fix: exactly one chip, no save/damage chip
    // arms; the exact-row payload carries hit_conditions to applyHitClauseConditions.
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={NECROSIS}
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
    expect(chips).toEqual(['+7']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Horrific Necrosis', 7, NECROSIS);
  });
});
