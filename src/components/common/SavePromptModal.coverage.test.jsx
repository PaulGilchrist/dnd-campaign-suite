// @improved-by-ai
// SavePromptModal — Leading Evasion chooser row UX & prompt queue advancement.
//
// Owns the contracts sibling files point at (see .cla211-leading-evasion header):
//   1. Chooser rows tick/untick on click with the live Apply count, and the
//      overlay is modal — backdrop and inside-modal clicks neither dismiss nor
//      submit, and leave the chooser fully usable.
//   2. Confirming closes the chooser and leaves the save PENDING — the chooser
//      records the share only; it never submits or clears the save itself.
//   3. Queue advancement for the two unresolved lanes: an externally cleared
//      prompt (savePromptCleared SSE) and a dismissed unrolled prompt both
//      reveal the second save without fabricating a result submission.
//
// Not re-tested here: chooser presentation/Apply-0 gating and rolled Next Save
// advancement (.actions), stamping/skip/dispatch detail (.cla211-leading-evasion),
// roll math (.rolling/.bonuses), single-prompt cleared removal (.actions).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults, createCharacter } from './SavePromptModal.test-utils.jsx';
import * as savePromptService from '../../services/combat/conditions/savePromptService.js';

// ── Mocks ──

vi.mock('../../services/ui/utils.js', () => ({
  default: { getName: (name) => name || 'Unknown' },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  getStore: vi.fn(() => new Map()),
  useSyncedState: vi.fn(() => [null, vi.fn()]),
  listeners: new Map(),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: {
    set: vi.fn(() => Promise.resolve()),
    get: vi.fn(() => Promise.resolve(null)),
  },
}));

vi.mock('../../hooks/useAllySelection.js', () => ({
  getAllyList: vi.fn(() => []),
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isCircleOfPowerActive: vi.fn(() => false) };
});

// Test-event feeder: campaign-scoped SSE-shaped events through the real
// handleEvent, as production Subscriber delivers them. Only the events this
// file's scenarios consume.
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const promptEvent = (testId, data) => (
      <button
        data-testid={testId}
        onClick={() => handleEvent({ key: `change-${campaignName}-savePrompt-${data.targetName}`, data })}
      />
    );
    return (
      <div data-testid="subscriber">
        {promptEvent('subscriber-trigger', {
          promptId: 'test-prompt-1', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false,
        })}
        {promptEvent('subscriber-trigger-second', {
          promptId: 'test-prompt-2', targetName: 'testTarget2', saveType: 'dex', saveDc: 15, disadvantage: true, dcSuccess: 'half',
        })}
        <button
          data-testid="subscriber-trigger-cleared"
          onClick={() => handleEvent({
            key: `change-${campaignName}-savePromptCleared-testTarget`,
            data: { promptId: 'test-prompt-1' },
          })}
        />
      </div>
    );
  }
  return { default: MockSubscriber };
});

// ── Fixtures & helpers ──

// Paladin holds the shareable DEX evasion that triggers the chooser for the
// second prompt (DEX save, dcSuccess 'half', target is not the holder).
const PALADIN = createCharacter('Paladin', [], [{ saveType: 'DEX', shareable: true, shareRange: 10 }]);

function renderModal(props = {}) {
  return render(
    <SavePromptModal campaignName="test-campaign" characters={[]} activeMapName={null} {...props} />
  );
}

// Queues the sharee's DEX DC 15 half-damage save and waits for the chooser.
async function openChooser() {
  fireEvent.click(screen.getByTestId('subscriber-trigger-second'));
  await waitFor(() => {
    expect(screen.getByText(/Leading Evasion — Choose Allies/)).toBeInTheDocument();
  });
}

// Hard-failing element fetches: a vanished selector must fail the test,
// never silently skip the interaction it guards.
function evasionOverlay() {
  const overlay = document.querySelector('.sp-overlay--evasion');
  expect(overlay, 'evasion overlay').toBeTruthy();
  return overlay;
}

function chooserRow() {
  const row = document.querySelector('.sp-overlay--evasion .secondary-target-row');
  expect(row, 'chooser row').toBeTruthy();
  return row;
}

describe('SavePromptModal — Leading Evasion chooser UX & queue advancement', () => {
  beforeEach(() => setupDefaults(rollD20, computeAuraBonus, getRuntimeValue));
  afterEach(cleanupDefaults);

  // ── Chooser row selection ──

  it('ticks and unticks an ally row on click, updating the Apply Evasion count live', async () => {
    renderModal({ characters: ['testTarget2', PALADIN] });
    await openChooser();

    const row = chooserRow();
    const checkbox = within(row).getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Apply Evasion \(0\)/ })).toBeDisabled();

    // Click the row once: ticked, Apply enabled with the live count.
    fireEvent.click(row);
    expect(checkbox).toBeChecked();
    expect(screen.getByRole('button', { name: /Apply Evasion \(1\)/ })).toBeEnabled();

    // Clicking the already-ticked row unticks it and re-gates Apply.
    fireEvent.click(row);
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole('button', { name: /Apply Evasion \(0\)/ })).toBeDisabled();

    // Deselecting must not dismiss the chooser.
    expect(screen.getByText(/Leading Evasion — Choose Allies/)).toBeInTheDocument();
  });

  // ── Overlay modal-inertness ──

  it('ignores backdrop and inside-modal clicks on the evasion overlay, leaving it fully usable', async () => {
    renderModal({ characters: ['testTarget2', PALADIN] });
    await openChooser();

    const overlay = evasionOverlay();

    // The dimmed backdrop is inert — clicking it keeps the chooser open.
    fireEvent.click(overlay);
    expect(screen.getByText(/Leading Evasion — Choose Allies/)).toBeInTheDocument();

    // A click inside the dialog neither submits nor dismisses.
    const modal = overlay.querySelector('.sp-modal');
    expect(modal, 'evasion dialog').toBeTruthy();
    fireEvent.click(modal);
    expect(screen.getByText(/Leading Evasion — Choose Allies/)).toBeInTheDocument();
    expect(savePromptService.clearSavePrompt).not.toHaveBeenCalled();

    // Control: the chooser survived the stray clicks still functional.
    const row = chooserRow();
    fireEvent.click(row);
    expect(within(row).getByRole('checkbox')).toBeChecked();
    expect(screen.getByRole('button', { name: /Apply Evasion \(1\)/ })).toBeEnabled();
  });

  // ── Confirm leaves the save pending ──

  it('confirming closes the chooser and leaves the save pending, never submitting or clearing it', async () => {
    renderModal({ characters: ['testTarget2', PALADIN] });
    await openChooser();

    fireEvent.click(chooserRow());
    fireEvent.click(screen.getByRole('button', { name: /Apply Evasion \(1\)/ }));

    await waitFor(() => {
      expect(screen.queryByText(/Leading Evasion — Choose Allies/)).not.toBeInTheDocument();
    });

    // The chooser only records the share — the underlying save stays open and
    // unadjudicated: correct prompt copy, Roll Save still available, and no
    // result posted or cleared by the confirmation itself.
    expect(screen.getByText('testTarget2')).toBeInTheDocument();
    expect(screen.getByText('DC 15')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Save' })).toBeInTheDocument();
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
    expect(savePromptService.clearSavePrompt).not.toHaveBeenCalled();
  });

  // ── Queue advancement ──

  it('advances to the second prompt when the first is externally cleared, submitting nothing', async () => {
    renderModal();
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('subscriber-trigger-second'));
    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('subscriber-trigger-cleared'));

    await waitFor(() => {
      expect(screen.getByText('testTarget2')).toBeInTheDocument();
    });
    expect(screen.getByText('DC 15')).toBeInTheDocument();
    expect(screen.getByText('(Disadvantage)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Save' })).toBeInTheDocument();
    // An external clear resolves nothing: no fabricated submission, and the
    // queue indicator drops to the single remaining prompt.
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
    expect(screen.queryByText(/\(\d+ of \d+\)/)).not.toBeInTheDocument();
  });

  it('advances to the second prompt when the first unrolled prompt is dismissed, clearing only the first', async () => {
    renderModal();
    fireEvent.click(screen.getByTestId('subscriber-trigger'));
    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('subscriber-trigger-second'));
    await waitFor(() => {
      expect(screen.getByText(/\(1 of 2\)/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    await waitFor(() => {
      expect(screen.getByText('testTarget2')).toBeInTheDocument();
    });
    expect(screen.getByText('DC 15')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Roll Save' })).toBeInTheDocument();
    // Dismissing the unrolled first prompt server-side clears that target
    // only, and never submits a result for it or the revealed one.
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledWith('test-campaign', 'testTarget');
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
    expect(screen.queryByText(/\(\d+ of \d+\)/)).not.toBeInTheDocument();
  });
});
