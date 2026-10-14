// @maintained-by-ai
// Wiring lane for CharActionModals secondary-target modals: verifies that each
// modalState key routes to the correct handler prop with the correct payload (and
// correct skip behavior) when mounted deep through CharActionModals → SecondaryModals.
//
// Division of lanes across the CharActionModals family:
// - Handler implementations (heals, logging, store writes): useCharActionsModalHandlers.*.test.js
// - Multi-select confirmations for other modals (Celestial Resilience, Vitality, etc.):
//   CharActionModals.target-selection-handlers.test.jsx
// - Oceanic Gift variant toggle: modals/SecondaryTargetModals.oceanicVariant.test.jsx
// - Destructive Stride async confirm/skip popups: CharActionModals.async-confirm-handlers.test.jsx
// - AttackRiderManeuverPrompt component behavior: modals/AttackRiderManeuverPrompt.test.jsx
//   (this file is the canonical home for its wiring through CharActionModals).
//
// Single-target modals (Trickster Blessing, Bardic Inspiration, Inspiring Movement) skip
// by delegating to the confirm handler with null; selection modals (Rally, Bulwark,
// Corona, Radiance, Mantle) skip by closing via setModalState — each test asserts its
// own lane's confirm AND skip path in a single render.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
vi.mock('../../services/automation/handlers/class-cleric-paladin/bastionOfLawHandler.js', () => ({
  handle: vi.fn().mockResolvedValue(undefined),
  handleClearWard: vi.fn().mockResolvedValue(undefined),
  handleSpendDice: vi.fn().mockResolvedValue(undefined),
  handleApply: vi.fn().mockResolvedValue(undefined),
}));

// Modals whose confirm/skip callbacks are asserted here get interactive stubs below;
// everything else mounted by CharActionModals is an inert div (factories must not
// reference outer bindings — vi.mock hoists above the module body).
vi.mock('./modals/shared/SaveAttackHealModal.jsx', () => ({ default: () => <div data-testid="save-attack-heal-modal" /> }));
vi.mock('./modals/divine/DivineSparkModal.jsx', () => ({ default: () => <div data-testid="divine-spark-modal" /> }));
vi.mock('./modals/divine/DivineInterventionModal.jsx', () => ({ default: () => <div data-testid="divine-intervention-modal" /> }));
vi.mock('./modals/arcane/ArcaneChargeModal.jsx', () => ({ default: () => <div data-testid="arcane-charge-modal" /> }));
vi.mock('./modals/WarMagicCantripModal.jsx', () => ({ default: () => <div data-testid="war-magic-cantrip-modal" /> }));
vi.mock('./modals/WarMagicSpellModal.jsx', () => ({ default: () => <div data-testid="war-magic-spell-modal" /> }));
vi.mock('./modals/divine/SacredWeaponModal.jsx', () => ({ default: () => <div data-testid="sacred-weapon-modal" /> }));
vi.mock('./modals/PrimalCompanionBonusActionModal.jsx', () => ({ default: () => <div data-testid="primal-companion-bonus-action-modal" /> }));
vi.mock('./modals/MistyWandererModal.jsx', () => ({ default: () => <div data-testid="misty-wanderer-modal" /> }));
vi.mock('./modals/shared/BonusActionChoiceModal.jsx', () => ({ default: () => <div data-testid="bonus-action-choice-modal" /> }));
vi.mock('./modals/CelestialRevelationModal.jsx', () => ({ default: () => <div data-testid="celestial-revelation-modal" /> }));
vi.mock('./modals/RevelationInFleshModal.jsx', () => ({ default: () => <div data-testid="revelation-in-flesh-modal" /> }));
vi.mock('./modals/ElementalAffinityModal.jsx', () => ({ default: () => <div data-testid="elemental-affinity-modal" /> }));
vi.mock('./modals/SingleResistanceSelectionModal.jsx', () => ({ default: () => <div data-testid="single-resistance-selection-modal" /> }));
vi.mock('./modals/shared/ChoiceListModal.jsx', () => ({ ChoiceListModal: () => <div data-testid="choice-list-modal" /> }));
vi.mock('./modals/DragonCompanionModal.jsx', () => ({ default: () => <div data-testid="dragon-companion-modal" /> }));
vi.mock('./modals/WildMagicDoubleRollModal.jsx', () => ({ default: () => <div data-testid="wild-magic-double-roll-modal" /> }));
vi.mock('./modals/WildMagicTamedModal.jsx', () => ({ default: () => <div data-testid="wild-magic-tamed-modal" /> }));
vi.mock('./modals/arcane/ThirdEyeModal.jsx', () => ({ default: () => <div data-testid="third-eye-modal" /> }));
vi.mock('./modals/arcane/SoulstitchSpellsModal.jsx', () => ({ default: () => <div data-testid="soulstitch-spells-modal" /> }));
vi.mock('./modals/arcane/IllusoryRealityModal.jsx', () => ({ default: () => <div data-testid="illusory-reality-modal" /> }));
vi.mock('./modals/FiendishLegacyModal.jsx', () => ({ default: () => <div data-testid="fiendish-legacy-modal" /> }));
vi.mock('./modals/racial/BreathWeaponShapeModal.jsx', () => ({ default: () => <div data-testid="breath-weapon-shape-modal" /> }));
vi.mock('./modals/shared/HypnoticPatternShakeModal.jsx', () => ({ default: () => <div data-testid="hypnotic-pattern-shake-modal" /> }));
vi.mock('./modals/MoonlightStepResourceModal.jsx', () => ({ default: () => <div data-testid="moonlight-step-resource-modal" /> }));
vi.mock('./modals/ConstellationSelectionModal.jsx', () => ({ default: () => <div data-testid="constellation-selection-modal" /> }));

vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => ({
  default: function TestModal({ targets, onTargetSelected, onSkip }) {
    return (
      <div data-testid="secondary-target-modal">
        {targets.map((target, i) => {
          const key = target.value || target.name;
          return (
            <label key={i} data-testid={`secondary-target-${key}`} onClick={() => onTargetSelected(key)}>
              {target.label || target.name}
            </label>
          );
        })}
        <button data-testid="secondary-skip" onClick={onSkip}>Skip</button>
      </div>
    );
  },
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

// ── Tests ──

describe('CharActionModals — single-target SecondaryTargetModal wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // These modals skip by delegating to their confirm handler with null
  // (no setModalState close on skip).
  const cases = [
    {
      name: 'Trickster Blessing',
      modalKey: 'tricksterBlessingModal',
      handlerKey: 'handleTricksterBlessingConfirm',
      modalData: { creatureTargets: [{ name: 'Ally1' }, { name: 'Ally2' }] },
    },
    {
      name: 'Bardic Inspiration',
      modalKey: 'bardicInspirationTargetModal',
      handlerKey: 'handleBardicInspirationConfirm',
      modalData: { creatureTargets: [{ name: 'Ally1' }, { name: 'Ally2' }], dieSize: 8 },
    },
    {
      name: 'Inspiring Movement',
      modalKey: 'inspiringMovementAllyModal',
      handlerKey: 'handleInspiringMovementConfirm',
      modalData: { creatureTargets: [{ name: 'Ally1' }, { name: 'Ally2' }] },
    },
  ];

  for (const { name, modalKey, handlerKey, modalData } of cases) {
    it(`${name}: target click invokes ${handlerKey} with the target name; skip invokes it with null`, () => {
      const handler = vi.fn();
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ [handlerKey]: handler })}
        modalState={{ [modalKey]: modalData }}
        setModalState={setModalState}
      />);

      fireEvent.click(screen.getByTestId('secondary-target-Ally2'));
      expect(handler).toHaveBeenCalledWith('Ally2');

      fireEvent.click(screen.getByTestId('secondary-skip'));
      expect(handler).toHaveBeenNthCalledWith(2, null);
      expect(setModalState).not.toHaveBeenCalled();
    });
  }
});

describe('CharActionModals — selection modal confirm and skip wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Confirm routes to the feature handler with the modal payload;
  // skip closes the modal via setModalState without invoking the handler.
  const cases = [
    {
      name: 'Rally',
      modalKey: 'rallyChoiceModal',
      handlerKey: 'handleRallyChoiceConfirm',
      modalData: { allyOptions: [{ name: 'Ally1' }], description: 'Test' },
      confirmTestId: 'secondary-target-Ally1',
      skipTestId: 'secondary-skip',
      expectedConfirmArgs: ['Ally1', expect.objectContaining({ allyOptions: [{ name: 'Ally1' }], description: 'Test' })],
    },
    {
      name: 'Bulwark of Force',
      modalKey: 'bulwarkOfForceModal',
      handlerKey: 'handleBulwarkOfForceConfirm',
      modalData: { creatureTargets: [{ name: 'Goblin' }], maxTargets: 3 },
      confirmTestId: 'bulwark-confirm',
      skipTestId: 'bulwark-skip',
      expectedConfirmArgs: [['Goblin']],
    },
    {
      name: 'Corona of Enemies',
      modalKey: 'coronaEnemySelectionModal',
      handlerKey: 'handleCoronaEnemySelectionConfirm',
      modalData: { creatureTargets: [{ name: 'Dragon' }] },
      confirmTestId: 'corona-confirm',
      skipTestId: 'corona-skip',
      expectedConfirmArgs: ['Dragon'],
    },
    {
      name: 'Radiance of Dawn',
      modalKey: 'radianceOfDawnModal',
      handlerKey: 'handleRadianceOfDawnConfirm',
      modalData: { creatureTargets: [{ name: 'Goblin' }], saveType: 'Dex', saveDc: 15, damageExpression: '3d10', damageType: 'Radiant', rangeFeet: 15 },
      confirmTestId: 'radiance-confirm',
      skipTestId: 'radiance-skip',
      expectedConfirmArgs: [['Goblin']],
    },
    {
      name: 'Mantle of Inspiration',
      modalKey: 'mantleOfInspirationTarget',
      handlerKey: 'handleMantleOfInspirationConfirm',
      modalData: { creatureTargets: [{ name: 'Ally1' }], tempHp: 5, dieRoll: 4, bardicDieSize: 6, maxTargets: 3 },
      confirmTestId: 'mantle-confirm',
      skipTestId: 'mantle-skip',
      expectedConfirmArgs: [['Ally1']],
    },
  ];

  for (const { name, modalKey, handlerKey, modalData, confirmTestId, skipTestId, expectedConfirmArgs } of cases) {
    it(`${name}: confirm invokes ${handlerKey} with the payload; skip closes without invoking it`, () => {
      const handler = vi.fn();
      const setModalState = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ [handlerKey]: handler })}
        modalState={{ [modalKey]: modalData }}
        setModalState={setModalState}
      />);

      fireEvent.click(screen.getByTestId(confirmTestId));
      expect(handler).toHaveBeenCalledWith(...expectedConfirmArgs);

      fireEvent.click(screen.getByTestId(skipTestId));
      expect(setModalState).toHaveBeenCalledWith({ [modalKey]: null });
      expect(handler).toHaveBeenCalledTimes(1);
    });
  }
});

describe('CharActionModals — Combat Superiority & Attack Rider Maneuver wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Combat Superiority: confirm routes to handleCombatSuperiorityConfirm; close clears the modal', () => {
    const handleCombatSuperiorityConfirm = vi.fn();
    const setCombatSuperiorityModal = vi.fn();
    render(<CharActionModals
      {...createBaseProps({ handleCombatSuperiorityConfirm })}
      combatSuperiorityModal={{ name: 'Trip Attack' }}
      setCombatSuperiorityModal={setCombatSuperiorityModal}
    />);

    fireEvent.click(screen.getByTestId('combat-superiority-confirm'));
    expect(handleCombatSuperiorityConfirm).toHaveBeenCalledWith('test-superiority');
    expect(setCombatSuperiorityModal).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('combat-superiority-close'));
    expect(setCombatSuperiorityModal).toHaveBeenCalledWith(null);
    expect(handleCombatSuperiorityConfirm).toHaveBeenCalledTimes(1);
  });

  it('Attack Rider Maneuver Prompt: use and skip route to their own handlers', () => {
    const handleAttackRiderManeuverUse = vi.fn();
    const handleAttackRiderManeuverSkip = vi.fn();
    render(<CharActionModals
      {...createBaseProps({ handleAttackRiderManeuverUse, handleAttackRiderManeuverSkip })}
      modalState={{ attackRiderManeuverPrompt: { maneuvers: [{ name: 'Parry' }], attack: {}, isMiss: false } }}
      setModalState={vi.fn()}
    />);

    fireEvent.click(screen.getByTestId('maneuver-use'));
    expect(handleAttackRiderManeuverUse).toHaveBeenCalledWith('test-maneuver');
    expect(handleAttackRiderManeuverSkip).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('maneuver-skip'));
    expect(handleAttackRiderManeuverSkip).toHaveBeenCalledTimes(1);
  });
});

describe('CharActionModals — Bastion of Law routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('apply routes to handleApply then dismisses; close dismisses without applying', async () => {
    const setModalState = vi.fn();
    render(<CharActionModals
      {...createBaseProps({ setModalState })}
      modalState={{ bastionOfLawModal: { featureName: 'Bastion of Law', auto: {} } }}
      setModalState={setModalState}
    />);

    fireEvent.click(screen.getByTestId('bastion-apply'));
    const { handleApply } = await import('../../services/automation/handlers/class-cleric-paladin/bastionOfLawHandler.js');
    expect(handleApply).toHaveBeenCalledWith(
      expect.objectContaining({ automation: {}, name: 'Bastion of Law' }),
      expect.objectContaining({ name: 'Test Character' }),
      'test-campaign',
      5,
      'target',
    );
    // Apply dismisses asynchronously once handleApply resolves.
    await waitFor(() => expect(setModalState).toHaveBeenCalledWith({ bastionOfLawModal: null }));

    fireEvent.click(screen.getByTestId('bastion-close'));
    expect(setModalState).toHaveBeenCalledTimes(2);
    expect(setModalState).toHaveBeenLastCalledWith({ bastionOfLawModal: null });
    // Close never invokes the apply handler.
    expect(handleApply).toHaveBeenCalledTimes(1);
  });
});
