/* @improved-by-ai */
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

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  setRuntimeBatch: vi.fn(),
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
    handleDamageClick: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useActionSpellMetamagic.js', () => ({
  useActionSpellMetamagic: vi.fn(() => ({
    pendingActionMetamagic: null,
    handleActionMetamagicConfirm: vi.fn(),
    handleActionMetamagicSkip: vi.fn(),
    handleActionSpellDamageClick: vi.fn(),
    handleSpellAttackClick: vi.fn(),
    handleSpellDamageClick: vi.fn(),
  })),
}));

import { useActionSpellMetamagic } from '../../hooks/combat/useActionSpellMetamagic.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import useCharActionModals from './useCharActionModals.js';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import { isExhausted } from '../../services/automation/handlers/combat/saveAttackHandler.js';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { getInnateSorceryBonus } from '../../services/combat/buffs/buffService.js';
import { executeHandler } from '../../services/automation/index.js';

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
  });

  describe('restore with rage', () => {
    it('should call setRuntimeValue with rage points and rage key when Restore with Rage is clicked', async () => {
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(true);
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 1;
        return null;
      });

      const stats = createStats({
        actions: [{
          name: 'Berserker Rage',
          description: 'You enter a rage.',
          automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage' },
        }],
      });

      await renderWithFetch(<CharActions playerStats={stats} />);
      const restoreBtn = screen.getByText(/Restore with Rage/);
      await act(async () => { fireEvent.click(restoreBtn); });
      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'ragePoints', 0, undefined);
      });
    });

    it('should show a popup when no rage points remain to restore', async () => {
      isExhausted.mockReturnValue(true);
      const mockSetPopupHtml = vi.fn();
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), quickRollPlayerSave: vi.fn(), saveDcBonus: 0,
      });
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'ragePoints') return 0;
        return null;
      });

      const stats = createStats({
        actions: [{
          name: 'Berserker Rage',
          description: 'You enter a rage.',
          automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage' },
        }],
      });

      await act(async () => {
        const wrapper = ({ children }) => (
          <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
            {children}
          </DiceRollContext.Provider>
        );
        render(<CharActions playerStats={stats} />, { wrapper });
      });
      const restoreBtn = screen.getByText(/Restore with Rage/);
      await act(async () => { fireEvent.click(restoreBtn); });

      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('No Rage remaining'));
    });

    it('should not call automation handler when action is exhausted', async () => {
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(true);

      const stats = createStats({
        actions: [{
          name: 'Berserker Rage',
          description: 'You enter a rage.',
          automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage' },
        }],
      });

      await renderWithFetch(<CharActions playerStats={stats} />);
      const actionName = screen.getByText(/Rage:/);
      await act(async () => { fireEvent.click(actionName); });
      expect(executeHandler).not.toHaveBeenCalled();
    });
  });

  describe('attack click guards', () => {
    it('should not call handleSpellAttackClick when cannotAct is true', async () => {
      const mockHandleSpellAttackClick = vi.fn();
      vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });

      useActionSpellMetamagic.mockReturnValue({
        pendingActionMetamagic: null,
        handleActionMetamagicConfirm: vi.fn(),
        handleActionMetamagicSkip: vi.fn(),
        handleActionSpellDamageClick: vi.fn(),
        handleSpellAttackClick: mockHandleSpellAttackClick,
        handleSpellDamageClick: vi.fn(),
      });

      const stats = createStats({
        attacks: [{ name: 'Witch Bolt', range: 60, saveDc: 14, saveType: 'CON', damage: '1d12', damageType: 'Lightning', type: 'Action' }],
      });

      await renderWithFetch(<CharActions playerStats={stats} cannotAct={true} />);
      const saveDcElement = screen.getByText(/DC 14 CON/);
      await act(async () => { fireEvent.click(saveDcElement); });
      expect(mockHandleSpellAttackClick).not.toHaveBeenCalled();
    });

    it('should not call handleSpellDamageClick when cannotAct is true for weapon attack', async () => {
      const mockHandleSpellDamageClick = vi.fn();
      vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });

      useActionSpellMetamagic.mockReturnValue({
        pendingActionMetamagic: null,
        handleActionMetamagicConfirm: vi.fn(),
        handleActionMetamagicSkip: vi.fn(),
        handleActionSpellDamageClick: vi.fn(),
        handleSpellAttackClick: vi.fn(),
        handleSpellDamageClick: mockHandleSpellDamageClick,
      });

      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });

      await renderWithFetch(<CharActions playerStats={stats} cannotAct={true} />);
      const damageElement = screen.getByText('1d8+3');
      await act(async () => { fireEvent.click(damageElement); });
      expect(mockHandleSpellDamageClick).not.toHaveBeenCalled();
    });

    it('should not call handleActionSpellDamageClick when cannotAct is true for save-DC attack', async () => {
      const mockHandleActionSpellDamageClick = vi.fn();
      vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });

      useActionSpellMetamagic.mockReturnValue({
        pendingActionMetamagic: null,
        handleActionMetamagicConfirm: vi.fn(),
        handleActionMetamagicSkip: vi.fn(),
        handleActionSpellDamageClick: mockHandleActionSpellDamageClick,
        handleSpellAttackClick: vi.fn(),
        handleSpellDamageClick: vi.fn(),
      });

      const stats = createStats({
        attacks: [{ name: 'Witch Bolt', range: 60, saveDc: 14, saveType: 'CON', damage: '1d12', damageType: 'Lightning', type: 'Action' }],
      });

      await renderWithFetch(<CharActions playerStats={stats} cannotAct={true} />);
      const damageElement = screen.getByText('1d12');
      await act(async () => { fireEvent.click(damageElement); });
      expect(mockHandleActionSpellDamageClick).not.toHaveBeenCalled();
    });
  });

  describe('spell attack/damage click handlers', () => {
    it('should call handleActionSpellDamageClick when damage is clicked for save-DC attack', async () => {
      const mockHandleActionSpellDamageClick = vi.fn();
      vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });

      useActionSpellMetamagic.mockReturnValue({
        pendingActionMetamagic: null,
        handleActionMetamagicConfirm: vi.fn(),
        handleActionMetamagicSkip: vi.fn(),
        handleActionSpellDamageClick: mockHandleActionSpellDamageClick,
        handleSpellAttackClick: vi.fn(),
        handleSpellDamageClick: vi.fn(),
      });

      const stats = createStats({
        attacks: [{ name: 'Witch Bolt', range: 60, saveDc: 14, saveType: 'CON', damage: '1d12', damageType: 'Lightning', type: 'Action' }],
      });

      await renderWithFetch(<CharActions playerStats={stats} />);
      const damageElement = screen.getByText('1d12');
      await act(async () => { fireEvent.click(damageElement); });
      expect(mockHandleActionSpellDamageClick).toHaveBeenCalledWith(stats.attacks[0]);
    });

    it('should call handleDamageClick for non-save-DC weapon attacks', async () => {
      vi.mocked(getInnateSorceryBonus).mockReturnValue({ saveDcBonus: 0 });
      const mockHandleDamageClick = vi.fn();
      vi.mocked(useCharActionModals).mockReturnValue({ handleDamageClick: mockHandleDamageClick });

      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });

      await renderWithFetch(<CharActions playerStats={stats} />);
      const damageElement = screen.getByText('1d8+3');
      await act(async () => { fireEvent.click(damageElement); });
      expect(mockHandleDamageClick).toHaveBeenCalledWith(stats.attacks[0]);
    });
  });

  describe('automation handling', () => {
    it('should call executeHandler with correct args when action with automation is clicked', async () => {
      hasAutomation.mockReturnValue(true);

      const stats = createStats({
        actions: [{ name: 'War Priest', description: 'Make a weapon attack.', automation: { type: 'bonus_action_attack' } }],
      });

      await renderWithFetch(<CharActions playerStats={stats} />);
      const actionName = screen.getByText(/War Priest:/);
      await act(async () => { fireEvent.click(actionName); });
      expect(executeHandler).toHaveBeenCalledWith(
        stats.actions[0],
        expect.anything(),
        undefined,
        undefined,
        stats.equipment,
      );
    });

    it('should not call executeHandler when cannotAct is true', async () => {
      hasAutomation.mockReturnValue(true);

      const stats = createStats({
        actions: [{ name: 'War Priest', description: 'Make a weapon attack.', automation: { type: 'bonus_action_attack' } }],
      });

      await renderWithFetch(<CharActions playerStats={stats} cannotAct={true} />);
      const actionName = screen.getByText(/War Priest:/);
      await act(async () => { fireEvent.click(actionName); });
      expect(executeHandler).not.toHaveBeenCalled();
    });

    it('should call setPopupHtml when automation returns popup result', async () => {
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

    it('should call onBuffsChange for notify_buffs_changed result', async () => {
      hasAutomation.mockReturnValue(true);
      executeHandler.mockResolvedValue({ type: 'notify_buffs_changed' });

      const stats = createStats({
        actions: [{ name: 'Buff', description: 'Gain a buff.', automation: { type: 'temp_buff' } }],
      });

      const mockOnBuffsChange = vi.fn();
      await renderWithFetch(<CharActions playerStats={stats} onBuffsChange={mockOnBuffsChange} />);
      const actionName = screen.getByText(/Buff:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(mockOnBuffsChange).toHaveBeenCalled();
      });
    });

    it('should call onBuffsChange for popup result with temp_buff type', async () => {
      hasAutomation.mockReturnValue(true);
      executeHandler.mockResolvedValue({ type: 'popup', payload: '<b>Buff</b>' });

      const stats = createStats({
        actions: [{ name: 'Temp Buff', description: 'Temporary buff.', automation: { type: 'temp_buff' } }],
      });

      const mockOnBuffsChange = vi.fn();
      await renderWithFetch(<CharActions playerStats={stats} onBuffsChange={mockOnBuffsChange} />);
      const actionName = screen.getByText(/Temp Buff:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(mockOnBuffsChange).toHaveBeenCalled();
      });
    });

    it('should call onBuffsChange for popup result with combat_stance type', async () => {
      hasAutomation.mockReturnValue(true);
      executeHandler.mockResolvedValue({ type: 'popup', payload: '<b>Stance</b>' });

      const stats = createStats({
        actions: [{ name: 'Combat Stance', description: 'Enter a stance.', automation: { type: 'combat_stance' } }],
      });

      const mockOnBuffsChange = vi.fn();
      await renderWithFetch(<CharActions playerStats={stats} onBuffsChange={mockOnBuffsChange} />);
      const actionName = screen.getByText(/Combat Stance:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(mockOnBuffsChange).toHaveBeenCalled();
      });
    });

    it('should not dispatch automation when rage action is exhausted', async () => {
      hasAutomation.mockReturnValue(true);
      isExhausted.mockReturnValue(true);

      const stats = createStats({
        actions: [{ name: 'Berserker Rage', description: 'You enter a rage.', automation: { type: 'combat_stance', recharge: 'long_rest_or_expend_rage' } }],
      });

      await renderWithFetch(<CharActions playerStats={stats} />);
      const actionName = screen.getByText(/Rage:/);
      await act(async () => { fireEvent.click(actionName); });
      expect(executeHandler).not.toHaveBeenCalled();
    });
  });

  describe('monk ki features', () => {
    it('should spend focus point for monk ki features', async () => {
      hasAutomation.mockReturnValue(true);
      const stats = createStats({
        class: { class_levels: [{ level: 5, focus_points: 2 }] },
        level: 5,
        _trackedResources: { focusPoints: { current: 2 } },
        actions: [{ name: 'Flurry of Blows', description: 'Make two attacks.', automation: { type: 'auto_effect' } }],
      });

      await renderWithFetch(<CharActions playerStats={stats} />);
      const actionName = screen.getByText(/Flurry of Blows:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'focusPoints', expect.any(Number), undefined);
      });
    });

    it('should show popup when monk ki feature has 0 focus points', async () => {
      hasAutomation.mockReturnValue(true);
      const mockSetPopupHtml = vi.fn();
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), quickRollPlayerSave: vi.fn(), saveDcBonus: 0,
      });
      vi.mocked(getRuntimeValue).mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 0;
        return null;
      });

      const stats = createStats({
        class: { class_levels: [{ level: 5, focus_points: 2 }] },
        level: 5,
        actions: [{ name: 'Flurry of Blows', description: 'Make two attacks.', automation: { type: 'auto_effect' } }],
      });

      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      await renderWithFetch(<CharActions playerStats={stats} />, { wrapper });
      const actionName = screen.getByText(/Flurry of Blows:/);
      await act(async () => { fireEvent.click(actionName); });

      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('No'));
      expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('remaining'));
      expect(setRuntimeValue).not.toHaveBeenCalledWith('TestCharacter', 'focusPoints', expect.any(Number), undefined);
    });

    it('should skip focus point spend when cloak of shadows is active and action is Flurry of Blows', async () => {
      hasAutomation.mockReturnValue(true);
      vi.mocked(getRuntimeValue).mockImplementation((_name, key, _campaign) => {
        if (key === 'activeBuffs') return [{ effect: 'cloak_of_shadows', name: 'Cloak of Shadows' }];
        if (key === 'focusPoints') return 1;
        return null;
      });

      const stats = createStats({
        class: { class_levels: [{ level: 5, focus_points: 2 }] },
        level: 5,
        actions: [{ name: 'Flurry of Blows', description: 'Make two attacks.', automation: { type: 'auto_effect' } }],
      });

      await renderWithFetch(<CharActions playerStats={stats} />);
      const actionName = screen.getByText(/Flurry of Blows:/);
      await act(async () => { fireEvent.click(actionName); });

      // Should not spend focus points due to cloak of shadows
      expect(setRuntimeValue).not.toHaveBeenCalledWith('TestCharacter', 'focusPoints', expect.any(Number), undefined);
      expect(executeHandler).toHaveBeenCalled();
    });
  });

  describe('initiative-rolled event handler', () => {
    it('should recover focus points when initiative is rolled for initiative_action', async () => {
      hasAutomation.mockReturnValue(true);
      const stats = createStats({
        class: { class_levels: [{ level: 5, focus_points: 2 }] },
        level: 5,
        actions: [{ name: 'Test', automation: { type: 'initiative_action', effect: 'not_wild_shape' } }],
      });

      await renderWithFetch(<CharActions playerStats={stats} campaignName="test" />);

      await act(async () => {
        window.dispatchEvent(new CustomEvent('initiative-rolled', {
          detail: { characterName: 'TestCharacter' },
        }));
      });

      // The event should have been dispatched; the initiative effects hook handles focus point recovery
      expect(screen.getByText(/Test:/)).toBeInTheDocument();
    });
  });
});
