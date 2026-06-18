// @improved-by-ai
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { getRuntimeValue, setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import useLoggedDiceRoll from '../../hooks/combat/useLoggedDiceRoll.js';
import { executeHandler } from '../../services/automation/index.js';
import { hasAutomation } from '../../services/combat/automation/automationService.js';
import { useActionSpellMetamagic } from '../../hooks/combat/useActionSpellMetamagic.js';
import { showWeaponMasteryPopup } from '../../hooks/combat/useActionPopup.js';
import { addEntry } from '../../services/ui/logService.js';
import useCharActionModals from './useCharActionModals.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/combat/useLoggedDiceRoll.js', () => ({
  default: vi.fn(() => ({
    popupHtml: null,
    setPopupHtml: vi.fn(),
    rollAttack: vi.fn(),
    rollDamage: vi.fn(),
    quickRollPlayerSave: vi.fn(),
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
    pendingActionMetamagic: null,
    handleActionMetamagicConfirm: vi.fn(),
    handleActionMetamagicSkip: vi.fn(),
    handleActionSpellDamageClick: vi.fn(),
    handleSpellAttackClick: vi.fn(),
    handleSpellDamageClick: vi.fn(),
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
    pendingRemoveCurse: null,
    handleRemoveCurseConfirm: vi.fn(),
    handleRemoveCurseSkip: vi.fn(),
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
    divinationSavantModal: null, setDivinationSavantModal: vi.fn(),
    illusionSavantModal: null, setIllusionSavantModal: vi.fn(),
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
  })),
}));

// ── Test data helpers ──────────────────────────────────────────────────────

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

// ── Tests ──────────────────────────────────────────────────────────────────

describe('CharActions advanced', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
    getRuntimeValue.mockImplementation(() => null);
    useLoggedDiceRoll.mockImplementation(() => ({
      popupHtml: null,
      setPopupHtml: vi.fn(),
      rollAttack: vi.fn(),
      rollDamage: vi.fn(),
      quickRollPlayerSave: vi.fn(),
    }));
    hasAutomation.mockImplementation(() => false);
  });

  // ── Range formatting ──────────────────────────────────────────────────

  describe('range formatting via attack rendering', () => {
    it('formats a plain numeric range with "ft." suffix', async () => {
      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('5 ft.')).toBeInTheDocument();
    });

    it('normalizes "feet" to "ft." in range string', async () => {
      const stats = createStats({
        attacks: [{ name: 'Longbow', range: '150 feet', hitBonus: 5, damage: '1d8+3', damageType: 'Piercing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('150 ft.')).toBeInTheDocument();
    });

    it('normalizes "foot" to "ft." in range string', async () => {
      const stats = createStats({
        attacks: [{ name: 'Sling', range: '30 foot', hitBonus: 5, damage: '1d4+3', damageType: 'Bludgeoning', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('30 ft.')).toBeInTheDocument();
    });

    it('handles range of 0 as "0 ft."', async () => {
      const stats = createStats({
        attacks: [{ name: 'Touch Attack', range: 0, hitBonus: 5, damage: '1d8', damageType: 'Necrotic', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('0 ft.')).toBeInTheDocument();
    });

    it('passes through non-numeric range values unchanged', async () => {
      const stats = createStats({
        attacks: [{ name: 'Self Buff', range: 'Self', hitBonus: 0, damage: '', damageType: '', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Self')).toBeInTheDocument();
    });

    it('normalizes range that already ends with "ft." without duplication', async () => {
      const stats = createStats({
        attacks: [{ name: 'Test', range: '150 ft.', hitBonus: 5, damage: '1d8', damageType: 'Piercing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('150 ft.')).toBeInTheDocument();
    });

    it('preserves fraction ranges like "20/60"', async () => {
      const stats = createStats({
        attacks: [{ name: 'Shortbow', range: '20/60', hitBonus: 5, damage: '1d6', damageType: 'Piercing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('20/60')).toBeInTheDocument();
    });

    it('passes through range that is already "150 ft." without modification', async () => {
      const stats = createStats({
        attacks: [{ name: 'EdgeCase', range: '150 ft.', hitBonus: 5, damage: '1d8', damageType: 'Piercing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('150 ft.')).toBeInTheDocument();
    });

    it('handles fractional range with "ft." suffix', async () => {
      const stats = createStats({
        attacks: [{ name: 'Shortbow', range: '20/60 ft.', hitBonus: 5, damage: '1d6', damageType: 'Piercing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('20/60 ft.')).toBeInTheDocument();
    });
  });

  // ── Weapon mastery (2024 rules) ───────────────────────────────────────

  describe('weapon mastery with 2024 rules', () => {
    it('displays mastery text from equipment for a 2024 weapon', async () => {
      const stats = createStats({
        rules: '2024',
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
        equipment: [{ name: 'Longsword', equipment_category: 'Weapon', mastery: 'Sap' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Sap')).toBeInTheDocument();
    });

    it('omits mastery column for 5e rules even when equipment has mastery', async () => {
      const stats = createStats({
        rules: '5e',
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
        equipment: [{ name: 'Longsword', equipment_category: 'Weapon', mastery: 'Sap' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.queryByText('Sap')).not.toBeInTheDocument();
    });

    it('omits mastery when equipment entry has null mastery', async () => {
      const stats = createStats({
        rules: '2024',
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
        equipment: [{ name: 'Longsword', equipment_category: 'Weapon', mastery: null }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.queryByText('Sap')).not.toBeInTheDocument();
    });

    it('strips magic prefix from attack name when looking up weapon mastery', async () => {
      const stats = createStats({
        rules: '2024',
        attacks: [{ name: '+1 Longsword', range: 5, hitBonus: 6, damage: '1d8+4', damageType: 'Slashing', type: 'Action' }],
        equipment: [{ name: 'Longsword', equipment_category: 'Weapon', mastery: 'Topple' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Topple')).toBeInTheDocument();
    });

    it('invokes showWeaponMasteryPopup when mastery text is clicked', async () => {
      const stats = createStats({
        rules: '2024',
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
        equipment: [{ name: 'Longsword', equipment_category: 'Weapon', mastery: 'Sap' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const masteryEl = screen.getByText('Sap');
      await act(async () => { fireEvent.click(masteryEl); });
      expect(showWeaponMasteryPopup).toHaveBeenCalledWith('Sap', expect.any(Function));
    });
  });

  // ── Elder Champion buff ───────────────────────────────────────────────

  describe('Elder Champion buff hides action spells', () => {
    it('hides action spells when Elder Champion is in activeBuffs', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ name: 'Elder Champion' }];
        return null;
      });
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.queryByText('Fireball')).not.toBeInTheDocument();
    });

    it('shows action spells when no Elder Champion buff is active', async () => {
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });

    it('treats non-array activeBuffs as empty (no Elder Champion)', async () => {
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return 'not-an-array';
        return null;
      });
      const stats = createStats({
        spellAbilities: { spells: [{ name: 'Fireball', range: '150 ft', casting_time: '1 action', prepared: 'Prepared', damage: '8d6' }] },
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Fireball')).toBeInTheDocument();
    });
  });

  // ── Base actions fetch ────────────────────────────────────────────────

  describe('base actions from fetch', () => {
    it('displays fetched base actions joined with commas', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve(['Dodge', 'Dash', 'Disengage']) });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });
      await waitFor(() => {
        expect(screen.getByText(/Dodge, Dash, Disengage/)).toBeInTheDocument();
      });
    });

    it('logs an error to console when actions.json fetch fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error loading actions:', expect.any(Error));
      });
      consoleSpy.mockRestore();
    });

    it('renders empty string when actions array is empty', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });
      await waitFor(() => {
        expect(screen.getByText(/Base Actions:/)).toBeInTheDocument();
      });
    });
  });

  // ── Popup rendering ───────────────────────────────────────────────────

  describe('popup rendering types', () => {
    it('renders a string popupHtml via dangerouslySetInnerHTML', async () => {
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: '<b>Test</b> popup content',
        setPopupHtml: vi.fn(),
        rollAttack: vi.fn(),
        rollDamage: vi.fn(),
        quickRollPlayerSave: vi.fn(),
      });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.getByText('popup content')).toBeInTheDocument();
    });

    it('renders an automation_info popup with name and description', async () => {
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: { type: 'automation_info', name: 'Test Info', description: 'Some description' },
        setPopupHtml: vi.fn(),
        rollAttack: vi.fn(),
        rollDamage: vi.fn(),
        quickRollPlayerSave: vi.fn(),
      });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('Test Info')).toBeInTheDocument();
      expect(screen.getByText('Some description')).toBeInTheDocument();
    });

    it('renders an empowered_spell popup component', async () => {
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: { type: 'empowered_spell', name: 'Empowered', currentSP: 5, maxSP: 10 },
        setPopupHtml: vi.fn(),
        rollAttack: vi.fn(),
        rollDamage: vi.fn(),
        quickRollPlayerSave: vi.fn(),
      });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByTestId('empowered-spell-popup')).toBeInTheDocument();
    });

    it('dismisses the popup when the overlay is clicked', async () => {
      const mockSetPopupHtml = vi.fn();
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: '<b>Test</b>',
        setPopupHtml: mockSetPopupHtml,
        rollAttack: vi.fn(),
        rollDamage: vi.fn(),
        quickRollPlayerSave: vi.fn(),
      });
      const stats = createStats();
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const overlay = screen.getByTestId('popup-overlay');
      await act(async () => { fireEvent.click(overlay); });
      expect(mockSetPopupHtml).toHaveBeenCalledWith(null);
    });
  });

  // ── Automation: hunter_prey ───────────────────────────────────────────

  describe('automation action: hunter_prey choice', () => {
    it('opens feature choice modal when no choice has been stored', async () => {
      hasAutomation.mockReturnValue(true);
      const mockSetFeatureChoice = vi.fn();
      useCharActionModals.mockReturnValue({
        ...useCharActionModals(),
        setFeatureChoice: mockSetFeatureChoice,
      });

      const stats = createStats({
        actions: [{ name: "Hunter's Prey", description: 'Choose your prey style.', automation: { type: 'hunter_prey' } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Hunter's Prey:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(mockSetFeatureChoice).toHaveBeenCalledWith({
          action: stats.actions[0],
          options: ['Colossus Slayer', 'Horde Breaker'],
          optionKey: "_Hunter's_Prey_choice",
        });
      });
    });

    it('executes the handler (skips choice UI) when a choice is already stored', async () => {
      hasAutomation.mockReturnValue(true);
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === "_Hunter's_Prey_choice") return 'Colossus Slayer';
        return null;
      });
      executeHandler.mockResolvedValue({ type: 'popup', payload: '<b>Done</b>' });

      const stats = createStats({
        actions: [{ name: "Hunter's Prey", description: 'You have chosen.', automation: { type: 'hunter_prey' } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Hunter's Prey:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledTimes(1);
        expect(executeHandler).toHaveBeenCalledWith(
          stats.actions[0],
          expect.any(Object),
          undefined,
          undefined,
          expect.any(Array)
        );
      });
    });
  });

  // ── Automation: spell_modifier (Metamagic) ────────────────────────────

  describe('automation action: metamagic spell_modifier popup', () => {
    it('calls setPopupHtml with empowered spell state for Metamagic action', async () => {
      hasAutomation.mockReturnValue(true);
      const mockSetPopupHtml = vi.fn();
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
        rollAttack: vi.fn(),
        rollDamage: vi.fn(),
        quickRollPlayerSave: vi.fn(),
      });

      const stats = createStats({
        actions: [{ name: 'Metamagic', description: 'Modify spells.', automation: { type: 'spell_modifier' } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const empoweredEl = screen.getByText(/Empowered Spell:/);
      await act(async () => { fireEvent.click(empoweredEl); });
      expect(mockSetPopupHtml).toHaveBeenCalled();
    });
  });

  // ── Automation: after_casting_action_spell trigger ────────────────────

  describe('automation action: after_casting_action_spell trigger', () => {
    it('shows error popup when no spell was cast yet', async () => {
      hasAutomation.mockReturnValue(true);
      const mockSetPopupHtml = vi.fn();
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
        rollAttack: vi.fn(),
        rollDamage: vi.fn(),
        quickRollPlayerSave: vi.fn(),
      });

      const stats = createStats({
        actions: [{ name: 'War Magic', description: 'Cast cantrip then attack.', automation: { type: 'auto_effect', trigger: 'after_casting_action_spell' } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/War Magic:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith(
          '<b>War Magic</b><br/>You must cast a spell with a casting time of an action first.'
        );
      });
    });

    it('resets lastActionSpellCast and proceeds when a spell was cast', async () => {
      hasAutomation.mockReturnValue(true);
      executeHandler.mockResolvedValue({ type: 'popup', payload: '<b>War Magic!</b>' });
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'lastActionSpellCast') return 12345;
        return null;
      });

      const stats = createStats({
        actions: [{ name: 'War Magic', description: 'Cast cantrip then attack.', automation: { type: 'auto_effect', trigger: 'after_casting_action_spell' } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/War Magic:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
        expect(setRuntimeValue).toHaveBeenCalledWith('TestCharacter', 'lastActionSpellCast', 0, undefined);
      });
    });
  });

  // ── Automation: damage_bonus choice ───────────────────────────────────

  describe('automation damage type choice', () => {
    it('opens feature choice for damage_bonus when no option is stored', async () => {
      hasAutomation.mockReturnValue(true);
      const mockSetFeatureChoice = vi.fn();
      useCharActionModals.mockReturnValue({
        ...useCharActionModals(),
        setFeatureChoice: mockSetFeatureChoice,
      });

      const stats = createStats({
        actions: [{ name: 'Blessed Strikes', description: 'Choose a damage type.', automation: { type: 'damage_bonus', options: ['Radiant', 'Force'] } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Blessed Strikes:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(mockSetFeatureChoice).toHaveBeenCalledWith({
          action: stats.actions[0],
          options: ['Radiant', 'Force'],
          optionKey: '_Blessed_Strikes_option',
        });
      });
    });

    it('skips choice and executes handler when a damage_bonus option is already stored', async () => {
      hasAutomation.mockReturnValue(true);
      executeHandler.mockResolvedValue({ type: 'popup', payload: '<b>Done</b>' });
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === '_Blessed_Strikes_option') return 'Radiant';
        return null;
      });

      const stats = createStats({
        actions: [{ name: 'Blessed Strikes', description: 'Radiant chosen.', automation: { type: 'damage_bonus', options: ['Radiant', 'Force'] } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Blessed Strikes:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });
    });
  });

  // ── Automation: roll result ───────────────────────────────────────────

  describe('automation roll result', () => {
    it('calls rollDamage when executeHandler returns a damage roll result', async () => {
      hasAutomation.mockReturnValue(true);
      const mockRollDamage = vi.fn();
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: vi.fn(),
        rollDamage: mockRollDamage,
        quickRollPlayerSave: vi.fn(),
      });
      executeHandler.mockResolvedValue({
        type: 'roll',
        payload: { rollType: 'damage', name: 'Test', formula: '2d6', total: 10, rolls: [5, 5], modifier: 0 },
      });

      const stats = createStats({
        actions: [{ name: 'Test', description: 'Test damage.', automation: { type: 'auto_effect' } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Test:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(mockRollDamage).toHaveBeenCalledWith(
          'Test',
          '2d6',
          10,
          [5, 5],
          0,
          expect.any(Object)
        );
      });
    });

    it('logs entries returned from executeHandler', async () => {
      hasAutomation.mockReturnValue(true);
      executeHandler.mockResolvedValue({
        type: 'popup',
        payload: '<b>Done</b>',
        logEntries: [{ type: 'custom', message: 'Test log' }],
      });

      const stats = createStats({
        actions: [{ name: 'Logged Action', description: 'Logs something.', automation: { type: 'auto_effect' } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Logged Action:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(addEntry).toHaveBeenCalledWith(undefined, { type: 'custom', message: 'Test log' });
      });
    });

    it('does not call rollDamage for non-damage roll types', async () => {
      hasAutomation.mockReturnValue(true);
      const mockRollDamage = vi.fn();
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null,
        setPopupHtml: vi.fn(),
        rollAttack: vi.fn(),
        rollDamage: mockRollDamage,
        quickRollPlayerSave: vi.fn(),
      });
      executeHandler.mockResolvedValue({
        type: 'roll',
        payload: { rollType: 'attack', name: 'Test', formula: '1d20', total: 15, rolls: [15], modifier: 5 },
      });

      const stats = createStats({
        actions: [{ name: 'Test', description: 'Test attack.', automation: { type: 'auto_effect' } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Test:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(mockRollDamage).not.toHaveBeenCalled();
      });
    });
  });

  // ── Monk Ki: focus point skip logic ───────────────────────────────────

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

  describe('monk ki: Cloak of Shadows skip FP', () => {
    it('does not consume focus point for Flurry of Blows when Cloak of Shadows is active', async () => {
      hasAutomation.mockReturnValue(true);
      executeHandler.mockResolvedValue({ type: 'popup', payload: '<b>Shadow Flurry</b>' });
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'activeBuffs') return [{ effect: 'cloak_of_shadows' }];
        return null;
      });

      const stats = createStats({
        class: { class_levels: [{ level: 5, focus_points: 2 }] },
        level: 5,
        actions: [{ name: 'Flurry of Blows', description: 'Shadow flurry.', automation: { type: 'auto_effect' } }],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Flurry of Blows:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(setRuntimeValue).not.toHaveBeenCalledWith('TestCharacter', 'focusPoints', expect.any(Number), undefined);
        expect(executeHandler).toHaveBeenCalled();
      });
    });
  });

  // ── Monk Ki: no FP remaining ──────────────────────────────────────────

  describe('monk ki: no FP remaining', () => {
    it('shows "No Focus Points remaining" for 2024 rules when focus points are 0', async () => {
      hasAutomation.mockReturnValue(true);
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 0;
        return null;
      });
      const mockSetPopupHtml = vi.fn();
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
        rollAttack: vi.fn(),
        rollDamage: vi.fn(),
        quickRollPlayerSave: vi.fn(),
      });

      const stats = createStats({
        class: { class_levels: [{ level: 5, focus_points: 2 }] },
        level: 5,
        rules: '2024',
        actions: [{ name: 'Flurry of Blows', description: 'No FP.', automation: { type: 'auto_effect' } }],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Flurry of Blows:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith('<b>Flurry of Blows</b><br/>No Focus Points remaining.');
      });
    });

    it('shows "No ki points remaining" for 5e rules when focus points are 0', async () => {
      hasAutomation.mockReturnValue(true);
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 0;
        return null;
      });
      const mockSetPopupHtml = vi.fn();
      useLoggedDiceRoll.mockReturnValue({
        popupHtml: null,
        setPopupHtml: mockSetPopupHtml,
        rollAttack: vi.fn(),
        rollDamage: vi.fn(),
        quickRollPlayerSave: vi.fn(),
      });

      const stats = createStats({
        class: { class_levels: [{ level: 5, focus_points: 2 }] },
        level: 5,
        rules: '5e',
        actions: [{ name: 'Flurry of Blows', description: 'No ki.', automation: { type: 'auto_effect' } }],
      });

      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Flurry of Blows:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(mockSetPopupHtml).toHaveBeenCalledWith('<b>Flurry of Blows</b><br/>No ki points remaining.');
      });
    });

    it('consumes focus point when FP > 0 for 2024 rules', async () => {
      hasAutomation.mockReturnValue(true);
      executeHandler.mockResolvedValue({ type: 'popup', payload: '<b>Flurry</b>' });
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === 'focusPoints') return 2;
        return null;
      });

      const stats = createStats({
        class: { class_levels: [{ level: 5, focus_points: 2 }] },
        level: 5,
        rules: '2024',
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

  // ── save_attack with options ──────────────────────────────────────────

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

  // ── Damage click for save-based attacks ───────────────────────────────

  describe('damage click with save DC attack', () => {
    it('calls handleActionSpellDamageClick for save-based attacks', async () => {
      const mockHandleActionSpellDamageClick = vi.fn();
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
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const damageEl = screen.getByText('1d12');
      await act(async () => { fireEvent.click(damageEl); });
      expect(mockHandleActionSpellDamageClick).toHaveBeenCalledWith(stats.attacks[0]);
    });

    it('calls handleDamageClick for non-save-DC attacks', async () => {
      const mockHandleDamageClick = vi.fn();
      useCharActionModals.mockReturnValue({
        ...useCharActionModals(),
        handleDamageClick: mockHandleDamageClick,
      });

      const stats = createStats({
        attacks: [{ name: 'Longsword', range: 5, hitBonus: 5, damage: '1d8+3', damageType: 'Slashing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const damageEl = screen.getByText('1d8+3');
      await act(async () => { fireEvent.click(damageEl); });
      expect(mockHandleDamageClick).toHaveBeenCalledWith(stats.attacks[0]);
    });
  });

  // ── Automation: defensive tactics ─────────────────────────────────────

  describe('automation action: defensive tactics', () => {
    it('shows feature choice for Defensive Tactics when no choice stored', async () => {
      hasAutomation.mockReturnValue(true);
      const mockSetFeatureChoice = vi.fn();
      useCharActionModals.mockReturnValue({
        ...useCharActionModals(),
        setFeatureChoice: mockSetFeatureChoice,
      });

      const stats = createStats({
        actions: [{ name: 'Defensive Tactics', description: 'Choose tactic.', automation: { type: 'defensive_tactics' } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Defensive Tactics:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(mockSetFeatureChoice).toHaveBeenCalledWith({
          action: stats.actions[0],
          options: ['Escape the Horde', 'Multiattack Defense'],
          optionKey: '_Defensive_Tactics_choice',
        });
      });
    });

    it('executes handler (skips UI) when Defensive Tactics choice already made', async () => {
      hasAutomation.mockReturnValue(true);
      getRuntimeValue.mockImplementation((_name, key) => {
        if (key === '_Defensive_Tactics_choice') return 'Escape the Horde';
        return null;
      });
      executeHandler.mockResolvedValue({ type: 'popup', payload: '<b>Done</b>' });

      const stats = createStats({
        actions: [{ name: 'Defensive Tactics', description: 'Chosen.', automation: { type: 'defensive_tactics' } }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      const actionName = screen.getByText(/Defensive Tactics:/);
      await act(async () => { fireEvent.click(actionName); });
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalled();
      });
    });
  });
});
