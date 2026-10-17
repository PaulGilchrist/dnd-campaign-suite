// @maintained-by-ai
// modalOnClose quartet seam map (#76-79):
//   combat (this file) — Quivering Palm / Steps of the Fey Taunt / Hurl Through Hell /
//                        Clairvoyant Combatant: Close-dismiss rows + cannotAct guard.
//                        Each close row guards its own setXModal(null) wiring in
//                        CharSpecialActionsModals.jsx and asserts dismissal is inert
//                        (no re-dispatch of executeHandler, no runtime-store writes).
//   arcane             — CharSpecialActions.modalOnClose.arcane.test.jsx
//   elemental          — CharSpecialActions.modalOnClose.elemental.test.jsx (owns reopen ordering)
//   weapons          — CharSpecialActions.modalOnClose.weapons.test.jsx
// Not duplicated here:
//   Open routing (executeHandler args + modal render for these four) lives in
//   CharSpecialActions.modals.test.jsx — the strongest version of those tests.
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
    automation: { type: 'quivering_palm' },
    testId: 'quivering-palm-modal',
  },
  {
    name: 'Steps of the Fey Taunt',
    modalName: 'stepsOfTheFeyTaunt',
    automation: { type: 'steps_of_the_fey_taunt' },
    testId: 'steps-of-the-fey-taunt-modal',
  },
  {
    name: 'Hurl Through Hell',
    modalName: 'hurlThroughHell',
    automation: { type: 'hurl_through_hell' },
    testId: 'hurl-through-hell-modal',
  },
  {
    name: 'Clairvoyant Combatant',
    modalName: 'clairvoyantCombatant',
    automation: { type: 'clairvoyant_combatant' },
    testId: 'clairvoyant-combatant-modal',
  },
];

describe('CharSpecialActions - Combat feature modal onClose handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  });

  describe.each(combatModalTests)('$name modal onClose', ({ name: actionName, modalName, automation, testId }) => {
    it('dismisses the modal on Close without re-running the automation or touching runtime state', async () => {
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

      fireEvent.click(screen.getByRole('button', { name: 'Close' }));

      await waitFor(() => {
        expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      });

      // Dismissal is inert: the automation ran once (the open click) and Close
      // wrote nothing to the runtime store.
      expect(executeHandler).toHaveBeenCalledTimes(1);
      expect(mockRuntimeStore).toEqual({});
    });
  });

  it('does not open any combat modal when cannotAct is true', () => {
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

    // The cannotAct guard returns synchronously before dispatch, so a plain
    // post-click assertion is strong (no waitFor-negative that passes vacuously).
    expect(executeHandler).not.toHaveBeenCalled();
    expect(screen.queryByTestId('quivering-palm-modal')).not.toBeInTheDocument();
  });
});
