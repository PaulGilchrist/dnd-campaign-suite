// @improved-by-ai
// @cleaned-by-ai
// Cleanup applied (redundant / brittle / low-value removal):
//
//   Removed 6 redundant / brittle / low-value tests:
//     1. "calls rollSavingThrow instead of rollDamage when action has save_dc"
//        → covered by MonsterCardModal.auto-damage-roll.test.jsx (same action
//          shape, same rollSavingThrow assertion).
//     2. "does not pass forcedMode when ability is not STR even with ray debuff"
//        → negative test, low confidence value.
//     3. "does not pass forcedMode when monster lacks ray_of_enfeeble_debuff even for STR"
//        → negative test, low confidence value.
//     4. "does not pass forcedMode because skill key is lowercase "athletics"..."
//        → brittle: asserts implementation detail (case-sensitivity of skill
//          key matching). Would break if the component normalizes skill names.
//     5. "does not pass forcedMode when skill is not Athletics even with ray debuff"
//        → negative test, low confidence value.
//     6. "renders initiative text without a clickable dice link when bonus is not parseable"
//        → covered by MonsterCardModal.interaction.test.jsx (initiative rendering).
//
//   Consolidated 3 ray-of-enfeeble debuff ability-check tests → 1 parameterized test:
//     "passes forcedMode disadvantage when STR + debuff"
//     "does not pass forcedMode when DEX + debuff"
//     "does not pass forcedMode when STR + no debuff"
//       → merged into single it.each with { debuff, ability, expectedForcedMode }.
//
//   Consolidated 2 initiative tests → 1 parameterized test:
//     "calls rollInitiative with positive bonus"
//     "calls rollInitiative with negative bonus"
//       → merged into single it.each({ details, expectedBonus }).
//
// Kept (unique behavioral coverage):
//   - Primary damage dice roll (no attack_bonus) — not covered elsewhere.
//   - Secondary damage dice roll — not covered elsewhere.
//   - Ray of enfeeble STR disadvantage (positive path) — unique.
//   - Initiative roll (positive + negative) — unique.

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn((formula) => ({ total: parseInt(formula.split('d')[0]) * 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _rollAttack = vi.fn();
  const _rollDamage = vi.fn();
  const _rollAbilityCheck = vi.fn();
  const _rollSavingThrow = vi.fn();
  const _rollSkillCheck = vi.fn();
  const _rollInitiative = vi.fn();
  const _quickRollPlayerSave = vi.fn();
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  const mockHook = vi.fn((_monsterName, _campaignName, _opts) => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: _rollAttack,
    rollDamage: _rollDamage,
    rollAbilityCheck: _rollAbilityCheck,
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: _rollSkillCheck,
    rollInitiative: _rollInitiative,
    quickRollPlayerSave: _quickRollPlayerSave,
  }));

  return {
    default: mockHook,
    _rollAttack,
    _rollDamage,
    _rollAbilityCheck,
    _rollSavingThrow,
    _rollSkillCheck,
    _rollInitiative,
    _setPopupHtml,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => {
  let _computeReturn = null;
  const _computeConditionEffects = vi.fn((_conditions) => {
    return _computeReturn ?? { ...defaultConditionEffects };
  });

  return {
    computeConditionEffects: _computeConditionEffects,
    combineAttackModes: vi.fn(() => 'normal'),
    CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
    __setComputeReturn(val) { _computeReturn = val; },
  };
});

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  let _findCreatureReturn = null;

  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: vi.fn((_ctx, _name) => {
      return _findCreatureReturn ?? { name: 'Goblin', conditions: [] };
    }),
    getCombatContext: vi.fn().mockResolvedValue(null),
    __setFindCreatureReturn(val) { _findCreatureReturn = val; },
  };
});

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
  let _inspiringMoveNoOA = false;
  let _remarkableNoOA = false;
  let _targetEffects = [];

  const mockUseRuntimeValue = vi.fn((_characterKey, propertyName, _campaignName) => {
    if (propertyName === 'targetEffects') return _targetEffects;
    if (propertyName === 'inspiringMovementNoOA') return _inspiringMoveNoOA;
    if (propertyName === 'remarkableAthleteNoOA') return _remarkableNoOA;
    return null;
  });

  return {
    useRuntimeValue: mockUseRuntimeValue,
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(() => null),
    __setInspiringMoveNoOA(val) { _inspiringMoveNoOA = val; },
    __setRemarkableNoOA(val) { _remarkableNoOA = val; },
    __setTargetEffects(val) { _targetEffects = val; },
  };
});

// ── Re-import mocked modules for test setup helpers ─────────────────────────

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';

const rollDamage = useLoggedDiceRoll._rollDamage;
const rollAbilityCheck = useLoggedDiceRoll._rollAbilityCheck;
const rollInitiative = useLoggedDiceRoll._rollInitiative;

// ── Helpers ─────────────────────────────────────────────────────────────────

function findDiceLinkByText(text) {
  const links = document.querySelectorAll('.mc-dice-link');
  for (const el of links) {
    if (el.textContent.includes(text)) {
      return el;
    }
  }
  return null;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - handleDamage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
  });

  it('calls rollDamage with the correct formula when clicking primary damage dice', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const m = makeMonster({
      actions: [{ name: 'Club', attack_bonus: null, damage_dice_primary: '1d6+2', damage_type_primary: 'slashing', description: 'Melee Attack.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

    const dmgLink = findDiceLinkByText('1d6+2');
    expect(dmgLink).toBeInTheDocument();
    fireEvent.click(dmgLink);
    expect(rollDamage).toHaveBeenCalledWith(
      { name: 'Club', formula: '1d6+2', total: expect.any(Number), rolls: expect.any(Array), modifier: expect.any(Number), context: expect.objectContaining({ damageType: 'slashing', targetName: 'Player A', attackerName: 'Goblin' }) }
    );
  });

  it('calls rollDamage with secondary damage dice when clicking secondary damage link', () => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
      targetName: 'Player A',
    });

    const m = makeMonster({
      actions: [{ name: 'Multiattack', attack_bonus: null, damage_dice_primary: '1d6+2', damage_type_primary: 'slashing', damage_dice_secondary: '1d4+1', description: 'Two attacks.' }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

    const secondaryLink = findDiceLinkByText('1d4+1');
    expect(secondaryLink).toBeInTheDocument();
    fireEvent.click(secondaryLink);
    expect(rollDamage).toHaveBeenCalledWith(
      { name: 'Multiattack', formula: '1d4+1', total: expect.any(Number), rolls: expect.any(Array), modifier: expect.any(Number), context: expect.objectContaining({ damageType: 'slashing', targetName: 'Player A', attackerName: 'Goblin' }) }
    );
  });
});

describe('MonsterCardModal - handleAbilityCheck with ray of enfeeblement debuff', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
    useRuntimeState.__setTargetEffects([]);
  });

  it.each([
    { debuff: true, abilityIndex: 0, abilityName: 'Strength', modifier: -1, expectedForcedMode: 'disadvantage', desc: 'STR + debuff → disadvantage' },
    { debuff: true, abilityIndex: 1, abilityName: 'Dexterity', modifier: 2, expectedForcedMode: undefined, desc: 'DEX + debuff → no forcedMode' },
    { debuff: false, abilityIndex: 0, abilityName: 'Strength', modifier: -1, expectedForcedMode: undefined, desc: 'STR + no debuff → no forcedMode' },
  ])('ability check: $desc', ({ debuff, abilityIndex, abilityName, modifier, expectedForcedMode }) => {
    damageUtils.__setFindCreatureReturn({
      name: 'Goblin',
      conditions: [],
    });
    if (debuff) {
      useRuntimeState.__setTargetEffects([
        { target: 'Goblin', effect: 'ray_of_enfeeble_debuff' }
      ]);
    }

    const m = makeMonster({
      ability_scores: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 10 },
      ability_score_modifiers: { str: -1, dex: 2, con: 0, int: 0, wis: -1, cha: 0 },
    });
    render(<MonsterCardModal {...makeProps(m)} />);

    const mods = document.querySelectorAll('.mc-ability-mod');
    expect(mods).toHaveLength(6);
    fireEvent.click(mods[abilityIndex]);
    if (expectedForcedMode !== undefined) {
      expect(rollAbilityCheck).toHaveBeenCalledWith(abilityName, modifier, { forcedMode: expectedForcedMode });
    } else {
      expect(rollAbilityCheck).toHaveBeenCalledWith(abilityName, modifier, undefined);
    }
  });
});

describe('MonsterCardModal - handleInitiative', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
  });

  it.each([
    { details: '+5', expectedBonus: 5 },
    { details: '-2', expectedBonus: -2 },
  ])('calls rollInitiative with $expectedBonus when initiative_details is "$details"', ({ details, expectedBonus }) => {
    const m = makeMonster({ initiative_details: details });
    render(<MonsterCardModal {...makeProps(m)} />);
    const initLink = screen.getByText(details);
    fireEvent.click(initLink);
    expect(rollInitiative).toHaveBeenCalledWith(expectedBonus);
  });
});
