// @improved-by-ai
// @cleaned-by-ai
// Tests for async confirm handlers with setPopupHtml in CharActionModals.jsx.
//
// Covers: successful payload paths for all async confirm handlers.
// Modal state clearing and null/undefined result paths are tested in
// CharActionModals.handler-callbacks.test.jsx. Modal rendering is tested in
// CharActionModals.rendering.test.jsx.
//
// @cleaned-by-ai: Removed 6 redundant null/undefined tests already covered in
// handler-callbacks.test.jsx. Consolidated AnimateDead/CreateUndead/SummonSpirit
// into a single parameterized describe block. Removed brittle "does not call
// setPopupHtml when result is undefined" tests that assert internal wiring
// rather than observable behavior.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
  default: function TestModal({ onClose, onConfirm }) {
    return (
      <div data-testid="open-hand-technique-modal">
        <button data-testid="open-hand-close" onClick={onClose}>Close</button>
        <button data-testid="open-hand-confirm" onClick={() => onConfirm('grappled')}>Grapple</button>
      </div>
    );
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
    if (key === '_Stalkers_Flurry_option') return 'attack';
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
  default: function TestModal({ onClose, onSelect }) {
    return (
      <div data-testid="divine-intervention-modal">
        <button data-testid="divine-intervention-close" onClick={onClose}>Close</button>
        {onSelect && <button data-testid="divine-intervention-cast" onClick={() => onSelect('cast')}>Cast</button>}
      </div>
    );
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
vi.mock('./modals/CelestialResilienceModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="celestial-resilience-modal">
        <button data-testid="celestial-resilience-skip" onClick={onSkip}>Skip</button>
        <button data-testid="celestial-resilience-confirm" onClick={() => onConfirm([])}>Confirm</button>
      </div>
    );
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
vi.mock('./modals/InspiringSmiteModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="inspiring-smite-modal">
        <button data-testid="inspiring-smite-skip" onClick={onSkip}>Skip</button>
        <button data-testid="inspiring-smite-confirm" onClick={() => onConfirm([])}>Confirm</button>
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
  applyResistanceChoice: vi.fn(),
}));
vi.mock('../../services/automation/handlers/combat/destructiveStrideHandler.js', () => ({
  handle: vi.fn(),
  applyDamageTypeChoice: vi.fn(),
  applyTargetChoice: vi.fn(),
  skipTargetChoice: vi.fn(),
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
// CLA-113: DestructiveStrideModal SELF-APPLIES applyDamageTypeChoice and passes
// the RESULT OBJECT to onConfirm — the mock mirrors that verified contract
// (previously it passed a raw type string, pinning the phantom shape that made
// the host-1 confirm handler double-apply and swallow the picker).
vi.mock('./modals/DestructiveStrideModal.jsx', () => ({
  default: function TestModal({ onClose, onConfirm }) {
    return (
      <div data-testid="destructive-stride-modal">
        <button data-testid="stride-close" onClick={onClose}>Close</button>
        <button data-testid="stride-confirm" onClick={() => onConfirm({ type: 'modal', modalName: 'destructiveStrideTarget', payload: { action: {}, chosenType: 'Fire', martialArtsDie: 12, targets: [] } })}>Confirm</button>
        <button data-testid="stride-confirm-popup" onClick={() => onConfirm({ type: 'popup', payload: { description: 'done' } })}>ConfirmPopup</button>
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
vi.mock('./modals/AnimateDeadModal.jsx', () => ({
  default: function TestModal({ onClose, onConfirm }) {
    return (
      <div data-testid="animate-dead-modal">
        <button data-testid="animate-dead-close" onClick={onClose}>Close</button>
        <button data-testid="animate-dead-confirm" onClick={() => onConfirm({ zombieCount: 2, skeletonCount: 1 })}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/CreateUndeadModal.jsx', () => ({
  default: function TestModal({ onClose, onConfirm }) {
    return (
      <div data-testid="create-undead-modal">
        <button data-testid="create-undead-close" onClick={onClose}>Close</button>
        <button data-testid="create-undead-confirm" onClick={() => onConfirm({ ghoulCount: 1 })}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/SummonSpiritModal.jsx', () => ({
  default: function TestModal({ onClose, onConfirm }) {
    return (
      <div data-testid="summon-spirit-modal">
        <button data-testid="summon-spirit-close" onClick={onClose}>Close</button>
        <button data-testid="summon-spirit-confirm" onClick={() => onConfirm('air')}>Confirm</button>
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

describe('CharActionModals — async confirm handlers with setPopupHtml', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Undead/Spirit summon modal async confirm handlers ──
  // Each follows the same pattern: modal onConfirm → handler → setPopupHtml(payload).
  // Modal state clearing and null/undefined paths are tested in handler-callbacks.test.jsx.

  describe('Undead/Spirit summon modal async confirm handlers', () => {
    const handlers = [
      {
        name: 'AnimateDead',
        modalKey: 'animateDeadModal',
        confirmTestId: 'animate-dead-confirm',
        handlerPath: '../../services/automation/handlers/spells/animateDeadHandler.js',
        mockResult: { payload: '<b>Animate Dead</b><br/>Created 2 zombies' },
        modalPayload: { maxTargets: 3, action: {}, playerStats: {}, campaignName: 'test-campaign' },
      },
      {
        name: 'CreateUndead',
        modalKey: 'createUndeadModal',
        confirmTestId: 'create-undead-confirm',
        handlerPath: '../../services/automation/handlers/spells/createUndeadHandler.js',
        mockResult: { payload: '<b>Create Undead</b><br/>Created 1 ghoul' },
        modalPayload: { maxTargets: 3, action: {}, playerStats: {}, campaignName: 'test-campaign' },
      },
      {
        name: 'SummonSpirit',
        modalKey: 'summonSpiritModal',
        confirmTestId: 'summon-spirit-confirm',
        handlerPath: '../../services/automation/handlers/spells/summonSpiritHandler.js',
        mockResult: { payload: '<b>Summon Spirit</b><br/>Air spirit summoned' },
        modalPayload: { action: {}, playerStats: {}, campaignName: 'test-campaign' },
      },
    ];

    for (const { name, modalKey, confirmTestId, handlerPath, mockResult, modalPayload } of handlers) {
      it(`sets popupHtml when ${name} confirm handler returns payload`, async () => {
        const setPopupHtml = vi.fn();
        const handlerModule = await import(handlerPath);
        const confirmHandler = handlerModule[`confirm${name}`];
        confirmHandler.mockResolvedValue(mockResult);

        render(<CharActionModals
          {...createBaseProps({ setPopupHtml })}
          modalState={{ [modalKey]: modalPayload }}
          setModalState={vi.fn()}
        />);

        fireEvent.click(screen.getByTestId(confirmTestId));

        await waitFor(() => {
          expect(setPopupHtml).toHaveBeenCalledWith(mockResult.payload);
        });
      });
    }
  });

  // ── handleStarryChaliceConfirm ──

  describe('handleStarryChaliceConfirm', () => {
    it('sets popupHtml with full heal result when applyStarryChaliceHeal returns data', async () => {
      const setPopupHtml = vi.fn();
      const { applyStarryChaliceHeal } = await import('../../services/rules/spells/postCastHealService.js');
      const mockResult = { targetName: 'Ally1', actualHeal: 5 };
      applyStarryChaliceHeal.mockResolvedValue(mockResult);

      render(<CharActionModals
        {...createBaseProps({ setPopupHtml, campaignName: 'test-campaign' })}
        modalState={{ starryChaliceHealModal: { targetNames: ['Ally1'], amount: 10 } }}
        setModalState={vi.fn()}
      />);

      fireEvent.click(screen.getByTestId('secondary-confirm'));

      await waitFor(() => {
        expect(applyStarryChaliceHeal).toHaveBeenCalledWith('Ally1', 'test-campaign');
        expect(setPopupHtml).toHaveBeenCalledWith({
          type: 'heal',
          name: 'Starry Form: Chalice',
          formula: '10 HP',
          rolls: [],
          total: 10,
          targetName: 'Ally1',
          finalHeal: 5,
        });
      });
    });
  });

  // ── handleEpitomeConfirm ──

  describe('handleEpitomeConfirm', () => {
    it('sets popupHtml when applyResistanceChoice returns payload', async () => {
      const setPopupHtml = vi.fn();
      const { applyResistanceChoice } = await import('../../services/automation/handlers/combat/elementalEpitomeHandler.js');
      applyResistanceChoice.mockResolvedValue({ payload: 'Resistance applied' });

      render(<CharActionModals
        {...createBaseProps({ setPopupHtml })}
        modalState={{ epitomeModal: { action: {}, playerStats: {}, campaignName: 'test-campaign', currentResistance: 'cold' } }}
        setModalState={vi.fn()}
      />);

      fireEvent.click(screen.getByTestId('epitome-confirm'));

      await waitFor(() => {
        expect(applyResistanceChoice).toHaveBeenCalled();
        expect(setPopupHtml).toHaveBeenCalledWith('Resistance applied');
      });
    });

    it('does not call setPopupHtml when applyResistanceChoice returns result without payload', async () => {
      const setPopupHtml = vi.fn();
      const { applyResistanceChoice } = await import('../../services/automation/handlers/combat/elementalEpitomeHandler.js');
      applyResistanceChoice.mockResolvedValue({ success: true });

      render(<CharActionModals
        {...createBaseProps({ setPopupHtml })}
        modalState={{ epitomeModal: { action: {}, playerStats: {}, campaignName: 'test-campaign', currentResistance: 'cold' } }}
        setModalState={vi.fn()}
      />);

      fireEvent.click(screen.getByTestId('epitome-confirm'));

      await waitFor(() => {
        expect(applyResistanceChoice).toHaveBeenCalled();
        expect(setPopupHtml).not.toHaveBeenCalled();
      });
    });

  });

  // ── handleDestructiveStrideConfirm ──

  // CLA-113: the modal SELF-APPLIES applyDamageTypeChoice and passes the RESULT
  // OBJECT to onConfirm. The host must NOT re-call applyDamageTypeChoice
  // (double-apply with the result object as chosenType → null → picker never
  // mounted). It mounts result.payload straight onto the host slot.
  describe('handleDestructiveStrideConfirm (CLA-113 result-object contract)', () => {
    it('mounts the target picker from the self-applied result — no double applyDamageTypeChoice call', async () => {
      const setModalState = vi.fn();
      const { applyDamageTypeChoice } = await import('../../services/automation/handlers/combat/destructiveStrideHandler.js');

      render(<CharActionModals
        {...createBaseProps()}
        modalState={{ destructiveStrideModal: { action: {}, playerStats: {}, campaignName: 'test-campaign' } }}
        setModalState={setModalState}
      />);

      fireEvent.click(screen.getByTestId('stride-confirm'));

      await waitFor(() => {
        expect(setModalState).toHaveBeenCalledWith(expect.objectContaining({
          destructiveStrideTargetModal: expect.objectContaining({ chosenType: 'Fire', martialArtsDie: 12 }),
        }));
      });
      expect(applyDamageTypeChoice).not.toHaveBeenCalled();
    });

    it('sets popupHtml when the self-applied result is a popup', async () => {
      const setPopupHtml = vi.fn();

      render(<CharActionModals
        {...createBaseProps({ setPopupHtml })}
        modalState={{ destructiveStrideModal: { action: {}, playerStats: {}, campaignName: 'test-campaign' } }}
        setModalState={vi.fn()}
      />);

      fireEvent.click(screen.getByTestId('stride-confirm-popup'));

      await waitFor(() => {
        expect(setPopupHtml).toHaveBeenCalledWith({ description: 'done' });
      });
    });
  });

  // ── handleDestructiveStrideTargetConfirm ──

  describe('handleDestructiveStrideTargetConfirm', () => {
    it('sets popupHtml when applyTargetChoice returns payload', async () => {
      const setPopupHtml = vi.fn();
      const { applyTargetChoice } = await import('../../services/automation/handlers/combat/destructiveStrideHandler.js');
      applyTargetChoice.mockResolvedValue({ payload: 'Target damage applied' });

      render(<CharActionModals
        {...createBaseProps({ setPopupHtml })}
        modalState={{ destructiveStrideTargetModal: { targets: [{ name: 'Goblin' }], action: {}, chosenType: 'fire', martialArtsDie: 4 } }}
        setModalState={vi.fn()}
      />);

      fireEvent.click(screen.getByTestId('secondary-confirm'));

      await waitFor(() => {
        expect(applyTargetChoice).toHaveBeenCalled();
        expect(setPopupHtml).toHaveBeenCalledWith('Target damage applied');
      });
    });
  });

  // ── handleDestructiveStrideTargetSkip ──

  describe('handleDestructiveStrideTargetSkip', () => {
    it('sets popupHtml when skipTargetChoice returns payload', async () => {
      const setPopupHtml = vi.fn();
      const { skipTargetChoice } = await import('../../services/automation/handlers/combat/destructiveStrideHandler.js');
      skipTargetChoice.mockResolvedValue({ payload: 'Skipped' });

      render(<CharActionModals
        {...createBaseProps({ setPopupHtml })}
        modalState={{ destructiveStrideTargetModal: { targets: [{ name: 'Goblin' }], action: {}, chosenType: 'fire', martialArtsDie: 4 } }}
        setModalState={vi.fn()}
      />);

      fireEvent.click(screen.getByTestId('secondary-skip'));

      await waitFor(() => {
        expect(skipTargetChoice).toHaveBeenCalled();
        expect(setPopupHtml).toHaveBeenCalledWith('Skipped');
      });
    });
  });
});
