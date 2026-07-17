// @cleaned-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => _syncedStore),
  useSyncedState: vi.fn((_, key, defaultValue) => {
    const hasValue = _syncedStore.has(key);
    const value = hasValue ? _syncedStore.get(key) : defaultValue;
    const setter = vi.fn((newValue) => {
      _syncedStore.set(key, newValue);
    });
    return [value, setter];
  }),
  useRuntimeValue: vi.fn((_, key, _campaignName) => {
    const hasValue = _syncedStore.has(key);
    return hasValue ? _syncedStore.get(key) : null;
  }),
  listeners: new Map(),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn(), quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null, gateMetamagic: vi.fn(), handleConfirm: vi.fn(), handleSkip: vi.fn(),
    pendingAid: null, handleAidConfirm: vi.fn(), handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null, handleGreaterRestorationConfirm: vi.fn(), handleGreaterRestorationSkip: vi.fn(),
    pendingRemoveCurse: null, handleRemoveCurseConfirm: vi.fn(), handleRemoveCurseSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({ buildUpcastLevels: vi.fn(() => []) })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false), collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })), evaluateAutoExpression: vi.fn(() => null),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null), getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/rules/combat/rangeValidation.js', () => ({
  getNearestPlacedItem: vi.fn(() => null),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn((entity) => {
    if (entity.details) return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    return null;
  }),
}));

vi.mock('./DiceRollResult.jsx', () => ({
  default: vi.fn(() => <div data-testid="dice-roll-result">DiceRollResult</div>),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn(() => <div data-testid="metamagic-popup">MetamagicPopup</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn(() => <div data-testid="spell-detail-popup">SpellDetailPopup</div>),
}));

vi.mock('./EmpoweredSpellPopup.jsx', () => ({
  default: vi.fn(() => <div data-testid="empowered-spell-popup">EmpoweredSpellPopup</div>),
}));

vi.mock('./CharBonusActions.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-bonus-actions">CharBonusActions</div>),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })), getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((name) => ({ baseName: name })),
}));

vi.mock('../../services/character/classFeatures.js', () => ({
  getClassFeatures: vi.fn(() => ({ maxFocusPoints: 2 })),
}));

vi.mock('../../services/character/featRangeService.js', () => ({
  computeFeatRangeEffects: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 5, rolls: [3, 2], modifier: 0 })),
  rollExpressionDoubled: vi.fn(() => ({ total: 10, rolls: [3, 2, 3, 2], modifier: 0 })),
  rollExpressionMaximized: vi.fn(() => ({ total: 48, rolls: [6, 6, 6, 6, 6, 6, 6, 6], modifier: 0 })),
}));

vi.mock('../../hooks/combat/useActionSpellMetamagic.js', () => ({
  useActionSpellMetamagic: vi.fn(() => ({
    pendingActionMetamagic: null, handleActionMetamagicConfirm: vi.fn(), handleActionMetamagicSkip: vi.fn(),
    handleActionSpellDamageClick: vi.fn(), handleSpellAttackClick: vi.fn(), handleSpellDamageClick: vi.fn(),
  })),
}));

import CharActions from './CharActions.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';

const basePlayerStats = {
  name: 'TestCharacter', rules: '5e', level: 5, attacks: [], actions: [], spellAbilities: { spells: [] },
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

function renderWithHaste(stats, props = {}) {
  getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'activeBuffs') return [{ effect: 'haste', name: 'Haste' }];
    return null;
  });
  return render(<CharActions playerStats={stats} {...props} />, props.wrapper ? { wrapper: props.wrapper } : undefined);
}

function renderWithDiceRollContext(stats, props = {}) {
  const mockSetPopupHtml = vi.fn();
  const wrapper = ({ children }) => (
    <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
      {children}
    </DiceRollContext.Provider>
  );
  const rendered = renderWithHaste(stats, { ...props, wrapper });
  return { ...rendered, mockSetPopupHtml };
}

describe('CharActions haste extra action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
  });

  describe('visibility', () => {
    it('hides the section when no haste buff is active', async () => {
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.queryByText('Haste Extra Action')).not.toBeInTheDocument();
    });

    it('shows the section when haste buff is active', async () => {
      await act(async () => { renderWithHaste(createStats()); });
      expect(screen.getByText('Haste Extra Action')).toBeInTheDocument();
    });
  });

  describe('action click behavior', () => {
    it('marks haste as used and shows popup for Attack click', async () => {
      const { mockSetPopupHtml } = renderWithDiceRollContext(createStats());

      const attackBtn = screen.getByText('Attack');
      await act(async () => { fireEvent.click(attackBtn); });

      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'hasteExtraActionUsed', true, undefined);
      expect(mockSetPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info',
        name: 'Haste',
        description: 'Haste extra action: Attack (one weapon attack only).',
      });
    });

    it.each([
      ['Dash', 'Haste extra action: Dash.'],
      ['Disengage', 'Haste extra action: Disengage.'],
      ['Hide', 'Haste extra action: Hide.'],
      ['Use an Object', 'Haste extra action: Use an Object.'],
    ])('marks haste as used and shows popup for %s click', async (actionName, expectedDescription) => {
      const { mockSetPopupHtml } = renderWithDiceRollContext(createStats());

      const btn = screen.getByText(actionName);
      await act(async () => { fireEvent.click(btn); });

      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'hasteExtraActionUsed', true, undefined);
      expect(mockSetPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info',
        name: 'Haste',
        description: expectedDescription,
      });
    });

    it('does not show a popup when an action is clicked while cannotAct', async () => {
      const { mockSetPopupHtml } = renderWithDiceRollContext(createStats(), { cannotAct: true });

      const dashBtn = screen.getByText('Dash');
      await act(async () => { fireEvent.click(dashBtn); });

      expect(mockSetPopupHtml).not.toHaveBeenCalled();
    });

    it('does not trigger any action when haste was already used', async () => {
      const mockSetPopupHtml = vi.fn();
      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'haste', name: 'Haste' }];
        if (key === 'hasteExtraActionUsed') return true;
        return null;
      });
      await act(async () => { render(<CharActions playerStats={createStats()} />, { wrapper }); });

      const attackBtn = screen.getByText('Attack');
      await act(async () => { fireEvent.click(attackBtn); });

      expect(mockSetPopupHtml).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
    });

    it('passes campaignName to setRuntimeValue when provided', async () => {
      const { mockSetPopupHtml } = renderWithDiceRollContext(createStats(), { campaignName: 'my-campaign' });

      const attackBtn = screen.getByText('Attack');
      await act(async () => { fireEvent.click(attackBtn); });

      expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'hasteExtraActionUsed', true, 'my-campaign');
      expect(mockSetPopupHtml).toHaveBeenCalledWith({
        type: 'automation_info',
        name: 'Haste',
        description: 'Haste extra action: Attack (one weapon attack only).',
      });
    });
  });
});
