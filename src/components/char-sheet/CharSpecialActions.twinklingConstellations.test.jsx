// @maintained-by-ai
// CLA-368 regression: the Special Actions "Twinkling Constellations:" row must
// be clickable, dispatch through executeHandler, open the constellation chooser
// modal, apply the chosen constellation via the TWINKLING applier (never the
// Starry Form one), and close on Done/Cancel. Previously the row rendered an
// inert <b className=""> with no onClick — the downstream modal→apply plumbing
// was dead code. Clickability is pinned behaviourally: if the row goes inert
// again the chooser never opens and every case here fails.
// - The chooser is the REAL ConstellationSelectionModal (its own behaviour is
//   covered by modals/ConstellationSelectionModal.test.jsx) so this file pins
//   the grid→modal wiring: select-then-Choose applies, Cancel stays inert.
// - Base mocks come from the shared CharSpecialActions.modalMocks.jsx family
//   module; only the two constellation appliers are stubbed locally so the
//   apply identity can be pinned and no real buff state is written.
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Shared family mocks must load BEFORE the component so its imports are mocked.
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { applyConstellationOption as applyTwinkling } from '../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js';
import { applyConstellationOption as applyStarry } from '../../services/automation/handlers/class-sorcerer/starryFormHandler.js';

// Twinkling applier — echoes the chosen option into the result description so
// the modal's result view can be pinned per constellation.
vi.mock('../../services/automation/handlers/class-sorcerer/twinklingConstellationHandler.js', () => ({
  handle: vi.fn(),
  applyConstellationOption: vi.fn(),
}));

// Starry Form applier — identity-pin only: the twinkling lane must never route here.
vi.mock('../../services/automation/handlers/class-sorcerer/starryFormHandler.js', () => ({
  handle: vi.fn(),
  applyConstellationOption: vi.fn(),
}));

const basePlayerStats = {
  name: 'StarDruid',
  level: 20,
  specialActions: [],
  class: { fightingStyles: [] },
  actions: [],
  bonusActions: [],
  reactions: [],
  characterAdvancement: [],
  proficiency: 6,
};

const twinklingRow = {
  name: 'Twinkling Constellations',
  description: 'At the start of each of your turns you can change constellation.',
  automation: { type: 'twinkling_constellations', options: ['Archer', 'Chalice', 'Dragon'], casting_time: 'passive', hasAutomation: true },
};

const playerStats = { ...basePlayerStats, specialActions: [twinklingRow] };

const rowLabel = () => screen.getByText('Twinkling Constellations:');
const chooserOpen = () => screen.findByText('Choose a constellation:');
const optionButton = (option) => screen.getByRole('button', { name: new RegExp(`^${option}`) });

function openChooser() {
  render(<CharSpecialActions playerStats={playerStats} campaignName="test-campaign" />);
  fireEvent.click(rowLabel());
}

describe('CharSpecialActions - Twinkling Constellations row (CLA-368)', () => {
  let capturedPopup = null;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedPopup = null;
    Object.keys(mockRuntimeStore).forEach(k => delete mockRuntimeStore[k]);
    // Capture popup writes (shared modalMocks default is an inert vi.fn setter).
    vi.mocked(useDiceRollPopup).mockReturnValue({
      setPopupHtml: (html) => { capturedPopup = html; },
    });
    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'twinklingConstellation',
      payload: { action: twinklingRow, playerStats: basePlayerStats, campaignName: 'test-campaign' },
    });
    vi.mocked(applyTwinkling).mockImplementation((action, stats, campaign, option) => Promise.resolve({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Twinkling Constellations',
        description: `${option} constellation chosen (Twinkling Constellations).`,
      },
    }));
  });

  it('row click dispatches executeHandler and opens the chooser with twinkled options', async () => {
    openChooser();

    await chooserOpen();
    expect(executeHandler).toHaveBeenCalledWith(twinklingRow, playerStats, 'test-campaign', undefined, undefined);

    // Grid renders the chooser with isTwinkled={true}: upgraded 2d8 dice offered.
    expect(optionButton('Archer')).toHaveAccessibleName(/2d8/);
    expect(optionButton('Chalice')).toHaveAccessibleName(/2d8/);
    expect(optionButton('Dragon')).toHaveAccessibleName(/Fly Speed 20 feet/);
  });

  it.each(['Archer', 'Chalice', 'Dragon'])(
    'applying %s routes through the twinkling applier only after Choose, then confirms',
    async (option) => {
      openChooser();
      await chooserOpen();

      const choose = screen.getByRole('button', { name: 'Choose' });
      expect(choose).toBeDisabled();

      fireEvent.click(optionButton(option));
      // Selecting alone must not apply — the grid's single-application lane awaits Choose.
      expect(applyTwinkling).not.toHaveBeenCalled();

      fireEvent.click(choose);

      await waitFor(() => {
        expect(applyTwinkling).toHaveBeenCalledWith(twinklingRow, basePlayerStats, 'test-campaign', option);
      });
      expect(applyStarry).not.toHaveBeenCalled();
      expect(await screen.findByText(`${option} constellation chosen (Twinkling Constellations).`)).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Done' }));
      expect(screen.queryByText('Choose a constellation:')).not.toBeInTheDocument();
    }
  );

  it('closes the chooser on cancel without applying or mutating runtime state', async () => {
    openChooser();
    await chooserOpen();

    // Select first — a cancel after selecting must still stay fully inert.
    fireEvent.click(optionButton('Dragon'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Choose a constellation:')).not.toBeInTheDocument();
    });
    expect(applyTwinkling).not.toHaveBeenCalled();
    expect(applyStarry).not.toHaveBeenCalled();
    expect(executeHandler).toHaveBeenCalledTimes(1);
    expect(Object.keys(mockRuntimeStore)).toHaveLength(0);
  });

  it('shows the lv<10 refusal popup without opening the chooser', async () => {
    executeHandler.mockResolvedValue({
      type: 'popup',
      payload: {
        type: 'automation_info',
        name: 'Twinkling Constellations',
        description: 'Twinkling Constellations requires level 10.',
      },
    });

    openChooser();

    await waitFor(() => {
      expect(capturedPopup).toContain('requires level 10');
    });
    expect(capturedPopup).toContain('Twinkling Constellations');
    expect(screen.queryByText('Choose a constellation:')).not.toBeInTheDocument();
    expect(applyTwinkling).not.toHaveBeenCalled();
  });
});
