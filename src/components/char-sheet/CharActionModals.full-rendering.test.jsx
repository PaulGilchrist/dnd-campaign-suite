// Comprehensive rendering tests for modals and inline overlays not covered
// in CharActionModals.rendering.test.jsx or the other dedicated test files.
//
// This file tests ONLY behaviors that are unique to it. Modal rendering
// for individual modals is covered in rendering.test.jsx; handler callbacks
// are covered in handlers.test.jsx, inline-modals.test.jsx, and related files.
//
// Note: vi.mock() is hoisted to the top of the file by Vitest, so all mock
// factories must be defined inline (no references to top-level variables).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Mocks ──

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
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));
vi.mock('../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./modals/shared/SaveAttackHealModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="save-attack-heal-modal">SaveAttackHealModal</div>; },
}));
vi.mock('./modals/shared/SaveAttackAoeModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="save-attack-aoe-modal">SaveAttackAoeModal</div>; },
}));
vi.mock('./modals/shared/AOEConditionModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="aoe-condition-modal">AOEConditionModal</div>; },
}));
vi.mock('./modals/shared/FearModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="fear-modal">FearModal</div>; },
}));
vi.mock('./modals/shared/HypnoticPatternModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="hypnotic-pattern-modal">HypnoticPatternModal</div>; },
}));
vi.mock('./modals/shared/MassSuggestionModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="mass-suggestion-modal">MassSuggestionModal</div>; },
}));
vi.mock('./modals/shared/CalmEmotionsModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="calm-emotions-modal">CalmEmotionsModal</div>; },
}));
vi.mock('./modals/shared/TashasLaughterModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="tashas-laughter-modal">TashasLaughterModal</div>; },
}));
vi.mock('./modals/SilenceModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="silence-modal">SilenceModal</div>; },
}));
vi.mock('./modals/ElementalAttunementModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="elemental-attunement-modal">ElementalAttunementModal</div>; },
}));
vi.mock('./modals/ElementalBurstModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="elemental-burst-modal">ElementalBurstModal</div>; },
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
vi.mock('./modals/PrimalCompanionBonusActionModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="primal-companion-bonus-action-modal">PrimalCompanionBonusActionModal</div>; },
}));
vi.mock('./modals/PrimalCompanionSummonModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="primal-companion-summon-modal">PrimalCompanionSummonModal</div>; },
}));
vi.mock('./modals/MistyWandererModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="misty-wanderer-modal">MistyWandererModal</div>; },
}));
vi.mock('./modals/FeyReinforcementsModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="fey-reinforcements-modal">FeyReinforcementsModal</div>; },
}));
vi.mock('./modals/StepsOfTheFeyTauntModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="steps-of-the-fey-taunt-modal">StepsOfTheFeyTauntModal</div>; },
}));
vi.mock('./modals/shared/BonusActionChoiceModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="bonus-action-choice-modal">BonusActionChoiceModal</div>; },
}));
vi.mock('./modals/shared/StealthAttackModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="stealth-attack-modal">StealthAttackModal</div>; },
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
vi.mock('./modals/SingleResistanceSelectionModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="single-resistance-selection-modal">SingleResistanceSelectionModal</div>; },
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
vi.mock('./modals/arcane/ArcaneWardRestoreModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="arcane-ward-restore-modal">ArcaneWardRestoreModal</div>; },
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
        {onConfirm && <button data-testid="bastion-confirm" onClick={() => onConfirm(5, 'target')}>Confirm</button>}
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
vi.mock('./modals/MantleOfInspirationModal.jsx', () => ({
  default: function TestModal({ onSkip }) {
    return (
      <div data-testid="mantle-of-inspiration-modal">
        <button data-testid="mantle-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));
vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: function TestModal({ title }) {
    return <div data-testid="secondary-target-modal"><div data-testid="secondary-title">{title}</div></div>;
  },
}));
vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function TestModal({ title }) {
    return <div data-testid="creature-selection-modal"><div data-testid="creature-title">{title}</div></div>;
  },
}));
vi.mock('./popups/FlurryOfBlowsTargetPopup.jsx', () => ({
  default: function TestModal() { return <div data-testid="flurry-of-blows-popup">FlurryOfBlowsTargetPopup</div>; },
}));
vi.mock('./modals/ShieldBashChoiceModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="shield-bash-modal">ShieldBashChoiceModal</div>; },
}));
vi.mock('./modals/QuiveringPalmModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="quivering-palm-modal">QuiveringPalmModal</div>; },
}));
vi.mock('./modals/ElementalEpitomeModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="elemental-epitome-modal">ElementalEpitomeModal</div>; },
}));
vi.mock('./modals/DestructiveStrideModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="destructive-stride-modal">DestructiveStrideModal</div>; },
}));
vi.mock('./modals/shared/RecklessAttackModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="reckless-attack-modal">RecklessAttackModal</div>; },
}));
vi.mock('./modals/MassHealModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="mass-heal-modal">MassHealModal</div>; },
}));
vi.mock('./modals/divine/ClockworkCavalcadeModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="clockwork-cavalcade-modal">ClockworkCavalcadeModal</div>; },
}));
vi.mock('./modals/MassCureWoundsModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="mass-cure-wounds-modal">MassCureWoundsModal</div>; },
}));
vi.mock('./modals/PrayerOfHealingModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="prayer-of-healing-modal">PrayerOfHealingModal</div>; },
}));
vi.mock('./modals/PowerWordFortifyModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="power-word-fortify-modal">PowerWordFortifyModal</div>; },
}));
vi.mock('./modals/MassHealingWordModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="mass-healing-word-modal">MassHealingWordModal</div>; },
}));
vi.mock('./modals/AnimateDeadModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="animate-dead-modal">AnimateDeadModal</div>; },
}));
vi.mock('./modals/CreateUndeadModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="create-undead-modal">CreateUndeadModal</div>; },
}));
vi.mock('./modals/SummonSpiritModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="summon-spirit-modal">SummonSpiritModal</div>; },
}));
vi.mock('./modals/VitalityOfTheTreeModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="vitality-of-the-tree-modal">VitalityOfTheTreeModal</div>; },
}));
vi.mock('./modals/InspiringSmiteModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="inspiring-smite-modal">InspiringSmiteModal</div>; },
}));
vi.mock('./modals/ZealousPresenceModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="zealous-presence-modal">ZealousPresenceModal</div>; },
}));
vi.mock('./modals/CelestialResilienceModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="celestial-resilience-modal">CelestialResilienceModal</div>; },
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
vi.mock('./modals/BlindnessDeafnessModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="blindness-deafness-modal">BlindnessDeafnessModal</div>; },
}));
vi.mock('../../services/automation/handlers/class-cleric-paladin/bastionOfLawHandler.js', () => ({
  handle: vi.fn().mockResolvedValue(undefined),
  handleSpendDice: vi.fn().mockResolvedValue(undefined),
  handleClearWard: vi.fn().mockResolvedValue(undefined),
  handleApply: vi.fn().mockResolvedValue(undefined),
}));

// ── Tests ──

describe('CharActionModals — additional modal rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Inline overlays (div-based, not mocked component) ──

  describe('inline overlays', () => {
    it('renders clockworkCavalcadeRepairModal inline with hammer icon and action buttons', () => {
      render(<CharActionModals
        {...createBaseProps()}
        modalState={{ clockworkCavalcadeRepairModal: {} }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByText('Clockwork Cavalcade: Repair')).toBeInTheDocument();
      expect(screen.getByText('Repair')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  // ── Special rendering scenarios with custom titles/descriptions ──

  describe('special rendering scenarios', () => {
    it('renders openHandFromFlurry with target data from currentIndex', () => {
      const targets = [
        { action: { name: 'Open Hand' }, playerStats: { name: 'Monk' }, campaignName: 'test', targetName: 'Goblin' },
      ];
      render(<CharActionModals
        {...createBaseProps()}
        modalState={{ openHandFromFlurry: { targets, currentIndex: 0, saveDc: 15 } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByTestId('open-hand-technique-modal')).toBeInTheDocument();
    });

    it('renders oceanicGiftTargetModal with doubleEmanation title showing Wild Shape cost', () => {
      render(<CharActionModals
        {...createBaseProps()}
        modalState={{ oceanicGiftTargetModal: { creatureTargets: [], doubleEmanation: true } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByText(/Self \+ Ally, 2 Wild Shape/)).toBeInTheDocument();
    });

    it('renders oceanicGiftTargetModal without doubleEmanation showing simple ally prompt', () => {
      render(<CharActionModals
        {...createBaseProps()}
        modalState={{ oceanicGiftTargetModal: { creatureTargets: [], doubleEmanation: false } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByText(/Choose Ally/)).toBeInTheDocument();
      expect(screen.queryByText(/2 Wild Shape/)).not.toBeInTheDocument();
    });

    it('renders clockworkCavalcadeDispelModal with creature selection title', () => {
      render(<CharActionModals
        {...createBaseProps()}
        modalState={{ clockworkCavalcadeDispelModal: { creatureTargets: [{ name: 'Goblin' }] } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByText('Clockwork Cavalcade: Dispel')).toBeInTheDocument();
    });
  });
});
