// @maintained-by-ai
// CharSpecialActions combat-action click handlers seam:
//   - Destructive Stride: Confirm Target → SecondaryTargetModal handoff,
//     Confirm Popup branch, and the CLA-113 OBJECT-signature applyTargetChoice call.
//   - Moonlight Step fallback YES path (confirmTeleport carries slotLevel).
//   - Portent die choice (apply args + popup, and error-close via catch).
// Not covered here (covered elsewhere): modal OPEN dispatch for every modal
// (CharSpecialActions.modals.test.jsx parametrized table), Moonlight Step
// render + NO-close (CharSpecialActions.modalsInline.test.jsx), brew_poison /
// delegate clicks + executeHandler popup results (CharSpecialActions.automationClickHandlers.test.jsx).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { applyPortentChoice } from '../../services/automation/handlers/class-wizard/portentHandler.js';
import { applyTargetChoice } from '../../services/automation/handlers/combat/destructiveStrideHandler.js';
import { confirmTeleport } from '../../services/automation/handlers/class-warlock/tempTeleportHandler.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
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

function createSpecialAction(name, automation) {
  return { name, description: `${name} description.`, automation };
}

let setPopupHtml;

function renderWithAction(action) {
  render(
    <CharSpecialActions
      playerStats={createPlayerStats({ specialActions: [action] })}
      campaignName="test"
    />
  );
  fireEvent.click(screen.getAllByText(new RegExp(action.name))[0]);
}

// Mocked DestructiveStrideModal re-emits its own confirm payloads (CLA-113:
// the real modal self-applies applyDamageTypeChoice), so the executeHandler
// payload only needs action/playerStats/campaignName to open it.
async function openStrideTargetModal() {
  executeHandler.mockResolvedValue({
    type: 'modal',
    modalName: 'destructiveStride',
    payload: {
      action: { name: 'Destructive Stride' },
      playerStats: createPlayerStats(),
      campaignName: 'test',
    },
  });
  renderWithAction(createSpecialAction('Destructive Stride', { type: 'destructive_stride' }));
  await waitFor(() => {
    expect(screen.getByTestId('destructive-stride-modal')).toBeInTheDocument();
  });
  fireEvent.click(screen.getByText('Confirm Target'));
  await waitFor(() => {
    expect(screen.getByTestId('secondary-target-modal')).toBeInTheDocument();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(mockRuntimeStore).forEach(key => delete mockRuntimeStore[key]);
  setPopupHtml = vi.fn();
  vi.mocked(useDiceRollPopup).mockReturnValue({ setPopupHtml });
});

describe('CharSpecialActions - Destructive Stride', () => {
  it('hands off to the secondary target modal on Confirm Target', async () => {
    await openStrideTargetModal();

    // Handoff content comes from the grid's SecondaryTargetModal wiring.
    expect(screen.getByText('Choose a creature within 5 ft. that you entered a space near while striding. A creature can take this damage only once per turn.')).toBeInTheDocument();
    expect(screen.getByText('Strike')).toBeInTheDocument();
    expect(screen.queryByTestId('destructive-stride-modal')).not.toBeInTheDocument();
  });

  it('shows the popup and closes without a target modal on Confirm Popup', async () => {
    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'destructiveStride',
      payload: {
        action: { name: 'Destructive Stride' },
        playerStats: createPlayerStats(),
        campaignName: 'test',
      },
    });
    renderWithAction(createSpecialAction('Destructive Stride', { type: 'destructive_stride' }));
    await waitFor(() => {
      expect(screen.getByTestId('destructive-stride-modal')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Confirm Popup'));

    await waitFor(() => {
      expect(setPopupHtml).toHaveBeenCalledTimes(1);
    });
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Destructive Stride'));
    expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Struck target.'));
    expect(screen.queryByTestId('destructive-stride-modal')).not.toBeInTheDocument();
    // Popup branch must NOT open the target-choice modal.
    expect(screen.queryByTestId('secondary-target-modal')).not.toBeInTheDocument();
  });

  it('applies the stride damage with the CLA-113 OBJECT signature and shows the popup on Strike', async () => {
    await openStrideTargetModal();

    fireEvent.click(screen.getByText('Strike'));

    // CLA-113: applyTargetChoice has an OBJECT-destructure signature — a
    // positional call left campaignName undefined (getCombatSummary(undefined)
    // = null → silent zero damage). Pin the single-object call shape.
    await waitFor(() => {
      expect(applyTargetChoice).toHaveBeenCalledOnce();
    });
    expect(applyTargetChoice.mock.calls[0]).toHaveLength(1);
    expect(applyTargetChoice).toHaveBeenCalledWith({
      action: expect.objectContaining({ name: 'Destructive Stride' }),
      playerStats: expect.any(Object),
      campaignName: 'test',
      targetName: 'Enemy1',
      chosenType: 'Fire',
      martialArtsDie: 6,
    });

    await waitFor(() => {
      expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Struck target.'));
    });
    expect(screen.queryByTestId('secondary-target-modal')).not.toBeInTheDocument();
  });
});

describe('CharSpecialActions - Moonlight Step Fallback', () => {
  it('consumes the offered spell slot via confirmTeleport on Yes, then shows the popup', async () => {
    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'moonlightStepFallback',
      payload: {
        action: { name: 'Moonlight Step' },
        playerStats: createPlayerStats(),
        campaignName: 'test',
        slotLevel: 3,
      },
    });

    renderWithAction(createSpecialAction('Moonlight Step', { type: 'teleport', effect: 'moonlight_step_teleport' }));

    await waitFor(() => {
      expect(screen.getByText(/Consume a level 3 spell slot to use Moonlight Step/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Yes, Consume Slot'));

    // slotLevel from the fallback payload must reach confirmTeleport.
    await waitFor(() => {
      expect(confirmTeleport).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Moonlight Step' }),
        expect.any(Object),
        'test',
        false,
        3,
      );
    });
    await waitFor(() => {
      expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Teleported.'));
    });
    expect(screen.queryByText(/Consume a level 3 spell slot/)).not.toBeInTheDocument();
  });
});

describe('CharSpecialActions - Portent Die Choice', () => {
  function mockPortentModal(payloadOverrides) {
    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'portentDiceChoice',
      payload: {
        action: { name: 'Portent' },
        playerStats: createPlayerStats(),
        campaignName: 'test',
        context: {},
        ...payloadOverrides,
      },
    });
    renderWithAction(createSpecialAction('Portent', { type: 'portent' }));
  }

  it('applies the chosen die with the full event context and shows the popup', async () => {
    mockPortentModal({
      targetName: 'Orc',
      eventType: 'save',
      eventData: { d20: 10, bonus: 2, saveType: 'Dexterity' },
      diceOptions: [5, 15],
    });
    await waitFor(() => {
      expect(screen.getByText('Orc')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('5'));

    await waitFor(() => {
      expect(applyPortentChoice).toHaveBeenCalledWith({
        action: expect.objectContaining({ name: 'Portent' }),
        playerStats: expect.any(Object),
        campaignName: 'test',
        targetName: 'Orc',
        eventType: 'save',
        eventData: expect.objectContaining({ d20: 10, bonus: 2, saveType: 'Dexterity' }),
        context: expect.any(Object),
        chosenDie: 5,
      });
    });
    await waitFor(() => {
      expect(setPopupHtml).toHaveBeenCalledWith(expect.stringContaining('Die applied.'));
    });
    expect(screen.queryByText('Orc')).not.toBeInTheDocument();
  });

  it('closes the modal without a popup when applying the die fails', async () => {
    applyPortentChoice.mockRejectedValueOnce(new Error('Portent failed'));
    mockPortentModal({
      targetName: 'Troll',
      eventType: 'attack',
      eventData: { d20: 18, bonus: 5, targetName: 'Troll', hit: true },
      diceOptions: [3, 8],
    });
    await waitFor(() => {
      expect(screen.getByText('Troll')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('3'));

    await waitFor(() => {
      expect(screen.queryByText('Troll')).not.toBeInTheDocument();
    });
    expect(applyPortentChoice).toHaveBeenCalledOnce();
    expect(setPopupHtml).not.toHaveBeenCalled();
  });
});
