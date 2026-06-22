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

describe('CharActionModals inline modals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Cleave modal behavior ──

  describe('Cleave modal', () => {
    it('renders Cleave overlay with header', () => {
      render(<CharActionModals
        {...createBaseProps()}
        cleaveAttackPending={{ secondTargets: [{ name: 'Goblin', maxHp: 20, currentHp: 10 }] }}
      />);
      expect(screen.getByText(/Choose Second Target/)).toBeInTheDocument();
    });

    it('renders each target name from secondTargets', () => {
      render(<CharActionModals
        {...createBaseProps()}
        cleaveAttackPending={{ secondTargets: [{ name: 'Goblin', maxHp: 20, currentHp: 10 }, { name: 'Ogre', maxHp: 50, currentHp: 25 }] }}
      />);
      expect(screen.getByText('Goblin')).toBeInTheDocument();
      expect(screen.getByText('Ogre')).toBeInTheDocument();
    });

    it('renders HP display for each target', () => {
      render(<CharActionModals
        {...createBaseProps()}
        cleaveAttackPending={{ secondTargets: [{ name: 'Goblin', maxHp: 20, currentHp: 10 }] }}
      />);
      expect(screen.getByText('10/20 HP (50%)')).toBeInTheDocument();
    });

    it('renders HP display with currentHp defaulting to maxHp when currentHp is undefined', () => {
      render(<CharActionModals
        {...createBaseProps()}
        cleaveAttackPending={{ secondTargets: [{ name: 'Full Health', maxHp: 30 }] }}
      />);
      expect(screen.getByText('30/30 HP (100%)')).toBeInTheDocument();
    });

    it('renders 0% HP when currentHp is 0', () => {
      render(<CharActionModals
        {...createBaseProps()}
        cleaveAttackPending={{ secondTargets: [{ name: 'Dead', maxHp: 30, currentHp: 0 }] }}
      />);
      expect(screen.getByText('0/30 HP (0%)')).toBeInTheDocument();
    });

    it('renders Skip button', () => {
      render(<CharActionModals
        {...createBaseProps()}
        cleaveAttackPending={{ secondTargets: [{ name: 'Goblin', maxHp: 20, currentHp: 10 }] }}
      />);
      expect(screen.getByText('Skip')).toBeInTheDocument();
    });

    it('renders overlay with sp-overlay class', () => {
      render(<CharActionModals
        {...createBaseProps()}
        cleaveAttackPending={{ secondTargets: [{ name: 'Goblin', maxHp: 20, currentHp: 10 }] }}
      />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });

    it('renders modal container with sp-modal class', () => {
      render(<CharActionModals
        {...createBaseProps()}
        cleaveAttackPending={{ secondTargets: [{ name: 'Goblin', maxHp: 20, currentHp: 10 }] }}
      />);
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('calls handleCleaveAttack when clicking a target name', () => {
      const handleCleaveAttack = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleCleaveAttack })}
        cleaveAttackPending={{ secondTargets: [{ name: 'Goblin', maxHp: 15, currentHp: 8 }] }}
      />);
      fireEvent.click(screen.getByText('Goblin'));
      expect(handleCleaveAttack).toHaveBeenCalledWith('Goblin');
    });

    it('calls handleCleaveSkip when clicking Skip button', () => {
      const handleCleaveSkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleCleaveSkip })}
        cleaveAttackPending={{ secondTargets: [{ name: 'Goblin', maxHp: 20, currentHp: 10 }] }}
      />);
      fireEvent.click(screen.getByText('Skip'));
      expect(handleCleaveSkip).toHaveBeenCalled();
    });

    it('calls handleCleaveSkip when clicking the overlay background', () => {
      const handleCleaveSkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleCleaveSkip })}
        cleaveAttackPending={{ secondTargets: [{ name: 'Goblin', maxHp: 20, currentHp: 10 }] }}
      />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(handleCleaveSkip).toHaveBeenCalled();
    });

    it('does not call handleCleaveSkip when clicking inside the modal content', () => {
      const handleCleaveSkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleCleaveSkip })}
        cleaveAttackPending={{ secondTargets: [{ name: 'Goblin', maxHp: 20, currentHp: 10 }] }}
      />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(handleCleaveSkip).not.toHaveBeenCalled();
    });

    it('renders cleave modal when secondTargets is empty array', () => {
      render(<CharActionModals
        {...createBaseProps()}
        cleaveAttackPending={{ secondTargets: [] }}
      />);
      expect(screen.getByText(/Choose Second Target/)).toBeInTheDocument();
    });
  });

  // ── Divine Fury choice modal ──

  describe('Divine Fury choice modal', () => {
    it('renders header with bolt icon and title', () => {
      render(<CharActionModals {...createBaseProps()} divineFuryChoice={{}} />);
      expect(screen.getByText(/Divine Fury/)).toBeInTheDocument();
    });

    it('renders Necrotic and Radiant damage type buttons', () => {
      render(<CharActionModals {...createBaseProps()} divineFuryChoice={{}} />);
      expect(screen.getByText('Necrotic')).toBeInTheDocument();
      expect(screen.getByText('Radiant')).toBeInTheDocument();
    });

    it('renders Skip button', () => {
      render(<CharActionModals {...createBaseProps()} divineFuryChoice={{}} />);
      expect(screen.getByText('Skip')).toBeInTheDocument();
    });

    it('renders overlay with sp-overlay class', () => {
      render(<CharActionModals {...createBaseProps()} divineFuryChoice={{}} />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });

    it('renders modal container with sp-modal class', () => {
      render(<CharActionModals {...createBaseProps()} divineFuryChoice={{}} />);
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('calls handleDivineFuryDamageType with Necrotic when Necrotic button is clicked', () => {
      const handleDivineFuryDamageType = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleDivineFuryDamageType })}
        divineFuryChoice={{}}
      />);
      fireEvent.click(screen.getByText('Necrotic'));
      expect(handleDivineFuryDamageType).toHaveBeenCalledWith('Necrotic');
    });

    it('calls handleDivineFuryDamageType with Radiant when Radiant button is clicked', () => {
      const handleDivineFuryDamageType = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleDivineFuryDamageType })}
        divineFuryChoice={{}}
      />);
      fireEvent.click(screen.getByText('Radiant'));
      expect(handleDivineFuryDamageType).toHaveBeenCalledWith('Radiant');
    });

    it('calls handleDivineFurySkip when Skip button is clicked', () => {
      const handleDivineFurySkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleDivineFurySkip })}
        divineFuryChoice={{}}
      />);
      fireEvent.click(screen.getByText('Skip'));
      expect(handleDivineFurySkip).toHaveBeenCalled();
    });

    it('calls handleDivineFurySkip when overlay is clicked', () => {
      const handleDivineFurySkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleDivineFurySkip })}
        divineFuryChoice={{}}
      />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(handleDivineFurySkip).toHaveBeenCalled();
    });

    it('does not call handleDivineFurySkip when clicking inside the modal content', () => {
      const handleDivineFurySkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleDivineFurySkip })}
        divineFuryChoice={{}}
      />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(handleDivineFurySkip).not.toHaveBeenCalled();
    });
  });

  // ── Damage Type choice modal ──

  describe('Damage Type choice modal', () => {
    it('renders header with bolt icon and title', () => {
      render(<CharActionModals
        {...createBaseProps()}
        damageTypeChoice={{ title: 'Pick', types: ['Fire', 'Ice'] }}
      />);
      expect(screen.getByText('Pick')).toBeInTheDocument();
    });

    it('renders each damage type from types array', () => {
      render(<CharActionModals
        {...createBaseProps()}
        damageTypeChoice={{ title: 'Pick', types: ['Fire', 'Ice'] }}
      />);
      expect(screen.getByText('Fire')).toBeInTheDocument();
      expect(screen.getByText('Ice')).toBeInTheDocument();
    });

    it('renders Skip button', () => {
      render(<CharActionModals
        {...createBaseProps()}
        damageTypeChoice={{ title: 'Pick', types: ['Fire', 'Ice'] }}
      />);
      expect(screen.getByText('Skip')).toBeInTheDocument();
    });

    it('renders overlay with sp-overlay class', () => {
      render(<CharActionModals
        {...createBaseProps()}
        damageTypeChoice={{ title: 'Pick', types: ['Fire', 'Ice'] }}
      />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });

    it('renders modal container with sp-modal class', () => {
      render(<CharActionModals
        {...createBaseProps()}
        damageTypeChoice={{ title: 'Pick', types: ['Fire', 'Ice'] }}
      />);
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('calls generic handler when no pendingDamageRef', () => {
      const handleGenericDamageTypeChoice = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleGenericDamageTypeChoice })}
        damageTypeChoice={{ title: 'Pick', types: ['Fire', 'Ice'] }}
      />);
      fireEvent.click(screen.getByText('Fire'));
      expect(handleGenericDamageTypeChoice).toHaveBeenCalledWith('Fire');
    });

    it('calls enhanced unarmed handler when pendingDamageRef has _attackRider', () => {
      const handleEnhancedUnarmedChoice = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleEnhancedUnarmedChoice, pendingDamageRef: { current: { _attackRider: true } } })}
        damageTypeChoice={{ title: 'Pick', types: ['Fire', 'Ice'] }}
      />);
      fireEvent.click(screen.getByText('Fire'));
      expect(handleEnhancedUnarmedChoice).toHaveBeenCalledWith('Fire');
    });

    it('calls modifier handler when pendingDamageRef has _damageTypeModifier', () => {
      const handleDamageTypeModifierChoice = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleDamageTypeModifierChoice, pendingDamageRef: { current: { _damageTypeModifier: true } } })}
        damageTypeChoice={{ title: 'Pick', types: ['Fire', 'Ice'] }}
      />);
      fireEvent.click(screen.getByText('Fire'));
      expect(handleDamageTypeModifierChoice).toHaveBeenCalledWith('Fire');
    });

    it('prioritizes _attackRider over _damageTypeModifier when both are set', () => {
      const handleEnhancedUnarmedChoice = vi.fn();
      const handleDamageTypeModifierChoice = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleEnhancedUnarmedChoice, handleDamageTypeModifierChoice, pendingDamageRef: { current: { _attackRider: true, _damageTypeModifier: true } } })}
        damageTypeChoice={{ title: 'Pick', types: ['Fire', 'Ice'] }}
      />);
      fireEvent.click(screen.getByText('Fire'));
      expect(handleEnhancedUnarmedChoice).toHaveBeenCalledWith('Fire');
      expect(handleDamageTypeModifierChoice).not.toHaveBeenCalled();
    });

    it('calls generic skip handler when no pendingDamageRef', () => {
      const handleGenericDamageTypeSkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleGenericDamageTypeSkip })}
        damageTypeChoice={{ title: 'Pick', types: ['Fire'] }}
      />);
      fireEvent.click(screen.getByText('Skip'));
      expect(handleGenericDamageTypeSkip).toHaveBeenCalled();
    });

    it('calls enhanced unarmed skip handler when pendingDamageRef has _attackRider', () => {
      const handleEnhancedUnarmedSkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleEnhancedUnarmedSkip, pendingDamageRef: { current: { _attackRider: true } } })}
        damageTypeChoice={{ title: 'Pick', types: ['Fire'] }}
      />);
      fireEvent.click(screen.getByText('Skip'));
      expect(handleEnhancedUnarmedSkip).toHaveBeenCalled();
    });

    it('calls modifier skip handler when pendingDamageRef has _damageTypeModifier', () => {
      const handleDamageTypeModifierSkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleDamageTypeModifierSkip, pendingDamageRef: { current: { _damageTypeModifier: true } } })}
        damageTypeChoice={{ title: 'Pick', types: ['Fire'] }}
      />);
      fireEvent.click(screen.getByText('Skip'));
      expect(handleDamageTypeModifierSkip).toHaveBeenCalled();
    });

    it('calls generic skip handler when overlay is clicked with no pendingDamageRef', () => {
      const handleGenericDamageTypeSkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleGenericDamageTypeSkip })}
        damageTypeChoice={{ title: 'Pick', types: ['Fire'] }}
      />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(handleGenericDamageTypeSkip).toHaveBeenCalled();
    });

    it('calls enhanced unarmed skip handler when overlay is clicked with _attackRider', () => {
      const handleEnhancedUnarmedSkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleEnhancedUnarmedSkip, pendingDamageRef: { current: { _attackRider: true } } })}
        damageTypeChoice={{ title: 'Pick', types: ['Fire'] }}
      />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(handleEnhancedUnarmedSkip).toHaveBeenCalled();
    });

    it('calls modifier skip handler when overlay is clicked with _damageTypeModifier', () => {
      const handleDamageTypeModifierSkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleDamageTypeModifierSkip, pendingDamageRef: { current: { _damageTypeModifier: true } } })}
        damageTypeChoice={{ title: 'Pick', types: ['Fire'] }}
      />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(handleDamageTypeModifierSkip).toHaveBeenCalled();
    });

    it('does not call generic skip handler when clicking inside the modal content', () => {
      const handleGenericDamageTypeSkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleGenericDamageTypeSkip })}
        damageTypeChoice={{ title: 'Pick', types: ['Fire'] }}
      />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(handleGenericDamageTypeSkip).not.toHaveBeenCalled();
    });

    it('renders damage type buttons from custom types array', () => {
      render(<CharActionModals
        {...createBaseProps()}
        damageTypeChoice={{ title: 'Pick', types: ['Acid', 'Poison', 'Thunder'] }}
      />);
      expect(screen.getByText('Acid')).toBeInTheDocument();
      expect(screen.getByText('Poison')).toBeInTheDocument();
      expect(screen.getByText('Thunder')).toBeInTheDocument();
    });

    it('renders empty types array without type buttons', () => {
      render(<CharActionModals
        {...createBaseProps()}
        damageTypeChoice={{ title: 'Pick', types: [] }}
      />);
      expect(screen.getByText('Pick')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Acid|Fire|Ice/ })).not.toBeInTheDocument();
    });
  });

  // ── Feature Choice modal ──

  describe('Feature Choice modal', () => {
    it('renders header with bolt icon and action name', () => {
      render(<CharActionModals
        {...createBaseProps()}
        featureChoice={{ action: { name: 'Test Feature', description: 'Choose wisely' }, options: ['Option A', 'Option B'] }}
      />);
      expect(screen.getByText('Test Feature')).toBeInTheDocument();
    });

    it('renders action description', () => {
      render(<CharActionModals
        {...createBaseProps()}
        featureChoice={{ action: { name: 'Test Feature', description: 'Choose wisely' }, options: ['Option A', 'Option B'] }}
      />);
      expect(screen.getByText('Choose wisely')).toBeInTheDocument();
    });

    it('renders each option as a button', () => {
      render(<CharActionModals
        {...createBaseProps()}
        featureChoice={{ action: { name: 'Test Feature', description: 'Choose wisely' }, options: ['Option A', 'Option B'] }}
      />);
      expect(screen.getByText('Option A')).toBeInTheDocument();
      expect(screen.getByText('Option B')).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
      render(<CharActionModals
        {...createBaseProps()}
        featureChoice={{ action: { name: 'Test Feature', description: 'Choose wisely' }, options: ['Option A', 'Option B'] }}
      />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders overlay with sp-overlay class', () => {
      render(<CharActionModals
        {...createBaseProps()}
        featureChoice={{ action: { name: 'Test Feature', description: 'Choose wisely' }, options: ['Option A', 'Option B'] }}
      />);
      expect(document.querySelector('.sp-overlay')).toBeInTheDocument();
    });

    it('renders modal container with sp-modal class', () => {
      render(<CharActionModals
        {...createBaseProps()}
        featureChoice={{ action: { name: 'Test Feature', description: 'Choose wisely' }, options: ['Option A', 'Option B'] }}
      />);
      expect(document.querySelector('.sp-modal')).toBeInTheDocument();
    });

    it('calls handleFeatureChoiceConfirm with option string when clicked', () => {
      const handleFeatureChoiceConfirm = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleFeatureChoiceConfirm })}
        featureChoice={{ action: { name: 'Test Feature', description: 'Choose wisely' }, options: ['Option A', 'Option B'] }}
      />);
      fireEvent.click(screen.getByText('Option A'));
      expect(handleFeatureChoiceConfirm).toHaveBeenCalledWith('Option A');
    });

    it('calls handleFeatureChoiceConfirm with option name object property when clicked', () => {
      const handleFeatureChoiceConfirm = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleFeatureChoiceConfirm })}
        featureChoice={{ action: { name: 'Pick', description: 'Pick one' }, options: [{ name: 'Custom Option' }] }}
      />);
      fireEvent.click(screen.getByText('Custom Option'));
      expect(handleFeatureChoiceConfirm).toHaveBeenCalledWith('Custom Option');
    });

    it('calls handleFeatureChoiceSkip when Cancel button is clicked', () => {
      const handleFeatureChoiceSkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleFeatureChoiceSkip })}
        featureChoice={{ action: { name: 'Pick', description: 'Pick one' }, options: ['Alpha'] }}
      />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(handleFeatureChoiceSkip).toHaveBeenCalled();
    });

    it('calls handleFeatureChoiceSkip when overlay is clicked', () => {
      const handleFeatureChoiceSkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleFeatureChoiceSkip })}
        featureChoice={{ action: { name: 'Pick', description: 'Pick one' }, options: ['Alpha'] }}
      />);
      fireEvent.click(document.querySelector('.sp-overlay'));
      expect(handleFeatureChoiceSkip).toHaveBeenCalled();
    });

    it('does not call handleFeatureChoiceSkip when clicking inside the modal content', () => {
      const handleFeatureChoiceSkip = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleFeatureChoiceSkip })}
        featureChoice={{ action: { name: 'Pick', description: 'Pick one' }, options: ['Alpha'] }}
      />);
      fireEvent.click(document.querySelector('.sp-modal'));
      expect(handleFeatureChoiceSkip).not.toHaveBeenCalled();
    });

    it('renders empty options array without option buttons', () => {
      render(<CharActionModals
        {...createBaseProps()}
        featureChoice={{ action: { name: 'Pick', description: 'Pick one' }, options: [] }}
      />);
      expect(screen.getByText('Pick')).toBeInTheDocument();
      expect(screen.getByText('Pick one')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Alpha' })).not.toBeInTheDocument();
    });
  });
});
