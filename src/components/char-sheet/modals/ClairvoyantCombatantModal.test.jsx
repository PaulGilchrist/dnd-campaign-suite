// @maintained-by-ai
/**
 * ClairvoyantCombatantModal — BASE lane (initial-render / mount contract only).
 *
 * Ownership map (siblings, do not duplicate here):
 * - .confirm.jsx    — 12 tests: button gating (unusable combos: no roll button, zero writes),
 *                     exact te write + ONE merged write on EMPTY stores (same-object identity),
 *                     createSaveListener args, ability_use payload, listener lifecycle (foreign
 *                     promptId ignore + detach on same identity), Pact Magic expenditure writes,
 *                     addEntry rejection
 * - .edgeCases.jsx  — 5 tests: NON-EMPTY stores, foreign te/buff preservation at arm,
 *                     triple-specific te filtering on success, buff filtering, queue preservation
 * - .expiration.jsx — 6 tests: armed-clock queue byte shape (rounds=10, anchorless, trio),
 *                     cancel-to-empty, foreign-target clock trim (flagged), non-array queue
 * - .result.jsx     — 6 tests: result-screen copy, exact save_result log payload,
 *                     Done/overlay close contract
 * This lane owns ONLY the info screen at mount: exact full-line description copy (target /
 * save / failed-save paragraphs, incl. prop flow-through into that copy), the four note-screen
 * branches' exact copy — uses line, Pact Magic cost line, and BOTH "no uses" variants
 * (this is the sole home of the 'No Pact Magic slots available.' copy flagged uncovered by
 * .edgeCases), header featureName resolution (custom vs default), Cancel → onClose, and the
 * mount purity contract: a fresh mount with usable props fires ZERO service calls and arms NO
 * save-result listener.
 *
 * Cross-file flag dispositions:
 * - Captured-listener idiom (.confirm/.edgeCases/.result recommendation): this lane NEVER
 *   dispatches save-result events and must never arm a listener, so there is nothing to
 *   capture; instead the mount contract PINS that no listener is ever armed (addSpy, never
 *   window.dispatchEvent). Mitigation honoured: zero listener surface in this lane.
 * - Inline style :212 on the "no uses" note — flagged by .confirm/.edgeCases; text-only
 *   pins here (style-attribute selectors forbidden). Product fix: swap to a CSS class.
 * - No Cancel button on unusable info screen (.confirm flag) — asserting its presence would
 *   fail and pinning its absence locks in the defect; deferred with the flag, not tested.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ClairvoyantCombatantModal from './ClairvoyantCombatantModal.jsx';

// ── Mocked modules ──

vi.mock('../../../services/automation/common/savePrompt.js', () => ({
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

function renderModal(props = {}) {
  return render(<ClairvoyantCombatantModal {...makeProps(props)} />);
}

// Exact full-line match for paragraphs containing <b> spans: compare the paragraph's
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
  addEntry.mockReset().mockResolvedValue(undefined);
  runtime.getRuntimeValue.mockReset().mockReturnValue(null);
  runtime.setRuntimeValue.mockReset().mockResolvedValue(undefined);
  runtime.setRuntimeObject.mockReset();
});

// ── Mount purity: info screen is inert until confirm ──

describe('ClairvoyantCombatantModal - base (mount contract)', () => {
  it('mounts pure: renders the info screen with zero service calls and no save-result listener armed', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    renderModal();

    expect(getRollButton()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    // Nothing of the confirm lane fires before the user clicks: no writes, no prompt, no log,
    // and no save-result listener is ever armed on mount (this lane never dispatches either).
    expect(runtime.setRuntimeObject).not.toHaveBeenCalled();
    expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(createSaveListener).not.toHaveBeenCalled();
    expect(addSpy.mock.calls.filter(([type]) => type === 'save-result')).toHaveLength(0);
    addSpy.mockRestore();
  });

  // ── Info-screen description copy: exact full lines, props flow through ──

  it.each([
    { targetName: TARGET, saveType: 'Wisdom', saveDc: 13 },
    { targetName: 'Ogre Chieftain', saveType: 'Constitution', saveDc: 17 },
  ])('renders the exact target/save/failed-save copy for $targetName ($saveType DC $saveDc)', (t) => {
    renderModal({ targetName: t.targetName, saveType: t.saveType, saveDc: t.saveDc });

    expect(getParagraph(`Target: ${t.targetName} (via Awakened Mind)`)).toBeInTheDocument();
    expect(getParagraph(`Save: ${t.targetName} must make a ${t.saveType} saving throw (DC ${t.saveDc}).`)).toBeInTheDocument();
    expect(getParagraph(
      `On a Failed Save: ${t.targetName} has Disadvantage on attack rolls against you, ` +
      `and you have Advantage on attack rolls against ${t.targetName} for the duration.`
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

  // ── Note branches: exact copy of every unusable-screen note (gating behavior → .confirm) ──

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
  ])('shows the exact no-uses note when unusable ($label)', (t) => {
    renderModal(t.props);

    expect(getParagraph(t.note)).toBeInTheDocument();
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
    expect(runtime.setRuntimeObject).not.toHaveBeenCalled();
    expect(runtime.setRuntimeValue).not.toHaveBeenCalled();
    expect(addEntry).not.toHaveBeenCalled();
    expect(createSaveListener).not.toHaveBeenCalled();
  });
});
