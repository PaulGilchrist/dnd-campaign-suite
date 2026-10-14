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

function createPlayerStats(overrides = {}) {
  return { ...basePlayerStats, ...overrides };
}

const weaponModalTests = [
  {
    name: 'WeaponKindMasteryModal',
    modalName: 'weaponKindMastery',
    actionName: 'Weapon Kind Mastery',
    automation: { type: 'weapon_kind_mastery' },
    payload: { action: { name: 'Weapon Kind Mastery' } },
    testId: 'weapon-kind-mastery-modal',
  },
  {
    name: 'WeaponMasteryChoiceModal',
    modalName: 'weaponMasteryChoice',
    actionName: 'Weapon Mastery',
    automation: { type: 'weapon_mastery_choice' },
    payload: { action: { name: 'Weapon Mastery' } },
    testId: 'weapon-mastery-choice-modal',
  },
];

describe('CharSpecialActions - Weapon modal onClose handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  });

  describe.each(weaponModalTests)('$name ($actionName)', ({ modalName, actionName, automation, payload, testId }) => {
    it('reopens the modal after closing (re-click behavior)', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName,
        payload,
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: actionName, description: `${actionName} description.`, automation },
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      // First open
      fireEvent.click(screen.getAllByText(new RegExp(actionName))[0]);
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledTimes(1);
      });
      await waitFor(() => {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      });

      // Close
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      });

      // Re-click should call executeHandler again
      fireEvent.click(screen.getAllByText(new RegExp(actionName))[0]);
      await waitFor(() => {
        expect(executeHandler).toHaveBeenCalledTimes(2);
      });
      await waitFor(() => {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      });
    });
  });
});
