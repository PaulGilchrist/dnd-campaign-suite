// @maintained-by-ai 2026-11-27
// SavePromptModal — actions
// Server-first adjudication surface: campaign scoping of prompt events, the
// savePromptCleared channel (exact-promptId eviction, foreign-id retention),
// result submission (held through the roll, posted exactly once on Done with
// the full-shape payload), the local `save-result` dispatch consumers read,
// rolled queue advancement, and the Leading Evasion chooser's Apply(0) gating.
//
// Owned elsewhere — not re-tested here: un-rolled Dismiss clears + bucket drops
// (.dismiss-hygiene), the save-dismissed producer notice (.save-dismissed),
// same-promptId double-delivery dedupe (.duplicate-mount), prompt/result-panel
// copy (.rendering/.rolling), roll math (.rolling/.bonuses/.rerolls), CLA-211
// stamping/skip (.cla211-leading-evasion), chooser row tick UX (.coverage),
// lastAttack persistence (.special-handlers).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import SavePromptModal from './SavePromptModal.jsx';
import { rollD20 } from '../../services/dice/diceRoller.js';
import { computeAuraBonus } from '../../services/combat/auras/auraOfProtection.js';
import { getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';
import { setupDefaults, cleanupDefaults, createCharacter } from './SavePromptModal.test-utils.jsx';
import * as savePromptService from '../../services/combat/conditions/savePromptService.js';

// ── Mocks ──

vi.mock('../../services/ui/utils.js', () => ({
  default: {
    getName: (name) => name || 'Unknown',
  },
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
  return {
    ...actual,
    isCircleOfPowerActive: vi.fn(() => false),
  };
});

// Test-event feeder: each button dispatches one SSE-shaped event through the
// real handleEvent the modal passes down (campaign-scoped keys, as production
// Subscriber delivers them).
vi.mock('./Subscriber.jsx', () => {
  function MockSubscriber({ handleEvent, campaignName }) {
    const trigger = (testId, event) =>
      React.createElement('button', { 'data-testid': testId, onClick: () => handleEvent(event) });
    const promptEvent = (testId, campaign, data) =>
      trigger(testId, { key: `change-${campaign}-savePrompt-${data.targetName}`, data });
    const clearedEvent = (testId, campaign, promptId) =>
      trigger(testId, { key: `change-${campaign}-savePromptCleared-testTarget`, data: { promptId } });
    return React.createElement('div', { 'data-testid': 'subscriber' },
      promptEvent('subscriber-trigger', campaignName, {
        promptId: 'test-prompt-1', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false,
      }),
      promptEvent('subscriber-trigger-second', campaignName, {
        promptId: 'test-prompt-2', targetName: 'testTarget2', saveType: 'dex', saveDc: 15, disadvantage: true, dcSuccess: 'half',
      }),
      promptEvent('subscriber-trigger-other-campaign', 'other-campaign', {
        promptId: 'test-prompt-foreign', targetName: 'testTarget', saveType: 'con', saveDc: 12, disadvantage: false,
      }),
      clearedEvent('subscriber-trigger-cleared', campaignName, 'test-prompt-1'),
      clearedEvent('subscriber-trigger-cleared-other', campaignName, 'a-different-prompt'),
    );
  }
  return { default: MockSubscriber };
});

// ── Helpers ──

function renderModal(props = {}) {
  return render(
    <SavePromptModal campaignName="test-campaign" characters={[]} activeMapName={null} {...props} />
  );
}

// The blessed testid of the ACTIVE prompt (see .active-save-prompt) — its
// presence/absence IS the open/closed face, no copy-regex archaeology.
async function openPrompt(testId = 'subscriber-trigger') {
  fireEvent.click(screen.getByTestId(testId));
  await screen.findByTestId('active-save-prompt');
}

// Every roll in this lane is a success (rollD20→15 vs DC 12), so the result
// panel is the post-roll flush anchor; its copy is owned by .rolling.
async function rollAndWaitForResult() {
  fireEvent.click(screen.getByRole('button', { name: 'Roll Save' }));
  await screen.findByText('SAVE SUCCESS');
}

describe('SavePromptModal — actions', () => {
  // Capture every local save-result dispatch; consumers (damage appliers) read detail.
  let saveResults = [];
  const collectSaveResult = (event) => saveResults.push(event.detail);

  // rollD20 → 15, no bonus sources (empty roster, no combat creature), DC 12.
  const expectedSendPayload = {
    promptId: 'test-prompt-1',
    success: true,
    roll: 15,
    total: 15,
    saveBonus: 0,
    rawRolls: [15, 15],
    mode: 'normal',
    bonusDetail: undefined,
    baneRoll: null,
  };
  const expectedDispatchDetail = {
    promptId: 'test-prompt-1',
    targetName: 'testTarget',
    saveType: 'con',
    saveDc: 12,
    success: true,
    roll: 15,
    total: 15,
    saveBonus: 0,
    bonusDetail: undefined,
    rawDamage: undefined,
    dcSuccess: undefined,
    rawRolls: [15, 15],
    mode: 'normal',
    evasionActive: false,
    baneRoll: null,
  };

  beforeEach(() => {
    saveResults = [];
    window.addEventListener('save-result', collectSaveResult);
    setupDefaults(rollD20, computeAuraBonus, getRuntimeValue);
  });

  afterEach(() => {
    window.removeEventListener('save-result', collectSaveResult);
    cleanupDefaults();
  });

  // ── Queueing & SSE clearing ──

  it('ignores save-prompt events from other campaigns', async () => {
    renderModal();

    fireEvent.click(screen.getByTestId('subscriber-trigger-other-campaign'));

    // handleEvent prefixes on change-<campaign>-savePrompt-: a foreign key
    // never queues, so no overlay mounts.
    expect(screen.queryByTestId('active-save-prompt')).not.toBeInTheDocument();

    // Control: an own-campaign event still opens the modal, so the rejection
    // above is campaign scoping, not a broken subscriber wiring.
    await openPrompt();
    expect(screen.getByText('testTarget')).toBeInTheDocument();
  });

  it('removes the prompt when a savePromptCleared event names its promptId, submitting nothing', async () => {
    renderModal();
    await openPrompt();

    fireEvent.click(screen.getByTestId('subscriber-trigger-cleared'));

    // Queue eviction is synchronous state — no waitFor needed.
    expect(screen.queryByTestId('active-save-prompt')).not.toBeInTheDocument();
    // The prompt was answered elsewhere; this client never fabricates a
    // submit or a second clear for it.
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
    expect(savePromptService.clearSavePrompt).not.toHaveBeenCalled();
  });

  it('keeps the prompt when savePromptCleared names a different promptId', async () => {
    renderModal();
    await openPrompt();

    fireEvent.click(screen.getByTestId('subscriber-trigger-cleared-other'));

    // handleClearedEvent filters by promptId — a foreign clear must not
    // silently drop the pending adjudication.
    expect(screen.getByTestId('active-save-prompt')).toBeInTheDocument();
    expect(screen.getByText('testTarget')).toBeInTheDocument();
  });

  // ── Result submission ──

  it('holds the result through the roll, then submits it exactly once on Done and clears the prompt', async () => {
    renderModal();
    await openPrompt();
    await rollAndWaitForResult();

    // Rolling alone never submits — the result waits for Done.
    expect(savePromptService.sendSaveResult).not.toHaveBeenCalled();
    // Rolling swaps Dismiss for the single submit button: no second exit
    // that could leak an un-adjudicated close.
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByTestId('active-save-prompt')).not.toBeInTheDocument();
    // Double-submit detector: one Done, one server post, one key clear.
    expect(savePromptService.sendSaveResult).toHaveBeenCalledTimes(1);
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expectedSendPayload);
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledTimes(1);
    expect(savePromptService.clearSavePrompt).toHaveBeenCalledWith('test-campaign', 'testTarget');
  });

  it('dispatches the save-result custom event with full adjudication detail on Done', async () => {
    renderModal();
    await openPrompt();
    await rollAndWaitForResult();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    // The dispatch is synchronous with the Done click.
    expect(saveResults).toHaveLength(1);
    expect(saveResults[0]).toEqual(expectedDispatchDetail);
  });

  // ── Queue advancement ──

  it('submits the first result once and advances to the second prompt on Next Save', async () => {
    renderModal();
    await openPrompt();

    fireEvent.click(screen.getByTestId('subscriber-trigger-second'));
    expect(screen.getByText('(1 of 2)')).toBeInTheDocument();

    await rollAndWaitForResult();

    fireEvent.click(screen.getByRole('button', { name: 'Next Save' }));

    expect(screen.getByText('testTarget2')).toBeInTheDocument();
    expect(screen.getByText('DEX')).toBeInTheDocument();
    expect(screen.getByText('DC 15')).toBeInTheDocument();
    // Advancing must not skip submission of the finished prompt, must fire it
    // exactly once, and must not submit the freshly revealed one.
    expect(savePromptService.sendSaveResult).toHaveBeenCalledTimes(1);
    expect(savePromptService.sendSaveResult).toHaveBeenCalledWith('test-campaign', 'testTarget', expectedSendPayload);
    const secondTargetSubmits = savePromptService.sendSaveResult.mock.calls.filter(([, target]) => target === 'testTarget2');
    expect(secondTargetSubmits).toEqual([]);
    expect(screen.getByRole('button', { name: 'Roll Save' })).toBeInTheDocument();
  });

  // ── Leading Evasion chooser gating (row tick UX in .coverage, stamping in .cla211) ──

  it('presents the Leading Evasion chooser with Apply disabled until an ally is selected', async () => {
    // A shareable DEX evasion held by a non-target triggers the chooser for
    // the second prompt (DEX save, dcSuccess 'half').
    const paladin = createCharacter('Paladin', undefined, [{ saveType: 'DEX', shareable: true, shareRange: 10 }]);
    renderModal({ characters: ['testTarget2', paladin] });

    fireEvent.click(screen.getByTestId('subscriber-trigger-second'));
    await screen.findByText('Leading Evasion — Choose Allies');

    // The creature making the save is offered as an (initially unticked) row
    // in the chooser list (scoped there — the name also shows in the prompt).
    const row = document.querySelector('.sp-overlay--evasion .secondary-target-row');
    expect(row).toHaveTextContent('testTarget2');
    expect(within(row).getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Apply Evasion (0)' })).toBeDisabled();
  });
});
