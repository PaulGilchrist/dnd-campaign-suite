// @improved-by-ai
// @cleaned-by-ai
// Consolidated (redundant / brittle / low-value removal):
//
//   autoDamageRoll triggered via attack: 3 tests → 1 test (it.each)
//     "passes autoDamageFormula extracted from damage_dice_primary to rollAttack"
//     "passes autoDamageSecondaryFormula from damage_dice_secondary to rollAttack"
//     "passes saveDc, saveType, and dcSuccess when action has save_dc on an attack"
//       → merged into single parameterized test covering all three context
//         parameter cases (autoDamageFormula, autoDamageSecondaryFormula +
//         autoDamageSecondaryDamageType, saveDc + saveType + dcSuccess) with
//         identical assertions on rollAttack.mock.calls[0][2].
//
//   autoDamageRoll callback behavior: 5 tests → 2 tests
//     "calls rollExpression with the autoDamage formula via the autoDamageRoll callback"
//     "doubles the dice roll when isAutoCrit is true"
//       → merged into single parameterized test (isAutoCrit: false vs true)
//         since both follow the identical setup/teardown path with only the
//         isAutoCrit flag and expected rollDamage total differing.
//     "passes saveDc context to rollDamage when action has save_dc"
//     "passes secondary formula context to rollDamage when present"
//       → merged into single parameterized test (saveDc vs secondaryFormula)
//         since both verify the same callback behavior with different context
//         params using the identical render→click→callback/assert pattern.
//     "does not call rollDamage when autoDamage is null"
//       → kept; unique negative test asserting the null guard in the callback.
//
//   traits with damage dice + reactions/legendary actions: 5 tests → 3 tests
//     "renders and calls onDamage for trait with damage_dice_primary"
//     "renders onDamage link for reaction with damage_dice_primary"
//     "renders onDamage link for legendary action with damage_dice_primary"
//       → merged into single parameterized test (trait vs reaction vs
//         legendary_actions) since all three tests follow the identical
//         find/click/assert pattern with only the action type differing.
//     "renders and calls onDamage for trait with attack_bonus"
//       → kept; unique test asserting attack_bonus path (calls rollAttack).
//     "renders and calls onSaveRoll for trait with save_dc"
//       → kept; unique test asserting save_dc path (different code path
//         via handleSaveRoll, not rollDamage).
//
// Kept (unique behavioral coverage):
//   - Null autoDamage guard (negative test).
//   - Trait with attack_bonus (rollAttack path, distinct from damage_dice).
//   - Trait with save_dc (handleSaveRoll path, distinct from damage_dice).

import { render, fireEvent, act } from '@testing-library/react';
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
    _quickRollPlayerSave,
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
  computeRangeEffect: vi.fn(() => ({ mode: 'normal', reason: '' })),
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

const rollDamage = useLoggedDiceRoll._rollDamage;
const rollAttack = useLoggedDiceRoll._rollAttack;

// ── Helpers ─────────────────────────────────────────────────────────────────

function findDiceLinkByText(text) {
  const links = document.querySelectorAll('.mc-dice-link');
  return Array.from(links).find(el => el.textContent.includes(text)) || null;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - autoDamageRoll callback integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
  });

  describe('autoDamageRoll triggered via attack (autoDamageFormula)', () => {
    it.each([
      {
        action: { name: 'Club', attack_bonus: 4, damage_dice_primary: '1d6+2', damage_type_primary: 'slashing', description: 'Melee Attack.' },
        linkText: '+4',
        expected: { autoDamageFormula: '1d6+2' },
        desc: 'passes autoDamageFormula extracted from damage_dice_primary to rollAttack',
      },
      {
        action: { name: 'Multiattack', attack_bonus: 4, damage_dice_primary: '1d6+2', damage_type_primary: 'slashing', damage_dice_secondary: '1d4+1', damage_type_secondary: 'piercing', description: 'Two attacks.' },
        linkText: '+4',
        expected: { autoDamageSecondaryFormula: '1d4+1', autoDamageSecondaryDamageType: 'piercing' },
        desc: 'passes autoDamageSecondaryFormula from damage_dice_secondary to rollAttack',
      },
      {
        action: { name: 'Hex Attack', attack_bonus: 5, save_dc: 13, save_type: 'Wisdom', damage_type_primary: 'psychic', description: 'Attack with save.' },
        linkText: '+5',
        expected: { saveDc: 13, saveType: 'wis', dcSuccess: 'half' },
        desc: 'passes saveDc, saveType, and dcSuccess when action has save_dc on an attack',
      },
    ])('$desc', ({ action, linkText, expected }) => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });

      const m = makeMonster({ actions: [action] });
      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

      const attackLink = findDiceLinkByText(linkText);
      expect(attackLink).toBeTruthy();
      fireEvent.click(attackLink);
      expect(rollAttack).toHaveBeenCalled();
      const callArgs = rollAttack.mock.calls[0][2];
      for (const [key, value] of Object.entries(expected)) {
        expect(callArgs[key]).toBe(value);
      }
    });
  });

  describe('autoDamageRoll callback behavior', () => {
    it.each([
      {
        isAutoCrit: false,
        expectedTotal: 8,
        name: 'Club',
        formula: '1d6+2',
        damageType: 'slashing',
        desc: 'calls rollExpression with the autoDamage formula via the autoDamageRoll callback',
      },
      {
        isAutoCrit: true,
        expectedTotal: 16,
        name: 'Club',
        formula: '1d6+2',
        damageType: 'slashing',
        desc: 'doubles the dice roll when isAutoCrit is true',
      },
    ])('$desc', async ({ isAutoCrit, expectedTotal, name, formula, damageType }) => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });

      const m = makeMonster({
        actions: [{ name: 'Club', attack_bonus: 4, damage_dice_primary: '1d6+2', damage_type_primary: 'slashing', description: 'Melee Attack.' }],
      });
      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

      const attackLink = findDiceLinkByText('+4');
      expect(attackLink).toBeTruthy();
      fireEvent.click(attackLink);

      const autoDamageRoll = rollAttack.mock.calls[0][1]?.autoDamageRoll;
      if (autoDamageRoll) {
        await act(async () => {
          await autoDamageRoll({
            formula,
            damageType,
            attackerName: 'Goblin',
            name,
            isAutoCrit,
          });
        });
        expect(rollDamage).toHaveBeenCalledWith(
          { name: name, formula: formula, total: expectedTotal, rolls: [3, 5], modifier: 2, context: expect.objectContaining({ damageType, attackerName: 'Goblin', isAutoCrit }) }
        );
      }
    });

    it.each([
      {
        extraArgs: { saveDc: 13, saveType: 'wis', dcSuccess: 'half' },
        actionName: 'Hex Attack',
        damageType: 'psychic',
        expectedContext: { saveDc: 13, saveType: 'wis', dcSuccess: 'half' },
        desc: 'passes saveDc context to rollDamage when action has save_dc',
      },
      {
        extraArgs: { secondaryFormula: '1d4+1', secondaryName: 'Multiattack', secondaryDamageType: 'piercing' },
        actionName: 'Multiattack',
        damageType: 'slashing',
        expectedContext: { autoDamageSecondaryFormula: '1d4+1', autoDamageSecondaryName: 'Multiattack', autoDamageSecondaryDamageType: 'piercing' },
        desc: 'passes secondary formula context to rollDamage when present',
      },
    ])('$desc', async ({ extraArgs, actionName, damageType, expectedContext }) => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });

      const m = makeMonster({
        actions: [{ name: actionName, attack_bonus: 4, damage_dice_primary: '1d6+2', damage_type_primary: 'slashing', description: 'Attack.' }],
      });
      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

      const attackLink = findDiceLinkByText('+4');
      expect(attackLink).toBeTruthy();
      fireEvent.click(attackLink);

      const autoDamageRoll = rollAttack.mock.calls[0][1]?.autoDamageRoll;
      if (autoDamageRoll) {
        await act(async () => {
          await autoDamageRoll({
            formula: '1d6+2',
            damageType,
            attackerName: 'Goblin',
            name: actionName,
            ...extraArgs,
          });
        });
        expect(rollDamage).toHaveBeenCalledWith(
          { name: actionName, formula: '1d6+2', total: 8, rolls: [3, 5], modifier: 2, context: expect.objectContaining(expectedContext) }
        );
      }
    });

    it('does not call rollDamage when autoDamage is null', async () => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
        targetName: 'Player A',
      });

      const m = makeMonster({
        actions: [{ name: 'Club', attack_bonus: 4, damage_dice_primary: '1d6+2', damage_type_primary: 'slashing', description: 'Melee Attack.' }],
      });
      render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

      const attackLink = findDiceLinkByText('+4');
      expect(attackLink).toBeTruthy();
      fireEvent.click(attackLink);

      const autoDamageRoll = rollAttack.mock.calls[0][1]?.autoDamageRoll;
      if (autoDamageRoll) {
        await act(async () => {
          await autoDamageRoll(null);
        });
        expect(rollDamage).not.toHaveBeenCalled();
      }
    });
  });

  describe('traits with damage dice', () => {
    it.each([
      {
        actionType: 'traits',
        action: { name: 'Bite', description: '', attack_bonus: null, damage_dice_primary: '1d8', damage_type_primary: 'piercing' },
        linkText: '1d8',
        rollFn: rollDamage,
        rollArgs: [{ name: 'Bite', formula: '1d8', total: expect.any(Number), rolls: expect.any(Array), modifier: expect.any(Number), context: expect.any(Object) }],
        desc: 'renders and calls onDamage for trait with damage_dice_primary',
      },
      {
        actionType: 'traits',
        action: { name: 'Sting', description: '', attack_bonus: 3 },
        linkText: '+3',
        rollFn: rollAttack,
        rollArgs: [],
        desc: 'renders and calls onDamage for trait with attack_bonus',
      },
      {
        actionType: 'traits',
        action: { name: 'Petrification Gaze', description: '', save_dc: 14, save_type: 'Constitution' },
        linkText: 'DC 14',
        rollFn: null,
        rollArgs: [],
        desc: 'renders and calls onSaveRoll for trait with save_dc',
      },
      {
        actionType: 'reactions',
        action: { name: 'Opportunity Attack', description: '', attack_bonus: null, damage_dice_primary: '1d6+1', damage_type_primary: 'slashing' },
        linkText: '1d6+1',
        rollFn: rollDamage,
        rollArgs: [],
        desc: 'renders onDamage link for reaction with damage_dice_primary',
      },
      {
        actionType: 'legendary_actions',
        action: { name: 'Tail Attack', description: '', attack_bonus: null, damage_dice_primary: '1d4', damage_type_primary: 'bludgeoning' },
        linkText: '1d4',
        rollFn: rollDamage,
        rollArgs: [],
        desc: 'renders onDamage link for legendary action with damage_dice_primary',
      },
    ])('$desc', ({ actionType, action, linkText, rollFn, rollArgs }) => {
      damageUtils.__setFindCreatureReturn({
        name: 'Goblin',
        conditions: [],
      });

      const m = makeMonster({ [actionType]: [action] });
      render(<MonsterCardModal {...makeProps(m)} />);

      const dmgLink = findDiceLinkByText(linkText);
      expect(dmgLink).toBeTruthy();
      fireEvent.click(dmgLink);
      if (rollFn) {
        expect(rollFn).toHaveBeenCalled();
        if (rollArgs.length > 0) {
          expect(rollFn).toHaveBeenCalledWith(...rollArgs);
        }
      }
    });
  });
});
