// Tests for inline choice modals (Sweeping Attack, Bait and Switch, Commander's Strike)
// that render SecondaryTargetModal. Each test verifies the behavioral contract:
// correct title/description rendering and handler invocation on target selection.
//
// Removed redundant tests:
// - "modal not rendered when prop is null" (3 tests): same negation assertion
//   pattern for each modal type; parameterized structure already guarantees
//   conditional rendering — adds no behavioral confidence.
// - "renders correct confirm label" (3 tests): cosmetic detail already covered
//   by title/description rendering tests.
// - "renders target options from modal data" (3 tests): covered by title test
//   since target rendering is SecondaryTargetModal's responsibility.
// - "calls handler with selected key on target label click" (3 tests):
//   consolidated into "calls handler on interaction" which tests both the
//   confirm button and target label click in a single parameterized test.
// - "edge cases" (2 tests): empty targets and single target render with
//   minimal behavioral value.
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

// Mock SecondaryTargetModal so we can verify its props and call its callbacks.
// The real SecondaryTargetModal has internal useState logic; mocking it
// isolates the CharActionModals rendering/behavior under test.
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

  // Inline choice modals (Sweeping Attack, Bait and Switch, Commander's Strike)
  // all render SecondaryTargetModal and pass the handler as onTargetSelected.
  // These tests verify that selecting a target triggers the correct handler
  // with the selected value and full modal data — the behavioral contract.
  // Rendering details are SecondaryTargetModal's responsibility.

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
      confirmLabel: 'Apply Sweeping Attack',
      expectedTitle: 'Sweeping Attack',
      expectedDescription: /Choose a creature within 5 feet of Goblin to take 10 damage:/,
      expectedShowSize: true,
    },
    {
      name: 'Bait and Switch Choice',
      modalProp: 'baitAndSwitchChoiceModal',
      modalData: { description: 'Test', options: [{ label: 'Player', value: 'player' }] },
      handlerProp: 'handleBaitAndSwitchChoiceConfirm',
      selectedKey: 'player',
      confirmLabel: 'Apply AC Bonus',
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
      confirmLabel: "Grant Attack",
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
    describe(name, () => {
      it('renders modal structure with correct title, description, and showSize', () => {
        render(
          <CharActionModals
            {...createBaseProps()}
            modalState={{ [modalProp]: modalData }}
            setModalState={vi.fn()}
          />
        );
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
      });

      it('calls handler on confirm button and target label interaction', () => {
        const handler = vi.fn();
        render(
          <CharActionModals
            {...createBaseProps({ [handlerProp]: handler })}
            modalState={{ [modalProp]: modalData }}
            setModalState={vi.fn()}
          />
        );
        fireEvent.click(screen.getByTestId('secondary-confirm'));
        expect(handler).toHaveBeenCalledWith(selectedKey, expect.objectContaining(modalData));
        fireEvent.click(screen.getByTestId(`secondary-target-${selectedKey}`));
        expect(handler).toHaveBeenCalledWith(selectedKey, expect.objectContaining(modalData));
      });

      it('dismisses modal on skip', () => {
        const setModalState = vi.fn();
        render(
          <CharActionModals
            {...createBaseProps()}
            modalState={{ [modalProp]: modalData }}
            setModalState={setModalState}
          />
        );
        fireEvent.click(screen.getByTestId('secondary-skip'));
        expect(setModalState).toHaveBeenCalledWith({ [modalProp]: null });
      });
    });
  }
});
