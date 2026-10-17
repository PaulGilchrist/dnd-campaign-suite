// @maintained-by-ai
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';

const basePlayerStats = {
  name: 'TestCharacter',
  specialActions: [],
  class: {
    fightingStyles: [],
  },
  actions: [],
  bonusActions: [],
  reactions: [],
  characterAdvancement: [],
  proficiency: 2,
};

// CharSpecialActions renders each clickable row label as `<b>Name:</b>`.
const rowLabel = (name) => `${name}:`;

const weaponModalTests = [
  {
    actionName: 'Weapon Kind Mastery',
    automation: { type: 'weapon_kind_mastery' },
    modalName: 'weaponKindMastery',
    payload: { action: { name: 'Weapon Kind Mastery' } },
    testId: 'weapon-kind-mastery-modal',
    otherTestId: 'weapon-mastery-choice-modal',
    // The kind-mastery modal is view-only (no onConfirm wired at the host).
    confirmCloses: false,
  },
  {
    actionName: 'Weapon Mastery',
    automation: { type: 'weapon_mastery_choice' },
    modalName: 'weaponMasteryChoice',
    payload: { action: { name: 'Weapon Mastery' } },
    testId: 'weapon-mastery-choice-modal',
    otherTestId: 'weapon-kind-mastery-modal',
    // The choice modal also closes via its Confirm button.
    confirmCloses: true,
  },
];

describe('CharSpecialActions - weapon modal onClose handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  });

  it.each(weaponModalTests)(
    'opens, closes, and reopens the $modalName modal via the $actionName row',
    async ({ actionName, automation, modalName, payload, testId, otherTestId, confirmCloses }) => {
      const playerStats = {
        ...basePlayerStats,
        specialActions: [
          { name: actionName, description: `${actionName} description.`, automation },
        ],
      };
      executeHandler.mockResolvedValue({ type: 'modal', modalName, payload });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
      const clickRow = () => fireEvent.click(screen.getByText(rowLabel(actionName)));

      // First click routes the clicked action through executeHandler and
      // opens exactly the modal its modalName maps to (not its sibling).
      clickRow();
      await waitFor(() => {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      });
      expect(executeHandler).toHaveBeenCalledTimes(1);
      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({ name: actionName, automation }),
        expect.objectContaining({ name: basePlayerStats.name }),
        'test',
        undefined,
        undefined,
      );
      expect(screen.queryByTestId(otherTestId)).not.toBeInTheDocument();

      // Closing unmounts the modal and must not mutate any game state.
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      });
      expect(mockRuntimeStore).toEqual({});

      // Re-click after close re-executes the automation and reopens the modal.
      clickRow();
      await waitFor(() => {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      });
      expect(executeHandler).toHaveBeenCalledTimes(2);

      if (confirmCloses) {
        // Confirm closes the choice modal without re-running the automation...
        fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
        await waitFor(() => {
          expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
        });
        expect(executeHandler).toHaveBeenCalledTimes(2);

        // ...and the row still reopens the modal after a confirm-close.
        clickRow();
        await waitFor(() => {
          expect(screen.getByTestId(testId)).toBeInTheDocument();
        });
        expect(executeHandler).toHaveBeenCalledTimes(3);
      }
    },
  );
});
