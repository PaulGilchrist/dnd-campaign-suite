// MA-1400: Roper "Tentacle" — prose carries "Hit: The target has the
// Grappled condition (escape DC 14) … and the target has the Poisoned
// condition until the grapple ends" but the row shipped WITHOUT
// hit_conditions/escape_dc, so the rider was inert (buildHitConditionClause
// reads hit_conditions/escape_dc keys only, NEVER description). Two-field
// DATA fix (MA-1274 otyugh / MA-0010 byte-shape, escape_dc 14 = exact
// aberrant-cultist/chain-devil/mezzoloth DC-14 co-key) — plus the minimal
// MA-1400 code arm: this row authors ZERO damage, and buildAutoDamage
// (useLoggedDiceRollAttack.js) gated Done-dispatch on autoDamageFormula, so
// no damageless row EVER reached handlePlainDamage.maybeApplyHitClause (all
// 76 pre-fix hit_conditions rows in the DB carry damage dice — the seam was
// never proven damageless). buildAutoDamageOptions now arms a dice-less
// constant '0' (MA-0322 flat lineage) ONLY when a hit-clause stands without
// a formula; the clause consumer is zero-damage tolerant
// (applyDamageToTarget(0) passes isUsableRawDamage → non-null applyResult).
// Locks: disk row shape, clause arms BOTH conditions with escapeDc 14, zero
// damage stays unauthored byte-unchanged, dispatch arm rides '0', "+7" chip
// stays the single affordance, save decoys stay 0/"".
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildAutoDamageOptions } from './MonsterCardModal.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const ROPER = monsters.find((m) => m.index === 'roper');
const TENTACLE = ROPER.actions[2];

describe('MA-1400 disk fingerprint: roper Tentacle grapple+poison rider fix', () => {
  it('disk row carries hit_conditions ["grappled","poisoned"] + escape_dc 14 after recharge (MA-1274 trailing byte-shape)', () => {
    expect(ROPER.name).toBe('Roper');
    expect(TENTACLE.name).toBe('Tentacle');
    expect(TENTACLE.hit_conditions).toEqual(['grappled', 'poisoned']);
    expect(TENTACLE.escape_dc).toBe(14);
    const keys = Object.keys(TENTACLE);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('recharge') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(TENTACLE.attack_bonus).toBe(7);
    expect(TENTACLE.reach).toBe('60 ft.');
  });

  it('zero-damage bytes stay byte-unchanged: NO damage keys authored, prose DC 14 canonical', () => {
    expect(TENTACLE.damage_dice_primary).toBeUndefined();
    expect(TENTACLE.damage_type_primary).toBeUndefined();
    expect(TENTACLE.damage_dice_secondary).toBeUndefined();
    expect(TENTACLE.damage_type_secondary).toBeUndefined();
    expect(TENTACLE.flat_damage_secondary).toBeUndefined();
    expect(TENTACLE.description).toContain('escape DC 14');
  });

  it('row carries NO save leg (attack-only ride, decoy save keys stay 0/"")', () => {
    expect(TENTACLE.save_dc).toBe(0);
    expect(TENTACLE.save_type).toBe('');
    expect(TENTACLE.save_effect).toBe('');
    expect(TENTACLE.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled/Poisoned rider with escapeDc 14 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(TENTACLE);
    expect(clause).toEqual({
      conditions: ['grappled', 'poisoned'],
      escapeDc: 14,
      attackName: 'Tentacle',
      targetEffect: null,
    });
  });

  it('MA-1400 dispatch arm: damageless clause row rides dice-less "0" so the resolved hit reaches maybeApplyHitClause', () => {
    const opts = buildAutoDamageOptions(TENTACLE, 'Tentacle');
    expect(opts.autoDamageFormula).toBe('0');
    expect(opts.hitClause).toEqual({
      conditions: ['grappled', 'poisoned'],
      escapeDc: 14,
      attackName: 'Tentacle',
      targetEffect: null,
    });
    // Byte-inert guard: damageless rows WITHOUT a clause stay null (zero
    // affordance unchanged); damageless roper Bite twin has damage dice.
    expect(buildAutoDamageOptions(ROPER.actions[3], 'Reel').autoDamageFormula).toBeNull();
    expect(buildAutoDamageOptions(ROPER.actions[1], 'Bite').autoDamageFormula).toBe('3d8 + 4');
  });

  it('attack half stays live: one "+7" chip, no stale suppression', () => {
    expect(attackRowMissingToHit(TENTACLE)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={TENTACLE}
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
    expect(onAttack).toHaveBeenCalledWith('Tentacle', 7, expect.objectContaining({ name: 'Tentacle' }));
  });
});
