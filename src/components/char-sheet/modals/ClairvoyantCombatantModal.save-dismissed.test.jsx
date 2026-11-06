// @maintained-by-ai
// ClairvoyantCombatantModal — dismiss-softlock regression (save-dismissed
// sweep family, 2026-11-05). handleConfirm parks the modal at
// step==='result' with result===null (renders NOTHING — the cast silently
// never resolves) awaiting save-result; the GM's un-rolled Dismiss never
// dispatches one (dismiss doctrine). The modal now opts into the
// promptId-keyed `save-dismissed` broadcast: it detaches BOTH listeners,
// revokes the pre-granted clairvoyant_combatant buff (same neutral cleanup the
// save-success branch performs), logs a save_dismissed row (NOT a fabricated
// save_result), and renders the dismissed result view with a working Done.
// Harness mirrors ClairvoyantCombatantModal.confirm.test.jsx; unique promptId
// per mint (playbook §66 test doctrine).
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ClairvoyantCombatantModal from './ClairvoyantCombatantModal.jsx';

let promptCounter = 0;

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: `cla-dismiss-prompt-${++promptCounter}` })),
  logSaveDismissed: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
  KEY: 'pendingExpirations',
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
  getCombatSummary: vi.fn(() => null),
  loadCombatSummary: vi.fn(async () => null),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  clearRuntimeState: vi.fn(),
  setRuntimeObject: vi.fn(),
}));

import * as runtime from '../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener, logSaveDismissed } from '../../../services/automation/common/savePrompt.js';
import { addEntry } from '../../../services/ui/logService.js';

const PLAYER = 'Paladin1';
const TARGET = 'Goblin1';
const CAMPAIGN = 'test-campaign';
const FEATURE = 'Clairvoyant Combatant';

function makeProps(overrides = {}) {
  return {
    action: { name: FEATURE },
    playerStats: { name: PLAYER, level: 5 },
    campaignName: CAMPAIGN,
    targetName: TARGET,
    saveType: 'Wisdom',
    saveDc: 13,
    currentUses: 1,
    maxUses: 3,
    pactSlotLevel: 0,
    pactSlotsAvailable: false,
    pactMagicRecharge: false,
    onClose: vi.fn(),
    ...overrides,
  };
}

// Leak ledger for the modal's own window listeners (the mocked
// createSaveListener registers none).
function trackSaveLedger() {
  const ledger = { open: 0 };
  const realAdd = window.addEventListener.bind(window);
  const realRemove = window.removeEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => {
    if (type === 'save-result' || type === 'save-dismissed') ledger.open += 1;
    return realAdd(type, fn, opts);
  });
  vi.spyOn(window, 'removeEventListener').mockImplementation((type, fn, opts) => {
    if (type === 'save-result' || type === 'save-dismissed') ledger.open -= 1;
    return realRemove(type, fn, opts);
  });
  return ledger;
}

async function armPrompt() {
  fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));
  await waitFor(() => expect(createSaveListener).toHaveBeenCalled());
  return createSaveListener.mock.results.at(-1).value.promptId;
}

const dispatchDismissed = (promptId) => act(async () => {
  window.dispatchEvent(new CustomEvent('save-dismissed', { detail: { promptId } }));
  await new Promise(r => setTimeout(r, 0));
});

describe('ClairvoyantCombatantModal — dismissed save prompt', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('a matching save-dismissed un-strands the modal: dismissed result view + working Done, grant revoked, save_dismissed row, both listeners detached', async () => {
    const ledger = trackSaveLedger();
    const onClose = vi.fn();
    render(<ClairvoyantCombatantModal {...makeProps({ onClose })} />);
    const promptId = await armPrompt();
    expect(ledger.open).toBe(2); // ONE save-result + ONE save-dismissed
    expect(screen.queryByText(/dismissed/i)).not.toBeInTheDocument();

    await dispatchDismissed(promptId);

    // Refusal view (no fabricated save roll) with a working escape.
    expect(await screen.findByText(`${TARGET}'s save was dismissed — ${FEATURE} has no effect.`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Neutral cleanup: the pre-granted buff is revoked (same path as a save
    // success) — no save_result row is fabricated, only the save_dismissed one.
    expect(logSaveDismissed).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      casterName: PLAYER,
      abilityName: FEATURE,
      targetName: TARGET,
      saveDc: 13,
      saveType: 'Wisdom',
    }));
    expect(addEntry.mock.calls.map(c => c[1]).every(e => e.type !== 'save_result')).toBe(true);
    expect(runtime.setRuntimeObject).toHaveBeenCalledWith(PLAYER, expect.objectContaining({ clairvoyantCombatantTarget: null }), CAMPAIGN);
    expect(runtime.setRuntimeValue).toHaveBeenCalledWith('campaign', 'targetEffects', expect.any(Array), CAMPAIGN);
    expect(ledger.open).toBe(0); // BOTH listeners detached on arrival
  });

  it('a save-dismissed for a DIFFERENT promptId stays inert (mismatch guard)', async () => {
    render(<ClairvoyantCombatantModal {...makeProps()} />);
    await armPrompt();

    await dispatchDismissed('someone-else-prompt');

    expect(logSaveDismissed).not.toHaveBeenCalled();
    expect(screen.queryByText(/dismissed/i)).not.toBeInTheDocument();
    // Only the confirm-time grant write happened — no revoke on a foreign id.
    expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(1);
  });

  it('a normally-resolved save detaches the dismissed companion: a trailing save-dismissed cannot overwrite the outcome', async () => {
    const ledger = trackSaveLedger();
    render(<ClairvoyantCombatantModal {...makeProps()} />);
    const promptId = await armPrompt();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, roll: 15, total: 17, success: true } }));
      await new Promise(r => setTimeout(r, 0));
    });
    expect(ledger.open).toBe(0);

    await dispatchDismissed(promptId);

    expect(logSaveDismissed).not.toHaveBeenCalled();
    expect(screen.queryByText(/dismissed/i)).not.toBeInTheDocument();
  });
});
