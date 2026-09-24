// MA-0984: Hill Giant "Trash Lob" — the row's OWN Hit clause carries the
// Poisoned rider ("Hit: 16 (2d10 + 5) Bludgeoning damage, and the target
// has the Poisoned condition until the end of its next turn") but the row
// authored the rider in the WRONG slot: a structured `save_effect` with NO
// save_dc (§118 decoy fingerprint — save_effect consumers are gated
// save_dc!=null in MonsterAction.jsx / MonsterCardModal.jsx, so the field
// was inert transport; buildHitConditionClause reads hit_conditions /
// hit_target_effect / hit_condition_roll only, NEVER description/save_effect
// on the attack-hit path). Wrong-slot FAIL(a)-DATA per §410. Fix:
// hit_conditions:["poisoned"] after damage_type_primary (MA-0621/MA-0763/
// MA-0877 byte-shape) + decoy save_effect dropped. Duration residual
// ("until the end of its next turn" not clocked, GM badge removal) accepted
// per §59/§34 hit_conditions precedent.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const TRASH_LOB = monsters.find((m) => m.index === 'hill-giant').actions[2];

describe('MA-0984 disk fingerprint: hill-giant Trash Lob hit_conditions fix', () => {
  it('disk row carries hit_conditions ["poisoned"] after damage_type_primary (MA-0621/MA-0763/MA-0877 byte-shape)', () => {
    expect(TRASH_LOB.name).toBe('Trash Lob');
    expect(TRASH_LOB.attack_bonus).toBe(8);
    expect(TRASH_LOB.range).toBe('60/240 ft.');
    expect(TRASH_LOB.damage_dice_primary).toBe('2d10 + 5');
    expect(TRASH_LOB.damage_type_primary).toBe('Bludgeoning');
    expect(TRASH_LOB.hit_conditions).toEqual(['poisoned']);
    const keys = Object.keys(TRASH_LOB);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
  });

  it('decoy save_effect dropped: row carries NO save fields (no save_dc ever armed ActionSaveRoll)', () => {
    expect(TRASH_LOB.save_effect).toBeUndefined();
    expect(TRASH_LOB.save_dc).toBeUndefined();
    expect(TRASH_LOB.save_type).toBeUndefined();
    expect(TRASH_LOB.escape_dc).toBeUndefined();
    expect(TRASH_LOB.hit_target_effect).toBeUndefined();
    expect(TRASH_LOB.hit_condition_roll).toBeUndefined();
  });

  it('Hit clause prose still carries the canonical Poisoned word (rider belongs to HIT)', () => {
    expect(TRASH_LOB.description).toMatch(/Hit:.*Poisoned/s);
  });

  it('buildHitConditionClause arms the Poisoned rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(TRASH_LOB);
    expect(clause).toEqual({
      conditions: ['poisoned'],
      escapeDc: null,
      attackName: 'Trash Lob',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+8" chip, no save/DC decoy chip', () => {
    expect(attackRowMissingToHit(TRASH_LOB)).toBe(false);
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
    expect(onAttack).toHaveBeenCalledWith('Trash Lob', 8, expect.objectContaining({ name: 'Trash Lob' }));
  });
});
