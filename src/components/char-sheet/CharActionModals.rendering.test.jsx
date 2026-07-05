// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

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

// ── Tests ──

describe('CharActionModals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty fragment when no modal props are set', () => {
    const { container } = render(<CharActionModals {...createBaseProps()} />);
    expect(container).toBeEmptyDOMElement();
  });

  // ── Modal rendering ──
  // Consolidated from 40+ near-identical per-modal tests.  Each original test
  // followed the same pattern: set one truthy prop, assert a testid appears.
  // This parameterized test covers every modal prop → testid mapping in a
  // single loop, reducing duplication from ~350 lines to ~30 while preserving
  // unique coverage for each modal.
  //
  // The handler tests in CharActionModals.handlers.test.jsx verify close/dismiss
  // behavior. These rendering tests cover the minimal behavioral contract:
  // prop truthy → modal component renders.

  describe('modal rendering', () => {
    const modalCases = [
      // simple — basic conditional render with empty payload
      { name: 'healing-pool', prop: 'healingPoolModal', payload: { name: 'Test Pool' }, testid: 'healing-pool-modal' },
      { name: 'hand-of-healing', prop: 'handOfHealingModal', payload: {}, testid: 'hand-of-healing-modal' },
      { name: 'font-of-magic', prop: 'fontOfMagicModal', payload: {}, testid: 'font-of-magic-modal' },
      { name: 'resource-pool', prop: 'resourcePoolModal', payload: {}, testid: 'resource-pool-modal' },
      { name: 'moonlight-step-resource', prop: 'moonlightStepResourceModal', payload: { automation: {} }, testid: 'moonlight-step-resource-modal' },
      { name: 'wild-companion', prop: 'wildCompanionModal', payload: {}, testid: 'wild-companion-modal' },
      { name: 'set-condition', prop: 'setConditionModal', payload: {}, testid: 'set-condition-modal' },
      { name: 'eyebite-effect', prop: 'eyebiteEffectModal', payload: {}, testid: 'eyebite-effect-modal' },
      { name: 'attack-rider', prop: 'attackRiderModal', payload: {}, testid: 'attack-rider-modal' },
      { name: 'open-hand-technique', prop: 'openHandTechniqueModal', payload: {}, testid: 'open-hand-technique-modal' },
      { name: 'weapon-mastery', prop: 'weaponMasteryModal', payload: {}, testid: 'weapon-mastery-modal' },
      { name: 'combat-stance', prop: 'combatStanceModal', payload: {}, testid: 'combat-stance-modal' },
      { name: 'teleport', prop: 'teleportModal', payload: {}, testid: 'teleport-modal' },
      { name: 'healing-illusion', prop: 'healingIllusionModal', payload: {}, testid: 'healing-illusion-modal', inline: true },
      { name: 'save-attack-heal', prop: 'saveAttackHealModal', payload: {}, testid: 'save-attack-heal-modal' },
      { name: 'divine-spark', prop: 'divineSparkModal', payload: {}, testid: 'divine-spark-modal' },
      { name: 'divine-intervention', prop: 'divineInterventionModal', payload: {}, testid: 'divine-intervention-modal' },
      { name: 'arcane-charge', prop: 'arcaneChargeModal', payload: {}, testid: 'arcane-charge-modal' },
      { name: 'war-magic-cantrip', prop: 'warMagicCantripModal', payload: {}, testid: 'war-magic-cantrip-modal' },
      { name: 'war-magic-spell', prop: 'warMagicSpellModal', payload: {}, testid: 'war-magic-spell-modal' },
      { name: 'sacred-weapon', prop: 'sacredWeaponModal', payload: {}, testid: 'sacred-weapon-modal' },
      { name: 'elder-champion-restore', prop: 'elderChampionRestoreModal', payload: { payload: { action: {}, playerStats: {}, campaignName: 'test' } }, testid: 'elder-champion-restore-modal' },
      { name: 'primal-companion-bonus-action', prop: 'primalCompanionBonusActionModal', payload: {}, testid: 'primal-companion-bonus-action-modal' },
      { name: 'misty-wanderer', prop: 'mistyWandererModal', payload: {}, testid: 'misty-wanderer-modal' },
      { name: 'bonus-action-choice', prop: 'bonusActionChoiceModal', payload: {}, testid: 'bonus-action-choice-modal' },
      { name: 'revelation-in-flesh', prop: 'revelationInFleshModal', payload: {}, testid: 'revelation-in-flesh-modal' },
      { name: 'elemental-affinity', prop: 'elementalAffinityModal', payload: {}, testid: 'elemental-affinity-modal' },
      { name: 'fiendish-resilience', prop: 'fiendishResilienceModal', payload: {}, testid: 'fiendish-resilience-modal' },
      { name: 'dragon-companion', prop: 'dragonCompanionModal', payload: {}, testid: 'dragon-companion-modal' },
      { name: 'wild-magic-double-roll', prop: 'wildMagicDoubleRollModal', payload: {}, testid: 'wild-magic-double-roll-modal' },
      { name: 'wild-magic-tamed', prop: 'wildMagicTamedModal', payload: {}, testid: 'wild-magic-tamed-modal' },
      { name: 'third-eye', prop: 'thirdEyeModal', payload: { action: {}, playerStats: {}, campaignName: 'test' }, testid: 'third-eye-modal' },
      { name: 'soulstitch-spells', prop: 'soulstitchSpellsModal', payload: {}, testid: 'soulstitch-spells-modal' },
      { name: 'illusory-reality', prop: 'illusoryRealityModal', payload: {}, testid: 'illusory-reality-modal' },
      { name: 'celestial-revelation', prop: 'celestialRevelationModal', payload: {}, testid: 'celestial-revelation-modal' },
      { name: 'fiendish-legacy', prop: 'fiendishLegacyModal', payload: {}, testid: 'fiendish-legacy-modal' },
      { name: 'breath-weapon-shape', prop: 'breathWeaponShapeModal', payload: {}, testid: 'breath-weapon-shape-modal' },
      { name: 'hypnotic-pattern-shake', prop: 'hypnoticPatternShakeModal', payload: {}, testid: 'hypnotic-pattern-shake-modal' },
      { name: 'bulwark-of-force', prop: 'bulwarkOfForceModal', payload: { creatureTargets: [{ name: 'Goblin' }], maxTargets: 3 }, testid: 'bulwark-of-force-modal' },
      { name: 'corona-enemy-selection', prop: 'coronaEnemySelectionModal', payload: { creatureTargets: [{ name: 'Dragon' }] }, testid: 'corona-enemy-selection-modal' },
      { name: 'radiance-of-dawn', prop: 'radianceOfDawnModal', payload: { creatureTargets: [{ name: 'Goblin' }], saveType: 'Dex', saveDc: 15, damageExpression: '3d10', damageType: 'Radiant', rangeFeet: 15 }, testid: 'radiance-of-dawn-modal' },
    ];

    for (const { name, prop, payload, testid, inline } of modalCases) {
      it(`renders ${name} modal when ${prop} is truthy`, () => {
        render(<CharActionModals {...createBaseProps()} {...{ [prop]: payload }} />);
        if (inline) {
          expect(screen.getByText('Healing Illusion')).toBeInTheDocument();
        }
        else {
          expect(screen.getByTestId(testid)).toBeInTheDocument();
        }
      });
    }

    // inline — inline overlays (div-based, not a mocked component)
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
});
