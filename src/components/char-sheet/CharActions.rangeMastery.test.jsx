// @improved-by-ai
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CharActions from './CharActions.jsx';
import { showWeaponMasteryPopup } from '../../hooks/combat/useActionPopup.js';

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

describe('CharActions range formatting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    globalThis.fetch = vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) });
  });

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

    it('preserves fraction ranges with "ft." suffix', async () => {
      const stats = createStats({
        attacks: [{ name: 'Shortbow', range: '20/60 ft.', hitBonus: 5, damage: '1d6', damageType: 'Piercing', type: 'Action' }],
      });
      await act(async () => { render(<CharActions playerStats={stats} />); });
      expect(screen.getByText('20/60 ft.')).toBeInTheDocument();
    });
  });

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
});
