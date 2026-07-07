// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';
import { createBaseProps } from './CharActionModals.test-utils.jsx';

// ── Mocked modal modules ──
// These mocks are needed so CharActionModals can render without unmocked
// dependencies.  Modal rendering is covered by
// CharActionModals.rendering.test.jsx; handler callbacks are covered by
// CharActionModals.handlers.test.jsx.  These mocks exist only so the
// component can mount without side effects (e.g. getCombatContext fetch).

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
      optionText: 'Ogre',
      confirmText: /Apply Sweeping Attack/,
    },
    {
      name: 'Bait and Switch Choice',
      modalProp: 'baitAndSwitchChoiceModal',
      modalData: { description: 'Test', options: [{ label: 'Player', value: 'player' }] },
      handlerProp: 'handleBaitAndSwitchChoiceConfirm',
      optionText: 'Player',
      confirmText: /Apply AC Bonus/,
    },
    {
      name: "Commander's Strike Choice",
      modalProp: 'commanderStrikeChoiceModal',
      modalData: { description: 'Test', options: [{ label: 'Bard', value: 'bard' }] },
      handlerProp: 'handleCommanderStrikeChoiceConfirm',
      optionText: 'Bard',
      confirmText: /Grant Attack/,
    },
  ];

  for (const { name, modalProp, modalData, handlerProp, optionText, confirmText } of inlineChoiceCases) {
    it(`${name}: calls handler with selected value and modal data on selection`, () => {
      const handler = vi.fn();
      render(<CharActionModals
        {...createBaseProps({ [handlerProp]: handler })}
        modalState={{ [modalProp]: modalData }}
        setModalState={vi.fn()}
      />);
      fireEvent.click(screen.getByText(optionText));
      fireEvent.click(screen.getByText(confirmText));
      expect(handler).toHaveBeenCalledWith(
        optionText === 'Ogre' ? 'Ogre' : optionText.toLowerCase(),
        expect.objectContaining(modalData)
      );
    });
  }
});
