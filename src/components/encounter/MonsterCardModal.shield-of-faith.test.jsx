/* @improved-by-ai */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [1, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [1, 2], modifier: 0 })),
}));

vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => String(html || '')) }));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  let _popupHtml = null;
  const _setPopupHtml = vi.fn((val) => { _popupHtml = val; });

  const mockHook = vi.fn((_monsterName, _campaignName, _opts) => ({
    get popupHtml() { return _popupHtml; },
    setPopupHtml: _setPopupHtml,
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    rollAbilityCheck: vi.fn(),
    rollSavingThrow: vi.fn(),
    rollSkillCheck: vi.fn(),
    rollInitiative: vi.fn(),
    quickRollPlayerSave: vi.fn(),
  }));

  return {
    default: mockHook,
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
  let _activeBuffs = null;

  const mockUseRuntimeValue = vi.fn((_characterKey, propertyName, _campaignName) => {
    if (propertyName === 'targetEffects') return [];
    if (propertyName === 'inspiringMovementNoOA') return false;
    if (propertyName === 'remarkableAthleteNoOA') return false;
    return null;
  });

  const mockGetRuntimeValue = vi.fn((_characterKey, propertyName) => {
    if (propertyName === 'activeBuffs') return _activeBuffs;
    return null;
  });

  return {
    useRuntimeValue: mockUseRuntimeValue,
    getRuntimeValue: mockGetRuntimeValue,
    __setActiveBuffs(val) { _activeBuffs = val; },
  };
});

// ── Re-import for helper access ────────────────────────────────────────────

import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - Shield of Faith AC bonus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    damageUtils.__setFindCreatureReturn(null);
    useRuntimeState.__setActiveBuffs(null);
  });

  it('adds +2 to armor class when activeBuffs contains shield_of_faith', () => {
    useRuntimeState.__setActiveBuffs([{ effect: 'shield_of_faith' }]);

    const m = makeMonster({ armor_class: 15 });
    render(<MonsterCardModal {...makeProps(m)} />);

    const acStatValue = document.querySelector('.mc-stat-value');
    expect(acStatValue.textContent).toContain('17');
    expect(acStatValue.textContent).toContain('Shield of Faith');
  });

  it('does not add shield bonus when activeBuffs does not contain shield_of_faith', () => {
    useRuntimeState.__setActiveBuffs([{ effect: 'other_buff' }]);

    const m = makeMonster({ armor_class: 15 });
    render(<MonsterCardModal {...makeProps(m)} />);

    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.queryByText('+2 Shield of Faith')).not.toBeInTheDocument();
  });

  it('does not add shield bonus when activeBuffs is null', () => {
    useRuntimeState.__setActiveBuffs(null);

    const m = makeMonster({ armor_class: 15 });
    render(<MonsterCardModal {...makeProps(m)} />);

    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.queryByText('+2 Shield of Faith')).not.toBeInTheDocument();
  });

  it('does not add shield bonus when activeBuffs is empty array', () => {
    useRuntimeState.__setActiveBuffs([]);

    const m = makeMonster({ armor_class: 15 });
    render(<MonsterCardModal {...makeProps(m)} />);

    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.queryByText('+2 Shield of Faith')).not.toBeInTheDocument();
  });

  it('shows base AC when shield_of_faith is not the only buff', () => {
    useRuntimeState.__setActiveBuffs([
      { effect: 'shield_of_faith' },
      { effect: 'other_buff' },
      { effect: 'mage_armor' },
    ]);

    const m = makeMonster({ armor_class: 16 });
    render(<MonsterCardModal {...makeProps(m)} />);

    const acStatValue = document.querySelector('.mc-stat-value');
    expect(acStatValue.textContent).toContain('18');
    expect(acStatValue.textContent).toContain('Shield of Faith');
  });
});
