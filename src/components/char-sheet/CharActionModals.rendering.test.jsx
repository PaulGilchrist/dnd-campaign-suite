// @improved-by-ai
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

  it('renders empty fragment when all modal flags are falsy', () => {
    const { container } = render(<CharActionModals {...createBaseProps()} healingPoolModal={null} handOfHealingModal={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  // ── Individual modal rendering ──

  describe('modal rendering', () => {
    const modalTests = [
      { name: 'healing-pool', prop: 'healingPoolModal', value: { name: 'Test Pool' } },
      { name: 'hand-of-healing', prop: 'handOfHealingModal', value: {} },
      { name: 'font-of-magic', prop: 'fontOfMagicModal', value: {} },
      { name: 'resource-pool', prop: 'resourcePoolModal', value: {} },
      { name: 'moonlight-step-resource', prop: 'moonlightStepResourceModal', value: { automation: {} } },
      { name: 'wild-companion', prop: 'wildCompanionModal', value: {} },
      { name: 'set-condition', prop: 'setConditionModal', value: {} },
      { name: 'eyebite-effect', prop: 'eyebiteEffectModal', value: {} },
      { name: 'attack-rider', prop: 'attackRiderModal', value: {} },
      { name: 'open-hand-technique', prop: 'openHandTechniqueModal', value: {} },
      { name: 'weapon-mastery', prop: 'weaponMasteryModal', value: {} },
      { name: 'combat-stance', prop: 'combatStanceModal', value: {} },
      { name: 'teleport', prop: 'teleportModal', value: {} },
      { name: 'healing-illusion', prop: 'healingIllusionModal', value: {} },
      { name: 'save-attack-heal', prop: 'saveAttackHealModal', value: {} },
      { name: 'divine-spark', prop: 'divineSparkModal', value: {} },
      { name: 'divine-intervention', prop: 'divineInterventionModal', value: {} },
      { name: 'arcane-charge', prop: 'arcaneChargeModal', value: {} },
      { name: 'war-magic-cantrip', prop: 'warMagicCantripModal', value: {} },
      { name: 'war-magic-spell', prop: 'warMagicSpellModal', value: {} },
      { name: 'sacred-weapon', prop: 'sacredWeaponModal', value: {} },
      { name: 'elder-champion-restore', prop: 'elderChampionRestoreModal', value: { payload: { action: {}, playerStats: {}, campaignName: 'test' } } },
      { name: 'primal-companion-bonus-action', prop: 'primalCompanionBonusActionModal', value: {} },
      { name: 'misty-wanderer', prop: 'mistyWandererModal', value: {} },
      { name: 'bonus-action-choice', prop: 'bonusActionChoiceModal', value: {} },
      { name: 'revelation-in-flesh', prop: 'revelationInFleshModal', value: {} },
      { name: 'bastion-of-law', prop: 'bastionOfLawModal', value: { featureName: 'Test', auto: {} } },
      { name: 'elemental-affinity', prop: 'elementalAffinityModal', value: {} },
      { name: 'fiendish-resilience', prop: 'fiendishResilienceModal', value: {} },
      { name: 'dragon-companion', prop: 'dragonCompanionModal', value: {} },
      { name: 'wild-magic-double-roll', prop: 'wildMagicDoubleRollModal', value: {} },
      { name: 'wild-magic-tamed', prop: 'wildMagicTamedModal', value: {} },
      { name: 'third-eye', prop: 'thirdEyeModal', value: { action: {}, playerStats: {}, campaignName: 'test' } },
      { name: 'soulstitch-spells', prop: 'soulstitchSpellsModal', value: {} },
      { name: 'illusory-reality', prop: 'illusoryRealityModal', value: {} },
      { name: 'celestial-revelation', prop: 'celestialRevelationModal', value: {} },
      { name: 'fiendish-legacy', prop: 'fiendishLegacyModal', value: {} },
      { name: 'breath-weapon-shape', prop: 'breathWeaponShapeModal', value: {} },
      { name: 'hypnotic-pattern-shake', prop: 'hypnoticPatternShakeModal', value: {} },
    ];

    for (const { name, prop, value } of modalTests) {
      const isBastion = name === 'bastion-of-law';
      const isHealingIllusion = name === 'healing-illusion';
      it(`renders ${name} modal when ${prop} is truthy`, () => {
        render(<CharActionModals {...createBaseProps()} {...{ [prop]: value }} />);
        if (isBastion) {
          expect(screen.getAllByTestId(`${name}-modal`)).toHaveLength(2);
        } else if (isHealingIllusion) {
          expect(screen.getByText('Healing Illusion')).toBeInTheDocument();
        } else {
          expect(screen.getByTestId(`${name}-modal`)).toBeInTheDocument();
        }
      });
    }
  });

  // ── BastionOfLawModal renders twice (feature + plain) ──

  describe('BastionOfLawModal duplicate rendering', () => {
    it('renders two BastionOfLawModal instances when bastionOfLawModal is set', () => {
      render(<CharActionModals {...createBaseProps()} bastionOfLawModal={{ featureName: 'Test', auto: { type: 'bastion_of_law' } }} />);
      const modals = screen.getAllByTestId('bastion-of-law-modal');
      expect(modals).toHaveLength(2);
    });

    it('renders only one confirm button (on the feature instance)', () => {
      render(<CharActionModals {...createBaseProps()} bastionOfLawModal={{ featureName: 'Test', auto: { type: 'bastion_of_law' } }} />);
      const confirmBtns = screen.getAllByTestId('bastion-confirm');
      expect(confirmBtns).toHaveLength(1);
    });

    it('renders confirm button when auto type is bastion_of_law', () => {
      render(<CharActionModals {...createBaseProps()} bastionOfLawModal={{ featureName: 'Test', auto: { type: 'bastion_of_law' } }} />);
      expect(screen.getByTestId('bastion-confirm')).toBeInTheDocument();
    });

    it('renders confirm button when auto is empty object', () => {
      render(<CharActionModals {...createBaseProps()} bastionOfLawModal={{ featureName: 'Test', auto: {} }} />);
      expect(screen.getByTestId('bastion-confirm')).toBeInTheDocument();
    });
  });

  // ── Multiple modals simultaneously ──

  describe('multiple modals', () => {
    it('renders two modals when both are set', () => {
      render(<CharActionModals
        {...createBaseProps()}
        healingPoolModal={{ name: 'Test Pool' }}
        divineFuryChoice={{}}
      />);
      expect(screen.getByTestId('healing-pool-modal')).toBeInTheDocument();
      expect(screen.getByText(/Divine Fury/)).toBeInTheDocument();
    });

    it('renders three modals when all three are set', () => {
      render(<CharActionModals
        {...createBaseProps()}
        healingPoolModal={{ name: 'Test Pool' }}
        divineFuryChoice={{}}
      />);
      expect(screen.getByTestId('healing-pool-modal')).toBeInTheDocument();
      expect(screen.getByText(/Divine Fury/)).toBeInTheDocument();
      expect(screen.getByText(/Divine Fury — Damage Type/)).toBeInTheDocument();
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
