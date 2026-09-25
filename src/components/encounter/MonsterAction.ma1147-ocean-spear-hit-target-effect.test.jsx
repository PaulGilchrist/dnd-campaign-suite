// MA-1147: Merfolk Skirmisher "Ocean Spear" — the row's OWN Hit clause
// carries the Speed-decrease rider ("If the target is a creature, its Speed
// decreases by 10 feet until the end of its next turn") but the row authored
// NO hit_target_effect, so the rider was inert (FAIL(a)/DATA — registered te
// + row lacks field = FAIL(a) full stop, MA-1125 codification of §410).
// Fix = ONE field: hit_target_effect:"speed_reduction" at the MA-0995/MA-0542
// slot (after range/reach block, before damage_dice_primary). REUSE of the
// pre-existing Movement-group te (targetEffectDefinitions.js speed_reduction,
// fields ['source','value'], defaults.value:10 = RAW −10 ft; consumed by
// conditionEffects.js te.value||10 + ConditionEffectBadges.jsx "Speed -N"
// badge). Transport: hit_target_effect passthrough (MonsterCardHelpers
// buildHitConditionClause → handlePlainDamage maybeApplyHitClause — same seam
// as MA-0995 Javelin / MA-1012 Ice Spear twins). Returning-spear clause stays
// pure flavor (MA-0905 honest-advisory family). Secondary Cold damage keys
// were already live via combined_damage_roll — byte-pinned unchanged here.
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, buildTwoHandedVariantOffer, attackRowMissingToHit } from './MonsterCardHelpers.js';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const OCEAN_SPEAR = monsters.find((m) => m.index === 'merfolk-skirmisher').actions[0];

describe('MA-1147 disk fingerprint: merfolk-skirmisher Ocean Spear hit_target_effect fix', () => {
  it('disk row carries hit_target_effect "speed_reduction" at the MA-0995/MA-0542 slot (before damage_dice_primary)', () => {
    expect(OCEAN_SPEAR.name).toBe('Ocean Spear');
    expect(OCEAN_SPEAR.attack_bonus).toBe(2);
    expect(OCEAN_SPEAR.reach).toBe('5 ft.');
    expect(OCEAN_SPEAR.range).toBe('20/60 ft.');
    expect(OCEAN_SPEAR.hit_target_effect).toBe('speed_reduction');
    const keys = Object.keys(OCEAN_SPEAR);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('damage_dice_primary') - 1);
  });

  it('speed rider prose still byte-present in the row description', () => {
    expect(OCEAN_SPEAR.description).toMatch(/its Speed decreases by 10 feet until the end of its next turn/);
    expect(OCEAN_SPEAR.description).toMatch(/The spear magically returns to the merfolk's hand/);
  });

  it('attack + secondary damage keys byte-intact (combined_damage_roll seam untouched): 1d6 Piercing + 1d4 Cold', () => {
    expect(OCEAN_SPEAR.damage_dice_primary).toBe('1d6');
    expect(OCEAN_SPEAR.damage_type_primary).toBe('Piercing');
    expect(OCEAN_SPEAR.damage_dice_secondary).toBe('1d4');
    expect(OCEAN_SPEAR.damage_type_secondary).toBe('Cold');
  });

  it('no accidental two-handed variant: damage_dice_two_handed absent → buildTwoHandedVariantOffer null (MA-1146 Spear sibling only)', () => {
    expect(OCEAN_SPEAR.damage_dice_two_handed).toBeUndefined();
    expect(buildTwoHandedVariantOffer(OCEAN_SPEAR, 'Ocean Spear')).toBeNull();
    const merfolkSpear = monsters.find((m) => m.index === 'merfolk').actions.find((a) => a.name === 'Spear');
    expect(merfolkSpear.damage_dice_two_handed).toBe('1d8');
  });

  it('save decoys stay inert: save_dc 0 / empty save_effect never arm a save rider', () => {
    expect(OCEAN_SPEAR.save_dc).toBe(0);
    expect(OCEAN_SPEAR.save_type).toBe('');
    expect(OCEAN_SPEAR.save_effect).toBe('');
    expect(OCEAN_SPEAR.hit_conditions).toBeUndefined();
    expect(OCEAN_SPEAR.hit_condition_roll).toBeUndefined();
  });

  it('speed_reduction is a registered te reusable with no stamped value (registry default 10 = RAW −10 ft)', () => {
    const def = getEffectDefinition('speed_reduction');
    expect(def).toBeTruthy();
    expect(def.label).toBe('Speed Reduced');
    expect(def.group).toBe('Movement');
    expect(def.fields).toEqual(['source', 'value']);
    expect(def.defaults.value).toBe(10);
  });

  it('buildHitConditionClause arms the te-only rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(OCEAN_SPEAR);
    expect(clause).toEqual({
      conditions: [],
      escapeDc: null,
      attackName: 'Ocean Spear',
      targetEffect: 'speed_reduction',
    });
  });

  it('attack half stays live: one "+2" chip, no save/DC decoy chip', () => {
    expect(attackRowMissingToHit(OCEAN_SPEAR)).toBe(false);
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
