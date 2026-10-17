// @maintained-by-ai
// CharSheet RENDER lane — sheet-side buff additive + feature-flag stamps.
// computeConditionEffects (service) is mocked to a NEUTRAL base here so every
// asserted value is stamped by the sheet itself (CharSheet.conditionEffects.js
// post-compute modifiers + CharSheet.jsx lucky flags). If a stamp line is
// deleted, these tests fail — that is the contract this lane owns.
//
// Lane split (do not re-add here):
//   - full conditionEffects passthrough / cannotAct split / exhaustion scaling
//     -> CharSheet.conditionEffects.test.jsx
//   - CLA-218 mageHand gating -> CharSheet.conditionEffects.mageHand.test.js
//   - SP-111 action-block rider -> CharSheet.conditionEffects.stinkingBlock.test.js
//   - exhaustionLevel clamping -> CharSheet.rendering-state.test.jsx
//
// Notes:
//   - activeBuffs must be stored as a real array (the sheet reads it raw and
//     buffsHave() Array.isArray() guards it) — a JSON string silently no-ops.
//   - autoRerollBonus pins the EVALUATED result landing in conditionEffects,
//     not just the evaluateAutoExpression call.
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
// Mocks — child components (spans expose the props this lane asserts)
// ---------------------------------------------------------------------------

vi.mock('./char-summary/CharSummary.jsx', () => ({
  default: vi.fn(({ conditionEffects }) => (
    <div data-testid="char-summary">
      {conditionEffects && <span data-testid="condition-effects">{JSON.stringify(conditionEffects)}</span>}
    </div>
  )),
}));

vi.mock('./CharAbilities.jsx', () => ({
  default: vi.fn(({ isRaging }) => (
    <div data-testid="char-abilities">
      <span data-testid="is-raging">{String(isRaging)}</span>
    </div>
  )),
}));

vi.mock('./CharActions.jsx', () => ({
  default: vi.fn(({ conditionAttackMode }) => (
    <div data-testid="char-actions">
      <span data-testid="attack-mode">{conditionAttackMode}</span>
    </div>
  )),
}));

vi.mock('./CharInventory.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-inventory" />),
}));

vi.mock('./CharReactions.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-reactions" />),
}));

vi.mock('./CharSpecialActions.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-special-actions" />),
}));

vi.mock('./CharCharacterAdvancement.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-character-advancement" />),
}));

vi.mock('./char-spells/CharSpells.jsx', () => ({
  default: vi.fn(({ conditionAttackMode }) => (
    <div data-testid="char-spells">
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
  computeConditionEffects: vi.fn().mockReturnValue({}),
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
  default: vi.fn(() => <div data-testid="attack-result-popup" />),
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
// Tests — sheet-side stamps onto conditionEffects / child props
// ---------------------------------------------------------------------------

describe('CharSheet post-compute buff and feature-flag stamps', () => {
  beforeEach(() => {
    resetTestState(sharedPopupReturnVal);
    mockStore.clear();
  });

  const renderSheet = async () => {
    render(<CharSheet {...createDefaultProps()} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    return JSON.parse(screen.getByTestId('condition-effects').textContent);
  };

  // applyPostComputeModifiers: buffs in the runtime store must be mapped onto
  // conditionEffects by the sheet (the mocked service supplies none of these
  // values). Also folds in the autoRerollBonus evaluation: the evaluated
  // result — not the raw expression — must land in conditionEffects.
  it.each([
    {
      label: 'active buffs stamp every mapped effect and autoRerollBonus is evaluated',
      buffs: [
        { effect: 'shield' },
        { effect: 'shield_of_faith' },
        { effect: 'cloak_of_shadows' },
        { effect: 'haste' },
        { effect: 'advantage_on_stealth' },
      ],
      base: { saveAdvantageCount: 1, autoRerollBonus: '1d4+2' },
      rerollResult: '7',
    },
    {
      label: 'no buffs stamps nothing and no reroll expression is evaluated',
      buffs: [],
      base: {},
      rerollResult: null,
    },
  ])('$label', async ({ buffs, base, rerollResult }) => {
    mockStore.set('Test Character:activeBuffs', buffs);
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockReturnValue(base);
    const { evaluateAutoExpression } = await import('../../services/combat/automation/automationService.js');
    if (rerollResult) evaluateAutoExpression.mockReturnValueOnce(rerollResult);

    const effects = await renderSheet();

    if (buffs.length) {
      expect(effects.saveAdvantageCount).toBe(1); // buffs must not touch non-mapped counts
      expect(effects.shieldAcBonus).toBe(5);
      expect(effects.magicMissileImmune).toBe(true);
      expect(effects.shieldOfFaithAcBonus).toBe(2);
      expect(effects.attackAdvantageCount).toBe(1); // cloak of shadows
      expect(effects.targetDisadvantageCount).toBe(1); // cloak of shadows
      expect(effects.saveAdvantageAbilities).toEqual(['DEX']); // haste
      expect(effects.abilityCheckAdvantage).toBe(true);
      expect(effects.abilityCheckAdvantageSkill).toBe('Stealth');
      expect(effects.autoRerollBonus).toBe('7'); // evaluated result, not '1d4+2'
    } else {
      expect(effects.shieldAcBonus).toBeUndefined();
      expect(effects.magicMissileImmune).toBeUndefined();
      expect(effects.shieldOfFaithAcBonus).toBeUndefined();
      expect(effects.attackAdvantageCount).toBeUndefined();
      expect(effects.targetDisadvantageCount).toBeUndefined();
      expect(effects.saveAdvantageAbilities).toBeUndefined();
      expect(effects.abilityCheckAdvantage).toBeFalsy();
      expect(effects.autoRerollBonus).toBeUndefined();
      expect(evaluateAutoExpression).not.toHaveBeenCalled();
    }
  });

  // CharSheet.jsx lucky flags: luckyAdvantageActive adds a save advantage and
  // overrides the net attack mode for actions AND spells; luckyDisadvantageActive
  // stamps luckyDisadvantage. The compute mock never stamps these itself.
  it.each([
    { label: 'lucky advantage adds a save advantage and overrides mode to advantage', luckyAdv: true, luckyDis: false, expectedMode: 'advantage', expectedSaveAdvantageCount: 2, expectedLuckyDisadvantage: undefined },
    { label: 'lucky disadvantage stamps luckyDisadvantage without touching mode', luckyAdv: false, luckyDis: true, expectedMode: 'disadvantage', expectedSaveAdvantageCount: 1, expectedLuckyDisadvantage: true },
    { label: 'neither flag leaves counts and mode untouched', luckyAdv: false, luckyDis: false, expectedMode: 'disadvantage', expectedSaveAdvantageCount: 1, expectedLuckyDisadvantage: undefined },
  ])('lucky flags — $label', async ({ luckyAdv, luckyDis, expectedMode, expectedSaveAdvantageCount, expectedLuckyDisadvantage }) => {
    mockStore.set('Test Character:luckyAdvantageActive', luckyAdv);
    mockStore.set('Test Character:luckyDisadvantageActive', luckyDis);
    const { computeConditionEffects, getNetAttackMode } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockReturnValue({ attackAdvantageCount: 0, attackDisadvantageCount: 1, saveAdvantageCount: 1 });
    getNetAttackMode.mockReturnValue('disadvantage');

    const effects = await renderSheet();

    expect(effects.saveAdvantageCount).toBe(expectedSaveAdvantageCount);
    expect(effects.luckyDisadvantage).toBe(expectedLuckyDisadvantage);
    expect(screen.getByTestId('attack-mode')).toHaveTextContent(expectedMode);
    expect(screen.getByTestId('spells-attack-mode')).toHaveTextContent(expectedMode);
    // The override happens after the net mode is computed — raw counts, not
    // the lucky flag, must be what reaches getNetAttackMode.
    expect(getNetAttackMode).toHaveBeenCalledWith(0, 1, undefined);
  });

  // stunned_speedHalved runtime flag (written by saveOnlyHandler) is stamped
  // onto conditionEffects by the sheet's runtime read.
  it.each([
    { label: 'flag set halves speed', set: true, expected: true },
    { label: 'flag unset leaves speed unhalved', set: false, expected: undefined },
  ])('stunned_speedHalved — $label', async ({ set, expected }) => {
    mockStore.set('Test Character:stunned_speedHalved', set);
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockReturnValue({});

    const effects = await renderSheet();

    expect(effects.speedHalved).toBe(expected);
  });

  // isRaging is derived from a damageBonusExpression buff (computeConditionFlags)
  // and plumbed to CharAbilities — any buff without one must not read as rage.
  it('passes isRaging to CharAbilities only when a damageBonusExpression buff is active', async () => {
    const { computeConditionEffects } = await import('../../services/combat/conditions/conditionEffects.js');
    computeConditionEffects.mockReturnValue({});

    mockStore.set('Test Character:activeBuffs', [{ damageBonusExpression: '2d6' }]);
    const first = render(<CharSheet {...createDefaultProps()} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('is-raging')).toHaveTextContent('true');
    first.unmount();

    mockStore.set('Test Character:activeBuffs', [{ effect: 'shield' }]);
    render(<CharSheet {...createDefaultProps()} />);
    await waitFor(() => {
      expect(screen.getByTestId('char-sheet')).toBeInTheDocument();
    });
    expect(screen.getByTestId('is-raging')).toHaveTextContent('false');
  });
});
