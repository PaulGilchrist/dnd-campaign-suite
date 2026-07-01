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

describe('CharActionModals inline choice modals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Sweeping Attack Target modal ──

  describe('Sweeping Attack Target modal', () => {
    it('renders header with bolt icon and title', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{ primaryTarget: 'Goblin', dieValue: 10, secondaryTargets: [] }}
      />);
      expect(document.querySelector('.sp-header')).toHaveTextContent('Sweeping Attack');
    });

    it('displays primary target name in prompt', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{ primaryTarget: 'Goblin', dieValue: 10, secondaryTargets: [] }}
      />);
      expect(screen.getByText(/within 5 feet of Goblin/)).toBeInTheDocument();
    });

    it('displays die value in prompt', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{ primaryTarget: 'Goblin', dieValue: 15, secondaryTargets: [] }}
      />);
      expect(screen.getByText(/take 15 damage/)).toBeInTheDocument();
    });

    it('renders each secondary target as a selectable option', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre', size: 'Huge' }, { name: 'Skeleton' }],
        }}
      />);
      expect(screen.getByText('Ogre')).toBeInTheDocument();
      expect(screen.getByText('Skeleton')).toBeInTheDocument();
    });

    it('displays size next to target name when available', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre', size: 'Huge' }],
        }}
      />);
      const sizeSpans = document.querySelectorAll('.secondary-target-size');
      expect(sizeSpans).toHaveLength(1);
      expect(sizeSpans[0].textContent).toBe('(Huge)');
    });

    it('does not display size when target has no size', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Skeleton' }],
        }}
      />);
      expect(screen.getByText('Skeleton')).toBeInTheDocument();
      expect(screen.queryByText('(Tiny)')).not.toBeInTheDocument();
    });

    it('renders Apply Sweeping Attack button', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre' }],
        }}
      />);
      expect(screen.getByText(/Apply Sweeping Attack/)).toBeInTheDocument();
    });

    it('renders Skip button', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre' }],
        }}
      />);
      expect(screen.getByText('Skip')).toBeInTheDocument();
    });

    it('renders overlay with sp-overlay class', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre' }],
        }}
      />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });

    it('renders modal container with sp-modal class', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre' }],
        }}
      />);
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('Apply Sweeping Attack button is disabled when no target selected', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre' }, { name: 'Skeleton' }],
        }}
      />);
      const applyBtn = screen.getByText(/Apply Sweeping Attack/);
      expect(applyBtn).toBeDisabled();
    });

    it('Apply Sweeping Attack button is enabled when target is selected', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre' }, { name: 'Skeleton' }],
        }}
      />);
      fireEvent.click(screen.getByText('Ogre'));
      const applyBtn = screen.getByText(/Apply Sweeping Attack/);
      expect(applyBtn).toBeEnabled();
    });

    it('selecting a target and confirming calls handleSweepingAttackConfirm with target name', () => {
      const handleSweepingAttackConfirm = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleSweepingAttackConfirm })}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre' }, { name: 'Skeleton' }],
        }}
      />);
      fireEvent.click(screen.getByText('Ogre'));
      fireEvent.click(screen.getByText(/Apply Sweeping Attack/));
      expect(handleSweepingAttackConfirm).toHaveBeenCalledWith('Ogre', expect.objectContaining({
        primaryTarget: 'Goblin',
      }));
    });

    it('clicking Apply Sweeping Attack calls handleSweepingAttackConfirm', () => {
      const handleSweepingAttackConfirm = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleSweepingAttackConfirm })}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre' }],
        }}
      />);
      fireEvent.click(screen.getByText('Ogre'));
      fireEvent.click(screen.getByText(/Apply Sweeping Attack/));
      expect(handleSweepingAttackConfirm).toHaveBeenCalledWith('Ogre', expect.objectContaining({
        primaryTarget: 'Goblin',
      }));
    });

    it('clicking Skip calls setSweepingAttackTargetModal(null)', () => {
      const setSweepingAttackTargetModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setSweepingAttackTargetModal })}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre' }],
        }}
      />);
      fireEvent.click(screen.getByText('Skip'));
      expect(setSweepingAttackTargetModal).toHaveBeenCalledWith(null);
    });

    it('clicking overlay calls setSweepingAttackTargetModal(null)', () => {
      const setSweepingAttackTargetModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setSweepingAttackTargetModal })}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre' }],
        }}
      />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(setSweepingAttackTargetModal).toHaveBeenCalledWith(null);
    });

    it('does not dismiss when clicking inside the modal content', () => {
      const setSweepingAttackTargetModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setSweepingAttackTargetModal })}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre' }],
        }}
      />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(setSweepingAttackTargetModal).not.toHaveBeenCalled();
    });

    it('renders empty secondaryTargets without target options', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [],
        }}
      />);
      expect(document.querySelector('.sp-header')).toHaveTextContent('Sweeping Attack');
      expect(screen.getByText(/Apply Sweeping Attack/)).toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    });

    it('renders radio inputs for each secondary target', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre' }, { name: 'Skeleton' }],
        }}
      />);
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios).toHaveLength(2);
    });

    it('clicking a target name selects it and enables the confirm button', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre' }, { name: 'Skeleton' }],
        }}
      />);
      expect(screen.getByText(/Apply Sweeping Attack/)).toBeDisabled();
      fireEvent.click(screen.getByText('Skeleton'));
      expect(screen.getByText(/Apply Sweeping Attack/)).toBeEnabled();
    });

    it('renders label with selected styling when target is chosen', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre' }],
        }}
      />);
      fireEvent.click(screen.getByText('Ogre'));
      const labels = document.querySelectorAll('label.secondary-target-row');
      expect(labels[0]).toHaveClass('secondary-target-selected');
    });

    it('renders label without selected styling when target is not chosen', () => {
      render(<CharActionModals
        {...createBaseProps()}
        sweepingAttackTargetModal={{
          primaryTarget: 'Goblin',
          dieValue: 10,
          secondaryTargets: [{ name: 'Ogre' }, { name: 'Skeleton' }],
        }}
      />);
      fireEvent.click(screen.getByText('Ogre'));
      const labels = document.querySelectorAll('label.secondary-target-row');
      expect(labels[1]).not.toHaveClass('secondary-target-selected');
    });
  });

  // ── Bait and Switch Choice modal ──

  describe('Bait and Switch Choice modal', () => {
    it('renders header with shield icon and title', () => {
      render(<CharActionModals
        {...createBaseProps()}
        baitAndSwitchChoiceModal={{ description: 'Test description', options: [] }}
      />);
      expect(screen.getByText(/Bait and Switch/)).toBeInTheDocument();
    });

    it('displays the description from the modal data', () => {
      render(<CharActionModals
        {...createBaseProps()}
        baitAndSwitchChoiceModal={{ description: 'Your foe misses an attack', options: [] }}
      />);
      expect(screen.getByText('Your foe misses an attack')).toBeInTheDocument();
    });

    it('renders options from options array', () => {
      render(<CharActionModals
        {...createBaseProps()}
        baitAndSwitchChoiceModal={{
          description: 'Test',
          options: [{ label: 'Player', value: 'player' }, { label: 'Ally', value: 'ally' }],
        }}
      />);
      expect(screen.getByText('Player')).toBeInTheDocument();
      expect(screen.getByText('Ally')).toBeInTheDocument();
    });

    it('renders Apply AC Bonus button', () => {
      render(<CharActionModals
        {...createBaseProps()}
        baitAndSwitchChoiceModal={{ description: 'Test', options: [{ label: 'Player', value: 'player' }] }}
      />);
      expect(screen.getByText(/Apply AC Bonus/)).toBeInTheDocument();
    });

    it('renders Skip button', () => {
      render(<CharActionModals
        {...createBaseProps()}
        baitAndSwitchChoiceModal={{ description: 'Test', options: [{ label: 'Player', value: 'player' }] }}
      />);
      expect(screen.getByText('Skip')).toBeInTheDocument();
    });

    it('renders overlay with sp-overlay class', () => {
      render(<CharActionModals
        {...createBaseProps()}
        baitAndSwitchChoiceModal={{ description: 'Test', options: [{ label: 'Player', value: 'player' }] }}
      />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });

    it('renders modal container with sp-modal class', () => {
      render(<CharActionModals
        {...createBaseProps()}
        baitAndSwitchChoiceModal={{ description: 'Test', options: [{ label: 'Player', value: 'player' }] }}
      />);
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('Apply AC Bonus button is disabled when no target selected', () => {
      render(<CharActionModals
        {...createBaseProps()}
        baitAndSwitchChoiceModal={{ description: 'Test', options: [{ label: 'Player', value: 'player' }] }}
      />);
      const applyBtn = screen.getByText(/Apply AC Bonus/);
      expect(applyBtn).toBeDisabled();
    });

    it('Apply AC Bonus button is enabled when target is selected', () => {
      render(<CharActionModals
        {...createBaseProps()}
        baitAndSwitchChoiceModal={{ description: 'Test', options: [{ label: 'Player', value: 'player' }] }}
      />);
      fireEvent.click(screen.getByText('Player'));
      const applyBtn = screen.getByText(/Apply AC Bonus/);
      expect(applyBtn).toBeEnabled();
    });

    it('selecting an option and confirming calls handleBaitAndSwitchChoiceConfirm with option value', () => {
      const handleBaitAndSwitchChoiceConfirm = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleBaitAndSwitchChoiceConfirm })}
        baitAndSwitchChoiceModal={{ description: 'Test', options: [{ label: 'Player', value: 'player' }] }}
      />);
      fireEvent.click(screen.getByText('Player'));
      fireEvent.click(screen.getByText(/Apply AC Bonus/));
      expect(handleBaitAndSwitchChoiceConfirm).toHaveBeenCalledWith('player', expect.objectContaining({
        description: 'Test',
      }));
    });

    it('clicking Apply AC Bonus calls handleBaitAndSwitchChoiceConfirm', () => {
      const handleBaitAndSwitchChoiceConfirm = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleBaitAndSwitchChoiceConfirm })}
        baitAndSwitchChoiceModal={{ description: 'Test', options: [{ label: 'Player', value: 'player' }] }}
      />);
      fireEvent.click(screen.getByText('Player'));
      fireEvent.click(screen.getByText(/Apply AC Bonus/));
      expect(handleBaitAndSwitchChoiceConfirm).toHaveBeenCalledWith('player', expect.objectContaining({
        description: 'Test',
      }));
    });

    it('clicking Skip calls setBaitAndSwitchChoiceModal(null)', () => {
      const setBaitAndSwitchChoiceModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setBaitAndSwitchChoiceModal })}
        baitAndSwitchChoiceModal={{ description: 'Test', options: [{ label: 'Player', value: 'player' }] }}
      />);
      fireEvent.click(screen.getByText('Skip'));
      expect(setBaitAndSwitchChoiceModal).toHaveBeenCalledWith(null);
    });

    it('clicking overlay calls setBaitAndSwitchChoiceModal(null)', () => {
      const setBaitAndSwitchChoiceModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setBaitAndSwitchChoiceModal })}
        baitAndSwitchChoiceModal={{ description: 'Test', options: [{ label: 'Player', value: 'player' }] }}
      />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(setBaitAndSwitchChoiceModal).toHaveBeenCalledWith(null);
    });

    it('does not dismiss when clicking inside the modal content', () => {
      const setBaitAndSwitchChoiceModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setBaitAndSwitchChoiceModal })}
        baitAndSwitchChoiceModal={{ description: 'Test', options: [{ label: 'Player', value: 'player' }] }}
      />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(setBaitAndSwitchChoiceModal).not.toHaveBeenCalled();
    });

    it('renders empty options array without option buttons', () => {
      render(<CharActionModals
        {...createBaseProps()}
        baitAndSwitchChoiceModal={{ description: 'Test', options: [] }}
      />);
      expect(screen.getByText(/Bait and Switch/)).toBeInTheDocument();
      expect(screen.getByText(/Apply AC Bonus/)).toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    });

    it('renders radio inputs for each option', () => {
      render(<CharActionModals
        {...createBaseProps()}
        baitAndSwitchChoiceModal={{ description: 'Test', options: [{ label: 'Player', value: 'player' }, { label: 'Ally', value: 'ally' }] }}
      />);
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios).toHaveLength(2);
    });

    it('clicking a target name selects it and enables the confirm button', () => {
      render(<CharActionModals
        {...createBaseProps()}
        baitAndSwitchChoiceModal={{ description: 'Test', options: [{ label: 'Player', value: 'player' }, { label: 'Ally', value: 'ally' }] }}
      />);
      expect(screen.getByText(/Apply AC Bonus/)).toBeDisabled();
      fireEvent.click(screen.getByText('Ally'));
      expect(screen.getByText(/Apply AC Bonus/)).toBeEnabled();
    });

    it('renders label with selected styling when option is chosen', () => {
      render(<CharActionModals
        {...createBaseProps()}
        baitAndSwitchChoiceModal={{ description: 'Test', options: [{ label: 'Player', value: 'player' }] }}
      />);
      fireEvent.click(screen.getByText('Player'));
      const labels = document.querySelectorAll('label.secondary-target-row');
      expect(labels[0]).toHaveClass('secondary-target-selected');
    });

    it('renders label without selected styling when option is not chosen', () => {
      render(<CharActionModals
        {...createBaseProps()}
        baitAndSwitchChoiceModal={{ description: 'Test', options: [{ label: 'Player', value: 'player' }, { label: 'Ally', value: 'ally' }] }}
      />);
      fireEvent.click(screen.getByText('Player'));
      const labels = document.querySelectorAll('label.secondary-target-row');
      expect(labels[1]).not.toHaveClass('secondary-target-selected');
    });
  });

  // ── Commander's Strike Choice modal ──

  describe("Commander's Strike Choice modal", () => {
    it('renders header with bolt icon and title', () => {
      render(<CharActionModals
        {...createBaseProps()}
        commanderStrikeChoiceModal={{ description: 'Test description', options: [] }}
      />);
      expect(screen.getByText(/Commander's Strike/)).toBeInTheDocument();
    });

    it('displays the description from the modal data', () => {
      render(<CharActionModals
        {...createBaseProps()}
        commanderStrikeChoiceModal={{ description: 'Use your reaction to guide an ally', options: [] }}
      />);
      expect(screen.getByText('Use your reaction to guide an ally')).toBeInTheDocument();
    });

    it('renders options from options array', () => {
      render(<CharActionModals
        {...createBaseProps()}
        commanderStrikeChoiceModal={{
          description: 'Test',
          options: [{ label: 'Bard', value: 'bard' }, { label: 'Rogue', value: 'rogue' }],
        }}
      />);
      expect(screen.getByText('Bard')).toBeInTheDocument();
      expect(screen.getByText('Rogue')).toBeInTheDocument();
    });

    it('renders Grant Attack button', () => {
      render(<CharActionModals
        {...createBaseProps()}
        commanderStrikeChoiceModal={{ description: 'Test', options: [{ label: 'Bard', value: 'bard' }] }}
      />);
      expect(screen.getByText(/Grant Attack/)).toBeInTheDocument();
    });

    it('renders Skip button', () => {
      render(<CharActionModals
        {...createBaseProps()}
        commanderStrikeChoiceModal={{ description: 'Test', options: [{ label: 'Bard', value: 'bard' }] }}
      />);
      expect(screen.getByText('Skip')).toBeInTheDocument();
    });

    it('renders overlay with sp-overlay class', () => {
      render(<CharActionModals
        {...createBaseProps()}
        commanderStrikeChoiceModal={{ description: 'Test', options: [{ label: 'Bard', value: 'bard' }] }}
      />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });

    it('renders modal container with sp-modal class', () => {
      render(<CharActionModals
        {...createBaseProps()}
        commanderStrikeChoiceModal={{ description: 'Test', options: [{ label: 'Bard', value: 'bard' }] }}
      />);
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('Grant Attack button is disabled when no target selected', () => {
      render(<CharActionModals
        {...createBaseProps()}
        commanderStrikeChoiceModal={{ description: 'Test', options: [{ label: 'Bard', value: 'bard' }] }}
      />);
      const grantBtn = screen.getByText(/Grant Attack/);
      expect(grantBtn).toBeDisabled();
    });

    it('Grant Attack button is enabled when target is selected', () => {
      render(<CharActionModals
        {...createBaseProps()}
        commanderStrikeChoiceModal={{ description: 'Test', options: [{ label: 'Bard', value: 'bard' }] }}
      />);
      fireEvent.click(screen.getByText('Bard'));
      const grantBtn = screen.getByText(/Grant Attack/);
      expect(grantBtn).toBeEnabled();
    });

    it('selecting an option and confirming calls handleCommanderStrikeChoiceConfirm with option value', () => {
      const handleCommanderStrikeChoiceConfirm = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleCommanderStrikeChoiceConfirm })}
        commanderStrikeChoiceModal={{ description: 'Test', options: [{ label: 'Bard', value: 'bard' }] }}
      />);
      fireEvent.click(screen.getByText('Bard'));
      fireEvent.click(screen.getByText(/Grant Attack/));
      expect(handleCommanderStrikeChoiceConfirm).toHaveBeenCalledWith('bard', expect.objectContaining({
        description: 'Test',
      }));
    });

    it('clicking Grant Attack calls handleCommanderStrikeChoiceConfirm', () => {
      const handleCommanderStrikeChoiceConfirm = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleCommanderStrikeChoiceConfirm })}
        commanderStrikeChoiceModal={{ description: 'Test', options: [{ label: 'Bard', value: 'bard' }] }}
      />);
      fireEvent.click(screen.getByText('Bard'));
      fireEvent.click(screen.getByText(/Grant Attack/));
      expect(handleCommanderStrikeChoiceConfirm).toHaveBeenCalledWith('bard', expect.objectContaining({
        description: 'Test',
      }));
    });

    it('clicking Skip calls setCommanderStrikeChoiceModal(null)', () => {
      const setCommanderStrikeChoiceModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setCommanderStrikeChoiceModal })}
        commanderStrikeChoiceModal={{ description: 'Test', options: [{ label: 'Bard', value: 'bard' }] }}
      />);
      fireEvent.click(screen.getByText('Skip'));
      expect(setCommanderStrikeChoiceModal).toHaveBeenCalledWith(null);
    });

    it('clicking overlay calls setCommanderStrikeChoiceModal(null)', () => {
      const setCommanderStrikeChoiceModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setCommanderStrikeChoiceModal })}
        commanderStrikeChoiceModal={{ description: 'Test', options: [{ label: 'Bard', value: 'bard' }] }}
      />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(setCommanderStrikeChoiceModal).toHaveBeenCalledWith(null);
    });

    it('does not dismiss when clicking inside the modal content', () => {
      const setCommanderStrikeChoiceModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setCommanderStrikeChoiceModal })}
        commanderStrikeChoiceModal={{ description: 'Test', options: [{ label: 'Bard', value: 'bard' }] }}
      />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(setCommanderStrikeChoiceModal).not.toHaveBeenCalled();
    });

    it('renders empty options array without option buttons', () => {
      render(<CharActionModals
        {...createBaseProps()}
        commanderStrikeChoiceModal={{ description: 'Test', options: [] }}
      />);
      expect(screen.getByText(/Commander's Strike/)).toBeInTheDocument();
      expect(screen.getByText(/Grant Attack/)).toBeInTheDocument();
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    });

    it('renders radio inputs for each option', () => {
      render(<CharActionModals
        {...createBaseProps()}
        commanderStrikeChoiceModal={{ description: 'Test', options: [{ label: 'Bard', value: 'bard' }, { label: 'Rogue', value: 'rogue' }] }}
      />);
      const radios = document.querySelectorAll('input[type="radio"]');
      expect(radios).toHaveLength(2);
    });

    it('clicking a target name selects it and enables the confirm button', () => {
      render(<CharActionModals
        {...createBaseProps()}
        commanderStrikeChoiceModal={{ description: 'Test', options: [{ label: 'Bard', value: 'bard' }, { label: 'Rogue', value: 'rogue' }] }}
      />);
      expect(screen.getByText(/Grant Attack/)).toBeDisabled();
      fireEvent.click(screen.getByText('Rogue'));
      expect(screen.getByText(/Grant Attack/)).toBeEnabled();
    });

    it('renders label with selected styling when option is chosen', () => {
      render(<CharActionModals
        {...createBaseProps()}
        commanderStrikeChoiceModal={{ description: 'Test', options: [{ label: 'Bard', value: 'bard' }] }}
      />);
      fireEvent.click(screen.getByText('Bard'));
      const labels = document.querySelectorAll('label.secondary-target-row');
      expect(labels[0]).toHaveClass('secondary-target-selected');
    });

    it('renders label without selected styling when option is not chosen', () => {
      render(<CharActionModals
        {...createBaseProps()}
        commanderStrikeChoiceModal={{ description: 'Test', options: [{ label: 'Bard', value: 'bard' }, { label: 'Rogue', value: 'rogue' }] }}
      />);
      fireEvent.click(screen.getByText('Bard'));
      const labels = document.querySelectorAll('label.secondary-target-row');
      expect(labels[1]).not.toHaveClass('secondary-target-selected');
    });
  });
});
