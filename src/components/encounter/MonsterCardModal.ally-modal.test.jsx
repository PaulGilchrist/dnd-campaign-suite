// @improved-by-ai
// @cleaned-by-ai
// Cleanup applied (redundant test removal):
//
//   Removed 2 redundant tests:
//     "renders ally badge when no stored allies (defaults to monster name)"
//       → fully covered by "renders ally badge with monster name as default
//         ally count of 1" (beforeEach already sets selectedAllies to null).
//     "renders ally badge as a clickable element with icon and title"
//       → asserts implementation details (CSS classes, icon element) already
//         covered by "opens ally selection modal when ally badge is clicked"
//         which asserts the same title attribute and clicks the same element.

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps } from './MonsterCardModal.test-utils.js';

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

  return {
    default: vi.fn(() => ({
      popupHtml: _popupHtml,
      setPopupHtml: _setPopupHtml,
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      rollAbilityCheck: vi.fn(),
      rollSavingThrow: vi.fn(),
      rollSkillCheck: vi.fn(),
      rollInitiative: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    })),
    _setPopupHtml,
  };
});

vi.mock('../../services/combat/conditions/conditionEffects.js', () => {
  const defaultEffects = {
    attackAdvantageCount: 0,
    attackDisadvantageCount: 0,
    abilityCheckDisadvantage: false,
    autoFailSaves: [],
    saveDisadvantage: [],
    cannotAct: false,
    speedZero: false,
    concentrationBroken: false,
    targetAdvantageCount: 0,
    targetDisadvantageCount: 0,
    targetAdvantageIfWithin5ft: false,
    targetDisadvantageIfBeyond5ft: false,
    autoCritWithin5ft: false,
    resistantToAll: false,
    poisonImmune: false,
    saveAdvantage: [],
    saveAdvantageCount: 0,
    saveDisadvantageCount: 0,
    autoReroll: false,
    autoRerollCondition: null,
    autoRerollBonus: null,
    strSaveReplace: false,
    strCheckReplace: false,
    reliableTalent: false,
    tacticalMind: false,
    tacticalMindBonus: null,
  };

  let _computeReturn = null;
  const computeConditionEffects = vi.fn((_conditions) => {
    return _computeReturn ?? { ...defaultEffects };
  });

  return {
    computeConditionEffects,
    combineAttackModes: vi.fn(() => 'normal'),
    CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
    __setComputeReturn(val) { _computeReturn = val; },
  };
});

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

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({
    creatures: [
      { name: 'Goblin', type: 'humanoid', currentHp: 7, maxHp: 7 },
      { name: 'Player A', type: 'player', currentHp: 10, maxHp: 10 },
      { name: 'Player B', type: 'player', currentHp: 8, maxHp: 8 },
    ],
  })),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  let _inspiringMoveNoOA = false;
  let _remarkableNoOA = false;
  let _targetEffects = [];
  let _selectedAllies = null;

  const mockUseRuntimeValue = vi.fn((_characterKey, propertyName, _campaignName) => {
    if (propertyName === 'targetEffects') return _targetEffects;
    if (propertyName === 'inspiringMovementNoOA') return _inspiringMoveNoOA;
    if (propertyName === 'remarkableAthleteNoOA') return _remarkableNoOA;
    if (propertyName === 'selectedAllies') return _selectedAllies;
    return null;
  });

  return {
    useRuntimeValue: mockUseRuntimeValue,
    setRuntimeValue: vi.fn(),
    getRuntimeValue: vi.fn(() => null),
    __setInspiringMoveNoOA(val) { _inspiringMoveNoOA = val; },
    __setRemarkableNoOA(val) { _remarkableNoOA = val; },
    __setTargetEffects(val) { _targetEffects = val; },
    __setSelectedAllies(val) { _selectedAllies = val; },
  };
});

// ── Re-import mocked modules for test setup helpers ─────────────────────────

import * as conditionEffects from '../../services/combat/conditions/conditionEffects.js';
import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';
import * as combatData from '../../services/encounters/combatData.js';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - ally modal interactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionEffects.__setComputeReturn(null);
    damageUtils.__setFindCreatureReturn(null);
    useRuntimeState.__setSelectedAllies(null);
  });

  it('renders ally badge with monster name as default ally count of 1', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText(/Allies \(1\)/)).toBeInTheDocument();
  });

  it('renders ally badge with stored allies count', () => {
    useRuntimeState.__setSelectedAllies(['Goblin', 'Player A']);
    render(<MonsterCardModal {...makeProps(makeMonster())} />);
    expect(screen.getByText(/Allies \(2\)/)).toBeInTheDocument();
  });

  it('opens ally selection modal when ally badge is clicked', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);

    const allyBadge = screen.getByTitle('Manage allies');
    expect(allyBadge).toBeInTheDocument();
    fireEvent.click(allyBadge);

    expect(document.querySelector('.sp-modal')).toBeInTheDocument();
  });

  it('passes combat summary creatures to the ally selection modal', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);

    const allyBadge = screen.getByTitle('Manage allies');
    fireEvent.click(allyBadge);

    // The modal should have received creatures from getCombatSummary
    expect(combatData.getCombatSummary).toHaveBeenCalled();
  });

  it('calls setRuntimeValue with selected allies on confirm', async () => {
    const { container } = render(<MonsterCardModal {...makeProps(makeMonster())} />);

    // Open the ally modal
    const allyBadge = screen.getByTitle('Manage allies');
    fireEvent.click(allyBadge);

    // Select at least one ally via checkbox
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBeGreaterThan(0);
    fireEvent.click(checkboxes[0]);

    // Click the confirm button
    const confirmBtn = screen.getByRole('button', { name: /confirm/i });
    expect(confirmBtn).toBeInTheDocument();
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(useRuntimeState.setRuntimeValue).toHaveBeenCalledWith(
        'Goblin',
        'selectedAllies',
        expect.any(Array),
        'test-campaign'
      );
    });
  });

  it('closes the ally modal on cancel', () => {
    render(<MonsterCardModal {...makeProps(makeMonster())} />);

    const allyBadge = screen.getByTitle('Manage allies');
    fireEvent.click(allyBadge);

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    expect(cancelBtn).toBeInTheDocument();
    fireEvent.click(cancelBtn);

    // Modal should be removed from DOM
    expect(document.querySelector('.sp-modal')).not.toBeInTheDocument();
  });

});
