// @maintained-by-ai 2026-11-27 — CLA-211 Leading Evasion: trigger gate, stamp/skip/Apply flow, share survive-and-consume
// CLA-211 — Leading Evasion chooser TRIGGER + MODAL side of the contract:
//   1. Trigger gate (hasShareableEvasionFor): a chooser session opens only
//      for a half-damage (dcSuccess 'half') save when a shareable holder
//      OTHER than the target exists. Full-damage saves and mismatched-save-
//      type prompts never ask; the holder's own save folds own Evasion with
//      no chooser and no stamp.
//   2. Confirming stamps ONLY the ticked prompt/target pairs (queue-filtered,
//      once per event) and logs the share with the exact copy.
//   3. The stamp survives the local `save-result` dispatch (adjudication
//      lanes read it there) and is consumed immediately after.
//   4. A ticked ally's save dispatches evasionActive:true; an unselected
//      ally in the SAME chooser session dispatches evasionActive:false.
//   5. Skip grants nobody: exact declined log, no stamp, evasionActive:false.
//
// Not owned here — do not re-add:
// - Apply(0) gating, Done payloads, hold-until-Done, rolled Next Save
//   advancement ................................. .actions.test.jsx (#1935)
// - chooser row tick/untick UX, Apply-count copy, overlay modal inertness,
//   confirm-closes-chooser-leaves-save-PENDING, external-clear/dismiss
//   advancement .................................. .coverage.test.jsx
// - Evasion NOTE display branches (shared/own/incapacitated, cross-prompt
//   stamp inertness) ............... .evasion-note-selection.test.jsx
// - adjudication-lane folding via isLeadingEvasionSelected
//   (saveProcessing.cla211-leading-evasion.test.js, evasionUtils.test.js)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { addEntry } from '../../services/ui/logService.js';
import { stampLeadingEvasionSelections, clearLeadingEvasionSelection } from '../../services/rules/combat/evasionUtils.js';
import { setupDefaults, cleanupDefaults, createCharacter } from './SavePromptModal.test-utils.jsx';

vi.mock('../../services/ui/utils.js', () => ({
  default: { getName: (name) => name || 'Unknown' },
}));

vi.mock('../../services/dice/diceRoller.js', () => ({
  rollD20: vi.fn(),
  rollExpression: vi.fn(),
}));

// sendSavePrompt is a real graph import (savePrompt.js → this module); it must
// exist on the mock or its access throws, even though this lane never sends.
vi.mock('../../services/combat/conditions/savePromptService.js', () => ({
  sendSavePrompt: vi.fn(),
  sendSaveResult: vi.fn(),
  clearSavePrompt: vi.fn(),
}));

vi.mock('../../services/combat/auras/auraOfProtection.js', () => ({
  computeAuraBonus: vi.fn(async () => ({ bonus: 0, sourceName: null })),
}));

vi.mock('../../services/combat/conditions/conditionUtils.js', () => ({
  getAbilitySaveBonus: vi.fn(() => 3),
}));

// Keys mirror the graph's actual imports: getStore (applyDamage.js),
// deleteRuntimeKey (savePrompt.js), setRuntimeObject + getAllStoreKeys
// (applyDamage.js / expirationQueue.js / infernalWoundService.js).
vi.mock('../../hooks/runtime/useRuntimeState.js', () => ({
  useRuntimeValue: vi.fn(() => null),
  getStore: vi.fn(() => new Map()),
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(),
  deleteRuntimeKey: vi.fn(),
  setRuntimeObject: vi.fn(),
  getAllStoreKeys: vi.fn(() => []),
}));

vi.mock('../../services/encounters/combatData.js', () => ({
  getCombatSummary: vi.fn(),
}));

vi.mock('../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../services/ui/storage.js', () => ({
  default: { set: vi.fn(() => Promise.resolve()), get: vi.fn(() => Promise.resolve(null)) },
}));

vi.mock('../../services/automation/handlers/buffs/circleOfPowerHandler.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, isCircleOfPowerActive: vi.fn(() => false) };
});

vi.mock('../../services/rules/combat/evasionUtils.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    stampLeadingEvasionSelections: vi.fn(),
    clearLeadingEvasionSelection: vi.fn(),
  };
});

// Test-event feeder: one button per scenario, each delivering a DEX DC 16
// save prompt (Lightning Breath) through the real handleEvent, campaign-
// scoped as production SSE delivers them. The first three are dcSuccess
// 'half' (chooser-eligible); 'plain' omits dcSuccess (full damage) and
// 'wis' is a mismatched-ability half save — both trigger-gate negatives.
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const trigger = (testId, targetName, promptId, { saveType = 'DEX', dcSuccess } = {}) => {
      const data = { promptId, targetName, saveType, saveDc: 16, disadvantage: false, sourceName: 'Lightning Breath' };
      if (dcSuccess) data.dcSuccess = dcSuccess;
      return (
        <button
          data-testid={`trigger-${testId}`}
          aria-label={`prompt ${targetName}`}
          onClick={() => handleEvent({
            key: `change-${campaignName}-savePrompt-${targetName}`,
            data,
          })}
        >
          {targetName}
        </button>
      );
    };
    return (
      <div data-testid="subscriber">
        {trigger('hex', 'HexWarlock', 'p-hex', { dcSuccess: 'half' })}
        {trigger('pal', 'ElderPaladin', 'p-pal', { dcSuccess: 'half' })}
        {trigger('bard', 'Bard', 'p-bard', { dcSuccess: 'half' })}
        {trigger('plain', 'ElderPaladin', 'p-plain')}
        {trigger('wis', 'HexWarlock', 'p-wis', { saveType: 'WIS', dcSuccess: 'half' })}
      </div>
    );
  }
  return { default: MockSubscriber };
});

// Bard holds the shareable DEX evasion; HexWarlock and ElderPaladin are
// plain sharees.
const BARD = createCharacter('Bard', [], [{ saveType: 'DEX', shareable: true, shareRange: 5 }]);
const HEX = createCharacter('HexWarlock');
const PAL = createCharacter('ElderPaladin');

function renderModal() {
  return render(<SavePromptModal campaignName="test-campaign" characters={[BARD, HEX, PAL]} activeMapName={null} />);
}

async function openChooser(testId) {
  fireEvent.click(screen.getByTestId(`trigger-${testId}`));
  await waitFor(() => {
    expect(screen.getByText(/Leading Evasion — Choose Allies/i)).toBeInTheDocument();
  });
}

// Ticks the named creature's row inside the chooser overlay (the label owns
// the toggle — the checkbox is readOnly), verifying the tick registered.
function tickAlly(name) {
  const row = Array.from(document.querySelectorAll('.sp-overlay--evasion .secondary-target-row'))
    .find(r => r.textContent.includes(name));
  expect(row, `chooser row for ${name}`).toBeTruthy();
  fireEvent.click(row);
  expect(within(row).getByRole('checkbox')).toBeChecked();
}

async function rollAndWaitForFailure() {
  // Deterministic failure: rollD20→10 + saveBonus 3 vs DC 16.
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await waitFor(() => {
    expect(screen.getByText(/SAVE FAILURE/i)).toBeInTheDocument();
  });
}

// In a multi-prompt queue the submit button is labelled 'Next Save'.
function clickSubmit() {
  const button = screen.queryByRole('button', { name: 'Next Save' }) || screen.getByRole('button', { name: 'Done' });
  fireEvent.click(button);
}

describe('SavePromptModal — CLA-211 Leading Evasion chooser', () => {
  let dispatched = [];
  // Stamp-state captured AT dispatch time: the CLA-211 invariant is that the
  // runtime stamp is still present when `save-result` fires (adjudication
  // lanes read it synchronously) and pruned only afterwards.
  let clearCallsAtDispatch = [];

  const onSaveResult = (event) => {
    dispatched.push(event.detail);
    clearCallsAtDispatch.push(clearLeadingEvasionSelection.mock.calls.length);
  };

  beforeEach(() => {
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
    rollD20.mockReturnValue(10);
    dispatched = [];
    clearCallsAtDispatch = [];
    window.addEventListener('save-result', onSaveResult);
  });
  afterEach(() => {
    window.removeEventListener('save-result', onSaveResult);
    cleanupDefaults();
  });

  it('confirming ticks stamps only the ticked prompt/target pair, logs the exact share copy, and the stamp survives the save-result dispatch', async () => {
    renderModal();
    await openChooser('hex');

    tickAlly('HexWarlock');
    fireEvent.click(screen.getByRole('button', { name: /Apply Evasion \(1\)/i }));

    // Once per confirm event; queue-filtered to exactly the ticked pair.
    expect(stampLeadingEvasionSelections).toHaveBeenCalledTimes(1);
    expect(stampLeadingEvasionSelections).toHaveBeenCalledWith('test-campaign', [['p-hex', ['HexWarlock']]]);
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'automation',
      automationType: 'leading_evasion_shared',
      characterName: 'HexWarlock',
      description: 'Leading Evasion shared with HexWarlock — DC 16 DEX save (Lightning Breath). Selected allies take half damage on a failed save and no damage on a successful save.',
    }));
    await waitFor(() => {
      expect(screen.queryByText(/Leading Evasion — Choose Allies/i)).not.toBeInTheDocument();
    });

    await rollAndWaitForFailure();
    clickSubmit();

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual(expect.objectContaining({
      promptId: 'p-hex',
      targetName: 'HexWarlock',
      saveType: 'DEX',
      saveDc: 16,
      dcSuccess: 'half',
      success: false,
      evasionActive: true,
    }));
    // Stamp consumed only AFTER adjudication dispatch.
    expect(clearCallsAtDispatch).toEqual([0]);
    expect(clearLeadingEvasionSelection).toHaveBeenCalledWith('test-campaign', 'p-hex');
  });

  it('queues two sharees in one chooser session: ticked ally folds, unselected ally pays full', async () => {
    renderModal();

    // ElderPaladin's prompt opens the chooser; HexWarlock joins the same
    // session from the queue, so both rows appear together.
    await openChooser('pal');
    fireEvent.click(screen.getByTestId('trigger-hex'));
    expect(screen.getByText(/Leading Evasion — Choose Allies/i)).toBeInTheDocument();
    const rows = document.querySelectorAll('.sp-overlay--evasion .secondary-target-row');
    expect(rows).toHaveLength(2);

    tickAlly('HexWarlock');
    fireEvent.click(screen.getByRole('button', { name: /Apply Evasion \(1\)/i }));

    // The stamp omits the unticked prompt entirely — presence of a shareable
    // holder alone must not fold every pending target.
    expect(stampLeadingEvasionSelections).toHaveBeenCalledTimes(1);
    expect(stampLeadingEvasionSelections).toHaveBeenCalledWith('test-campaign', [['p-hex', ['HexWarlock']]]);

    // Unselected control: ElderPaladin rolls first and pays full.
    await rollAndWaitForFailure();
    clickSubmit();
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual(expect.objectContaining({
      promptId: 'p-pal',
      targetName: 'ElderPaladin',
      evasionActive: false,
    }));

    // Each queued prompt gets its own chooser session; tick HexWarlock again
    // (selection is per-session) and confirm its save folds.
    await waitFor(() => {
      expect(screen.getByText(/Leading Evasion — Choose Allies/i)).toBeInTheDocument();
    });
    tickAlly('HexWarlock');
    fireEvent.click(screen.getByRole('button', { name: /Apply Evasion \(1\)/i }));

    await rollAndWaitForFailure();
    clickSubmit();

    expect(dispatched).toHaveLength(2);
    expect(dispatched[1]).toEqual(expect.objectContaining({
      promptId: 'p-hex',
      targetName: 'HexWarlock',
      evasionActive: true,
    }));
    // Both stamps consumed after their respective dispatches.
    expect(clearLeadingEvasionSelection).toHaveBeenCalledWith('test-campaign', 'p-pal');
    expect(clearLeadingEvasionSelection).toHaveBeenCalledWith('test-campaign', 'p-hex');
  });

  it('Skip declines the share for everyone: no stamp, exact declined log, the save pays full', async () => {
    renderModal();
    await openChooser('pal');

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    expect(stampLeadingEvasionSelections).not.toHaveBeenCalled();
    expect(addEntry).toHaveBeenCalledWith('test-campaign', expect.objectContaining({
      type: 'automation',
      automationType: 'leading_evasion_declined',
      characterName: 'ElderPaladin',
      description: 'Leading Evasion share declined for DC 16 DEX save (Lightning Breath) — no allies selected; every unselected target pays normal save damage.',
    }));
    await waitFor(() => {
      expect(screen.queryByText(/Leading Evasion — Choose Allies/i)).not.toBeInTheDocument();
    });

    await rollAndWaitForFailure();
    clickSubmit();

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual(expect.objectContaining({
      promptId: 'p-pal',
      targetName: 'ElderPaladin',
      evasionActive: false,
    }));
  });

  it('the holder itself folds own Evasion with no chooser session and no stamp', async () => {
    renderModal();
    // Self-exclusion leg of the trigger: the only shareable holder IS the
    // target, so the roster scan finds nobody else and never asks.
    fireEvent.click(screen.getByTestId('trigger-bard'));
    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Leading Evasion — Choose Allies/i)).not.toBeInTheDocument();

    await rollAndWaitForFailure();
    clickSubmit();

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual(expect.objectContaining({
      promptId: 'p-bard',
      targetName: 'Bard',
      saveType: 'DEX',
      dcSuccess: 'half',
      success: false,
      evasionActive: true,
    }));
    expect(stampLeadingEvasionSelections).not.toHaveBeenCalled();
  });

  it('the trigger gate holds: a full-damage save and a mismatched-save-type save never open the chooser', async () => {
    renderModal();

    // Leg 1: dcSuccess !== 'half' short-circuits hasShareableEvasionFor even
    // though Bard holds a shareable DEX evasion.
    fireEvent.click(screen.getByTestId('trigger-plain'));
    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Leading Evasion — Choose Allies/i)).not.toBeInTheDocument();

    await rollAndWaitForFailure();
    clickSubmit();

    // Leg 2: a half save of the WRONG ability — the holder's DEX-only
    // shareable evasion does not match a WIS prompt.
    fireEvent.click(screen.getByTestId('trigger-wis'));
    await waitFor(() => {
      expect(screen.getByText(/must make a/i)).toBeInTheDocument();
    });
    expect(screen.queryByText(/Leading Evasion — Choose Allies/i)).not.toBeInTheDocument();

    await rollAndWaitForFailure();
    clickSubmit();

    expect(stampLeadingEvasionSelections).not.toHaveBeenCalled();
    expect(dispatched).toHaveLength(2);
    expect(dispatched[0]).toEqual(expect.objectContaining({
      promptId: 'p-plain',
      targetName: 'ElderPaladin',
      saveType: 'DEX',
      dcSuccess: undefined,
      evasionActive: false,
    }));
    expect(dispatched[1]).toEqual(expect.objectContaining({
      promptId: 'p-wis',
      targetName: 'HexWarlock',
      saveType: 'WIS',
      dcSuccess: 'half',
      evasionActive: false,
    }));
  });
});
