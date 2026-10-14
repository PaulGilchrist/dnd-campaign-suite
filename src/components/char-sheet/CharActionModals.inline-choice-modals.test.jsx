// @maintained-by-ai
// Host-wiring tests for the three inline choice modals that flow through
// CharActionModals → CharActionModals.SecondaryModals → SecondaryTargetModals →
// SecondaryTargetModal: Sweeping Attack, Bait and Switch, Commander's Strike.
//
// One consolidated test per modal covers the full behavioral contract of a
// single mount: correct title/description/showSize metadata (the build() prop
// mapping in SecondaryTargetModals.jsx), handler dispatch with the selected
// key plus untouched modal state (target label and confirm button), and close
// via setModalState on skip. Splitting these across three renders of the
// same tree added count, not coverage.
//
// Not duplicated elsewhere:
// - CharActions.events.test.jsx — event → modalState open only
// - useCharActionsModalHandlers.combatSuperiority.test.js — handler internals / state clearing
// - CharActionModals.secondary-targets.test.jsx — the OTHER SecondaryTargetModals entries
// - SecondaryTargetModal's own rendering internals are its responsibility (hence the mock).
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

// Mock SecondaryTargetModal to expose its received props and fire its callbacks —
// isolates the host prop-mapping/dispatch under test from the modal's own
// internal selection state machine (covered by its own tests).
vi.mock('./modals/shared/SecondaryTargetModal.jsx', () => {
  const MockSecondaryTargetModal = ({
    title,
    targets,
    onTargetSelected,
    onSkip,
    confirmLabel,
    description,
    showSize,
  }) => (
    <div data-testid="secondary-target-modal">
      <div data-testid="secondary-title">{title}</div>
      {description && <div data-testid="secondary-desc">{description}</div>}
      {showSize && <div data-testid="secondary-show-size">true</div>}
      {targets.map((target, i) => {
        const key = target.value || target.name;
        return (
          <label
            key={i}
            data-testid={`secondary-target-${key}`}
            onClick={() => onTargetSelected(key)}
          >
            {target.label || target.name}
          </label>
        );
      })}
      <button
        data-testid="secondary-confirm"
        onClick={() => onTargetSelected(targets[0]?.value || targets[0]?.name)}
      >
        {confirmLabel}
      </button>
      <button data-testid="secondary-skip" onClick={onSkip}>
        Skip
      </button>
    </div>
  );
  return { default: MockSecondaryTargetModal };
});

// ── Tests ──

describe('CharActionModals inline choice modals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Each case exercises one modalDefs entry in SecondaryTargetModals.jsx:
  // its build() metadata, its dedicated confirm handler wiring (handlerProp),
  // and its own setModalState close key. Target shapes vary deliberately:
  // name-based (sweeping) vs value/label-based options (bait, commander).
  const inlineChoiceCases = [
    {
      name: 'Sweeping Attack Target',
      modalProp: 'sweepingAttackTargetModal',
      modalData: {
        primaryTarget: 'Goblin',
        dieValue: 10,
        secondaryTargets: [{ name: 'Ogre' }, { name: 'Skeleton' }],
      },
      handlerProp: 'handleSweepingAttackConfirm',
      selectedKey: 'Ogre',
      expectedTitle: 'Sweeping Attack',
      // Interpolates primaryTarget and dieValue — pins the data flow, not just copy.
      expectedDescription: /Choose a creature within 5 feet of Goblin to take 10 damage:/,
      expectedShowSize: true,
    },
    {
      name: 'Bait and Switch Choice',
      modalProp: 'baitAndSwitchChoiceModal',
      modalData: { description: 'Test', options: [{ label: 'Player', value: 'player' }] },
      handlerProp: 'handleBaitAndSwitchChoiceConfirm',
      selectedKey: 'player',
      expectedTitle: 'Bait and Switch — AC Bonus',
      expectedDescription: 'Test',
      expectedShowSize: false,
    },
    {
      name: "Commander's Strike Choice",
      modalProp: 'commanderStrikeChoiceModal',
      modalData: { description: 'Test', options: [{ label: 'Bard', value: 'bard' }] },
      handlerProp: 'handleCommanderStrikeChoiceConfirm',
      selectedKey: 'bard',
      expectedTitle: "Commander's Strike — Ally Attack",
      expectedDescription: 'Test',
      expectedShowSize: false,
    },
  ];

  for (const {
    name,
    modalProp,
    modalData,
    handlerProp,
    selectedKey,
    expectedTitle,
    expectedDescription,
    expectedShowSize,
  } of inlineChoiceCases) {
    it(`${name}: renders metadata, dispatches selection, closes on skip`, () => {
      const handler = vi.fn();
      const setModalState = vi.fn();
      render(
        <CharActionModals
          {...createBaseProps({ [handlerProp]: handler })}
          modalState={{ [modalProp]: modalData }}
          setModalState={setModalState}
        />
      );

      // Metadata contract (build() prop mapping)
      expect(screen.getByTestId('secondary-title').textContent).toBe(expectedTitle);
      if (typeof expectedDescription === 'string') {
        expect(screen.getByTestId('secondary-desc').textContent).toBe(expectedDescription);
      } else {
        expect(screen.getByTestId('secondary-desc').textContent).toMatch(expectedDescription);
      }
      if (expectedShowSize) {
        expect(screen.getByTestId('secondary-show-size')).toBeInTheDocument();
      } else {
        expect(screen.queryByTestId('secondary-show-size')).not.toBeInTheDocument();
      }

      // Selecting via target label and via confirm (first target) both dispatch
      // the dedicated handler with the selected key and the untouched modal data.
      fireEvent.click(screen.getByTestId(`secondary-target-${selectedKey}`));
      fireEvent.click(screen.getByTestId('secondary-confirm'));
      expect(handler).toHaveBeenCalledTimes(2);
      expect(handler).toHaveBeenCalledWith(selectedKey, expect.objectContaining(modalData));

      // Skip closes only this modal.
      fireEvent.click(screen.getByTestId('secondary-skip'));
      expect(setModalState).toHaveBeenCalledWith({ [modalProp]: null });
    });
  }
});
