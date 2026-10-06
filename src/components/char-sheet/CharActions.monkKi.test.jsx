// @improved-by-ai
// @cleaned-by-ai
// Cleanup: Consolidated 2 redundant Cloak of Shadows skip tests into 1 parameterized test (same behavior, different action names).
// Rewrote 2024 no-FP message test to assert key text content instead of brittle exact HTML string.
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';
import { executeHandler } from '../../services/automation/index.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';

const _syncedStore = new Map();

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  getStore: vi.fn(() => _syncedStore),
  useSyncedState: vi.fn((_, key, defaultValue) => {
    const hasValue = _syncedStore.has(key);
    const value = hasValue ? _syncedStore.get(key) : defaultValue;
    const setter = vi.fn((newValue) => { _syncedStore.set(key, newValue); });
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
    popupHtml: null, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn(),
    rollSkillCheck: vi.fn(), rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(),
  collectWeaponMastery: vi.fn(() => ({ baseMastery: null, extraMasteries: [] })),
  evaluateAutoExpression: vi.fn(() => null),
}));

vi.mock('../../hooks/combat/useActionSpellMetamagic.js', () => ({
  useActionSpellMetamagic: vi.fn(() => ({
    pendingActionMetamagic: null, handleActionMetamagicConfirm: vi.fn(), handleActionMetamagicSkip: vi.fn(),
    handleActionSpellDamageClick: vi.fn(), handleSpellAttackClick: vi.fn(), handleSpellDamageClick: vi.fn(),
  })),
}));

vi.mock('../../hooks/combat/useActionPopup.js', () => ({
  showWeaponMasteryPopup: vi.fn(),
  buildFeatureDetailHtml: vi.fn((entity) => {
    if (entity.details) return `<b>${entity.name}</b><br/>${entity.description}<br/><br/>${entity.details}`;
    return null;
  }),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
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

vi.mock('../../services/automation/handlers/combat/saveAttackHandler.js', () => ({
  isExhausted: vi.fn(() => false),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })),
}));

vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getTargetFromAttacker: vi.fn(() => null),
  getCombatContext: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
  getActiveCreatureName: vi.fn(() => 'TestCharacter'),
  loadCombatSummary: vi.fn(() => Promise.resolve({ lastAttack: null })),
}));

vi.mock('../../services/npcs/monsterUtils.js', () => ({
  getMonsterData: vi.fn(() => Promise.resolve(null)),
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

vi.mock('./useInitiativeEffects.js', () => ({
  default: vi.fn(),
}));

vi.mock('./CharBonusActions.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-bonus-actions">CharBonusActions</div>),
}));

vi.mock('./CharActionModals.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-action-modals">CharActionModals</div>),
}));

vi.mock('./CharActionSpellPopups.jsx', () => ({
  default: vi.fn(() => <div data-testid="char-action-spell-popups">CharActionSpellPopups</div>),
}));

vi.mock('./useCharActionModals.js', () => ({
  default: vi.fn(() => ({
    pendingDamage: null, modalState: {}, setModalState: vi.fn(),
    resolveAttackDamage: vi.fn(), handleMasteryClose: vi.fn(), handleWeaponMasteryChoice: vi.fn(),
    handleWeaponKindMasteryClose: vi.fn(), handleDivineFuryDamageType: vi.fn(), handleDivineFurySkip: vi.fn(),
    handleGenericDamageTypeChoice: vi.fn(), handleGenericDamageTypeSkip: vi.fn(),
    handleDamageTypeModifierChoice: vi.fn(), handleDamageTypeModifierSkip: vi.fn(),
    handleEnhancedUnarmedChoice: vi.fn(), handleEnhancedUnarmedSkip: vi.fn(),
    handleFeatureChoiceConfirm: vi.fn(), handleFeatureChoiceSkip: vi.fn(),
    handleConstellationSelect: vi.fn(),
    combatSuperiorityModal: null, setCombatSuperiorityModal: vi.fn(),
    handleCombatSuperiorityConfirm: vi.fn(), handleAttackRiderManeuverUse: vi.fn(), handleAttackRiderManeuverSkip: vi.fn(),
  })),
}));

const BASE_PLAYER_STATS = {
  name: 'TestCharacter',
  rules: '5e',
  level: 5,
  attacks: [],
  actions: [],
  bonusActions: [],
  spellAbilities: { spells: [] },
  equipment: [],
};

function createStats(overrides = {}) {
  return { ...BASE_PLAYER_STATS, ...overrides };
}

function renderWithDiceRollContext(ui, { wrapper } = {}) {
  const mockSetPopupHtml = vi.fn();
  const defaultWrapper = ({ children }) => (
    <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
      {children}
    </DiceRollContext.Provider>
  );
  return {
    ...render(ui, { wrapper: wrapper || defaultWrapper }),
    mockSetPopupHtml,
  };
}

function mountAction(actionName, { specialActions = [], buffs = [], rules = '5e' } = {}) {
  getRuntimeValue.mockImplementation((_name, key) => {
    if (key === 'focusPoints') return 2;
    if (key === 'activeBuffs') return buffs;
    return null;
  });

  const stats = createStats({
    class: { class_levels: [{ level: 5, focus_points: 2 }] },
    level: 5,
    rules,
    ...(specialActions.length > 0 ? { specialActions: specialActions.map((name) => ({ name })) } : {}),
    actions: [{ name: actionName, description: 'Test action.', automation: { type: 'auto_effect' } }],
  });

  return render(<CharActions playerStats={stats} campaignName="test-campaign" />);
}

describe('CharActions monk ki focus point skip logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
    getRuntimeValue.mockImplementation((_name, key) => {
      if (key === 'focusPoints') return 2;
      if (key === 'activeBuffs') return [];
      return null;
    });
    hasAutomation.mockReturnValue(true);
    executeHandler.mockResolvedValue({ type: 'popup', payload: 'Action executed' });
  });

  // CLA-159: 'Hand of Healing' removed from the skip list — the FP-free HoH
  // exemption is only for HoH used AS PART of Flurry (bonusAttacksHandler lane,
  // CLA-144/CLA-158). The standalone sheet affordance always charges 1 FP.
  describe('Flurry of Healing and Harm skip', () => {
    it('spends focus point for standalone Hand of Healing when Flurry of Healing and Harm is active (CLA-159)', async () => {
      mountAction('Hand of Healing', {
        specialActions: ['Flurry of Healing and Harm'],
      });

      const actionEl = screen.getByText(/Hand of Healing:/);
      await act(async () => { fireEvent.click(actionEl); });

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'focusPoints',
        1,
        'test-campaign'
      );
    });

    it.each(['Flurry of Blows', 'Heightened Flurry of Blows'])('skips focus point spend for %s when Flurry of Healing and Harm is active', async (actionName) => {
      mountAction(actionName, {
        specialActions: ['Flurry of Healing and Harm'],
      });

      const actionEl = screen.getByText(new RegExp(`${actionName}:`));
      await act(async () => { fireEvent.click(actionEl); });

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'TestCharacter',
        'focusPoints',
        expect.any(Number),
        'test-campaign'
      );
    });
  });

  describe('Cloak of Shadows skip', () => {
    it.each([
      { actionName: 'Flurry of Blows', label: 'Flurry of Blows' },
      { actionName: 'Heightened Flurry of Blows', label: 'Heightened Flurry of Blows' },
    ])('skips focus point spend for $actionName when Cloak of Shadows is active', async ({ actionName }) => {
      mountAction(actionName, {
        buffs: [{ effect: 'cloak_of_shadows' }],
      });

      const actionEl = screen.getByText(new RegExp(`${actionName}:`));
      await act(async () => { fireEvent.click(actionEl); });

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'TestCharacter',
        'focusPoints',
        expect.any(Number),
        'test-campaign'
      );
    });

    it('does NOT skip focus point spend for Hand of Healing when Cloak of Shadows is active', async () => {
      mountAction('Hand of Healing', {
        buffs: [{ effect: 'cloak_of_shadows' }],
      });

      const actionEl = screen.getByText(/Hand of Healing:/);
      await act(async () => { fireEvent.click(actionEl); });

      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });
      expect(setRuntimeValue).toHaveBeenCalledWith(
        'TestCharacter',
        'focusPoints',
        1,
        'test-campaign'
      );
    });
  });

  describe('2024 ruleset no-FP message', () => {
    it('shows "Focus Points" message for 2024 ruleset when focus points are 0', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 0;
        return null;
      });

      const stats = createStats({
        class: { class_levels: [{ level: 5, focus_points: 2 }] },
        level: 5,
        rules: '2024',
        actions: [{ name: 'Flurry of Blows', description: 'No FP.', automation: { type: 'auto_effect' } }],
      });

      const { mockSetPopupHtml } = renderWithDiceRollContext(
        <CharActions playerStats={stats} campaignName="test-campaign" />
      );

      const actionEl = screen.getByText(/Flurry of Blows:/);
      await act(async () => { fireEvent.click(actionEl); });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.stringContaining('No Focus Points'));
      });
    });
  });
});
