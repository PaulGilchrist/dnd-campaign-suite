// @maintained-by-ai
// MA-0984: Hill Giant "Trash Lob" — the row's OWN Hit clause carries the
// Poisoned rider but the row originally authored it in the WRONG slot: a
// save_effect decoy with NO save_dc (§118 decoy fingerprint — save consumers
// are gated save_dc>0 in MonsterAction.jsx, so it was inert transport;
// buildHitConditionClause reads hit_conditions/hit_target_effect/
// hit_condition_roll only, NEVER description/save_effect). Fix:
// hit_conditions:["poisoned"] after damage_type_primary (MA-0621/MA-0763/
// MA-0877 byte-shape) + decoy dropped. Duration residual accepted per
// §59/§34 hit_conditions precedent. Fused-1 plain row (disk keys carry NO
// save fields, so no save-chip half). Runtime lane + numerics +
// buildHitConditionClause payload owned by handlePlainDamage.hitClause.test.js
// :264 (HIT_CLAUSE_ROWS :224-282) — direct helper calls pruned. Unique here:
// exact Object.keys pins byte-shape AND decoy absence (the mega table's
// `?? null` fallbacks are save-field-blind), verbatim prose, chip identity.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TRASH_LOB = monsters.find((m) => m.index === 'hill-giant').actions.find((a) => a.name === 'Trash Lob');

describe('MA-0984 hill-giant Trash Lob poisoned rider', () => {
  it('fused lock: exact disk-row bytes (decoy-free) arm the clause; one "+8" chip live, click payloads the row', () => {
    expect(Object.keys(TRASH_LOB)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'range',
      'damage_dice_primary',
      'damage_type_primary',
      'hit_conditions',
    ]);
    expect(TRASH_LOB).toEqual({
      name: 'Trash Lob',
      description: 'Ranged Attack Roll: +8, range 60/240 ft. <strong>Hit:</strong> 16 (2d10 + 5) Bludgeoning damage, and the target has the <strong>Poisoned</strong> condition until the end of its next turn.',
      attack_bonus: 8,
      range: '60/240 ft.',
      damage_dice_primary: '2d10 + 5',
      damage_type_primary: 'Bludgeoning',
      hit_conditions: ['poisoned'],
    });
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TRASH_LOB}
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
    expect(chips).toEqual(['+8']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Trash Lob', 8, TRASH_LOB);
    expect(onAttack.mock.calls[0][2]).toBe(TRASH_LOB);
  });
});
