// MA-1402: Rug of Smothering "Smother" — RAW grapples ON HIT (escape DC
// 13, +Restrained+Blinded), NO hit-save exists, and ZERO immediate on-hit
// damage (the 2d6 + 3 is target-turn-start DoT). Pre-fix the row shipped
// save_dc/save_type/save_effect (a LIVE hit-save RAW lacks — save-fail
// sprayed the condition suite untethered from the attack) +
// damage_dice_primary "2d6 + 3" (DoT dice paid FULL on every +5 hit) while
// hit_conditions/escape_dc were ABSENT (rider inert: buildHitConditionClause
// reads those keys only, NEVER description). DATA-only fix mirroring the
// twins: hit_conditions triple + escape_dc 13 (MA-1274 otyugh grapple lane),
// save_* keys REMOVED (giant-crocodile byte-shape omits all three; save DC
// removed else the DC chip double-adjudicates §410; clause prose survives in
// description only), damage_* REMOVED (roper Tentacle MA-1400 byte-shape
// drops BOTH damage keys on its damageless row). The rider then rides the
// MA-1400 dice-less '0' auto-damage arm. Locks: disk row shape, clause arms
// all three conditions with escapeDc 13, no save lane, zero damage stays
// unauthored, "+5" chip is the single affordance (no DC chip, no damage chip).
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
const RUG = monsters.find((m) => m.index === 'rug-of-smothering');
const SMOTHER = RUG.actions[0];

describe('MA-1402 disk fingerprint: rug-of-smothering Smother grapple-rider fix', () => {
  it('disk row carries hit_conditions ["grappled","restrained","blinded"] + escape_dc 13 after reach', () => {
    expect(RUG.name).toBe('Rug of Smothering');
    expect(SMOTHER.name).toBe('Smother');
    expect(SMOTHER.hit_conditions).toEqual(['grappled', 'restrained', 'blinded']);
    expect(SMOTHER.escape_dc).toBe(13);
    const keys = Object.keys(SMOTHER);
    expect(keys.indexOf('hit_conditions')).toBe(keys.indexOf('reach') + 1);
    expect(keys.indexOf('escape_dc')).toBe(keys.indexOf('hit_conditions') + 1);
    expect(SMOTHER.attack_bonus).toBe(5);
    expect(SMOTHER.reach).toBe('5 ft.');
  });

  it('zero-damage bytes: NO damage keys authored (MA-1400 roper twin drops both); prose DoT 2d6 + 3 cannot re-arm via scrape (needs "Hit: N (XdY)")', () => {
    expect(SMOTHER.damage_dice_primary).toBeUndefined();
    expect(SMOTHER.damage_type_primary).toBeUndefined();
    expect(SMOTHER.damage_dice_secondary).toBeUndefined();
    expect(SMOTHER.damage_type_secondary).toBeUndefined();
    expect(SMOTHER.flat_damage_secondary).toBeUndefined();
    expect(SMOTHER.description).toContain('escape DC 13');
    expect(SMOTHER.description).toContain('2d6 + 3');
  });

  it('row carries NO save lane: save_dc/save_type/save_effect keys REMOVED (giant-crocodile Bite byte-shape omits all three)', () => {
    expect(SMOTHER.save_dc).toBeUndefined();
    expect(SMOTHER.save_type).toBeUndefined();
    expect(SMOTHER.save_effect).toBeUndefined();
    expect(SMOTHER.hit_target_effect).toBeUndefined();
  });

  it('buildHitConditionClause arms the Grappled/Restrained/Blinded rider with escapeDc 13 (was null pre-fix)', () => {
    const clause = buildHitConditionClause(SMOTHER);
    expect(clause).toEqual({
      conditions: ['grappled', 'restrained', 'blinded'],
      escapeDc: 13,
      attackName: 'Smother',
      targetEffect: null,
    });
  });

  it('MA-1400 dispatch arm: damageless clause row rides dice-less "0" so the resolved hit reaches maybeApplyHitClause', () => {
    const opts = buildAutoDamageOptions(SMOTHER, 'Smother');
    expect(opts.autoDamageFormula).toBe('0');
    expect(opts.hitClause).toEqual({
      conditions: ['grappled', 'restrained', 'blinded'],
      escapeDc: 13,
      attackName: 'Smother',
      targetEffect: null,
    });
  });

  it('attack half stays live: one "+5" chip ONLY — no DC chip (save lane gone), no damage chip', () => {
    expect(attackRowMissingToHit(SMOTHER)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={SMOTHER}
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
    expect(chips).toEqual(['+5']);
    expect(container.querySelector('.mc-dice-link-save-clickable')).toBeNull();
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Smother', 5, expect.objectContaining({ name: 'Smother' }));
  });
});
