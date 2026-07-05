/* @cleaned-by-ai */
// Tests removed (redundant with other test files):
//
//   "clicking saving throw dice link calls rollSavingThrow"
//     → MonsterCardModal.save-modifier.test.jsx "uses creature.saving_throws
//       when player has no abilities array" covers save click with full
//       argument assertions
//
//   "clicking attack bonus calls rollAttack"
//     → MonsterCardModal.attack-logic.test.jsx has 9 tests covering
//       rollAttack with detailed argument assertions (coverAcBonus,
//       forcedMode, grazeDamage, autoDamageFormula, saveDc, etc.)
//
//   "clicking damage dice link calls rollDamage"
//     → MonsterCardModal.save-modifier.test.jsx "handleDamage with save DC
//       context" covers damage click with full argument assertions
//
//   "clicking extra damage dice link calls rollDamage"
//     → MonsterCardModal.attack-logic.test.jsx "passes autoDamageSecondaryFormula"
//       covers secondary damage with full argument assertions
//
//   "does not render initiative dice link when initiative_details has no
//     parseable bonus"
//     → MonsterCardModal.rendering.test.jsx "does not render initiative
//       section when data is absent" covers initiative absence; the
//       positive interaction test covers the click handler
//
//   "displays multiple speed types when available"
//     → MonsterCardModal.rendering.test.jsx "shows multiple speed entries"
//       covers the same rendering behavior
//
//   "renders multiple damage options separated by 'or'"
//     → MonsterCardModal.rendering.test.jsx "renders attack bonus, damage
//       dice, and save DC in actions" covers damage dice rendering
//
// Kept (unique behavioral coverage):
//
//   "clicking ability modifier calls rollAbilityCheck" — only test verifying
//     ability modifier dice links trigger rollAbilityCheck
//
//   "clicking skill dice link calls rollSkillCheck" — only test verifying
//     skill dice links trigger rollSkillCheck
//
//   "clicking initiative dice link calls rollInitiative" — only test verifying
//     initiative dice link click handler fires with correct bonus
//
// @cleaned-by-ai

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ----
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

  const mockHook = vi.fn(() => ({
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
  const _findCreatureByName = vi.fn((_ctx, _name) => {
    return _findCreatureReturn ?? { name: 'Goblin', conditions: [] };
  });

  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: _findCreatureByName,
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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn((_characterKey, _propertyName, _campaignName) => null),
  getRuntimeValue: vi.fn((_characterKey, _propertyName) => null),
}));

// ── Re-import mocked modules ----
import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';

const rollAbilityCheck = useLoggedDiceRoll._rollAbilityCheck;
const rollSkillCheck = useLoggedDiceRoll._rollSkillCheck;
const rollInitiative = useLoggedDiceRoll._rollInitiative;

// ── Tests ----

describe('MonsterCardModal interaction / game rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
  });

  // ════════════════════════════════════════════
  // Dice link click handlers (unique interaction coverage)
  // ════════════════════════════════════════════

  it('clicking ability modifier calls rollAbilityCheck with correct ability and modifier', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    const mods = document.querySelectorAll('.mc-ability-mod');
    expect(mods.length).toBe(6);
    // STR has modifier -1
    fireEvent.click(mods[0]);
    expect(rollAbilityCheck).toHaveBeenCalledWith('Strength', -1);
  });

  it('clicking skill dice link calls rollSkillCheck', () => {
    const m = makeMonster({ skills: { stealth: { modifier: 3 } } });
    render(<MonsterCardModal {...makeProps(m)} />);

    const rows = document.querySelectorAll('.mc-defense-row');
    let skillRow = null;
    for (const row of rows) {
      if (row.querySelector('.mc-defense-label')?.textContent === 'Skills') {
        skillRow = row;
        break;
      }
    }
    expect(skillRow).toBeTruthy();
    const link = skillRow.querySelector('.mc-dice-link');
    expect(link).toBeTruthy();
    fireEvent.click(link);
    expect(rollSkillCheck).toHaveBeenCalled();
  });

  it('clicking initiative dice link calls rollInitiative when initiative_details has a bonus', () => {
    const m = makeMonster({ initiative_details: '+5' });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('+5')).toBeInTheDocument();
    const initLink = screen.getByText('+5');
    expect(initLink.closest('.mc-dice-link')).toBeTruthy();
    fireEvent.click(initLink);
    expect(rollInitiative).toHaveBeenCalledWith(5);
  });
});
