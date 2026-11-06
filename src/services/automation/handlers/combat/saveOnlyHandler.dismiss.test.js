// @maintained-by-ai
// Save-dismiss leak pin for saveOnlyHandler's raw 'save-result' listener
// (save_only producer family: Stunning Strike / Color Spray / Entangle /
// Grease / Arms of Hadar / Dominate Monster). The listener used to be removed
// ONLY on a matching save-result arrival, so the GM's un-rolled Dismiss (the
// dedicated `save-dismissed` broadcast, 2026-11-05 family) leaked one window
// listener + closure set per dismissed cast while createSaveListener's own
// listener detached itself. Fix mirrors createSaveListener
// (savePrompt.js:167-172): a promptId-gated 'save-dismissed' companion
// detaches BOTH listeners and routes through saveOnlyRefusal →
// <feature>_refused (reason save_dismissed) with zero state writes. Mock
// scaffold shared with saveOnlyHandler.test.js.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks BEFORE imports ───────────────────────────────────────

vi.mock('../../common/savePrompt.js', () => ({
  buildSaveDc: vi.fn(),
  createSaveListener: vi.fn(),
}));

vi.mock('../../common/targetResolver.js', () => ({
  resolveTarget: vi.fn(),
}));

vi.mock('../../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(),
  setRuntimeValue: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../rules/effects/expirations.js', () => ({
  addExpiration: vi.fn(),
}));

// ── Imports ────────────────────────────────────────────────────

import { handle } from './saveOnlyHandler.js';
import * as savePrompt from '../../common/savePrompt.js';
import * as targetResolver from '../../common/targetResolver.js';
import * as runtimeState from '../../../../hooks/runtime/useRuntimeState.js';
import * as logService from '../../../ui/logService.js';
import * as expirations from '../../../rules/effects/expirations.js';

// ── Helpers ────────────────────────────────────────────────────

const campaignName = 'TestCampaign';
const mapName = 'TestMap';

// Unique promptId per handle() call (same doctrine as
// saveOnlyHandler.test.js:46-49 — shared ids would leak listeners across tests).
let promptCounter = 0;

function makePlayerStats() {
  return {
    name: 'TestHero',
    level: 3,
    proficiency: 2,
    abilities: [
      { name: 'CON', modifier: 2 },
      { name: 'CHA', modifier: 3 },
    ],
  };
}

function makeAction(automation = {}) {
  return {
    name: 'Stunning Strike',
    automation: { ...automation },
  };
}

function setupMocks() {
  savePrompt.buildSaveDc.mockReturnValue(14);
  // Listener-free minimal contract: the ledger below must count ONLY the
  // producer's own handlers, so the mock mints an id + resolved promise
  // without registering its own routing listener.
  savePrompt.createSaveListener.mockImplementation(() => ({
    promptId: `dismiss-guid-${++promptCounter}`,
    promise: Promise.resolve({ success: false }),
  }));
  targetResolver.resolveTarget.mockResolvedValue({ target: { name: 'Goblin' } });
  runtimeState.getRuntimeValue.mockReturnValue(undefined);
  runtimeState.setRuntimeValue.mockResolvedValue(undefined);
  logService.addEntry.mockResolvedValue({});
  expirations.addExpiration.mockReturnValue(undefined);
}

// Leak ledger for BOTH save events (savePrompt.test.js family): records every
// add/remove, delegating to the real implementation so dispatch still reaches
// live listeners, with a net open count.
function trackSaveLedger() {
  const ledger = { adds: [], removes: [], open: 0 };
  const realAdd = window.addEventListener.bind(window);
  const realRemove = window.removeEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, fn, opts) => {
    if (type === 'save-result' || type === 'save-dismissed') {
      ledger.adds.push(fn);
      ledger.open += 1;
    }
    return realAdd(type, fn, opts);
  });
  vi.spyOn(window, 'removeEventListener').mockImplementation((type, fn, opts) => {
    if (type === 'save-result' || type === 'save-dismissed') {
      ledger.removes.push(fn);
      ledger.open -= 1;
    }
    return realRemove(type, fn, opts);
  });
  return ledger;
}

const latestPromptId = () =>
  savePrompt.createSaveListener.mock.results.at(-1).value.promptId;

const dispatchSaveDismissed = (promptId) =>
  window.dispatchEvent(new CustomEvent('save-dismissed', { detail: { promptId } }));

const dispatchSaveResult = (success, promptId = latestPromptId()) =>
  window.dispatchEvent(new CustomEvent('save-result', { detail: { promptId, success } }));

const logEntriesByType = (type) => logService.addEntry.mock.calls.map(c => c[1]).filter(e => e.type === type);
const refusalRows = () => logEntriesByType('automation').filter(e => /_refused$/.test(String(e.automationDetail)));

describe('saveOnlyHandler — save-dismiss listener detach', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handle() registers exactly one save-result + one save-dismissed producer listener', async () => {
    const ledger = trackSaveLedger();
    await handle(makeAction({ saveType: 'CON' }), makePlayerStats(), campaignName, mapName);

    expect(ledger.adds).toHaveLength(2);
    expect(ledger.adds.filter(f => f.name === 'handleSaveResult')).toHaveLength(1);
    expect(ledger.adds.filter(f => f.name === 'handleSaveDismissed')).toHaveLength(1);
    expect(ledger.open).toBe(2);
  });

  it('matching save-dismissed detaches BOTH listeners and logs <feature>_refused (save_dismissed) with zero state writes', async () => {
    const ledger = trackSaveLedger();
    await handle(makeAction({ saveType: 'CON' }), makePlayerStats(), campaignName, mapName);
    expect(ledger.open).toBe(2);

    dispatchSaveDismissed(latestPromptId());

    // Leak census: every added handler removed exactly once, ledger balanced.
    expect(ledger.open).toBe(0);
    expect(ledger.removes).toHaveLength(2);
    ledger.adds.forEach((fn) => {
      expect(ledger.removes.filter((f) => f === fn)).toHaveLength(1);
    });

    expect(refusalRows()).toHaveLength(1);
    expect(refusalRows()[0]).toMatchObject({
      type: 'automation',
      characterName: 'TestHero',
      abilityName: 'Stunning Strike',
      automationDetail: 'stunning_strike_refused',
      reason: 'save_dismissed',
    });

    // Zero further state on abandonment.
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
    expect(expirations.addExpiration).not.toHaveBeenCalled();
    expect(logEntriesByType('save_result')).toHaveLength(0);
  });

  it('save-dismissed for a different promptId stays inert (mismatch guard)', async () => {
    const ledger = trackSaveLedger();
    await handle(makeAction({ saveType: 'CON' }), makePlayerStats(), campaignName, mapName);

    dispatchSaveDismissed('someone-elses-prompt');

    expect(ledger.open).toBe(2);
    expect(ledger.removes).toHaveLength(0);
    expect(refusalRows()).toHaveLength(0);
    expect(runtimeState.setRuntimeValue).not.toHaveBeenCalled();
  });

  it('a resolved save-result detaches the dismissed companion too: a trailing save-dismissed cannot log a phantom refusal', async () => {
    const ledger = trackSaveLedger();
    await handle(makeAction({ saveType: 'CON' }), makePlayerStats(), campaignName, mapName);

    dispatchSaveResult(false);
    expect(logEntriesByType('save_result')).toHaveLength(1);
    expect(ledger.open).toBe(0);

    dispatchSaveDismissed(latestPromptId());
    expect(refusalRows()).toHaveLength(0);
  });
});
