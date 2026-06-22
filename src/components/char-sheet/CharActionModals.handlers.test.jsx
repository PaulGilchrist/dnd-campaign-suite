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
vi.mock('./modals/racial/BoonOfEnergyResistanceModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="boon-of-energy-resistance-modal">BoonOfEnergyResistanceModal</div>; },
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
vi.mock('./modals/racial/ElfisLineageModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="elfis-lineage-modal"><button data-testid="elfis-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/racial/GnomishLineageModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="gnomish-lineage-modal"><button data-testid="gnomish-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/FiendishLegacyModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="fiendish-legacy-modal"><button data-testid="fiendish-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/racial/GiantAncestryModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="giant-ancestry-modal"><button data-testid="giant-close" onClick={onClose}>Close</button></div>;
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
    handleMasteryClose: vi.fn(),
    handleWeaponMasteryChoice: vi.fn(),
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
    pendingDamageRef: { current: null },
    ...overrides,
  };
}

// ── Tests ──

describe('CharActionModals handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Constellation Selection modal ──

  describe('Constellation Selection modal', () => {
    it('renders ConstellationSelectionModal for starry form', () => {
      render(<CharActionModals
        {...createBaseProps()}
        starryFormConstellationModal={{ payload: { action: {}, playerStats: {}, campaignName: 'test' } }}
      />);
      expect(screen.getByTestId('constellation-selection-modal')).toBeInTheDocument();
    });

    it('renders ConstellationSelectionModal for twinkling form', () => {
      render(<CharActionModals
        {...createBaseProps()}
        twinklingConstellationModal={{ payload: { action: {}, playerStats: {}, campaignName: 'test' } }}
      />);
      expect(screen.getByTestId('constellation-selection-modal')).toBeInTheDocument();
    });

    it('starry confirm calls handleConstellationSelect with payload and option', () => {
      const handleConstellationSelect = vi.fn();
      const payload = { action: {}, playerStats: {}, campaignName: 'test' };
      render(<CharActionModals
        {...createBaseProps({ handleConstellationSelect })}
        starryFormConstellationModal={{ payload }}
      />);
      fireEvent.click(screen.getByTestId('const-confirm'));
      expect(handleConstellationSelect).toHaveBeenCalledWith(payload, 'test-option');
    });

    it('starry confirm calls handleConstellationSelect with correct payload data', () => {
      const handleConstellationSelect = vi.fn();
      const payload = { action: { name: 'Test' }, playerStats: { name: 'TestChar' }, campaignName: 'my-campaign' };
      render(<CharActionModals
        {...createBaseProps({ handleConstellationSelect })}
        starryFormConstellationModal={{ payload }}
      />);
      fireEvent.click(screen.getByTestId('const-confirm'));
      expect(handleConstellationSelect).toHaveBeenCalledWith(payload, 'test-option');
    });

    it('starry close calls setStarryFormConstellationModal with null', () => {
      const setStarryFormConstellationModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setStarryFormConstellationModal })}
        starryFormConstellationModal={{ payload: { action: {}, playerStats: {}, campaignName: 'test' } }}
      />);
      fireEvent.click(screen.getByTestId('const-close'));
      expect(setStarryFormConstellationModal).toHaveBeenCalledWith(null);
    });

    it('twinkling confirm calls handleConstellationSelect with payload and option', () => {
      const handleConstellationSelect = vi.fn();
      const payload = { action: {}, playerStats: {}, campaignName: 'test' };
      render(<CharActionModals
        {...createBaseProps({ handleConstellationSelect })}
        twinklingConstellationModal={{ payload }}
      />);
      fireEvent.click(screen.getByTestId('const-confirm'));
      expect(handleConstellationSelect).toHaveBeenCalledWith(payload, 'test-option');
    });

    it('twinkling close calls setTwinklingConstellationModal with null', () => {
      const setTwinklingConstellationModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setTwinklingConstellationModal })}
        twinklingConstellationModal={{ payload: { action: {}, playerStats: {}, campaignName: 'test' } }}
      />);
      fireEvent.click(screen.getByTestId('const-close'));
      expect(setTwinklingConstellationModal).toHaveBeenCalledWith(null);
    });
  });

  // ── Weapon Mastery modal ──

  describe('Weapon Mastery modal', () => {
    it('renders WeaponMasteryModal when weaponMasteryModal is set', () => {
      render(<CharActionModals {...createBaseProps()} weaponMasteryModal={{}} />);
      expect(screen.getByTestId('weapon-mastery-modal')).toBeInTheDocument();
    });

    it('calls handleMasteryClose on close button click', () => {
      const handleMasteryClose = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleMasteryClose })}
        weaponMasteryModal={{}}
      />);
      fireEvent.click(screen.getByTestId('weapon-mastery-close'));
      expect(handleMasteryClose).toHaveBeenCalled();
    });
  });

  // ── Weapon Mastery Choice modal ──

  describe('Weapon Mastery Choice modal', () => {
    it('renders WeaponMasteryChoiceModal when set', () => {
      render(<CharActionModals {...createBaseProps()} weaponMasteryChoiceModal={{}} />);
      expect(screen.getByTestId('weapon-mastery-choice-modal')).toBeInTheDocument();
    });

    it('calls handleWeaponMasteryChoice on confirm button click', () => {
      const handleWeaponMasteryChoice = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleWeaponMasteryChoice })}
        weaponMasteryChoiceModal={{}}
      />);
      fireEvent.click(screen.getByTestId('weapon-mastery-confirm'));
      expect(handleWeaponMasteryChoice).toHaveBeenCalledWith('test-choice');
    });

    it('calls setWeaponMasteryChoiceModal with null on close', () => {
      const setWeaponMasteryChoiceModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setWeaponMasteryChoiceModal })}
        weaponMasteryChoiceModal={{}}
      />);
      fireEvent.click(screen.getByTestId('weapon-mastery-close'));
      expect(setWeaponMasteryChoiceModal).toHaveBeenCalledWith(null);
    });
  });

  // ── Close/dismiss behavior ──

  describe('modal close/dismiss behavior', () => {
    it('HealingPoolModal: close button calls setHealingPoolModal(null)', () => {
      const setHealingPoolModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setHealingPoolModal })}
        healingPoolModal={{ name: 'Test Pool' }}
      />);
      fireEvent.click(screen.getByTestId('healing-close'));
      expect(setHealingPoolModal).toHaveBeenCalledWith(null);
    });

    it('AttackRiderModal: close dispatches target-effects-updated event and dismisses', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const setAttackRiderModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setAttackRiderModal })}
        attackRiderModal={{}}
      />);
      fireEvent.click(screen.getByTestId('attack-rider-close'));
      expect(setAttackRiderModal).toHaveBeenCalledWith(null);
      expect(dispatchSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
      dispatchSpy.mockRestore();
    });

    it('OpenHandTechniqueModal: close dispatches two events and dismisses', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const setOpenHandTechniqueModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setOpenHandTechniqueModal })}
        openHandTechniqueModal={{}}
      />);
      fireEvent.click(screen.getByTestId('open-hand-close'));
      expect(setOpenHandTechniqueModal).toHaveBeenCalledWith(null);
      expect(dispatchSpy).toHaveBeenCalledTimes(2);
      dispatchSpy.mockRestore();
    });

    it('CombatStanceModal: close dispatches buffs-updated and dismisses', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const setCombatStanceModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setCombatStanceModal })}
        combatStanceModal={{}}
      />);
      fireEvent.click(screen.getByTestId('combat-stance-close'));
      expect(setCombatStanceModal).toHaveBeenCalledWith(null);
      expect(dispatchSpy).toHaveBeenCalledWith(new CustomEvent('buffs-updated'));
      dispatchSpy.mockRestore();
    });

    it('RevelationInFleshModal: close dispatches buffs-updated and dismisses', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const setRevelationInFleshModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setRevelationInFleshModal })}
        revelationInFleshModal={{}}
      />);
      fireEvent.click(screen.getByTestId('revelation-close'));
      expect(setRevelationInFleshModal).toHaveBeenCalledWith(null);
      expect(dispatchSpy).toHaveBeenCalledWith(new CustomEvent('buffs-updated'));
      dispatchSpy.mockRestore();
    });

    it('TeleportModal: close dispatches buffs-updated and dismisses', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const setTeleportModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setTeleportModal })}
        teleportModal={{}}
      />);
      fireEvent.click(screen.getByTestId('teleport-close'));
      expect(setTeleportModal).toHaveBeenCalledWith(null);
      expect(dispatchSpy).toHaveBeenCalledWith(new CustomEvent('buffs-updated'));
      dispatchSpy.mockRestore();
    });

    it('HealingIllusionModal: close dispatches buffs-updated and dismisses', () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const setHealingIllusionModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setHealingIllusionModal })}
        healingIllusionModal={{}}
      />);
      fireEvent.click(screen.getByTestId('healing-illusion-close'));
      expect(setHealingIllusionModal).toHaveBeenCalledWith(null);
      expect(dispatchSpy).toHaveBeenCalledWith(new CustomEvent('buffs-updated'));
      dispatchSpy.mockRestore();
    });

    it('DivineInterventionModal: close clears both modal and action state', () => {
      const setDivineInterventionModal = vi.fn();
      const setDivineInterventionAction = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setDivineInterventionModal, setDivineInterventionAction })}
        divineInterventionModal={{}}
      />);
      fireEvent.click(screen.getByTestId('divine-intervention-close'));
      expect(setDivineInterventionModal).toHaveBeenCalledWith(null);
      expect(setDivineInterventionAction).toHaveBeenCalledWith(null);
    });

    it('ElderChampionRestoreModal: confirm calls handler and dismisses', () => {
      const handleElderChampionRestore = vi.fn();
      const setElderChampionRestoreModal = vi.fn();
      const payload = { action: {}, playerStats: {}, campaignName: 'test' };
      render(<CharActionModals
        {...createBaseProps({ handleElderChampionRestore, setElderChampionRestoreModal })}
        elderChampionRestoreModal={{ payload }}
      />);
      fireEvent.click(screen.getByTestId('elder-confirm'));
      expect(handleElderChampionRestore).toHaveBeenCalledWith(payload);
      expect(setElderChampionRestoreModal).toHaveBeenCalledWith(null);
    });

    it('ElderChampionRestoreModal: close dismisses without calling handler', () => {
      const handleElderChampionRestore = vi.fn();
      const setElderChampionRestoreModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleElderChampionRestore, setElderChampionRestoreModal })}
        elderChampionRestoreModal={{ payload: { action: {}, playerStats: {}, campaignName: 'test' } }}
      />);
      fireEvent.click(screen.getByTestId('elder-close'));
      expect(handleElderChampionRestore).not.toHaveBeenCalled();
      expect(setElderChampionRestoreModal).toHaveBeenCalledWith(null);
    });

    it('BastionOfLawModal: confirm button exists on first instance', () => {
      render(<CharActionModals
        {...createBaseProps()}
        bastionOfLawModal={{ featureName: 'Test', auto: { type: 'bastion_of_law' } }}
      />);
      const confirmBtns = screen.getAllByTestId('bastion-confirm');
      expect(confirmBtns).toHaveLength(1);
    });

    it('BastionOfLawModal: close works on both instances', () => {
      const setBastionOfLawModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setBastionOfLawModal })}
        bastionOfLawModal={{ featureName: 'Test', auto: { type: 'bastion_of_law' } }}
      />);
      const closeBtns = screen.getAllByTestId('bastion-close');
      expect(closeBtns).toHaveLength(2);
      fireEvent.click(closeBtns[0]);
      expect(setBastionOfLawModal).toHaveBeenCalledWith(null);
    });

    it('ElfisLineageModal: close button calls setElfisLineageModal(null)', () => {
      const setElfisLineageModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setElfisLineageModal })}
        elfishLineageModal={{}}
      />);
      fireEvent.click(screen.getByTestId('elfis-close'));
      expect(setElfisLineageModal).toHaveBeenCalledWith(null);
    });

    it('GnomishLineageModal: close button calls setGnomishLineageModal(null)', () => {
      const setGnomishLineageModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setGnomishLineageModal })}
        gnomishLineageModal={{}}
      />);
      fireEvent.click(screen.getByTestId('gnomish-close'));
      expect(setGnomishLineageModal).toHaveBeenCalledWith(null);
    });

    it('FiendishLegacyModal: close button calls setFiendishLegacyModal(null)', () => {
      const setFiendishLegacyModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setFiendishLegacyModal })}
        fiendishLegacyModal={{}}
      />);
      fireEvent.click(screen.getByTestId('fiendish-close'));
      expect(setFiendishLegacyModal).toHaveBeenCalledWith(null);
    });

    it('GiantAncestryModal: close button calls setGiantAncestryModal(null)', () => {
      const setGiantAncestryModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setGiantAncestryModal })}
        giantAncestryModal={{}}
      />);
      fireEvent.click(screen.getByTestId('giant-close'));
      expect(setGiantAncestryModal).toHaveBeenCalledWith(null);
    });

    it('BreathWeaponShapeModal: close button calls setBreathWeaponShapeModal(null)', () => {
      const setBreathWeaponShapeModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setBreathWeaponShapeModal })}
        breathWeaponShapeModal={{}}
      />);
      fireEvent.click(screen.getByTestId('breath-close'));
      expect(setBreathWeaponShapeModal).toHaveBeenCalledWith(null);
    });

    it('HypnoticPatternShakeModal: close button calls setHypnoticPatternShakeModal(null)', () => {
      const setHypnoticPatternShakeModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setHypnoticPatternShakeModal })}
        hypnoticPatternShakeModal={{}}
      />);
      fireEvent.click(screen.getByTestId('hypnotic-close'));
      expect(setHypnoticPatternShakeModal).toHaveBeenCalledWith(null);
    });
  });
});
