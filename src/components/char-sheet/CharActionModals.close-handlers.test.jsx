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
  default: function TestModal({ onClose }) {
    return <div data-testid="save-attack-heal-modal"><button data-testid="save-attack-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/divine/DivineSparkModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="divine-spark-modal"><button data-testid="divine-spark-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/divine/DivineInterventionModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="divine-intervention-modal"><button data-testid="divine-intervention-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/arcane/ArcaneChargeModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="arcane-charge-modal"><button data-testid="arcane-charge-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/WarMagicCantripModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="war-magic-cantrip-modal"><button data-testid="war-magic-cantrip-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/WarMagicSpellModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="war-magic-spell-modal"><button data-testid="war-magic-spell-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/divine/SacredWeaponModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="sacred-weapon-modal"><button data-testid="sacred-weapon-close" onClick={onClose}>Close</button></div>;
  },
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
  default: function TestModal({ onClose }) {
    return <div data-testid="primal-companion-bonus-action-modal"><button data-testid="primal-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/MistyWandererModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="misty-wanderer-modal"><button data-testid="misty-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/shared/BonusActionChoiceModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="bonus-action-choice-modal"><button data-testid="bonus-action-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/CelestialRevelationModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="celestial-revelation-modal"><button data-testid="celestial-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/RevelationInFleshModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="revelation-in-flesh-modal"><button data-testid="revelation-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/ElementalAffinityModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="elemental-affinity-modal"><button data-testid="elemental-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/FiendishResilienceModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="fiendish-resilience-modal"><button data-testid="fiendish-resilience-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/shared/ChoiceListModal.jsx', () => ({
  ChoiceListModal: function TestModal() { return <div data-testid="choice-list-modal">ChoiceListModal</div>; },
}));
vi.mock('./modals/DragonCompanionModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="dragon-companion-modal"><button data-testid="dragon-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/WildMagicDoubleRollModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="wild-magic-double-roll-modal"><button data-testid="wild-magic-double-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/WildMagicTamedModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="wild-magic-tamed-modal"><button data-testid="wild-magic-tamed-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/arcane/ThirdEyeModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="third-eye-modal"><button data-testid="third-eye-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/arcane/SoulstitchSpellsModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="soulstitch-spells-modal"><button data-testid="soulstitch-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/arcane/IllusoryRealityModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="illusory-reality-modal"><button data-testid="illusory-close" onClick={onClose}>Close</button></div>;
  },
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
  default: function TestModal({ onClose }) {
    return <div data-testid="moonlight-step-resource-modal"><button data-testid="moonlight-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/FiendishLegacyModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="fiendish-legacy-modal"><button data-testid="fiendish-legacy-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/racial/BreathWeaponShapeModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="breath-weapon-shape-modal"><button data-testid="breath-shape-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/shared/HypnoticPatternShakeModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="hypnotic-pattern-shake-modal"><button data-testid="hypnotic-shake-close" onClick={onClose}>Close</button></div>;
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
    setRallyChoiceModal: vi.fn(),
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

describe('CharActionModals close handlers for untested modals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SaveAttackHealModal close', () => {
    it('calls setSaveAttackHealModal(null) on close', () => {
      const setSaveAttackHealModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setSaveAttackHealModal })}
        saveAttackHealModal={{}}
      />);
      fireEvent.click(screen.getByTestId('save-attack-close'));
      expect(setSaveAttackHealModal).toHaveBeenCalledWith(null);
    });
  });

  describe('DivineSparkModal close', () => {
    it('calls setDivineSparkModal(null) on close', () => {
      const setDivineSparkModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setDivineSparkModal })}
        divineSparkModal={{}}
      />);
      fireEvent.click(screen.getByTestId('divine-spark-close'));
      expect(setDivineSparkModal).toHaveBeenCalledWith(null);
    });
  });

  describe('ArcaneChargeModal close', () => {
    it('calls setArcaneChargeModal(null) on close', () => {
      const setArcaneChargeModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setArcaneChargeModal })}
        arcaneChargeModal={{}}
      />);
      fireEvent.click(screen.getByTestId('arcane-charge-close'));
      expect(setArcaneChargeModal).toHaveBeenCalledWith(null);
    });
  });

  describe('WarMagicCantripModal close', () => {
    it('calls setWarMagicCantripModal(null) on close', () => {
      const setWarMagicCantripModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setWarMagicCantripModal })}
        warMagicCantripModal={{}}
      />);
      fireEvent.click(screen.getByTestId('war-magic-cantrip-close'));
      expect(setWarMagicCantripModal).toHaveBeenCalledWith(null);
    });
  });

  describe('WarMagicSpellModal close', () => {
    it('calls setWarMagicSpellModal(null) on close', () => {
      const setWarMagicSpellModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setWarMagicSpellModal })}
        warMagicSpellModal={{}}
      />);
      fireEvent.click(screen.getByTestId('war-magic-spell-close'));
      expect(setWarMagicSpellModal).toHaveBeenCalledWith(null);
    });
  });

  describe('SacredWeaponModal close', () => {
    it('calls setSacredWeaponModal(null) on close', () => {
      const setSacredWeaponModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setSacredWeaponModal })}
        sacredWeaponModal={{}}
      />);
      fireEvent.click(screen.getByTestId('sacred-weapon-close'));
      expect(setSacredWeaponModal).toHaveBeenCalledWith(null);
    });
  });

  describe('ElderChampionRestoreModal close', () => {
    it('calls setElderChampionRestoreModal(null) on close without calling handler', () => {
      const setElderChampionRestoreModal = vi.fn();
      const handleElderChampionRestore = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setElderChampionRestoreModal, handleElderChampionRestore })}
        elderChampionRestoreModal={{ payload: { action: {}, playerStats: {}, campaignName: 'test' } }}
      />);
      fireEvent.click(screen.getByTestId('elder-close'));
      expect(setElderChampionRestoreModal).toHaveBeenCalledWith(null);
      expect(handleElderChampionRestore).not.toHaveBeenCalled();
    });
  });

  describe('PrimalCompanionBonusActionModal close', () => {
    it('calls setPrimalCompanionBonusActionModal(null) on close', () => {
      const setPrimalCompanionBonusActionModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setPrimalCompanionBonusActionModal })}
        primalCompanionBonusActionModal={{}}
      />);
      fireEvent.click(screen.getByTestId('primal-close'));
      expect(setPrimalCompanionBonusActionModal).toHaveBeenCalledWith(null);
    });
  });

  describe('MistyWandererModal close', () => {
    it('calls setMistyWandererModal(null) on close', () => {
      const setMistyWandererModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setMistyWandererModal })}
        mistyWandererModal={{}}
      />);
      fireEvent.click(screen.getByTestId('misty-close'));
      expect(setMistyWandererModal).toHaveBeenCalledWith(null);
    });
  });

  describe('BonusActionChoiceModal close', () => {
    it('calls setBonusActionChoiceModal(null) on close', () => {
      const setBonusActionChoiceModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setBonusActionChoiceModal })}
        bonusActionChoiceModal={{}}
      />);
      fireEvent.click(screen.getByTestId('bonus-action-close'));
      expect(setBonusActionChoiceModal).toHaveBeenCalledWith(null);
    });
  });

  describe('ElementalAffinityModal close', () => {
    it('calls setElementalAffinityModal(null) on close', () => {
      const setElementalAffinityModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setElementalAffinityModal })}
        elementalAffinityModal={{}}
      />);
      fireEvent.click(screen.getByTestId('elemental-close'));
      expect(setElementalAffinityModal).toHaveBeenCalledWith(null);
    });
  });

  describe('FiendishResilienceModal close', () => {
    it('calls setFiendishResilienceModal(null) on close', () => {
      const setFiendishResilienceModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setFiendishResilienceModal })}
        fiendishResilienceModal={{}}
      />);
      fireEvent.click(screen.getByTestId('fiendish-resilience-close'));
      expect(setFiendishResilienceModal).toHaveBeenCalledWith(null);
    });
  });

  describe('DragonCompanionModal close', () => {
    it('calls setDragonCompanionModal(null) on close', () => {
      const setDragonCompanionModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setDragonCompanionModal })}
        dragonCompanionModal={{}}
      />);
      fireEvent.click(screen.getByTestId('dragon-close'));
      expect(setDragonCompanionModal).toHaveBeenCalledWith(null);
    });
  });

  describe('WildMagicDoubleRollModal close', () => {
    it('calls setWildMagicDoubleRollModal(null) on close', () => {
      const setWildMagicDoubleRollModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setWildMagicDoubleRollModal })}
        wildMagicDoubleRollModal={{}}
      />);
      fireEvent.click(screen.getByTestId('wild-magic-double-close'));
      expect(setWildMagicDoubleRollModal).toHaveBeenCalledWith(null);
    });
  });

  describe('WildMagicTamedModal close', () => {
    it('calls setWildMagicTamedModal(null) on close', () => {
      const setWildMagicTamedModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setWildMagicTamedModal })}
        wildMagicTamedModal={{}}
      />);
      fireEvent.click(screen.getByTestId('wild-magic-tamed-close'));
      expect(setWildMagicTamedModal).toHaveBeenCalledWith(null);
    });
  });

  describe('ThirdEyeModal close', () => {
    it('calls setThirdEyeModal(null) on close', () => {
      const setThirdEyeModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setThirdEyeModal })}
        thirdEyeModal={{ action: {}, playerStats: {}, campaignName: 'test' }}
      />);
      fireEvent.click(screen.getByTestId('third-eye-close'));
      expect(setThirdEyeModal).toHaveBeenCalledWith(null);
    });
  });

  describe('SoulstitchSpellsModal close', () => {
    it('calls setSoulstitchSpellsModal(null) on close', () => {
      const setSoulstitchSpellsModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setSoulstitchSpellsModal })}
        soulstitchSpellsModal={{}}
      />);
      fireEvent.click(screen.getByTestId('soulstitch-close'));
      expect(setSoulstitchSpellsModal).toHaveBeenCalledWith(null);
    });
  });

  describe('IllusoryRealityModal close', () => {
    it('calls setIllusoryRealityModal(null) on close', () => {
      const setIllusoryRealityModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setIllusoryRealityModal })}
        illusoryRealityModal={{}}
      />);
      fireEvent.click(screen.getByTestId('illusory-close'));
      expect(setIllusoryRealityModal).toHaveBeenCalledWith(null);
    });
  });

  describe('CelestialRevelationModal close', () => {
    it('calls setCelestialRevelationModal(null) on close', () => {
      const setCelestialRevelationModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setCelestialRevelationModal })}
        celestialRevelationModal={{}}
      />);
      fireEvent.click(screen.getByTestId('celestial-close'));
      expect(setCelestialRevelationModal).toHaveBeenCalledWith(null);
    });
  });

  describe('FiendishLegacyModal close', () => {
    it('calls setFiendishLegacyModal(null) on close', () => {
      const setFiendishLegacyModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setFiendishLegacyModal })}
        fiendishLegacyModal={{}}
      />);
      fireEvent.click(screen.getByTestId('fiendish-legacy-close'));
      expect(setFiendishLegacyModal).toHaveBeenCalledWith(null);
    });
  });

  describe('BreathWeaponShapeModal close', () => {
    it('calls setBreathWeaponShapeModal(null) on close', () => {
      const setBreathWeaponShapeModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setBreathWeaponShapeModal })}
        breathWeaponShapeModal={{}}
      />);
      fireEvent.click(screen.getByTestId('breath-shape-close'));
      expect(setBreathWeaponShapeModal).toHaveBeenCalledWith(null);
    });
  });

  describe('HypnoticPatternShakeModal close', () => {
    it('calls setHypnoticPatternShakeModal(null) on close', () => {
      const setHypnoticPatternShakeModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setHypnoticPatternShakeModal })}
        hypnoticPatternShakeModal={{}}
      />);
      fireEvent.click(screen.getByTestId('hypnotic-shake-close'));
      expect(setHypnoticPatternShakeModal).toHaveBeenCalledWith(null);
    });
  });
});
