// Tests for modal close handlers in CharActionModals.jsx that are NOT covered
// by modal-closes.test.jsx, modal-closes-2.test.jsx, or other test files.
//
// This file focuses on:
// - healingPoolModal close
// - saveAttackHealModal close
// - elementalAffinityModal close
// - fiendishResilienceModal close (uses SingleResistanceSelectionModal)
// - dragonCompanionModal close
// - wildMagicSurgeModal close (closes both modalState and spellModalState)
// - breathWeaponShapeModal close
// - vitalityOfTheTreeTarget onSkip
//
// openHandTechniqueModal test removed — redundant with modal-closes.test.jsx
// (same OpenHandTechniqueModal component used by openHandFromFlurry, same inline
//  onClose handler that sets modalState to null and dispatches
//  target-effects-updated + combat-summary-updated events).
//
// Already covered elsewhere:
// - blindnessDeafnessModal, celestialRevelationModal, fiendishLegacyModal,
//   hypnoticPatternShakeModal, clockworkCavalcadeModal → modal-closes.test.jsx
// - shieldBashModal, quiveringPalmModal, openHandFromFlurry, celestialResilienceModal → modal-closes-2.test.jsx

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  getRuntimeValue: vi.fn((character, key) => {
    if (key === 'activeBuffs') return [];
    if (key === 'currentHitPoints') return 50;
    if (key === 'hitPoints') return 100;
    if (key === '_cunningStrikeCostUsed') return 0;
    return null;
  }),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/automation/common/healingRoll.js', () => ({
  logHealingToSSE: vi.fn(),
}));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({
  getCombatContext: vi.fn().mockResolvedValue({ creatures: [{ name: 'Goblin', type: 'humanoid', currentHp: 10, maxHp: 30 }] }),
}));
vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./modals/shared/SaveAttackHealModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="save-attack-heal-modal"><button data-testid="save-attack-heal-modal-close" onClick={onClose}>Close</button></div>;
  },
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
vi.mock('./modals/MistyWandererModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="misty-wanderer-modal">MistyWandererModal</div>; },
}));
vi.mock('./modals/shared/BonusActionChoiceModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="bonus-action-choice-modal">BonusActionChoiceModal</div>; },
}));
vi.mock('./modals/CelestialRevelationModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="celestial-revelation-modal"><button data-testid="celestial-revelation-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/RevelationInFleshModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="revelation-in-flesh-modal"><button data-testid="revelation-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/ElementalAffinityModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="elemental-affinity-modal"><button data-testid="elemental-affinity-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/SingleResistanceSelectionModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="single-resistance-selection-modal"><button data-testid="single-resistance-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/shared/ChoiceListModal.jsx', () => ({
  ChoiceListModal: function TestModal() { return <div data-testid="choice-list-modal">ChoiceListModal</div>; },
}));
vi.mock('./modals/DragonCompanionModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="dragon-companion-modal"><button data-testid="dragon-companion-close" onClick={onClose}>Close</button></div>;
  },
}));
vi.mock('./modals/WildMagicDoubleRollModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="wild-magic-double-roll-modal">WildMagicDoubleRollModal</div>; },
}));
vi.mock('./modals/WildMagicTamedModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="wild-magic-tamed-modal">WildMagicTamedModal</div>; },
}));
vi.mock('./modals/WildMagicSurgeModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return <div data-testid="wild-magic-surge-modal"><button data-testid="wild-magic-close" onClick={onClose}>Close</button></div>;
  },
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
    return <div data-testid="radiance-of-dawn-modal"><button data-testid="radiance-skip" onClick={onSkip}>Skip</button></div>;
  },
}));
vi.mock('./modals/MantleOfInspirationModal.jsx', () => ({
  default: function TestModal({ onSkip }) {
    return <div data-testid="mantle-of-inspiration-modal"><button data-testid="mantle-skip" onClick={onSkip}>Skip</button></div>;
  },
}));
vi.mock('./modals/VitalityOfTheTreeModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="vitality-of-the-tree-modal">
        <button data-testid="vitality-skip" onClick={onSkip}>Skip</button>
        <button data-testid="vitality-confirm" onClick={() => onConfirm([])}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: function TestModal({ title, targets, onTargetSelected, onSkip, confirmLabel, description, showHp }) {
    return (
      <div data-testid="secondary-target-modal">
        <div data-testid="secondary-title">{title}</div>
        {description && <div data-testid="secondary-desc">{description}</div>}
        {showHp && <div data-testid="secondary-show-hp">true</div>}
        {targets.map((target, i) => (
          <label key={i} data-testid={`secondary-target-${target.name}`} onClick={() => onTargetSelected(target.name)}>
            {target.name}
          </label>
        ))}
        <button data-testid="secondary-confirm" onClick={() => onTargetSelected(targets[0]?.name)}>{confirmLabel}</button>
        <button data-testid="secondary-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
}));
vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => ({
  default: function TestModal({ title, targets, onConfirm, onSkip, confirmLabel, note }) {
    return (
      <div data-testid="creature-selection-modal">
        <div data-testid="creature-title">{title}</div>
        {note && <div data-testid="creature-note">{note}</div>}
        {targets.map((target, i) => (
          <label key={i} data-testid={`creature-target-${target.name}`} onClick={() => onConfirm([target.name])}>
            {target.name}
          </label>
        ))}
        <button data-testid="creature-confirm" onClick={() => onConfirm(targets.map(t => t.name))}>{confirmLabel}</button>
        <button data-testid="creature-skip" onClick={onSkip}>Skip</button>
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
vi.mock('../../services/rules/spells/postCastHealService.js', () => ({
  applyStarryChaliceHeal: vi.fn().mockResolvedValue(null),
}));
vi.mock('../../services/automation/handlers/combat/elementalEpitomeHandler.js', () => ({
  handle: vi.fn(),
  handleElementalEpitome: vi.fn(),
  applyResistanceChoice: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/automation/handlers/combat/destructiveStrideHandler.js', () => ({
  handle: vi.fn(),
  applyDamageTypeChoice: vi.fn().mockResolvedValue(undefined),
  applyTargetChoice: vi.fn().mockResolvedValue(undefined),
  skipTargetChoice: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({
  setSkipFlag: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn().mockReturnValue({ total: 5, rolls: [5], modifier: 0 }),
  rollExpressionDoubled: vi.fn().mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 }),
}));
vi.mock('../../services/ui/sanitize.js', () => ({
  sanitizeHtml: vi.fn((html) => html),
}));
vi.mock('./popups/FlurryOfBlowsTargetPopup.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="flurry-of-blows-popup">
        <button data-testid="flurry-skip" onClick={onSkip}>Skip</button>
        <button data-testid="flurry-confirm" onClick={() => onConfirm('target')}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/ElementalEpitomeModal.jsx', () => ({
  default: function TestModal({ onClose, onConfirm }) {
    return (
      <div data-testid="elemental-epitome-modal">
        <button data-testid="epitome-close" onClick={onClose}>Close</button>
        <button data-testid="epitome-confirm" onClick={() => onConfirm('fire')}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/DestructiveStrideModal.jsx', () => ({
  default: function TestModal({ onClose, onConfirm }) {
    return (
      <div data-testid="destructive-stride-modal">
        <button data-testid="stride-close" onClick={onClose}>Close</button>
        <button data-testid="stride-confirm" onClick={() => onConfirm('fire')}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/shared/RecklessAttackModal.jsx', () => ({
  default: function TestModal({ onConfirm, onCancel, mode }) {
    return (
      <div data-testid="reckless-attack-modal">
        <div data-testid="reckless-mode">{mode}</div>
        <button data-testid="reckless-confirm" onClick={() => onConfirm({}, 'test-choice')}>Confirm</button>
        <button data-testid="reckless-cancel" onClick={() => onCancel()}>Cancel</button>
      </div>
    );
  },
}));
vi.mock('./modals/MassHealModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="mass-heal-modal">
        <button data-testid="mass-heal-skip" onClick={onSkip}>Skip</button>
        <button data-testid="mass-heal-confirm" onClick={() => onConfirm([])}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/divine/ClockworkCavalcadeModal.jsx', () => ({
  default: function TestModal({ onChoose, onClose }) {
    return (
      <div data-testid="clockwork-cavalcade-modal">
        <button data-testid="cc-close" onClick={onClose}>Close</button>
        <button data-testid="cc-heal" onClick={() => onChoose('heal')}>Heal</button>
        <button data-testid="cc-dispel" onClick={() => onChoose('dispel')}>Dispel</button>
        <button data-testid="cc-repair" onClick={() => onChoose('repair')}>Repair</button>
      </div>
    );
  },
}));
vi.mock('./modals/MassCureWoundsModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="mass-cure-wounds-modal">
        <button data-testid="mass-cure-skip" onClick={onSkip}>Skip</button>
        <button data-testid="mass-cure-confirm" onClick={() => onConfirm([])}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/PrayerOfHealingModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="prayer-of-healing-modal">
        <button data-testid="prayer-skip" onClick={onSkip}>Skip</button>
        <button data-testid="prayer-confirm" onClick={() => onConfirm([])}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/PowerWordFortifyModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="power-word-fortify-modal">
        <button data-testid="fortify-skip" onClick={onSkip}>Skip</button>
        <button data-testid="fortify-confirm" onClick={() => onConfirm([])}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/MassHealingWordModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="mass-healing-word-modal">
        <button data-testid="healing-word-skip" onClick={onSkip}>Skip</button>
        <button data-testid="healing-word-confirm" onClick={() => onConfirm([])}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/AnimateDeadModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return (
      <div data-testid="animate-dead-modal">
        <button data-testid="animate-dead-close" onClick={onClose}>Close</button>
      </div>
    );
  },
}));
vi.mock('./modals/CreateUndeadModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return (
      <div data-testid="create-undead-modal">
        <button data-testid="create-undead-close" onClick={onClose}>Close</button>
      </div>
    );
  },
}));
vi.mock('./modals/SummonSpiritModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return (
      <div data-testid="summon-spirit-modal">
        <button data-testid="summon-spirit-close" onClick={onClose}>Close</button>
      </div>
    );
  },
}));
vi.mock('../../services/automation/handlers/spells/animateDeadHandler.js', () => ({
  handle: vi.fn(),
  confirmAnimateDead: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/automation/handlers/spells/createUndeadHandler.js', () => ({
  handle: vi.fn(),
  confirmCreateUndead: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/automation/handlers/spells/summonSpiritHandler.js', () => ({
  handle: vi.fn(),
  confirmSummonSpirit: vi.fn().mockResolvedValue(undefined),
}));

// ── Tests ──

describe('CharActionModals — modal close handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('healingPoolModal close handler', () => {
    it('sets modalState to null when close button is clicked', () => {
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({})}
        modalState={{ healingPoolModal: { name: 'Test Pool', pool: 10 } }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId('healing-close'));
      expect(setModalState).toHaveBeenCalledWith({ healingPoolModal: null });
    });
  });

  describe('saveAttackHealModal close handler', () => {
    it('sets modalState to null when close button is clicked', () => {
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({})}
        modalState={{ saveAttackHealModal: { action: {} } }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId('save-attack-heal-modal-close'));
      expect(setModalState).toHaveBeenCalledWith({ saveAttackHealModal: null });
    });
  });

  describe('elementalAffinityModal close handler', () => {
    it('sets modalState to null when close button is clicked', () => {
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({})}
        modalState={{ elementalAffinityModal: { action: {} } }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId('elemental-affinity-close'));
      expect(setModalState).toHaveBeenCalledWith({ elementalAffinityModal: null });
    });
  });

  describe('fiendishResilienceModal close handler', () => {
    it('sets modalState to null via SingleResistanceSelectionModal close', () => {
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({})}
        modalState={{ fiendishResilienceModal: { action: {} } }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId('single-resistance-close'));
      expect(setModalState).toHaveBeenCalledWith({ fiendishResilienceModal: null });
    });
  });

  describe('dragonCompanionModal close handler', () => {
    it('sets modalState to null when close button is clicked', () => {
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({})}
        modalState={{ dragonCompanionModal: { action: {} } }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId('dragon-companion-close'));
      expect(setModalState).toHaveBeenCalledWith({ dragonCompanionModal: null });
    });
  });

  describe('wildMagicSurgeModal close handler', () => {
    it('sets both modalState and spellModalState to null on close', () => {
      const setModalState = vi.fn();
      const setSpellModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({})}
        modalState={{ wildMagicSurgeModal: { surgeTable: [], mode: 'roll' } }}
        setModalState={setModalState}
        setSpellModalState={setSpellModalState}
      />);
      fireEvent.click(screen.getByTestId('wild-magic-close'));
      expect(setModalState).toHaveBeenCalledWith({ wildMagicSurgeModal: null });
      expect(setSpellModalState).toHaveBeenCalledWith({ wildMagicSurgeModal: null });
    });
  });

  describe('breathWeaponShapeModal close handler', () => {
    it('sets modalState to null when close button is clicked', () => {
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({})}
        modalState={{ breathWeaponShapeModal: { action: {} } }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId('breath-close'));
      expect(setModalState).toHaveBeenCalledWith({ breathWeaponShapeModal: null });
    });
  });

  describe('vitalityOfTheTreeTarget onSkip handler', () => {
    it('sets modalState to null when skip is clicked', () => {
      const setModalState = vi.fn();
      const handleConfirm = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleVitalityOfTheTreeConfirm: handleConfirm })}
        modalState={{ vitalityOfTheTreeTarget: { creatureTargets: [{ name: 'Ally1' }], tempHp: 5, maxTargets: 3 } }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId('vitality-skip'));
      expect(setModalState).toHaveBeenCalledWith({ vitalityOfTheTreeTarget: null });
    });
  });
});
