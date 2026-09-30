// MA-1680: Warrior Commander "Longbow" — the row's OWN Hit clause carries
// the Speed-decrease rider ("Hit: 18 (3d8 + 5) Piercing damage, and the
// target's Speed decreases by 10 feet until the end of the target's next
// turn") but the row authored NO hit_target_effect, so the rider was inert
// (FAIL(a)/DATA — registered te + row lacks field = FAIL(a) full stop, §215
// codification; NOT §70 advisory — attack-row live lane). Fix = ONE field:
// hit_target_effect:"speed_reduction" at the MA-0995/MA-1147 twin byte-slot
// (after range, before damage_dice_primary). REUSE of the pre-existing
// Movement-group te (targetEffectDefinitions.js speed_reduction, fields
// ['source','value'], defaults.value:10 = RAW −10 ft; consumed by
// conditionEffects.js te.value||10 + ConditionEffectBadges.jsx "Speed -N"
// badge). Transport: hit_target_effect passthrough (buildHitConditionClause →
// applyHitClauseTargetEffect in handlePlainDamage.js) — same seam as the
// MA-0995 hobgoblin-warlord Javelin / MA-1147 merfolk-skirmisher Ocean Spear
// FIXED twins. RAW "end of the target's next turn" anchor stays the
// MA-0542/MA-0995 accepted advisory residual (passthrough expires
// attacker-anchored until_start_of_next_turn). Greatsword sibling shares the
// "+9" bonus — row-scoped startsWith('Longbow') twin lock (§693).
import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { MonsterAction } from './MonsterAction.jsx';
import { buildHitConditionClause, attackRowMissingToHit } from './MonsterCardHelpers.js';
import { getEffectDefinition } from '../../services/combat/conditions/targetEffectDefinitions.js';
import { computeConditionEffects } from '../../services/combat/conditions/conditionEffects.js';
import ConditionEffectBadges from '../initiative/ConditionEffectBadges.jsx';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
    getStore: vi.fn(() => new Map()),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn(() => null),
    setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/ui/storage.js', () => ({
    default: { set: vi.fn() },
}));

const monsters = JSON.parse(readFileSync('public/data/monsters.json', 'utf8'));
const WARRIOR_COMMANDER = monsters.find((m) => m.index === 'warrior-commander');
const LONGBOW = WARRIOR_COMMANDER.actions[2];
const GREATSWORD = WARRIOR_COMMANDER.actions[1];
const JAVELIN = monsters.find((m) => m.index === 'hobgoblin-warlord').actions[1];
const OCEAN_SPEAR = monsters.find((m) => m.index === 'merfolk-skirmisher').actions[0];

describe('MA-1680 disk fingerprint: warrior-commander Longbow hit_target_effect fix', () => {
  it('disk row carries hit_target_effect "speed_reduction" at the MA-0995/MA-1147 twin byte-slot (after range, immediately before damage_dice_primary)', () => {
    expect(LONGBOW.name).toBe('Longbow');
    expect(LONGBOW.attack_bonus).toBe(9);
    expect(LONGBOW.range).toBe('150/600 ft.');
    expect(LONGBOW.hit_target_effect).toBe('speed_reduction');
    const keys = Object.keys(LONGBOW);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('range') + 1);
    expect(keys.indexOf('hit_target_effect')).toBe(keys.indexOf('damage_dice_primary') - 1);
  });

  it('twin byte-shape: both FIXED twins likewise place hit_target_effect immediately before damage_dice_primary', () => {
    const javelinKeys = Object.keys(JAVELIN);
    expect(javelinKeys.indexOf('hit_target_effect')).toBe(javelinKeys.indexOf('damage_dice_primary') - 1);
    const spearKeys = Object.keys(OCEAN_SPEAR);
    expect(spearKeys.indexOf('hit_target_effect')).toBe(spearKeys.indexOf('damage_dice_primary') - 1);
  });

  it('attack core untouched + RAW rider prose byte-exact ("Speed decreases by 10 feet until the end of the target\'s next turn")', () => {
    expect(LONGBOW.damage_dice_primary).toBe('3d8 + 5');
    expect(LONGBOW.damage_type_primary).toBe('Piercing');
    expect(LONGBOW.description).toBe('Ranged Attack Roll: +9, range 150/600 ft. Hit: 18 (3d8 + 5) Piercing damage, and the target\'s Speed decreases by 10 feet until the end of the target\'s next turn.');
  });

  it('save-less RAW rider: NO save/condition/escape decoy fields authored (§410 wrong-slot family stays closed)', () => {
    expect(LONGBOW.save_dc).toBeUndefined();
    expect(LONGBOW.save_type).toBeUndefined();
    expect(LONGBOW.save_effect).toBeUndefined();
    expect(LONGBOW.escape_dc).toBeUndefined();
    expect(LONGBOW.hit_conditions).toBeUndefined();
    expect(LONGBOW.hit_condition_roll).toBeUndefined();
    expect(LONGBOW.hit_target_effect_value).toBeUndefined();
  });

  it('greatsword twin stays byte-unchanged: same "+9" bonus, NO rider (row-scoped startsWith(\'Longbow\') trap lock §693)', () => {
    expect(GREATSWORD.name).toBe('Greatsword');
    expect(GREATSWORD.attack_bonus).toBe(9);
    expect(GREATSWORD.hit_target_effect).toBeUndefined();
    expect(buildHitConditionClause(GREATSWORD)).toBeNull();
  });

  it('speed_reduction is a registered te reusable with no stamped value (registry default 10 = RAW −10 ft)', () => {
    const def = getEffectDefinition('speed_reduction');
    expect(def).toBeTruthy();
    expect(def.label).toBe('Speed Reduced');
    expect(def.group).toBe('Movement');
    expect(def.fields).toEqual(['source', 'value']);
    expect(def.defaults.value).toBe(10);
  });

  it('value 10 fold: granted te produces speedReduction 10 for the "Speed -10" badge + charSummary numeric fold', () => {
    const granted = computeConditionEffects({ conditions: [], saveModifiers: [], targetEffects: [{ target: 'Bandit 1', effect: 'speed_reduction', value: 10 }] });
    expect(granted.speedReduction).toBe(10);
    const passthrough = computeConditionEffects({ conditions: [], saveModifiers: [], targetEffects: [{ target: 'Bandit 1', effect: 'speed_reduction' }] });
    expect(passthrough.speedReduction).toBe(10);
  });

  it('badge consumer: one removable "Speed -10" badge on the victim from the MA-1680 granted te', () => {
    render(
      <ConditionEffectBadges
        conditions={[]}
        targetEffects={[{ target: 'Bandit 1', source: 'Warrior Commander 1', effect: 'speed_reduction', duration: 'until_start_of_next_turn', value: 10 }]}
        creatureName="Bandit 1"
        campaignName="test-campaign"
      />
    );
    const badges = screen.getAllByText('Speed -10');
    expect(badges).toHaveLength(1);
    const badge = badges[0].closest('[title]') || badges[0];
    expect(badge.getAttribute('title') || badge.className).toBeTruthy();
  });

  it('buildHitConditionClause arms the te-only rider (was null pre-fix)', () => {
    const clause = buildHitConditionClause(LONGBOW);
    expect(clause).toEqual({
      conditions: [],
      escapeDc: null,
      attackName: 'Longbow',
      targetEffect: 'speed_reduction',
    });
  });

  it('attack half stays live: one "+9" chip, no save/DC decoy chip; chip fires Longbow row', () => {
    expect(attackRowMissingToHit(LONGBOW)).toBe(false);
    const onAttack = vi.fn();
    const { container } = render(
      <MonsterAction
        action={LONGBOW}
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
    expect(chips).toEqual(['+9']);
    fireEvent.click(container.querySelector('.mc-dice-link'));
    expect(onAttack).toHaveBeenCalledWith('Longbow', 9, expect.objectContaining({ name: 'Longbow' }));
  });
});
