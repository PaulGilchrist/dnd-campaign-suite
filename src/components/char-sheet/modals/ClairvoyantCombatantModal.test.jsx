// @maintained-by-ai 2026-11-27
/**
 * ClairvoyantCombatantModal — BASE lane (info-screen / mount contract only; closes the family).
 *
 * Ownership map (siblings, do not duplicate here):
 * - .confirm.jsx    — 9 tests (re-verified 2026-11-27, sweep #1951): button gating it.each,
 *                     full-dispatch census on EMPTY stores (exact te write + ONE merged write,
 *                     same-object identity), confirm-latch, createSaveListener args,
 *                     ability_use payload, listener lifecycle, Pact Magic expenditure writes,
 *                     addEntry rejection
 * - .edgeCases.jsx  — 3 tests (re-verified 2026-11-27, sweep #1952): NON-EMPTY stores, foreign
 *                     te/buff preservation at arm, triple-specific te filtering on success,
 *                     malformed non-array activeBuffs
 * - .expiration.jsx — 6 tests (re-verified 2026-11-27, sweep #1953: it.each 2 cases + 4 its):
 *                     armed-clock queue byte shape (rounds=10, anchorless, trio), cancel-to-empty,
 *                     foreign-target clock trim (flagged), non-array queue
 * - .result.jsx     — 3 tests (re-verified 2026-11-27, sweep #1954): result-screen copy, exact
 *                     save_result log payload, Done/close contract
 * - .save-dismissed.jsx — dismissed result view (jsx:256-257) + save_dismissed row
 * This lane owns ONLY the info screen: exact full-line description copy (target / save /
 * failed-save paragraphs, props flowing through), the four note branches' exact copy — uses
 * line (:220), Pact Magic cost line (:230), and BOTH "no uses" variants (:241/:242; sole home
 * of the 'No Pact Magic slots available.' copy), header featureName resolution (custom vs
 * fallback, :17), Cancel → onClose, and the mount purity contract: a fresh mount fires ZERO
 * service calls and arms NO window listener.
 *
 * Defect faces (honest pins, never laundered — #1920 no forced clicks, #1912 no nicer
 * fixture shapes):
 * - jsx:238-244 — the exhausted info screen renders NO buttons at all: no roll affordance AND
 *   no Cancel escape hatch (user is stuck until tab close). This lane PINNED the honest ABSENCE
 *   via queryByRole/queryAllByRole in the no-uses test (handoff #1954 assigned this pin here;
 *   the confirm lane pins gating by button query, never a forced click). Product fix: add a
 *   Cancel button to the else-branch.
 * - jsx:239 inline style on the "no uses" note — deliberately NOT style-probed here: pinning
 *   the style attribute's presence would lock the defect in (breaking the product CSS-class
 *   fix), pinning its absence would launder it, and no behavior depends on the color. The flag
 *   already lives verbatim in the .confirm/.edgeCases/.expiration headers.
 * - jsx:202-203 listeners uncleaned on unmount — this lane never arms a listener (mount-purity
 *   addSpy census proves it) and never dispatches, so there is nothing to capture; the captured-
 *   listener idiom is moot here by construction.
 *
 * Trimmed since last maintenance (2026-11-27):
 * - description-copy it.each 2→1 test: the three paragraphs are pure prop templates
 *   (targetName/saveType/saveDc); the default-props case was a same-branch duplicate of the
 *   distinct-props case, which additionally proves flow-through. Default props stay witnessed
 *   by the mount-purity and actionable-note renders.
 * - Phantom mock keys getCombatSummary/loadCombatSummary (combatData) and clearRuntimeState
 *   (useRuntimeState) purged — component imports (jsx:2-7) are exactly createSaveListener,
 *   logSaveDismissed, addEntry, KEY, getCurrentCombatRound, getRuntimeValue, setRuntimeValue,
 *   setRuntimeObject; useOverlayEntranceFocus is React-only, unmocked family-wide.
 * - Stale sibling test-count cites fixed (confirm 12→9, edgeCases 5→3, expiration 6 re-verified,
 *   result 6→3).
 * - Mount-purity census widened to all eight imported service functions and BOTH listener
 *   event types the component can arm ('save-result' + 'save-dismissed').
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ClairvoyantCombatantModal from './ClairvoyantCombatantModal.jsx';

// ── Mocked modules (keys = exactly what the component imports, jsx:2-7) ──

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
  // save-dismissed sweep (2026-11-05): the component imports the shared dismissal log helper.
  logSaveDismissed: vi.fn(() => Promise.resolve()),
  // Constant promptId is inert here: this lane pins that createSaveListener is NEVER called
  // and never dispatches, so the unique-id anti-hijack idiom has no surface in this file.
  createSaveListener: vi.fn(() => ({ promptId: 'factory-default' })),
}));

vi.mock('../../../services/ui/logService.js', () => ({
  addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../../services/rules/effects/expirations.js', () => ({
  KEY: 'pendingExpirations',
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
import { createSaveListener, logSaveDismissed } from '../../../services/automation/common/savePrompt.js';
import { addEntry } from '../../../services/ui/logService.js';
import { getCurrentCombatRound } from '../../../services/encounters/combatData.js';

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

function renderModal(props = {}) {
  return render(<ClairvoyantCombatantModal {...makeProps(props)} />);
}

// Exact full-line match for paragraphs containing <b>/<strong> spans: compare the paragraph's
// full textContent (spans included), never a regex fragment of it.
function getParagraph(text) {
  return screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === text);
}

function getRollButton() {
  return screen.getByRole('button', { name: 'Clairvoyant Combatant' });
}

// House rule: mockReset (not clearAllMocks — it keeps mockResolvedValue/impl), then re-arm
// the default implementations the component needs to function.
afterEach(() => {
  createSaveListener.mockReset().mockReturnValue({ promptId: 'factory-default' });
  logSaveDismissed.mockReset().mockResolvedValue(undefined);
  addEntry.mockReset().mockResolvedValue(undefined);
  getCurrentCombatRound.mockReset().mockReturnValue(1);
  runtime.getRuntimeValue.mockReset().mockReturnValue(null);
  runtime.setRuntimeValue.mockReset().mockResolvedValue(undefined);
  runtime.setRuntimeObject.mockReset();
});

// Assert NONE of the eight imported service outlets fired (mount/cancel are inert).
function expectZeroServiceCalls() {
  expect(runtime.getRuntimeValue).not.toHaveBeenCalled();
  expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
  expect(runtime.setRuntimeObject).not.toHaveBeenCalled();
  expect(createSaveListener).not.toHaveBeenCalled();
  expect(logSaveDismissed).not.toHaveBeenCalled();
  expect(addEntry).not.toHaveBeenCalled();
  expect(getCurrentCombatRound).not.toHaveBeenCalled();
}

// ── Mount purity: info screen is inert until confirm ──

describe('ClairvoyantCombatantModal - base (info-screen / mount contract)', () => {
  it('mounts pure: renders the info screen with zero service calls and no window listener armed', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderModal();

    expect(getRollButton()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    // Nothing of the confirm lane fires before the user clicks: no reads, writes, prompt
    // mint, or log, and neither listener the component can arm (:202-203) is ever added.
    expectZeroServiceCalls();
    expect(
      addSpy.mock.calls.filter(([type]) => type === 'save-result' || type === 'save-dismissed')
    ).toHaveLength(0);
    addSpy.mockRestore();
  });

  // ── Info-screen description copy: exact full lines, props flow through ──

  it('renders the exact target/save/failed-save copy with props flowing through', () => {
    // Distinct props (not the fixture defaults): one render proves both the exact template
    // and that targetName/saveType/saveDc flow into every paragraph (spans included).
    renderModal({ targetName: 'Ogre Chieftain', saveType: 'Constitution', saveDc: 17 });

    expect(getParagraph('Target: Ogre Chieftain (via Awakened Mind)')).toBeInTheDocument();
    expect(getParagraph('Save: Ogre Chieftain must make a Constitution saving throw (DC 17).')).toBeInTheDocument();
    expect(getParagraph(
      'On a Failed Save: Ogre Chieftain has Disadvantage on attack rolls against you, ' +
      'and you have Advantage on attack rolls against Ogre Chieftain for the duration.'
    )).toBeInTheDocument();
  });

  // ── Note branches: exact copy of every actionable-screen note ──

  it.each([
    { label: 'uses available', props: { currentUses: 1, maxUses: 3 }, note: 'Uses available: 2 / 3 (Short or Long Rest).' },
    {
      label: 'Pact Magic slot cost',
      props: { currentUses: 3, maxUses: 3, pactMagicRecharge: true, pactSlotLevel: 2, pactSlotsAvailable: true },
      note: 'Cost: Expend a Pact Magic spell slot (level 2) to restore a use.',
    },
  ])('shows the exact $label note with an actionable roll + Cancel pair', (t) => {
    renderModal(t.props);

    expect(getParagraph(t.note)).toBeInTheDocument();
    expect(getRollButton()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  // ── Note branches: BOTH unusable "no uses" variants + honest defect pin ──

  it.each([
    {
      label: 'no Pact Magic recharge',
      props: { currentUses: 3, maxUses: 3, pactMagicRecharge: false },
      note: 'No uses remaining. Recharges on a Short or Long Rest.',
    },
    {
      label: 'recharge on but no slots — sole home of the no-slots copy',
      props: { currentUses: 3, maxUses: 3, pactMagicRecharge: true, pactSlotLevel: 2, pactSlotsAvailable: false },
      note: 'No uses remaining. Recharges on a Short or Long Rest, or expend a Pact Magic spell slot to restore a use. No Pact Magic slots available.',
    },
  ])('shows the exact no-uses note and renders NO buttons when unusable ($label)', (t) => {
    renderModal(t.props);

    expect(getParagraph(t.note)).toBeInTheDocument();
    // Honest defect pin (#1920: never force-click a missing control; #1912: never launder the
    // shape): the exhausted branch (:238-244) renders an action set of ZERO — the absent
    // Cancel is a trapped-user defect, not an assertion of good behavior. Product fix: add
    // Cancel; this pin then flips to presence with the fix. The :239 inline style is
    // deliberately not probed (see header: a presence-pin locks the defect, absence launders
    // it, and no behavior reads the color).
    expect(screen.queryByRole('button', { name: 'Clairvoyant Combatant' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    // Zero buttons also means zero confirm-lane fire on this screen.
    expectZeroServiceCalls();
  });

  // ── Header featureName resolution ──

  it.each([
    { label: 'custom action name', action: { name: 'Awakened Mind' }, expected: 'Awakened Mind' },
    { label: 'missing action name falls back to default', action: {}, expected: FEATURE },
  ])('header shows $label', (t) => {
    renderModal({ action: t.action });

    expect(screen.getByText(t.expected, { selector: '.sp-header' })).toBeInTheDocument();
  });

  // ── Close behavior ──

  it('Cancel calls onClose exactly once with no args and triggers no confirm-side effects', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith();
    expectZeroServiceCalls();
  });
});
