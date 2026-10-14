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

const combatModalTests = [
  {
    name: 'Quivering Palm',
    modalName: 'quiveringPalm',
    actionName: 'Quivering Palm',
    automation: { type: 'quivering_palm' },
    testId: 'quivering-palm-modal',
  },
  {
    name: 'Steps of the Fey Taunt',
    modalName: 'stepsOfTheFeyTaunt',
    actionName: 'Steps of the Fey Taunt',
    automation: { type: 'steps_of_the_fey_taunt' },
    testId: 'steps-of-the-fey-taunt-modal',
  },
  {
    name: 'Hurl Through Hell',
    modalName: 'hurlThroughHell',
    actionName: 'Hurl Through Hell',
    automation: { type: 'hurl_through_hell' },
    testId: 'hurl-through-hell-modal',
  },
  {
    name: 'Clairvoyant Combatant',
    modalName: 'clairvoyantCombatant',
    actionName: 'Clairvoyant Combatant',
    automation: { type: 'clairvoyant_combatant' },
    testId: 'clairvoyant-combatant-modal',
  },
];

describe('CharSpecialActions - Combat feature modal onClose handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  });

  describe.each(combatModalTests)('$name modal onClose', ({ modalName, actionName, automation, testId }) => {
    it('opens the modal and closes it when onClose is called', async () => {
      executeHandler.mockResolvedValue({
        type: 'modal',
        modalName,
        payload: { action: { name: actionName }, playerStats: createPlayerStats({ specialActions: [{ name: actionName, description: `${actionName} description.`, automation }] }), campaignName: 'test' },
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

  it('does not open any combat modal when cannotAct is true', async () => {
    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'quiveringPalm',
      payload: { action: { name: 'Quivering Palm' } },
    });

    const playerStats = createPlayerStats({
      specialActions: [
        { name: 'Quivering Palm', description: 'Palm of quivering.', automation: { type: 'quivering_palm' } },
      ],
    });

    render(<CharSpecialActions playerStats={playerStats} campaignName="test" cannotAct={true} />);

    fireEvent.click(screen.getByText(/Quivering Palm/));

    await waitFor(() => {
      expect(screen.queryByTestId('quivering-palm-modal')).not.toBeInTheDocument();
    });
  });
});
