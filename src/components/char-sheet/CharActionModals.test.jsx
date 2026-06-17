import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';

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
  default: function TestModal() { return <div data-testid="weapon-mastery-modal">WeaponMasteryModal</div>; },
}));
vi.mock('./modals/WeaponMasteryChoiceModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="weapon-mastery-choice-modal">WeaponMasteryChoiceModal</div>; },
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
vi.mock('./modals/arcane/DivinationSavantModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="divination-savant-modal">DivinationSavantModal</div>; },
}));
vi.mock('./modals/arcane/IllusionSavantModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="illusion-savant-modal">IllusionSavantModal</div>; },
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

const baseProps = {
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
};

describe('CharActionModals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    baseProps.pendingDamageRef.current = null;
  });

  it('renders nothing when all modal flags are falsy', () => {
    const { container } = render(<CharActionModals {...baseProps} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders HealingPoolModal when healingPoolModal is set', () => {
    render(<CharActionModals {...baseProps} healingPoolModal={{ name: 'Test Pool' }} />);
    expect(screen.getByTestId('healing-pool-modal')).toBeInTheDocument();
  });

  it('renders HandOfHealingModal when set', () => {
    render(<CharActionModals {...baseProps} handOfHealingModal={{}} />);
    expect(screen.getByTestId('hand-of-healing-modal')).toBeInTheDocument();
  });

  it('renders FontOfMagicModal when set', () => {
    render(<CharActionModals {...baseProps} fontOfMagicModal={{}} />);
    expect(screen.getByTestId('font-of-magic-modal')).toBeInTheDocument();
  });

  it('renders ResourcePoolModal when set', () => {
    render(<CharActionModals {...baseProps} resourcePoolModal={{}} />);
    expect(screen.getByTestId('resource-pool-modal')).toBeInTheDocument();
  });

  it('renders WildCompanionModal when set', () => {
    render(<CharActionModals {...baseProps} wildCompanionModal={{}} />);
    expect(screen.getByTestId('wild-companion-modal')).toBeInTheDocument();
  });

  it('renders SetConditionModal when set', () => {
    render(<CharActionModals {...baseProps} setConditionModal={{}} />);
    expect(screen.getByTestId('set-condition-modal')).toBeInTheDocument();
  });

  it('renders AttackRiderModal when set', () => {
    render(<CharActionModals {...baseProps} attackRiderModal={{}} />);
    expect(screen.getByTestId('attack-rider-modal')).toBeInTheDocument();
  });

  it('renders OpenHandTechniqueModal when set', () => {
    render(<CharActionModals {...baseProps} openHandTechniqueModal={{}} />);
    expect(screen.getByTestId('open-hand-technique-modal')).toBeInTheDocument();
  });

  it('renders WeaponMasteryModal when set', () => {
    render(<CharActionModals {...baseProps} weaponMasteryModal={{}} />);
    expect(screen.getByTestId('weapon-mastery-modal')).toBeInTheDocument();
  });

  it('renders Cleave modal with second targets', () => {
    render(<CharActionModals
      {...baseProps}
      cleaveAttackPending={{
        secondTargets: [{ name: 'Enemy 1', maxHp: 20, currentHp: 10 }],
      }}
    />);
    expect(screen.getByText(/Choose Second Target/)).toBeInTheDocument();
    expect(screen.getByText('Enemy 1')).toBeInTheDocument();
  });

  it('renders Cleave modal skip button', () => {
    render(<CharActionModals
      {...baseProps}
      cleaveAttackPending={{
        secondTargets: [{ name: 'Enemy 1', maxHp: 20, currentHp: 10 }],
      }}
    />);
    const skipBtn = screen.getByText('Skip');
    fireEvent.click(skipBtn);
    expect(baseProps.handleCleaveSkip).toHaveBeenCalled();
  });

  it('renders CombatStanceModal when set', () => {
    render(<CharActionModals {...baseProps} combatStanceModal={{}} />);
    expect(screen.getByTestId('combat-stance-modal')).toBeInTheDocument();
  });

  it('renders DivineInterventionModal when set', () => {
    render(<CharActionModals {...baseProps} divineInterventionModal={{}} />);
    expect(screen.getByTestId('divine-intervention-modal')).toBeInTheDocument();
  });

  it('renders DivineSparkModal when set', () => {
    render(<CharActionModals {...baseProps} divineSparkModal={{}} />);
    expect(screen.getByTestId('divine-spark-modal')).toBeInTheDocument();
  });

  it('renders ArcaneChargeModal when set', () => {
    render(<CharActionModals {...baseProps} arcaneChargeModal={{}} />);
    expect(screen.getByTestId('arcane-charge-modal')).toBeInTheDocument();
  });

  it('renders WarMagicCantripModal when set', () => {
    render(<CharActionModals {...baseProps} warMagicCantripModal={{}} />);
    expect(screen.getByTestId('war-magic-cantrip-modal')).toBeInTheDocument();
  });

  it('renders SacredWeaponModal when set', () => {
    render(<CharActionModals {...baseProps} sacredWeaponModal={{}} />);
    expect(screen.getByTestId('sacred-weapon-modal')).toBeInTheDocument();
  });

  it('renders ElderChampionRestoreModal when set', () => {
    render(<CharActionModals
      {...baseProps}
      elderChampionRestoreModal={{ payload: { action: {}, playerStats: {}, campaignName: 'test' } }}
    />);
    expect(screen.getByTestId('elder-champion-restore-modal')).toBeInTheDocument();
  });

  it('renders MistyWandererModal when set', () => {
    render(<CharActionModals {...baseProps} mistyWandererModal={{}} />);
    expect(screen.getByTestId('misty-wanderer-modal')).toBeInTheDocument();
  });

  it('renders BonusActionChoiceModal when set', () => {
    render(<CharActionModals {...baseProps} bonusActionChoiceModal={{}} />);
    expect(screen.getByTestId('bonus-action-choice-modal')).toBeInTheDocument();
  });

  it('renders ElementalAffinityModal when set', () => {
    render(<CharActionModals {...baseProps} elementalAffinityModal={{}} />);
    expect(screen.getByTestId('elemental-affinity-modal')).toBeInTheDocument();
  });

  it('renders FiendishResilienceModal when set', () => {
    render(<CharActionModals {...baseProps} fiendishResilienceModal={{}} />);
    expect(screen.getByTestId('fiendish-resilience-modal')).toBeInTheDocument();
  });

  it('renders DragonCompanionModal when set', () => {
    render(<CharActionModals {...baseProps} dragonCompanionModal={{}} />);
    expect(screen.getByTestId('dragon-companion-modal')).toBeInTheDocument();
  });

  it('renders WildMagicDoubleRollModal when set', () => {
    render(<CharActionModals {...baseProps} wildMagicDoubleRollModal={{}} />);
    expect(screen.getByTestId('wild-magic-double-roll-modal')).toBeInTheDocument();
  });

  it('renders WildMagicTamedModal when set', () => {
    render(<CharActionModals {...baseProps} wildMagicTamedModal={{}} />);
    expect(screen.getByTestId('wild-magic-tamed-modal')).toBeInTheDocument();
  });

  it('renders DivinationSavantModal when set', () => {
    render(<CharActionModals {...baseProps} divinationSavantModal={{ payload: {} }} />);
    expect(screen.getByTestId('divination-savant-modal')).toBeInTheDocument();
  });

  it('renders IllusionSavantModal when set', () => {
    render(<CharActionModals {...baseProps} illusionSavantModal={{ payload: {} }} />);
    expect(screen.getByTestId('illusion-savant-modal')).toBeInTheDocument();
  });

  it('renders ThirdEyeModal when set', () => {
    render(<CharActionModals {...baseProps} thirdEyeModal={{ action: {}, playerStats: {}, campaignName: 'test' }} />);
    expect(screen.getByTestId('third-eye-modal')).toBeInTheDocument();
  });

  it('renders CelestialRevelationModal when set', () => {
    render(<CharActionModals {...baseProps} celestialRevelationModal={{}} />);
    expect(screen.getByTestId('celestial-revelation-modal')).toBeInTheDocument();
  });

  it('renders FiendishLegacyModal when set', () => {
    render(<CharActionModals {...baseProps} fiendishLegacyModal={{}} />);
    expect(screen.getByTestId('fiendish-legacy-modal')).toBeInTheDocument();
  });

  it('renders GiantAncestryModal when set', () => {
    render(<CharActionModals {...baseProps} giantAncestryModal={{}} />);
    expect(screen.getByTestId('giant-ancestry-modal')).toBeInTheDocument();
  });

  it('renders BreathWeaponShapeModal when set', () => {
    render(<CharActionModals {...baseProps} breathWeaponShapeModal={{}} />);
    expect(screen.getByTestId('breath-weapon-shape-modal')).toBeInTheDocument();
  });

  it('renders HypnoticPatternShakeModal when set', () => {
    render(<CharActionModals {...baseProps} hypnoticPatternShakeModal={{}} />);
    expect(screen.getByTestId('hypnotic-pattern-shake-modal')).toBeInTheDocument();
  });

  it('renders Divine Fury choice modal with damage type options', () => {
    render(<CharActionModals
      {...baseProps}
      divineFuryChoice={{}}
    />);
    expect(screen.getByText(/Divine Fury/)).toBeInTheDocument();
    expect(screen.getByText('Necrotic')).toBeInTheDocument();
    expect(screen.getByText('Radiant')).toBeInTheDocument();
  });

  it('renders damage type choice with types from options', () => {
    render(<CharActionModals
      {...baseProps}
      damageTypeChoice={{ title: 'Test', types: ['Fire', 'Cold', 'Lightning'] }}
    />);
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('Fire')).toBeInTheDocument();
    expect(screen.getByText('Cold')).toBeInTheDocument();
    expect(screen.getByText('Lightning')).toBeInTheDocument();
  });

  it('renders feature choice modal with options', () => {
    render(<CharActionModals
      {...baseProps}
      featureChoice={{
        action: { name: 'Test Feature', description: 'Choose wisely' },
        options: ['Option A', 'Option B'],
      }}
    />);
    expect(screen.getByText('Test Feature')).toBeInTheDocument();
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
  });

  it('renders ConstellationSelectionModal for starry form', () => {
    render(<CharActionModals
      {...baseProps}
      starryFormConstellationModal={{ payload: { action: {}, playerStats: {}, campaignName: 'test' } }}
    />);
    expect(screen.getByTestId('constellation-selection-modal')).toBeInTheDocument();
  });

  it('renders ConstellationSelectionModal for twinkling form', () => {
    render(<CharActionModals
      {...baseProps}
      twinklingConstellationModal={{ payload: { action: {}, playerStats: {}, campaignName: 'test' } }}
    />);
    expect(screen.getByTestId('constellation-selection-modal')).toBeInTheDocument();
  });

  it('renders multiple modals simultaneously', () => {
    render(<CharActionModals
      {...baseProps}
      healingPoolModal={{ name: 'Test Pool' }}
      divineFuryChoice={{}}
    />);
    expect(screen.getByTestId('healing-pool-modal')).toBeInTheDocument();
    expect(screen.getByText(/Divine Fury/)).toBeInTheDocument();
  });

  it('renders MoonlightStepResourceModal when set', () => {
    render(<CharActionModals {...baseProps} moonlightStepResourceModal={{ automation: {} }} />);
    expect(screen.getByTestId('moonlight-step-resource-modal')).toBeInTheDocument();
  });

  it('renders EyebiteEffectModal when set', () => {
    render(<CharActionModals {...baseProps} eyebiteEffectModal={{}} />);
    expect(screen.getByTestId('eyebite-effect-modal')).toBeInTheDocument();
  });

  it('renders TeleportModal when set', () => {
    render(<CharActionModals {...baseProps} teleportModal={{}} />);
    expect(screen.getByTestId('teleport-modal')).toBeInTheDocument();
  });

  it('renders HealingIllusionModal when set', () => {
    render(<CharActionModals {...baseProps} healingIllusionModal={{}} />);
    expect(screen.getByTestId('healing-illusion-modal')).toBeInTheDocument();
  });

  it('renders SaveAttackHealModal when set', () => {
    render(<CharActionModals {...baseProps} saveAttackHealModal={{}} />);
    expect(screen.getByTestId('save-attack-heal-modal')).toBeInTheDocument();
  });

  it('renders WarMagicSpellModal when set', () => {
    render(<CharActionModals {...baseProps} warMagicSpellModal={{}} />);
    expect(screen.getByTestId('war-magic-spell-modal')).toBeInTheDocument();
  });

  it('renders PrimalCompanionBonusActionModal when set', () => {
    render(<CharActionModals {...baseProps} primalCompanionBonusActionModal={{}} />);
    expect(screen.getByTestId('primal-companion-bonus-action-modal')).toBeInTheDocument();
  });

  it('renders RevelationInFleshModal when set', () => {
    render(<CharActionModals {...baseProps} revelationInFleshModal={{}} />);
    expect(screen.getByTestId('revelation-in-flesh-modal')).toBeInTheDocument();
  });

  it('renders BastionOfLawModal when set (renders twice)', () => {
    render(<CharActionModals {...baseProps} bastionOfLawModal={{ featureName: 'Test', auto: {} }} />);
    const modals = screen.getAllByTestId('bastion-of-law-modal');
    expect(modals).toHaveLength(2);
  });

  it('renders BoonOfEnergyResistanceModal when set', () => {
    render(<CharActionModals {...baseProps} boonOfEnergyResistanceModal={{}} />);
    expect(screen.getByTestId('boon-of-energy-resistance-modal')).toBeInTheDocument();
  });

  it('renders SoulstitchSpellsModal when set', () => {
    render(<CharActionModals {...baseProps} soulstitchSpellsModal={{}} />);
    expect(screen.getByTestId('soulstitch-spells-modal')).toBeInTheDocument();
  });

  it('renders IllusoryRealityModal when set', () => {
    render(<CharActionModals {...baseProps} illusoryRealityModal={{}} />);
    expect(screen.getByTestId('illusory-reality-modal')).toBeInTheDocument();
  });

  it('renders ElfisLineageModal when set', () => {
    render(<CharActionModals {...baseProps} elfishLineageModal={{}} />);
    expect(screen.getByTestId('elfis-lineage-modal')).toBeInTheDocument();
  });

  it('renders GnomishLineageModal when set', () => {
    render(<CharActionModals {...baseProps} gnomishLineageModal={{}} />);
    expect(screen.getByTestId('gnomish-lineage-modal')).toBeInTheDocument();
  });

  it('Cleave: clicking a target calls handleCleaveAttack with target name', () => {
    render(<CharActionModals
      {...baseProps}
      cleaveAttackPending={{
        secondTargets: [{ name: 'Goblin', maxHp: 15, currentHp: 8 }],
      }}
    />);
    fireEvent.click(screen.getByText('Goblin'));
    expect(baseProps.handleCleaveAttack).toHaveBeenCalledWith('Goblin');
  });

  it('Divine Fury: clicking Necrotic calls handleDivineFuryDamageType', () => {
    render(<CharActionModals {...baseProps} divineFuryChoice={{}} />);
    fireEvent.click(screen.getByText('Necrotic'));
    expect(baseProps.handleDivineFuryDamageType).toHaveBeenCalledWith('Necrotic');
  });

  it('Divine Fury: clicking Radiant calls handleDivineFuryDamageType', () => {
    render(<CharActionModals {...baseProps} divineFuryChoice={{}} />);
    fireEvent.click(screen.getByText('Radiant'));
    expect(baseProps.handleDivineFuryDamageType).toHaveBeenCalledWith('Radiant');
  });

  it('Divine Fury: clicking Skip button calls handleDivineFurySkip', () => {
    render(<CharActionModals {...baseProps} divineFuryChoice={{}} />);
    fireEvent.click(screen.getByText('Skip'));
    expect(baseProps.handleDivineFurySkip).toHaveBeenCalled();
  });

  it('Divine Fury: clicking overlay calls handleDivineFurySkip', () => {
    render(<CharActionModals {...baseProps} divineFuryChoice={{}} />);
    fireEvent.click(screen.getByText(/Divine Fury/).closest('.sp-overlay'));
    expect(baseProps.handleDivineFurySkip).toHaveBeenCalled();
  });

  it('Damage Type: clicking type calls generic handler when no ref', () => {
    render(<CharActionModals
      {...baseProps}
      damageTypeChoice={{ title: 'Pick', types: ['Fire', 'Ice'] }}
    />);
    fireEvent.click(screen.getByText('Fire'));
    expect(baseProps.handleGenericDamageTypeChoice).toHaveBeenCalledWith('Fire');
  });

  it('Damage Type: clicking type calls enhanced unarmed handler when _attackRider', () => {
    baseProps.pendingDamageRef.current = { _attackRider: true };
    render(<CharActionModals
      {...baseProps}
      damageTypeChoice={{ title: 'Pick', types: ['Fire', 'Ice'] }}
    />);
    fireEvent.click(screen.getByText('Fire'));
    expect(baseProps.handleEnhancedUnarmedChoice).toHaveBeenCalledWith('Fire');
  });

  it('Damage Type: clicking type calls modifier handler when _damageTypeModifier', () => {
    baseProps.pendingDamageRef.current = { _damageTypeModifier: true };
    render(<CharActionModals
      {...baseProps}
      damageTypeChoice={{ title: 'Pick', types: ['Fire', 'Ice'] }}
    />);
    fireEvent.click(screen.getByText('Fire'));
    expect(baseProps.handleDamageTypeModifierChoice).toHaveBeenCalledWith('Fire');
  });

  it('Damage Type: clicking skip calls generic skip handler when no ref', () => {
    render(<CharActionModals
      {...baseProps}
      damageTypeChoice={{ title: 'Pick', types: ['Fire'] }}
    />);
    fireEvent.click(screen.getByText('Skip'));
    expect(baseProps.handleGenericDamageTypeSkip).toHaveBeenCalled();
  });

  it('Damage Type: clicking skip calls enhanced unarmed skip handler when _attackRider', () => {
    baseProps.pendingDamageRef.current = { _attackRider: true };
    render(<CharActionModals
      {...baseProps}
      damageTypeChoice={{ title: 'Pick', types: ['Fire'] }}
    />);
    fireEvent.click(screen.getByText('Skip'));
    expect(baseProps.handleEnhancedUnarmedSkip).toHaveBeenCalled();
  });

  it('Damage Type: clicking skip calls modifier skip handler when _damageTypeModifier', () => {
    baseProps.pendingDamageRef.current = { _damageTypeModifier: true };
    render(<CharActionModals
      {...baseProps}
      damageTypeChoice={{ title: 'Pick', types: ['Fire'] }}
    />);
    fireEvent.click(screen.getByText('Skip'));
    expect(baseProps.handleDamageTypeModifierSkip).toHaveBeenCalled();
  });

  it('Damage Type: overlay click calls generic skip handler when no ref', () => {
    render(<CharActionModals
      {...baseProps}
      damageTypeChoice={{ title: 'Pick', types: ['Fire'] }}
    />);
    fireEvent.click(screen.getByText('Pick').closest('.sp-overlay'));
    expect(baseProps.handleGenericDamageTypeSkip).toHaveBeenCalled();
  });

  it('Damage Type: overlay click calls enhanced unarmed skip handler when _attackRider', () => {
    baseProps.pendingDamageRef.current = { _attackRider: true };
    render(<CharActionModals
      {...baseProps}
      damageTypeChoice={{ title: 'Pick', types: ['Fire'] }}
    />);
    fireEvent.click(screen.getByText('Pick').closest('.sp-overlay'));
    expect(baseProps.handleEnhancedUnarmedSkip).toHaveBeenCalled();
  });

  it('Damage Type: overlay click calls modifier skip handler when _damageTypeModifier', () => {
    baseProps.pendingDamageRef.current = { _damageTypeModifier: true };
    render(<CharActionModals
      {...baseProps}
      damageTypeChoice={{ title: 'Pick', types: ['Fire'] }}
    />);
    fireEvent.click(screen.getByText('Pick').closest('.sp-overlay'));
    expect(baseProps.handleDamageTypeModifierSkip).toHaveBeenCalled();
  });

  it('Feature Choice: clicking an option calls handleFeatureChoiceConfirm', () => {
    render(<CharActionModals
      {...baseProps}
      featureChoice={{
        action: { name: 'Pick', description: 'Pick one' },
        options: ['Alpha', 'Beta'],
      }}
    />);
    fireEvent.click(screen.getByText('Alpha'));
    expect(baseProps.handleFeatureChoiceConfirm).toHaveBeenCalledWith('Alpha');
  });

  it('Feature Choice: clicking Cancel calls handleFeatureChoiceSkip', () => {
    render(<CharActionModals
      {...baseProps}
      featureChoice={{
        action: { name: 'Pick', description: 'Pick one' },
        options: ['Alpha'],
      }}
    />);
    fireEvent.click(screen.getByText('Cancel'));
    expect(baseProps.handleFeatureChoiceSkip).toHaveBeenCalled();
  });

  it('Feature Choice: clicking overlay calls handleFeatureChoiceSkip', () => {
    render(<CharActionModals
      {...baseProps}
      featureChoice={{
        action: { name: 'Pick', description: 'Pick one' },
        options: ['Alpha'],
      }}
    />);
    fireEvent.click(screen.getByText('Pick').closest('.sp-overlay'));
    expect(baseProps.handleFeatureChoiceSkip).toHaveBeenCalled();
  });

  it('Feature Choice: renders option object with name property', () => {
    render(<CharActionModals
      {...baseProps}
      featureChoice={{
        action: { name: 'Pick', description: 'Pick one' },
        options: [{ name: 'Custom Option' }],
      }}
    />);
    expect(screen.getByText('Custom Option')).toBeInTheDocument();
  });

  it('ElfisLineageModal: close button calls onClose', () => {
    render(<CharActionModals {...baseProps} elfishLineageModal={{}} />);
    fireEvent.click(screen.getByTestId('elfis-close'));
    expect(baseProps.setElfisLineageModal).toHaveBeenCalledWith(null);
  });

  it('GnomishLineageModal: close button calls onClose', () => {
    render(<CharActionModals {...baseProps} gnomishLineageModal={{}} />);
    fireEvent.click(screen.getByTestId('gnomish-close'));
    expect(baseProps.setGnomishLineageModal).toHaveBeenCalledWith(null);
  });

  it('FiendishLegacyModal: close button calls onClose', () => {
    render(<CharActionModals {...baseProps} fiendishLegacyModal={{}} />);
    fireEvent.click(screen.getByTestId('fiendish-close'));
    expect(baseProps.setFiendishLegacyModal).toHaveBeenCalledWith(null);
  });

  it('GiantAncestryModal: close button calls onClose', () => {
    render(<CharActionModals {...baseProps} giantAncestryModal={{}} />);
    fireEvent.click(screen.getByTestId('giant-close'));
    expect(baseProps.setGiantAncestryModal).toHaveBeenCalledWith(null);
  });

  it('BreathWeaponShapeModal: close button calls onClose', () => {
    render(<CharActionModals {...baseProps} breathWeaponShapeModal={{}} />);
    fireEvent.click(screen.getByTestId('breath-close'));
    expect(baseProps.setBreathWeaponShapeModal).toHaveBeenCalledWith(null);
  });

  it('HypnoticPatternShakeModal: close button calls onClose', () => {
    render(<CharActionModals {...baseProps} hypnoticPatternShakeModal={{}} />);
    fireEvent.click(screen.getByTestId('hypnotic-close'));
    expect(baseProps.setHypnoticPatternShakeModal).toHaveBeenCalledWith(null);
  });

  it('ConstellationSelectionModal starry: confirm calls handleConstellationSelect, close dismisses', () => {
    render(<CharActionModals
      {...baseProps}
      starryFormConstellationModal={{ payload: { action: {}, playerStats: {}, campaignName: 'test' } }}
    />);
    fireEvent.click(screen.getByTestId('const-confirm'));
    expect(baseProps.handleConstellationSelect).toHaveBeenCalledWith(
      { action: {}, playerStats: {}, campaignName: 'test' },
      'test-option',
    );
    fireEvent.click(screen.getByTestId('const-close'));
    expect(baseProps.setStarryFormConstellationModal).toHaveBeenCalledWith(null);
  });

  it('ConstellationSelectionModal twinkling: confirm calls handleConstellationSelect, close dismisses', () => {
    render(<CharActionModals
      {...baseProps}
      twinklingConstellationModal={{ payload: { action: {}, playerStats: {}, campaignName: 'test' } }}
    />);
    fireEvent.click(screen.getByTestId('const-confirm'));
    expect(baseProps.handleConstellationSelect).toHaveBeenCalledWith(
      { action: {}, playerStats: {}, campaignName: 'test' },
      'test-option',
    );
    fireEvent.click(screen.getByTestId('const-close'));
    expect(baseProps.setTwinklingConstellationModal).toHaveBeenCalledWith(null);
  });

  it('HealingPoolModal: close button dismisses modal', () => {
    render(<CharActionModals {...baseProps} healingPoolModal={{ name: 'Test Pool' }} />);
    fireEvent.click(screen.getByTestId('healing-close'));
    expect(baseProps.setHealingPoolModal).toHaveBeenCalledWith(null);
  });

  it('AttackRiderModal: close dispatches event and dismisses modal', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(<CharActionModals {...baseProps} attackRiderModal={{}} />);
    fireEvent.click(screen.getByTestId('attack-rider-close'));
    expect(baseProps.setAttackRiderModal).toHaveBeenCalledWith(null);
    expect(dispatchSpy).toHaveBeenCalledWith(expect.any(CustomEvent));
    dispatchSpy.mockRestore();
  });

  it('OpenHandTechniqueModal: close dispatches events and dismisses modal', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(<CharActionModals {...baseProps} openHandTechniqueModal={{}} />);
    fireEvent.click(screen.getByTestId('open-hand-close'));
    expect(baseProps.setOpenHandTechniqueModal).toHaveBeenCalledWith(null);
    expect(dispatchSpy).toHaveBeenCalledTimes(2);
    dispatchSpy.mockRestore();
  });

  it('CombatStanceModal: close dispatches buffs-updated and dismisses modal', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(<CharActionModals {...baseProps} combatStanceModal={{}} />);
    fireEvent.click(screen.getByTestId('combat-stance-close'));
    expect(baseProps.setCombatStanceModal).toHaveBeenCalledWith(null);
    expect(dispatchSpy).toHaveBeenCalledWith(new CustomEvent('buffs-updated'));
    dispatchSpy.mockRestore();
  });

  it('RevelationInFleshModal: close dispatches buffs-updated and dismisses modal', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(<CharActionModals {...baseProps} revelationInFleshModal={{}} />);
    fireEvent.click(screen.getByTestId('revelation-close'));
    expect(baseProps.setRevelationInFleshModal).toHaveBeenCalledWith(null);
    expect(dispatchSpy).toHaveBeenCalledWith(new CustomEvent('buffs-updated'));
    dispatchSpy.mockRestore();
  });

  it('TeleportModal: close dispatches buffs-updated and dismisses modal', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(<CharActionModals {...baseProps} teleportModal={{}} />);
    fireEvent.click(screen.getByTestId('teleport-close'));
    expect(baseProps.setTeleportModal).toHaveBeenCalledWith(null);
    expect(dispatchSpy).toHaveBeenCalledWith(new CustomEvent('buffs-updated'));
    dispatchSpy.mockRestore();
  });

  it('HealingIllusionModal: close dispatches buffs-updated and dismisses modal', () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(<CharActionModals {...baseProps} healingIllusionModal={{}} />);
    fireEvent.click(screen.getByTestId('healing-illusion-close'));
    expect(baseProps.setHealingIllusionModal).toHaveBeenCalledWith(null);
    expect(dispatchSpy).toHaveBeenCalledWith(new CustomEvent('buffs-updated'));
    dispatchSpy.mockRestore();
  });

  it('DivineInterventionModal: close clears both modal and action state', () => {
    render(<CharActionModals {...baseProps} divineInterventionModal={{}} />);
    fireEvent.click(screen.getByTestId('divine-intervention-close'));
    expect(baseProps.setDivineInterventionModal).toHaveBeenCalledWith(null);
    expect(baseProps.setDivineInterventionAction).toHaveBeenCalledWith(null);
  });

  it('ElderChampionRestoreModal: confirm calls handler and dismisses, close dismisses', () => {
    render(<CharActionModals
      {...baseProps}
      elderChampionRestoreModal={{ payload: { action: {}, playerStats: {}, campaignName: 'test' } }}
    />);
    fireEvent.click(screen.getByTestId('elder-confirm'));
    expect(baseProps.handleElderChampionRestore).toHaveBeenCalledWith(
      { action: {}, playerStats: {}, campaignName: 'test' },
    );
    expect(baseProps.setElderChampionRestoreModal).toHaveBeenCalledWith(null);
    fireEvent.click(screen.getByTestId('elder-close'));
    expect(baseProps.setElderChampionRestoreModal).toHaveBeenCalledWith(null);
  });

  it('BastionOfLawModal: confirm button exists on first instance, close works on both', () => {
    render(<CharActionModals
      {...baseProps}
      bastionOfLawModal={{ featureName: 'Test', auto: { type: 'bastion_of_law' } }}
    />);
    const confirmBtns = screen.getAllByTestId('bastion-confirm');
    expect(confirmBtns).toHaveLength(1);
    fireEvent.click(confirmBtns[0]);
    const closeBtns = screen.getAllByTestId('bastion-close');
    expect(closeBtns).toHaveLength(2);
    fireEvent.click(closeBtns[0]);
    expect(baseProps.setBastionOfLawModal).toHaveBeenCalledWith(null);
  });
});
