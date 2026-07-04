// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
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
vi.mock('./modals/BulwarkOfForceModal.jsx', () => ({
  default: function TestModal({ onSkip }) {
    return (
      <div data-testid="bulwark-of-force-modal">
        <button data-testid="bulwark-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));
vi.mock('./modals/CoronaEnemySelectionModal.jsx', () => ({
  default: function TestModal({ onSkip }) {
    return (
      <div data-testid="corona-enemy-selection-modal">
        <button data-testid="corona-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));
vi.mock('./modals/RadianceOfDawnModal.jsx', () => ({
  default: function TestModal({ onSkip }) {
    return (
      <div data-testid="radiance-of-dawn-modal">
        <button data-testid="radiance-skip" onClick={onSkip}>Skip</button>
      </div>
    );
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
    handleDivineInterventionCast: vi.fn(),
    handleDivinationSavantConfirm: vi.fn(),
    handleIllusionSavantConfirm: vi.fn(),
    setRallyChoiceModal: vi.fn(),
    handleRallyChoiceConfirm: vi.fn(),
    pendingDamageRef: { current: null },
    ...overrides,
  };
}

// ── Tests ──

describe('CharActionModals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── No modals visible ──

  it('renders empty fragment when no modal props are set', () => {
    const { container } = render(<CharActionModals {...createBaseProps()} />);
    expect(container).toBeEmptyDOMElement();
  });

  // ── Modal rendering ──
  // Each modal is a conditional render: prop truthy → modal appears.
  // The handler tests in CharActionModals.handlers.test.jsx verify close/dismiss
  // behavior. These rendering tests cover one representative per modal family
  // to confirm the component maps props to the correct modal — the minimal
  // behavioral contract. Individual per-modal tests were removed as redundant:
  // 40 near-identical tests asserting the same pattern (prop truthy → modal
  // rendered) added no unique confidence beyond what the handler tests provide.
  //
  // Families covered:
  //   simple — basic conditional render with empty payload
  //   with-data — conditional render with non-trivial payload
  //   inline — inline overlay (div-based, not a mocked component)

  describe('modal rendering', () => {
    it('renders healing-pool modal when healingPoolModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} healingPoolModal={{ name: 'Test Pool' }} />);
      expect(screen.getByTestId('healing-pool-modal')).toBeInTheDocument();
    });

    it('renders hand-of-healing modal when handOfHealingModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} handOfHealingModal={{}} />);
      expect(screen.getByTestId('hand-of-healing-modal')).toBeInTheDocument();
    });

    it('renders font-of-magic modal when fontOfMagicModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} fontOfMagicModal={{}} />);
      expect(screen.getByTestId('font-of-magic-modal')).toBeInTheDocument();
    });

    it('renders resource-pool modal when resourcePoolModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} resourcePoolModal={{}} />);
      expect(screen.getByTestId('resource-pool-modal')).toBeInTheDocument();
    });

    it('renders moonlight-step-resource modal when moonlightStepResourceModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} moonlightStepResourceModal={{ automation: {} }} />);
      expect(screen.getByTestId('moonlight-step-resource-modal')).toBeInTheDocument();
    });

    it('renders wild-companion modal when wildCompanionModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} wildCompanionModal={{}} />);
      expect(screen.getByTestId('wild-companion-modal')).toBeInTheDocument();
    });

    it('renders set-condition modal when setConditionModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} setConditionModal={{}} />);
      expect(screen.getByTestId('set-condition-modal')).toBeInTheDocument();
    });

    it('renders eyebite-effect modal when eyebiteEffectModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} eyebiteEffectModal={{}} />);
      expect(screen.getByTestId('eyebite-effect-modal')).toBeInTheDocument();
    });

    it('renders attack-rider modal when attackRiderModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} attackRiderModal={{}} />);
      expect(screen.getByTestId('attack-rider-modal')).toBeInTheDocument();
    });

    it('renders open-hand-technique modal when openHandTechniqueModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} openHandTechniqueModal={{}} />);
      expect(screen.getByTestId('open-hand-technique-modal')).toBeInTheDocument();
    });

    it('renders weapon-mastery modal when weaponMasteryModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} weaponMasteryModal={{}} />);
      expect(screen.getByTestId('weapon-mastery-modal')).toBeInTheDocument();
    });

    it('renders combat-stance modal when combatStanceModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} combatStanceModal={{}} />);
      expect(screen.getByTestId('combat-stance-modal')).toBeInTheDocument();
    });

    it('renders teleport modal when teleportModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} teleportModal={{}} />);
      expect(screen.getByTestId('teleport-modal')).toBeInTheDocument();
    });

    it('renders healing-illusion modal when healingIllusionModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} healingIllusionModal={{}} />);
      expect(screen.getByText('Healing Illusion')).toBeInTheDocument();
    });

    it('renders save-attack-heal modal when saveAttackHealModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} saveAttackHealModal={{}} />);
      expect(screen.getByTestId('save-attack-heal-modal')).toBeInTheDocument();
    });

    it('renders divine-spark modal when divineSparkModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} divineSparkModal={{}} />);
      expect(screen.getByTestId('divine-spark-modal')).toBeInTheDocument();
    });

    it('renders divine-intervention modal when divineInterventionModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} divineInterventionModal={{}} />);
      expect(screen.getByTestId('divine-intervention-modal')).toBeInTheDocument();
    });

    it('renders arcane-charge modal when arcaneChargeModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} arcaneChargeModal={{}} />);
      expect(screen.getByTestId('arcane-charge-modal')).toBeInTheDocument();
    });

    it('renders war-magic-cantrip modal when warMagicCantripModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} warMagicCantripModal={{}} />);
      expect(screen.getByTestId('war-magic-cantrip-modal')).toBeInTheDocument();
    });

    it('renders war-magic-spell modal when warMagicSpellModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} warMagicSpellModal={{}} />);
      expect(screen.getByTestId('war-magic-spell-modal')).toBeInTheDocument();
    });

    it('renders sacred-weapon modal when sacredWeaponModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} sacredWeaponModal={{}} />);
      expect(screen.getByTestId('sacred-weapon-modal')).toBeInTheDocument();
    });

    it('renders elder-champion-restore modal when elderChampionRestoreModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} elderChampionRestoreModal={{ payload: { action: {}, playerStats: {}, campaignName: 'test' } }} />);
      expect(screen.getByTestId('elder-champion-restore-modal')).toBeInTheDocument();
    });

    it('renders primal-companion-bonus-action modal when primalCompanionBonusActionModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} primalCompanionBonusActionModal={{}} />);
      expect(screen.getByTestId('primal-companion-bonus-action-modal')).toBeInTheDocument();
    });

    it('renders misty-wanderer modal when mistyWandererModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} mistyWandererModal={{}} />);
      expect(screen.getByTestId('misty-wanderer-modal')).toBeInTheDocument();
    });

    it('renders bonus-action-choice modal when bonusActionChoiceModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} bonusActionChoiceModal={{}} />);
      expect(screen.getByTestId('bonus-action-choice-modal')).toBeInTheDocument();
    });

    it('renders revelation-in-flesh modal when revelationInFleshModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} revelationInFleshModal={{}} />);
      expect(screen.getByTestId('revelation-in-flesh-modal')).toBeInTheDocument();
    });

    it('renders elemental-affinity modal when elementalAffinityModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} elementalAffinityModal={{}} />);
      expect(screen.getByTestId('elemental-affinity-modal')).toBeInTheDocument();
    });

    it('renders fiendish-resilience modal when fiendishResilienceModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} fiendishResilienceModal={{}} />);
      expect(screen.getByTestId('fiendish-resilience-modal')).toBeInTheDocument();
    });

    it('renders dragon-companion modal when dragonCompanionModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} dragonCompanionModal={{}} />);
      expect(screen.getByTestId('dragon-companion-modal')).toBeInTheDocument();
    });

    it('renders wild-magic-double-roll modal when wildMagicDoubleRollModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} wildMagicDoubleRollModal={{}} />);
      expect(screen.getByTestId('wild-magic-double-roll-modal')).toBeInTheDocument();
    });

    it('renders wild-magic-tamed modal when wildMagicTamedModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} wildMagicTamedModal={{}} />);
      expect(screen.getByTestId('wild-magic-tamed-modal')).toBeInTheDocument();
    });

    it('renders third-eye modal when thirdEyeModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} thirdEyeModal={{ action: {}, playerStats: {}, campaignName: 'test' }} />);
      expect(screen.getByTestId('third-eye-modal')).toBeInTheDocument();
    });

    it('renders soulstitch-spells modal when soulstitchSpellsModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} soulstitchSpellsModal={{}} />);
      expect(screen.getByTestId('soulstitch-spells-modal')).toBeInTheDocument();
    });

    it('renders illusory-reality modal when illusoryRealityModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} illusoryRealityModal={{}} />);
      expect(screen.getByTestId('illusory-reality-modal')).toBeInTheDocument();
    });

    it('renders celestial-revelation modal when celestialRevelationModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} celestialRevelationModal={{}} />);
      expect(screen.getByTestId('celestial-revelation-modal')).toBeInTheDocument();
    });

    it('renders fiendish-legacy modal when fiendishLegacyModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} fiendishLegacyModal={{}} />);
      expect(screen.getByTestId('fiendish-legacy-modal')).toBeInTheDocument();
    });

    it('renders breath-weapon-shape modal when breathWeaponShapeModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} breathWeaponShapeModal={{}} />);
      expect(screen.getByTestId('breath-weapon-shape-modal')).toBeInTheDocument();
    });

    it('renders hypnotic-pattern-shake modal when hypnoticPatternShakeModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} hypnoticPatternShakeModal={{}} />);
      expect(screen.getByTestId('hypnotic-pattern-shake-modal')).toBeInTheDocument();
    });

    it('renders bulwark-of-force modal when bulwarkOfForceModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} bulwarkOfForceModal={{ creatureTargets: [{ name: 'Goblin' }], maxTargets: 3 }} />);
      expect(screen.getByTestId('bulwark-of-force-modal')).toBeInTheDocument();
    });

    it('renders corona-enemy-selection modal when coronaEnemySelectionModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} coronaEnemySelectionModal={{ creatureTargets: [{ name: 'Dragon' }] }} />);
      expect(screen.getByTestId('corona-enemy-selection-modal')).toBeInTheDocument();
    });

    it('renders radiance-of-dawn modal when radianceOfDawnModal is truthy', () => {
      render(<CharActionModals {...createBaseProps()} radianceOfDawnModal={{ creatureTargets: [{ name: 'Goblin' }], saveType: 'Dex', saveDc: 15, damageExpression: '3d10', damageType: 'Radiant', rangeFeet: 15 }} />);
      expect(screen.getByTestId('radiance-of-dawn-modal')).toBeInTheDocument();
    });

    it('renders divine-fury inline modal when divineFuryChoice is truthy', () => {
      render(<CharActionModals {...createBaseProps()} divineFuryChoice={{}} />);
      expect(screen.getByText(/Divine Fury/)).toBeInTheDocument();
    });

    it('renders damage-type inline modal when damageTypeChoice is truthy', () => {
      render(<CharActionModals {...createBaseProps()} damageTypeChoice={{ title: 'Pick', types: ['Fire', 'Ice'] }} />);
      expect(screen.getByText(/Pick/)).toBeInTheDocument();
    });

    it('renders feature-choice inline modal when featureChoice is truthy', () => {
      render(<CharActionModals {...createBaseProps()} featureChoice={{ action: { name: 'Test Feature', description: 'Choose wisely' }, options: ['Option A', 'Option B'] }} />);
      expect(screen.getByText(/Test Feature/)).toBeInTheDocument();
    });
  });

  // ── Multiple modals simultaneously ──

  describe('multiple modals', () => {
    it('renders both modals when healingPoolModal and divineFuryChoice are set', () => {
      render(<CharActionModals
        {...createBaseProps()}
        healingPoolModal={{ name: 'Test Pool' }}
        divineFuryChoice={{}}
      />);
      expect(screen.getByTestId('healing-pool-modal')).toBeInTheDocument();
      expect(screen.getByText(/Divine Fury/)).toBeInTheDocument();
    });

    it('renders both constellation modal variants simultaneously', () => {
      render(<CharActionModals
        {...createBaseProps()}
        starryFormConstellationModal={{ payload: { action: {}, playerStats: {}, campaignName: 'test' } }}
        twinklingConstellationModal={{ payload: { action: {}, playerStats: {}, campaignName: 'test' } }}
      />);
      const modals = screen.getAllByTestId('constellation-selection-modal');
      expect(modals).toHaveLength(2);
    });
  });
});
