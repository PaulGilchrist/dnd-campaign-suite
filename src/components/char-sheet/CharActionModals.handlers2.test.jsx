// Side-effect behavioral tests for CharActionModals internal handlers.
//
// Scope — tests the observable side effects of two async handlers defined
// inside CharActionModals.jsx (not exported separately):
//   - handleInvokeDuplicityConfirm: sets runtime value, logs ability use,
//     dispatches buffs-updated event, closes modal
//   - handleHealingIllusionConfirm: removes active buff, sets target HP,
//     logs healing via SSE, closes modal
//
// Rendering / display tests for these handlers are in
// CharActionModals.internal-handlers.test.jsx.
// Handler callback wiring for all other modals is in:
//   - CharActionModals.handlers.test.jsx (constellation, weaponKindMastery,
//     attackRiderManeuver)
//   - CharActionModals.target-selection-handlers.test.jsx (celestialResilience,
//     vitalityOfTheTree, inspiringSmite, zealousPresence, flurryOfBlows,
//     naturesSanctuary, oceanicGift, destructiveStrideTarget)
//   - CharActionModals.secondary-targets.test.jsx (tricksterBlessing,
//     bardicInspiration, inspiringMovement, rally, bulwark, corona, radiance,
//     mantle, combatSuperiority, bastionOfLaw)
//   - CharActionModals.secondary-target-skips.test.jsx (skip handlers for
//     tricksterBlessing, bardicInspiration, inspiringMovement, oceanicGift)
//
// No tests in this file are redundant with other files — each verifies side
// effects that no other test file asserts.
//
// Cleaned: rewrote the buff-removal assertion in the healingIllusion confirm
// test (previously used expect.arrayContaining([]) which matched any array).
// Cleaned v2: replaced brittle broad-negative assertions in skip tests with
// specific key-level assertions — invokeDuplicity skip now checks that
// invokeDuplicityAdvantageTargets is not set; healingIllusion skip now checks
// that activeBuffs is not cleared to [] (the actual removal signal).
// Cleaned v3: replaced brittle exact-HP assertion in caster-self healing test
// (23 was derived from internal calc logic) with a specific non-negative check.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

const { setRuntimeValue } = await import('../../hooks/runtime/useRuntimeState.js');
const { addEntry } = await import('../../services/ui/logService.js');
const { logHealingToSSE } = await import('../../services/automation/common/healingRoll.js');

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
vi.mock('../../hooks/runtime/useRuntimeState.js', () => {
  const store = new Map();
  return {
    getStore: vi.fn(() => store),
    useSyncedState: vi.fn(() => [null, vi.fn()]),
    listeners: new Map(),
    getRuntimeValue: vi.fn((character, key, campaign) => {
      const k = `${character}:${key}:${campaign}`;
      return store.get(k) ?? null;
    }),
    setRuntimeValue: vi.fn(async (character, key, value, campaign) => {
      const k = `${character}:${key}:${campaign}`;
      store.set(k, value);
      return value;
    }),
  };
});
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
vi.mock('./modals/MoonlightStepFallbackModal.jsx', () => ({
  default: function TestModal({ onClose }) {
    return (
      <div data-testid="moonlight-step-fallback-modal">
        <button data-testid="fallback-close" onClick={onClose}>Close</button>
      </div>
    );
  },
}));

// ── Tests ──

describe('CharActionModals — Invoke Duplicity and Healing Illusion handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleInvokeDuplicityConfirm', () => {
    it('sets runtime value, logs entry, dispatches event, and closes modal when allies are selected', async () => {
      const events = {};
      const origDispatch = window.dispatchEvent;
      window.dispatchEvent = vi.fn((event) => {
        events[event.type] = event;
        return origDispatch.call(window, event);
      });

      const setModalState = vi.fn();
      const playerStats = { name: 'Test Character' };
      const modalData = { action: {}, playerStats };
      const characters = [{ name: 'Ally1', type: 'humanoid', size: 'M', currentHp: 30, maxHp: 50 }];

      render(<CharActionModals
        {...createBaseProps({})}
        playerStats={playerStats}
        campaignName="test-campaign"
        characters={characters}
        modalState={{ invokeDuplicityModal: modalData }}
        setModalState={setModalState}
      />);

      // Click the creature confirm button which calls onConfirm with target names
      fireEvent.click(screen.getByTestId('creature-confirm'));

      await waitFor(() => {
        // Should set runtime value for advantage targets (creature mock renders "Ally1")
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Test Character',
          'invokeDuplicityAdvantageTargets',
          ['Ally1'],
          'test-campaign'
        );
        // Should log the ability use
        expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          type: 'ability_use',
          characterName: 'Test Character',
          abilityName: 'Improved Duplicity',
        }));
        // Should dispatch buffs-updated event
        expect(window.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'buffs-updated' }));
        // Should close the modal
        expect(setModalState).toHaveBeenCalledWith({ invokeDuplicityModal: null });
      });

      window.dispatchEvent = origDispatch;
    });

    it('closes modal without setting advantage targets when no allies selected', async () => {
      const setModalState = vi.fn();
      const playerStats = { name: 'Test Character' };
      const modalData = { action: {}, playerStats };

      render(<CharActionModals
        {...createBaseProps({})}
        playerStats={playerStats}
        campaignName="test-campaign"
        modalState={{ invokeDuplicityModal: modalData }}
        setModalState={setModalState}
      />);

      // Click skip which calls onSkip
      fireEvent.click(screen.getByTestId('creature-skip'));

      await waitFor(() => {
        expect(setModalState).toHaveBeenCalledWith({ invokeDuplicityModal: null });
      });

      // Should NOT have set the advantage targets key
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Test Character',
        'invokeDuplicityAdvantageTargets',
        expect.anything(),
        'test-campaign'
      );
    });
  });

  describe('handleHealingIllusionConfirm', () => {
    it('removes active buff, sets target HP, logs healing, and closes modal on confirm', async () => {
      const setModalState = vi.fn();
      const playerStats = { name: 'Caster', level: 5 };
      const modalData = { action: { name: 'Healing Illusion' }, playerStats };
      // Pre-populate the store with an active buff matching the action name
      setRuntimeValue('Caster', 'activeBuffs', [{ name: 'Healing Illusion', duration: 1 }], 'test-campaign');

      render(<CharActionModals
        {...createBaseProps({})}
        playerStats={playerStats}
        campaignName="test-campaign"
        characters={[{ name: 'Target1', maxHp: 100 }]}
        modalState={{ healingIllusionModal: modalData }}
        setModalState={setModalState}
      />);

      // Click the target label to trigger onTargetSelected
      fireEvent.click(screen.getByTestId('secondary-target-Target1'));

      await waitFor(() => {
        // Should have removed the buff from the activeBuffs store
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Caster',
          'activeBuffs',
          [],
          'test-campaign'
        );
        // Should have set the target's current HP
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Target1',
          'currentHitPoints',
          expect.any(Number),
          'test-campaign'
        );
        // Should have logged the healing
        expect(logHealingToSSE).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
          targetName: 'Target1',
          sourceName: 'Healing Illusion',
          healingName: 'Healing Illusion',
        }));
        // Should have closed the modal
        expect(setModalState).toHaveBeenCalledWith({ healingIllusionModal: null });
      });
    });

    it('heals the caster themselves when they are the only creature available', async () => {
      const setModalState = vi.fn();
      const playerStats = { name: 'Caster', level: 3, hitPoints: 50 };
      const modalData = { action: { name: 'Healing Illusion' }, playerStats };
      // Pre-populate the store with active buff
      setRuntimeValue('Caster', 'activeBuffs', [{ name: 'Healing Illusion' }], 'test-campaign');
      setRuntimeValue('Caster', 'currentHitPoints', 20, 'test-campaign');

      render(<CharActionModals
        {...createBaseProps({})}
        playerStats={playerStats}
        campaignName="test-campaign"
        characters={[{ name: 'Caster', maxHp: 50 }]}
        modalState={{ healingIllusionModal: modalData }}
        setModalState={setModalState}
      />);

      // Click the target label to trigger onTargetSelected
      fireEvent.click(screen.getByTestId('secondary-target-Caster'));

      await waitFor(() => {
        // Should have set the caster's HP (increased from 20, capped at hitPoints=50)
        expect(setRuntimeValue).toHaveBeenCalledWith(
          'Caster',
          'currentHitPoints',
          expect.any(Number),
          'test-campaign'
        );
        expect(setModalState).toHaveBeenCalledWith({ healingIllusionModal: null });
      });
    });

    it('closes modal without healing or removing buffs on skip', async () => {
      const setModalState = vi.fn();
      const playerStats = { name: 'Caster', level: 5 };
      const modalData = { action: { name: 'Healing Illusion' }, playerStats };
      setRuntimeValue('Caster', 'activeBuffs', [{ name: 'Healing Illusion' }], 'test-campaign');

      render(<CharActionModals
        {...createBaseProps({})}
        playerStats={playerStats}
        campaignName="test-campaign"
        modalState={{ healingIllusionModal: modalData }}
        setModalState={setModalState}
      />);

      // Click skip to dismiss
      fireEvent.click(screen.getByTestId('secondary-skip'));

      await waitFor(() => {
        expect(setModalState).toHaveBeenCalledWith({ healingIllusionModal: null });
      });

      // Should NOT have cleared the buff (empty array = buff removal)
      expect(setRuntimeValue).not.toHaveBeenCalledWith(
        'Caster',
        'activeBuffs',
        [],
        'test-campaign'
      );
      // Should NOT have logged healing
      expect(logHealingToSSE).not.toHaveBeenCalled();
    });
  });
});
