// @improved-by-ai
// @cleaned-by-ai
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MonsterCardModal from './MonsterCardModal.jsx';
import { makeMonster, makeProps, defaultConditionEffects } from './MonsterCardModal.test-utils.js';

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
  let _computeReturn = null;
  const computeConditionEffects = vi.fn((_conditions) => {
    return _computeReturn ?? { ...defaultConditionEffects };
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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  let _inspiringMoveNoOA = false;
  let _remarkableNoOA = false;
  let _targetEffects = [];
  let _activeBuffs = null;

  const mockUseRuntimeValue = vi.fn((_characterKey, propertyName, _campaignName) => {
    if (propertyName === 'targetEffects') return _targetEffects;
    if (propertyName === 'inspiringMovementNoOA') return _inspiringMoveNoOA;
    if (propertyName === 'remarkableAthleteNoOA') return _remarkableNoOA;
    return null;
  });

  const mockGetRuntimeValue = vi.fn((_characterKey, propertyName, _campaignName) => {
    if (propertyName === 'activeBuffs') return _activeBuffs;
    return null;
  });

  return {
    useRuntimeValue: mockUseRuntimeValue,
    setRuntimeValue: vi.fn(),
    getRuntimeValue: mockGetRuntimeValue,
    __setInspiringMoveNoOA(val) { _inspiringMoveNoOA = val; },
    __setRemarkableNoOA(val) { _remarkableNoOA = val; },
    __setTargetEffects(val) { _targetEffects = val; },
    __setActiveBuffs(val) { _activeBuffs = val; },
  };
});

// ── Re-import mocked modules for test setup helpers ─────────────────────────

import * as damageUtils from '../../services/rules/combat/damageUtils.js';
import * as useRuntimeState from '../../hooks/runtime/useRuntimeState.js';

// ── Tests ───────────────────────────────────────────────────────────────────

describe('MonsterCardModal - monsterSensesArray useMemo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    damageUtils.__setFindCreatureReturn(null);
    useRuntimeState.__setTargetEffects([]);
    useRuntimeState.__setActiveBuffs(null);
  });

  it.each([
    { senseKey: 'blindsight', value: 60, expectedText: 'blindsight 60' },
    { senseKey: 'truesight', value: 120, expectedText: 'truesight 120' },
    { senseKey: 'tremorsense', value: 60, expectedText: 'tremorsense 60' },
    { senseKey: 'passive_perception', value: 15, expectedText: 'passive Perception 15' },
  ])('renders $senseKey with numeric value $value', ({ senseKey, value, expectedText }) => {
    const m = makeMonster({ senses: { [senseKey]: value } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  it('renders darkvision when value is a string with "ft." suffix', () => {
    const m = makeMonster({ senses: { darkvision: '60 ft.' } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('darkvision 60 ft.')).toBeInTheDocument();
  });

  it('renders darkvision when value is a plain number', () => {
    const m = makeMonster({ senses: { darkvision: 60 } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('darkvision 60')).toBeInTheDocument();
  });

  it('skips null/undefined sense values without rendering them', () => {
    const m = makeMonster({ senses: { blindsight: 60, darkvision: null, truesight: undefined, tremorsense: 30 } });
    render(<MonsterCardModal {...makeProps(m)} />);
    const sensesRow = screen.getByText(/Senses/).closest('.mc-defense-row');
    expect(sensesRow.textContent).toContain('blindsight 60');
    expect(sensesRow.textContent).toContain('tremorsense 30');
    expect(sensesRow.textContent).not.toContain('darkvision');
    expect(sensesRow.textContent).not.toContain('truesight');
  });

  it.each([
    { label: 'null', senses: null },
    { label: 'undefined', senses: undefined },
    { label: 'empty object', senses: {} },
    { label: 'all null values', senses: { blindsight: null, darkvision: null, truesight: null, tremorsense: null, passive_perception: null } },
  ])('does not render senses section when senses is $label', ({ senses }) => {
    const m = makeMonster({ senses });
    if (senses === undefined) {
      delete m.senses;
    }
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.queryByText('Senses')).not.toBeInTheDocument();
  });

  it('renders senses section when only passive_perception is set', () => {
    const m = makeMonster({ senses: { passive_perception: 18 } });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('passive Perception 18')).toBeInTheDocument();
  });
});

describe('MonsterCardModal - shieldOfFaithBonus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    damageUtils.__setFindCreatureReturn(null);
    useRuntimeState.__setTargetEffects([]);
    useRuntimeState.__setActiveBuffs(null);
  });

  it('displays base AC when activeBuffs is empty (no shield_of_faith)', () => {
    useRuntimeState.__setActiveBuffs([]);
    const m = makeMonster({ armor_class: 15 });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('displays AC plus 2 when shield_of_faith buff is active', () => {
    useRuntimeState.__setActiveBuffs([{ effect: 'shield_of_faith' }]);
    const m = makeMonster({ armor_class: 15 });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText(/17 \(\+2 Shield of Faith\)/)).toBeInTheDocument();
  });

  it('displays base AC when other buffs are active but not shield_of_faith', () => {
    useRuntimeState.__setActiveBuffs([
      { effect: 'bless' },
      { effect: 'protection_from_evil_and_good' },
    ]);
    const m = makeMonster({ armor_class: 15 });
    render(<MonsterCardModal {...makeProps(m)} />);
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.queryByText(/Shield of Faith/)).not.toBeInTheDocument();
  });
});
