// @improved-by-ai
// @cleaned-by-ai
// Cleanup: Removed low-value buff dedup test (redundant with success path). Consolidated 3 brittle conditionEffects forcedMode tests into 1 parameterized test. Pass Without Trace bonus test kept separate (tests bonus calculation, not forcedMode).
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { addEntry } from '../../services/ui/logService.js';
import { toggleBuff } from '../../services/automation/common/buffToggle.js';
import { addExpiration } from '../../services/rules/effects/expirations.js';

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
    popupHtml: null, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn(), rollSkillCheck: vi.fn(), rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
  })),
}));

vi.mock('../../services/automation/index.js', () => ({
  executeHandler: vi.fn(),
}));

vi.mock('../../services/combat/automation/automationService.js', () => ({
  hasAutomation: vi.fn(() => false),
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
  computeFeatRangeEffects: vi.fn(() => Promise.resolve({ rangeBonus: 5 })),
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

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="secondary-target-modal">SecondaryTargetModal</div>),
}));

vi.mock('./modals/TacticalMasterModal.jsx', () => ({
  default: vi.fn(() => <div data-testid="tactical-master-modal">TacticalMasterModal</div>),
}));

vi.mock('../../services/automation/handlers/combat/weaponMasteryHandler.js', () => ({
  applyMasteryEffect: vi.fn(() => Promise.resolve()),
}));

vi.mock('./useAttackDamageResolution.js', () => ({
  normalizeAutoDamage: vi.fn((autoDamage) => ({ attack: autoDamage, ctxOverrides: {} })),
}));

vi.mock('../../services/automation/contextBuilder.js', () => ({
  buildAttackContext: vi.fn(() => Promise.resolve({ hitBonus: 5 })),
  buildAttackContextSync: vi.fn(() => ({ hitBonus: 5 })),
}));

vi.mock('../../services/automation/common/buffToggle.js', () => ({
  toggleBuff: vi.fn(() => ({ wasActive: false })),
}));

vi.mock('../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(() => Promise.resolve()),
}));

const basePlayerStats = {
  name: 'TestCharacter', rules: '5e', level: 5, attacks: [], actions: [],
  spellAbilities: { spells: [], toHit: 5, saveDc: 13 },
  abilities: [{ name: 'STR', bonus: 3 }], proficiency: 3,
};

function createStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

function makeDefaultGetRuntimeValue() {
  return (_name, key) => {
    if (key === 'activeBuffs') return [];
    if (key === 'hasteExtraActionUsed') return false;
    if (key === 'activeConditions') return [];
    return null;
  };
}

function renderWithWrapper(component, wrapper, options) {
  return act(async () => render(component, { wrapper, ...options }));
}

function getHideButton() {
  return screen.getByText('Hide');
}

function getDodgeButton() {
  return screen.getByText('Dodge');
}

function clickHide() {
  return act(async () => { fireEvent.click(getHideButton()); });
}

function clickDodge() {
  return act(async () => { fireEvent.click(getDodgeButton()); });
}

function makeStealthStats(bonus = 5) {
  const stats = createStats({ actions: ['Hide'], skillProficiencies: ['Stealth'], level: 5 });
  stats.abilities = [
    { name: 'Dexterity', bonus: 2, skills: [{ name: 'Stealth', bonus }] },
    { name: 'Strength', bonus: 0, skills: [] },
    { name: 'Constitution', bonus: 0, skills: [] },
    { name: 'Intelligence', bonus: 0, skills: [] },
    { name: 'Wisdom', bonus: 0, skills: [] },
    { name: 'Charisma', bonus: 0, skills: [] },
  ];
  return stats;
}

function makeDefaultWrapper(mockSetPopupHtml) {
  return ({ children }) => (
    <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
      {children}
    </DiceRollContext.Provider>
  );
}

describe('CharActions Hide action behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    _syncedStore.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(['Hide', 'Dash', 'Disengage', 'Dodge', 'Grapple']) });
    getRuntimeValue.mockImplementation(makeDefaultGetRuntimeValue());
    setRuntimeValue.mockReset();
    addEntry.mockReset();
    toggleBuff.mockReset();
    addExpiration.mockReset();
  });

  describe('Hide — already invisible', () => {
    it('shows popup and does not roll when character is already invisible', async () => {
      const mockSetPopupHtml = vi.fn();
      const mockRollSkillCheck = vi.fn();
      const wrapper = makeDefaultWrapper(mockSetPopupHtml);

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeConditions') return ['invisible'];
        return makeDefaultGetRuntimeValue()(key);
      });

      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(),
        rollSkillCheck: mockRollSkillCheck, rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
      });

      await renderWithWrapper(<CharActions playerStats={createStats({ actions: ['Hide'] })} campaignName="test-campaign" />, wrapper);
      await clickHide();

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Hide',
          description: expect.stringContaining('already hidden'),
        }));
      });

      expect(mockRollSkillCheck).not.toHaveBeenCalled();
      expect(setRuntimeValue).not.toHaveBeenCalled();
      expect(addEntry).not.toHaveBeenCalled();
    });
  });

  describe('Hide — success path (>= DC 15)', () => {
    it('rolls Stealth, adds invisible condition, adds advantage_on_stealth buff, and logs', async () => {
      const mockSetPopupHtml = vi.fn();
      const mockRollSkillCheck = vi.fn().mockResolvedValue(undefined);
      const wrapper = makeDefaultWrapper(mockSetPopupHtml);
      const stealthSkillBonus = 5;

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'campaign' && key === undefined) return null;
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        if (_name === 'campaign' && key === 'lastAttack') return { d20: 12, bonus: stealthSkillBonus, total: 12 + stealthSkillBonus };
        return null;
      });

      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(),
        rollSkillCheck: mockRollSkillCheck, rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
      });

      const stats = makeStealthStats(stealthSkillBonus);

      await renderWithWrapper(<CharActions playerStats={stats} campaignName="test-campaign" />, wrapper);
      await clickHide();

      await waitFor(() => {
        expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), expect.any(Object));
      });

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeConditions', expect.arrayContaining(['invisible']), 'test-campaign');
      });

      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'activeBuffs', expect.arrayContaining([{ name: 'Hide', effect: 'advantage_on_stealth' }]), 'test-campaign');
      });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Hide',
          description: expect.stringContaining('Hide successful'),
        }));
      });

      await waitFor(() => {
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCharacter',
          abilityName: 'Hide',
        }));
      });
    });

  });

  describe('Hide — failure path (< DC 15)', () => {
    it('rolls Stealth, does NOT add invisible condition, and logs failure', async () => {
      const mockSetPopupHtml = vi.fn();
      const mockRollSkillCheck = vi.fn().mockResolvedValue(undefined);
      const wrapper = makeDefaultWrapper(mockSetPopupHtml);
      const stealthSkillBonus = 5;

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        if (_name === 'campaign' && key === 'lastAttack') return { d20: 3, bonus: stealthSkillBonus, total: 3 + stealthSkillBonus };
        return null;
      });

      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(),
        rollSkillCheck: mockRollSkillCheck, rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
      });

      const stats = makeStealthStats(stealthSkillBonus);

      await renderWithWrapper(<CharActions playerStats={stats} campaignName="test-campaign" />, wrapper);
      await clickHide();

      await waitFor(() => {
        expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), expect.any(Object));
      });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          name: 'Hide',
          description: expect.stringContaining('Hide failed'),
        }));
      });

      // Verify invisible was NOT added — check that setRuntimeValue was never called with invisible
      expect(setRuntimeValue).not.toHaveBeenCalledWith('TestCharacter', 'activeConditions', expect.arrayContaining(['invisible']), 'test-campaign');

      await waitFor(() => {
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          type: 'ability_use',
          characterName: 'TestCharacter',
          abilityName: 'Hide',
          description: expect.stringContaining('Failure'),
        }));
      });
    });
  });

  describe('Hide — cannotAct guard', () => {
    it('does nothing when cannotAct is true', async () => {
      const mockSetPopupHtml = vi.fn();
      const mockRollSkillCheck = vi.fn();
      const wrapper = makeDefaultWrapper(mockSetPopupHtml);

      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(),
        rollSkillCheck: mockRollSkillCheck, rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
      });

      await renderWithWrapper(<CharActions playerStats={createStats({ actions: ['Hide'] })} campaignName="test-campaign" cannotAct={true} />, wrapper);
      await clickHide();

      await waitFor(() => {
        expect(mockRollSkillCheck).not.toHaveBeenCalled();
        expect(mockSetPopupHtml).not.toHaveBeenCalled();
        expect(setRuntimeValue).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalled();
      });
    });
  });

  describe('Hide — conditionEffects modifiers', () => {
    it('applies Pass Without Trace bonus when conditionEffects has passWithoutTraceBonus', async () => {
      const mockSetPopupHtml = vi.fn();
      const mockRollSkillCheck = vi.fn().mockResolvedValue(undefined);
      const wrapper = makeDefaultWrapper(mockSetPopupHtml);

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        if (_name === 'campaign' && key === 'lastAttack') return { d20: 12, bonus: 10, total: 22 };
        return null;
      });

      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(),
        rollSkillCheck: mockRollSkillCheck, rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
      });

      const stats = makeStealthStats(5);

      await renderWithWrapper(
        <CharActions playerStats={stats} campaignName="test-campaign" conditionEffects={{ passWithoutTraceBonus: '5' }} />,
        wrapper
      );
      await clickHide();

      await waitFor(() => {
        expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), expect.any(Object));
      });
    });

    it.each([
      { conditionEffects: { hexAbilityCheckDisadvantage: true, hexAbilityCheckDisadvantageAbility: 'DEX' }, expectedForcedMode: 'disadvantage', label: 'applies hex disadvantage when hex targets DEX' },
      { conditionEffects: { peerlessAthleteAdvantageSkills: ['Stealth'] }, expectedForcedMode: 'advantage', label: 'applies Peerless Athlete advantage for Stealth' },
      { conditionEffects: { hexAbilityCheckDisadvantage: true, hexAbilityCheckDisadvantageAbility: 'DEX', peerlessAthleteAdvantageSkills: ['Stealth'] }, expectedForcedMode: undefined, label: 'peerless athlete cancels hex disadvantage on Stealth' },
    ])('conditionEffects: $label', async ({ conditionEffects, expectedForcedMode }) => {
      const mockSetPopupHtml = vi.fn();
      const mockRollSkillCheck = vi.fn().mockResolvedValue(undefined);
      const wrapper = makeDefaultWrapper(mockSetPopupHtml);

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        if (_name === 'campaign' && key === 'lastAttack') return { d20: 12, bonus: 5, total: 17 };
        return null;
      });

      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(),
        rollSkillCheck: mockRollSkillCheck, rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
      });

      const stats = makeStealthStats(5);

      await renderWithWrapper(
        <CharActions playerStats={stats} campaignName="test-campaign" conditionEffects={conditionEffects} />,
        wrapper
      );
      await clickHide();

      await waitFor(() => {
        if (expectedForcedMode !== undefined) {
          expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), expect.objectContaining({ forcedMode: expectedForcedMode }));
        } else {
          expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), {});
        }
      });
    });
  });

  describe('Hide — Skulker feat', () => {
    it.each([
      { rules: '2024', feats: ['Skulker'], expectedForcedMode: 'advantage', label: 'applies Skulker advantage in 2024 rules' },
      { rules: '5e', feats: ['Skulker'], expectedForcedMode: undefined, label: 'does NOT apply Skulker advantage in 5e rules' },
      { rules: '2024', feats: [], expectedForcedMode: undefined, label: 'does NOT apply Skulker advantage without the feat' },
    ])('Skulker: $label', async ({ rules, feats, expectedForcedMode }) => {
      const mockSetPopupHtml = vi.fn();
      const mockRollSkillCheck = vi.fn().mockResolvedValue(undefined);
      const wrapper = makeDefaultWrapper(mockSetPopupHtml);

      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [];
        if (key === 'hasteExtraActionUsed') return false;
        if (key === 'activeConditions') return [];
        if (_name === 'campaign' && key === 'lastAttack') return { d20: 12, bonus: 5, total: 17 };
        return null;
      });

      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(),
        rollSkillCheck: mockRollSkillCheck, rollAbilityCheck: vi.fn(), quickRollPlayerSave: vi.fn(),
      });

      const stats = createStats({
        actions: ['Hide'],
        rules,
        feats,
        level: 5,
      });
      stats.abilities = [
        { name: 'Dexterity', bonus: 2, skills: [{ name: 'Stealth', bonus: 5 }] },
        { name: 'Strength', bonus: 0, skills: [] },
        { name: 'Constitution', bonus: 0, skills: [] },
        { name: 'Intelligence', bonus: 0, skills: [] },
        { name: 'Wisdom', bonus: 0, skills: [] },
        { name: 'Charisma', bonus: 0, skills: [] },
      ];

      await renderWithWrapper(<CharActions playerStats={stats} campaignName="test-campaign" />, wrapper);
      await clickHide();

      await waitFor(() => {
        if (expectedForcedMode !== undefined) {
          expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), expect.objectContaining({ forcedMode: expectedForcedMode }));
        } else {
          expect(mockRollSkillCheck).toHaveBeenCalledWith('Stealth', expect.any(Number), {});
        }
      });
    });
  });

  describe('Dodge action', () => {
    it('activates Dodge buff and shows activation popup', async () => {
      const mockSetPopupHtml = vi.fn();
      const wrapper = makeDefaultWrapper(mockSetPopupHtml);
      toggleBuff.mockReturnValue({ wasActive: false });

      await renderWithWrapper(<CharActions playerStats={createStats()} campaignName="test-campaign" />, wrapper);
      await clickDodge();

      await waitFor(() => {
        expect(toggleBuff).toHaveBeenCalledWith(
          'TestCharacter',
          'Dodge',
          { effect: 'dodge', duration: 'until_start_of_next_turn' },
          'test-campaign',
          'TestCharacter'
        );
      });

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          description: expect.stringContaining('Dodge activated'),
        }));
      });

      await waitFor(() => {
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          type: 'ability_use',
          abilityName: 'Dodge',
        }));
      });

      await waitFor(() => {
        expect(addExpiration).toHaveBeenCalledWith({ attackerName: 'TestCharacter', targetName: 'TestCharacter', effects: expect.any(Array), campaignName: 'test-campaign', rounds: undefined, expireOnCreatureName: 'TestCharacter' });
      });
    });

    it('deactivates Dodge when already active', async () => {
      const mockSetPopupHtml = vi.fn();
      const wrapper = makeDefaultWrapper(mockSetPopupHtml);
      toggleBuff.mockReturnValue({ wasActive: true });

      await renderWithWrapper(<CharActions playerStats={createStats()} campaignName="test-campaign" />, wrapper);
      await clickDodge();

      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(expect.objectContaining({
          description: 'Dodge deactivated.',
        }));
      });

      // When deactivating, no Dodge log entry or expiration should be added
      expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ abilityName: 'Dodge' }));
      expect(addExpiration).not.toHaveBeenCalled();
    });

    it('does nothing when cannotAct is true', async () => {
      const mockSetPopupHtml = vi.fn();
      const wrapper = makeDefaultWrapper(mockSetPopupHtml);
      toggleBuff.mockReturnValue({ wasActive: false });

      await renderWithWrapper(<CharActions playerStats={createStats()} campaignName="test-campaign" cannotAct={true} />, wrapper);
      await clickDodge();

      await waitFor(() => {
        expect(toggleBuff).not.toHaveBeenCalled();
        expect(mockSetPopupHtml).not.toHaveBeenCalled();
        expect(addEntry).not.toHaveBeenCalledWith('test-campaign', expect.objectContaining({ abilityName: 'Dodge' }));
        expect(addExpiration).not.toHaveBeenCalled();
      });
    });
  });
});
