// MA-1397: Roc "Talons" — prose carries "If the target is a Huge or smaller
// creature, it has the Grappled condition (escape DC 19) from both talons, and
// it has the Restrained condition until the grapple ends" but the row shipped
// WITHOUT hit_conditions/escape_dc, so the grapple rider was structurally inert
// (buildHitConditionClause reads hit_conditions/escape_dc keys only, NEVER
// description; consumer live in handlePlainDamage.applyHitClauseConditions).
// Two-field DATA fix mirroring purple-worm Bite / remorhaz Bite byte-shape
// (MA-1357/MA-1389): hit_conditions:["grappled","restrained"] + escape_dc:19
// placed after damage_type_primary. Disk prose DC 19 is canonical (disk-is-truth
// §3; 8+PB+STR would also be 19 — NOT recomputed). "From both talons"
// count-stacking and size-gate stay GM-advisory. Locks: disk row shape + key
// placement, clause arms both conditions with escapeDc 19, damage bytes
// byte-unchanged, "+13" attack chip stays live, save decoys stay 0/"".
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const ROC = monsters.find((m) => m.index === 'roc');
const TALONS = ROC.actions[2];

describe('MA-1397 disk fingerprint: roc Talons grapple rider fix', () => {
  it('disk row carries hit_conditions ["grappled","restrained"] + escape_dc 19 after damage_type_primary (MA-1357/MA-1389 byte-shape)', () => {
    expect(ROC.name).toBe('Roc');
    expect(TALONS.name).toBe('Talons');
    expect(TALONS.hit_conditions).toEqual(['grappled', 'restrained']);
    expect(TALONS.escape_dc).toBe(19);
    const keys = Object.keys(TALONS);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('damage_type_primary') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(TALONS.attack_bonus).toBe(13);
    expect(TALONS.reach).toBe('5 ft.');
  });

  it('damage bytes byte-unchanged', () => {
    expect(TALONS.damage_dice_primary).toBe('4d6 + 9');
    expect(TALONS.damage_type_primary).toBe('Slashing');
    expect(TALONS.damage_dice_secondary).toBeUndefined();
    expect(TALONS.damage_type_secondary).toBeUndefined();
  });

  it('row carries NO save leg (attack-only ride, decoy save keys stay 0/"")', () => {
    expect(TALONS.save_dc).toBe(0);
    expect(TALONS.save_type).toBe('');
    expect(TALONS.save_effect).toBe('');
    expect(TALONS.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled/Restrained rider with escapeDc 19 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(TALONS);
    expect(clause).toEqual({
      conditions: ['grappled', 'restrained'],
      escapeDc: 19,
      attackName: 'Talons',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+13" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(TALONS)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TALONS}
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
    expect(chips).toEqual(['+13']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Talons', 13, expect.objectContaining({ name: 'Talons' }));
  });
});
