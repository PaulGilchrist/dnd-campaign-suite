// MA-0838: Gibbering Mouther "Bite" — prose carries "If the target is a
// Medium or smaller creature, it has the Prone condition" but the row shipped
// WITHOUT hit_conditions, so the prone rider was structurally inert
// (buildHitConditionClause reads hit_conditions/escape_dc keys only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions
// incl. the Large-or-smaller victim gate).
// One-field DATA fix mirroring the MA-0791/MA-0802 byte-shape twin and the
// ma0807/ma0819/ma0834 template (MA-0010 seam): hit_conditions:["prone"]
// placed after damage_type_primary. No escape_dc (no escape clause). The row
// save_effect is a DECOY (attack row, no save_dc — §115) and must stay
// byte-preserved untouched. Instant-death/body-absorb clause stays
// GM-advisory (§70 — zero instant-death consumer on attack rows app-wide).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const BITE = monsters.find((m) => m.index === 'gibbering-mouther').actions[0];

describe('MA-0838 disk fingerprint: gibbering-mouther Bite prone rider fix', () => {
  it('disk row carries hit_conditions ["prone"] after damage_type_primary (MA-0791/MA-0802 byte-shape)', () => {
    expect(BITE.name).toBe('Bite');
    expect(BITE.hit_conditions).toEqual(['prone']);
    const keys = Object.keys(BITE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(BITE.attack_bonus).toBe(2);
    expect(BITE.reach).toBe('5 ft.');
    expect(BITE.damage_dice_primary).toBe('2d6');
    expect(BITE.damage_type_primary).toBe('Piercing');
  });

  it('decoy save_effect byte-preserved untouched (§115 no-save_dc decoy) and NO save fields added', () => {
    expect(BITE.save_effect).toBe('If the target is a Medium or smaller creature, it has the Prone condition. The target dies if it is reduced to 0 Hit Points by this attack. Its body is then absorbed into the mouther, leaving only equipment behind.');
    expect(BITE.escape_dc).toBeUndefined();
    expect(BITE.save_dc).toBeUndefined();
    expect(BITE.save_type).toBeUndefined();
    expect(BITE.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Prone rider with escapeDc null (was null pre-fix)', () => {
    const clause = buildHitConditionClause(BITE);
    expect(clause).toEqual({
      conditions: ['prone'],
      escapeDc: null,
      attackName: 'Bite',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+2" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(BITE)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={BITE}
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
    expect(chips).toEqual(['+2']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Bite', 2, expect.objectContaining({ name: 'Bite' }));
  });
});
