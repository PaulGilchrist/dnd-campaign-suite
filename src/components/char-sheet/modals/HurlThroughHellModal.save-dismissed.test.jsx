// @maintained-by-ai
// HurlThroughHellModal — dismiss-softlock regression (save-dismissed sweep
// family, 2026-11-05). handleConfirm parks the modal at step==='result' with
// result===null awaiting save-result; the GM's un-rolled Dismiss never
// dispatches one, stranding the cast (renders nothing, silently). All Hurl
// effects apply only on a FAILED save, so the dismiss path is a clean
// neutral: detach BOTH listeners, log a save_dismissed row (no fabricated
// save_result / damage / popup), and render the dismissed result view with a
// working Done. Harness mirrors HurlThroughHellModal.saveResults.test.jsx;
// unique promptId per mint (playbook §66 test doctrine).
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import HurlThroughHellModal from './HurlThroughHellModal.jsx';

let promptCounter = 0;

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
  createSaveListener: vi.fn(() => ({ promptId: `hurl-dismiss-prompt-${++promptCounter}` })),
  logSaveDismissed: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/combat/applyDamage.js', () => ({
  applyDamageToTarget: vi.fn(() => ({ finalDamage: 22 })),
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 5),
  getCombatSummary: vi.fn(() => ({ creatures: [{ name: 'Goblin1', type: 'npc' }] })),
}));

vi.mock('../../../services/dice/diceRoller.js', () => ({
  rollExpression: vi.fn(() => ({ total: 22, rolls: [15, 7] })),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

import * as runtimeState from '../../../hooks/runtime/useRuntimeState.js';
import * as applyDamage from '../../../services/rules/combat/applyDamage.js';
import * as expirations from '../../../services/rules/effects/expirations.js';
import { createSaveListener, logSaveDismissed } from '../../../services/automation/common/savePrompt.js';
import { addEntry } from '../../../services/ui/logService.js';

const CAMPAIGN = 'test-campaign';

const makeProps = (overrides = {}) => ({
  action: { name: 'Hurl Through Hell' },
  playerStats: { name: 'Throg', level: 15 },
  campaignName: CAMPAIGN,
  targetName: 'Goblin1',
  saveType: 'WIS',
  saveDc: 16,
  damageType: 'Psychic',
  damageExpression: '4d10',
  damageTotal: 22,
  currentUses: 0,
  maxUses: 3,
  pactMagicRecharge: false,
  pactSlotLevel: 0,
  pactSlotsAvailable: 0,
  onClose: vi.fn(),
  ...overrides,
});

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
  fireEvent.click(screen.getByRole('button', { name: /Hurl Through Hell/ }));
  await waitFor(() => expect(createSaveListener).toHaveBeenCalled());
  // Let handleConfirm's awaits settle before dispatching.
  await act(async () => { await new Promise(r => setTimeout(r, 15)); });
  return createSaveListener.mock.results.at(-1).value.promptId;
}

const dispatchDismissed = (promptId) => act(async () => {
  window.dispatchEvent(new CustomEvent('save-dismissed', { detail: { promptId } }));
  await new Promise(r => setTimeout(r, 0));
});

const dismissedCopy = "Goblin1's save was dismissed — not hurled through the lower planes.";

describe('HurlThroughHellModal — dismissed save prompt', () => {
  let popups = [];
  const onPopup = (e) => popups.push(e.detail);

  beforeEach(() => {
    vi.clearAllMocks();
    popups = [];
    window.addEventListener('damage-popup', onPopup);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.removeEventListener('damage-popup', onPopup);
  });

  it('a matching save-dismissed un-strands the modal: dismissed view + working Done, zero harm state, save_dismissed row, both listeners detached', async () => {
    const ledger = trackSaveLedger();
    const onClose = vi.fn();
    render(<HurlThroughHellModal {...makeProps({ onClose })} />);
    const promptId = await armPrompt();
    expect(ledger.open).toBe(2);

    await dispatchDismissed(promptId);

    expect(await screen.findByText(dismissedCopy)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    expect(logSaveDismissed).toHaveBeenCalledWith(CAMPAIGN, expect.objectContaining({
      casterName: 'Throg',
      abilityName: 'Hurl Through Hell',
      targetName: 'Goblin1',
      saveDc: 16,
      saveType: 'WIS',
    }));
    // Neutral outcome: no damage, no incapacitation writes, no popup, and the
    // only new log is the save_dismissed automation row.
    expect(applyDamage.applyDamageToTarget).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(popups).toHaveLength(0);
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalledWith('Goblin1', 'activeConditions', expect.anything(), CAMPAIGN);
    expect(addEntry.mock.calls.map(c => c[1]).every(e => e.type !== 'save_result' && e.type !== 'roll')).toBe(true);
    expect(ledger.open).toBe(0);
  });

  it('a save-dismissed for a DIFFERENT promptId stays inert (mismatch guard)', async () => {
    render(<HurlThroughHellModal {...makeProps()} />);
    await armPrompt();

    await dispatchDismissed('someone-else-prompt');

    expect(logSaveDismissed).not.toHaveBeenCalled();
    expect(screen.queryByText(dismissedCopy)).not.toBeInTheDocument();
  });

  it('a normally-resolved save detaches the dismissed companion: a trailing save-dismissed cannot overwrite the outcome', async () => {
    const ledger = trackSaveLedger();
    render(<HurlThroughHellModal {...makeProps()} />);
    const promptId = await armPrompt();

    await act(async () => {
      window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, roll: 15, total: 17, success: true } }));
      await new Promise(r => setTimeout(r, 0));
    });
    expect(ledger.open).toBe(0);

    await dispatchDismissed(promptId);

    expect(logSaveDismissed).not.toHaveBeenCalled();
    expect(screen.queryByText(dismissedCopy)).not.toBeInTheDocument();
  });
});
