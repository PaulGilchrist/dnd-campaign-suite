// Tests for secondary target modal handler callbacks in CharActionModals.
// Tests verify that the correct handler is invoked with the expected arguments
// when a user selects a target or skips the modal.
//
// Skip handlers are covered in CharActionModals.secondary-target-skips.test.jsx.
// Target selection confirmations for multi-select modals (Bulwark, Radiance, etc.)
// are covered in CharActionModals.target-selection-handlers.test.jsx.
//
// This file focuses on single-target secondary modal confirmations and the
// Bastion of Law handler routing.
//
// HandOfHealingModal, FontOfMagicModal, ResourcePoolModal, WildCompanionModal,
// SetConditionModal, EyebiteEffectModal, AttackRiderModal, OpenHandTechniqueModal,
// WeaponMasteryModal, WeaponMasteryChoiceModal, WeaponKindMasteryModal,
// CombatStanceModal, TeleportModal, HealingIllusionModal, CreatureSelectionModal).
//
// (target-click vs confirm-button, both invoke the same handler with the same
// argument via the same mock) into a single test.
//
// (Trickster Blessing, Bardic Inspiration) — these assert text content rather
// than behavioral coverage; rendering is covered in CharActionModals.rendering.test.jsx.
//
// (Rally, Bulwark, Corona, Radiance, Mantle) into a single parameterized test
// following the same pattern as CharActionModals.mass-healing-skips.test.jsx.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Mocks ──

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
  default: function TestModal({ onClose, onConfirm }) {
    return (
      <div data-testid="combat-superiority-modal">
        <button data-testid="combat-superiority-close" onClick={onClose}>Close</button>
        <button data-testid="combat-superiority-confirm" onClick={() => onConfirm('test-superiority')}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/AttackRiderManeuverPrompt.jsx', () => ({
  default: function TestModal({ onSkip, onUse }) {
    return (
      <div data-testid="attack-rider-maneuver-prompt">
        <button data-testid="maneuver-skip" onClick={onSkip}>Skip</button>
        <button data-testid="maneuver-use" onClick={() => onUse('test-maneuver')}>Use</button>
      </div>
    );
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
        {onConfirm && <button data-testid="bastion-apply" onClick={() => onConfirm(5, 'target')}>Apply</button>}
      </div>
    );
  },
}));
vi.mock('./modals/MoonlightStepResourceModal.jsx', () => ({
  default: function TestModal() { return <div data-testid="moonlight-step-resource-modal">MoonlightStepResourceModal</div>; },
}));
vi.mock('./modals/BulwarkOfForceModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="bulwark-of-force-modal">
        <button data-testid="bulwark-skip" onClick={onSkip}>Skip</button>
        <button data-testid="bulwark-confirm" onClick={() => onConfirm(['Goblin'])}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/CoronaEnemySelectionModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="corona-enemy-selection-modal">
        <button data-testid="corona-skip" onClick={onSkip}>Skip</button>
        <button data-testid="corona-confirm" onClick={() => onConfirm('Dragon')}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/RadianceOfDawnModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="radiance-of-dawn-modal">
        <button data-testid="radiance-skip" onClick={onSkip}>Skip</button>
        <button data-testid="radiance-confirm" onClick={() => onConfirm(['Goblin'])}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/MantleOfInspirationModal.jsx', () => ({
  default: function TestModal({ onSkip, onConfirm }) {
    return (
      <div data-testid="mantle-of-inspiration-modal">
        <button data-testid="mantle-skip" onClick={onSkip}>Skip</button>
        <button data-testid="mantle-confirm" onClick={() => onConfirm(['Ally1'])}>Confirm</button>
      </div>
    );
  },
}));
vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: function TestModal({ title, targets, onTargetSelected, onSkip, confirmLabel }) {
    return (
      <div data-testid="secondary-target-modal">
        <div data-testid="secondary-title">{title}</div>
        {targets.map((target, i) => {
          const key = target.value || target.name;
          return (
            <label key={i} data-testid={`secondary-target-${key}`} onClick={() => onTargetSelected(key)}>
              {target.label || target.name}
            </label>
          );
        })}
        {confirmLabel && (
          <button data-testid="secondary-confirm" onClick={() => onTargetSelected(targets[0]?.value || targets[0]?.name)}>
            {confirmLabel}
          </button>
        )}
        <button data-testid="secondary-skip" onClick={onSkip}>Skip</button>
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

describe('CharActionModals — SecondaryTargetModal handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Trickster Blessing modal', () => {
    it('calls handleTricksterBlessingConfirm with selected target name on target click', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleTricksterBlessingConfirm: handler })}
        modalState={{ tricksterBlessingModal: { creatureTargets: [{ name: 'Ally1' }, { name: 'Ally2' }] } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('secondary-target-Ally1'));
      expect(handler).toHaveBeenCalledWith('Ally1');
    });
  });

  describe('Bardic Inspiration Target modal', () => {
    it('calls handleBardicInspirationConfirm with selected target name', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleBardicInspirationConfirm: handler })}
        modalState={{ bardicInspirationTargetModal: { creatureTargets: [{ name: 'Ally1' }], dieSize: 8 } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('secondary-target-Ally1'));
      expect(handler).toHaveBeenCalledWith('Ally1');
    });
  });

  describe('Inspiring Movement Ally modal', () => {
    it('calls handleInspiringMovementConfirm with selected target name', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleInspiringMovementConfirm: handler })}
        modalState={{ inspiringMovementAllyModal: { creatureTargets: [{ name: 'Ally1' }, { name: 'Ally2' }] } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('secondary-target-Ally2'));
      expect(handler).toHaveBeenCalledWith('Ally2');
    });
  });

  describe('Rally modal', () => {
    it('calls handleRallyChoiceConfirm with selected ally and modal data', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleRallyChoiceConfirm: handler })}
        modalState={{ rallyChoiceModal: { allyOptions: [{ name: 'Ally1' }], description: 'Test' } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('secondary-target-Ally1'));
      expect(handler).toHaveBeenCalledWith('Ally1', expect.objectContaining({ allyOptions: [{ name: 'Ally1' }], description: 'Test' }));
    });
  });

  describe('Bulwark of Force modal', () => {
    it('calls handleBulwarkOfForceConfirm with selected targets array', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleBulwarkOfForceConfirm: handler })}
        modalState={{ bulwarkOfForceModal: { creatureTargets: [{ name: 'Goblin' }], maxTargets: 3 } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('bulwark-confirm'));
      expect(handler).toHaveBeenCalledWith(['Goblin']);
    });
  });

  describe('Corona of Enemies modal', () => {
    it('calls handleCoronaEnemySelectionConfirm with selected enemy name', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleCoronaEnemySelectionConfirm: handler })}
        modalState={{ coronaEnemySelectionModal: { creatureTargets: [{ name: 'Dragon' }] } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('corona-confirm'));
      expect(handler).toHaveBeenCalledWith('Dragon');
    });
  });

  describe('Radiance of Dawn modal', () => {
    it('calls handleRadianceOfDawnConfirm with selected targets array', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleRadianceOfDawnConfirm: handler })}
        modalState={{ radianceOfDawnModal: { creatureTargets: [{ name: 'Goblin' }], saveType: 'Dex', saveDc: 15, damageExpression: '3d10', damageType: 'Radiant', rangeFeet: 15 } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('radiance-confirm'));
      expect(handler).toHaveBeenCalledWith(['Goblin']);
    });
  });

  describe('Mantle of Inspiration modal', () => {
    it('calls handleMantleOfInspirationConfirm with selected targets array', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleMantleOfInspirationConfirm: handler })}
        modalState={{ mantleOfInspirationTarget: { creatureTargets: [{ name: 'Ally1' }], tempHp: 5, dieRoll: 4, bardicDieSize: 6, maxTargets: 3 } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('mantle-confirm'));
      expect(handler).toHaveBeenCalledWith(['Ally1']);
    });
  });

  describe('Secondary target modal skip handlers', () => {
    const skipCases = [
      { name: 'Rally', modalKey: 'rallyChoiceModal', modalData: { allyOptions: [{ name: 'Ally1' }], description: 'Test' }, skipTestId: 'secondary-skip', nullState: { rallyChoiceModal: null } },
      { name: 'BulwarkOfForce', modalKey: 'bulwarkOfForceModal', modalData: { creatureTargets: [{ name: 'Goblin' }], maxTargets: 3 }, skipTestId: 'bulwark-skip', nullState: { bulwarkOfForceModal: null } },
      { name: 'CoronaEnemySelection', modalKey: 'coronaEnemySelectionModal', modalData: { creatureTargets: [{ name: 'Dragon' }] }, skipTestId: 'corona-skip', nullState: { coronaEnemySelectionModal: null } },
      { name: 'RadianceOfDawn', modalKey: 'radianceOfDawnModal', modalData: { creatureTargets: [{ name: 'Goblin' }], saveType: 'Dex', saveDc: 15, damageExpression: '3d10', damageType: 'Radiant', rangeFeet: 15 }, skipTestId: 'radiance-skip', nullState: { radianceOfDawnModal: null } },
      { name: 'MantleOfInspiration', modalKey: 'mantleOfInspirationTarget', modalData: { creatureTargets: [{ name: 'Ally1' }], tempHp: 5, dieRoll: 4, bardicDieSize: 6, maxTargets: 3 }, skipTestId: 'mantle-skip', nullState: { mantleOfInspirationTarget: null } },
    ];

    for (const { name, modalKey, modalData, skipTestId, nullState } of skipCases) {
      it(`sets ${modalKey} to null on skip (${name})`, () => {
        const setModalState = vi.fn();
        render(
          <CharActionModals
            {...createBaseProps({})}
            modalState={{ [modalKey]: modalData }}
            setModalState={setModalState}
          />,
        );
        fireEvent.click(screen.getByTestId(skipTestId));
        expect(setModalState).toHaveBeenCalledWith(nullState);
      });
    }
  });
});

describe('CharActionModals — Combat Superiority & Attack Rider handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Combat Superiority modal', () => {
    it('calls handleCombatSuperiorityConfirm on confirm', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleCombatSuperiorityConfirm: handler })}
        combatSuperiorityModal={{ name: 'Trip Attack' }}
        setCombatSuperiorityModal={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('combat-superiority-confirm'));
      expect(handler).toHaveBeenCalledWith('test-superiority');
    });

    it('calls setCombatSuperiorityModal with null on close', () => {
      const setCombatSuperiorityModal = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ setCombatSuperiorityModal })}
        combatSuperiorityModal={{ name: 'Trip Attack' }}
        setCombatSuperiorityModal={setCombatSuperiorityModal}
      />);
      fireEvent.click(screen.getByTestId('combat-superiority-close'));
      expect(setCombatSuperiorityModal).toHaveBeenCalledWith(null);
    });
  });

  describe('Attack Rider Maneuver Prompt', () => {
    it('calls handleAttackRiderManeuverUse on use button click', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleAttackRiderManeuverUse: handler })}
        modalState={{ attackRiderManeuverPrompt: { maneuvers: [{ name: 'Parry' }], attack: {}, isMiss: false } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('maneuver-use'));
      expect(handler).toHaveBeenCalledWith('test-maneuver');
    });

    it('calls handleAttackRiderManeuverSkip on skip button click', () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ handleAttackRiderManeuverSkip: handler })}
        modalState={{ attackRiderManeuverPrompt: { maneuvers: [{ name: 'Parry' }], attack: {}, isMiss: false } }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByTestId('maneuver-skip'));
      expect(handler).toHaveBeenCalled();
    });
  });
});

describe('CharActionModals — Bastion of Law confirm handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // The Bastion of Law onConfirm in CharActionModals routes to handleApply.
  // These tests verify the routing logic (which handler is called with which args)
  // by passing our own spies. The actual handler implementations are tested in
  // their own module tests. Note: onConfirm does NOT dismiss the modal — only
  // onClose does.

  it('calls handleApply with spAmount and selectedTargetName on apply', async () => {
    const setModalState = vi.fn();
    render(<CharActionModals
      {...createBaseProps({ setModalState })}
      modalState={{ bastionOfLawModal: { featureName: 'Bastion of Law', auto: {} } }}
      setModalState={setModalState}
    />);
    fireEvent.click(screen.getByTestId('bastion-apply'));
    // The modal's onConfirm routes to handleApply — verify the handler was
    // invoked with the spAmount and selectedTargetName as the last two args.
    const { handleApply } = await import('../../services/automation/handlers/class-cleric-paladin/bastionOfLawHandler.js');
    expect(handleApply).toHaveBeenCalledWith(
      expect.objectContaining({ automation: {}, name: 'Bastion of Law' }),
      expect.objectContaining({ name: 'Test Character' }),
      'test-campaign',
      5,
      'target',
    );
  });

  it('dismisses modal via onClose (close button)', () => {
    const setModalState = vi.fn();
    render(<CharActionModals
      {...createBaseProps({ setModalState })}
      modalState={{ bastionOfLawModal: { featureName: 'Bastion of Law', auto: {} } }}
      setModalState={setModalState}
    />);
    fireEvent.click(screen.getByTestId('bastion-close'));
    expect(setModalState).toHaveBeenCalledWith({ bastionOfLawModal: null });
  });
});
