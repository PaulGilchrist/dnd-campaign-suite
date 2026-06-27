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

describe('CharActionModals Rally modal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rally modal', () => {
    it('renders header with heart icon and title', () => {
      render(<CharActionModals
        {...createBaseProps()}
        rallyChoiceModal={{ description: 'Test description', allyOptions: [] }}
      />);
      expect(screen.getByText(/Rally/)).toBeInTheDocument();
    });

    it('displays the description from the modal data', () => {
      render(<CharActionModals
        {...createBaseProps()}
        rallyChoiceModal={{ description: 'Use your reaction to grant temp HP', allyOptions: [] }}
      />);
      expect(screen.getByText('Use your reaction to grant temp HP')).toBeInTheDocument();
    });

    it('renders options from allyOptions array', () => {
      render(<CharActionModals
        {...createBaseProps()}
        rallyChoiceModal={{
          description: 'Test',
          allyOptions: [{ name: 'Bard' }, { name: 'Rogue' }],
        }}
      />);
      expect(screen.getByText('Bard')).toBeInTheDocument();
      expect(screen.getByText('Rogue')).toBeInTheDocument();
    });

    it('renders Grant Temp HP button', () => {
      render(<CharActionModals
        {...createBaseProps()}
        rallyChoiceModal={{ description: 'Test', allyOptions: [{ name: 'Bard' }] }}
      />);
      expect(screen.getByText(/Grant Temp HP/)).toBeInTheDocument();
    });

    it('renders Skip button', () => {
      render(<CharActionModals
        {...createBaseProps()}
        rallyChoiceModal={{ description: 'Test', allyOptions: [{ name: 'Bard' }] }}
      />);
      expect(screen.getByText('Skip')).toBeInTheDocument();
    });

    it('renders overlay with sp-overlay class', () => {
      render(<CharActionModals
        {...createBaseProps()}
        rallyChoiceModal={{ description: 'Test', allyOptions: [{ name: 'Bard' }] }}
      />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });

    it('renders modal container with sp-modal class', () => {
      render(<CharActionModals
        {...createBaseProps()}
        rallyChoiceModal={{ description: 'Test', allyOptions: [{ name: 'Bard' }] }}
      />);
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('Grant Temp HP button is disabled when no target selected', () => {
      render(<CharActionModals
        {...createBaseProps()}
        rallyChoiceModal={{ description: 'Test', allyOptions: [{ name: 'Bard' }] }}
      />);
      const grantBtn = screen.getByText(/Grant Temp HP/);
      expect(grantBtn).toBeDisabled();
    });

    it('Grant Temp HP button is enabled when target is selected', () => {
      render(<CharActionModals
        {...createBaseProps()}
        rallyChoiceModal={{ description: 'Test', allyOptions: [{ name: 'Bard' }] }}
      />);
      fireEvent.click(screen.getByText('Bard'));
      const grantBtn = screen.getByText(/Grant Temp HP/);
      expect(grantBtn).toBeEnabled();
    });

    it('selecting an option and confirming calls handleRallyChoiceConfirm with ally name', () => {
      const handleRallyChoiceConfirm = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleRallyChoiceConfirm })}
        rallyChoiceModal={{ description: 'Test', allyOptions: [{ name: 'Bard' }] }}
      />);
      fireEvent.click(screen.getByText('Bard'));
      fireEvent.click(screen.getByText(/Grant Temp HP/));
      expect(handleRallyChoiceConfirm).toHaveBeenCalledWith('Bard', expect.objectContaining({
        description: 'Test',
      }));
    });

    it('clicking Grant Temp HP calls handleRallyChoiceConfirm', () => {
      const handleRallyChoiceConfirm = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleRallyChoiceConfirm })}
        rallyChoiceModal={{ description: 'Test', allyOptions: [{ name: 'Bard' }] }}
      />);
      fireEvent.click(screen.getByText('Bard'));
      fireEvent.click(screen.getByText(/Grant Temp HP/));
      expect(handleRallyChoiceConfirm).toHaveBeenCalledWith('Bard', expect.objectContaining({
        description: 'Test',
      }));
    });

    it('clicking Skip calls setRallyChoiceModal(null)', () => {
      const setRallyChoiceModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setRallyChoiceModal })}
        rallyChoiceModal={{ description: 'Test', allyOptions: [{ name: 'Bard' }] }}
      />);
      fireEvent.click(screen.getByText('Skip'));
      expect(setRallyChoiceModal).toHaveBeenCalledWith(null);
    });

    it('clicking overlay calls setRallyChoiceModal(null)', () => {
      const setRallyChoiceModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setRallyChoiceModal })}
        rallyChoiceModal={{ description: 'Test', allyOptions: [{ name: 'Bard' }] }}
      />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(setRallyChoiceModal).toHaveBeenCalledWith(null);
    });

    it('does not dismiss when clicking inside the modal content', () => {
      const setRallyChoiceModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setRallyChoiceModal })}
        rallyChoiceModal={{ description: 'Test', allyOptions: [{ name: 'Bard' }] }}
      />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(setRallyChoiceModal).not.toHaveBeenCalled();
    });

    it('renders empty allyOptions array without option buttons', () => {
      render(<CharActionModals
        {...createBaseProps()}
        rallyChoiceModal={{ description: 'Test', allyOptions: [] }}
      />);
      expect(screen.getByText(/Rally/)).toBeInTheDocument();
      expect(screen.getByText(/Grant Temp HP/)).toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    });

    it('renders radio inputs for each ally option', () => {
      render(<CharActionModals
        {...createBaseProps()}
        rallyChoiceModal={{ description: 'Test', allyOptions: [{ name: 'Bard' }, { name: 'Rogue' }] }}
      />);
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios).toHaveLength(2);
    });

    it('clicking a target name selects it and enables the confirm button', () => {
      render(<CharActionModals
        {...createBaseProps()}
        rallyChoiceModal={{ description: 'Test', allyOptions: [{ name: 'Bard' }, { name: 'Rogue' }] }}
      />);
      expect(screen.getByText(/Grant Temp HP/)).toBeDisabled();
      fireEvent.click(screen.getByText('Rogue'));
      expect(screen.getByText(/Grant Temp HP/)).toBeEnabled();
    });

    it('renders label with selected styling when option is chosen', () => {
      render(<CharActionModals
        {...createBaseProps()}
        rallyChoiceModal={{ description: 'Test', allyOptions: [{ name: 'Bard' }] }}
      />);
      fireEvent.click(screen.getByText('Bard'));
      const labels = document.querySelectorAll('label.secondary-target-row');
      expect(labels[0]).toHaveClass('secondary-target-selected');
    });

    it('renders label without selected styling when option is not chosen', () => {
      render(<CharActionModals
        {...createBaseProps()}
        rallyChoiceModal={{ description: 'Test', allyOptions: [{ name: 'Bard' }, { name: 'Rogue' }] }}
      />);
      fireEvent.click(screen.getByText('Bard'));
      const labels = document.querySelectorAll('label.secondary-target-row');
      expect(labels[1]).not.toHaveClass('secondary-target-selected');
    });
  });
});
