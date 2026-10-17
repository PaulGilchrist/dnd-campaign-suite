// @maintained-by-ai
// CLA-374 regression: the Special Actions "Use Magic Device:" row must be
// clickable and dispatch through executeHandler to handleUseMagicDevice,
// surfacing the activation/deactivation clause popup (previously the row was
// an inert <b className=""> with zero popup/log/state — pitfall 42l family).
// Clickability is pinned behaviourally: if the row goes inert again the click
// never dispatches and every case here fails. Real INTERACTIVE_HANDLER_TYPES
// membership is pinned by the service-level regression
// (services/combat/automation/automationService.interactive.useMagicDevice.test.js).
// - Base mocks come from the shared CharSpecialActions.modalMocks.jsx family
//   module (its interactiveTypes mirrors the real service, CLA-374 entry included).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Shared family mocks must load BEFORE the component so its imports are mocked.
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';

const basePlayerStats = {
  name: 'AasimarTest',
  level: 20,
  rules: '2024',
  specialActions: [],
  class: { fightingStyles: [] },
  actions: [],
  bonusActions: [],
  reactions: [],
  characterAdvancement: [],
  proficiency: 6,
};

const useMagicDeviceRow = {
  name: 'Use Magic Device',
  description: 'Attune to up to 4 magic items at once.',
  automation: {
    type: 'use_magic_device',
    attunementLimit: 4,
    chargeReroll: '1d6',
    chargeRerollSuccess: 6,
    scrollAbility: 'INT',
    scrollCheckDC: '10 + spell_level',
    scrollDisintegratesOnFail: true,
    casting_time: 'passive',
    hasAutomation: true,
  },
};

const playerStats = { ...basePlayerStats, specialActions: [useMagicDeviceRow] };

const rowLabel = () => screen.getByText('Use Magic Device:');

function activationPopup() {
  return {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Use Magic Device',
      automationType: 'use_magic_device',
      description: 'Use Magic Device activated. Attune to up to 4 magic items.',
    },
  };
}

function deactivationPopup() {
  return {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Use Magic Device',
      automationType: 'use_magic_device',
      description: 'Use Magic Device ended. Attunement limit returns to normal.',
    },
  };
}

describe('CharSpecialActions - Use Magic Device row (CLA-374)', () => {
  let capturedPopup = null;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedPopup = null;
    Object.keys(mockRuntimeStore).forEach(k => delete mockRuntimeStore[k]);
    // Capture popup writes (shared modalMocks default is an inert vi.fn setter).
    vi.mocked(useDiceRollPopup).mockReturnValue({
      setPopupHtml: (html) => { capturedPopup = html; },
    });
    executeHandler.mockResolvedValue(activationPopup());
  });

  it('renders the row with its description and dispatches executeHandler on click', async () => {
    render(<CharSpecialActions playerStats={playerStats} campaignName="test-campaign" />);

    expect(screen.getByText('Attune to up to 4 magic items at once.')).toBeInTheDocument();

    fireEvent.click(rowLabel());

    await waitFor(() => {
      expect(executeHandler).toHaveBeenCalledWith(useMagicDeviceRow, playerStats, 'test-campaign', undefined, undefined);
    });
  });

  it.each([
    ['activation', activationPopup, 'activated. Attune to up to 4 magic items'],
    ['deactivation', deactivationPopup, 'ended. Attunement limit returns to normal'],
  ])('click shows the %s clause popup via the grid lane', async (_case, popup, expectedText) => {
    executeHandler.mockResolvedValue(popup());

    render(<CharSpecialActions playerStats={playerStats} campaignName="test-campaign" />);
    fireEvent.click(rowLabel());

    await waitFor(() => {
      expect(capturedPopup).toContain(expectedText);
    });
    expect(capturedPopup).toContain('Use Magic Device');
    expect(capturedPopup).toContain('click to dismiss');
    // The row lane is popup-only: nothing else in the grid fires.
    expect(mockRuntimeStore).toEqual({});
  });

  it('stays inert when cannotAct: no dispatch, no popup, no runtime writes', async () => {
    render(<CharSpecialActions playerStats={playerStats} campaignName="test-campaign" cannotAct />);

    fireEvent.click(rowLabel());
    await waitFor(() => expect(screen.getByText('Use Magic Device:')).toBeInTheDocument());

    expect(executeHandler).not.toHaveBeenCalled();
    expect(capturedPopup).toBeNull();
    expect(mockRuntimeStore).toEqual({});
  });
});
