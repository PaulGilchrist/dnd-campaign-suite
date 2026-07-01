// @improved-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';

// ── Mocked modal modules ──

vi.mock('./modals/divine/HealingPoolModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="healing-pool-modal"><button data-testid="healing-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/shared/HandOfHealingModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="hand-of-healing-modal">HandOfHealingModal</div>; },
}));
vi.mock('./modals/FontOfMagicModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="font-of-magic-modal">FontOfMagicModal</div>; },
}));
vi.mock('./modals/ResourcePoolModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="resource-pool-modal">ResourcePoolModal</div>; },
}));
vi.mock('./modals/WildCompanionModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="wild-companion-modal">WildCompanionModal</div>; },
}));
vi.mock('./modals/shared/SetConditionModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="set-condition-modal">SetConditionModal</div>; },
}));
vi.mock('./modals/EyebiteEffectModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="eyebite-effect-modal">EyebiteEffectModal</div>; },
}));
vi.mock('./modals/shared/AttackRiderModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="attack-rider-modal"><button data-testid="attack-rider-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/OpenHandTechniqueModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="open-hand-technique-modal"><button data-testid="open-hand-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/WeaponMasteryModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="weapon-mastery-modal"><button data-testid="weapon-mastery-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/WeaponMasteryChoiceModal.jsx', () => ({
  default: function TestModal({ onClose, onConfirm }) {
    return (
      <div data-testid="weapon-mastery-choice-modal">
        <button data-testid="weapon-mastery-confirm" onClick={() => onConfirm('test-choice')}>Confirm</button>
        <button data-testid="weapon-mastery-close" onClick={onClose}>Close</button>
      </div>
    );
  },
}));
vi.mock('./modals/WeaponKindMasteryModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="weapon-kind-mastery-modal"><button data-testid="weapon-kind-mastery-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/shared/CombatStanceModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="combat-stance-modal"><button data-testid="combat-stance-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/TeleportModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="teleport-modal"><button data-testid="teleport-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/shared/HealingIllusionModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="healing-illusion-modal"><button data-testid="healing-illusion-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));
vi.mock('./modals/shared/SaveAttackHealModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="save-attack-heal-modal">SaveAttackHealModal</div>; },
}));
vi.mock('./modals/divine/DivineSparkModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="divine-spark-modal">DivineSparkModal</div>; },
}));
vi.mock('./modals/divine/DivineInterventionModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="divine-intervention-modal"><button data-testid="divine-intervention-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/arcane/ArcaneChargeModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="arcane-charge-modal">ArcaneChargeModal</div>; },
}));
vi.mock('./modals/WarMagicCantripModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="war-magic-cantrip-modal">WarMagicCantripModal</div>; },
}));
vi.mock('./modals/WarMagicSpellModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="war-magic-spell-modal">WarMagicSpellModal</div>; },
}));
vi.mock('./modals/divine/SacredWeaponModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="sacred-weapon-modal">SacredWeaponModal</div>; },
}));
vi.mock('./modals/ElderChampionRestoreModal.jsx', () => ({
  default: function TestModal({ onClose, onConfirm }) {
    return (
      <div data-testid="elder-champion-restore-modal">
        <button data-testid="elder-close" onClick={onClose}>Close</button>
        <button data-testid="elder-confirm" onClick={onConfirm}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/PrimalCompanionBonusActionModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="primal-companion-bonus-action-modal">PrimalCompanionBonusActionModal</div>; },
}));
vi.mock('./modals/MistyWandererModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="misty-wanderer-modal">MistyWandererModal</div>; },
}));
vi.mock('./modals/shared/BonusActionChoiceModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="bonus-action-choice-modal">BonusActionChoiceModal</div>; },
}));
vi.mock('./modals/CelestialRevelationModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="celestial-revelation-modal">CelestialRevelationModal</div>; },
}));
vi.mock('./modals/RevelationInFleshModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="revelation-in-flesh-modal"><button data-testid="revelation-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/ElementalAffinityModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="elemental-affinity-modal">ElementalAffinityModal</div>; },
}));
vi.mock('./modals/FiendishResilienceModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="fiendish-resilience-modal">FiendishResilienceModal</div>; },
}));
vi.mock('./modals/shared/ChoiceListModal.jsx', () => ({
  ChoiceListModal: function TestModal() { return <div data-testid="choice-list-modal">ChoiceListModal</div>; },
}));
vi.mock('./modals/DragonCompanionModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="dragon-companion-modal">DragonCompanionModal</div>; },
}));
vi.mock('./modals/WildMagicDoubleRollModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="wild-magic-double-roll-modal">WildMagicDoubleRollModal</div>; },
}));
vi.mock('./modals/WildMagicTamedModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="wild-magic-tamed-modal">WildMagicTamedModal</div>; },
}));
vi.mock('./modals/arcane/ThirdEyeModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="third-eye-modal">ThirdEyeModal</div>; },
}));
vi.mock('./modals/arcane/SoulstitchSpellsModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="soulstitch-spells-modal">SoulstitchSpellsModal</div>; },
}));
vi.mock('./modals/arcane/IllusoryRealityModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="illusory-reality-modal">IllusoryRealityModal</div>; },
}));
vi.mock('./modals/arcane/ArcaneWardRestoreModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="arcane-ward-restore-modal"><button data-testid="arcane-ward-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/CombatSuperiorityModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="combat-superiority-modal"><button data-testid="combat-superiority-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/AttackRiderManeuverPrompt.jsx', () => ({
  default: function TestModal({ onSkip }) {
    return <div data-testid="attack-rider-maneuver-prompt"><button data-testid="maneuver-skip" onClick={onSkip}>Skip</button></div>;
  },
}));
vi.mock('./modals/ConstellationSelectionModal.jsx', () => ({
  default: function TestModal({ onConfirm, onClose }) {
    return (
      <div data-testid="constellation-selection-modal">
        <button data-testid="const-confirm" onClick={() => onConfirm('test-option')}>Confirm</button>
        <button data-testid="const-close" onClick={onClose}>Close</button>
      </div>
    );
  },
}));
vi.mock('./modals/divine/BastionOfLawModal.jsx', () => ({
  default: function TestModal({ onClose, onConfirm }) {
    return (
      <div data-testid="bastion-of-law-modal">
        <button data-testid="bastion-close" onClick={onClose}>Close</button>
        {onConfirm && <button data-testid="bastion-confirm" onClick={() => onConfirm(5, 'target', null, false)}>Confirm</button>}
      </div>
    );
  },
}));
vi.mock('./modals/MoonlightStepResourceModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="moonlight-step-resource-modal">MoonlightStepResourceModal</div>; },
}));
vi.mock('./modals/FiendishLegacyModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="fiendish-legacy-modal"><button data-testid="fiendish-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/racial/BreathWeaponShapeModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="breath-weapon-shape-modal"><button data-testid="breath-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/shared/HypnoticPatternShakeModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="hypnotic-pattern-shake-modal"><button data-testid="hypnotic-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('../../services/automation/handlers/class-cleric-paladin/bastionOfLawHandler.js', () => ({
  handle: vi.fn().mockResolvedValue(undefined),
  handleClearWard: vi.fn().mockResolvedValue(undefined),
  handleSpendDice: vi.fn().mockResolvedValue(undefined),
  handleApply: vi.fn().mockResolvedValue(undefined),
}));

// ── Test fixtures ──

function createBaseProps(overrides) {
  return {
    playerStats: { name: 'Test Character' },
    campaignName: 'test-campaign',
    characters: [],
    setHealingPoolModal: vi.fn(),
    setHandOfHealingModal: vi.fn(),
    setFontOfMagicModal: vi.fn(),
    setResourcePoolModal: vi.fn(),
    setWildCompanionModal: vi.fn(),
    setSetConditionModal: vi.fn(),
    setAttackRiderModal: vi.fn(),
    setOpenHandTechniqueModal: vi.fn(),
    setWeaponMasteryChoiceModal: vi.fn(),
    setCombatStanceModal: vi.fn(),
    setTeleportModal: vi.fn(),
    setHealingIllusionModal: vi.fn(),
    setSaveAttackHealModal: vi.fn(),
    setDivineSparkModal: vi.fn(),
    setDivineInterventionModal: vi.fn(),
    setDivineInterventionAction: vi.fn(),
    setMoonlightStepResourceModal: vi.fn(),
    setStarryFormConstellationModal: vi.fn(),
    setTwinklingConstellationModal: vi.fn(),
    setArcaneChargeModal: vi.fn(),
    setWarMagicCantripModal: vi.fn(),
    setWarMagicSpellModal: vi.fn(),
    setSacredWeaponModal: vi.fn(),
    setElderChampionRestoreModal: vi.fn(),
    setPrimalCompanionBonusActionModal: vi.fn(),
    setMistyWandererModal: vi.fn(),
    setBonusActionChoiceModal: vi.fn(),
    setRevelationInFleshModal: vi.fn(),
    setBastionOfLawModal: vi.fn(),
    setElementalAffinityModal: vi.fn(),
    setFiendishResilienceModal: vi.fn(),
    setBoonOfEnergyResistanceModal: vi.fn(),
    setDragonCompanionModal: vi.fn(),
    setWildMagicDoubleRollModal: vi.fn(),
    setWildMagicTamedModal: vi.fn(),
    setDivinationSavantModal: vi.fn(),
    setIllusionSavantModal: vi.fn(),
    setThirdEyeModal: vi.fn(),
    setSoulstitchSpellsModal: vi.fn(),
    setIllusoryRealityModal: vi.fn(),
    setCelestialRevelationModal: vi.fn(),
    setElfisLineageModal: vi.fn(),
    setGnomishLineageModal: vi.fn(),
    setFiendishLegacyModal: vi.fn(),
    setGiantAncestryModal: vi.fn(),
    setBreathWeaponShapeModal: vi.fn(),
    setHypnoticPatternShakeModal: vi.fn(),
    setEyebiteEffectModal: vi.fn(),
    setWeaponKindMasteryModal: vi.fn(),
    setArcaneWardRestoreModal: vi.fn(),
    setCombatSuperiorityModal: vi.fn(),
    setAttackRiderManeuverPrompt: vi.fn(),
    setSweepingAttackTargetModal: vi.fn(),
    setBaitAndSwitchChoiceModal: vi.fn(),
    setCommanderStrikeChoiceModal: vi.fn(),
    handleMasteryClose: vi.fn(),
    handleWeaponMasteryChoice: vi.fn(),
    handleWeaponKindMasteryClose: vi.fn(),
    handleCleaveAttack: vi.fn(),
    handleCleaveSkip: vi.fn(),
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
    handleDivineInterventionCast: vi.fn(),
    handleDivinationSavantConfirm: vi.fn(),
    handleIllusionSavantConfirm: vi.fn(),
    handleSweepingAttackConfirm: vi.fn(),
    handleBaitAndSwitchChoiceConfirm: vi.fn(),
    handleCommanderStrikeChoiceConfirm: vi.fn(),
    handleRallyChoiceConfirm: vi.fn(),
    pendingDamageRef: { current: null },
    ...overrides,
  };
}

// ── Tests ──

describe('CharActionModals unmocked modals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── WeaponKindMasteryModal ──

  describe('WeaponKindMasteryModal', () => {
    it('renders WeaponKindMasteryModal when weaponKindMasteryModal is set', () => {
      render(<CharActionModals {...createBaseProps()} weaponKindMasteryModal={{}} />);
      expect(screen.getByTestId('weapon-kind-mastery-modal')).toBeInTheDocument();
    });

    it('calls handleWeaponKindMasteryClose on close button click', () => {
      const handleWeaponKindMasteryClose = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleWeaponKindMasteryClose })}
        weaponKindMasteryModal={{}}
      />);
      fireEvent.click(screen.getByTestId('weapon-kind-mastery-close'));
      expect(handleWeaponKindMasteryClose).toHaveBeenCalled();
    });

    it('passes playerStats and campaignName to WeaponKindMasteryModal', () => {
      const { container } = render(<CharActionModals
        {...createBaseProps()}
        playerStats={{ name: 'MyChar' }}
        campaignName='my-campaign'
        weaponKindMasteryModal={{}}
      />);
      expect(container.querySelector('[data-testid="weapon-kind-mastery-modal"]')).toBeInTheDocument();
    });
  });

  // ── ArcaneWardRestoreModal ──

  describe('ArcaneWardRestoreModal', () => {
    it('renders ArcaneWardRestoreModal when arcaneWardRestoreModal is set', () => {
      render(<CharActionModals {...createBaseProps()} arcaneWardRestoreModal={{}} />);
      expect(screen.getByTestId('arcane-ward-restore-modal')).toBeInTheDocument();
    });

    it('calls setArcaneWardRestoreModal(null) on close button click', () => {
      const setArcaneWardRestoreModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setArcaneWardRestoreModal })}
        arcaneWardRestoreModal={{}}
      />);
      fireEvent.click(screen.getByTestId('arcane-ward-close'));
      expect(setArcaneWardRestoreModal).toHaveBeenCalledWith(null);
    });

    it('passes playerStats and campaignName to ArcaneWardRestoreModal', () => {
      const { container } = render(<CharActionModals
        {...createBaseProps()}
        playerStats={{ name: 'MyChar' }}
        campaignName='my-campaign'
        arcaneWardRestoreModal={{}}
      />);
      expect(container.querySelector('[data-testid="arcane-ward-restore-modal"]')).toBeInTheDocument();
    });
  });

  // ── CombatSuperiorityModal ──

  describe('CombatSuperiorityModal', () => {
    it('renders CombatSuperiorityModal when combatSuperiorityModal is set', () => {
      render(<CharActionModals {...createBaseProps()} combatSuperiorityModal={{}} />);
      expect(screen.getByTestId('combat-superiority-modal')).toBeInTheDocument();
    });

    it('calls setCombatSuperiorityModal(null) on close button click', () => {
      const setCombatSuperiorityModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setCombatSuperiorityModal })}
        combatSuperiorityModal={{}}
      />);
      fireEvent.click(screen.getByTestId('combat-superiority-close'));
      expect(setCombatSuperiorityModal).toHaveBeenCalledWith(null);
    });

    it('renders with onConfirm handler when provided', () => {
      const handleCombatSuperiorityConfirm = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleCombatSuperiorityConfirm })}
        combatSuperiorityModal={{}}
      />);
      expect(screen.getByTestId('combat-superiority-modal')).toBeInTheDocument();
    });

    it('passes playerStats and campaignName to CombatSuperiorityModal', () => {
      const { container } = render(<CharActionModals
        {...createBaseProps()}
        playerStats={{ name: 'MyChar' }}
        campaignName='my-campaign'
        combatSuperiorityModal={{}}
      />);
      expect(container.querySelector('[data-testid="combat-superiority-modal"]')).toBeInTheDocument();
    });
  });

  // ── AttackRiderManeuverPrompt ──

  describe('AttackRiderManeuverPrompt', () => {
    it('renders AttackRiderManeuverPrompt when attackRiderManeuverPrompt is set', () => {
      render(<CharActionModals
        {...createBaseProps()}
        attackRiderManeuverPrompt={{ maneuvers: [], attack: {}, isMiss: false }}
      />);
      expect(screen.getByTestId('attack-rider-maneuver-prompt')).toBeInTheDocument();
    });

    it('passes maneuvers, attack, isMiss, popupHtml to AttackRiderManeuverPrompt', () => {
      const maneuverData = { maneuvers: [{ name: 'Trip' }], attack: { damage: 10 }, isMiss: true, popupHtml: '<p>Test</p>' };
      const { container } = render(<CharActionModals
        {...createBaseProps()}
        attackRiderManeuverPrompt={maneuverData}
      />);
      expect(container.querySelector('[data-testid="attack-rider-maneuver-prompt"]')).toBeInTheDocument();
    });

    it('calls onSkip when Skip button is clicked', () => {
      const handleAttackRiderManeuverSkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleAttackRiderManeuverSkip })}
        attackRiderManeuverPrompt={{ maneuvers: [], attack: {}, isMiss: false }}
      />);
      fireEvent.click(screen.getByTestId('maneuver-skip'));
      expect(handleAttackRiderManeuverSkip).toHaveBeenCalled();
    });
  });
});
