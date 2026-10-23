// @maintained-by-ai
// MA-0775/MA-0776 FOLD HOST: Ghast Gravecaller hit_conditions rider pair —
// ONE it.each over the TWO live disk rows (Claw actions[1] + Horrific
// Necrosis actions[2]). Normalized twin-diff (fix#230 recipe): identical
// assertion shape modulo tokens (name/bonus/dice/type/condition/anchor/index;
// necrosis adds `range` key) — both are one-field hit_conditions DATA fixes
// (MA-0621/MA-0763 byte-shape, trailing after damage_type_primary) whose
// prose-carried rider was structurally inert (buildHitConditionClause reads
// hit_conditions/hit_target_effect/hit_condition_roll only, NEVER description;
// consumer live in handlePlainDamage.applyHitClauseConditions). Per-row
// literals below are disk-verbatim from the retired twin lane bytes — nothing
// invented. Sole lock for BOTH rows (host absorbed retired twin
// MonsterAction.ma0776-ghast-gravecaller-necrosis.test.jsx, canon #425
// superset ownership folded here; its former twin cross-lock note preserved:
// MA-0775 cross-lock RETIRED — absorbed by MA-0776's kept byte-shape lock,
// now this table). ghast-gravecaller is absent from the
// handlePlainDamage.hitClause.test.js HIT_CLAUSE_ROWS table, so this file is
// the only component lane pinning these two disk rows. Pruned (owners, all
// green): clause-output re-derivation (generic shapes:
// handlePlainDamage.hitClause.test.js:183-214 + :289-302 — lich/Paralyzing
// Touch :265 arms the identical ['paralyzed']/escapeDc-null clause, identical
// ['frightened'] clause byte-pinned at MA-0841 githyanki Draconic Strike —
// row INPUTs byte-pinned here); attackRowMissingToHit (MA-0286 census skips
// attack_bonus != null rows at ma0286:109; Claw armed-bonus-stays-live arm
// owned :93; derives from attack_bonus pinned below); 3-arg onAttack dispatch
// shape (MA-0294; canon MonsterAction.jsx:480 onAttack(name, bonus, row));
// save-chip plan units (MA-0927/MA-1433 — these rows carry no save fields).
// MA-1084 shallow ghast mirror verified NON-overlapping (ma1084:56-58
// mirrors only ghast-gravecaller Claw actions[1], not the necrosis row).
// No timers.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const ghast = monsters.find((m) => m.index === 'ghast-gravecaller');

// The two disk rows, fetched live (never inlined). Expected fingerprints are
// the retired MA-0775/MA-0776 lane bytes verbatim.
const FIX_ROWS = [
  {
    action: ghast.actions.find((a) => a.name === 'Claw'),
    name: 'Claw',
    keys: ['name', 'description', 'attack_bonus', 'reach', 'damage_dice_primary', 'damage_type_primary', 'hit_conditions'],
    bonus: 6,
    dice: '3d6 + 3',
    type: 'Slashing',
    hitConditions: ['paralyzed'],
    anchor: '<strong>Paralyzed</strong>',
    chip: '+6',
    index: 1,
  },
  {
    action: ghast.actions.find((a) => a.name === 'Horrific Necrosis'),
    name: 'Horrific Necrosis',
    keys: ['name', 'description', 'attack_bonus', 'reach', 'range', 'damage_dice_primary', 'damage_type_primary', 'hit_conditions'],
    bonus: 7,
    dice: '2d10 + 4',
    type: 'Necrotic',
    hitConditions: ['frightened'],
    anchor: '<strong>Frightened</strong>',
    chip: '+7',
    index: 2,
    range: '120 ft.',
  },
];

describe('MA-0775/MA-0776 ghast-gravecaller hit_conditions fix pair (fold host: 2 disk rows)', () => {
  it.each(FIX_ROWS)('$action.name: disk byte-shape carries hit_conditions $hitConditions verbatim', ({ action, name, keys, bonus, dice, type, hitConditions, anchor, range }) => {
    // Fix field + placement byte-exact (trailing key after damage_type_primary);
    // prose <strong>anchor</strong> byte-kept alongside the armed field.
    expect(Object.keys(action)).toEqual(keys);
    expect(action.name).toBe(name);
    expect(action.attack_bonus).toBe(bonus);
    expect(action.damage_dice_primary).toBe(dice);
    expect(action.damage_type_primary).toBe(type);
    expect(action.hit_conditions).toEqual(hitConditions);
    expect(action.description).toContain(anchor);
    if (range) expect(action.range).toBe(range);
  });

  it.each(FIX_ROWS)('$action.name: the single "$chip" attack chip dispatches the rider row intact', ({ action, name, bonus, chip, index }) => {
    // Attack half stays live post-fix: exactly one chip, no save/damage chip
    // arms; the exact-row payload carries hit_conditions to applyHitClauseConditions.
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={action}
        index={index}
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
    expect(chips).toEqual([chip]);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith(name, bonus, action);
  });
});
