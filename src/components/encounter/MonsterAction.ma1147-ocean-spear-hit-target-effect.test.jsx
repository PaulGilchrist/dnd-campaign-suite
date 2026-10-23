// MA-1147: Merfolk Skirmisher "Ocean Spear" — the row's OWN Hit clause
// carries the Speed-decrease rider ("its Speed decreases by 10 feet until the
// end of its next turn") but the row authored NO hit_target_effect, so the
// rider was inert (FAIL(a)/DATA — registered te + row lacks field = FAIL(a)
// full stop, §410/§215 family). Fix = ONE field: hit_target_effect:
// "speed_reduction" at the MA-0995/MA-0542 byte-slot (immediately before
// damage_dice_primary). REUSE of the pre-existing Movement-group te
// (defaults.value:10 = RAW −10 ft; consumed by conditionEffects.js
// te.value||10 + ConditionEffectBadges.jsx "Speed -N" badge). This row is
// ABSENT from handlePlainDamage.hitClause.test.js HIT_CLAUSE_ROWS (:224-282
// — Javelin/Ice Spear/Longbow twins present, skirmisher row not), so the
// row-scoped fingerprint + clause-arm lock below is its only per-row data
// lock; slot position is twin-byte-pinned by MA-1680 :61-62 but the VALUE
// by name is not. Secondary 1d4 Cold leg rides combined_damage_roll,
// unchanged by the fix. Returning-spear clause stays pure flavor (MA-0905).
// @maintained-by-ai — trimmed 8→2 tests: byte-slot fingerprint BY NAME
// (folded: numerics, prose, clause-arm) + chip dispatch identity only.
// Pruned with owners (verified by grep 2026-10-18):
//   registry/def pin → targetEffectDefinitions.test.js:280-308 ('speed_reduction'
//     contained; MA-0995 whitelist fields ['source','value'] + defaults.value 10)
//   consumer fold (value 10 / passthrough default, "Speed -N" badge) →
//     conditionEffectsCompute.test.js:147-161 + ConditionEffectBadges consumers
//   two-handed inert sibling + Merfolk Spear 1d8 twin →
//     MonsterCardHelpers.ma1146-merfolk-spear-two-handed.test.js:70-73
//   save/condition decoy byte pins → subsumed behaviorally by the single
//     '+2' chip list + te-only clause shape (conditions: [], escapeDc: null)
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause } from './MonsterCardHelpers.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const OCEAN_SPEAR = monsters.find((m) => m.index === 'merfolk-skirmisher').actions[0];

describe('MA-1147 merfolk-skirmisher Ocean Spear hit_target_effect fix', () => {
  it('disk row fingerprint BY NAME: numerics byte-intact, speed_reduction rider at the damage_dice_primary byte-slot, prose live, te-only clause armed', () => {
    expect(OCEAN_SPEAR).toMatchObject({
      name: 'Ocean Spear',
      attack_bonus: 2,
      reach: '5 ft.',
      range: '20/60 ft.',
      damage_dice_primary: '1d6',
      damage_type_primary: 'Piercing',
      damage_dice_secondary: '1d4',
      damage_type_secondary: 'Cold',
      hit_target_effect: 'speed_reduction',
    });
    const keys = Object.keys(OCEAN_SPEAR);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('damage_dice_primary') - 1);
    expect(OCEAN_SPEAR.description).toMatch(/its Speed decreases by 10 feet until the end of its next turn/);
    // te-only rider armed (registry default 10 = RAW −10 ft, no stamped value)
    expect(buildHitConditionClause(OCEAN_SPEAR)).toEqual({
      conditions: [],
      escapeDc: null,
      attackName: 'Ocean Spear',
      targetEffect: 'speed_reduction',
    });
  });

  it('chip dispatch identity: exactly one "+2" chip (no save/DC decoy), click fires onAttack with the Ocean Spear row', () => {
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={OCEAN_SPEAR}
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
    expect(onAttack).toHaveBeenCalledWith('Ocean Spear', 2, expect.objectContaining({ name: 'Ocean Spear' }));
  });
});
