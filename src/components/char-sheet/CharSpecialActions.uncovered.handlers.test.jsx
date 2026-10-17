// @maintained-by-ai
// CharSpecialActions uncovered-handler lane — Celestial Resilience.
//
// Family ownership map (do not re-pin here):
// - CharSpecialActions.handlers.test.jsx — confirm-stamping of interactive
//   choice handlers (Aspect of the Wilds etc.) into the runtime store.
// - CharSpecialActions.automationClickHandlers.test.jsx — brew_poison
//   delegated clicks and direct executeHandler popup-result rendering.
// - CharSpecialActions.modalsInline.test.jsx — the CreatureSelectionModal
//   host for Celestial Resilience: open + title/description/note/confirm
//   label, Skip → "No allies selected." popup + close
//   (handleCelestialResilienceSkip), and Confirm with listed targets →
//   setTempHp per ally + ability_use log + "Granted N temporary hit
//   points..." popup (modalsInline.test.jsx selectionHostCases).
// - CharSpecialActions.modals.test.jsx — cannotAct and no-automation guards
//   at the top of handleAutomationClick (shared by every automation row).
//
// Previously removed from this file as family-redundant:
// - "grants temp HP to selected targets..." / "shows popup with single
//   target name" — same host-confirm branch as modalsInline's Celestial
//   case (amounts/target-count differ, no distinct branch in the source).
// - "skipping selects no allies..." — same host-skip branch as
//   modalsInline's Celestial case (skipPopup /No allies selected\./).
// - "cannotAct guard" — the guard is the shared one pinned by
//   modals.test.jsx and modalOnClose.combat.test.jsx; the earlier "no
//   other test verifies this guard" note was stale.
//
// Genuinely uncovered branch owned by this file:
// handleCelestialResilienceConfirm's empty-selection refusal
// (CharSpecialActions.jsx:533-537). A distinct code path from Skip, and
// unreachable elsewhere: modalsInline's confirm case always lists ≥1
// target, the REAL CreatureSelectionModal disables Confirm at zero
// selections, but the family mock fires onConfirm with whatever
// creatureTargets the payload carried — modelling an ally list that
// emptied between opening the modal and confirming it.

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './CharSpecialActions.modalMocks.jsx';
import CharSpecialActions from './CharSpecialActions.jsx';
import { mockRuntimeStore } from './CharSpecialActions.modalMocks.jsx';
import { executeHandler } from '../../services/automation/index.js';
import { useDiceRollPopup } from '../../hooks/combat/DiceRollContext.js';
import { setTempHp } from '../../services/automation/handlers/buffs/tempHpService.js';
import { addEntry } from '../../services/ui/logService.js';

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

// Captures setPopupHtml calls so tests can assert popup content.
function capturePopup() {
  const captured = { html: null };
  vi.mocked(useDiceRollPopup).mockReturnValue({
    setPopupHtml: (html) => { captured.html = html; },
  });
  return captured;
}

describe('CharSpecialActions - Celestial Resilience empty-selection confirm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(mockRuntimeStore).forEach(k => delete mockRuntimeStore[k]);
  });

  it('refuses a confirm whose ally list emptied after open: refusal popup, modal closed, no state touched', async () => {
    const popup = capturePopup();

    executeHandler.mockResolvedValue({
      type: 'modal',
      modalName: 'celestialResilienceModal',
      payload: {
        action: { name: 'Celestial Resilience' },
        playerStats: basePlayerStats,
        campaignName: 'test',
        // The ally roster vanished between opening the chooser and clicking
        // Confirm — the guard must refuse instead of granting 0-target buffs.
        creatureTargets: [],
        maxTargets: 5,
        selfTempHp: 5,
        allyTempHp: 3,
      },
    });

    const playerStats = createPlayerStats({
      specialActions: [
        { name: 'Celestial Resilience', description: 'Gain temp HP and grant to allies.', automation: { type: 'generic' } },
      ],
    });

    render(<CharSpecialActions playerStats={playerStats} campaignName="test" />);

    fireEvent.click(screen.getByText('Celestial Resilience:'));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Grant Resilience' })).toBeInTheDocument();
    });

    // The family modal mock confirms with targets.map(name) → [] here.
    fireEvent.click(screen.getByRole('button', { name: 'Grant Resilience' }));

    // Refusal popup names the feature and states the refusal...
    await waitFor(() => {
      expect(popup.html).toMatch(/Celestial Resilience/);
    });
    expect(popup.html).toMatch(/No allies selected\./);
    // ...and closes the chooser (the guard cleared its modal state).
    await waitFor(() => {
      expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
    });
    // Zero targets means zero side effects: no temp HP, no log, inert store.
    expect(setTempHp).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(Object.keys(mockRuntimeStore)).toHaveLength(0);
  });
});
