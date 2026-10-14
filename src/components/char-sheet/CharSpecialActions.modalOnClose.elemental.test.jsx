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

const elementalModalTests = [
  {
    name: 'Elemental Affinity',
    modalName: 'elementalAffinity',
    automation: { type: 'elemental_affinity' },
    testId: 'elemental-affinity-modal',
  },
  {
    name: 'Wild Magic Surge',
    modalName: 'wildMagicSurge',
    automation: { type: 'wild_magic_surge' },
    testId: 'wild-magic-surge-modal',
  },
  {
    name: 'Stride of the Elements',
    modalName: 'strideOfTheElements',
    automation: { type: 'stride_of_the_elements' },
    testId: 'stride-of-the-elements-modal',
  },
  {
    name: 'Destructive Stride',
    modalName: 'destructiveStride',
    automation: { type: 'destructive_stride' },
    testId: 'destructive-stride-modal',
  },
];

describe('CharSpecialActions - Elemental modal onClose handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  });

  describe.each(elementalModalTests)('$name modal onClose', ({ modalName, name: actionName, automation, testId }) => {
    it('opens the modal and closes it when onClose is called', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName,
        payload: { action: { name: actionName } },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: actionName, description: `${actionName} description.`, automation },
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      fireEvent.click(screen.getAllByText(new RegExp(actionName))[0]);

      await waitFor(() => {
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Close'));

      await waitFor(() => {
        expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      });
    });
  });

  describe('Interaction ordering', () => {
    it('opens a different elemental modal after closing the previous one', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName: 'elementalAffinity',
        payload: { action: { name: 'Elemental Affinity' } },
      });

      const playerStats = createPlayerStats({
        specialActions: [
          { name: 'Elemental Affinity', description: 'Boost damage.', automation: { type: 'elemental_affinity' } },
          { name: 'Wild Magic Surge', description: 'Surge with magic.', automation: { type: 'wild_magic_surge' } },
        ],
      });

      render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

      // Open first modal
      fireEvent.click(screen.getByText(/Elemental Affinity/));
      await waitFor(() => {
        expect(screen.getByTestId('elemental-affinity-modal')).toBeInTheDocument();
      });

      // Close first modal
      fireEvent.click(screen.getByText('Close'));
      await waitFor(() => {
        expect(screen.queryByTestId('elemental-affinity-modal')).not.toBeInTheDocument();
      });

      // Set up mock for the second action
      executeHandler.mockResolvedValueOnce({
        type: 'modal',
        modalName: 'wildMagicSurge',
        payload: {},
      });

      // Open second modal
      fireEvent.click(screen.getByText(/Wild Magic Surge/));
      await waitFor(() => {
        expect(screen.getByTestId('wild-magic-surge-modal')).toBeInTheDocument();
      });
    });
  });
});
