// Tests for helper modals in CharActionModals (target selection, confirm modals).
//
// Scope:
// - HealingIllusionModal → SecondaryTargetModal rendering + skip
// - InvokeDuplicityModal → CreatureSelectionModal rendering + skip
// - FlurryOfBlowsModal → FlurryOfBlowsTargetPopup rendering + skip
// - StarryChaliceHealModal → SecondaryTargetModal rendering + skip
// - ElementalEpitomeModal → rendering
// - DestructiveStrideModal → rendering
// - DestructiveStrideTargetModal → SecondaryTargetModal rendering
// - RecklessAttackModal → mode prop forwarding (default only)
//
// Handler integration (runtime state, logging, SSE) is covered in:
// - CharActionModals.handlers2.test.jsx (invokeDuplicity + healingIllusion full flow)
// - CharActionModals.secondary-targets.test.jsx (secondary target confirmations)
// - CharActionModals.mass-healing-skips.test.jsx (mass healing skips)
//
// Cleaned: removed 6 redundant tests — confirm/close/skip handlers already
// tested in target-selection-handlers.test.jsx, handler-callbacks.test.jsx,
// inline-modals.test.jsx, and rendering.test.jsx. Remaining 11 tests verify
// unique rendering + target-list-building behavior not covered elsewhere.

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
  getRuntimeValue: vi.fn((_character, _key, _campaign) => null),
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
  default: function TestModal({ onSkip }) {
    return <div data-testid="vitality-of-the-tree-modal"><button data-testid="vitality-skip" onClick={onSkip}>Skip</button></div>;
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

describe('CharActionModals — helper modals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Healing Illusion modal', () => {
    it('renders SecondaryTargetModal with correct title, description, and HP indicator', () => {
      const playerStats = { name: 'Test Character', level: 5 };
      render(<CharActionModals
        {...createBaseProps({})}
        playerStats={playerStats}
        modalState={{ healingIllusionModal: { action: {}, playerStats } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByTestId('secondary-title').textContent).toBe('Healing Illusion');
      expect(screen.getByTestId('secondary-desc').textContent).toContain('Choose a creature within 5 feet');
      expect(screen.getByTestId('secondary-show-hp')).toBeTruthy();
    });

    it('builds target list from characters and combatSummary creatures', async () => {
      const playerStats = { name: 'Caster', level: 3 };
      const characters = [{ name: 'Ally1', type: 'humanoid', size: 'M', currentHp: 30, maxHp: 50 }];
      render(<CharActionModals
        {...createBaseProps({})}
        playerStats={playerStats}
        characters={characters}
        modalState={{ healingIllusionModal: { action: {}, playerStats } }}
        setModalState={vi.fn()}
      />);
      await waitFor(() => {
        expect(screen.getByTestId('secondary-target-Ally1')).toBeInTheDocument();
        expect(screen.getByTestId('secondary-target-Goblin')).toBeInTheDocument();
      });
    });

    it('dismisses modal on skip', async () => {
      const setModalState = vi.fn();
      const playerStats = { name: 'Caster', level: 3 };
      render(<CharActionModals
        {...createBaseProps({})}
        playerStats={playerStats}
        modalState={{ healingIllusionModal: { action: {}, playerStats } }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId('secondary-skip'));
      await waitFor(() => {
        expect(setModalState).toHaveBeenCalledWith({ healingIllusionModal: null });
      });
    });
  });

  describe('Invoke Duplicity modal', () => {
    it('renders CreatureSelectionModal with correct title and note', () => {
      const playerStats = { name: 'Test Character' };
      render(<CharActionModals
        {...createBaseProps({})}
        playerStats={playerStats}
        modalState={{ invokeDuplicityModal: { action: {}, playerStats } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByTestId('creature-title').textContent).toBe('Improved Duplicity — Choose Allies');
      expect(screen.getByTestId('creature-note').textContent).toContain('Select all allies');
    });

    it('builds target list with deduplication by name', async () => {
      const playerStats = { name: 'Caster' };
      const characters = [{ name: 'Ally1', type: 'humanoid', size: 'M', currentHp: 30, maxHp: 50 }];
      render(<CharActionModals
        {...createBaseProps({})}
        playerStats={playerStats}
        characters={characters}
        modalState={{ invokeDuplicityModal: { action: {}, playerStats } }}
        setModalState={vi.fn()}
      />);
      await waitFor(() => {
        expect(screen.getByTestId('creature-target-Ally1')).toBeInTheDocument();
        expect(screen.getByTestId('creature-target-Goblin')).toBeInTheDocument();
      });
    });
  });

  describe('Flurry of Blows modal', () => {
    it('renders FlurryOfBlowsTargetPopup', () => {
      render(<CharActionModals
        {...createBaseProps({ handleFlurryOfBlowsConfirm: vi.fn() })}
        modalState={{ flurryOfBlowsModal: { numAttacks: 3, creatureTargets: ['Goblin'], currentTargetName: 'Goblin' } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByTestId('flurry-of-blows-popup')).toBeInTheDocument();
    });

    it('dismisses modal on skip', () => {
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleFlurryOfBlowsConfirm: vi.fn() })}
        modalState={{ flurryOfBlowsModal: { numAttacks: 3, creatureTargets: ['Goblin'], currentTargetName: 'Goblin' } }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId('flurry-skip'));
      expect(setModalState).toHaveBeenCalledWith({ flurryOfBlowsModal: null });
    });
  });

  describe('Starry Chalice Heal modal', () => {
    it('renders SecondaryTargetModal with Chalice title', () => {
      render(<CharActionModals
        {...createBaseProps({ handleStarryChaliceConfirm: vi.fn() })}
        modalState={{ starryChaliceHealModal: { targetNames: ['Ally1'], amount: 10 } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByTestId('secondary-title').textContent).toBe('Starry Form: Chalice');
    });

    it('dismisses modal on skip', () => {
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleStarryChaliceConfirm: vi.fn() })}
        modalState={{ starryChaliceHealModal: { targetNames: ['Ally1'], amount: 10 } }}
        setModalState={setModalState}
      />);
      fireEvent.click(screen.getByTestId('secondary-skip'));
      expect(setModalState).toHaveBeenCalledWith({ starryChaliceHealModal: null });
    });
  });

  describe('Elemental Epitome modal', () => {
    it('renders ElementalEpitomeModal with action and resistance props', () => {
      render(<CharActionModals
        {...createBaseProps({ handleEpitomeConfirm: vi.fn() })}
        modalState={{ epitomeModal: { action: {}, playerStats: {}, campaignName: 'test-campaign', currentResistance: 'cold' } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByTestId('elemental-epitome-modal')).toBeInTheDocument();
    });
  });

  describe('Destructive Stride modal', () => {
    it('renders DestructiveStrideModal with action and campaign props', () => {
      render(<CharActionModals
        {...createBaseProps({ handleDestructiveStrideConfirm: vi.fn() })}
        modalState={{ destructiveStrideModal: { action: {}, playerStats: {}, campaignName: 'test-campaign' } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByTestId('destructive-stride-modal')).toBeInTheDocument();
    });
  });

  describe('Destructive Stride Target modal', () => {
    it('renders SecondaryTargetModal with correct title and description', () => {
      render(<CharActionModals
        {...createBaseProps({ handleDestructiveStrideTargetConfirm: vi.fn(), handleDestructiveStrideTargetSkip: vi.fn() })}
        modalState={{ destructiveStrideTargetModal: { targets: [{ name: 'Goblin' }], action: {}, chosenType: 'fire', martialArtsDie: 4 } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByTestId('secondary-title').textContent).toBe('Destructive Stride — Choose Target');
      expect(screen.getByTestId('secondary-desc').textContent).toBe('Choose a creature only if the monk comes within 5 ft. of them while striding.');
    });
  });

  describe('Reckless Attack modal', () => {
    it('renders with mode=full by default', () => {
      render(<CharActionModals
        {...createBaseProps({ handleRecklessAttackConfirm: vi.fn(), handleRecklessAttackCancel: vi.fn(), handleBrutalStrikeConfirm: vi.fn(), handleBrutalStrikeCancel: vi.fn() })}
        modalState={{ recklessAttackModal: { attack: { name: 'Longsword' } } }}
        setModalState={vi.fn()}
      />);
      expect(screen.getByTestId('reckless-mode').textContent).toBe('full');
    });
  });
});
