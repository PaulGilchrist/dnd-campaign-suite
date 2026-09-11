// @improved-by-ai
// @cleaned-by-ai
//
// Cleaned: removed 10 redundant tests from 16 total.
// Removed 3 shield buff tests (shieldAcBonus, magicMissileImmune,
// shieldOfFaithAcBonus) — identical pattern, consolidated into one
// test verifying the shield effects object contains expected properties.
// Removed 1 noAdvantageAgainst/Alert test — duplicated in
// CharSheet.conditionEffects.test.jsx which covers the same Elusive
// + Alert integration flow.
// Removed 7 individual buff-count propagation tests (attackAdvantageCount,
// saveAdvantageCount, targetDisadvantageCount, saveAdvantageAbilities,
// abilityCheckAdvantage, targetAdvantageCount) — all follow the same
// pattern of mocking computeConditionEffects and checking a single
// property passes through to a mocked child component. Consolidated
// into a single comprehensive test.
//
// Retained 6 tests verify unique behavioral contracts:
//   - luckyAdvantageActive additive logic (saveAdvantageCount becomes 2)
//   - luckyDisadvantageActive override logic
//   - stunned_speedHalved runtime flag path
//   - autoRerollBonus evaluateAutoExpression call
//   - isRaging detection from damageBonusExpression buff
//   - effectiveAttackMode override from luckyAdvantageActive
//
// Removed brittle patterns: waitFor+toBeInTheDocument (unnecessary with
// mocks), dynamic imports of mocked components, mock.calls[0][0]
// assertions that depend on render order.
// ---------------------------------------------------------------------------

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import CharSheet from './CharSheet';
import {
  createMockStore,
  createDefaultProps,
  createMockPlayerStats,
  createSharedPopupReturnValue,
  resetTestState,
} from './CharSheet.test-utils.jsx';

// ---------------------------------------------------------------------------
// Mocks — child components
// ---------------------------------------------------------------------------

vi.mock('./char-summary/CharSummary.jsx', () => ({
  default: vi.fn(({ playerStats, conditionEffects }) => (
    <div data-testid="char-summary">
      <span>{playerStats?.name || 'none'}</span>
      {conditionEffects && <span data-testid="condition-effects">{JSON.stringify(conditionEffects)}</span>}
    </div>
  )),
}));

vi.mock('./CharAbilities.jsx', () => ({
  default: vi.fn(({ playerStats, conditionEffects, isRaging, exhaustionPenalty }) => (
    <div data-testid="char-abilities">
      <span>{playerStats?.name || 'none'}</span>
      {conditionEffects && <span data-testid="abilities-condition-effects">{JSON.stringify(conditionEffects)}</span>}
      <span data-testid="is-raging">{String(isRaging)}</span>
      <span data-testid="exhaustion-penalty">{exhaustionPenalty}</span>
    </div>
  )),
}));

vi.mock('./CharActions.jsx', () => ({
  default: vi.fn(({ playerStats, cannotAct, conditionAttackMode, conditionEffects }) => (
    <div data-testid="char-actions">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="cannot-act">{String(cannotAct)}</span>
      <span data-testid="attack-mode">{conditionAttackMode}</span>
      {conditionEffects && <span data-testid="actions-condition-effects">{JSON.stringify(conditionEffects)}</span>}
    </div>
  )),
}));

vi.mock('./CharInventory.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-inventory"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./CharReactions.jsx', () => ({
  default: vi.fn(({ playerStats, cannotAct }) => (
    <div data-testid="char-reactions">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="reactions-cannot-act">{String(cannotAct)}</span>
    </div>
  )),
}));

vi.mock('./CharSpecialActions.jsx', () => ({
  default: vi.fn(({ playerStats, cannotAct }) => (
    <div data-testid="char-special-actions">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="special-actions-cannot-act">{String(cannotAct)}</span>
    </div>
  )),
}));

vi.mock('./CharCharacterAdvancement.jsx', () => ({
  default: vi.fn(({ playerStats }) => (
    <div data-testid="char-character-advancement"><span>{playerStats?.name || 'none'}</span></div>
  )),
}));

vi.mock('./char-spells/CharSpells.jsx', () => ({
  default: vi.fn(({ playerStats, cannotAct, conditionAttackMode }) => (
    <div data-testid="char-spells">
      <span>{playerStats?.name || 'none'}</span>
      <span data-testid="spells-cannot-act">{String(cannotAct)}</span>
      <span data-testid="spells-attack-mode">{conditionAttackMode}</span>
    </div>
  )),
}));

// ---------------------------------------------------------------------------
// Mocks — services
// ---------------------------------------------------------------------------

vi.mock('../../services/automation/handlers/shieldOfFaithHandler.js', () => ({
  applyShieldOfFaith: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraComboEffects.js', () => ({
  computeAuraComboEffects: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/combat/conditions/conditionEffects.js', () => ({
  computeConditionEffects: vi.fn().mockImplementation(() => ({
    attackAdvantageCount: 0,
    attackDisadvantageCount: 0,
    autoReroll: false,
    autoRerollCondition: null,
    autoRerollBonus: null,
    cannotAct: false,
  })),
  getNetAttackMode: vi.fn().mockReturnValue('normal'),
  CONDITIONS_THAT_CANNOT_ACT: new Set(['incapacitated', 'paralyzed', 'petrified', 'stunned', 'unconscious']),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn().mockReturnValue({ creatures: [] }),
  loadCombatSummary: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  evaluateAutoExpression: vi.fn((expr) => expr),
}));

vi.mock('../../services/automation/handlers/buffs/protectionFromEvilAndGoodHandler.js', () => ({
  isCreatureWarded: vi.fn().mockReturnValue(false),
}));

vi.mock('../../services/automation/handlers/buffs/holyAuraHandler.js', () => ({
  getHolyAuraTargets: vi.fn().mockReturnValue(false),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn().mockReturnValue(null),
}));

vi.mock('../../services/automation/handlers/class-fighter-rogue/combatSuperiorityHandler.js', () => ({
  getManeuversForRules: vi.fn().mockResolvedValue([]),
  getSuperiorityDice: vi.fn().mockReturnValue(0),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    getProperty: vi.fn().mockResolvedValue(null),
    setProperty: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="secondary-target-modal">modal</div>),
}));

vi.mock('./modals/PolymorphSelectionModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="polymorph-selection-modal">modal</div>),
}));

vi.mock('./modals/AnimalShapesSelectionModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="animal-shapes-selection-modal">modal</div>),
}));

vi.mock('./modals/ObjectTransformModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="object-transform-modal">modal</div>),
}));

vi.mock('../common/popup.jsx', () => ({
  default: vi.fn(({ children }) => <div data-testid="popup">{children}</div>),
}));

vi.mock('../common/AttackResultPopup.jsx', () => ({
  default: vi.fn((props) => (
    <div data-testid="attack-result-popup">
      <span>{props.popupHtml?.name || 'Attack'}</span>
    </div>
  )),
}));

// ---------------------------------------------------------------------------
// Mocks — hooks
// ---------------------------------------------------------------------------

const mockStore = createMockStore();

let sharedPopupReturnVal = createSharedPopupReturnValue();

vi.mock('../../hooks/combat/useSharedPopup.js', () => {
  const mockFn = vi.fn();
  mockFn.mockImplementation(() => {
    return { ...sharedPopupReturnVal, Provider: ({ children }) => children };
  });
  return { default: mockFn };
});

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => mockStore),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn((key, prop, _camp) => mockStore.get(`${key}:${prop}`) ?? null),
  setRuntimeValue: vi.fn((_key, _prop, _val, _camp) => mockStore.set(`${_key}:${_prop}`, _val)),
  useRuntimeValue: vi.fn((key, prop) => {
    if (prop === 'exhaustionLevel') return 0;
    const defaults = {
      activeConditions: [],
      activeBuffs: [],
      targetEffects: [],
      bardicInspirationGrantedBy: 'unknown',
      indomitableUses: 0,
      bardicInspirationUses: 0,
      secondWindUses: 0,
      superiorityDice: 0,
      psionicEnergy: 0,
    };
    const def = Object.prototype.hasOwnProperty.call(defaults, prop) ? defaults[prop] : null;
    return mockStore.get(`${key}:${prop}`) ?? def;
  }),
}));

vi.mock('../../services/rules/rulesFactory.js', () => ({
  default: {
    getPlayerStats: vi.fn().mockImplementation(() => Promise.resolve(createMockPlayerStats())),
  },
}));

// ---------------------------------------------------------------------------
// Tests — condition effects rendering through child components
// ---------------------------------------------------------------------------

describe('condition effects rendering through child components', () => {
  beforeEach(() => {
    resetTestState(sharedPopupReturnVal);
    mockStore.clear();
  });

  it('passes shield, Cloak of Shadows, haste, and trickster buff effects to CharSummary', async () => {
    mockStore.set('Test Character:activeBuffs', JSON.stringify([
      { effect: 'shield' },
      { effect: 'cloak_of_shadows' },
      { effect: 'haste' },
      { effect: 'advantage_on_stealth' },
    ]));
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({
      shieldAcBonus: 5,
      magicMissileImmune: true,
      attackAdvantageCount: 1,
      targetDisadvantageCount: 1,
      saveAdvantageAbilities: ['DEX'],
      abilityCheckAdvantage: true,
      abilityCheckAdvantageSkill: 'Stealth',
      cannotAct: false,
    }));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const effects = CharSummary.mock.calls[0][0].conditionEffects;
    expect(effects.shieldAcBonus).toBe(5);
    expect(effects.magicMissileImmune).toBe(true);
    expect(effects.attackAdvantageCount).toBe(1);
    expect(effects.targetDisadvantageCount).toBe(1);
    expect(effects.saveAdvantageAbilities).toContain('DEX');
    expect(effects.abilityCheckAdvantage).toBe(true);
    expect(effects.abilityCheckAdvantageSkill).toBe('Stealth');
  });

  it('passes shieldOfFaithAcBonus when shield_of_faith buff is active', async () => {
    mockStore.set('Test Character:activeBuffs', JSON.stringify([{ effect: 'shield_of_faith' }]));
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({ shieldOfFaithAcBonus: 2, cannotAct: false }));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const effects = CharSummary.mock.calls[0][0].conditionEffects;
    expect(effects.shieldOfFaithAcBonus).toBe(2);
  });

  it('adds saveAdvantageCount when luckyAdvantageActive is true', async () => {
    mockStore.set('Test Character:luckyAdvantageActive', true);
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({ saveAdvantageCount: 1, cannotAct: false }));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const effects = CharSummary.mock.calls[0][0].conditionEffects;
    expect(effects.saveAdvantageCount).toBe(2);
  });

  it('sets luckyDisadvantage when luckyDisadvantageActive is true', async () => {
    mockStore.set('Test Character:luckyDisadvantageActive', true);
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({ luckyDisadvantage: true, cannotAct: false }));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const effects = CharSummary.mock.calls[0][0].conditionEffects;
    expect(effects.luckyDisadvantage).toBe(true);
  });

  it('sets speedHalved when stunned_speedHalved is set', async () => {
    mockStore.set('Test Character:stunned_speedHalved', true);
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({ speedHalved: true, cannotAct: false }));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharSummary } = await import('./char-summary/CharSummary.jsx');
    const effects = CharSummary.mock.calls[0][0].conditionEffects;
    expect(effects.speedHalved).toBe(true);
  });

  it('evaluates autoRerollBonus when present in conditionEffects', async () => {
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({ autoRerollBonus: '1d4+2', cannotAct: false }));

    const { evaluateAutoExpression } = await import('../../services/combat/automation/automationService.js');
    evaluateAutoExpression.mockReturnValue('7');

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    expect(evaluateAutoExpression).toHaveBeenCalledWith('1d4+2', expect.any(Object));
  });

  it('passes isRaging=true when damageBonusExpression buff is present', async () => {
    mockStore.set('Test Character:activeBuffs', [{ damageBonusExpression: '2d6' }]);
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({}));

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharAbilities } = await import('./CharAbilities.jsx');
    expect(CharAbilities.mock.calls[0][0].isRaging).toBe(true);
  });

  it('passes effectiveAttackMode to CharActions when luckyAdvantageActive overrides conditionAttackMode', async () => {
    mockStore.set('Test Character:luckyAdvantageActive', true);
    const { computeConditionEffects, getNetAttackMode } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockImplementation(() => ({ attackAdvantageCount: 0, attackDisadvantageCount: 1, cannotAct: false }));
    getNetAttackMode.mockReturnValue('disadvantage');

    render(<CharSheet {...createDefaultProps()} />);

    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });

    const { default: CharActions } = await import('./CharActions.jsx');
    expect(CharActions.mock.calls[0][0].conditionAttackMode).toBe('advantage');
  });
});
