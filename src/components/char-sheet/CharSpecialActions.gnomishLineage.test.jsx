// @maintained-by-ai
// CharSpecialActions gnomish-lineage sheet seam (lane #69): clicking the
// "Gnomish Lineage:" row dispatches executeHandler, opens the REAL
// GnomishLineageModal with all lineage options from the dispatched payload,
// confirms through the REAL confirmGnomishLineage over the in-memory runtime
// store (five _gnomish* keys + confirmation popup), and Cancel closes without
// side effects.
// Owned elsewhere (do not re-pin here):
// - gnomishLineageHandler.test.js — handle() routing incl. the already-selected
//   popup, exact five-key write pins per lineage, invalid-input guards.
// - useCharActionsAutomation.test.class-feature-modals.js — modal-state setter.
// - Generic executeHandler popup rendering over the sheet:
//   CharSpecialActions.useMagicDevice.test.jsx.
// - Mocks come from the shared CharSpecialActions.modalMocks.jsx family module;
//   GnomishLineageModal.jsx stays REAL on purpose. Its automationService
//   interactive list lacks gnomish_lineage, so the membership is extended per-test.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Shared family mocks must load BEFORE the component so its imports are mocked.
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { isInteractiveAutomation } from '../../services/combat/automation/automationService.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';

let capturedPopup = null;

// Mirrors the 2024 Gnomish Lineage special-action row: three lineages, one
// chooser modal. Confirm data (ability/cantrip/ladder spells) is supplied by
// the REAL handler's GNOME_LINEAGES, so Deep Gnome pins below mirror disk data.
const lineageRow = {
  name: 'Gnomish Lineage',
  description: 'Choose your gnomish lineage.',
  automation: {
    type: 'gnomish_lineage',
    options: [
      { name: 'Deep Gnome', description: 'Darkvision 120 ft. + Magic Stone cantrip.' },
      { name: 'Forest Gnome', description: 'Hide behind larger creatures + Minor Illusion cantrip.' },
      { name: 'Rock Gnome', description: 'Move through larger creatures\' space + Mending cantrip.' },
    ],
  },
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

function renderSheet() {
  render(
    <CharSpecialActions
      playerStats={{ ...basePlayerStats, specialActions: [lineageRow] }}
      campaignName="test"
    />
  );
}

function modalResult() {
  return {
    type: 'modal',
    modalName: 'gnomishLineage',
    payload: { action: lineageRow, playerStats: basePlayerStats, campaignName: 'test' },
  };
}

describe('CharSpecialActions - Gnomish Lineage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedPopup = null;
    Object.keys(mockRuntimeStore).forEach(k => delete mockRuntimeStore[k]);
    // Capture popup writes (shared modalMocks default is an inert vi.fn setter).
    vi.mocked(useDiceRollPopup).mockReturnValue({
      setPopupHtml: (html) => { capturedPopup = html; },
    });
    // Extend the shared mocked interactive list with this lane's real
    // INTERACTIVE_HANDLER_TYPES membership (automationService.js:52 has gnomish_lineage).
    vi.mocked(isInteractiveAutomation).mockImplementation((action) => action?.automation?.type === 'gnomish_lineage');
  });

  it('clicking the row opens the lineage chooser, and confirming Deep Gnome writes the selection and shows the confirmation popup', async () => {
    executeHandler.mockResolvedValue(modalResult());

    renderSheet();

    // Interactive rows render clickable and dispatch through executeHandler.
    expect(screen.getByText('Gnomish Lineage:').className).toBe('clickable');
    fireEvent.click(screen.getByText('Gnomish Lineage:'));

    await waitFor(() => {
      expect(executeHandler).toHaveBeenCalledWith(lineageRow, expect.objectContaining({ name: 'TestCharacter' }), 'test', undefined, undefined);
    });

    // The real modal renders every lineage option from the dispatched payload.
    expect(screen.getByRole('button', { name: 'Deep Gnome' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Forest Gnome' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rock Gnome' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Deep Gnome' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Rock Gnome' })).not.toBeInTheDocument();
      // Popup composed by the REAL handler over the sheet seam.
      expect(capturedPopup).toContain('Selected Deep Gnome lineage');
      expect(capturedPopup).toContain('Spellcasting ability: Intelligence');
      // The five runtime keys land in the store via the real confirmGnomishLineage.
      expect(mockRuntimeStore['_gnomishLineageSelection']).toBe('Deep Gnome');
      expect(mockRuntimeStore['_gnomishLineageAbility']).toBe('Intelligence');
      expect(mockRuntimeStore['_gnomishLineageCantrip']).toBe('Magic Stone');
      expect(mockRuntimeStore['_gnomishLineageLevel3']).toBe('Nondetection');
      expect(mockRuntimeStore['_gnomishLineageLevel5']).toBe('Passwall');
    });
  });

  it('cancel closes the chooser without writing any lineage state', async () => {
    executeHandler.mockResolvedValue(modalResult());

    renderSheet();
    fireEvent.click(screen.getByText('Gnomish Lineage:'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Rock Gnome' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Rock Gnome' })).not.toBeInTheDocument();
    });
    expect(capturedPopup).toBeNull();
    expect(mockRuntimeStore['_gnomishLineageSelection']).toBeUndefined();
    expect(mockRuntimeStore['_gnomishLineageAbility']).toBeUndefined();
  });
});
