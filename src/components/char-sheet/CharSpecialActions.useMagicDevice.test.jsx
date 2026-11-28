// @maintained-by-ai 2026-11-27
// CLA-374 regression: the Special Actions "Use Magic Device:" row must be
// clickable and dispatch through executeHandler to handleUseMagicDevice,
// surfacing the activation/deactivation clause popup (previously the row was
// an inert <b className=""> with zero popup/log/state — pitfall 42l family).
// Clickability is pinned behaviourally: if the row goes inert again the click
// never dispatches and every case here fails.
// Popup fixtures are the VERBATIM real returns of
// services/automation/handlers/class-fighter-rogue/useMagicDeviceHandler.js
// (full clause copy + automation_info payload incl. the `automation` field),
// and the sheet must render them through buildAutomationPopupHtml with exact
// #1912-style full-string toBe — not fragment toContain.
// - Base mocks come from the shared CharSpecialActions.modalMocks.jsx family
//   module (its interactiveTypes mirrors the real service, CLA-374 entry included).
// Not this lane: handler internals (useMagicDeviceHandler.test.js), real
// INTERACTIVE_HANDLER_TYPES membership (automationService.interactive.
// useMagicDevice.test.js), choice-modal dispatch (featureChoice.test.jsx),
// executeHandler modal dispatch (modals.test.jsx), and the assertCanAct
// gate internals — CharActions/CharBonusActions plus this lane pin the
// CANNOT_ACT_REASON popup per bucket; here only the sheet row's zero-dispatch
// denial is checked (RB-1115).
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Shared family mocks must load BEFORE the component so its imports are mocked.
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { setRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { CANNOT_ACT_REASON } from '../../services/combat/canTakeAction.js';

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

// Real activation return of handleUseMagicDevice when the buff is NOT yet on
// activeBuffs (useMagicDeviceHandler.js): full clause copy built from the
// fixture's attunementLimit 4 / chargeReroll 1d6 / success 6.
const ACTIVATION_DESCRIPTION =
  'Use Magic Device activated. Attune to up to 4 magic items. Charges: roll 1d6, on 6 use without expending. Scrolls: Intelligence as spellcasting ability. Cantrips/Level 1 cast reliably. Higher levels: Arcana check DC 10 + spell level; on fail, scroll disintegrates.';

function activationResult() {
  return {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Use Magic Device',
      automationType: 'use_magic_device',
      description: ACTIVATION_DESCRIPTION,
      automation: useMagicDeviceRow.automation,
    },
  };
}

// Real deactivation return (buff already active — the toggle-off click).
const DEACTIVATION_DESCRIPTION =
  'Use Magic Device ended. Attunement limit returns to normal.';

function deactivationResult() {
  return {
    type: 'popup',
    payload: {
      type: 'automation_info',
      name: 'Use Magic Device',
      automationType: 'use_magic_device',
      description: DEACTIVATION_DESCRIPTION,
      automation: useMagicDeviceRow.automation,
    },
  };
}

describe('CharSpecialActions - Use Magic Device row (CLA-374)', () => {
  let capturedPopup = null;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedPopup = null;
    Object.keys(mockRuntimeStore).forEach(k => delete mockRuntimeStore[k]);
    // Re-baseline every overridable stub (clearAllMocks keeps return values).
    vi.mocked(useDiceRollPopup).mockReturnValue({
      setPopupHtml: (html) => { capturedPopup = html; },
    });
    executeHandler.mockResolvedValue(activationResult());
  });

  it('renders the row with its description and dispatches the full handler signature on click', () => {
    render(<CharSpecialActions playerStats={playerStats} campaignName="test-campaign" />);

    expect(screen.getByText('Attune to up to 4 magic items at once.')).toBeInTheDocument();

    fireEvent.click(rowLabel());

    // mapName/characters are undefined here — arity pin for the grid lane.
    expect(executeHandler).toHaveBeenCalledTimes(1);
    expect(executeHandler).toHaveBeenCalledWith(useMagicDeviceRow, playerStats, 'test-campaign', undefined, undefined);
  });

  it.each([
    ['activation', activationResult, ACTIVATION_DESCRIPTION],
    ['deactivation', deactivationResult, DEACTIVATION_DESCRIPTION],
  ])('click shows the exact %s clause popup via the grid lane, with zero sheet-side writes or logs', async (_case, result, description) => {
    executeHandler.mockResolvedValue(result());

    render(<CharSpecialActions playerStats={playerStats} campaignName="test-campaign" />);
    fireEvent.click(rowLabel());

    // Exact full dismissable-popup HTML built from the payload (buildAutomationPopupHtml).
    const expectedHtml =
      `<b>Use Magic Device</b><br/>${description}<br/><span class="dice-roll-hint">click to dismiss</span>`;
    await waitFor(() => expect(capturedPopup).toBe(expectedHtml));
    // The row lane is popup-only: the sheet itself spends and logs nothing —
    // the mocked handler owns the activeBuffs write and the log row.
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(mockRuntimeStore).toEqual({});
  });

  it('blocks the row when cannotAct but pops the shared reason — no dispatch, no runtime writes, no log (RB-1115)', () => {
    render(<CharSpecialActions playerStats={playerStats} campaignName="test-campaign" cannotAct />);

    fireEvent.click(rowLabel());

    // assertCanAct denial fires synchronously before the first await.
    expect(executeHandler).not.toHaveBeenCalled();
    // RB-1115: the silent-gate press routes through the assertCanAct popup lane
    // with the canTakeAction copy (UI-only feedback, zero audit rows).
    expect(capturedPopup).toBe(CANNOT_ACT_REASON);
    expect(setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(mockRuntimeStore).toEqual({});
  });
});
