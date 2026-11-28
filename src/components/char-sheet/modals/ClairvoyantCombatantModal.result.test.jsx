// @maintained-by-ai 2026-11-27
/**
 * ClairvoyantCombatantModal — RESULT lane (result-view rendering/UI + save_result log content).
 *
 * Ownership map (siblings, do not duplicate here):
 * - .test.jsx       — info-screen text (incl. pact-variant copy), custom action name, Cancel → onClose
 * - .confirm.jsx    — 9 tests (re-verified 2026-11-27): button gating, exact te write + ONE merged write
 *                     on EMPTY stores, createSaveListener args, ability_use payload, listener lifecycle
 *                     (foreign promptId ignore + detach on same identity), Pact Magic, addEntry rejection
 * - .edgeCases.jsx  — 3 tests (re-verified 2026-11-27): NON-EMPTY stores, foreign te/buff preservation
 *                     at arm, triple-specific te filtering on success, buff filtering, queue preservation
 * - .expiration.jsx — 6 tests (re-verified 2026-11-27: it.each 2 cases + 4 its): armed-clock queue byte
 *                     shape (rounds=10, anchorless, trio), cancel-to-empty, foreign-target clock trim
 *                     (flagged), non-array queue
 * - .save-dismissed.jsx — dismissed result view (component :256-257 copy) + save_dismissed row + the
 *                     pre-resolve null-render gap; never save_result content
 * This lane owns ONLY the result screen: exact full-line result copy per branch, the exact
 * save_result log payload (confirm lane pins lifecycle COUNT only, never content), and the
 * close contract — overlay/modal clicks inert, Done closes exactly once, result action set
 * is Done alone (Cancel absence pinned via query).
 *
 * Trimmed since last maintenance (subsumed by siblings or consolidated here, noted):
 * - foreign-promptId gating and post-detach inertness → .confirm.jsx listener lifecycle.
 * - success-branch store writes (te filter, buff/queue cancel) → .edgeCases/.expiration lanes;
 *   this lane verifies only that the result screen RENDERS after those flows.
 * - "does not close on modal content" was a near-duplicate of overlay inertness — consolidated
 *   into the single close-contract test.
 * - 2026-11-27 pass: copy/log it.each 4→2 cases — result copy and save_result description are
 *   pure prop templates (targetName/saveType/saveDc/roll/total/success), so the default-prop
 *   variants were same-branch duplicates of the distinct-prop ones (which additionally pin prop
 *   flow); default-props copy stays witnessed by the close-contract test. Close-contract it.each
 *   2→1 — the result DOM (:264-277) is branch-invariant (only the description template differs,
 *   pinned by the copy test); one branch exercises inertness + Done once. Phantom mock keys
 *   getCombatSummary/loadCombatSummary/clearRuntimeState purged (component imports jsx:2-7 never
 *   reference them). Stale line refs fixed: result copy :230/:232→:259/:261, log copy
 *   :119/:158→:163/:179.
 *
 * Adopted from sibling recommendation: captured-listener dispatch (spy → direct call), NEVER
 * window.dispatchEvent, with unique promptId per test — leaked unmount-less listeners (the
 * component adds window listeners at :202-203 and never removes them on unmount — family-flagged
 * defect, listener lifecycle owned by .confirm.jsx) can never fire into these assertions.
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ClairvoyantCombatantModal from './ClairvoyantCombatantModal.jsx';

// Unique promptId per mint: leaked unmount-less listeners from earlier tests can
// never hijack anything in this lane.
let promptCounter = 0;

// ── Mocked modules (keys = exactly what the component imports, jsx:2-7) ──

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
  // save-dismissed sweep (2026-11-05): components under test may now import the shared dismissal log helper.
  logSaveDismissed: vi.fn(() => Promise.resolve()),
  createSaveListener: vi.fn(() => ({ promptId: `cla-result-prompt-${++promptCounter}` })),
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
import { addEntry } from '../../../services/ui/logService.js';

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

// Exact result-screen copy the component renders per branch (component :259/:261).
function screenCopy({ targetName = TARGET, saveType = 'Wisdom' } = {}, success) {
  return success
    ? `${targetName} succeeded on ${saveType} save — Clairvoyant Combatant has no effect.`
    : `${targetName} failed ${saveType} save — Clairvoyant Combatant active. ${targetName} has Disadvantage on attacks against you, you have Advantage on attacks against ${targetName}.`;
}

// Exact save_result log payload the component commits per branch (descriptions :163/:179).
function exactSaveResult({ targetName = TARGET, saveType = 'Wisdom', saveDc = 13 } = {}, success, roll, total) {
  return {
    type: 'save_result',
    characterName: PLAYER,
    targetName,
    saveDc,
    saveType,
    success,
    saveRoll: roll,
    saveTotal: total,
    description: success
      ? `${targetName} succeeded on ${saveType} save (rolled ${roll} + ${total - roll} = ${total} vs DC ${saveDc}) — Clairvoyant Combatant has no effect.`
      : `${targetName} failed ${saveType} save (rolled ${roll} + ${total - roll} = ${total} vs DC ${saveDc}) — Clairvoyant Combatant active. ${targetName} has Disadvantage on attacks against you, you have Advantage on attacks against ${targetName}.`,
    timestamp: expect.any(Number),
  };
}

// House rule: mockReset (not clearAllMocks — it keeps mockResolvedValue/impl), then re-arm
// the default implementations the component needs to function.
afterEach(() => {
  vi.restoreAllMocks();
  createSaveListener.mockReset().mockImplementation(() => ({
    promptId: `cla-result-prompt-${++promptCounter}`,
  }));
  addEntry.mockReset().mockResolvedValue(undefined);
  runtime.getRuntimeValue.mockReset().mockReturnValue(null);
  runtime.setRuntimeValue.mockReset().mockResolvedValue(undefined);
  runtime.setRuntimeObject.mockReset();
});

// Render, click confirm, wait for the listener to be armed (no timers), and hand back a
// dispatcher bound to THIS test's captured listener + promptId — never window.dispatchEvent.
async function arm(props = {}) {
  const onClose = props.onClose || vi.fn();
  render(<ClairvoyantCombatantModal {...makeProps({ ...props, onClose })} />);
  const addSpy = vi.spyOn(window, 'addEventListener');
  fireEvent.click(screen.getByRole('button', { name: /Clairvoyant Combatant/ }));
  await waitFor(() => {
    expect(addSpy).toHaveBeenCalledWith('save-result', expect.any(Function));
  });
  const [, listener] = addSpy.mock.calls.filter(([type]) => type === 'save-result')[0];
  const promptId = createSaveListener.mock.results[0].value.promptId;
  return {
    onClose,
    resolveSave: async (success, roll, total) => {
      await act(async () => {
        listener(new CustomEvent('save-result', {
          detail: { promptId, roll, total, success },
        }));
      });
    },
  };
}

// ── Result lane ──

describe('ClairvoyantCombatantModal - result screen', () => {
  // ── Result screen: exact copy + exact save_result log per branch.
  //    Both branches ride DISTINCT handler-voice props — result copy and log description are
  //    pure prop templates, so distinct-prop cases strictly subsume the default-prop ones
  //    (Goblin1/Wisdom/13 rendering stays witnessed by the close-contract test below). ──

  it.each([
    {
      label: 'failed save, distinct target/save props',
      success: false,
      roll: 3,
      total: 17,
      props: { targetName: 'Yagra', saveType: 'Constitution', saveDc: 18, action: { name: 'Spectral Sight' } },
    },
    {
      label: 'successful save, distinct target/save props',
      success: true,
      roll: 12,
      total: 20,
      props: { targetName: 'Bogil', saveType: 'Strength', saveDc: 12 },
    },
  ])('resolves to the result screen on $label: exact full-line copy, header, and one exact save_result log', async (t) => {
    const { resolveSave } = await arm(t.props);
    const ctx = t.props;

    await resolveSave(t.success, t.roll, t.total);

    // Exact full-line result copy in the result body — rendered nowhere else.
    const copy = screenCopy(ctx, t.success);
    expect(screen.getByText(copy)).toBeInTheDocument();
    expect(document.querySelectorAll('.sp-body')).toHaveLength(1);
    expect(document.querySelector('.sp-body').textContent).toBe(copy);
    // Result header keeps the live action name (distinct-name case pins props flow).
    expect(screen.getByText(ctx.action?.name || FEATURE)).toBeInTheDocument();
    expect(screen.queryByText(screenCopy(ctx, !t.success))).not.toBeInTheDocument();

    // save_result content owned here: exact payload on the LAST log call (the first is the
    // confirm-lane ability_use entry; count/lifecycle pinned there).
    expect(addEntry).toHaveBeenLastCalledWith(CAMPAIGN, exactSaveResult(ctx, t.success, t.roll, t.total));
  });

  // ── Close contract: overlay + modal clicks inert, Done closes exactly once.
  //    The result DOM (:264-277) is branch-invariant — only the description template differs
  //    and is pinned above — so one branch (default props) exercises the whole contract. ──

  it('result screen (failed save → resolved): overlay and modal clicks inert, Done is the only action and closes exactly once', async () => {
    const { onClose, resolveSave } = await arm();
    await resolveSave(false, 5, 10);

    const body = screen.getByText(screenCopy({}, false));

    // Inert: clicks on the overlay and bubbling from the modal never close the modal.
    fireEvent.click(document.querySelector('.sp-overlay'));
    fireEvent.click(document.querySelector('.sp-modal'));
    fireEvent.click(body);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText(screenCopy({}, false))).toBeInTheDocument();

    // Done: exact accessible name, sole button in the action bar, closes exactly once.
    // Cancel absence pinned via query — the info screen's exhausted branch (:238-244) has
    // no Cancel at all (family-flagged defect, .confirm/.test lanes own it); here it must
    // never appear on the resolved screen.
    const done = screen.getByRole('button', { name: 'Done' });
    expect(screen.getAllByRole('button')).toEqual([done]);
    expect(done).toHaveClass('sp-roll-btn');
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    fireEvent.click(done);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
