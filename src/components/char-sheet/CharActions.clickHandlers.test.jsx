// @cleaned-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';

vi.mock('../../hooks/combat/useSpellMetamagicFlow.js', () => ({
  useSpellMetamagicFlow: vi.fn(() => ({
    pendingMetamagic: null,
    gateMetamagic: vi.fn(),
    handleConfirm: vi.fn(),
    handleSkip: vi.fn(),
    pendingAid: null,
    handleAidConfirm: vi.fn(),
    handleAidSkip: vi.fn(),
    pendingGreaterRestoration: null,
    handleGreaterRestorationConfirm: vi.fn(),
    handleGreaterRestorationSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useSpellUpcastFlow.js', () => ({
  useSpellUpcastFlow: vi.fn(() => ({
    buildUpcastLevels: vi.fn(() => []),
  })),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
  collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })),
  evaluateAutoExpression: vi.fn(() => null),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
  onSpellSelected: vi.fn(),
}));

vi.mock('../../hooks/combat/useMetamagic.js', () => ({
  getCurrentSorceryPoints: vi.fn(() => 10),
  getMaxSorceryPoints: vi.fn(() => 10),
  spendSorceryPoints: vi.fn(),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn((_playerName, _campaignName) => ({ saveDcBonus: 0 })),
}));

const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => _syncedStore),
  useSyncedState: vi.fn((_, key, defaultValue) => {
    const hasValue = _syncedStore.has(key);
    const value = hasValue ? _syncedStore.get(key) : defaultValue;
    const setter = vi.fn((newValue) => {
      _syncedStore.set(key, newValue);
    });
    return [value, setter];
  }),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  setRuntimeBatch: vi.fn(),
  useRuntimeValue: vi.fn((_, key, _campaignName) => {
    const hasValue = _syncedStore.has(key);
    return hasValue ? _syncedStore.get(key) : null;
  }),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
  loadMapData: vi.fn(() => Promise.resolve({})),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
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
    if (entity.details) {
      return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    }
    return null;
  }),
}));

vi.mock('./DiceRollResult.jsx', () => ({
  default: vi.fn((props) => <div data-testid="dice-roll-result">{props.name || 'DiceRollResult'}</div>),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="metamagic-popup">{props.spell?.name || 'MetamagicPopup'}</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn((props) => <div data-testid="spell-detail-popup">{props.spell?.name || 'SpellDetailPopup'}</div>),
}));

vi.mock('./EmpoweredSpellPopup.jsx', () => ({
  default: vi.fn((_props) => <div data-testid="empowered-spell-popup">EmpoweredSpellPopup</div>),
}));

vi.mock('./CharBonusActions.jsx', () => ({
  default: vi.fn((_props) => <div data-testid="char-bonus-actions">CharBonusActions</div>),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
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
}));

vi.mock('../../services/rules/features/friendsService.js', () => ({
  endFriendsOnHostileAction: vi.fn(),
}));

vi.mock('../../services/rules/features/invisibilityService.js', () => ({
  endInvisibilityOnHostileAction: vi.fn(),
}));

vi.mock('../../services/automation/contextBuilder.js', () => ({
  buildAttackContext: vi.fn(() => Promise.resolve({ hitBonus: 5 })),
  buildAttackContextSync: vi.fn(() => ({ hitBonus: 5 })),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => {
  const _mockSetPopupHtml = vi.fn();
  const _mockRollAttack = vi.fn();
  const _mockRollDamage = vi.fn();
  const _mockQuickRollPlayerSave = vi.fn();
  return {
    default: vi.fn(() => ({
      popupHtml: null,
      setPopupHtml: _mockSetPopupHtml,
      rollAttack: _mockRollAttack,
      rollDamage: _mockRollDamage,
      quickRollPlayerSave: _mockQuickRollPlayerSave,
      saveDcBonus: 0,
    })),
  };
});

vi.mock('./useCharActionModals.js', () => ({
  default: vi.fn(() => ({
    pendingDamage: null,
    modalState: {},
    setModalState: vi.fn(),
    resolveAttackDamage: vi.fn(),
    handleMasteryClose: vi.fn(),
    handleWeaponMasteryChoice: vi.fn(),
    handleWeaponKindMasteryClose: vi.fn(),
    handleDivineFuryDamageType: vi.fn(),
    handleDivineFurySkip: vi.fn(),
    handleGenericDamageTypeChoice: vi.fn(),
    handleGenericDamageTypeSkip: vi.fn(),
    handleDamageTypeModifierChoice: vi.fn(),
    handleDamageTypeModifierSkip: vi.fn(),
    handleEnhancedUnarmedChoice: vi.fn(),
    handleEnhancedUnarmedSkip: vi.fn(),
    handleFeatureChoiceConfirm: vi.fn(),
    handleFeatureChoiceSkip: vi.fn(),
    handleConstellationSelect: vi.fn(),
    combatSuperiorityModal: null,
    setCombatSuperiorityModal: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(),
    handleAttackRiderManeuverUse: vi.fn(),
    handleAttackRiderManeuverSkip: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useActionSpellMetamagic.js', () => ({
  useActionSpellMetamagic: vi.fn(() => ({
    pendingActionMetamagic: null,
    handleActionMetamagicConfirm: vi.fn(),
    handleActionMetamagicSkip: vi.fn(),
    resolveSpellDamage: vi.fn(),
    handleSpellAttackClick: vi.fn(),
  })),
}));

import { useActionSpellMetamagic } from '../../hooks/combat/useActionSpellMetamagic.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import { isExhausted } from '../../services/automation/handlers/combat/saveAttackHandler.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getInnateSorceryBonus } from '../../services/combat/buffs/buffService.js';
import { executeHandler } from '../../services/automation/index.js';
import { addEntry } from '../../services/ui/logService.js';

const basePlayerStats = {
  name: 'TestCharacter',
  rules: '5e',
  level: 5,
  attacks: [],
  actions: [],
  spellAbilities: { spells: [] },
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

function renderWithFetch(component, options = {}) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve([]),
  });
  return act(async () => { render(component, options); });
}

describe('CharActions click handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
  });

  describe('spell attack/damage click handlers', () => {
    it('calls resolveSpellDamage when damage is clicked for save-DC attack', async () => {
      const mockResolveSpellDamage = vi.fn();
      vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });

      useActionSpellMetamagic.mockReturnValue({
        pendingActionMetamagic: null,
        handleActionMetamagicConfirm: vi.fn(),
        handleActionMetamagicSkip: vi.fn(),
        handleActionSpellDamageClick: mockResolveSpellDamage,
        handleSpellAttackClick: vi.fn(),
      });

      const stats = createStats({
        attacks: [{ name: 'Witch Bolt', range: 60, saveDc: 14, saveType: 'CON', damage: '1d12', damageType: 'Lightning', type: 'Action' }],
      });

      await renderWithFetch(<CharActions playerStats={stats} />);
      const damageElement = screen.getByText('1d12');
      await act(async () => { fireEvent.click(damageElement); });
      expect(mockResolveSpellDamage).toHaveBeenCalledWith(stats.attacks[0]);
    });

    it('logs a simple damage roll for non-save-DC weapon attacks (no targeting or riders)', async () => {
      vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });
      const mockSetPopupHtml = vi.fn();

      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });

      await act(async () => {
        const wrapper = ({ children }) => (
          <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
            {children}
          </DiceRollContext.Provider>
        );
        render(<CharActions playerStats={stats} campaignName="my-campaign" />, { wrapper });
      });
      const damageElement = screen.getByText('1d8+3');
      await act(async () => { fireEvent.click(damageElement); });
      await act(async () => { await Promise.resolve(); });
      expect(vi.mocked(addEntry)).toHaveBeenCalledWith('my-campaign', expect.objectContaining({
        type: 'roll',
        rollType: 'damage',
        name: 'Longsword',
        formula: '1d8+3',
        note: 'Direct damage roll (no target)',
      }));
      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
        type: 'damage',
        name: 'Longsword',
        formula: '1d8+3',
        note: 'Direct damage roll (no target)',
      }));
    });
  });

  describe('automation handling', () => {
    it('calls executeHandler when action with automation is clicked and shows popup on result', async () => {
      hasAutomation.mockReturnValue(true);
      const mockSetPopupHtml = vi.fn();
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), quickRollPlayerSave: vi.fn(), saveDcBonus: 0,
      });
      executeHandler.mockResolvedValue({ type: 'popup', payload: '<div>Popup</div>' });

      vi.mocked(getRuntimeValue).mockReturnValue(null);

      const stats = createStats({
        actions: [{ name: 'Smite', description: 'Strike with divine power.', automation: { type: 'auto_effect' } }],
      });

      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      await renderWithFetch(<CharActions playerStats={stats} />, { wrapper });
      const actionName = screen.getByText(/Smite:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
        expect(mockSetPopupHtml).toHaveBeenCalledWith('<div>Popup</div>');
      });
    });

    it('dispatches automation when rage action is exhausted (handler shows popup)', async () => {
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(true);

      const stats = createStats({
        actions: [{ name: 'Berserker Rage', description: 'You enter a rage.', automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage' } }],
      });

      await renderWithFetch(<CharActions playerStats={stats} />);
      const actionName = screen.getByText(/Rage:/);
      await act(async () => { fireEvent.click(actionName); });
      expect(executeHandler).toHaveBeenCalled();
    });
  });
});
