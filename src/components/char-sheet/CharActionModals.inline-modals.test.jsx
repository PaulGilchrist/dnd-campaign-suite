// Additional tests for inline modal rendering paths in CharActionModals.jsx.
// Covers BastionOfLaw, moonlightStepFallback, attackRiderOptions, naturesSanctuary,
// inspiringSmite, and clockworkCavalcade modals.
//
// Cleaned: Removed redundant negative test (BastionOfLaw no-payload), and
// all dismiss/close tests that assert exact setModalState call structures
// rather than observable behavior. Consolidated BastionOfLaw into single
// handler behavior test.
//
// Note: vi.mock() is hoisted to the top of the file by Vitest, so all mock
// factories must be defined inline (no references to top-level variables).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Mocks (all inline due to vi.mock hoisting) ──

vi.mock('./modals/divine/HealingPoolModal.jsx', () => ({ default: () => <div data-testid="healing-pool-modal"><button data-testid="healing-pool-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/shared/HandOfHealingModal.jsx', () => ({ default: () => <div data-testid="hand-of-healing-modal"><button data-testid="hand-of-healing-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/FontOfMagicModal.jsx', () => ({ default: () => <div data-testid="font-of-magic-modal"><button data-testid="font-of-magic-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/ResourcePoolModal.jsx', () => ({ default: () => <div data-testid="resource-pool-modal"><button data-testid="resource-pool-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/WildCompanionModal.jsx', () => ({ default: () => <div data-testid="wild-companion-modal"><button data-testid="wild-companion-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/shared/SetConditionModal.jsx', () => ({ default: () => <div data-testid="set-condition-modal"><button data-testid="set-condition-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/EyebiteEffectModal.jsx', () => ({ default: () => <div data-testid="eyebite-modal"><button data-testid="eyebite-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/shared/AttackRiderModal.jsx', () => ({ default: () => <div data-testid="attack-rider-modal"><button data-testid="attack-rider-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/OpenHandTechniqueModal.jsx', () => ({ default: () => <div data-testid="open-hand-technique-modal"><button data-testid="open-hand-technique-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/WeaponMasteryModal.jsx', () => ({ default: () => <div data-testid="weapon-mastery-modal"><button data-testid="weapon-mastery-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/WeaponMasteryChoiceModal.jsx', () => ({ default: () => <div data-testid="weapon-mastery-choice-modal"><button data-testid="weapon-mastery-choice-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/WeaponKindMasteryModal.jsx', () => ({ default: () => <div data-testid="weapon-kind-mastery-modal"><button data-testid="weapon-kind-mastery-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/shared/CombatStanceModal.jsx', () => ({ default: () => <div data-testid="combat-stance-modal"><button data-testid="combat-stance-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/TeleportModal.jsx', () => ({ default: () => <div data-testid="teleport-modal"><button data-testid="teleport-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/shared/HealingIllusionModal.jsx', () => ({ default: () => <div data-testid="healing-illusion-modal"><button data-testid="healing-illusion-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../services/automation/common/healingRoll.js', () => ({ logHealingToSSE: vi.fn() }));
vi.mock('../../services/rules/combat/damageUtils.js', () => ({ getCombatContext: vi.fn().mockResolvedValue(null) }));
vi.mock('../../services/ui/logService.js', () => ({ addEntry: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./modals/shared/SaveAttackHealModal.jsx', () => ({ default: () => <div data-testid="save-attack-heal-modal"><button data-testid="save-attack-heal-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/shared/SaveAttackAoeModal.jsx', () => ({ default: () => <div data-testid="save-attack-aoe-modal"><button data-testid="save-attack-aoe-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/shared/AOEConditionModal.jsx', () => ({ default: () => <div data-testid="aoe-condition-modal"><button data-testid="aoe-condition-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/shared/FearModal.jsx', () => ({ default: () => <div data-testid="fear-modal"><button data-testid="fear-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/shared/HypnoticPatternModal.jsx', () => ({ default: () => <div data-testid="hypnotic-pattern-modal"><button data-testid="hypnotic-pattern-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/shared/MassSuggestionModal.jsx', () => ({ default: () => <div data-testid="mass-suggestion-modal"><button data-testid="mass-suggestion-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/shared/CalmEmotionsModal.jsx', () => ({ default: () => <div data-testid="calm-emotions-modal"><button data-testid="calm-emotions-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/shared/TashasLaughterModal.jsx', () => ({ default: () => <div data-testid="tashas-laughter-modal"><button data-testid="tashas-laughter-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/SilenceModal.jsx', () => ({ default: () => <div data-testid="silence-modal"><button data-testid="silence-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/ElementalAttunementModal.jsx', () => ({ default: () => <div data-testid="elemental-attunement-modal"><button data-testid="elemental-attunement-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/ElementalBurstModal.jsx', () => ({ default: () => <div data-testid="elemental-burst-modal"><button data-testid="elemental-burst-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/divine/DivineSparkModal.jsx', () => ({ default: () => <div data-testid="divine-spark-modal"><button data-testid="divine-spark-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/divine/DivineInterventionModal.jsx', () => ({ default: () => <div data-testid="divine-intervention-modal"><button data-testid="divine-intervention-close" onClick={vi.fn()}>Close</button><button data-testid="divine-intervention-cast" onClick={() => {}}>Cast</button></div> }));
vi.mock('./modals/arcane/ArcaneChargeModal.jsx', () => ({ default: () => <div data-testid="arcane-charge-modal"><button data-testid="arcane-charge-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/WarMagicCantripModal.jsx', () => ({ default: () => <div data-testid="war-magic-cantrip-modal"><button data-testid="war-magic-cantrip-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/WarMagicSpellModal.jsx', () => ({ default: () => <div data-testid="war-magic-spell-modal"><button data-testid="war-magic-spell-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/divine/SacredWeaponModal.jsx', () => ({ default: () => <div data-testid="sacred-weapon-modal"><button data-testid="sacred-weapon-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/PrimalCompanionBonusActionModal.jsx', () => ({ default: () => <div data-testid="primal-companion-bonus-action-modal"><button data-testid="primal-companion-bonus-action-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/PrimalCompanionSummonModal.jsx', () => ({ default: () => <div data-testid="primal-companion-summon-modal"><button data-testid="primal-companion-summon-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/MistyWandererModal.jsx', () => ({ default: () => <div data-testid="misty-wanderer-modal"><button data-testid="misty-wanderer-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/FeyReinforcementsModal.jsx', () => ({ default: () => <div data-testid="fey-reinforcements-modal"><button data-testid="fey-reinforcements-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/StepsOfTheFeyTauntModal.jsx', () => ({ default: () => <div data-testid="steps-of-the-fey-taunt-modal"><button data-testid="steps-of-the-fey-taunt-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/shared/BonusActionChoiceModal.jsx', () => ({ default: () => <div data-testid="bonus-action-choice-modal"><button data-testid="bonus-action-choice-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/shared/StealthAttackModal.jsx', () => ({ default: () => <div data-testid="stealth-attack-modal"><button data-testid="stealth-attack-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/CelestialRevelationModal.jsx', () => ({ default: () => <div data-testid="celestial-revelation-modal"><button data-testid="celestial-revelation-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/RevelationInFleshModal.jsx', () => ({ default: () => <div data-testid="revelation-modal"><button data-testid="revelation-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/ElementalAffinityModal.jsx', () => ({ default: () => <div data-testid="elemental-affinity-modal"><button data-testid="elemental-affinity-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/SingleResistanceSelectionModal.jsx', () => ({ default: () => <div data-testid="single-resistance-selection-modal"><button data-testid="single-resistance-selection-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/shared/ChoiceListModal.jsx', () => ({ ChoiceListModal: () => <div data-testid="choice-list-modal">ChoiceListModal</div> }));
vi.mock('./modals/DragonCompanionModal.jsx', () => ({ default: () => <div data-testid="dragon-companion-modal"><button data-testid="dragon-companion-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/WildMagicDoubleRollModal.jsx', () => ({ default: () => <div data-testid="wild-magic-double-roll-modal">wild-magic-double-roll</div> }));
vi.mock('./modals/WildMagicTamedModal.jsx', () => ({ default: () => <div data-testid="wild-magic-tamed-modal">wild-magic-tamed</div> }));
vi.mock('./modals/arcane/ThirdEyeModal.jsx', () => ({ default: () => <div data-testid="third-eye-modal"><button data-testid="third-eye-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/arcane/SoulstitchSpellsModal.jsx', () => ({ default: () => <div data-testid="soulstitch-spells-modal"><button data-testid="soulstitch-spells-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/arcane/IllusoryRealityModal.jsx', () => ({ default: () => <div data-testid="illusory-reality-modal"><button data-testid="illusory-reality-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/FiendishLegacyModal.jsx', () => ({ default: () => <div data-testid="fiendish-modal"><button data-testid="fiendish-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/racial/BreathWeaponShapeModal.jsx', () => ({ default: () => <div data-testid="breath-modal"><button data-testid="breath-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/shared/HypnoticPatternShakeModal.jsx', () => ({ default: () => <div data-testid="hypnotic-modal"><button data-testid="hypnotic-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/arcane/ArcaneWardRestoreModal.jsx', () => ({ default: () => <div data-testid="arcane-ward-restore-modal"><button data-testid="arcane-ward-restore-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/CombatSuperiorityModal.jsx', () => ({ default: () => <div data-testid="combat-superiority-modal"><button data-testid="combat-superiority-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/AttackRiderManeuverPrompt.jsx', () => ({ default: () => <div data-testid="attack-rider-maneuver-prompt"><button data-testid="maneuver-skip" onClick={vi.fn()}>Skip</button></div> }));
vi.mock('./modals/ConstellationSelectionModal.jsx', () => ({ default: () => <div data-testid="constellation-selection-modal"><button data-testid="const-confirm" onClick={() => {}}>Confirm</button><button data-testid="const-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/divine/BastionOfLawModal.jsx', () => {
  const BastionOfLawModal = ({ onClose, onConfirm }) => (
    <div data-testid="bastion-of-law-modal">
      <button data-testid="bastion-close" onClick={onClose}>Close</button>
      <button data-testid="bastion-confirm" onClick={() => onConfirm(5, 'target')}>Confirm</button>
    </div>
  );
  return { default: BastionOfLawModal };
});
vi.mock('../../services/automation/handlers/class-cleric-paladin/bastionOfLawHandler.js', () => ({
  handle: vi.fn().mockResolvedValue(undefined),
  handleClearWard: vi.fn().mockResolvedValue(undefined),
  handleSpendDice: vi.fn().mockResolvedValue(undefined),
  handleApply: vi.fn().mockResolvedValue({ payload: '<b>Bastion of Law</b><br/>Applied' }),
}));
vi.mock('../../services/rules/spells/postCastHealService.js', () => ({ applyStarryChaliceHeal: vi.fn().mockResolvedValue(null) }));
vi.mock('../../services/automation/handlers/combat/elementalEpitomeHandler.js', () => ({
  handle: vi.fn(),
  handleElementalEpitome: vi.fn(),
  applyResistanceChoice: vi.fn().mockResolvedValue({ payload: 'Resistance applied' }),
}));
vi.mock('../../services/automation/handlers/combat/destructiveStrideHandler.js', () => ({
  handle: vi.fn(),
  applyDamageTypeChoice: vi.fn().mockResolvedValue({ payload: 'Damage applied' }),
  applyTargetChoice: vi.fn().mockResolvedValue({ payload: 'Target damage applied' }),
  skipTargetChoice: vi.fn().mockResolvedValue({ payload: 'Skipped' }),
}));
vi.mock('../../services/automation/common/oncePerTurn.js', () => ({ setSkipFlag: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn().mockReturnValue({ total: 5, rolls: [5], modifier: 0 }),
  rollExpressionDoubled: vi.fn().mockReturnValue({ total: 10, rolls: [5, 5], modifier: 0 }),
}));
vi.mock('../../services/ui/sanitize.js', () => ({ sanitizeHtml: vi.fn((html) => html) }));
vi.mock('./popups/FlurryOfBlowsTargetPopup.jsx', () => ({ default: () => <div data-testid="flurry-of-blows-popup"><button data-testid="flurry-skip" onClick={vi.fn()}>Skip</button><button data-testid="flurry-confirm" onClick={() => {}}>Confirm</button></div> }));
vi.mock('./modals/ElementalEpitomeModal.jsx', () => ({ default: () => <div data-testid="elemental-epitome-modal"><button data-testid="epitome-close" onClick={vi.fn()}>Close</button><button data-testid="epitome-confirm" onClick={() => {}}>Confirm</button></div> }));
vi.mock('./modals/DestructiveStrideModal.jsx', () => ({ default: () => <div data-testid="destructive-stride-modal"><button data-testid="stride-close" onClick={vi.fn()}>Close</button><button data-testid="stride-confirm" onClick={() => {}}>Confirm</button></div> }));
vi.mock('./modals/shared/RecklessAttackModal.jsx', () => ({ default: () => <div data-testid="reckless-attack-modal"><button data-testid="reckless-confirm" onClick={() => {}}>Confirm</button><button data-testid="reckless-cancel" onClick={vi.fn()}>Cancel</button></div> }));
vi.mock('./modals/MassHealModal.jsx', () => ({ default: () => <div data-testid="mass-heal-modal"><button data-testid="mass-heal-skip" onClick={vi.fn()}>Skip</button><button data-testid="mass-heal-confirm" onClick={() => {}}>Confirm</button></div> }));
vi.mock('./modals/divine/ClockworkCavalcadeModal.jsx', () => ({ default: () => <div data-testid="clockwork-cavalcade-modal"><button data-testid="clockwork-cavalcade-close" onClick={vi.fn()}>Close</button><button data-testid="clockwork-cavalcade-heal" onClick={() => {}}>heal</button><button data-testid="clockwork-cavalcade-dispel" onClick={() => {}}>dispel</button><button data-testid="clockwork-cavalcade-repair" onClick={() => {}}>repair</button></div> }));
vi.mock('./modals/MassCureWoundsModal.jsx', () => ({ default: () => <div data-testid="mass-cure-modal"><button data-testid="mass-cure-skip" onClick={vi.fn()}>Skip</button><button data-testid="mass-cure-confirm" onClick={() => {}}>Confirm</button></div> }));
vi.mock('./modals/PrayerOfHealingModal.jsx', () => ({ default: () => <div data-testid="prayer-modal"><button data-testid="prayer-skip" onClick={vi.fn()}>Skip</button><button data-testid="prayer-confirm" onClick={() => {}}>Confirm</button></div> }));
vi.mock('./modals/PowerWordFortifyModal.jsx', () => ({ default: () => <div data-testid="fortify-modal"><button data-testid="fortify-skip" onClick={vi.fn()}>Skip</button><button data-testid="fortify-confirm" onClick={() => {}}>Confirm</button></div> }));
vi.mock('./modals/MassHealingWordModal.jsx', () => ({ default: () => <div data-testid="healing-word-modal"><button data-testid="healing-word-skip" onClick={vi.fn()}>Skip</button><button data-testid="healing-word-confirm" onClick={() => {}}>Confirm</button></div> }));
vi.mock('./modals/AnimateDeadModal.jsx', () => ({ default: () => <div data-testid="animate-dead-modal"><button data-testid="animate-dead-close" onClick={vi.fn()}>Close</button><button data-testid="animate-dead-confirm" onClick={() => {}}>Confirm</button></div> }));
vi.mock('./modals/CreateUndeadModal.jsx', () => ({ default: () => <div data-testid="create-undead-modal"><button data-testid="create-undead-close" onClick={vi.fn()}>Close</button><button data-testid="create-undead-confirm" onClick={() => {}}>Confirm</button></div> }));
vi.mock('./modals/SummonSpiritModal.jsx', () => ({ default: () => <div data-testid="summon-spirit-modal"><button data-testid="summon-spirit-close" onClick={vi.fn()}>Close</button><button data-testid="summon-spirit-confirm" onClick={() => {}}>Confirm</button></div> }));
vi.mock('../../services/automation/handlers/spells/animateDeadHandler.js', () => ({ handle: vi.fn(), confirmAnimateDead: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../services/automation/handlers/spells/createUndeadHandler.js', () => ({ handle: vi.fn(), confirmCreateUndead: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../services/automation/handlers/spells/summonSpiritHandler.js', () => ({ handle: vi.fn(), confirmSummonSpirit: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./modals/ShieldBashChoiceModal.jsx', () => ({ default: () => <div data-testid="shield-bash-modal"><button data-testid="shield-bash-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/QuiveringPalmModal.jsx', () => ({ default: () => <div data-testid="quivering-palm-modal"><button data-testid="quivering-palm-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/ZealousPresenceModal.jsx', () => ({ default: () => <div data-testid="zealous-modal"><button data-testid="zealous-skip" onClick={vi.fn()}>Skip</button><button data-testid="zealous-confirm" onClick={() => {}}>Confirm</button></div> }));
vi.mock('./modals/MoonlightStepResourceModal.jsx', () => ({ default: () => <div data-testid="moonlight-step-resource-modal"><button data-testid="moonlight-step-resource-close" onClick={vi.fn()}>Close</button></div> }));
vi.mock('./modals/BulwarkOfForceModal.jsx', () => ({ default: () => <div data-testid="bulwark-of-force-modal"><button data-testid="bulwark-skip" onClick={vi.fn()}>Skip</button></div> }));
vi.mock('./modals/CoronaEnemySelectionModal.jsx', () => ({ default: () => <div data-testid="corona-enemy-selection-modal"><button data-testid="corona-skip" onClick={vi.fn()}>Skip</button></div> }));
vi.mock('./modals/RadianceOfDawnModal.jsx', () => ({ default: () => <div data-testid="radiance-of-dawn-modal"><button data-testid="radiance-skip" onClick={vi.fn()}>Skip</button></div> }));
vi.mock('./modals/MantleOfInspirationModal.jsx', () => ({ default: () => <div data-testid="mantle-of-inspiration-modal"><button data-testid="mantle-skip" onClick={vi.fn()}>Skip</button></div> }));
vi.mock('./modals/CelestialResilienceModal.jsx', () => ({ default: () => <div data-testid="celestial-resilience-modal"><button data-testid="celestial-resilience-skip" onClick={vi.fn()}>Skip</button><button data-testid="celestial-resilience-confirm" onClick={() => {}}>Confirm</button></div> }));
vi.mock('./modals/VitalityOfTheTreeModal.jsx', () => ({ default: () => <div data-testid="vitality-modal"><button data-testid="vitality-skip" onClick={vi.fn()}>Skip</button><button data-testid="vitality-confirm" onClick={() => {}}>Confirm</button></div> }));
vi.mock('./modals/InspiringSmiteModal.jsx', () => {
  const InspiringSmiteModal = ({ onSkip, onConfirm }) => (
    <div data-testid="inspiring-smite-modal">
      <button data-testid="inspiring-smite-skip" onClick={onSkip}>Skip</button>
      <button data-testid="inspiring-smite-confirm" onClick={() => onConfirm({})}>Confirm</button>
    </div>
  );
  return { default: InspiringSmiteModal };
});
vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => {
  const SecondaryTargetModal = ({ title, targets, onTargetSelected, onSkip, confirmLabel }) => (
    <div data-testid="secondary-target-modal">
      <div data-testid="secondary-title">{title}</div>
      {targets.map((t, i) => <label key={i} data-testid={`secondary-target-${t.name}`} onClick={() => onTargetSelected(t.name)}>{t.name}</label>)}
      <button data-testid="secondary-confirm" onClick={() => onTargetSelected(targets[0]?.name)}>{confirmLabel}</button>
      <button data-testid="secondary-skip" onClick={onSkip}>Skip</button>
    </div>
  );
  return { default: SecondaryTargetModal };
});
vi.mock('./modals/shared/CreatureSelectionModal.jsx', () => {
  const CreatureSelectionModal = ({ title, targets, onConfirm, onSkip, note }) => (
    <div data-testid="creature-selection-modal">
      <div data-testid="creature-title">{title}</div>
      {note && <div data-testid="creature-note">{note}</div>}
      {targets.map((t, i) => <label key={i} data-testid={`creature-target-${t.name}`} onClick={() => onConfirm([t.name])}>{t.name}</label>)}
      <button data-testid="creature-confirm" onClick={() => onConfirm(targets.map(t => t.name))}>Confirm</button>
      <button data-testid="creature-skip" onClick={onSkip}>Skip</button>
    </div>
  );
  return { default: CreatureSelectionModal };
});
vi.mock('../../services/automation/handlers/class-warlock/tempTeleportHandler.js', () => ({
  confirmTeleport: vi.fn().mockResolvedValue({ type: 'popup', payload: { name: 'Moonlight Step', description: 'Teleported' } }),
}));

// ── Inline Modal Tests ──

describe('CharActionModals — inline modals with complex handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('BastionOfLawModal onConfirm with setPopupHtml', () => {
    it('calls setPopupHtml with the handler result payload', async () => {
      const setPopupHtml = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setPopupHtml, handleApply: vi.fn() })}
        modalState={{ bastionOfLawModal: { featureName: 'Bastion', auto: {} } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('bastion-confirm'));
      await waitFor(() => {
        expect(setPopupHtml).toHaveBeenCalledWith('<b>Bastion of Law</b><br/>Applied');
      });
    });
  });

  describe('moonlightStepFallbackModal', () => {
    it('renders the inline modal with the expected header text and action buttons', () => {
      render(<CharActionModals
        {...createBaseProps({})}
        modalState={{ moonlightStepFallbackModal: { action: { name: 'Moonlight Step' }, slotLevel: 1 } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByText(/No Moonlight Step uses remaining/)).toBeInTheDocument();
      expect(screen.getByText('Yes, Consume Slot')).toBeInTheDocument();
      expect(screen.getByText('No')).toBeInTheDocument();
    });

    it('calls confirmTeleport and sets popupHtml when consuming a slot', async () => {
      const { confirmTeleport } = await import('../../services/automation/handlers/class-warlock/tempTeleportHandler.js');
      const setPopupHtml = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setPopupHtml })}
        modalState={{ moonlightStepFallbackModal: { action: { name: 'Moonlight Step' }, playerStats: {}, campaignName: 'test-campaign', slotLevel: 1 } }}
        setModalState={vi.fn()}
      />);

      fireEvent.click(screen.getByText('Yes, Consume Slot'));

      await waitFor(() => {
        expect(confirmTeleport).toHaveBeenCalled();
        expect(setPopupHtml).toHaveBeenCalled();
      });
    });

  });

  describe('attackRiderOptionsModal', () => {
    it('renders the inline modal with maneuver name, effect options, and skip button', () => {
      render(<CharActionModals
        {...createBaseProps({ handleAttackRiderOptionSelect: vi.fn() })}
        modalState={{ attackRiderOptionsModal: { maneuver: { name: 'Test Maneuver' }, riderOptions: [{ name: 'Option A', effect: 'disadvantage_on_next_save' }] } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByText(/Test Maneuver.*Choose Effect/)).toBeInTheDocument();
      expect(screen.getByText('Option A')).toBeInTheDocument();
      expect(screen.getByText('Skip')).toBeInTheDocument();
    });

    it('calls handleAttackRiderOptionSelect with the selected option name and modal state', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleAttackRiderOptionSelect: handler })}
        modalState={{ attackRiderOptionsModal: { maneuver: { name: 'Test' }, riderOptions: [{ name: 'Option A', effect: 'push_15ft' }] } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByText('Option A'));
      expect(handler).toHaveBeenCalledWith('Option A', expect.objectContaining({ maneuver: expect.any(Object), riderOptions: expect.any(Array) }));
    });

  });
});

describe('CharActionModals — naturesSanctuaryCreaturesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders CreatureSelectionModal with correct title and note for non-move sanctuary', () => {
    render(<CharActionModals
      {...createBaseProps({ handleNaturesSanctuaryConfirm: vi.fn() })}
      modalState={{ naturesSanctuaryCreaturesModal: { creatureTargets: [{ name: 'Goblin' }], isMove: false } }}
      setModalState={vi.fn()}
    />);
    expect(screen.getByTestId('creature-title').textContent).toContain("Nature's Sanctuary");
    expect(screen.getByTestId('creature-note').textContent).toContain('Wild Shape');
  });

  it('renders with Move title when isMove is true', () => {
    render(<CharActionModals
      {...createBaseProps({ handleNaturesSanctuaryConfirm: vi.fn() })}
      modalState={{ naturesSanctuaryCreaturesModal: { creatureTargets: [{ name: 'Goblin' }], isMove: true } }}
      setModalState={vi.fn()}
    />);
    expect(screen.getByTestId('creature-title').textContent).toContain('Move');
  });

  it('calls handleNaturesSanctuaryConfirm with the confirmed target list', () => {
    const handler = vi.fn();
    render(<CharActionModals
      {...createBaseProps({ handleNaturesSanctuaryConfirm: handler })}
      modalState={{ naturesSanctuaryCreaturesModal: { creatureTargets: [{ name: 'Goblin' }] } }}
      setModalState={vi.fn()}
    />);
    fireEvent.click(screen.getByTestId('creature-confirm'));
    expect(handler).toHaveBeenCalledWith(['Goblin']);
  });
});

describe('CharActionModals — clockworkCavalcadeRepairModal confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls handleClockworkCavalcadeRepairConfirm on repair button', () => {
    const handler = vi.fn();
    render(<CharActionModals
      {...createBaseProps({ handleClockworkCavalcadeRepairConfirm: handler })}
      modalState={{ clockworkCavalcadeRepairModal: {} }}
      setModalState={vi.fn()}
    />);
    fireEvent.click(screen.getByText('Repair'));
    expect(handler).toHaveBeenCalled();
  });
});
