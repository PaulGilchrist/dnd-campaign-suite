// @maintained-by-ai
// MA-1402: Rug of Smothering "Smother" — RAW grapples ON HIT (escape DC 13,
// +Restrained+Blinded), NO hit-save exists, and ZERO immediate on-hit damage
// (the 2d6 + 3 is target-turn-start DoT). Pre-fix the row shipped
// save_dc/save_type/save_effect (a LIVE hit-save RAW lacks — the DC chip
// double-adjudicates §410) + damage_dice_primary "2d6 + 3" (DoT dice paid
// FULL on every +5 hit) while hit_conditions/escape_dc were ABSENT (rider
// inert: buildHitConditionClause reads those keys only, NEVER description).
// DATA-only fix mirroring the twins: hit_conditions triple + escape_dc 13
// after reach (MA-1274 otyugh grapple lane), save_*/damage_* REMOVED
// (MA-1400 roper byte-shape drops BOTH damage keys on its damageless row;
// giant-crocodile byte-shape omits all three save keys), clause prose lives
// in description only. The rider then rides the MA-1400 dice-less '0'
// auto-damage arm. rug-of-smothering is NOT in handlePlainDamage.hitClause
// HIT_CLAUSE_ROWS :224-282 (grep-verified — only the damaging animated-rug
// twin sits there), so THIS file is the sole byte-owner: fused test 1 locks
// disk row keys BY NAME in transport order + exact bytes (exact toEqual
// absorbs name/reach/attack_bonus, damage/save-key absence and the prose DoT
// + escape-DC provenance) and the "+5" chip press delivers that exact row
// through onAttack (identity — payload IS the disk object, MonsterAction.jsx
// passthrough). Test 2 owns the MA-1400 dispatch arm cited byte-twin-strong
// by the roper file (:72-81 guard region — kept). Generic clause arm/
// suppression census hitClause.test.js:284+/ma0286:95-121 — no local
// buildHitConditionClause/attackRowMissingToHit re-derivation (#419).
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildAutoDamageOptions } from './MonsterCardModal.jsx';

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const RUG = monsters.find((m) => m.index === 'rug-of-smothering');
const SMOTHER = RUG.actions[0];

const SMOTHER_EXACT = {
  name: 'Smother',
  description: 'Melee Weapon Attack: +5 to hit, reach 5 ft., one Medium or smaller creature. Hit: The creature is grappled (escape DC 13). Until this grapple ends, the target is restrained, blinded, and at risk of suffocating, and the rug can\'t smother another target. In addition, at the start of each of the target\'s turns, the target takes 10 (2d6 + 3) bludgeoning damage.',
  attack_bonus: 5,
  reach: '5 ft.',
  hit_conditions: ['grappled', 'restrained', 'blinded'],
  escape_dc: 13,
};

describe('MA-1402 disk fingerprint: rug-of-smothering Smother grapple-rider fix', () => {
  it('sole-owner row fingerprint + live "+5" chip presses exact row through onAttack', () => {
    // Keys BY NAME in transport order — hit_conditions triple + escape_dc sit
    // immediately after reach (MA-1274 byte-shape). Exact bytes absorb the
    // former per-key locks: any drifted numeric, re-added save decoy,
    // re-armed damage_dice_primary, or dropped rider key breaks toEqual.
    expect(SMOTHER).toEqual(SMOTHER_EXACT);
    expect(Object.keys(SMOTHER)).toEqual([
      'name',
      'description',
      'attack_bonus',
      'reach',
      'hit_conditions',
      'escape_dc',
    ]);

    // Chip-level dispatch: exactly one "+5" attack chip (no DC chip — save
    // lane gone; no damage chip — zero damage authored), press routes the
    // exact row once, identity untouched into the clause consumer.
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
    expect(onAttack).toHaveBeenCalledTimes(1);
    expect(onAttack).toHaveBeenCalledWith('Smother', 5, SMOTHER_EXACT);
    expect(onAttack.mock.calls[0][2]).toBe(SMOTHER);
  });

  it('MA-1400 dispatch arm: damageless clause row rides dice-less "0" so the resolved hit reaches maybeApplyHitClause', () => {
    const opts = buildAutoDamageOptions(SMOTHER, 'Smother');
    expect(opts.autoDamageFormula).toBe('0');
    // Exact clause (buildHitConditionClause re-derivation inside
    // MonsterCardModal.jsx:1156 absorbs the former standalone call; armed
    // clause ⇒ '0' arm is the byte-twin guard leg the roper file cites).
    expect(opts.hitClause).toEqual({
      conditions: ['grappled', 'restrained', 'blinded'],
      escapeDc: 13,
      attackName: 'Smother',
      targetEffect: null,
    });
  });
});
