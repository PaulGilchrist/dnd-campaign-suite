// @improved-by-ai
// @cleaned-by-ai
// Cleanup applied (redundant / brittle / low-value removal):
//
//   Removed 1 redundant integration test:
//     "passes every condition from a multi-condition save_effect to rollSavingThrow"
//       → covered by MonsterCardModal.logic.test.jsx:249-268
//         ("passes saveConditions parsed from save_effect to rollAttack")
//         which tests the same extractConditionsFromSaveEffect behavior through the
//         rollAttack code path. The unit tests in this file already cover the extraction
//         function directly with full edge-case coverage.
//
//   Kept (unique behavioral coverage):
//   - All 6 unit tests for extractConditionsFromSaveEffect (pure function, no other coverage).
//   - Absent save_effect → empty saveConditions integration test (unique gap).
//
// Coverage audit against ALL other MonsterCardModal test files:
//   - Single-condition extraction reaching rollAttack is asserted in
//     MonsterCardModal.logic.test.jsx (saveConditions: ['petrified']).
//   - Save-link rendering branches are asserted in MonsterCardModal.test.jsx,
//     MonsterCardModal.save-modifier.test.jsx, and MonsterCardModal.damage-and-ability-checks.test.jsx.
//   - This file owns: pure function unit tests + absent save_effect integration gap.

import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';
import { extractConditionsFromSaveEffect } from './MonsterCardHelpers.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', async (importActual) => ({
  ...(await importActual()),
  rollExpression: vi.fn(() => ({ total: 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => String(html || '')),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });
  const _rollSavingThrow = vi.fn();

  const mockHook = vi.fn((_monsterName, _campaignName, _opts) => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: _rollSavingThrow,
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));

  return {
    default: mockHook,
    _rollSavingThrow,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn(() => ({ ...defaultConditionEffects })),
  combineAttackModes: vi.fn(() => 'normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => {
  const DEFAULT_CREATURE = { name: 'Goblin', conditions: [] };
  let _findCreatureReturn = null;

  return {
    extractDamageTypes: vi.fn(() => []),
    formatDamageTypes: vi.fn((types) => (types || []).join(', ') || ''),
    getTargetFromAttacker: vi.fn(() => null),
    getResistanceNotice: vi.fn(() => null),
    findCreatureByName: vi.fn((_ctx, _name) => {
      return _findCreatureReturn ?? { ...DEFAULT_CREATURE };
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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

// ── Re-import mocked modules for test setup helpers ─────────────────────────

import * as useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';

const rollSavingThrow = useLoggedDiceRoll._rollSavingThrow;

// ── Tests: pure extraction behavior ─────────────────────────────────────────

describe('extractConditionsFromSaveEffect (unit)', () => {
  it.each([
    ['blinded', 'the target is blinded for 1 minute'],
    ['charmed', 'the target is charmed'],
    ['cursed', 'the target is cursed'],
    ['deafened', 'the target is deafened'],
    ['frightened', 'the target is frightened for 1 minute'],
    ['grappled', 'the target is grappled'],
    ['incapacitated', 'the target is incapacitated'],
    ['paralyzed', 'the target is paralyzed'],
    ['petrified', 'the target is petrified'],
    ['poisoned', 'the target is poisoned'],
    ['prone', 'the target falls prone'],
    ['restrained', 'the target is restrained'],
    ['stunned', 'the target is stunned'],
    ['unconscious', 'the target falls unconscious'],
  ])('extracts "%s" from a save effect string', (condition, text) => {
    expect(extractConditionsFromSaveEffect(text)).toEqual([condition]);
  });

  it('extracts every condition from a multi-condition save effect', () => {
    expect(extractConditionsFromSaveEffect('On a failed save, the target is charmed and stunned.')).toEqual(['charmed', 'stunned']);
    expect(extractConditionsFromSaveEffect('the target is restrained and then becomes prone')).toEqual(['prone', 'restrained']);
  });

  it('matches conditions case-insensitively', () => {
    expect(extractConditionsFromSaveEffect('The target is PETRIFIED')).toEqual(['petrified']);
    expect(extractConditionsFromSaveEffect('the target is StUnNeD')).toEqual(['stunned']);
  });

  it('does not match condition words as substrings of larger words', () => {
    expect(extractConditionsFromSaveEffect('the target suffers from blindedness')).toEqual([]);
    expect(extractConditionsFromSaveEffect('the target falls into unconsciousness')).toEqual([]);
    expect(extractConditionsFromSaveEffect('the target begins petrifying')).toEqual([]);
  });

  it('returns an empty array for falsy or non-string save effects', () => {
    for (const value of [undefined, null, '', 42, { effect: 'blinded' }, ['blinded']]) {
      expect(extractConditionsFromSaveEffect(value)).toEqual([]);
    }
  });

  it('returns an empty array when no supported condition is present', () => {
    expect(extractConditionsFromSaveEffect('On a failed save, the target takes 3d6 fire damage.')).toEqual([]);
  });
});

// ── Tests: extraction wired into the monster card ───────────────────────────

describe('MonsterCardModal - save_effect conditions reach the save roll', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    damageUtils.__setFindCreatureReturn(null);
  });

  it('passes an empty saveConditions array when save_effect is absent', () => {
    damageUtils.__setFindCreatureReturn({ name: 'Goblin', conditions: [], targetName: 'Player A' });

    const m = makeMonster({
      actions: [{
        name: 'Web',
        save_dc: 13,
        save_type: 'Dexterity',
        description: 'Dexterity Saving Throw: DC 13. Webbing fills a 20-ft square.',
      }],
    });
    render(<MonsterCardModal {...makeProps(m, { creatures: [{ name: 'Goblin', targetName: 'Player A' }, { name: 'Player A', type: 'player' }] })} />);

    fireEvent.click(screen.getByText('DC 13 Dexterity'));
    expect(rollSavingThrow).toHaveBeenCalledWith(
      'DEX',
      0,
      expect.objectContaining({ saveConditions: [] })
    );
  });
});
