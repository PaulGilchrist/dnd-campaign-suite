// @cleaned-by-ai
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CharActionModals from './CharActionModals.jsx';

// ── Test fixtures ──

function baseProps(overrides) {
  return {
    playerStats: { name: 'Test Character' },
    campaignName: 'test-campaign',
    characters: [],
    setSweepingAttackTargetModal: vi.fn(),
    setBaitAndSwitchChoiceModal: vi.fn(),
    setCommanderStrikeChoiceModal: vi.fn(),
    handleSweepingAttackConfirm: vi.fn(),
    handleBaitAndSwitchChoiceConfirm: vi.fn(),
    handleCommanderStrikeChoiceConfirm: vi.fn(),
    pendingDamageRef: { current: null },
    ...overrides,
  };
}

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
        {...baseProps({ [handlerProp]: handler })}
        {...{ [modalProp]: modalData }}
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
