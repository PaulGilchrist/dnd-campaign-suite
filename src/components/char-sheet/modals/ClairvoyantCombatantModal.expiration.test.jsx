// @maintained-by-ai 2026-11-27
/**
 * ClairvoyantCombatantModal — EXPIRATION lane (clock queue depth + round-seam semantics).
 * 6 tests (re-verified 2026-11-27: it.each 2 cases + 4 its).
 *
 * Ownership map (siblings, do not duplicate here):
 * - .test.jsx        — info-screen text (incl. pact-variant copy), custom action name, Cancel → onClose,
 *                      mount purity
 * - .confirm.jsx     — 9 tests (re-verified 2026-11-27): button gating, exact te write + ONE merged write
 *                      on EMPTY stores; there the clock queue presence is pinned only as key-set +
 *                      length-1 — depth/shape deferred TO this lane. Also createSaveListener args,
 *                      ability_use payload, listener lifecycle, Pact Magic, addEntry rejection
 * - .edgeCases.jsx   — NON-EMPTY stores: foreign targetEffects/buffs preserved at arm, triple-specific
 *                      te filtering on success, foreign activeBuff filtering, and an UNRELATED clock
 *                      (no remove_target_effect clause) surviving the arm→cancel cycle. Malformed
 *                      non-array activeBuffs face. Queue entries sharing this feature's
 *                      effectKey+source clause are NOT seeded there — the trim-filter clauses live here.
 * - .result.jsx      — result-screen UI, Done/overlay clicks, save_result log content
 * This lane owns ONLY the expiration queue: exact armed-entry byte shape (expiryRounds=10 — the 1_minute
 * duration converted to ROUNDS per §5; appliedRound is a snapshot of getCurrentCombatRound, i.e. a round
 * counter matured at initiative seams, never wall-clock — no-timers architecture; anchorless per §38; the
 * ordered removal-effects trio), the clock-queue presence contract of the merged writes (the key rides the
 * arm write and the success-cancel write when the queue is an array; it is never fabricated when it is
 * not), and exact removal behavior: save-success trims ONLY this feature's en.target+effectKey+source
 * queue entries, save-failure leaves the armed clock in place untouched.
 *
 * Defect disposition (component, not fixed here — queue-filter target verdict, resolved 2026-11-27):
 * - ClairvoyantCombatantModal.jsx:127-129 — the success-cancel queue filter keys on
 *   en.target + effectKey + source and IGNORES the removal-effect's own target: a cla clock armed
 *   against a DIFFERENT target (same en.target/source) is trimmed alongside this activation's, while
 *   the SIBLING te filter (:120) and buff filter (:135) both honor target (edgeCases lane proved
 *   foreign-target survives in te/buffs). The asymmetry is pinned below as current behavior; a
 *   product fix would add `ef.target === targetName` to :129.
 * - Inline style :239 — flagged in .confirm/.edgeCases lanes, not repeated here.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ClairvoyantCombatantModal from './ClairvoyantCombatantModal.jsx';

// Unique promptId per mint: the component never removes listeners on unmount
// (jsx:202-203, family-flagged), so leaked listeners from earlier tests can
// never hijack anything in this lane.
let promptCounter = 0;

// ── Mocked modules (keys = exactly what the component imports, jsx:2-7;
// phantoms getCombatSummary/loadCombatSummary/clearRuntimeState purged 2026-11-27) ──

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
  logSaveDismissed: vi.fn(() => Promise.resolve()),
  createSaveListener: vi.fn(() => ({ promptId: `cla-exp-prompt-${++promptCounter}` })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
  KEY: 'pendingExpirations', // matches disk: barrel re-export of turnStartEffects.js const KEY
}));

vi.mock('../../../services/encounters/combatData.js', () => ({
  getCurrentCombatRound: vi.fn(() => 1),
}));

vi.mock('../../../hooks/runtime/useRuntimeState.js', () => ({
  getRuntimeValue: vi.fn(() => null),
  setRuntimeValue: vi.fn(() => Promise.resolve()),
  setRuntimeObject: vi.fn(),
}));

import * as runtime from '../../../hooks/runtime/useRuntimeState.js';
import { createSaveListener } from '../../../services/automation/common/savePrompt.js';
import { getCurrentCombatRound } from '../../../services/encounters/combatData.js';
import { KEY } from '../../../services/rules/effects/expirations.js';

// ── Fixtures ──

const PLAYER = 'Paladin1';
const TARGET = 'Goblin1';
const CAMPAIGN = 'test-campaign';
const FEATURE = 'Clairvoyant Combatant';

// Fresh onClose per call (house rule: no shared module-level vi.fn).
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

// Byte-exact armed queue entry (expirationQueue addExpiration shape folded into
// the merged write). expiryRounds=10 is the §5 minutes→rounds conversion — the
// NO-TIMERS architecture: the clock is a round counter matured at initiative
// seams, never a setTimeout/wall-clock deadline, and the entry carries no
// Date.now() stamp. appliedRound snapshots whatever getCurrentCombatRound
// reports at arm time.
function exactArmedEntry(round) {
  return {
    target: PLAYER,
    effects: [
      { type: 'remove_target_effect', effectKey: 'clairvoyant_combatant', source: FEATURE, target: TARGET },
      { type: 'remove_active_buff', buffName: FEATURE },
      { type: 'clear_runtime_value', creatureName: PLAYER, key: 'clairvoyantCombatantTarget' },
    ],
    appliedRound: round,
    expiryRounds: 10,
    expireOnCreatureName: null,
  };
}

// Trim-filter seeds exercising each clause of the :127-129 filter. The filter
// keeps an entry when en.target ≠ playerName, or no removal-effect row matches
// effectKey+source. Foreign SOURCE survives; the OTHER-CREATURE clock survives
// via the en.target clause; the foreign-TARGET cla clock shares all three
// matched clauses (the row's own target is ignored) and is over-trimmed —
// pinned as current behavior, flagged in the header.
const foreignSourceClock = {
  target: PLAYER,
  effects: [
    { type: 'remove_target_effect', effectKey: 'clairvoyant_combatant', source: 'Hex Curse', target: TARGET },
    { type: 'remove_active_buff', buffName: 'Hex Curse' },
  ],
  appliedRound: 3,
  expiryRounds: 10,
  expireOnCreatureName: null,
};
const foreignTargetClock = {
  target: PLAYER,
  effects: [{ type: 'remove_target_effect', effectKey: 'clairvoyant_combatant', source: FEATURE, target: 'Ogre2' }],
  appliedRound: 3,
  expiryRounds: 10,
  expireOnCreatureName: null,
};
const otherCreatureClock = {
  target: 'Ranger2',
  effects: [{ type: 'remove_target_effect', effectKey: 'clairvoyant_combatant', source: FEATURE, target: TARGET }],
  appliedRound: 3,
  expiryRounds: 10,
  expireOnCreatureName: null,
};

// House rule: mockReset (not clearAllMocks — it keeps mockResolvedValue/impl), then re-arm
// the default implementations the component needs to function.
afterEach(() => {
  vi.restoreAllMocks();
  createSaveListener.mockReset().mockImplementation(() => ({
    promptId: `cla-exp-prompt-${++promptCounter}`,
  }));
  getCurrentCombatRound.mockReset().mockReturnValue(1);
  runtime.getRuntimeValue.mockReset().mockReturnValue(null);
  runtime.setRuntimeValue.mockReset().mockResolvedValue(undefined);
  runtime.setRuntimeObject.mockReset();
});

// Live player stores (anti-vacuous): arm appends, cancel trims — the filter must run
// against what arm actually wrote. Captured listener dispatched directly, never via
// window.dispatchEvent, so leaked listeners from other lanes can't fire into these writes.
function liveStores({ queue = [], buffs = [] } = {}) {
  runtime.getRuntimeValue.mockImplementation((key, prop) => {
    if (key === 'campaign' && prop === 'targetEffects') return [];
    if (key === PLAYER && prop === KEY) return queue;
    if (key === PLAYER && prop === 'activeBuffs') return buffs;
    return null;
  });
  runtime.setRuntimeObject.mockImplementation((player, obj) => {
    if (player !== PLAYER) return;
    if (Array.isArray(obj[KEY])) queue = obj[KEY];
    if (Array.isArray(obj.activeBuffs)) buffs = obj.activeBuffs;
  });
  return {
    get queue() { return queue; },
    get buffs() { return buffs; },
  };
}

async function arm(props = {}) {
  render(<ClairvoyantCombatantModal {...makeProps(props)} />);
  const addSpy = vi.spyOn(window, 'addEventListener');
  fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));
  await waitFor(() => {
    expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(1);
  });
  const [, listener] = addSpy.mock.calls.filter(([type]) => type === 'save-result')[0];
  const promptId = createSaveListener.mock.results[0].value.promptId;
  const detail = (success, roll, total) => listener(new CustomEvent('save-result', {
    detail: { promptId, roll, total, success },
  }));
  return {
    dispatchSuccess: () => detail(true, 10, 15),
    dispatchFailure: () => detail(false, 5, 12),
  };
}

// ── Expiration lane ──

describe('ClairvoyantCombatantModal - expiration clock queue', () => {
  // ── Arm: exact queue entry byte shape, anchored to the combat round counter ──

  it.each([1, 7])('arms exactly ONE queue entry with the exact byte shape, appliedRound anchored to round %i', async (round) => {
    getCurrentCombatRound.mockReturnValue(round);
    await arm();

    // Round anchor: the seam counter, called exactly once with this campaign —
    // a wall-clock timestamp (Date.now()) would not equal the mocked round.
    expect(getCurrentCombatRound).toHaveBeenCalledTimes(1);
    expect(getCurrentCombatRound).toHaveBeenCalledWith(CAMPAIGN);

    const [playerName, payload, campaign] = runtime.setRuntimeObject.mock.calls[0];
    expect(playerName).toBe(PLAYER);
    expect(campaign).toBe(CAMPAIGN);
    // Exact depth AND shape — ordered removal-effects trio, 1_minute→10-round
    // conversion (§5), anchorless (§38), numeric appliedRound = the live round.
    // toEqual on the whole array pins all of it.
    expect(payload[KEY]).toEqual([exactArmedEntry(round)]);
  });

  // ── Save-success: exact removal against the live store ──

  it('save-success trims the armed clock to exactly empty and writes target/buffs null-out in ONE merged write', async () => {
    const stores = liveStores();
    const { dispatchSuccess } = await arm();
    expect(stores.queue).toHaveLength(1); // armed, live

    dispatchSuccess();
    await screen.findByText(/succeeded on Wisdom save/);

    // Exactly two player writes: arm + cancel — no stray queue writes.
    expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(2);
    const [playerName, cancelPayload, campaign] = runtime.setRuntimeObject.mock.calls[1];
    expect(playerName).toBe(PLAYER);
    expect(campaign).toBe(CAMPAIGN);
    // Exact cancel payload: full key set, every value exact.
    expect(cancelPayload).toEqual({
      clairvoyantCombatantTarget: null,
      activeBuffs: [],
      [KEY]: [],
    });
    // Live store agrees — the entry removed is the one arm actually appended.
    expect(stores.queue).toEqual([]);
    expect(stores.buffs).toEqual([]);
  });

  it('save-success queue trim keys on en.target+effectKey+source and IGNORES the removal-effect target — foreign-source and other-creature clocks survive, foreign-target clock also trimmed (flagged)', async () => {
    // Live queue seeded with three clocks predating this arm. The :127-129 filter
    // must keep the foreign-SOURCE clock (no matching effectKey+source row) and the
    // OTHER-CREATURE clock (en.target ≠ player). The foreign-TARGET cla clock shares
    // all three matched clauses — ef.target is never consulted (jsx:129) — so the
    // component trims it too. Pinned as current behavior; flagged in the header for
    // a product fix (contrast: te filter :120 and buff filter :135 DO honor target,
    // proven surviving in the .edgeCases lane).
    const stores = liveStores({ queue: [foreignSourceClock, foreignTargetClock, otherCreatureClock] });
    const { dispatchSuccess } = await arm();

    // Arm appended its clock after all three seeds, foreign entries same-object.
    const armedQueue = runtime.setRuntimeObject.mock.calls[0][1][KEY];
    expect(armedQueue).toHaveLength(4);
    expect(armedQueue.slice(0, 3)).toEqual([foreignSourceClock, foreignTargetClock, otherCreatureClock]);
    expect(armedQueue[0]).toBe(foreignSourceClock);
    expect(armedQueue[2]).toBe(otherCreatureClock);

    dispatchSuccess();
    await screen.findByText(/succeeded on Wisdom save/);

    const cancelQueue = runtime.setRuntimeObject.mock.calls[1][1][KEY];
    expect(cancelQueue).toEqual([foreignSourceClock, otherCreatureClock]);
    expect(cancelQueue[0]).toBe(foreignSourceClock); // survives untouched
    expect(cancelQueue[1]).toBe(otherCreatureClock); // survives via en.target clause
    expect(cancelQueue).not.toContain(foreignTargetClock); // over-trim: flagged
    expect(stores.queue).toEqual([foreignSourceClock, otherCreatureClock]);
  });

  // ── Save-failure: the armed clock survives ──

  it('save-failure leaves the armed clock untouched: no second player write, queue depth stays 1, same entry object', async () => {
    const stores = liveStores();
    const { dispatchFailure } = await arm();
    const armedEntry = stores.queue[0];

    dispatchFailure();
    await screen.findByText(/failed Wisdom save/);

    // Arm was the ONLY player-store write — the clock stays armed for the full
    // 10-round duration; nothing on the failure path may trim the queue.
    expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(1);
    expect(stores.queue).toHaveLength(1);
    expect(stores.queue[0]).toBe(armedEntry); // byte-identical, not rewritten
    expect(stores.buffs).toHaveLength(1); // buff badge also survives
  });

  // ── Merged-write clock presence contract ──

  it('success cancel never fabricates a pendingExpirations key when the stored queue is not an array', async () => {
    // Queue unreadable (null) at cancel time: the §39 merged write must OMIT the key
    // rather than overwrite the server-side queue with a fabricated [].
    const stores = liveStores();
    const { dispatchSuccess } = await arm();
    expect(stores.queue).toHaveLength(1); // arm DID fabricate from null per §5 append

    runtime.getRuntimeValue.mockImplementation((key, prop) => {
      if (key === 'campaign' && prop === 'targetEffects') return [];
      if (key === PLAYER && prop === 'activeBuffs') return [];
      return null; // queue gone at cancel time
    });

    dispatchSuccess();
    await screen.findByText(/succeeded on Wisdom save/);

    expect(runtime.setRuntimeObject).toHaveBeenCalledTimes(2);
    const cancelPayload = runtime.setRuntimeObject.mock.calls[1][1];
    expect(Object.keys(cancelPayload).sort()).toEqual(['activeBuffs', 'clairvoyantCombatantTarget']);
    expect(cancelPayload).not.toHaveProperty(KEY);
    expect(cancelPayload.clairvoyantCombatantTarget).toBeNull();
    expect(cancelPayload.activeBuffs).toEqual([]);
  });
});
