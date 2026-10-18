// Audit + trim (#580 REC + #578/#579/#588 dead-mock purge):
//
//   TRIMMED (REC from #580): "calls rollDamage ... clicking primary damage dice"
//     → plain handleDamage chip lane owned by auto-damage-roll.test.jsx
//       (trait/reaction/legendary damage_dice chips, identical ActionDamageLinks
//       onDamage → handleDamage → rollExpression → rollDamage seam, :255-301)
//       and logic.test.jsx:301 (handleDamage crit-popup lane, same Club row).
//     Total rolls pinned exact via the deterministic diceRoller mock now
//     (auto-damage-roll idiom) instead of expect.any(Number).
//
//   KEPT (unique owners — verified by grep, no other file asserts these):
//     - Secondary damage chip CLICK (:MonsterAction.jsx:63): every other
//       damage_dice_secondary reference is a JSON-field unit assertion; the
//       attack-chip auto-transport (#580) is a different lane. Also pins
//       getTarget() → context.targetName at the manual chip seam.
//     - Ability-check chip → rollAbilityCheck ray-of-enfeeble ctx identity,
//       once per branch of handleAbilityCheck (str+debuff / non-str / no
//       debuff); bolster_advantage positive leg owned by
//       legendary-uses-empyrean.test.jsx.
//     - Initiative chip → rollInitiative (positive + negative): ownership
//       pinned HERE by interaction.test.jsx's removal citation.
//
//   Dead-mock purge: unused hook export channels (_rollAttack/_rollSavingThrow/
//     _rollSkillCheck/_quickRollPlayerSave/_setPopupHtml), conditionEffects
//     __setComputeReturn and damageUtils __setFindCreatureReturn channels
//     (constant attacker+target hoisted into the mock), useRuntimeState
//     __setInspiringMoveNoOA/__setRemarkableNoOA. Redundant ability_scores
//     overrides dropped (match makeMonster defaults). No vacuous arg[1]
//     captures: every third-arg ctx assertion is exact ({forcedMode} | undefined,
//     per rayDisadvantageContext/bolsterAdvantageContext at :1510-1525).
//
// @maintained-by-ai

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 8, rolls: [3, 5], modifier: 2 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 16, rolls: [3, 5], modifier: 2 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _rollDamage = vi.fn();
  const _rollAbilityCheck = vi.fn();
  const _rollInitiative = vi.fn();

  const mockHook = vi.fn((_monsterName, _campaignName, _opts) => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: _rollDamage,
    rollAbilityCheck: _rollAbilityCheck,
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: _rollInitiative,
    quickRollPlayerSave: vi.fn(),
  }));

  return { default: mockHook, _rollDamage, _rollAbilityCheck, _rollInitiative };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

// Attacker resolvable with an armed target so the damage chip rolls (no
// no-target refusal); modifier math owners mocked out (playbook cite-skip).
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  extractDamageTypes: vi.fn(() => []),
  formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
  getTargetFromAttacker: vi.fn(() => null),
  getResistanceNotice: vi.fn(() => null),
  findCreatureByName: vi.fn(() => ({ name: 'Goblin', conditions: [], targetName: 'Player A' })),
  getCombatContext: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  computeRangeEffect: vi.fn(() => ({ mode: 'normal' })),
  getDistanceFeet: vi.fn(() => null),
  getNearestPlacedItem: vi.fn(() => null),
  rangeToFeet: vi.fn((range) => {
    if (typeof range === 'number') return range;
    if (range === 'touch') return 8;
    if (!range) return null;
    const m = range.match(/^(\d+)/);
    return m ? parseInt(m[1], 10) : 30;
  }),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/shared/abilityLookup.js', () => ({
  getAbilitySaveModifier: vi.fn((_abilities, _abilityKey) => 0),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  let _targetEffects = [];
  return {
    useRuntimeValue: vi.fn((_characterKey, propertyName) => (propertyName === 'targetEffects' ? _targetEffects : null)),
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(() => null),
    __setTargetEffects(val) { _targetEffects = val; },
  };
});

// ── Re-import mocked channels for assertions ───────────────────────────────

import { _rollDamage, _rollAbilityCheck, _rollInitiative } from '../../hooks/combat/useLoggedDiceRoll.js';
import { __setTargetEffects } from '../../hooks/runtime/useRuntimeState.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function clickChip(text) {
  const link = Array.from(document.querySelectorAll('.mc-dice-link')).find(el => el.textContent.includes(text));
  expect(link).toBeTruthy();
  fireEvent.click(link);
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - chip seams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setTargetEffects([]);
  });

  it('secondary damage chip rolls rollDamage with the secondary formula and target/attacker context', () => {
    render(<MonsterCardModal {...makeProps(makeMonster({
      actions: [{ name: 'Multiattack', attack_bonus: null, damage_dice_primary: '1d6+2', damage_type_primary: 'slashing', damage_dice_secondary: '1d4+1', description: 'Two attacks.' }],
    }), { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

    clickChip('1d4+1');
    expect(_rollDamage).toHaveBeenCalledWith({
      name: 'Multiattack',
      formula: '1d4+1',
      total: 8,
      rolls: [3, 5],
      modifier: 2,
      context: expect.objectContaining({ damageType: 'slashing', targetName: 'Player A', attackerName: 'Goblin' }),
    });
  });

  it.each([
    { desc: 'STR + ray_of_enfeeble_debuff → forcedMode disadvantage', debuff: true, chipIndex: 0, ability: 'Strength', mod: -1, ctx: { forcedMode: 'disadvantage' } },
    { desc: 'DEX + debuff → no forcedMode (str-only gate)', debuff: true, chipIndex: 1, ability: 'Dexterity', mod: 2, ctx: undefined },
    { desc: 'STR + no debuff → no forcedMode', debuff: false, chipIndex: 0, ability: 'Strength', mod: -1, ctx: undefined },
  ])('ability check chip: $desc', ({ debuff, chipIndex, ability, mod, ctx }) => {
    if (debuff) __setTargetEffects([{ target: 'Goblin', effect: 'ray_of_enfeeble_debuff' }]);
    render(<MonsterCardModal {...makeProps(makeMonster())} />);

    const mods = document.querySelectorAll('.mc-ability-mod');
    expect(mods).toHaveLength(6);
    fireEvent.click(mods[chipIndex]);
    expect(_rollAbilityCheck).toHaveBeenCalledWith(ability, mod, ctx);
  });

  it.each([
    { details: '+5', expectedBonus: 5 },
    { details: '-2', expectedBonus: -2 },
  ])('initiative chip "$details" calls rollInitiative($expectedBonus)', ({ details, expectedBonus }) => {
    render(<MonsterCardModal {...makeProps(makeMonster({ initiative_details: details }))} />);
    fireEvent.click(screen.getByText(details));
    expect(_rollInitiative).toHaveBeenCalledWith(expectedBonus);
  });
});
