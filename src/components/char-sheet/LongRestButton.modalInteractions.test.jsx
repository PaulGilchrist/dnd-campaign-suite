// @maintained-by-ai
/**
 * LongRestButton.modalInteractions.test.jsx — owns the POST-MODAL lane.
 *
 * Lane ownership for LongRestButton tests:
 *  - LongRestButton.clickHandlers.test.jsx: click dispatch through handleLongRest
 *    and the modal props at the seam — including deferral of onLongRest while the
 *    modal is open and the note/targets content passed into the modal.
 *  - This file: everything AFTER the Celestial Resilience modal opens — confirm
 *    writes temp HP to the runtime store for exactly the selected allies (using
 *    allyTempHp from the rules payload), skip is inert to the runtime store, and
 *    both paths log the full ability_use entry, close the modal, and complete the
 *    rest with a single zero-arg onLongRest call.
 *  - LongRestButton.rendering.test.jsx: DOM contract (button text, title, trance
 *    suffix).
 *
 * The modal stub mirrors the real CreatureSelectionModal contract: checkboxes
 * toggle the selection, Confirm reports the selected names in click order and is
 * disabled until one is selected, Skip delegates straight to onSkip. There is no
 * close-on-overlay-click in the real modal, so that path is neither stubbed nor
 * asserted here.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import LongRestButton from './LongRestButton.jsx';

// ── Mocks ──

vi.mock('../../services/rules/effects/tranceRules.js', () => ({
  hasTranceTrait: vi.fn(() => false),
}));

vi.mock('../../services/rules/effects/restRules.js', () => ({
  applyLongRest: vi.fn(),
}));

vi.mock('../../services/automation/handlers/buffs/tempHpService.js', () => ({
  setTempHp: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

// Faithful stub of the CreatureSelectionModal interaction contract (see header).
vi.mock('./modals/shared/CreatureSelectionModal.jsx', async () => {
  const { useState } = await vi.importActual('react');
  return {
    default: function MockCreatureSelectionModal({ targets, confirmLabel, onConfirm, onSkip }) {
      const [selected, setSelected] = useState([]);
      const toggle = (name) =>
        setSelected((prev) =>
          prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]);
      return (
        <div data-testid="creature-selection-modal" className="sp-modal">
          {targets.map((target) => (
            <label key={target.name}>
              {target.name}
              <input
                type="checkbox"
                checked={selected.includes(target.name)}
                onChange={() => toggle(target.name)}
              />
            </label>
          ))}
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={() => onConfirm(selected)}
          >
            {`${confirmLabel} (${selected.length})`}
          </button>
          <button type="button" onClick={onSkip}>Skip</button>
        </div>
      );
    },
  };
});

// ── Re-import mocks ──

import * as restRules from '../../services/rules/effects/restRules.js';
import * as tempHpService from '../../services/automation/handlers/buffs/tempHpService.js';
import * as logService from '../../services/ui/logService.js';

// ── Fixtures ──

const basePlayerStats = {
  name: 'TestCharacter',
  level: 5,
  hitPoints: 45,
  class: { name: 'Cleric' },
};

const mockCampaignName = 'test-campaign';

// Deterministic wall clock for the log timestamp — the component only reads
// Date.now(), so a fixed stub gives exact-arg log assertions (no fake timers).
const FIXED_TIMESTAMP = Date.UTC(2026, 9, 17, 12, 0, 0);

const celestialData = {
  creatureTargets: [
    { name: 'Ally1', type: 'player' },
    { name: 'Ally2', type: 'npc' },
    { name: 'Ally3', type: 'player' },
  ],
  allyTempHp: 10,
  selfTempHp: 5,
  maxTargets: 5,
};

const DECISIONS = [
  {
    decision: 'confirm',
    // Deliberate subset in click order: proves runtime-store writes are per
    // selected ally, use allyTempHp (not selfTempHp), leave Ally2 inert, and
    // the log joins names in selection order.
    selected: ['Ally1', 'Ally3'],
    expectedTempHpWrites: [
      ['Ally1', 10, mockCampaignName],
      ['Ally3', 10, mockCampaignName],
    ],
    expectedLogDescription: 'TestCharacter grants 10 temporary hit points to Ally1, Ally3.',
  },
  {
    decision: 'skip',
    selected: [],
    // Skipping must touch the runtime store (or grant self temp HP here) not at all.
    expectedTempHpWrites: [],
    expectedLogDescription: 'TestCharacter skipped ally selection for Celestial Resilience (long rest).',
  },
];

// ── Helpers ──

async function renderAndOpenModal(onLongRest) {
  render(
    <LongRestButton
      playerStats={basePlayerStats}
      campaignName={mockCampaignName}
      onLongRest={onLongRest}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: /Long Rest/ }));
  // The modal opens only after applyLongRest resolves.
  await screen.findByTestId('creature-selection-modal');
}

async function decide({ decision, selected }) {
  for (const name of selected) {
    fireEvent.click(screen.getByRole('checkbox', { name }));
  }
  const decisionButton = decision === 'confirm'
    ? screen.getByRole('button', { name: /Grant Resilience/ })
    : screen.getByRole('button', { name: 'Skip' });
  fireEvent.click(decisionButton);
  await waitFor(() => {
    expect(screen.queryByTestId('creature-selection-modal')).not.toBeInTheDocument();
  });
}

// ── Tests ──

describe.each(DECISIONS)(
  'Celestial Resilience $decision flow',
  ({ decision, selected, expectedTempHpWrites, expectedLogDescription }) => {
    let nowSpy;

    beforeEach(() => {
      vi.clearAllMocks();
      restRules.applyLongRest.mockResolvedValue({ celestialResilienceAllies: celestialData });
      nowSpy = vi.spyOn(Date, 'now').mockReturnValue(FIXED_TIMESTAMP);
    });

    afterEach(() => {
      nowSpy.mockRestore();
    });

    it('writes the expected temp HP to the runtime store and completes the rest once', async () => {
      const onLongRest = vi.fn();
      await renderAndOpenModal(onLongRest);

      await decide({ decision, selected });

      // Exact calls: confirm writes allyTempHp to exactly the selected allies
      // (in selection order); skip writes nothing at all.
      expect(tempHpService.setTempHp.mock.calls).toEqual(expectedTempHpWrites);
      // The rest completes exactly once, with zero arguments, after dismissal.
      expect(onLongRest.mock.calls).toEqual([[]]);
    });

    it('logs exactly one ability_use entry with the full payload', async () => {
      await renderAndOpenModal(vi.fn());

      await decide({ decision, selected });

      await waitFor(() => {
        expect(logService.addEntry.mock.calls).toEqual([[mockCampaignName, {
          type: 'ability_use',
          characterName: basePlayerStats.name,
          abilityName: 'Celestial Resilience',
          description: expectedLogDescription,
          timestamp: FIXED_TIMESTAMP,
        }]]);
      });
    });
  }
);
