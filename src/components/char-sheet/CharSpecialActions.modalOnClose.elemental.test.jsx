// @maintained-by-ai
// modalOnClose quartet seam map (#76-79):
//   elemental (this file) — Elemental Affinity / Wild Magic Surge / Destructive Stride:
//                           Close-dismiss rows (unmount + inertness: no executeHandler
//                           re-dispatch, no runtime-store writes) + reopen-after-close
//                           ordering (owned here; weapons owns same-modal reopen).
//   arcane  — CharSpecialActions.modalOnClose.arcane.test.jsx
//   combat  — CharSpecialActions.modalOnClose.combat.test.jsx
//   weapons — CharSpecialActions.modalOnClose.weapons.test.jsx
// Not duplicated here:
//   Stride of the Elements open/close is subsumed by CharSpecialActions.elementalEffects.test.jsx
//   (#72): chip-click → stride modal open, each option's confirm → buff write + modal unmount.
//   Open routing (executeHandler args + modal render) lives in CharSpecialActions.modals.test.jsx.
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

  // Unique seam: after a Close, a DIFFERENT elemental modal can open (the first
  // modal slot is fully cleared). Same-modal reopen lives in weapons.test.jsx;
  // stride confirm-dismiss in elementalEffects.test.jsx.
  it('opens a different elemental modal after closing the previous one', async () => {
    executeHandler
      .mockResolvedValueOnce({
        type: 'modal',
        modalName: 'elementalAffinity',
        payload: { action: { name: 'Elemental Affinity' } },
      })
      .mockResolvedValueOnce({
        type: 'modal',
        modalName: 'wildMagicSurge',
        payload: { action: { name: 'Wild Magic Surge' } },
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

    // Close first modal — inert dismissal (no runtime writes)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByTestId('elemental-affinity-modal')).not.toBeInTheDocument();
    });
    expect(mockRuntimeStore).toEqual({});

    // Open second modal: re-dispatched, and the closed modal stays gone
    fireEvent.click(screen.getByText(/Wild Magic Surge/));
    await waitFor(() => {
      expect(screen.getByTestId('wild-magic-surge-modal')).toBeInTheDocument();
    });
    expect(executeHandler).toHaveBeenCalledTimes(2);
    expect(screen.queryByTestId('elemental-affinity-modal')).not.toBeInTheDocument();
  });
});
