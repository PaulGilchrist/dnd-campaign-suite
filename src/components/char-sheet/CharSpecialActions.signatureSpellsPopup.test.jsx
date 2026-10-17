// @maintained-by-ai
// CharSpecialActions signature-spells lane: what clicking the Signature Spells row
// dispatches (executeHandler args → chooser mount), what Confirm routes to
// onSignatureSpellsSelected (exact args incl. the chosen spells), how each popup
// result shape becomes dismissable popup HTML, and that Close is inert (no handler
// call, no popup, no runtime write) while leaving the row able to remount the chooser.
// Owned elsewhere (do not re-pin here):
// - Modal internals (spell lists, selection rules): SignatureSpellsModal suite.
// - Handler internals (persisting the chosen spells): signatureSpellsHandler tests.
// - Spell Mastery / Savant confirm popups: CharSpecialActions.handlers / modalOnClose.arcane suites.
// - Mocks come from the shared CharSpecialActions.modalMocks.jsx family module.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Shared family mocks must load BEFORE the component so its imports are mocked.
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { onSignatureSpellsSelected } from '../../services/automation/handlers/class-wizard/signatureSpellsHandler.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';

let capturedPopup = null;

// Row action and the dispatched chooser payload share this object identity, so the
// confirm-args assertion pins the full row → executeHandler → payload → handler loop.
const signatureAction = {
  name: 'Signature Spells',
  description: 'Choose two level 3 spells.',
  automation: { type: 'signature_spells' },
};

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

// Open seam: click the Signature Spells row, executeHandler returns the chooser
// dispatch carrying `signatureAction` for the host to hand to the confirm callback.
async function openChooser(playerStats) {
  executeHandler.mockResolvedValue({
    type: 'modal',
    modalName: 'signatureSpells',
    payload: {
      action: signatureAction,
      playerStats,
      campaignName: 'test',
      level3Options: ['Fireball', 'Haste', 'Counterspell'],
      selectedSpells: [],
    },
  });
  render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);
  fireEvent.click(screen.getByText('Signature Spells:'));
  await waitFor(() => {
    expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
  });
}

describe('CharSpecialActions - Signature Spells chooser open/confirm/close lane', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedPopup = null;
    Object.keys(mockRuntimeStore).forEach(k => delete mockRuntimeStore[k]);
    // Capture popup writes (shared modalMocks default is an inert vi.fn setter).
    vi.mocked(useDiceRollPopup).mockReturnValue({
      setPopupHtml: (html) => { capturedPopup = html; },
    });
  });

  it('clicking the row dispatches through executeHandler and mounts the chooser silently', async () => {
    const playerStats = createPlayerStats({ specialActions: [signatureAction] });
    await openChooser(playerStats);

    expect(executeHandler).toHaveBeenCalledWith(signatureAction, playerStats, 'test', undefined, undefined);
    expect(screen.getByRole('heading', { name: 'Signature Spells' })).toBeInTheDocument();
    expect(capturedPopup).toBeNull();
    expect(onSignatureSpellsSelected).not.toHaveBeenCalled();
  });

  it('Confirm routes both spells to the handler, closes the chooser, and shows its popup', async () => {
    const playerStats = createPlayerStats({ specialActions: [signatureAction] });
    onSignatureSpellsSelected.mockResolvedValue({
      type: 'popup',
      payload: { name: 'Signature Spells', description: 'Spells prepared and ready to cast.' },
    });
    await openChooser(playerStats);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => {
      expect(onSignatureSpellsSelected).toHaveBeenCalledWith(signatureAction, playerStats, 'test', 'Fireball', 'Haste');
    });
    await waitFor(() => {
      expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
    });
    expect(capturedPopup).toContain('fa-solid fa-magic');
    expect(capturedPopup).toContain('Signature Spells');
    expect(capturedPopup).toContain('Spells prepared and ready to cast.');
    expect(capturedPopup).toContain('click to dismiss');
  });

  // Popup-shape shaping happens after the handler resolves; the chooser closes for
  // EVERY settled result, so the close assertion is shared, only the HTML differs.
  const popupShapeCases = [
    {
      label: 'falls back to the feature title when the payload has no name',
      result: { type: 'popup', payload: { description: 'Spells prepared.' } },
      expectPopup: (popup) => {
        expect(popup).toContain('Signature Spells');
        expect(popup).toContain('Spells prepared.');
        expect(popup).not.toContain('undefined');
      },
    },
    {
      label: 'renders an empty description line when the payload has no description',
      result: { type: 'popup', payload: { name: 'Signature Spells' } },
      expectPopup: (popup) => {
        expect(popup).toContain('Signature Spells');
        expect(popup).not.toContain('undefined');
      },
    },
    {
      label: 'passes a string popup payload through verbatim',
      result: { type: 'popup', payload: 'Direct string response.' },
      expectPopup: (popup) => expect(popup).toBe('Direct string response.'),
    },
    {
      label: 'stays silent for a non-popup result',
      result: { type: 'none' },
      expectPopup: (popup) => expect(popup).toBeNull(),
    },
    {
      label: 'stays silent on a null result',
      result: null,
      expectPopup: (popup) => expect(popup).toBeNull(),
    },
    {
      label: 'stays silent on an undefined result',
      result: undefined,
      expectPopup: (popup) => expect(popup).toBeNull(),
    },
  ];

  it.each(popupShapeCases)(
    'confirming always closes the chooser and $label',
    async ({ result, expectPopup }) => {
      const playerStats = createPlayerStats({ specialActions: [signatureAction] });
      onSignatureSpellsSelected.mockResolvedValue(result);
      await openChooser(playerStats);

      fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      await waitFor(() => {
        expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
      });
      expect(onSignatureSpellsSelected).toHaveBeenCalledWith(signatureAction, playerStats, 'test', 'Fireball', 'Haste');
      expectPopup(capturedPopup);
    }
  );

  it('Close dismisses the chooser inertly and the row remounts it on the next click', async () => {
    const playerStats = createPlayerStats({ specialActions: [signatureAction] });
    await openChooser(playerStats);

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByTestId('signature-spells-modal')).not.toBeInTheDocument();
    });
    // Dismiss commits nothing: no handler call, no popup, no runtime write.
    expect(onSignatureSpellsSelected).not.toHaveBeenCalled();
    expect(capturedPopup).toBeNull();
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(mockRuntimeStore).toEqual({});

    // State is fully cleared — clicking the feature re-runs and mounts a fresh chooser.
    fireEvent.click(screen.getByText('Signature Spells:'));
    await waitFor(() => {
      expect(screen.getByTestId('signature-spells-modal')).toBeInTheDocument();
      expect(executeHandler).toHaveBeenCalledTimes(2);
    });
  });
});
