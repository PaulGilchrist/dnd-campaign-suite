// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { DiceRollContext } from '../../hooks/combat/DiceRollContext.js';
import { executeHandler } from '../../services/automation/index.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import useCharActionModals from './useCharActionModals.js';

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null, setPopupHtml: vi.fn(), rollAttack: vi.fn(), rollDamage: vi.fn(), quickRollPlayerSave: vi.fn(),
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

vi.mock('../../services/automation/handlers/class-cleric-paladin/divineInterventionHandler.js', () => ({
  onSpellSelected: vi.fn(),
}));

vi.mock('../../services/automation/handlers/class-wizard/divinationSavantHandler.js', () => ({
  onDivinationSavantSelected: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/automation/handlers/class-wizard/illusionSavantHandler.js', () => ({
  onIllusionSavantSelected: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('../../services/combat/buffs/buffService.js', () => ({
  getInnateSorceryBonus: vi.fn(() => ({ saveDcBonus: 0 })),
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

vi.mock('./DiceRollResult.jsx', () => ({
  default: vi.fn(() => <div data-testid="dice-roll-result">DiceRollResult</div>),
}));

vi.mock('./popups/MetamagicPopup.jsx', () => ({
  default: vi.fn(() => <div data-testid="metamagic-popup">MetamagicPopup</div>),
}));

vi.mock('./char-spells/SpellDetailPopup.jsx', () => ({
  default: vi.fn(() => <div data-testid="spell-detail-popup">SpellDetailPopup</div>),
}));

vi.mock('./popups/EmpoweredSpellPopup.jsx', () => ({
  default: vi.fn(() => <div data-testid="empowered-spell-popup">EmpoweredSpellPopup</div>),
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

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(() => ({ creatures: [] })),
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../services/rules/core/attackCalc.js', () => ({
  parseMagicItemName: vi.fn((name) => {
    if (name.startsWith('+')) return { baseName: name.replace(/^\+\d+\s*/, '') };
    return { baseName: name };
  }),
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

vi.mock('./useInitiativeEffects.js', () => ({
  default: vi.fn(),
}));

vi.mock('./useCharActionModals.js', () => ({
  default: vi.fn(() => ({
    pendingDamageRef: { current: null },
    healingPoolModal: null, setHealingPoolModal: vi.fn(),
    handOfHealingModal: null, setHandOfHealingModal: vi.fn(),
    fontOfMagicModal: false, setFontOfMagicModal: vi.fn(),
    resourcePoolModal: null, setResourcePoolModal: vi.fn(),
    wildCompanionModal: null, setWildCompanionModal: vi.fn(),
    setConditionModal: null, setSetConditionModal: vi.fn(),
    attackRiderModal: null, setAttackRiderModal: vi.fn(),
    openHandTechniqueModal: null, setOpenHandTechniqueModal: vi.fn(),
    weaponMasteryModal: null,
    weaponMasteryChoiceModal: null, setWeaponMasteryChoiceModal: vi.fn(),
    combatStanceModal: null, setCombatStanceModal: vi.fn(),
    teleportModal: null, setTeleportModal: vi.fn(),
    healingIllusionModal: null, setHealingIllusionModal: vi.fn(),
    saveAttackHealModal: null, setSaveAttackHealModal: vi.fn(),
    divineSparkModal: null, setDivineSparkModal: vi.fn(),
    divineInterventionModal: null, setDivineInterventionModal: vi.fn(),
    divineInterventionAction: null, setDivineInterventionAction: vi.fn(),
    moonlightStepResourceModal: null, setMoonlightStepResourceModal: vi.fn(),
    starryFormConstellationModal: null, setStarryFormConstellationModal: vi.fn(),
    twinklingConstellationModal: null, setTwinklingConstellationModal: vi.fn(),
    arcaneChargeModal: null, setArcaneChargeModal: vi.fn(),
    warMagicCantripModal: null, setWarMagicCantripModal: vi.fn(),
    warMagicSpellModal: null, setWarMagicSpellModal: vi.fn(),
    sacredWeaponModal: null, setSacredWeaponModal: vi.fn(),
    elderChampionRestoreModal: null, setElderChampionRestoreModal: vi.fn(),
    primalCompanionBonusActionModal: null, setPrimalCompanionBonusActionModal: vi.fn(),
    mistyWandererModal: null, setMistyWandererModal: vi.fn(),
    bonusActionChoiceModal: null, setBonusActionChoiceModal: vi.fn(),
    revelationInFleshModal: null, setRevelationInFleshModal: vi.fn(),
    bastionOfLawModal: null, setBastionOfLawModal: vi.fn(),
    elementalAffinityModal: null, setElementalAffinityModal: vi.fn(),
    fiendishResilienceModal: null, setFiendishResilienceModal: vi.fn(),
    boonOfEnergyResistanceModal: null, setBoonOfEnergyResistanceModal: vi.fn(),
    dragonCompanionModal: null, setDragonCompanionModal: vi.fn(),
    wildMagicDoubleRollModal: null, setWildMagicDoubleRollModal: vi.fn(),
    wildMagicTamedModal: null, setWildMagicTamedModal: vi.fn(),
    thirdEyeModal: null, setThirdEyeModal: vi.fn(),
    soulstitchSpellsModal: null, setSoulstitchSpellsModal: vi.fn(),
    illusoryRealityModal: null, setIllusoryRealityModal: vi.fn(),
    celestialRevelationModal: null, setCelestialRevelationModal: vi.fn(),
    elfishLineageModal: null, setElfisLineageModal: vi.fn(),
    gnomishLineageModal: null, setGnomishLineageModal: vi.fn(),
    fiendishLegacyModal: null, setFiendishLegacyModal: vi.fn(),
    giantAncestryModal: null, setGiantAncestryModal: vi.fn(),
    eyebiteEffectModal: null, setEyebiteEffectModal: vi.fn(),
    breathWeaponShapeModal: null, setBreathWeaponShapeModal: vi.fn(),
    divineFuryChoice: null,
    damageTypeChoice: null,
    featureChoice: null,
    setFeatureChoice: vi.fn(),
    handleDamageClick: vi.fn(),
    handleMasteryClose: vi.fn(),
    handleWeaponMasteryChoice: vi.fn(),
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
    handleElderChampionRestore: vi.fn(),
    cleaveAttackPending: null,
    handleCleaveAttack: vi.fn(),
    handleCleaveSkip: vi.fn(),
    hypnoticPatternShakeModal: null, setHypnoticPatternShakeModal: vi.fn(),
    arcaneWardRestoreModal: null, setArcaneWardRestoreModal: vi.fn(),
    stealthAttackModal: null, setStealthAttackModal: vi.fn(),
  })),
}));

const BASE_PLAYER_STATS = {
  name: 'TestCharacter',
  rules: '5e',
  level: 5,
  attacks: [],
  actions: [],
  spellAbilities: { spells: [] },
  equipment: [],
};

function createStats(overrides = {}) {
  return { ...BASE_PLAYER_STATS, ...overrides };
}

describe('CharActions monk ki', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
    getRuntimeValue.mockImplementation(() => null);
    hasAutomation.mockImplementation(() => false);
  });

  describe('monk ki: skip FP with Flurry of Healing and Harm', () => {
    it('does not consume focus point for Flurry of Blows when Flurry of Healing and Harm is active', async () => {
      hasAutomation.mockReturnValue(true);
      executeHandler.mockResolvedValue({ type: 'popup', payload: '<b>Flurry</b>' });

      const stats = createStats({
        class: { class_levels: [{ level: 5, focus_points: 2 }] },
        level: 5,
        characterAdvancement: [{ name: 'Flurry of Healing and Harm' }],
        actions: [{ name: 'Flurry of Blows', description: 'Make two attacks.', automation: { type: 'auto_effect' } }],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Flurry of Blows:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(setRuntimeValue).not.toHaveBeenCalledWith('TestCharacter', 'focusPoints', expect.any(Number), undefined);
        expect(executeHandler).toHaveBeenCalled();
      });
    });

    it('does not consume focus point for Hand of Healing when Flurry of Healing and Harm is active', async () => {
      hasAutomation.mockReturnValue(true);
      executeHandler.mockResolvedValue({ type: 'popup', payload: '<b>Healing</b>' });

      const stats = createStats({
        class: { class_levels: [{ level: 5, focus_points: 2 }] },
        level: 5,
        characterAdvancement: [{ name: 'Flurry of Healing and Harm' }],
        actions: [{ name: 'Hand of Healing', description: 'Heal wounds.', automation: { type: 'auto_effect' } }],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Hand of Healing:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(setRuntimeValue).not.toHaveBeenCalledWith('TestCharacter', 'focusPoints', expect.any(Number), undefined);
        expect(executeHandler).toHaveBeenCalled();
      });
    });

    it('does consume focus point for Hand of Healing when Cloak of Shadows is active (Cloak only affects Flurry of Blows)', async () => {
      hasAutomation.mockReturnValue(true);
      executeHandler.mockResolvedValue({ type: 'popup', payload: '<b>Healing</b>' });
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'cloak_of_shadows' }];
        return null;
      });

      const stats = createStats({
        class: { class_levels: [{ level: 5, focus_points: 2 }] },
        level: 5,
        actions: [{ name: 'Hand of Healing', description: 'Heal wounds.', automation: { type: 'auto_effect' } }],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Hand of Healing:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'focusPoints', expect.any(Number), undefined);
        expect(executeHandler).toHaveBeenCalled();
      });
    });

    it('consumes focus point for Flurry of Blows when Flurry of Healing and Harm is not active', async () => {
      hasAutomation.mockReturnValue(true);
      executeHandler.mockResolvedValue({ type: 'popup', payload: '<b>Flurry</b>' });

      const stats = createStats({
        class: { class_levels: [{ level: 5, focus_points: 2 }] },
        level: 5,
        actions: [{ name: 'Flurry of Blows', description: 'Make two attacks.', automation: { type: 'auto_effect' } }],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Flurry of Blows:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'focusPoints', expect.any(Number), undefined);
      });
    });
  });

  describe('monk ki: no FP remaining', () => {
    it('shows correct no-FP message based on ruleset (2024 vs 5e)', async () => {
      hasAutomation.mockReturnValue(true);
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 0;
        return null;
      });
      const mockSetPopupHtml = vi.fn();
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null, setPopupHtml: mockSetPopupHtml, rollAttack: vi.fn(), rollDamage: vi.fn(), quickRollPlayerSave: vi.fn(),
      });

      const wrapper = ({ children }) => (
        <DiceRollContext.Provider value={{ popupHtml: null, setPopupHtml: mockSetPopupHtml }}>
          {children}
        </DiceRollContext.Provider>
      );

      // Test 2024 ruleset
      await act(async () => {
        render(<CharActions playerStats={createStats({
          class: { class_levels: [{ level: 5, focus_points: 2 }] },
          level: 5,
          rules: '2024',
          actions: [{ name: 'Flurry of Blows', description: 'No FP.', automation: { type: 'auto_effect' } }],
        })} />, { wrapper });
      });
      const actionName2024 = screen.getByText(/Flurry of Blows:/);
      await act(async () => { fireEvent.click(actionName2024); });
      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith('<b>Flurry of Blows</b><br/>No Focus Points remaining.');
      });
    });

    it('consumes focus point when FP > 0', async () => {
      hasAutomation.mockReturnValue(true);
      executeHandler.mockResolvedValue({ type: 'popup', payload: '<b>Flurry</b>' });
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 2;
        return null;
      });

      const stats = createStats({
        class: { class_levels: [{ level: 5, focus_points: 2 }] },
        level: 5,
        actions: [{ name: 'Flurry of Blows', description: 'Has FP.', automation: { type: 'auto_effect' } }],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Flurry of Blows:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'focusPoints', 1, undefined);
      });
    });
  });

  describe('save_attack with options (Elemental Attunement)', () => {
    it('shows feature choice when save_attack has options and no choice made', async () => {
      hasAutomation.mockReturnValue(true);
      const mockSetFeatureChoice = vi.fn();
      useCharActionModals.mockReturnValue({
        ...useCharActionModals(),
        setFeatureChoice: mockSetFeatureChoice,
      });

      const stats = createStats({
        actions: [{ name: 'Elemental Attunement', description: 'Choose element.', automation: { type: 'save_attack', hasOptions: true, options: ['Fire', 'Cold'] } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Elemental Attunement:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(mockSetFeatureChoice).toHaveBeenCalledWith({
          action: stats.actions[0],
          options: ['Fire', 'Cold'],
          optionKey: '_Elemental_Attunement_option',
        });
      });
    });

    it('skips choice and executes handler when save_attack option is already stored', async () => {
      hasAutomation.mockReturnValue(true);
      executeHandler.mockResolvedValue({ type: 'popup', payload: '<b>Done</b>' });
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === '_Elemental_Attunement_option') return 'Fire';
        return null;
      });

      const stats = createStats({
        actions: [{ name: 'Elemental Attunement', description: 'Fire chosen.', automation: { type: 'save_attack', hasOptions: true, options: ['Fire', 'Cold'] } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Elemental Attunement:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });
    });
  });
});
